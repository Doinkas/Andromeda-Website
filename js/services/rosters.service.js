import { db } from '/js/core/firebase.js';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { validateRoster } from './validation.service.js';
import { logAudit } from './audit.service.js';
import { requirePermission, requireTeamPermission } from '/js/services/authz.service.js';
import { TEAM_IDS } from '/js/config/teams.config.js';
import { getStaffDisplayName } from './staff-identity.js';

const LEGACY_ROSTER_ID_MAP = {
  faceit: 'octantis'
};

function resolveRosterId(teamId) {
  const normalizedTeamId = String(teamId || '').trim().toLowerCase();
  return LEGACY_ROSTER_ID_MAP[normalizedTeamId] || normalizedTeamId;
}

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
      const status = String(player?.status || '').trim();
      return {
        name,
        roles,
        lineup,
        ...(status ? { status } : {})
      };
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
  const rosterId = resolveRosterId(teamId);
  const rosterRef = doc(db, 'rosters', rosterId);
  const rosterSnap = await getDoc(rosterRef);

  if (!rosterSnap.exists()) {
    if (rosterId !== 'octantis') {
      return { players: [] };
    }

    const legacySnap = await getDoc(doc(db, 'rosters', 'faceit'));
    if (!legacySnap.exists()) {
      return { players: [] };
    }

    const legacyData = legacySnap.data() || {};
    return {
      ...legacyData,
      players: normalizePlayers(legacyData.players)
    };
  }

  const data = rosterSnap.data() || {};
  return {
    ...data,
    players: normalizePlayers(data.players),
    verifiedAt: data.verifiedAt || null,
    verifiedBy: data.verifiedBy || null,
    verifiedByUid: data.verifiedByUid || null,
    verifiedByEmail: data.verifiedByEmail || null,
    verifiedByName: data.verifiedByName || null,
    needsReview: data.needsReview === true
  };
}

export async function listRosterTeams() {
  const snap = await getDocs(collection(db, 'rosters'));
  const teams = new Map();

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const resolvedTeamId = resolveRosterId(docSnap.id);
    const resolvedTeamName = String(data.teamName || data.name || resolvedTeamId).trim();

    if (!teams.has(resolvedTeamId)) {
      teams.set(resolvedTeamId, {
        teamId: resolvedTeamId,
        teamName: resolvedTeamName
      });
    }
  });

  return Array.from(teams.values());
}

export async function listRostersNeedingReview() {
  await requirePermission('teams:any', {
    message: 'You are not authorized to view the organization review queue.'
  });

  const reviewQuery = query(
    collection(db, 'rosters'),
    where('needsReview', '==', true)
  );
  const snapshot = await getDocs(reviewQuery);
  const rosters = new Map();

  snapshot.docs.forEach((docSnap) => {
    const teamId = resolveRosterId(docSnap.id);
    if (!TEAM_IDS.includes(teamId)) return;

    const item = { ...docSnap.data(), id: docSnap.id, teamId };
    if (!rosters.has(teamId) || docSnap.id === teamId) {
      rosters.set(teamId, item);
    }
  });

  return Array.from(rosters.values());
}

export async function saveRoster(teamId, players, lastModifiedByEmail, teamProfile = null, options = {}) {
  const rosterId = resolveRosterId(teamId);
  if (!TEAM_IDS.includes(rosterId)) {
    throw new Error('Select a valid Andromeda team.');
  }
  await requireTeamPermission('rosters:write', rosterId, {
    message: 'You are not authorized to manage this team roster.'
  });

  const rosterRef = doc(db, 'rosters', rosterId);
  const legacyRosterRef = rosterId === 'octantis' ? doc(db, 'rosters', 'faceit') : null;
  const normalizedPlayers = normalizePlayers(players);
  const normalizedTeamProfile = normalizeTeamProfile(teamProfile);
  const markNeedsReview = options.markNeedsReview !== false;
  const diffSummary = options.diffSummary || null;
  const auditAction = String(options.auditAction || 'roster_update');
  let beforeData = null;
  
  // Validate roster before saving
  validateRoster(normalizedPlayers);

  await runTransaction(db, async (tx) => {
    const beforeSnap = await tx.get(rosterRef);
    beforeData = beforeSnap.exists() ? beforeSnap.data() : null;
    const legacySnap = legacyRosterRef ? await tx.get(legacyRosterRef) : null;

    const nextRosterData = {
      players: normalizedPlayers,
      updatedAt: serverTimestamp(),
      lastModifiedBy: lastModifiedByEmail || null,
      needsReview: markNeedsReview
    };

    if (normalizedTeamProfile) {
      nextRosterData.teamProfile = normalizedTeamProfile;
    }

    tx.set(rosterRef, nextRosterData, { merge: true });

    if (legacyRosterRef && legacySnap?.exists()) {
      tx.delete(legacyRosterRef);
    }
  });

  // Keep roster writes resilient even if audit rules differ across environments.
  try {
    await logAudit({
      action: auditAction,
      entityType: 'rosters',
      entityId: rosterId,
      performedBy: lastModifiedByEmail || null,
      meta: {
        teamId: rosterId,
        playerCount: normalizedPlayers.length,
        previousPlayerCount: Array.isArray(beforeData?.players) ? beforeData.players.length : 0,
        needsReview: markNeedsReview,
        diffSummary
      }
    });
  } catch (error) {
    console.warn('Roster saved but audit logging failed:', error);
  }
}

export async function verifyRoster(teamId) {
  const rosterId = resolveRosterId(teamId);
  if (!TEAM_IDS.includes(rosterId)) {
    throw new Error('Select a valid Andromeda team.');
  }
  const authz = await requireTeamPermission('rosters:write', rosterId, {
    message: 'You are not authorized to verify this team roster.'
  });
  const verifiedByUid = String(authz?.uid || '').trim() || null;
  const verifiedByEmail = String(authz?.email || '').trim().toLowerCase() || null;
  const verifiedByName = getStaffDisplayName({
    staffName: authz?.name,
    firebaseDisplayName: authz?.user?.displayName,
    email: verifiedByEmail
  });

  const rosterRef = doc(db, 'rosters', rosterId);

  await setDoc(
    rosterRef,
    {
      verifiedAt: serverTimestamp(),
      verifiedBy: verifiedByName,
      verifiedByUid,
      verifiedByEmail,
      verifiedByName,
      needsReview: false,
      updatedAt: serverTimestamp(),
      lastModifiedBy: verifiedByEmail || null
    },
    { merge: true }
  );

  try {
    await logAudit({
      action: 'roster_verify',
      entityType: 'rosters',
      entityId: rosterId,
      performedBy: verifiedByEmail || null,
      meta: {
        teamId: rosterId,
        needsReview: false,
        verifiedByUid,
        verifiedByName
      }
    });
  } catch (error) {
    console.warn('Roster verified but audit logging failed:', error);
  }
}
