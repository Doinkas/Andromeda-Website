import { auth, db } from '/js/core/firebase.js';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { requirePermission } from '/js/services/authz.service.js';
import { getStaffDisplayName } from './staff-identity.js';

const auditLogsCollection = collection(db, 'auditLogs');
const staffAccessCollection = collection(db, 'staffAccess');

export function newAuditLogRef() {
  return doc(auditLogsCollection);
}

export function buildAuditPayload({
  action,
  targetCollection,
  targetId,
  performedBy,
  before = null,
  after = null,
  meta = null
}) {
  return {
    action,
    targetCollection,
    targetId,
    actorUid: auth.currentUser?.uid || null,
    performedBy: performedBy || null,
    performedAt: serverTimestamp(),
    before,
    after,
    meta
  };
}

export function writeAuditInTransaction(tx, payload) {
  const auditRef = newAuditLogRef();
  tx.set(auditRef, payload);
  return auditRef;
}

export async function logAudit({ action, entityType, entityId, meta = null, performedBy = null }) {
  const ref = newAuditLogRef();
  await setDoc(ref, {
    action: action || 'unknown',
    targetCollection: entityType || null,
    targetId: entityId || null,
    actorUid: auth.currentUser?.uid || null,
    performedBy: performedBy || null,
    performedAt: serverTimestamp(),
    before: null,
    after: null,
    meta
  });
  return ref.id;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAuditTeamId(entry) {
  const metaTeam = String(entry?.meta?.teamId || '').trim().toLowerCase();
  if (metaTeam) return metaTeam;

  const afterTeam = String(entry?.after?.teamId || '').trim().toLowerCase();
  if (afterTeam) return afterTeam;

  const beforeTeam = String(entry?.before?.teamId || '').trim().toLowerCase();
  if (beforeTeam) return beforeTeam;

  const targetId = String(entry?.targetId || '').trim().toLowerCase();
  if (targetId) return targetId;

  return '';
}

export async function listAuditLogs({ teamId = '', action = '', startDate = null, endDate = null, limitCount = 250 } = {}) {
  await requirePermission('auditLogs:read', {
    message: 'You are not authorized to view audit logs.'
  });

  const safeLimit = Math.min(Math.max(Number(limitCount) || 250, 1), 500);
  const [snapshot, staffSnapshot] = await Promise.all([
    getDocs(query(auditLogsCollection, orderBy('performedAt', 'desc'), limit(safeLimit))),
    getDocs(staffAccessCollection)
  ]);
  const staffNamesByUid = new Map(staffSnapshot.docs.map((docSnap) => [
    docSnap.id,
    String(docSnap.data()?.name || '').trim()
  ]));
  const normalizedTeam = String(teamId || '').trim().toLowerCase();
  const normalizedAction = String(action || '').trim().toLowerCase();
  const start = toDate(startDate);
  const end = toDate(endDate);

  return snapshot.docs
    .map((docSnap) => {
      const entry = { id: docSnap.id, ...docSnap.data() };
      return {
        ...entry,
        actorName: getStaffDisplayName({
          staffName: staffNamesByUid.get(String(entry.actorUid || '').trim()),
          email: entry.performedBy
        })
      };
    })
    .filter((entry) => {
      if (normalizedAction && String(entry.action || '').trim().toLowerCase() !== normalizedAction) {
        return false;
      }

      if (normalizedTeam) {
        const logTeam = getAuditTeamId(entry);
        if (logTeam !== normalizedTeam) {
          return false;
        }
      }

      const performedAt = toDate(entry.performedAt);
      if (start && (!performedAt || performedAt < start)) return false;
      if (end && (!performedAt || performedAt > end)) return false;
      return true;
    });
}
