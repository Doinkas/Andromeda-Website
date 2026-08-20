import { auth, db } from '/js/core/firebase.js';
import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { isEmailAllowlisted } from '/js/services/admin.service.js';
import { acceptPendingStaffInvite } from '/js/services/staff-invite-claim.service.js';
import {
  authzHasAnyPermission,
  authzHasAllPermissions,
  authzHasRole,
  canAccessTeam,
  getScopedTeamId,
  parsePermissionList,
  parseRoleList,
  resolveStaffAccessSnapshot,
  shouldShowStaffDashboard
} from '/js/services/staff-roles.js';

export function getCurrentUser() {
  return auth.currentUser || null;
}

export async function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  return user;
}

export async function getStaffRecordForUser(user) {
  if (!user?.uid) return null;

  try {
    const staffRef = doc(db, 'staffAccess', user.uid);
    const staffSnap = await getDoc(staffRef);
    return staffSnap.exists() ? { uid: user.uid, ...staffSnap.data() } : null;
  } catch (error) {
    console.error('Staff access lookup failed:', error);
    throw new Error('Staff access could not be verified. Check your connection and sign in again.');
  }
}

export async function getStaffDashboardAccessForUser(user) {
  if (!user?.uid) {
    return {
      staffRecord: null,
      showDashboard: false
    };
  }

  let staffRecord = await getStaffRecordForUser(user);
  if (!staffRecord) {
    staffRecord = await acceptPendingStaffInvite(user);
  }
  return {
    staffRecord,
    showDashboard: shouldShowStaffDashboard({ user, staffRecord })
  };
}

async function getTokenClaims(user, forceRefresh = false) {
  try {
    const tokenResult = await getIdTokenResult(user, forceRefresh);
    return tokenResult?.claims || {};
  } catch (error) {
    console.error('Token claim lookup failed:', error);
    return {};
  }
}

export async function getCurrentStaffAccess({ forceRefreshToken = false } = {}) {
  const user = getCurrentUser();
  if (!user) {
    return resolveStaffAccessSnapshot();
  }

  const email = String(user.email || '').trim().toLowerCase();
  let staffRecord = await getStaffRecordForUser(user);
  const tokenClaims = await getTokenClaims(user, forceRefreshToken);

  if (!staffRecord) {
    staffRecord = await acceptPendingStaffInvite(user);
  }

  let allowlisted = false;
  if (!staffRecord) {
    try {
      allowlisted = await isEmailAllowlisted(email);
    } catch (error) {
      console.error('Allowlist check failed:', error);
    }
  }

  return resolveStaffAccessSnapshot({
    user,
    staffRecord,
    allowlisted,
    tokenClaims
  });
}

export async function requireStaffAccess({
  roles = [],
  permissions = [],
  requireAllPermissions = false,
  message = 'You are not authorized to access this admin tool.'
} = {}) {
  await requireAuth();
  const authz = await getCurrentStaffAccess();
  const allowedRoles = parseRoleList(roles);
  const requiredPermissions = parsePermissionList(permissions);

  if (!authz.isAuthorized) {
    throw new Error(message);
  }

  if (allowedRoles.length && !authzHasRole(authz, allowedRoles)) {
    throw new Error(message);
  }

  const hasRequiredPermissions = requireAllPermissions
    ? authzHasAllPermissions(authz, requiredPermissions)
    : authzHasAnyPermission(authz, requiredPermissions);

  if (requiredPermissions.length && !hasRequiredPermissions) {
    throw new Error(message);
  }

  return authz;
}

export async function requireRole(roles, options = {}) {
  return requireStaffAccess({ ...options, roles });
}

export async function requirePermission(permission, options = {}) {
  return requireStaffAccess({ ...options, permissions: [permission] });
}

export async function requireAnyPermission(permissions, options = {}) {
  return requireStaffAccess({ ...options, permissions });
}

export async function requireAllPermissions(permissions, options = {}) {
  return requireStaffAccess({ ...options, permissions, requireAllPermissions: true });
}

export async function requireTeamPermission(permission, teamId, options = {}) {
  const authz = await requirePermission(permission, options);
  if (!canAccessTeam(authz, teamId)) {
    throw new Error(options.message || 'You are not authorized to manage this team.');
  }
  return authz;
}

export async function requireAnyTeamPermission(permissions, teamId, options = {}) {
  const authz = await requireAnyPermission(permissions, options);
  if (!canAccessTeam(authz, teamId)) {
    throw new Error(options.message || 'You are not authorized to manage this team.');
  }
  return authz;
}

export function getAuthorizedTeamScope(authz, requestedTeamId = '') {
  return getScopedTeamId(authz, requestedTeamId);
}

export async function requireAdminOrCaptain() {
  return requireAnyPermission(['matches:write', 'matches:report'], {
    message: 'You are not authorized to submit match reports.'
  });
}
