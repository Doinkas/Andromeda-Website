import { db } from '/js/core/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { requireAnyPermission, requirePermission } from '/js/services/authz.service.js';
import { TEAM_IDS } from '/js/config/teams.config.js';
import {
  STAFF_ROLES,
  canManageStaffRole,
  getAssignableStaffRoles,
  normalizeEmail,
  normalizeStaffRecord,
  normalizeStaffRole,
  normalizeTeamId,
  roleRequiresTeamAssignment
} from '/js/services/staff-roles.js';

const STAFF_ACCESS_REF = collection(db, 'staffAccess');
const STAFF_INVITES_REF = collection(db, 'staffInvites');
const AUDIT_LOGS_REF = collection(db, 'auditLogs');

function normalizeStaffAccessInput(input = {}) {
  const uid = String(input.uid || '').trim();
  const email = normalizeEmail(input.email);
  const role = normalizeStaffRole(input.role);
  const name = String(input.name || '').trim();
  const requestedTeamId = normalizeTeamId(input.teamId);

  if (!uid) throw new Error('Firebase Auth UID is required for an existing staff record.');
  if (!email) throw new Error('Staff email is required.');
  if (!role) throw new Error(`Role must be one of: ${STAFF_ROLES.join(', ')}.`);
  const requiresTeam = roleRequiresTeamAssignment(role);
  const teamId = requiresTeam ? requestedTeamId : '';
  if (teamId && !TEAM_IDS.includes(teamId)) throw new Error('Select a valid Andromeda team.');
  if (requiresTeam && !teamId) throw new Error(`${role === 'manager' ? 'Manager' : 'Captain'} access requires an assigned team.`);

  return {
    uid,
    name,
    email,
    role,
    active: input.active !== false,
    teamId: teamId || null
  };
}

function normalizeStaffInviteInput(input = {}) {
  const email = normalizeEmail(input.email);
  const role = normalizeStaffRole(input.role);
  const name = String(input.name || '').trim();
  const requestedTeamId = normalizeTeamId(input.teamId);

  if (!email || !email.includes('@')) throw new Error('A valid staff email is required.');
  if (!role) throw new Error(`Role must be one of: ${STAFF_ROLES.join(', ')}.`);
  const requiresTeam = roleRequiresTeamAssignment(role);
  const teamId = requiresTeam ? requestedTeamId : '';
  if (teamId && !TEAM_IDS.includes(teamId)) throw new Error('Select a valid Andromeda team.');
  if (requiresTeam && !teamId) throw new Error(`${role === 'manager' ? 'Manager' : 'Captain'} invitations require an assigned team.`);

  return { name, email, role, teamId: teamId || null };
}

function normalizeStaffInviteRecord(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: String(data.name || '').trim(),
    email: normalizeEmail(data.email),
    role: normalizeStaffRole(data.role),
    teamId: normalizeTeamId(data.teamId) || null,
    status: String(data.status || '').trim().toLowerCase(),
    createdAt: data.createdAt || null,
    acceptedAt: data.acceptedAt || null,
    acceptedByUid: String(data.acceptedByUid || '').trim() || null,
    revokedAt: data.revokedAt || null
  };
}

function addAuditEntry(batch, {
  action,
  targetCollection,
  targetId,
  performedBy,
  before = null,
  after = null,
  meta = null
}) {
  batch.set(doc(AUDIT_LOGS_REF), {
    action,
    targetCollection,
    targetId,
    performedBy: performedBy || null,
    performedAt: serverTimestamp(),
    before,
    after,
    meta
  });
}

export async function listStaffAccess() {
  await requirePermission('staff:read', {
    message: 'You are not authorized to view staff access.'
  });

  const snapshot = await getDocs(query(STAFF_ACCESS_REF, orderBy('email', 'asc')));
  return snapshot.docs.map((docSnap) => normalizeStaffRecord(
    { uid: docSnap.id, ...docSnap.data() },
    { uid: docSnap.id }
  ));
}

export async function listStaffInvites() {
  await requirePermission('staff:invite', {
    message: 'You are not authorized to view staff invitations.'
  });

  const snapshot = await getDocs(query(STAFF_INVITES_REF, orderBy('createdAt', 'desc'), limit(100)));
  return snapshot.docs.map(normalizeStaffInviteRecord);
}

export async function createStaffInvite(input = {}) {
  const authz = await requirePermission('staff:invite', {
    message: 'Only Super Admins and Owners can invite staff.'
  });
  const invite = normalizeStaffInviteInput(input);
  const assignableRoles = getAssignableStaffRoles(authz.role);

  if (!assignableRoles.includes(invite.role)) {
    throw new Error('Your role cannot assign that staff role.');
  }

  const existingStaff = await getDocs(query(
    STAFF_ACCESS_REF,
    where('email', '==', invite.email),
    limit(1)
  ));
  if (!existingStaff.empty) {
    throw new Error('That email already has a staff record. Edit or reactivate the existing record instead.');
  }

  const existingPending = await getDocs(query(
    STAFF_INVITES_REF,
    where('email', '==', invite.email),
    where('status', '==', 'pending'),
    limit(1)
  ));
  if (!existingPending.empty) {
    throw new Error('A pending invitation already exists for that email.');
  }

  const inviteRef = doc(STAFF_INVITES_REF);
  const batch = writeBatch(db);
  const inviteData = {
    ...invite,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: authz.uid,
    createdByEmail: authz.email || null,
    acceptedAt: null,
    acceptedByUid: null,
    revokedAt: null,
    revokedByUid: null
  };

  batch.set(inviteRef, inviteData);
  addAuditEntry(batch, {
    action: 'staff_invite_created',
    targetCollection: 'staffInvites',
    targetId: inviteRef.id,
    performedBy: authz.email,
    after: invite
  });
  await batch.commit();

  return { id: inviteRef.id, ...invite, status: 'pending' };
}

export async function revokeStaffInvite(inviteId) {
  const authz = await requirePermission('staff:invite', {
    message: 'You are not authorized to revoke staff invitations.'
  });
  const normalizedInviteId = String(inviteId || '').trim();
  if (!normalizedInviteId) throw new Error('Invitation ID is required.');

  const inviteRef = doc(db, 'staffInvites', normalizedInviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error('Staff invitation was not found.');

  const invite = normalizeStaffInviteRecord(inviteSnap);
  if (!canManageStaffRole(authz.role, invite.role)) {
    throw new Error('Your role cannot revoke that invitation.');
  }
  if (invite.status !== 'pending') {
    throw new Error('Only pending invitations can be revoked.');
  }

  const batch = writeBatch(db);
  batch.update(inviteRef, {
    status: 'revoked',
    updatedAt: serverTimestamp(),
    revokedAt: serverTimestamp(),
    revokedByUid: authz.uid
  });
  addAuditEntry(batch, {
    action: 'staff_invite_revoked',
    targetCollection: 'staffInvites',
    targetId: normalizedInviteId,
    performedBy: authz.email,
    before: invite,
    after: { ...invite, status: 'revoked' }
  });
  await batch.commit();
}

export async function saveStaffAccess(input = {}) {
  const authz = await requireAnyPermission(['staff:manage', 'staff:manageOperational'], {
    message: 'You are not authorized to change staff access.'
  });
  const staff = normalizeStaffAccessInput(input);
  const staffRef = doc(db, 'staffAccess', staff.uid);
  const existing = await getDoc(staffRef);

  if (!existing.exists()) {
    throw new Error('Send an email invitation to create new staff access.');
  }

  const before = normalizeStaffRecord(
    { uid: existing.id, ...existing.data() },
    { uid: existing.id }
  );
  if (!canManageStaffRole(authz.role, before.role) || !canManageStaffRole(authz.role, staff.role)) {
    throw new Error('Your role cannot manage that staff record.');
  }
  if (authz.uid === staff.uid && (before.role !== staff.role || !staff.active)) {
    throw new Error('You cannot change your own role or deactivate your own access.');
  }

  const batch = writeBatch(db);
  const accessUpdate = {
    ...(!existing.data().createdAt ? { createdAt: serverTimestamp() } : {}),
    name: staff.name,
    email: staff.email,
    role: staff.role,
    active: staff.active,
    teamId: staff.teamId,
    updatedAt: serverTimestamp(),
    lastModifiedBy: authz.email || null
  };

  if (staff.active) {
    accessUpdate.deactivatedAt = null;
    accessUpdate.deactivatedBy = null;
  } else if (before.active) {
    accessUpdate.deactivatedAt = serverTimestamp();
    accessUpdate.deactivatedBy = authz.email || null;
  }

  batch.set(staffRef, accessUpdate, { merge: true });
  const auditAction = before.active && !staff.active
    ? 'staff_access_deactivated'
    : (!before.active && staff.active ? 'staff_access_reactivated' : 'staff_access_updated');
  addAuditEntry(batch, {
    action: auditAction,
    targetCollection: 'staffAccess',
    targetId: staff.uid,
    performedBy: authz.email,
    before,
    after: staff
  });
  await batch.commit();

  return staff;
}
