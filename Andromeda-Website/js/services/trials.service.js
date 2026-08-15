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
const LEGACY_ROSTER_ID_MAP = {
  faceit: 'octantis'
};

function resolveRosterId(teamId) {
  const normalizedTeamId = String(teamId || '').trim().toLowerCase();
  return LEGACY_ROSTER_ID_MAP[normalizedTeamId] || normalizedTeamId;
}

function normalizeRoles(roles, fallbackRole = '') {
  if (Array.isArray(roles)) {
    return roles
      .map((role) => String(role || '').trim())
      .filter(Boolean);
  }

  if (typeof roles === 'string') {
    return roles
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
  }

  return String(fallbackRole || '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}

function normalizeLineup(value, fallback = 'sub') {
  const lineup = String(value || '').trim().toLowerCase();
  return lineup === 'starter' || lineup === 'sub' ? lineup : fallback;
}

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

export async function approveTrialToRoster({
  trialId,
  teamId,
  roles = [],
  lineup = 'sub',
  playerStatus = '',
  performedByEmail = null
} = {}) {
  const normalizedTrialId = String(trialId || '').trim();
  const normalizedTeamId = String(teamId || '').trim().toLowerCase();

  if (!normalizedTrialId) {
    throw new Error('Trial ID is required.');
  }

  if (!normalizedTeamId) {
    throw new Error('Team is required.');
  }

  const trialRef = doc(db, 'trials', normalizedTrialId);
  const rosterRef = doc(db, 'rosters', resolveRosterId(normalizedTeamId));

  await runTransaction(db, async (tx) => {
    const trialSnap = await tx.get(trialRef);
    if (!trialSnap.exists()) {
      throw new Error('Trial not found');
    }

    const trialData = trialSnap.data() || {};
    const playerName = String(trialData.name || '').trim();
    if (!playerName) {
      throw new Error('Trial player name is missing.');
    }

    const rosterSnap = await tx.get(rosterRef);
    const rosterData = rosterSnap.exists() ? rosterSnap.data() : {};
    const existingPlayers = Array.isArray(rosterData?.players) ? rosterData.players : [];

    const duplicate = existingPlayers.some((player) => {
      const existingName = String(player?.name || '').trim().toLowerCase();
      return existingName && existingName === playerName.toLowerCase();
    });

    if (duplicate) {
      throw new Error(`${playerName} is already on this roster.`);
    }

    const normalizedRoles = normalizeRoles(roles, trialData.roles || []);
    const normalizedStatus = String(playerStatus || '').trim();
    const nextPlayer = {
      name: playerName,
      roles: normalizedRoles,
      lineup: normalizeLineup(lineup, 'sub')
    };

    if (normalizedStatus) {
      nextPlayer.status = normalizedStatus;
    }

    const nextPlayers = [...existingPlayers, nextPlayer];
    tx.set(
      rosterRef,
      {
        players: nextPlayers,
        needsReview: true,
        updatedAt: serverTimestamp(),
        lastModifiedBy: performedByEmail || null
      },
      { merge: true }
    );

    tx.set(
      trialRef,
      {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: performedByEmail || null,
        convertedToRoster: true,
        rosterTeamId: normalizedTeamId,
        updatedAt: serverTimestamp(),
        lastModifiedBy: performedByEmail || null
      },
      { merge: true }
    );

    const auditPayload = buildAuditPayload({
      action: 'trial_approve_to_roster',
      targetCollection: 'trials',
      targetId: normalizedTrialId,
      performedBy: performedByEmail || null,
      before: trialData,
      after: {
        ...trialData,
        status: 'approved',
        convertedToRoster: true,
        rosterTeamId: normalizedTeamId
      },
      meta: {
        teamId: normalizedTeamId,
        rosterPlayerName: playerName,
        lineup: nextPlayer.lineup,
        roles: normalizedRoles,
        status: normalizedStatus || null,
        rosterNeedsReview: true
      }
    });

    writeAuditInTransaction(tx, auditPayload);
  });
}
