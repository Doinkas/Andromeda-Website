/**
 * Profile Import Service
 * Parses CSV and applies safe profile updates to rosters
 */

import { db } from '/js/core/firebase.js';
import { doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { buildAuditPayload, writeAuditInTransaction } from './audit.service.js';

const ALLOWED_TEAM_IDS = new Set(['horizon', 'spiral', 'proxima', 'comet', 'supernova', 'void', 'faceit']);

const COLUMN_ALIASES = {
  teamid: 'teamId',
  team: 'teamId',
  team_id: 'teamId',
  ign: 'ign',
  ingamename: 'ign',
  username: 'ign',
  bio: 'bio',
  mains: 'mains',
  strength: 'strength',
  teamvalue: 'teamValue',
  favoritehero: 'favoriteHero',
  favoritemap: 'favoriteMap',
  funfact: 'funFact',
  twitch: 'twitch',
  twitter: 'twitter',
  youtube: 'youtube',
  timestamp: null
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function normalizeHeaderKey(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizeTeamId(teamId) {
  return String(teamId || '').trim().toLowerCase();
}

export function normalizeHeaders(rawHeaders) {
  const columns = rawHeaders.map((header, index) => {
    const normalizedKey = normalizeHeaderKey(header);
    const canonicalKey = Object.prototype.hasOwnProperty.call(COLUMN_ALIASES, normalizedKey)
      ? COLUMN_ALIASES[normalizedKey]
      : normalizedKey;

    return {
      index,
      key: canonicalKey
    };
  }).filter(col => col.key);

  const required = ['teamId', 'ign'];
  for (const key of required) {
    if (!columns.some(col => col.key === key)) {
      throw new Error(`Missing required column after normalization: ${key}`);
    }
  }

  return { columns };
}

export function parseMains(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return [];

  let entries;
  if (value.includes(',') || value.includes('/')) {
    entries = value.split(/[,/]/g);
  } else {
    entries = value.split(/\s+/g);
  }

  const mains = [];
  const seen = new Set();

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    mains.push(trimmed);
  }

  return mains;
}

export function parseRow(values, normalizedHeaders, rowNumber) {
  const rowData = {};

  for (const col of normalizedHeaders.columns) {
    const value = String(values[col.index] || '').trim();

    if (!Object.prototype.hasOwnProperty.call(rowData, col.key)) {
      rowData[col.key] = value;
      continue;
    }

    if (value) {
      rowData[col.key] = value;
    } else if (!rowData[col.key]) {
      rowData[col.key] = '';
    }
  }

  const teamId = normalizeTeamId(rowData.teamId);
  if (!teamId) {
    return { error: `Row ${rowNumber}: missing required value 'teamId'` };
  }

  if (!ALLOWED_TEAM_IDS.has(teamId)) {
    return { error: `Row ${rowNumber}: invalid teamId '${teamId}'` };
  }

  const ign = String(rowData.ign || '').trim();
  if (!ign) {
    return { error: `Row ${rowNumber}: missing required value 'ign'`, teamId };
  }

  return {
    record: {
      teamId,
      ign,
      profile: {
        bio: String(rowData.bio || '').substring(0, 200),
        mains: parseMains(rowData.mains),
        strength: String(rowData.strength || '').substring(0, 100),
        teamValue: String(rowData.teamValue || '').substring(0, 100),
        favoriteHero: String(rowData.favoriteHero || '').substring(0, 25),
        favoriteMap: String(rowData.favoriteMap || '').substring(0, 25),
        funFact: String(rowData.funFact || '').substring(0, 80),
        socials: {
          twitch: String(rowData.twitch || '').substring(0, 200) || null,
          twitter: String(rowData.twitter || '').substring(0, 200) || null,
          youtube: String(rowData.youtube || '').substring(0, 200) || null
        }
      }
    }
  };
}

export function parseCSV(csvText) {
  const lines = String(csvText || '').trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have header row and at least one data row');

  const rawHeaders = parseCSVLine(lines[0]);
  const normalizedHeaders = normalizeHeaders(rawHeaders);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const parsed = parseRow(values, normalizedHeaders, i + 1);

    if (parsed.error) {
      records.push({
        __parseError: true,
        teamId: parsed.teamId || '-',
        ign: parsed.ign || '-',
        message: parsed.error
      });
      continue;
    }

    records.push(parsed.record);
  }

  return records;
}

export async function previewProfileChanges(records, currentRosters) {
  const changeset = [];

  for (const record of records) {
    if (record.__parseError) {
      changeset.push({
        teamId: record.teamId || '-',
        ign: record.ign || '-',
        player: null,
        status: 'error',
        message: record.message || 'Invalid CSV row'
      });
      continue;
    }

    const { teamId, ign, profile } = record;
    const roster = currentRosters[teamId];

    if (!roster) {
      changeset.push({
        teamId,
        ign,
        player: null,
        status: 'error',
        message: `Team "${teamId}" not found`
      });
      continue;
    }

    const player = roster.players.find(p => p.name.toLowerCase().trim() === ign.toLowerCase().trim());

    if (!player) {
      changeset.push({
        teamId,
        ign,
        player: null,
        status: 'warning',
        message: `Player "${ign}" not found in ${teamId}`
      });
      continue;
    }

    changeset.push({
      teamId,
      ign,
      player,
      profile,
      status: 'ok',
      message: `Will update profile for ${ign} (${teamId})`
    });
  }

  return changeset;
}

export async function applyProfileUpdates(changeset, performedByEmail) {
  const byTeam = {};

  for (const change of changeset) {
    if (change.status !== 'ok') continue;

    if (!byTeam[change.teamId]) {
      byTeam[change.teamId] = [];
    }
    byTeam[change.teamId].push(change);
  }

  const updateResults = [];

  for (const [teamId, changes] of Object.entries(byTeam)) {
    try {
      await runTransaction(db, async (tx) => {
        const rosterRef = doc(db, 'rosters', teamId);
        const rosterSnap = await tx.get(rosterRef);

        if (!rosterSnap.exists()) {
          throw new Error(`Roster for ${teamId} does not exist`);
        }

        const rosterData = rosterSnap.data();
        const players = Array.isArray(rosterData.players) ? [...rosterData.players] : [];

        for (const change of changes) {
          const playerIdx = players.findIndex(p => p.name.toLowerCase().trim() === change.ign.toLowerCase().trim());

          if (playerIdx !== -1) {
            players[playerIdx] = {
              ...players[playerIdx],
              profile: change.profile
            };
          }
        }

        const nextRosterData = {
          ...rosterData,
          players,
          updatedAt: serverTimestamp(),
          lastModifiedBy: performedByEmail || null
        };

        tx.set(rosterRef, nextRosterData);

        const auditPayload = buildAuditPayload({
          action: 'profiles_import',
          targetCollection: 'rosters',
          targetId: teamId,
          performedBy: performedByEmail || null,
          meta: {
            profilesUpdated: changes.length
          }
        });

        writeAuditInTransaction(tx, auditPayload);
      });

      updateResults.push({
        teamId,
        status: 'success',
        message: `Updated ${changes.length} profile(s) for ${teamId}`
      });
    } catch (error) {
      console.error(`Failed to update profiles for ${teamId}:`, error);
      updateResults.push({
        teamId,
        status: 'error',
        message: error.message
      });
    }
  }

  return updateResults;
}
