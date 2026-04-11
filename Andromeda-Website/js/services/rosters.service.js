import { db } from '/js/core/firebase.js';
import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { validateRoster } from './validation.service.js';
import { buildAuditPayload, writeAuditInTransaction } from './audit.service.js';

function normalizeRoles(roles, role) {
  if (Array.isArray(roles)) {
    return roles
      .map((value) => String(value || '').toLowerCase().trim())
      .filter(Boolean);
  }

  if (typeof roles === 'string') {
    return roles
      .split(',')
      .map((value) => value.toLowerCase().trim())
      .filter(Boolean);
  }

  if (typeof role === 'string') {
    return role
      .split(',')
      .map((value) => value.toLowerCase().trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeLineup(lineup, index = 0) {
  const value = String(lineup || '').toLowerCase().trim();
  if (value === 'starter' || value === 'sub') {
    return value;
  }

  return index < 5 ? 'starter' : 'sub';
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) return [];

  return players
    .map((player, index) => {
      const name = String(player?.name || '').trim();
      const roles = normalizeRoles(player?.roles, player?.role);
      const lineup = normalizeLineup(player?.lineup, index);
      const normalized = { name, roles, lineup };

      // Preserve profile field if present
      if (player?.profile && typeof player.profile === 'object') {
        normalized.profile = player.profile;
      }

      return normalized;
    })
    .filter((player) => player.name.length > 0);
}

function normalizeTeamProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const toText = (value) => String(value || '').trim();
  const toList = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => toText(item)).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(/\r?\n|,/)
        .map((item) => toText(item))
        .filter(Boolean);
    }
    return [];
  };

  return {
    displayName: toText(profile.displayName),
    tier: toText(profile.tier),
    region: toText(profile.region),
    rating: toText(profile.rating),
    description: toText(profile.description),
    manager: toText(profile.manager),
    coaches: toText(profile.coaches),
    captain: toText(profile.captain),
    highlights: toList(profile.highlights),
    achievements: toList(profile.achievements)
  };
}

export async function getRoster(teamId) {
  const rosterRef = doc(db, 'rosters', teamId);
  const rosterSnap = await getDoc(rosterRef);

  if (!rosterSnap.exists()) {
    return { players: [] };
  }

  const data = rosterSnap.data() || {};
  return {
    ...data,
    players: normalizePlayers(data.players)
  };
}

export async function listRosterTeams() {
  const snap = await getDocs(collection(db, 'rosters'));
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      teamId: docSnap.id,
      teamName: String(data.teamName || data.name || docSnap.id).trim()
    };
  });
}

export async function saveRoster(teamId, players, lastModifiedByEmail, teamProfile = null) {
  const rosterRef = doc(db, 'rosters', teamId);
  const normalizedPlayers = normalizePlayers(players);
  const normalizedTeamProfile = normalizeTeamProfile(teamProfile);
  
  // Validate roster before saving
  validateRoster(normalizedPlayers);

  await runTransaction(db, async (tx) => {
    const beforeSnap = await tx.get(rosterRef);
    const beforeData = beforeSnap.exists() ? beforeSnap.data() : null;

    const nextRosterData = {
      players: normalizedPlayers,
      updatedAt: serverTimestamp(),
      lastModifiedBy: lastModifiedByEmail || null
    };

    if (normalizedTeamProfile) {
      nextRosterData.teamProfile = normalizedTeamProfile;
    }

    tx.set(rosterRef, nextRosterData, { merge: true });

    const auditPayload = buildAuditPayload({
      action: 'roster_update',
      targetCollection: 'rosters',
      targetId: teamId,
      performedBy: lastModifiedByEmail || null,
      before: beforeData,
      after: {
        ...beforeData,
        ...nextRosterData
      },
      meta: {
        playerCount: normalizedPlayers.length
      }
    });

    writeAuditInTransaction(tx, auditPayload);
  });
}
