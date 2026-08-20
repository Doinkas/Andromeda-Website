import { db, storage } from '/js/core/firebase.js';
import {
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  query,
  serverTimestamp,
  setDoc,
  orderBy,
  startAfter,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  getDownloadURL,
  ref,
  uploadBytes
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';
import {
  requireAnyPermission,
  requireAnyTeamPermission,
  requireTeamPermission
} from '/js/services/authz.service.js';
import { canAccessTeam, getScopedTeamId, normalizeTeamId } from '/js/services/staff-roles.js';
import { logAudit } from '/js/services/audit.service.js';

const matchesRef = collection(db, 'matches');

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function normalizeString(value, fallback = '') {
  return String(value || fallback).trim();
}

function normalizeType(value) {
  const type = normalizeString(value).toLowerCase();
  if (type !== 'scrim' && type !== 'official') {
    throw new Error('Type must be official or scrim.');
  }
  return type;
}

function normalizeResult(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized !== 'W' && normalized !== 'L') {
    throw new Error('Result must be W or L.');
  }
  return normalized;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMapsPlayed(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeString(entry)).filter(Boolean);
  return normalizeString(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseStats(value) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  const text = normalizeString(value);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Stats must be a JSON object.');
    }
    return parsed;
  } catch (error) {
    throw new Error('Stats must be valid JSON object text.');
  }
}

function applyOptionalMatchFields(payload, matchData) {
  const mapScoreFor = parseOptionalNumber(matchData.mapScoreFor);
  const mapScoreAgainst = parseOptionalNumber(matchData.mapScoreAgainst);
  const mapsPlayed = parseMapsPlayed(matchData.mapsPlayed);
  const notes = normalizeString(matchData.notes);
  const stats = parseStats(matchData.stats);

  if (mapScoreFor !== null) payload.mapScoreFor = mapScoreFor;
  if (mapScoreAgainst !== null) payload.mapScoreAgainst = mapScoreAgainst;
  if (mapsPlayed.length) payload.mapsPlayed = mapsPlayed;
  if (notes) payload.notes = notes;
  if (stats) payload.stats = stats;
}

function validateImageFile(file) {
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`File too large (${file.name}). Max size is 5MB.`);
  }
}

function sanitizeFilename(name) {
  return normalizeString(name, 'image')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

export async function uploadMatchScreenshots(type, teamId, matchId, files = [], onProgress = null) {
  const uploads = Array.from(files || []);

  if (!uploads.length) {
    return [];
  }

  await requireAnyTeamPermission(['matches:write', 'matches:report'], teamId, {
    message: 'You are not authorized to upload match screenshots for this team.'
  });

  uploads.forEach(validateImageFile);

  const urls = [];
  const rootPath = type === 'scrim' ? 'scrims' : 'officials';

  for (let index = 0; index < uploads.length; index += 1) {
    const file = uploads[index];
    const filename = `${Date.now()}-${index}-${sanitizeFilename(file.name)}`;
    const path = `${rootPath}/${teamId}/${matchId}/${filename}`;
    const fileRef = ref(storage, path);

    await uploadBytes(fileRef, file, { contentType: file.type });
    const url = await getDownloadURL(fileRef);
    urls.push(url);

    if (typeof onProgress === 'function') {
      onProgress({
        uploaded: index + 1,
        total: uploads.length,
        name: file.name
      });
    }
  }

  return urls;
}

export async function createMatchDoc(matchData) {
  const type = normalizeType(matchData.type || 'scrim');
  const teamId = normalizeString(matchData.teamId).toLowerCase();
  const authz = await requireTeamPermission('matches:write', teamId, {
    message: 'You are not authorized to create match reports for this team.'
  });
  const teamName = normalizeString(matchData.teamName);
  const opponentName = normalizeString(matchData.opponentName);
  const replayCode = normalizeString(matchData.replayCode);
  const result = normalizeResult(matchData.result);

  if (!teamId || !teamName || !opponentName || !replayCode) {
    throw new Error('Team, opponent, replay code, and result are required.');
  }

  const payload = {
    type,
    teamId,
    teamName,
    opponent: opponentName,
    opponentName,
    replayCode,
    result,
    createdAt: serverTimestamp(),
    createdByUid: authz.user.uid,
    createdByEmail: authz.email,
    screenshotUrls: Array.isArray(matchData.screenshotUrls) ? matchData.screenshotUrls : []
  };
  applyOptionalMatchFields(payload, matchData);

  const matchRef = doc(matchesRef);
  await setDoc(matchRef, payload);

  await logAudit({
    action: type === 'scrim' ? 'scrim_create' : 'official_match_create',
    entityType: 'matches',
    entityId: matchRef.id,
    performedBy: authz.email,
    meta: {
      type,
      teamId: payload.teamId,
      opponentName: payload.opponentName,
      result: payload.result,
      screenshotCount: payload.screenshotUrls.length
    }
  });

  return matchRef.id;
}

export async function createMatchEntry(matchData, files = [], onProgress = null) {
  const type = normalizeType(matchData.type || 'scrim');
  const teamId = normalizeString(matchData.teamId).toLowerCase();
  const authz = await requireTeamPermission('matches:write', teamId, {
    message: 'You are not authorized to create match reports for this team.'
  });
  const teamName = normalizeString(matchData.teamName);
  const opponentName = normalizeString(matchData.opponentName);
  const replayCode = normalizeString(matchData.replayCode);
  const result = normalizeResult(matchData.result);

  if (!teamId || !teamName || !opponentName || !replayCode) {
    throw new Error('Team, opponent, replay code, and result are required.');
  }

  const matchRef = doc(matchesRef);

  const screenshotUrls = await uploadMatchScreenshots(type, teamId, matchRef.id, files, onProgress);

  const payload = {
    type,
    teamId,
    teamName,
    opponent: opponentName,
    opponentName,
    replayCode,
    result,
    createdAt: serverTimestamp(),
    createdByUid: authz.user.uid,
    createdByEmail: authz.email,
    screenshotUrls
  };
  applyOptionalMatchFields(payload, matchData);

  await setDoc(matchRef, payload);

  await logAudit({
    action: type === 'scrim' ? 'scrim_create' : 'official_match_create',
    entityType: 'matches',
    entityId: matchRef.id,
    performedBy: authz.email,
    meta: {
      type,
      teamId: payload.teamId,
      opponentName: payload.opponentName,
      result: payload.result,
      screenshotCount: screenshotUrls.length
    }
  });

  return matchRef.id;
}

export async function createScrim(scrimData, files = [], onProgress = null) {
  return createMatchEntry({ ...scrimData, type: 'scrim' }, files, onProgress);
}

function buildAdminMatchesQuery({ type = null, teamId = null, limit = 20, cursor = null } = {}) {
  const constraints = [];

  if (type) {
    constraints.push(where('type', '==', type));
  }

  if (teamId) {
    constraints.push(where('teamId', '==', teamId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(fbLimit(limit));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  return query(matchesRef, ...constraints);
}

export async function listAdminMatches({ type = null, teamId = null, limit = 20, cursor = null } = {}) {
  const authz = await requireAnyPermission(['matches:read'], {
    message: 'You are not authorized to view admin match records.'
  });
  const scopedTeamId = getScopedTeamId(authz, teamId);
  if (scopedTeamId === null || (teamId && !canAccessTeam(authz, normalizeTeamId(teamId)))) {
    throw new Error('You are not authorized to view matches for this team.');
  }

  const q = buildAdminMatchesQuery({ type, teamId: scopedTeamId || null, limit, cursor });
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const nextCursor = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { items, nextCursor };
}

export async function listRecentScrims({ teamId = null, limit = 5 } = {}) {
  const { items } = await listAdminMatches({ type: 'scrim', teamId, limit });
  return items;
}

export async function listScrims({ teamId = null, limit = 20, cursor = null } = {}) {
  return listAdminMatches({ type: 'scrim', teamId, limit, cursor });
}
