import { db } from '/js/core/firebase.js';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { validateTrial, validateTrialStatus } from './validation.service.js';
import { buildAuditPayload, writeAuditInTransaction } from './audit.service.js';

const trialsCollection = collection(db, 'trials');

export async function listTrials(filters = {}) {
  const clauses = [];
  if (filters.teamId) {
    clauses.push(where('teamId', '==', filters.teamId));
  }
  if (filters.status) {
    clauses.push(where('status', '==', filters.status));
  }
  const trialsQuery = query(trialsCollection, ...clauses, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(trialsQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function createTrial(trial) {
  // Validate trial before creating
  validateTrial(trial);

  const trialRef = doc(trialsCollection);
  const createdBy = trial.performedByEmail || trial.createdBy || null;
  const payload = {
    teamId: trial.teamId,
    name: trial.name,
    roles: Array.isArray(trial.roles) ? trial.roles : [],
    status: trial.status || 'pending',
    notes: trial.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastModifiedBy: createdBy
  };

  await runTransaction(db, async (tx) => {
    tx.set(trialRef, payload);

    const auditPayload = buildAuditPayload({
      action: 'trial_create',
      targetCollection: 'trials',
      targetId: trialRef.id,
      performedBy: createdBy,
      before: null,
      after: payload,
      meta: {
        teamId: trial.teamId || null
      }
    });

    writeAuditInTransaction(tx, auditPayload);
  });

  return trialRef.id;
}

export async function updateTrial(trialId, data, performedByEmail = null) {
  const trialRef = doc(db, 'trials', trialId);

  await runTransaction(db, async (tx) => {
    const beforeSnap = await tx.get(trialRef);
    if (!beforeSnap.exists()) {
      throw new Error('Trial not found');
    }

    const beforeData = beforeSnap.data();
    const nextData = {
      ...data,
      updatedAt: serverTimestamp(),
      lastModifiedBy: performedByEmail || null
    };

    tx.set(trialRef, nextData, { merge: true });

    const action = data.status && data.status !== beforeData.status
      ? 'trial_status_change'
      : 'trial_update';

    const auditPayload = buildAuditPayload({
      action,
      targetCollection: 'trials',
      targetId: trialId,
      performedBy: performedByEmail || null,
      before: beforeData,
      after: {
        ...beforeData,
        ...nextData
      },
      meta: data.status
        ? {
            previousStatus: beforeData.status || null,
            nextStatus: data.status
          }
        : null
    });

    writeAuditInTransaction(tx, auditPayload);
  });
}

export async function setTrialStatus(trialId, status, performedByEmail = null) {
  // Validate status
  validateTrialStatus(status);

  await updateTrial(trialId, { status }, performedByEmail);
}
