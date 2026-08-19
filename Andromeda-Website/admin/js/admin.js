import { getRoster, saveRoster, verifyRoster } from '/js/services/rosters.service.js';
import { approveTrialToRoster, createTrial, listTrials, setTrialStatus } from '/js/services/trials.service.js';
import { trackEvent } from '/js/services/analytics.service.js';
import { TEAM_OPTIONS } from '/js/config/teams.config.js';

const rosterMessage = document.getElementById('roster-message');
const trialsMessage = document.getElementById('trials-message');
const rosterTableBody = document.getElementById('roster-table-body');
const teamSelect = document.getElementById('team-select');
const playerNameInput = document.getElementById('player-name');
const playerLineupInput = document.getElementById('player-lineup');
const playerStatusInput = document.getElementById('player-status');
const addPlayerButton = document.getElementById('add-player-btn');
const saveRosterButton = document.getElementById('save-roster-btn');
const verifyRosterButton = document.getElementById('verify-roster-btn');
const rosterVerificationStatus = document.getElementById('roster-verification-status');
const teamDisplayNameInput = document.getElementById('team-display-name');
const teamTierInput = document.getElementById('team-tier');
const teamRegionInput = document.getElementById('team-region');
const teamRatingInput = document.getElementById('team-rating');
const teamManagerInput = document.getElementById('team-manager');
const teamCoachesInput = document.getElementById('team-coaches');
const teamCaptainInput = document.getElementById('team-captain');
const teamDescriptionInput = document.getElementById('team-description');
const teamHighlightsInput = document.getElementById('team-highlights');
const teamAchievementsInput = document.getElementById('team-achievements');
const trialsList = document.getElementById('trials-list');
const trialsTeamFilter = document.getElementById('trials-team-filter');
const trialsStatusFilter = document.getElementById('trials-status-filter');
const refreshTrialsButton = document.getElementById('refresh-trials-btn');
const trialNameInput = document.getElementById('trial-name');
const trialTeamSelect = document.getElementById('trial-team');
const trialNotesInput = document.getElementById('trial-notes');
const addTrialButton = document.getElementById('add-trial-btn');
const rosterDiffModal = document.getElementById('roster-diff-modal');
const rosterDiffContent = document.getElementById('roster-diff-content');
const cancelRosterSaveButton = document.getElementById('cancel-roster-save-btn');
const confirmRosterSaveButton = document.getElementById('confirm-roster-save-btn');

let selectedTeam = '';
let currentRoster = [];
let savedRosterSnapshot = [];
let currentTeamProfile = {};
let currentUserEmail = null;
let hasAdminAccess = false;
let assignedTeamId = null;
let currentRosterVerification = {
  verifiedAt: null,
  verifiedBy: null,
  needsReview: false
};
let pendingSavePayload = null;

const REVIEW_STALE_DAYS = 14;

function eventHasPermission(event, permission) {
  return Array.isArray(event?.detail?.permissions) && event.detail.permissions.includes(permission);
}

function populateTeamSelect(select, { includeAll = false, onlyTeamId = '' } = {}) {
  if (!select) return;
  const normalizedOnlyTeamId = String(onlyTeamId || '').trim().toLowerCase();
  const teams = normalizedOnlyTeamId
    ? TEAM_OPTIONS.filter((team) => team.id === normalizedOnlyTeamId)
    : TEAM_OPTIONS;

  select.innerHTML = includeAll && !normalizedOnlyTeamId
    ? '<option value="">All</option>'
    : (normalizedOnlyTeamId ? '' : '<option value="">Select a team</option>');

  teams.forEach((team) => {
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = team.name;
    select.appendChild(option);
  });

  if (normalizedOnlyTeamId && teams.length) {
    select.value = normalizedOnlyTeamId;
  }
}

const TEAM_PROFILE_DEFAULTS = {
  horizon: {
    displayName: 'Horizon',
    tier: 'T1',
    region: 'NA',
    rating: 'Development',
    description: 'Foundation roster focused on communication, role fundamentals, and structured growth.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'Bruber',
    highlights: ['Communication habits', 'Role fundamentals', 'Structured review cycles'],
    achievements: ['Main Division growth benchmark']
  },
  spiral: {
    displayName: 'Spiral',
    tier: 'T2',
    region: 'NA',
    rating: 'Development',
    description: 'Development roster building consistency, team discipline, and stronger match-day execution.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'Xaphan',
    highlights: ['Execution discipline', 'Role mastery', 'Pressure communication'],
    achievements: ['Consistent mid-tier results']
  },
  proxima: {
    displayName: 'Proxima',
    tier: 'T3',
    region: 'NA',
    rating: 'Advanced',
    description: 'Advanced roster aimed at tactical polish, adaptation, and high-pressure performance.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'Robert Pants',
    highlights: ['Tactical refinement', 'Composure under pressure', 'Series adaptation'],
    achievements: ['Top Main division contender']
  },
  comet: {
    displayName: 'Comet',
    tier: 'Main',
    region: 'NA',
    rating: 'Development',
    description: 'Development-focused roster building communication, match structure, and long-term consistency.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'TBD',
    highlights: ['Communication clarity', 'Match structure', 'Consistency development'],
    achievements: ['Development roster in active growth phase']
  },
  supernova: {
    displayName: 'Supernova',
    tier: 'Main',
    region: 'NA',
    rating: 'Development',
    description: 'Development-focused roster building structure, consistency, and team coordination.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'TBD',
    highlights: ['Communication growth', 'Team fundamentals', 'Competitive development'],
    achievements: ['Development roster in active growth phase']
  },
  void: {
    displayName: 'Void',
    tier: 'Main',
    region: 'NA',
    rating: 'Development',
    description: 'Development-focused roster working on execution, discipline, and long-term improvement.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'TBD',
    highlights: ['Execution discipline', 'Role consistency', 'Team synergy'],
    achievements: ['Development roster in active growth phase']
  },
  polaris: {
    displayName: 'Polaris',
    tier: 'FACEIT',
    region: 'NA',
    rating: 'FACEIT Masters',
    description: 'FACEIT roster focused on adaptability, crisp execution, and competitive stability.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'Mayhem',
    highlights: ['Adaptive game plans', 'Clean mid-rounds', 'Competitive consistency'],
    achievements: ['FACEIT S5 Advanced Champions']
  },
  octantis: {
    displayName: 'Octantis',
    tier: 'FACEIT',
    region: 'NA',
    rating: 'FACEIT Masters',
    description: 'FACEIT roster built on disciplined teamplay, coordinated pacing, and reliable fundamentals.',
    manager: 'Creep',
    coaches: 'Express',
    captain: 'Mookie',
    highlights: ['Disciplined defaults', 'Reliable spacing', 'Late-round conversion'],
    achievements: ['FACEIT playoff seed']
  }
};

function setMessage(target, text, isError = false) {
  if (!target) return;
  target.textContent = text;
  target.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--text-muted)';
}

function setMessageHtml(target, html, isError = false) {
  if (!target) return;
  target.innerHTML = html;
  target.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--text-muted)';
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function clearRoleCheckboxes(name) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = false;
  });
}

function normalizeRoles(value) {
  if (Array.isArray(value)) {
    return value.map((role) => String(role || '').toLowerCase().trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((role) => role.toLowerCase().trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeLineup(value, index = 0) {
  const lineup = String(value || '').toLowerCase().trim();
  if (lineup === 'starter' || lineup === 'sub') {
    return lineup;
  }

  return index < 5 ? 'starter' : 'sub';
}

function normalizeStatus(value) {
  return String(value || '').trim();
}

function normalizeRoster(players) {
  if (!Array.isArray(players)) return [];

  return players
    .map((player, index) => {
      const name = String(player?.name || '').trim();
      const roles = normalizeRoles(player?.roles ?? player?.role ?? '');
      const lineup = normalizeLineup(player?.lineup, index);
      const status = normalizeStatus(player?.status);
      return {
        name,
        roles,
        lineup,
        ...(status ? { status } : {})
      };
    })
    .filter((player) => player.name.length > 0);
}

function cloneRoster(players) {
  return normalizeRoster(players).map((player) => ({
    name: player.name,
    roles: [...(player.roles || [])],
    lineup: player.lineup,
    ...(player.status ? { status: player.status } : {})
  }));
}

function normalizeNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function roleSignature(roles) {
  return normalizeRoles(roles).slice().sort().join('|');
}

function samePlayerShape(left, right) {
  return roleSignature(left?.roles) === roleSignature(right?.roles)
    && normalizeLineup(left?.lineup) === normalizeLineup(right?.lineup)
    && normalizeStatus(left?.status).toLowerCase() === normalizeStatus(right?.status).toLowerCase();
}

function buildRosterDiff(beforePlayers, afterPlayers) {
  const before = cloneRoster(beforePlayers);
  const after = cloneRoster(afterPlayers);

  const renamed = [];
  const matchedBefore = new Set();
  const matchedAfter = new Set();
  const limit = Math.min(before.length, after.length);

  for (let index = 0; index < limit; index += 1) {
    const prev = before[index];
    const next = after[index];
    if (!prev || !next) continue;

    if (normalizeNameKey(prev.name) !== normalizeNameKey(next.name) && samePlayerShape(prev, next)) {
      renamed.push({ from: prev.name, to: next.name });
      matchedBefore.add(index);
      matchedAfter.add(index);
    }
  }

  const beforeByName = new Map();
  const afterByName = new Map();

  before.forEach((player, index) => {
    if (matchedBefore.has(index)) return;
    const key = normalizeNameKey(player.name);
    if (!beforeByName.has(key)) beforeByName.set(key, []);
    beforeByName.get(key).push(player);
  });

  after.forEach((player, index) => {
    if (matchedAfter.has(index)) return;
    const key = normalizeNameKey(player.name);
    if (!afterByName.has(key)) afterByName.set(key, []);
    afterByName.get(key).push(player);
  });

  const added = [];
  const removed = [];
  const roleChanges = [];
  const lineupChanges = [];
  const statusChanges = [];

  const allKeys = new Set([...beforeByName.keys(), ...afterByName.keys()]);
  allKeys.forEach((key) => {
    const beforeList = beforeByName.get(key) || [];
    const afterList = afterByName.get(key) || [];

    const overlap = Math.min(beforeList.length, afterList.length);
    for (let index = 0; index < overlap; index += 1) {
      const prev = beforeList[index];
      const next = afterList[index];

      if (roleSignature(prev.roles) !== roleSignature(next.roles)) {
        roleChanges.push({
          name: next.name,
          from: (prev.roles || []).join(', ') || 'none',
          to: (next.roles || []).join(', ') || 'none'
        });
      }

      const prevLineup = normalizeLineup(prev.lineup);
      const nextLineup = normalizeLineup(next.lineup);
      if (prevLineup !== nextLineup) {
        lineupChanges.push({ name: next.name, from: prevLineup, to: nextLineup });
      }

      const prevStatus = normalizeStatus(prev.status);
      const nextStatus = normalizeStatus(next.status);
      if (prevStatus !== nextStatus) {
        statusChanges.push({
          name: next.name,
          from: prevStatus || 'unset',
          to: nextStatus || 'unset'
        });
      }
    }

    if (afterList.length > overlap) {
      afterList.slice(overlap).forEach((player) => {
        added.push(player.name);
      });
    }

    if (beforeList.length > overlap) {
      beforeList.slice(overlap).forEach((player) => {
        removed.push(player.name);
      });
    }
  });

  return {
    added,
    removed,
    renamed,
    roleChanges,
    lineupChanges,
    statusChanges,
    hasChanges: added.length > 0
      || removed.length > 0
      || renamed.length > 0
      || roleChanges.length > 0
      || lineupChanges.length > 0
      || statusChanges.length > 0
  };
}

function buildTeamProfileDiff(previousProfile, nextProfile) {
  const fields = ['displayName', 'tier', 'region', 'rating', 'manager', 'coaches', 'captain', 'description'];
  return fields
    .filter((field) => String(previousProfile?.[field] || '').trim() !== String(nextProfile?.[field] || '').trim())
    .map((field) => ({
      field,
      from: String(previousProfile?.[field] || '').trim() || 'unset',
      to: String(nextProfile?.[field] || '').trim() || 'unset'
    }));
}

function buildAuditDiffSummary(diff, profileChanges) {
  return {
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    renamedCount: diff.renamed.length,
    roleChangeCount: diff.roleChanges.length,
    lineupChangeCount: diff.lineupChanges.length,
    statusChangeCount: diff.statusChanges.length,
    profileChangeCount: profileChanges.length
  };
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysOld(value) {
  const date = toDate(value);
  if (!date) return null;
  const delta = Date.now() - date.getTime();
  return Math.floor(delta / (24 * 60 * 60 * 1000));
}

function renderRosterVerification() {
  if (!rosterVerificationStatus) return;

  if (!selectedTeam) {
    rosterVerificationStatus.textContent = 'Select a team to review verification status.';
    rosterVerificationStatus.style.color = 'var(--admin-muted)';
    return;
  }

  const verifiedAtDate = toDate(currentRosterVerification.verifiedAt);
  const verifiedBy = String(currentRosterVerification.verifiedBy || '').trim() || 'unknown admin';
  const ageDays = daysOld(currentRosterVerification.verifiedAt);
  const stale = ageDays === null || ageDays >= REVIEW_STALE_DAYS;

  const dateText = verifiedAtDate ? verifiedAtDate.toLocaleString() : 'never';
  const staleText = stale
    ? (ageDays === null ? 'Stale warning: never verified.' : `Stale warning: ${ageDays} days old.`)
    : 'Verification is current.';

  rosterVerificationStatus.textContent = `Last verified: ${dateText} | Verified by: ${verifiedBy} | needsReview: ${currentRosterVerification.needsReview ? 'yes' : 'no'} | ${staleText}`;
  rosterVerificationStatus.style.color = stale || currentRosterVerification.needsReview
    ? 'var(--accent-primary-hover)'
    : 'var(--admin-muted)';
}

function toMultilineText(list) {
  if (!Array.isArray(list)) return '';
  return list.map((item) => String(item || '').trim()).filter(Boolean).join('\n');
}

function toListFromMultiline(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProfileDefaults(teamId) {
  return TEAM_PROFILE_DEFAULTS[teamId] || {
    displayName: '',
    tier: '',
    region: 'NA',
    rating: '',
    description: '',
    manager: '',
    coaches: '',
    captain: '',
    highlights: [],
    achievements: []
  };
}

function renderTeamProfileFields(profile) {
  const next = {
    ...getProfileDefaults(selectedTeam),
    ...(profile || {})
  };

  if (teamDisplayNameInput) teamDisplayNameInput.value = next.displayName || '';
  if (teamTierInput) teamTierInput.value = next.tier || '';
  if (teamRegionInput) teamRegionInput.value = next.region || '';
  if (teamRatingInput) teamRatingInput.value = next.rating || '';
  if (teamManagerInput) teamManagerInput.value = next.manager || '';
  if (teamCoachesInput) teamCoachesInput.value = next.coaches || '';
  if (teamCaptainInput) teamCaptainInput.value = next.captain || '';
  if (teamDescriptionInput) teamDescriptionInput.value = next.description || '';
  if (teamHighlightsInput) teamHighlightsInput.value = toMultilineText(next.highlights || []);
  if (teamAchievementsInput) teamAchievementsInput.value = toMultilineText(next.achievements || []);
}

function collectTeamProfileFromForm() {
  return {
    displayName: teamDisplayNameInput?.value?.trim() || '',
    tier: teamTierInput?.value?.trim() || '',
    region: teamRegionInput?.value?.trim() || '',
    rating: teamRatingInput?.value?.trim() || '',
    manager: teamManagerInput?.value?.trim() || '',
    coaches: teamCoachesInput?.value?.trim() || '',
    captain: teamCaptainInput?.value?.trim() || '',
    description: teamDescriptionInput?.value?.trim() || '',
    highlights: toListFromMultiline(teamHighlightsInput?.value || ''),
    achievements: toListFromMultiline(teamAchievementsInput?.value || '')
  };
}

function setRosterUiEnabled(enabled) {
  teamSelect.disabled = !enabled;
  playerNameInput.disabled = !enabled;
  if (playerLineupInput) playerLineupInput.disabled = !enabled;
  if (playerStatusInput) playerStatusInput.disabled = !enabled;
  addPlayerButton.disabled = !enabled;
  saveRosterButton.disabled = !enabled;
  if (verifyRosterButton) verifyRosterButton.disabled = !enabled;
  if (teamDisplayNameInput) teamDisplayNameInput.disabled = !enabled;
  if (teamTierInput) teamTierInput.disabled = !enabled;
  if (teamRegionInput) teamRegionInput.disabled = !enabled;
  if (teamRatingInput) teamRatingInput.disabled = !enabled;
  if (teamManagerInput) teamManagerInput.disabled = !enabled;
  if (teamCoachesInput) teamCoachesInput.disabled = !enabled;
  if (teamCaptainInput) teamCaptainInput.disabled = !enabled;
  if (teamDescriptionInput) teamDescriptionInput.disabled = !enabled;
  if (teamHighlightsInput) teamHighlightsInput.disabled = !enabled;
  if (teamAchievementsInput) teamAchievementsInput.disabled = !enabled;
}

function setTrialsWriteEnabled(enabled) {
  if (addTrialButton) addTrialButton.disabled = !enabled;
}

function requireAdminWriteAccess(target) {
  if (hasAdminAccess) return true;
  setMessage(target, 'Not authorized. Your role cannot manage rosters or trials.', true);
  return false;
}

function setupRosterRolesCsvInput() {
  const rosterSection = document.querySelector('#roster-heading')?.closest('section');
  const fieldset = rosterSection?.querySelector('fieldset');
  if (!fieldset) return null;

  fieldset.innerHTML = '';

  const legend = document.createElement('legend');
  legend.style.fontWeight = '600';
  legend.style.marginBottom = '8px';
  legend.textContent = 'Roles';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Roles (comma separated)';

  fieldset.appendChild(legend);
  fieldset.appendChild(input);

  return input;
}

const playerRolesCsvInput = setupRosterRolesCsvInput();

function renderRoster() {
  rosterTableBody.innerHTML = '';

  if (!selectedTeam) {
    setMessage(rosterMessage, 'Select a team to view the roster.');
    return;
  }

  if (!currentRoster.length) {
    setMessage(rosterMessage, 'No players yet. Add the first player below.');
  } else {
    setMessage(rosterMessage, `Loaded ${currentRoster.length} players.`);
  }

  currentRoster.forEach((player, index) => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = player.name || '';
    nameInput.addEventListener('input', (event) => {
      currentRoster[index].name = event.target.value;
    });
    nameCell.appendChild(nameInput);

    const rolesCell = document.createElement('td');
    const rolesInput = document.createElement('input');
    rolesInput.type = 'text';
    rolesInput.placeholder = 'Roles (comma separated)';
    rolesInput.value = normalizeRoles(player.roles || []).join(', ');
    rolesInput.addEventListener('input', (event) => {
      currentRoster[index].roles = normalizeRoles(event.target.value);
    });
    rolesCell.appendChild(rolesInput);

    const lineupCell = document.createElement('td');
    const lineupSelect = document.createElement('select');
    lineupSelect.className = 'admin-select';
    lineupSelect.innerHTML = '<option value="starter">Starter</option><option value="sub">Sub</option>';
    lineupSelect.value = normalizeLineup(player.lineup, index);
    lineupSelect.addEventListener('change', (event) => {
      currentRoster[index].lineup = normalizeLineup(event.target.value, index);
    });
    lineupCell.appendChild(lineupSelect);

    const statusCell = document.createElement('td');
    const statusSelect = document.createElement('select');
    statusSelect.className = 'admin-select';
    statusSelect.innerHTML = '<option value="">Unset</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="trial">Trial</option>';
    statusSelect.value = normalizeStatus(player.status);
    statusSelect.addEventListener('change', (event) => {
      const value = normalizeStatus(event.target.value);
      if (value) {
        currentRoster[index].status = value;
      } else {
        delete currentRoster[index].status;
      }
    });
    statusCell.appendChild(statusSelect);

    const actionsCell = document.createElement('td');
    const removeButton = document.createElement('button');
    removeButton.className = 'admin-btn admin-btn--danger';
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      currentRoster.splice(index, 1);
      renderRoster();
    });
    actionsCell.appendChild(removeButton);

    row.appendChild(nameCell);
    row.appendChild(rolesCell);
    row.appendChild(lineupCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    rosterTableBody.appendChild(row);
  });
}

function renderDiffSection(title, items) {
  if (!Array.isArray(items) || !items.length) return '';
  return `
    <section>
      <h3>${title}</h3>
      <ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>
    </section>
  `;
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function openReviewModal(diff, profileChanges) {
  if (!rosterDiffModal || !rosterDiffContent) return;

  const sections = [
    renderDiffSection('Added Players', diff.added.map((name) => `Added ${escapeHtml(name)}`)),
    renderDiffSection('Removed Players', diff.removed.map((name) => `Removed ${escapeHtml(name)}`)),
    renderDiffSection('Renamed Players', diff.renamed.map((item) => `${escapeHtml(item.from)} -> ${escapeHtml(item.to)}`)),
    renderDiffSection('Role Changes', diff.roleChanges.map((item) => `${escapeHtml(item.name)}: ${escapeHtml(item.from)} -> ${escapeHtml(item.to)}`)),
    renderDiffSection('Lineup Changes', diff.lineupChanges.map((item) => `${escapeHtml(item.name)}: ${escapeHtml(item.from)} -> ${escapeHtml(item.to)}`)),
    renderDiffSection('Status Changes', diff.statusChanges.map((item) => `${escapeHtml(item.name)}: ${escapeHtml(item.from)} -> ${escapeHtml(item.to)}`)),
    renderDiffSection('Team Profile Changes', profileChanges.map((item) => `${escapeHtml(item.field)}: ${escapeHtml(item.from)} -> ${escapeHtml(item.to)}`))
  ].filter(Boolean);

  rosterDiffContent.innerHTML = sections.join('') || '<p class="admin-text-muted">No roster changes detected.</p>';
  rosterDiffModal.hidden = false;
}

function closeReviewModal() {
  if (!rosterDiffModal) return;
  rosterDiffModal.hidden = true;
}

async function loadRoster() {
  if (!hasAdminAccess || !selectedTeam) {
    currentRoster = [];
    savedRosterSnapshot = [];
    currentTeamProfile = {};
    currentRosterVerification = {
      verifiedAt: null,
      verifiedBy: null,
      needsReview: false
    };
    renderTeamProfileFields(getProfileDefaults(selectedTeam));
    renderRosterVerification();
    renderRoster();
    return;
  }

  try {
    setMessage(rosterMessage, 'Loading roster...');
    const rosterDoc = await getRoster(selectedTeam);
    currentRoster = normalizeRoster(rosterDoc.players || []);
    savedRosterSnapshot = cloneRoster(currentRoster);
    currentTeamProfile = rosterDoc.teamProfile || {};
    currentRosterVerification = {
      verifiedAt: rosterDoc.verifiedAt || null,
      verifiedBy: rosterDoc.verifiedBy || null,
      needsReview: rosterDoc.needsReview === true
    };
    renderTeamProfileFields(currentTeamProfile);
    renderRosterVerification();
    renderRoster();
  } catch (error) {
    console.error('Load roster failed:', error);
    setMessage(rosterMessage, 'Failed to load roster.', true);
  }
}

async function handleSaveRoster() {
  if (!requireAdminWriteAccess(rosterMessage)) return;

  if (!selectedTeam) {
    setMessage(rosterMessage, 'Select a team before saving.', true);
    return;
  }

  const cleanedRoster = normalizeRoster(currentRoster);
  const teamProfile = collectTeamProfileFromForm();
  const diff = buildRosterDiff(savedRosterSnapshot, cleanedRoster);
  const profileChanges = buildTeamProfileDiff(currentTeamProfile, teamProfile);

  if (!diff.hasChanges && profileChanges.length === 0) {
    setMessage(rosterMessage, 'No roster changes detected.');
    return;
  }

  pendingSavePayload = {
    cleanedRoster,
    teamProfile,
    diff,
    profileChanges
  };

  openReviewModal(diff, profileChanges);
}

async function confirmRosterSave() {
  if (!pendingSavePayload) {
    closeReviewModal();
    return;
  }

  try {
    const payload = pendingSavePayload;
    confirmRosterSaveButton.disabled = true;
    await saveRoster(
      selectedTeam,
      payload.cleanedRoster,
      currentUserEmail || null,
      payload.teamProfile,
      {
        markNeedsReview: true,
        diffSummary: buildAuditDiffSummary(payload.diff, payload.profileChanges)
      }
    );
    currentRoster = payload.cleanedRoster;
    currentTeamProfile = payload.teamProfile;
    savedRosterSnapshot = cloneRoster(payload.cleanedRoster);
    closeReviewModal();
    pendingSavePayload = null;
    setMessage(rosterMessage, 'Roster and team profile saved.');
    await loadRoster();
  } catch (error) {
    console.error('Save roster failed:', error);
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').trim();

    if (code.includes('permission-denied')) {
      setMessage(rosterMessage, 'Save failed: Firestore rules denied this write. Check that your role and team access match the requested change.', true);
      return;
    }

    if (message) {
      setMessage(rosterMessage, `Save failed: ${message}`, true);
      return;
    }

    setMessage(rosterMessage, 'Save failed. Please try again.', true);
  } finally {
    confirmRosterSaveButton.disabled = false;
  }
}

async function handleVerifyRoster() {
  if (!requireAdminWriteAccess(rosterMessage)) return;

  if (!selectedTeam) {
    setMessage(rosterMessage, 'Select a team before verifying.', true);
    return;
  }

  try {
    setMessage(rosterMessage, 'Verifying current roster...');
    await verifyRoster(selectedTeam, currentUserEmail || null);
    await loadRoster();
    setMessage(rosterMessage, 'Roster verified. needsReview was cleared.');
  } catch (error) {
    console.error('Verify roster failed:', error);
    setMessage(rosterMessage, error?.message || 'Failed to verify roster.', true);
  }
}

function handleAddPlayer() {
  if (!requireAdminWriteAccess(rosterMessage)) return;

  if (!selectedTeam) {
    setMessage(rosterMessage, 'Select a team before adding players.', true);
    return;
  }

  const name = playerNameInput.value.trim();
  const roles = normalizeRoles(playerRolesCsvInput ? playerRolesCsvInput.value : '');
  const lineup = normalizeLineup(playerLineupInput?.value || 'starter', currentRoster.length);
  const status = normalizeStatus(playerStatusInput?.value || '');

  if (!name) {
    setMessage(rosterMessage, 'Player name is required.', true);
    return;
  }

  const player = { name, roles, lineup };
  if (status) {
    player.status = status;
  }

  currentRoster.push(player);
  playerNameInput.value = '';
  if (playerLineupInput) {
    playerLineupInput.value = 'starter';
  }
  if (playerRolesCsvInput) {
    playerRolesCsvInput.value = '';
  }
  if (playerStatusInput) {
    playerStatusInput.value = '';
  }
  renderRoster();
}

function formatTrialDate(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString();
}

function renderTrials(trials) {
  trialsList.innerHTML = '';

  if (!trials.length) {
    setMessage(trialsMessage, 'No trials found.');
    return;
  }

  setMessage(trialsMessage, `Showing ${trials.length} trial(s).`);

  trials.forEach((trial) => {
    const card = document.createElement('article');
    card.className = 'admin-card';

    const title = document.createElement('strong');
    title.textContent = `${trial.name || 'Unnamed'} — ${trial.teamId || 'Unassigned'}`;

    const meta = document.createElement('p');
    meta.className = 'admin-text-muted';
    meta.textContent = `Status: ${trial.status || 'pending'} | Roles: ${(trial.roles || []).join(', ') || 'None'} | Created: ${formatTrialDate(trial.createdAt)}`;

    const notes = document.createElement('p');
    notes.textContent = trial.notes || '';

    const actions = document.createElement('div');
    actions.className = 'admin-inline-actions';

    const approveButton = document.createElement('button');
    approveButton.className = 'admin-btn admin-btn--primary';
    approveButton.type = 'button';
    approveButton.textContent = 'Approve + Add to Roster';
    approveButton.disabled = !hasAdminAccess;

    const conversionTeam = document.createElement('select');
    conversionTeam.className = 'admin-select';
    conversionTeam.style.minWidth = '140px';
    conversionTeam.innerHTML = teamSelect.innerHTML;
    conversionTeam.value = trial.teamId || '';
    conversionTeam.disabled = Boolean(assignedTeamId);

    const conversionRole = document.createElement('input');
    conversionRole.className = 'admin-input';
    conversionRole.placeholder = 'Roles (comma separated)';
    conversionRole.value = Array.isArray(trial.roles) ? trial.roles.join(', ') : '';
    conversionRole.style.maxWidth = '240px';

    const conversionLineup = document.createElement('select');
    conversionLineup.className = 'admin-select';
    conversionLineup.innerHTML = '<option value="starter">Starter</option><option value="sub" selected>Sub</option>';
    conversionLineup.style.minWidth = '120px';

    const conversionStatus = document.createElement('select');
    conversionStatus.className = 'admin-select';
    conversionStatus.innerHTML = '<option value="">Unset Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="trial">Trial</option>';
    conversionStatus.style.minWidth = '140px';

    approveButton.addEventListener('click', async () => {
      if (!requireAdminWriteAccess(trialsMessage)) return;
      try {
        const nextTeam = conversionTeam.value;
        if (!nextTeam) {
          setMessage(trialsMessage, 'Select a team before approving a trial.', true);
          return;
        }

        await approveTrialToRoster({
          trialId: trial.id,
          teamId: nextTeam,
          roles: normalizeRoles(conversionRole.value),
          lineup: normalizeLineup(conversionLineup.value, 99),
          playerStatus: normalizeStatus(conversionStatus.value),
          performedByEmail: currentUserEmail || null
        });

        await loadTrials();
        if (nextTeam === selectedTeam) {
          await loadRoster();
        }
        setMessageHtml(trialsMessage, `Trial converted and roster marked for review. <a href="admin.html?team=${encodeURIComponent(nextTeam)}">Open roster editor</a>.`);
      } catch (error) {
        console.error('Approve trial failed:', error);
        setMessage(trialsMessage, error?.message || 'Approve failed. Please try again.', true);
      }
    });

    const rejectButton = document.createElement('button');
    rejectButton.className = 'admin-btn admin-btn--secondary';
    rejectButton.type = 'button';
    rejectButton.textContent = 'Reject';
    rejectButton.disabled = !hasAdminAccess;
    rejectButton.addEventListener('click', async () => {
      if (!requireAdminWriteAccess(trialsMessage)) return;
      try {
        await setTrialStatus(trial.id, 'rejected', currentUserEmail);
        await loadTrials();
      } catch (error) {
        console.error('Reject trial failed:', error);
        setMessage(trialsMessage, 'Reject failed. Please try again.', true);
      }
    });

    const dropButton = document.createElement('button');
    dropButton.className = 'admin-btn admin-btn--danger';
    dropButton.type = 'button';
    dropButton.textContent = 'Drop';
    dropButton.disabled = !hasAdminAccess;
    dropButton.addEventListener('click', async () => {
      if (!requireAdminWriteAccess(trialsMessage)) return;
      try {
        await setTrialStatus(trial.id, 'dropped', currentUserEmail);
        await loadTrials();
      } catch (error) {
        console.error('Drop trial failed:', error);
        setMessage(trialsMessage, 'Drop failed. Please try again.', true);
      }
    });

    actions.appendChild(conversionTeam);
    actions.appendChild(conversionRole);
    actions.appendChild(conversionLineup);
    actions.appendChild(conversionStatus);
    actions.appendChild(approveButton);
    actions.appendChild(rejectButton);
    actions.appendChild(dropButton);

    card.appendChild(title);
    card.appendChild(meta);
    if (trial.notes) {
      card.appendChild(notes);
    }
    card.appendChild(actions);
    trialsList.appendChild(card);
  });
}

async function loadTrials() {
  if (!hasAdminAccess) {
    setMessage(trialsMessage, 'Your role cannot view or manage trials.', true);
    trialsList.innerHTML = '';
    return;
  }

  try {
    setMessage(trialsMessage, 'Loading trials...');
    const filters = {
      teamId: trialsTeamFilter.value || undefined,
      status: trialsStatusFilter.value || undefined
    };
    const trials = await listTrials(filters);
    renderTrials(trials);
  } catch (error) {
    console.error('Load trials failed:', error);
    setMessage(trialsMessage, 'Failed to load trials.', true);
  }
}

async function handleAddTrial() {
  if (!requireAdminWriteAccess(trialsMessage)) return;

  const name = trialNameInput.value.trim();
  const teamId = trialTeamSelect.value;
  const roles = getCheckedValues('trial-roles');
  const notes = trialNotesInput.value.trim();

  if (!name || !teamId) {
    setMessage(trialsMessage, 'Trial name and team are required.', true);
    return;
  }

  try {
    trackEvent('trial_submission_started', {
      team_id: teamId,
      has_notes: notes.length > 0
    });
    await createTrial({ name, teamId, roles, notes, status: 'pending', performedByEmail: currentUserEmail || null });
    trialNameInput.value = '';
    trialTeamSelect.value = '';
    trialNotesInput.value = '';
    clearRoleCheckboxes('trial-roles');
    await loadTrials();
    trackEvent('trial_submission_completed', {
      team_id: teamId,
      role_count: roles.length
    });
    setMessage(trialsMessage, 'Trial added.');
  } catch (error) {
    console.error('Add trial failed:', error);
    trackEvent('trial_submission_failed', {
      team_id: teamId,
      error: String(error?.message || error)
    });
    setMessage(trialsMessage, 'Add trial failed. Please try again.', true);
  }
}

teamSelect.addEventListener('change', async () => {
  selectedTeam = teamSelect.value;
  await loadRoster();
});
addPlayerButton.addEventListener('click', handleAddPlayer);
saveRosterButton.addEventListener('click', handleSaveRoster);
if (cancelRosterSaveButton) {
  cancelRosterSaveButton.addEventListener('click', () => {
    pendingSavePayload = null;
    closeReviewModal();
  });
}
if (confirmRosterSaveButton) {
  confirmRosterSaveButton.addEventListener('click', confirmRosterSave);
}
if (verifyRosterButton) {
  verifyRosterButton.addEventListener('click', handleVerifyRoster);
}
refreshTrialsButton.addEventListener('click', loadTrials);
trialsTeamFilter.addEventListener('change', loadTrials);
trialsStatusFilter.addEventListener('change', loadTrials);
addTrialButton.addEventListener('click', handleAddTrial);

populateTeamSelect(teamSelect);
populateTeamSelect(trialsTeamFilter, { includeAll: true });
populateTeamSelect(trialTeamSelect);

setMessage(rosterMessage, 'Sign in to access roster editing.');
setMessage(trialsMessage, 'Sign in to view and manage trials.');
setRosterUiEnabled(false);
setTrialsWriteEnabled(false);
renderRosterVerification();

const initialTeamParam = String(new URLSearchParams(window.location.search).get('team') || '').trim().toLowerCase();
if (initialTeamParam && Array.from(teamSelect.options).some((option) => option.value === initialTeamParam)) {
  teamSelect.value = initialTeamParam;
  selectedTeam = initialTeamParam;
}

window.addEventListener('admin:authorized', async (event) => {
  const email = String(event?.detail?.email || '').trim().toLowerCase();
  const permissions = Array.isArray(event?.detail?.permissions) ? event.detail.permissions : [];
  const hasRosterAccess = eventHasPermission(event, 'rosters:write');
  const hasTrialsAccess = eventHasPermission(event, 'trials:write');
  const canManageAllTeams = permissions.includes('teams:any');
  const requestedAssignedTeam = String(event?.detail?.teamId || '').trim().toLowerCase();
  const hasValidAssignedTeam = TEAM_OPTIONS.some((team) => team.id === requestedAssignedTeam);
  assignedTeamId = !canManageAllTeams && hasValidAssignedTeam ? requestedAssignedTeam : null;
  hasAdminAccess = hasRosterAccess
    && hasTrialsAccess
    && (canManageAllTeams || Boolean(assignedTeamId));
  currentUserEmail = email || null;
  setRosterUiEnabled(hasAdminAccess);
  setTrialsWriteEnabled(hasAdminAccess);

  if (canManageAllTeams) {
    populateTeamSelect(teamSelect);
    populateTeamSelect(trialsTeamFilter, { includeAll: true });
    populateTeamSelect(trialTeamSelect);
    if (selectedTeam && Array.from(teamSelect.options).some((option) => option.value === selectedTeam)) {
      teamSelect.value = selectedTeam;
    }
    teamSelect.disabled = !hasRosterAccess;
    trialsTeamFilter.disabled = !hasTrialsAccess;
    trialTeamSelect.disabled = !hasTrialsAccess;
  } else if (assignedTeamId) {
    populateTeamSelect(teamSelect, { onlyTeamId: assignedTeamId });
    populateTeamSelect(trialsTeamFilter, { onlyTeamId: assignedTeamId });
    populateTeamSelect(trialTeamSelect, { onlyTeamId: assignedTeamId });
    teamSelect.disabled = true;
    trialsTeamFilter.disabled = true;
    trialTeamSelect.disabled = true;
    selectedTeam = assignedTeamId;
  } else {
    selectedTeam = '';
    teamSelect.disabled = true;
    trialsTeamFilter.disabled = true;
    trialTeamSelect.disabled = true;
  }

  if (hasAdminAccess) {
    setMessage(
      rosterMessage,
      assignedTeamId
        ? `Authorized for ${assignedTeamId}.`
        : (email ? `Authorized as ${email}. Select a team to edit roster.` : 'Authorized. Select a team to edit roster.')
    );
  } else {
    const reason = hasRosterAccess && hasTrialsAccess
      ? 'Your Manager account needs a valid assigned team before team operations are available.'
      : 'Your role does not include roster and trial management.';
    setMessage(rosterMessage, reason, true);
    setMessage(trialsMessage, reason, true);
  }

  await loadTrials();
  if (selectedTeam) {
    await loadRoster();
  }
});
