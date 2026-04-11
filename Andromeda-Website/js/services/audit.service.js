import { db } from '/js/core/firebase.js';
import { collection, doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const auditLogsCollection = collection(db, 'auditLogs');

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
    performedBy: performedBy || null,
    performedAt: serverTimestamp(),
    before: null,
    after: null,
    meta
  });
  return ref.id;
}
