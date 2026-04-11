import { auth, db } from '/js/core/firebase.js';
import { isEmailAllowlisted } from '/js/services/admin.service.js';
import { 
  collection, 
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

async function requireAllowlistedAdmin() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in.');
  }

  const email = normalizeString(user.email).toLowerCase();
  if (!email) {
    throw new Error('Signed-in user email is unavailable.');
  }

  const allowlisted = await isEmailAllowlisted(email);
  if (!allowlisted) {
    throw new Error('You are not authorized to view match reports.');
  }
}

/**
 * List matches for a specific team from Firestore.
 * @param {string} teamId - Team ID (horizon, proxima, spiral, faceit)
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

  const q = query(matchesRef);
  const snapshot = await getDocs(q);
  const items = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((match) => {
      const type = normalizeString(match.type).toLowerCase();
      const source = normalizeString(match.source).toLowerCase();
      return type === 'official' || (!type && source === 'schedule.html');
    })
    .filter((match) => normalizeString(match.teamId).toLowerCase() === normalizedTeamId)
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

  return items.slice(0, Math.max(3, limit));
}

export async function listMatchReportsForAdmin({ limit = 300 } = {}) {
  await requireAllowlistedAdmin();

  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 500);
  const q = query(matchesRef, orderBy('createdAt', 'desc'), fbLimit(safeLimit));
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

export async function listRecentOfficialMatches({ limit = 3 } = {}) {
  return listOfficialMatches({ limit });
}

export async function listAdminMatches({ teamId, limit = 50, upcomingOnly = true } = {}) {
  const constraints = [];
  if (teamId) {
    constraints.push(where('teamId', '==', teamId));
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

  const batch = writeBatch(db);
  
  for (const match of matches) {
    const matchId = buildMatchId({
      teamId: match.teamId,
      scheduledAt: match.scheduledAt,
      opponent: match.opponent
    });
    
    const matchRef = doc(db, 'matches', matchId);
    
    batch.set(matchRef, {
      type: 'official',
      teamId: match.teamId,
      opponent: match.opponent,
      opponentName: match.opponent,
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
  const normalizedTeamIds = Array.from(new Set(
    (Array.isArray(teamIds) ? teamIds : [])
      .map((teamId) => normalizeString(teamId).toLowerCase())
      .filter(Boolean)
  ));

  if (!normalizedTeamIds.length) {
    return 0;
  }

  const scheduleQuery = query(matchesRef, where('source', '==', 'schedule.html'));
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
  await setDoc(matchDoc, {
    type: match.type || 'official',
    teamId: match.teamId,
    opponent: match.opponent,
    opponentName: match.opponent,
    streamUrl: match.streamUrl || null,
    scheduledAt: Timestamp.fromDate(scheduledDate),
    source: match.source || 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastModifiedBy: performedByEmail || null
  }, { merge: true });

  return matchId;
}
