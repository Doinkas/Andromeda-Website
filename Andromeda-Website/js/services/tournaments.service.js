import { auth, db } from '/js/core/firebase.js';
import {
  Timestamp,
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { isEmailAllowlisted } from '/js/services/admin.service.js';

const tournamentsRef = collection(db, 'tournaments');

function normalizeString(value) {
  return String(value || '').trim();
}

function toTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value?.toDate && typeof value.toDate === 'function') {
    return Timestamp.fromDate(value.toDate());
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }

  return normalizeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRecord(record) {
  const wins = Number(record?.wins);
  const losses = Number(record?.losses);

  return {
    wins: Number.isFinite(wins) ? wins : 0,
    losses: Number.isFinite(losses) ? losses : 0
  };
}

function normalizeTournamentInput(data, { includeCreatedAt = false, forUpdate = false } = {}) {
  const payload = {
    name: normalizeString(data?.name),
    game: normalizeString(data?.game),
    startDate: toTimestamp(data?.startDate),
    isPublished: data?.isPublished !== false,
    record: normalizeRecord(data?.record),
    updatedAt: serverTimestamp()
  };

  const endDate = toTimestamp(data?.endDate);
  if (endDate) payload.endDate = endDate;
  else if (forUpdate) payload.endDate = deleteField();

  const placementText = normalizeString(data?.placementText);
  if (placementText) payload.placementText = placementText;
  else if (forUpdate) payload.placementText = deleteField();

  const achievements = normalizeStringList(data?.achievements);
  if (achievements.length) payload.achievements = achievements;
  else if (forUpdate) payload.achievements = deleteField();

  const highlights = normalizeStringList(data?.highlights);
  if (highlights.length) payload.highlights = highlights;
  else if (forUpdate) payload.highlights = deleteField();

  const link = normalizeString(data?.link);
  if (link) payload.link = link;
  else if (forUpdate) payload.link = deleteField();

  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  } else {
    const createdAt = toTimestamp(data?.createdAt);
    if (!createdAt) {
      throw new Error('createdAt is required for updates.');
    }
    payload.createdAt = createdAt;
  }

  return payload;
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
    throw new Error('You are not authorized to manage tournaments.');
  }

  return { user, email };
}

export async function listPublishedTournaments(limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const q = query(
    tournamentsRef,
    where('isPublished', '==', true),
    orderBy('startDate', 'desc'),
    fbLimit(safeLimit)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAllTournamentsForAdmin(limit = 200) {
  await requireAllowlistedAdmin();

  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const q = query(tournamentsRef, orderBy('startDate', 'desc'), fbLimit(safeLimit));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function createTournament(data) {
  await requireAllowlistedAdmin();
  const payload = normalizeTournamentInput(data, { includeCreatedAt: true, forUpdate: false });
  const created = await addDoc(tournamentsRef, payload);
  return created.id;
}

export async function updateTournament(id, data) {
  await requireAllowlistedAdmin();

  const tournamentId = normalizeString(id);
  if (!tournamentId) {
    throw new Error('Tournament ID is required.');
  }

  const payload = normalizeTournamentInput(data, { includeCreatedAt: false, forUpdate: true });
  await updateDoc(doc(db, 'tournaments', tournamentId), payload);
}

export async function deleteTournament(id) {
  await requireAllowlistedAdmin();

  const tournamentId = normalizeString(id);
  if (!tournamentId) {
    throw new Error('Tournament ID is required.');
  }

  await deleteDoc(doc(db, 'tournaments', tournamentId));
}
