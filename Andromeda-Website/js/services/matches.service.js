import { db } from '/js/core/firebase.js';
import { requireAnyPermission, requireTeamPermission } from '/js/services/authz.service.js';
import {
  canAccessTeam,
  canAccessTeamTransition,
  getScopedTeamId,
  normalizeTeamId
} from '/js/services/staff-roles.js';
import { TEAM_IDS } from '/js/config/teams.config.js';
import { 
  collection, 
  deleteDoc,
  getDoc,
  query, 
  where, 
  orderBy,
  limit as fbLimit, 
  getDocs, 
  writeBatch,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const matchesRef = collection(db, 'matches');

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeResult(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized === 'WIN') return 'W';
  if (normalized === 'LOSS') return 'L';
  if (normalized === 'DRAW') return 'D';
  return ['W', 'L', 'D'].includes(normalized) ? normalized : null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  return normalizeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requireMatchViewer(teamId = '') {
  const authz = await requireAnyPermission(['matches:read'], {
    message: 'You are not authorized to view admin match records.'
  });
  const normalizedTeamId = normalizeTeamId(teamId);

  if (normalizedTeamId && !canAccessTeam(authz, normalizedTeamId)) {
    throw new Error('You are not authorized to view matches for this team.');
  }

  return authz;
}

async function requireMatchEditor(teamId = '') {
  const normalizedTeamId = normalizeTeamId(teamId);
  if (normalizedTeamId) {
    return requireTeamPermission('matches:write', normalizedTeamId, {
      message: 'You are not authorized to manage matches for this team.'
    });
  }

  return requireAnyPermission(['matches:write'], {
    message: 'You are not authorized to manage matches.'
  });
}

/**
 * List matches for a specific team from Firestore.
 * @param {string} teamId - Team ID from teams.config.js
 * @param {object} options - Query options
 * @param {number} options.limit - Max number of matches to return
 * @param {boolean} options.upcomingOnly - If true, filter for future matches only
 * @returns {Promise<Array>} Array of match objects with id
 */
export async function listMatchesByTeam(teamId, { limit = 10, upcomingOnly = false } = {}) {
  const normalizedTeamId = normalizeString(teamId).toLowerCase();
  if (!normalizedTeamId) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const q = query(
    matchesRef,
    where('type', '==', 'official'),
    where('teamId', '==', normalizedTeamId),
    fbLimit(Math.min(Math.max(safeLimit * 12, 100), 300))
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((match) => {
      if (!upcomingOnly) return true;
      const date = match.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match.scheduledAt);
      if (Number.isNaN(date.getTime())) return false;
      return date.getTime() >= Date.now();
    })
    .sort((a, b) => {
      const aDate = a.scheduledAt?.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
      const bDate = b.scheduledAt?.toDate ? b.scheduledAt.toDate() : new Date(b.scheduledAt);
      const aTime = Number.isNaN(aDate.getTime()) ? 0 : aDate.getTime();
      const bTime = Number.isNaN(bDate.getTime()) ? 0 : bDate.getTime();
      return upcomingOnly ? aTime - bTime : bTime - aTime;
    });

  return items.slice(0, Math.max(3, safeLimit));
}

export async function listMatchReportsForAdmin({ limit = 300 } = {}) {
  const authz = await requireMatchViewer();
  const scopedTeamId = getScopedTeamId(authz);

  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 500);
  const constraints = [];
  if (scopedTeamId) {
    constraints.push(where('teamId', '==', scopedTeamId));
  }
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(fbLimit(safeLimit));

  const q = query(matchesRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bDate - aDate;
    });
}

export async function listOfficialMatches({ teamId = null, limit = 20 } = {}) {
  const q = query(matchesRef, where('type', '==', 'official'), fbLimit(Math.max(limit * 6, 40)));
  const snapshot = await getDocs(q);

  const items = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((match) => !teamId || match.teamId === teamId)
    .sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return bDate - aDate;
    });

  return items.slice(0, limit);
}

export async function listCompletedOfficialMatches({ teamId = null, limit = 100 } = {}) {
  const normalizedTeamId = normalizeString(teamId).toLowerCase();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const q = query(matchesRef, where('type', '==', 'official'), fbLimit(Math.max(safeLimit * 3, 120)));
  const snapshot = await getDocs(q);
  const now = Date.now();

  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((match) => {
      if (normalizedTeamId && normalizeString(match.teamId).toLowerCase() !== normalizedTeamId) {
        return false;
      }

      const result = normalizeResult(match.result);
      const date = match.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match.scheduledAt);
      const hasPlayed = !Number.isNaN(date.getTime()) && date.getTime() < now;
      return Boolean(result) || hasPlayed;
    })
    .sort((a, b) => {
      const aDate = a.scheduledAt?.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
      const bDate = b.scheduledAt?.toDate ? b.scheduledAt.toDate() : new Date(b.scheduledAt);
      const aTime = Number.isNaN(aDate.getTime()) ? 0 : aDate.getTime();
      const bTime = Number.isNaN(bDate.getTime()) ? 0 : bDate.getTime();
      return bTime - aTime;
    })
    .slice(0, safeLimit);
}

export async function listRecentOfficialMatches({ limit = 3 } = {}) {
  return listOfficialMatches({ limit });
}

export async function listAdminMatches({ teamId, limit = 50, upcomingOnly = true } = {}) {
  const authz = await requireMatchViewer(teamId);
  const scopedTeamId = getScopedTeamId(authz, teamId);

  if (scopedTeamId === null) {
    throw new Error('You are not authorized to view matches for this team.');
  }

  const constraints = [];
  if (scopedTeamId) {
    constraints.push(where('teamId', '==', scopedTeamId));
  }
  if (upcomingOnly) {
    constraints.push(where('scheduledAt', '>=', Timestamp.now()));
  }
  constraints.push(orderBy('scheduledAt', 'asc'));
  constraints.push(fbLimit(limit));

  const q = query(matchesRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

/**
 * Convert a string to a slug (lowercase, alphanumeric + dash).
 * @param {string} str - String to slugify
 * @returns {string} Slugified string
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a deterministic match ID for idempotent imports.
 * @param {object} params - Match parameters
 * @param {string} params.teamId - Team ID
 * @param {Date} params.scheduledAt - Scheduled date/time
 * @param {string} params.opponent - Opponent name
 * @returns {string} Deterministic match ID
 */
export function buildMatchId({ teamId, scheduledAt, opponent }) {
  const year = scheduledAt.getFullYear();
  const month = String(scheduledAt.getMonth() + 1).padStart(2, '0');
  const day = String(scheduledAt.getDate()).padStart(2, '0');
  const hours = String(scheduledAt.getHours()).padStart(2, '0');
  const minutes = String(scheduledAt.getMinutes()).padStart(2, '0');
  
  const dateStr = `${year}${month}${day}`;
  const timeStr = `${hours}${minutes}`;
  const opponentSlug = slugify(opponent);
  
  return `${teamId}_${dateStr}_${timeStr}_${opponentSlug}`;
}

/**
 * Upsert matches to Firestore using batch writes (idempotent via merge).
 * @param {Array<object>} matches - Array of match objects
 * @param {string} performedByEmail - Email of the user performing the import
 * @returns {Promise<void>}
 */
export async function upsertMatches(matches, performedByEmail = null) {
  if (!matches || matches.length === 0) {
    return;
  }

  const authz = await requireMatchEditor();
  const invalidTeam = matches
    .map((match) => normalizeTeamId(match.teamId))
    .find((teamId) => !TEAM_IDS.includes(teamId));
  if (invalidTeam !== undefined) {
    throw new Error('Every imported match must use a valid Andromeda team.');
  }

  const unauthorizedTeam = matches
    .map((match) => normalizeTeamId(match.teamId))
    .find((teamId) => !canAccessTeam(authz, teamId));

  if (unauthorizedTeam) {
    throw new Error(`You are not authorized to import matches for ${unauthorizedTeam}.`);
  }

  const preparedMatches = matches.map((match) => {
    const matchId = buildMatchId({
      teamId: match.teamId,
      scheduledAt: match.scheduledAt,
      opponent: match.opponent
    });
    return { match, matchId, matchRef: doc(db, 'matches', matchId) };
  });
  const existingSnapshots = await Promise.all(
    preparedMatches.map(({ matchRef }) => getDoc(matchRef))
  );

  existingSnapshots.forEach((snapshot, index) => {
    if (!snapshot.exists()) return;
    const currentTeamId = normalizeTeamId(snapshot.data()?.teamId);
    const nextTeamId = normalizeTeamId(preparedMatches[index].match.teamId);
    if (!canAccessTeamTransition(authz, currentTeamId, nextTeamId)) {
      throw new Error('You are not authorized to replace an existing match for another team.');
    }
  });

  const batch = writeBatch(db);
  for (const { match, matchRef } of preparedMatches) {
    batch.set(matchRef, {
      type: 'official',
      teamId: normalizeTeamId(match.teamId),
      opponent: match.opponent,
      opponentName: match.opponent,
      eventName: normalizeString(match.eventName || match.tournamentName) || null,
      streamUrl: match.streamUrl || null,
      scheduledAt: Timestamp.fromDate(match.scheduledAt),
      source: 'schedule.html',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastModifiedBy: performedByEmail || null
    }, { merge: true });
  }
  
  await batch.commit();
}

export async function clearImportedScheduleMatches(teamIds = []) {
  const authz = await requireMatchEditor();
  const normalizedTeamIds = Array.from(new Set(
    (Array.isArray(teamIds) ? teamIds : [])
      .map((teamId) => normalizeString(teamId).toLowerCase())
      .filter(Boolean)
  ));

  if (!normalizedTeamIds.length) {
    return 0;
  }

  const unauthorizedTeam = normalizedTeamIds.find((teamId) => !canAccessTeam(authz, teamId));
  if (unauthorizedTeam) {
    throw new Error(`You are not authorized to clear matches for ${unauthorizedTeam}.`);
  }

  const scopedTeamId = getScopedTeamId(authz);
  const scheduleQuery = scopedTeamId
    ? query(
        matchesRef,
        where('teamId', '==', scopedTeamId),
        where('source', '==', 'schedule.html')
      )
    : query(matchesRef, where('source', '==', 'schedule.html'));
  const snapshot = await getDocs(scheduleQuery);

  const docsToDelete = snapshot.docs.filter((docSnap) => {
    const teamId = normalizeString(docSnap.data()?.teamId).toLowerCase();
    return normalizedTeamIds.includes(teamId);
  });

  let deletedCount = 0;
  for (let index = 0; index < docsToDelete.length; index += 450) {
    const chunk = docsToDelete.slice(index, index + 450);
    const batch = writeBatch(db);

    chunk.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      deletedCount += 1;
    });

    await batch.commit();
  }

  return deletedCount;
}

export async function saveAdminMatch(match, performedByEmail = null) {
  if (!match || !match.teamId || !match.opponent || !match.scheduledAt) {
    throw new Error('Match team, opponent, and date/time are required');
  }

  const teamId = normalizeTeamId(match.teamId);
  if (!TEAM_IDS.includes(teamId)) {
    throw new Error('Select a valid Andromeda team.');
  }
  const authz = await requireMatchEditor(teamId);

  const scheduledDate = match.scheduledAt instanceof Date
    ? match.scheduledAt
    : new Date(match.scheduledAt);

  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error('Invalid match date/time');
  }

  const matchId = match.id || buildMatchId({
    teamId: match.teamId,
    scheduledAt: scheduledDate,
    opponent: match.opponent
  });

  const matchDoc = doc(db, 'matches', matchId);
  const existing = await getDoc(matchDoc);
  if (existing.exists()) {
    const currentTeamId = normalizeTeamId(existing.data()?.teamId);
    if (!canAccessTeamTransition(authz, currentTeamId, teamId)) {
      throw new Error('You are not authorized to move or update this match.');
    }
  }

  await setDoc(matchDoc, {
    type: match.type || 'official',
    teamId,
    opponent: match.opponent,
    opponentName: match.opponent,
    eventName: normalizeString(match.eventName || match.tournamentName) || null,
    streamUrl: match.streamUrl || null,
    result: normalizeResult(match.result),
    score: normalizeString(match.score) || null,
    mapScoreFor: normalizeNumber(match.mapScoreFor),
    mapScoreAgainst: normalizeNumber(match.mapScoreAgainst),
    mapsPlayed: normalizeStringList(match.mapsPlayed),
    replayCode: normalizeString(match.replayCode) || null,
    notes: normalizeString(match.notes) || null,
    screenshotUrls: Array.isArray(match.screenshotUrls) ? match.screenshotUrls : [],
    scheduledAt: Timestamp.fromDate(scheduledDate),
    source: match.source || 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastModifiedBy: performedByEmail || null
  }, { merge: true });

  return matchId;
}

export async function deleteAdminMatch(matchId) {
  const normalizedMatchId = normalizeString(matchId);
  if (!normalizedMatchId) {
    throw new Error('Match ID is required.');
  }

  const matchRef = doc(db, 'matches', normalizedMatchId);
  const snapshot = await getDoc(matchRef);
  if (!snapshot.exists()) {
    throw new Error('Match not found.');
  }

  const teamId = normalizeTeamId(snapshot.data()?.teamId);
  if (!TEAM_IDS.includes(teamId)) {
    throw new Error('This match does not have a valid Andromeda team.');
  }
  await requireMatchEditor(teamId);
  await deleteDoc(matchRef);
}
