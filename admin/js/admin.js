import { getRoster, saveRoster, verifyRoster } from '/js/services/rosters.service.js';
import { approveTrialToRoster, createTrial, listTrials, setTrialStatus } from '/js/services/trials.service.js';
import { trackEvent } from '/js/services/analytics.service.js';
import { TEAM_OPTIONS, getTeamMeta } from '/js/config/teams.config.js';
import { authzHasAnyPermission } from '/js/services/staff-roles.js';
import { getTeamWorkspaceBranding } from './team-workspace-branding.js';
import { getRosterWorkflowState } from './roster-workflow-state.js';
import {
  TRIALS_VIEWS,
  filterTrialsForView,
  getTrialStatusLabel,
  getTrialsViewCounts,
  normalizeTrialsView
} from './trials-view-state.js';

const teamWorkspace = document.getElementById('adminApp');
const teamWorkspaceLogo = document.getElementById('team-workspace-logo');
const teamWorkspaceTitle = document.getElementById('team-workspace-title');
const teamWorkspaceSubtitle = document.getElementById('team-workspace-subtitle');
const rosterMessage = document.getElementById('roster-message');
const trialsMessage = document.getElementById('trials-message');
const rosterTableBody = document.getElementById('roster-table-body');
const teamSelect = document.getElementById('team-select');
const playerNameInput = document.getElementById('player-name');
const playerLineupInput = document.getElementById('player-lineup');
const playerStatusInput = document.getElementById('player-status');
const addPlayerButton = document.getElementById('add-player-btn');
const saveRosterButton = document.getElementById('save-roster-btn');
const rosterSaveState = document.getElementById('roster-save-state');
const verifyRosterButton = document.getElementById('verify-roster-btn');
const rosterVerificationStatus = document.getElementById('roster-verification-status');
const rosterVerificationGuidance = document.getElementById('roster-verification-guidance');
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
const trialsHistoryStatusFilter = document.getElementById('trials-history-status-filter');
const trialsHistoryFilterWrap = document.getElementById('trials-history-filter-wrap');
const trialsViewTabs = Array.from(document.querySelectorAll('[data-trials-view]'));
const refreshTrialsButton = document.getElementById('refresh-trials-btn');
const trialNameInput = document.getElementById('trial-name');
const trialTeamSelect = document.getElementById('trial-team');
const trialNotesInput = document.getElementById('trial-notes');
const addTrialButton = document.getElementById('add-trial-btn');
const trialCreatePanel = document.querySelector('.admin-trial-create');
const rosterDiffModal = document.getElementById('roster-diff-modal');
const rosterDiffContent = document.getElementById('roster-diff-content');
const cancelRosterSaveButton = document.getElementById('cancel-roster-save-btn');
const confirmRosterSaveButton = document.getElementById('confirm-roster-save-btn');
const rosterSaveModalMessage = document.getElementById('roster-save-modal-message');

let selectedTeam = '';
let currentRoster = [];
let savedRosterSnapshot = [];
let currentTeamProfile = {};
let currentUserEmail = null;
let hasRosterWriteAccess = false;
let hasTrialsWriteAccess = false;
let assignedTeamId = null;
let currentTrials = [];
let selectedTrialsView = TRIALS_VIEWS.PENDING;
let isRosterLoading = false;
let isRosterSaving = false;
let isRosterVerifying = false;
let currentRosterVerification = {
  verifiedAt: null,
  verifiedBy: null,
  verifiedByUid: null,
  verifiedByEmail: null,
  verifiedByName: null,
  needsReview: false
};
let pendingSavePayload = null;

const REVIEW_STALE_DAYS = 14;

function applyTeamWorkspaceBranding(teamId) {
  const team = getTeamMeta(String(teamId || '').trim().toLowerCase());
  const branding = getTeamWorkspaceBranding(team);

  if (teamWorkspace) {
    teamWorkspace.dataset.teamId = team?.id || '';

    [
      ['--team-primary', branding.primaryColor],
      ['--team-secondary', branding.secondaryColor]
    ].forEach(([property, value]) => {
      if (value) {
        teamWorkspace.style.setProperty(property, value);
      } else {
        teamWorkspace.style.removeProperty(property);
      }
    });
  }

  if (teamWorkspaceTitle) teamWorkspaceTitle.textContent = branding.title;
  if (teamWorkspaceSubtitle) teamWorkspaceSubtitle.textContent = branding.subtitle;
  if (teamWorkspaceLogo) {
    teamWorkspaceLogo.src = branding.logo;
    teamWorkspaceLogo.alt = branding.logoAlt;
  }
  document.title = branding.browserTitle;
}

function scrollToRequestedWorkspaceSection() {
  const targetId = String(window.location.hash || '').replace(/^#/, '');
  if (!['roster-verification', 'trials-heading'].includes(targetId)) return;

  window.requestAnimationFrame(() => {
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
  });
}

if (teamWorkspaceLogo) {
  teamWorkspaceLogo.addEventListener('error', () => {
    const fallback = getTeamWorkspaceBranding(null);
    if (teamWorkspaceLogo.getAttribute('src') !== fallback.logo) {
      teamWorkspaceLogo.src = fallback.logo;
      teamWorkspaceLogo.alt = fallback.logoAlt;
    }
  });
}

function eventHasPermission(event, permission) {
  return authzHasAnyPermission(event?.detail, [permission]);
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
  const fields = [
    ['displayName', 'Display name'],
    ['tier', 'Tier'],
    ['region', 'Region'],
    ['rating', 'Rating'],
    ['manager', 'Manager'],
    ['coaches', 'Coaches'],
    ['captain', 'Captain'],
    ['description', 'Description'],
    ['highlights', 'Highlights'],
    ['achievements', 'Achievements']
  ];
  const normalizeValue = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean).join('\n');
    }
    return String(value || '').trim();
  };

  return fields
    .filter(([field]) => normalizeValue(previousProfile?.[field]) !== normalizeValue(nextProfile?.[field]))
    .map(([field, label]) => ({
      field: label,
      from: normalizeValue(previousProfile?.[field]) || 'unset',
      to: normalizeValue(nextProfile?.[field]) || 'unset'
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
  const verifiedBy = String(
    currentRosterVerification.verifiedByName
    || currentRosterVerification.verifiedBy
    || currentRosterVerification.verifiedByEmail
    || ''
  ).trim() || 'unknown staff member';
  const ageDays = daysOld(currentRosterVerification.verifiedAt);
  const stale = ageDays === null || ageDays >= REVIEW_STALE_DAYS;

  const dateText = verifiedAtDate ? verifiedAtDate.toLocaleString() : 'never';
  const staleText = stale
    ? (ageDays === null ? 'Stale warning: never verified.' : `Stale warning: ${ageDays} days old.`)
    : 'Verification is current.';

  const statusText = currentRosterVerification.needsReview ? 'Needs verification' : 'Verified';
  rosterVerificationStatus.textContent = `Status: ${statusText}. Last verified: ${dateText}. Verified by: ${verifiedBy}. ${staleText}`;
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

function getCurrentRosterChanges() {
  const cleanedRoster = normalizeRoster(currentRoster);
  const teamProfile = collectTeamProfileFromForm();
  const diff = buildRosterDiff(savedRosterSnapshot, cleanedRoster);
  const profileChanges = buildTeamProfileDiff(currentTeamProfile, teamProfile);

  return {
    cleanedRoster,
    teamProfile,
    diff,
    profileChanges,
    hasChanges: diff.hasChanges || profileChanges.length > 0
  };
}

function updateRosterWorkflowState() {
  const changes = selectedTeam
    ? getCurrentRosterChanges()
    : { hasChanges: false };
  const state = getRosterWorkflowState({
    hasWriteAccess: hasRosterWriteAccess,
    hasSelectedTeam: Boolean(selectedTeam),
    hasUnsavedChanges: changes.hasChanges,
    isLoading: isRosterLoading,
    isSaving: isRosterSaving,
    isVerifying: isRosterVerifying
  });

  if (saveRosterButton) {
    saveRosterButton.disabled = state.saveDisabled;
    saveRosterButton.textContent = state.saveLabel;
  }
  if (rosterSaveState) {
    rosterSaveState.textContent = state.saveStatus;
    rosterSaveState.dataset.state = state.saveStatusKind;
  }
  if (verifyRosterButton) verifyRosterButton.disabled = state.verifyDisabled;
  if (rosterVerificationGuidance) {
    rosterVerificationGuidance.textContent = state.verificationGuidance;
  }

  return { changes, state };
}

function setRosterUiEnabled(enabled) {
  teamSelect.disabled = !enabled;
  playerNameInput.disabled = !enabled;
  if (playerLineupInput) playerLineupInput.disabled = !enabled;
  if (playerStatusInput) playerStatusInput.disabled = !enabled;
  addPlayerButton.disabled = !enabled;
  saveRosterButton.disabled = true;
  if (verifyRosterButton) verifyRosterButton.disabled = true;
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
  updateRosterWorkflowState();
}

function setTrialsWriteEnabled(enabled) {
  if (addTrialButton) addTrialButton.disabled = !enabled;
}

function requireRosterWriteAccess(target) {
  if (hasRosterWriteAccess) return true;
  setMessage(target, 'Your role has read-only roster access.', true);
  return false;
}

function requireTrialsWriteAccess(target) {
  if (hasTrialsWriteAccess) return true;
  setMessage(target, 'Your role cannot manage trials.', true);
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
    updateRosterWorkflowState();
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
      updateRosterWorkflowState();
    });
    nameCell.appendChild(nameInput);

    const rolesCell = document.createElement('td');
    const rolesInput = document.createElement('input');
    rolesInput.type = 'text';
    rolesInput.placeholder = 'Roles (comma separated)';
    rolesInput.value = normalizeRoles(player.roles || []).join(', ');
    rolesInput.addEventListener('input', (event) => {
      currentRoster[index].roles = normalizeRoles(event.target.value);
      updateRosterWorkflowState();
    });
    rolesCell.appendChild(rolesInput);

    const lineupCell = document.createElement('td');
    const lineupSelect = document.createElement('select');
    lineupSelect.className = 'admin-select';
    lineupSelect.innerHTML = '<option value="starter">Starter</option><option value="sub">Sub</option>';
    lineupSelect.value = normalizeLineup(player.lineup, index);
    lineupSelect.addEventListener('change', (event) => {
      currentRoster[index].lineup = normalizeLineup(event.target.value, index);
      updateRosterWorkflowState();
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
      updateRosterWorkflowState();
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
    [nameInput, rolesInput, lineupSelect, statusSelect, removeButton].forEach((control) => {
      control.disabled = !hasRosterWriteAccess;
    });
    actionsCell.appendChild(removeButton);

    row.appendChild(nameCell);
    row.appendChild(rolesCell);
    row.appendChild(lineupCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    rosterTableBody.appendChild(row);
  });

  updateRosterWorkflowState();
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
  setMessage(rosterSaveModalMessage, '');
  rosterDiffModal.hidden = false;
}

function closeReviewModal() {
  if (!rosterDiffModal) return;
  rosterDiffModal.hidden = true;
}

async function loadRoster() {
  if (!selectedTeam) {
    isRosterLoading = false;
    currentRoster = [];
    savedRosterSnapshot = [];
    currentTeamProfile = {};
    currentRosterVerification = {
      verifiedAt: null,
      verifiedBy: null,
      verifiedByUid: null,
      verifiedByEmail: null,
      verifiedByName: null,
      needsReview: false
    };
    renderTeamProfileFields(getProfileDefaults(selectedTeam));
    renderRosterVerification();
    renderRoster();
    updateRosterWorkflowState();
    return;
  }

  isRosterLoading = true;
  updateRosterWorkflowState();

  try {
    setMessage(rosterMessage, 'Loading roster...');
    const rosterDoc = await getRoster(selectedTeam);
    currentRoster = normalizeRoster(rosterDoc.players || []);
    savedRosterSnapshot = cloneRoster(currentRoster);
    currentTeamProfile = rosterDoc.teamProfile || {};
    currentRosterVerification = {
      verifiedAt: rosterDoc.verifiedAt || null,
      verifiedBy: rosterDoc.verifiedBy || null,
      verifiedByUid: rosterDoc.verifiedByUid || null,
      verifiedByEmail: rosterDoc.verifiedByEmail || null,
      verifiedByName: rosterDoc.verifiedByName || null,
      needsReview: rosterDoc.needsReview === true
    };
    renderTeamProfileFields(currentTeamProfile);
    renderRosterVerification();
    renderRoster();
    if (!hasRosterWriteAccess) {
      setMessage(rosterMessage, 'Roster loaded in read-only mode.');
    }
  } catch (error) {
    console.error('Load roster failed:', error);
    setMessage(rosterMessage, 'Failed to load roster.', true);
  } finally {
    isRosterLoading = false;
    updateRosterWorkflowState();
  }
}

async function handleSaveRoster() {
  if (!requireRosterWriteAccess(rosterMessage)) return;

  if (!selectedTeam) {
    setMessage(rosterMessage, 'Select a team before saving.', true);
    return;
  }

  const {
    cleanedRoster,
    teamProfile,
    diff,
    profileChanges,
    hasChanges
  } = getCurrentRosterChanges();

  if (!hasChanges) {
    setMessage(rosterMessage, 'All changes are already saved.');
    updateRosterWorkflowState();
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
    isRosterSaving = true;
    updateRosterWorkflowState();
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
    await loadRoster();
    setMessage(rosterMessage, 'Changes saved successfully.');
  } catch (error) {
    console.error('Save roster failed:', error);
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').trim();

    if (code.includes('permission-denied')) {
      const safeMessage = 'Save failed because this account cannot update the selected team. Your edits are still here.';
      setMessage(rosterMessage, safeMessage, true);
      setMessage(rosterSaveModalMessage, safeMessage, true);
      return;
    }

    if (!code && message) {
      const safeMessage = `Save failed: ${message} Your edits are still here.`;
      setMessage(rosterMessage, safeMessage, true);
      setMessage(rosterSaveModalMessage, safeMessage, true);
      return;
    }

    const safeMessage = 'Save failed. Your edits are still here; please try again.';
    setMessage(rosterMessage, safeMessage, true);
    setMessage(rosterSaveModalMessage, safeMessage, true);
  } finally {
    isRosterSaving = false;
    confirmRosterSaveButton.disabled = false;
    updateRosterWorkflowState();
  }
}

async function handleVerifyRoster() {
  if (!requireRosterWriteAccess(rosterMessage)) return;

  if (!selectedTeam) {
    setMessage(rosterMessage, 'Select a team before verifying.', true);
    return;
  }

  const { changes } = updateRosterWorkflowState();
  if (changes.hasChanges) {
    setMessage(rosterMessage, 'Save your changes before verifying the roster.', true);
    return;
  }

  try {
    isRosterVerifying = true;
    updateRosterWorkflowState();
    setMessage(rosterMessage, 'Verifying current roster...');
    await verifyRoster(selectedTeam);
    await loadRoster();
    setMessage(rosterMessage, 'Roster verified successfully.');
  } catch (error) {
    console.error('Verify roster failed:', error);
    setMessage(rosterMessage, 'Failed to verify roster. Please try again.', true);
  } finally {
    isRosterVerifying = false;
    updateRosterWorkflowState();
  }
}

function handleAddPlayer() {
  if (!requireRosterWriteAccess(rosterMessage)) return;

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
  if (!value) return 'Not available';
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function createTrialActionField(labelText, control) {
  const label = document.createElement('label');
  label.className = 'admin-trial-action-field';
  const text = document.createElement('span');
  text.className = 'admin-label';
  text.textContent = labelText;
  label.append(text, control);
  return label;
}

function createPendingTrialActions(trial) {
  const actions = document.createElement('div');
  actions.className = 'admin-trial-card__actions';

  const decisionActions = document.createElement('div');
  decisionActions.className = 'admin-inline-actions admin-trial-card__decisions';

  const rejectButton = document.createElement('button');
  rejectButton.className = 'admin-btn admin-btn--secondary';
  rejectButton.type = 'button';
  rejectButton.textContent = 'Reject';

  const dropButton = document.createElement('button');
  dropButton.className = 'admin-btn admin-btn--danger';
  dropButton.type = 'button';
  dropButton.textContent = 'Drop';

  let approveButton = null;
  let approvalControls = [];
  const setTrialActionsDisabled = (disabled) => {
    rejectButton.disabled = disabled || !hasTrialsWriteAccess;
    dropButton.disabled = disabled || !hasTrialsWriteAccess;
    if (approveButton) approveButton.disabled = disabled || !hasTrialsWriteAccess || !hasRosterWriteAccess;
    approvalControls.forEach((control) => {
      control.disabled = disabled
        || !hasRosterWriteAccess
        || (control.dataset.teamControl === 'true' && Boolean(assignedTeamId));
    });
  };

  if (hasRosterWriteAccess) {
    const approval = document.createElement('details');
    approval.className = 'admin-trial-approval';
    const summary = document.createElement('summary');
    summary.textContent = 'Approve to roster';

    const approvalGrid = document.createElement('div');
    approvalGrid.className = 'admin-trial-approval__grid';

    const conversionTeam = document.createElement('select');
    conversionTeam.className = 'admin-select';
    conversionTeam.dataset.teamControl = 'true';
    conversionTeam.innerHTML = teamSelect.innerHTML;
    conversionTeam.value = trial.teamId || '';

    const conversionRole = document.createElement('input');
    conversionRole.className = 'admin-input';
    conversionRole.placeholder = 'Tank, DPS, Support';
    conversionRole.value = Array.isArray(trial.roles) ? trial.roles.join(', ') : '';

    const conversionLineup = document.createElement('select');
    conversionLineup.className = 'admin-select';
    conversionLineup.innerHTML = '<option value="starter">Starter</option><option value="sub" selected>Sub</option>';

    const conversionStatus = document.createElement('select');
    conversionStatus.className = 'admin-select';
    conversionStatus.innerHTML = '<option value="">Unset</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="trial">Trial</option>';

    approveButton = document.createElement('button');
    approveButton.className = 'admin-btn admin-btn--primary';
    approveButton.type = 'button';
    approveButton.textContent = 'Approve and Add';

    approvalControls = [conversionTeam, conversionRole, conversionLineup, conversionStatus];
    approvalGrid.append(
      createTrialActionField('Roster team', conversionTeam),
      createTrialActionField('Roles', conversionRole),
      createTrialActionField('Lineup', conversionLineup),
      createTrialActionField('Player status', conversionStatus),
      approveButton
    );
    approval.append(summary, approvalGrid);
    actions.appendChild(approval);

    approveButton.addEventListener('click', async () => {
      if (!requireTrialsWriteAccess(trialsMessage) || !requireRosterWriteAccess(trialsMessage)) return;
      const nextTeam = conversionTeam.value;
      if (!nextTeam) {
        setMessage(trialsMessage, 'Select a team before approving a trial.', true);
        return;
      }
      if (!window.confirm(`Approve ${trial.name || 'this trial'} and add them to the ${nextTeam.toUpperCase()} roster?`)) return;

      try {
        setTrialActionsDisabled(true);
        await approveTrialToRoster({
          trialId: trial.id,
          teamId: nextTeam,
          roles: normalizeRoles(conversionRole.value),
          lineup: normalizeLineup(conversionLineup.value, 99),
          playerStatus: normalizeStatus(conversionStatus.value),
          performedByEmail: currentUserEmail || null
        });
        await loadTrials();
        if (nextTeam === selectedTeam) await loadRoster();
        setMessageHtml(trialsMessage, `Trial approved and moved to History. <a href="admin.html?team=${encodeURIComponent(nextTeam)}">Open roster editor</a>.`);
      } catch (error) {
        console.error('Approve trial failed:', error);
        setMessage(trialsMessage, 'Approve failed. Please try again.', true);
      } finally {
        setTrialActionsDisabled(false);
      }
    });
  }

  rejectButton.addEventListener('click', async () => {
    if (!requireTrialsWriteAccess(trialsMessage)) return;
    if (!window.confirm(`Reject ${trial.name || 'this trial'} and move it to History?`)) return;
    try {
      setTrialActionsDisabled(true);
      await setTrialStatus(trial.id, 'rejected', currentUserEmail);
      await loadTrials();
      setMessage(trialsMessage, 'Trial rejected and moved to History.');
    } catch (error) {
      console.error('Reject trial failed:', error);
      setMessage(trialsMessage, 'Reject failed. Please try again.', true);
    } finally {
      setTrialActionsDisabled(false);
    }
  });

  dropButton.addEventListener('click', async () => {
    if (!requireTrialsWriteAccess(trialsMessage)) return;
    if (!window.confirm(`Drop ${trial.name || 'this trial'} from the active queue and keep it in History?`)) return;
    try {
      setTrialActionsDisabled(true);
      await setTrialStatus(trial.id, 'dropped', currentUserEmail);
      await loadTrials();
      setMessage(trialsMessage, 'Trial dropped and kept in History.');
    } catch (error) {
      console.error('Drop trial failed:', error);
      setMessage(trialsMessage, 'Drop failed. Please try again.', true);
    } finally {
      setTrialActionsDisabled(false);
    }
  });

  decisionActions.append(rejectButton, dropButton);
  actions.appendChild(decisionActions);
  setTrialActionsDisabled(false);
  return actions;
}

function renderTrialsNavigation() {
  const counts = getTrialsViewCounts(currentTrials);
  Object.entries(counts).forEach(([view, count]) => {
    const target = document.querySelector(`[data-trials-count="${view}"]`);
    if (target) target.textContent = String(count);
  });

  trialsViewTabs.forEach((tab) => {
    const active = tab.dataset.trialsView === selectedTrialsView;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  if (trialsHistoryFilterWrap) {
    trialsHistoryFilterWrap.hidden = selectedTrialsView !== TRIALS_VIEWS.HISTORY;
  }
}

function renderTrialsView() {
  trialsList.innerHTML = '';
  renderTrialsNavigation();
  const trials = filterTrialsForView(currentTrials, {
    view: selectedTrialsView,
    historyStatus: trialsHistoryStatusFilter?.value || ''
  });

  if (!trials.length) {
    const emptyMessages = {
      pending: 'No pending trials. The active queue is clear.',
      history: 'No closed trials match this history filter.',
      all: 'No trials found.'
    };
    setMessage(trialsMessage, emptyMessages[selectedTrialsView]);
    return;
  }

  setMessage(trialsMessage, `Showing ${trials.length} ${selectedTrialsView === TRIALS_VIEWS.HISTORY ? 'history' : selectedTrialsView} trial(s).`);

  trials.forEach((trial) => {
    const status = String(trial.status || 'pending').trim().toLowerCase();
    const team = getTeamMeta(String(trial.teamId || '').trim().toLowerCase());
    const card = document.createElement('article');
    card.className = `admin-trial-card admin-trial-card--${status}`;

    const header = document.createElement('div');
    header.className = 'admin-trial-card__header';
    const logo = document.createElement('img');
    logo.className = 'admin-trial-card__logo';
    logo.src = team?.logo || '/images/branding/andro-org.png';
    logo.alt = team ? `${team.name} logo` : 'Andromeda logo';

    const heading = document.createElement('div');
    heading.className = 'admin-trial-card__heading';
    const title = document.createElement('h3');
    title.textContent = trial.name || 'Unnamed trial';
    const teamName = document.createElement('span');
    teamName.textContent = team?.name || trial.teamId || 'Unassigned';
    heading.append(title, teamName);

    const statusBadge = document.createElement('span');
    statusBadge.className = `admin-trial-status admin-trial-status--${status}`;
    statusBadge.textContent = getTrialStatusLabel(status);
    header.append(logo, heading, statusBadge);

    const meta = document.createElement('div');
    meta.className = 'admin-trial-card__meta';
    const roles = document.createElement('span');
    roles.textContent = `Roles: ${(trial.roles || []).join(', ') || 'None listed'}`;
    const created = document.createElement('span');
    created.textContent = `Created: ${formatTrialDate(trial.createdAt)}`;
    meta.append(roles, created);

    if (status !== 'pending') {
      const updated = document.createElement('span');
      updated.textContent = `Closed: ${formatTrialDate(trial[`${status}At`] || trial.updatedAt)}`;
      meta.appendChild(updated);
      if (trial.lastModifiedBy) {
        const modifiedBy = document.createElement('span');
        modifiedBy.textContent = `Updated by: ${trial.lastModifiedBy}`;
        meta.appendChild(modifiedBy);
      }
    }

    card.append(header, meta);
    if (trial.notes) {
      const notes = document.createElement('p');
      notes.className = 'admin-trial-card__notes';
      notes.textContent = trial.notes;
      card.appendChild(notes);
    }
    if (status === 'pending') card.appendChild(createPendingTrialActions(trial));
    trialsList.appendChild(card);
  });
}

function renderTrials(trials) {
  currentTrials = Array.isArray(trials) ? trials : [];
  renderTrialsView();
}

async function loadTrials() {
  if (!hasTrialsWriteAccess) {
    setMessage(trialsMessage, 'Your role cannot view or manage trials.', true);
    trialsList.innerHTML = '';
    return;
  }

  const filters = {
    teamId: trialsTeamFilter.value || undefined
  };

  try {
    setMessage(trialsMessage, 'Loading trials...');
    const trials = await listTrials(filters);
    renderTrials(trials);
  } catch (error) {
    console.error('Load trials failed:', {
      code: error?.code || null,
      message: error?.message || String(error),
      teamId: filters.teamId || 'all',
      view: selectedTrialsView,
      error
    });
    setMessage(trialsMessage, 'Failed to load trials.', true);
  }
}

async function handleAddTrial() {
  if (!requireTrialsWriteAccess(trialsMessage)) return;

  const name = trialNameInput.value.trim();
  const teamId = trialTeamSelect.value;
  const roles = getCheckedValues('trial-roles');
  const notes = trialNotesInput.value.trim();

  if (!name || !teamId) {
    setMessage(trialsMessage, 'Trial name and team are required.', true);
    return;
  }

  try {
    if (addTrialButton) addTrialButton.disabled = true;
    trackEvent('trial_submission_started', {
      team_id: teamId,
      has_notes: notes.length > 0
    });
    await createTrial({ name, teamId, roles, notes, status: 'pending', performedByEmail: currentUserEmail || null });
    trialNameInput.value = '';
    trialTeamSelect.value = teamId;
    trialNotesInput.value = '';
    clearRoleCheckboxes('trial-roles');
    if (trialCreatePanel) trialCreatePanel.open = false;
    selectedTrialsView = TRIALS_VIEWS.PENDING;
    if (trialsHistoryStatusFilter) trialsHistoryStatusFilter.value = '';
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
  } finally {
    if (addTrialButton) addTrialButton.disabled = !hasTrialsWriteAccess;
  }
}

teamSelect.addEventListener('change', async () => {
  selectedTeam = teamSelect.value;
  applyTeamWorkspaceBranding(selectedTeam);
  await loadRoster();
});
addPlayerButton.addEventListener('click', handleAddPlayer);
saveRosterButton.addEventListener('click', handleSaveRoster);
if (cancelRosterSaveButton) {
  cancelRosterSaveButton.addEventListener('click', () => {
    pendingSavePayload = null;
    setMessage(rosterSaveModalMessage, '');
    closeReviewModal();
    updateRosterWorkflowState();
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
if (trialsHistoryStatusFilter) {
  trialsHistoryStatusFilter.addEventListener('change', renderTrialsView);
}
trialsViewTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    selectedTrialsView = normalizeTrialsView(tab.dataset.trialsView);
    renderTrialsView();
  });
});
addTrialButton.addEventListener('click', handleAddTrial);

[
  teamDisplayNameInput,
  teamTierInput,
  teamRegionInput,
  teamRatingInput,
  teamManagerInput,
  teamCoachesInput,
  teamCaptainInput,
  teamDescriptionInput,
  teamHighlightsInput,
  teamAchievementsInput
].filter(Boolean).forEach((control) => {
  control.addEventListener('input', updateRosterWorkflowState);
});

populateTeamSelect(teamSelect);
populateTeamSelect(trialsTeamFilter, { includeAll: true });
populateTeamSelect(trialTeamSelect);
renderTrialsNavigation();

setMessage(rosterMessage, 'Sign in to access roster editing.');
setMessage(trialsMessage, 'Sign in to view and manage trials.');
setRosterUiEnabled(false);
setTrialsWriteEnabled(false);
renderRosterVerification();
updateRosterWorkflowState();

const initialTeamParam = String(new URLSearchParams(window.location.search).get('team') || '').trim().toLowerCase();
if (initialTeamParam && Array.from(teamSelect.options).some((option) => option.value === initialTeamParam)) {
  teamSelect.value = initialTeamParam;
  selectedTeam = initialTeamParam;
}
applyTeamWorkspaceBranding(selectedTeam);

window.addEventListener('admin:authorized', async (event) => {
  const email = String(event?.detail?.email || '').trim().toLowerCase();
  const hasRosterAccess = eventHasPermission(event, 'rosters:write');
  const hasTrialsAccess = eventHasPermission(event, 'trials:write');
  const canManageAllTeams = eventHasPermission(event, 'teams:any');
  const requestedAssignedTeam = String(event?.detail?.teamId || '').trim().toLowerCase();
  const hasValidAssignedTeam = TEAM_OPTIONS.some((team) => team.id === requestedAssignedTeam);
  assignedTeamId = !canManageAllTeams && hasValidAssignedTeam ? requestedAssignedTeam : null;
  const hasValidTeamScope = canManageAllTeams || Boolean(assignedTeamId);
  hasRosterWriteAccess = hasRosterAccess && hasValidTeamScope;
  hasTrialsWriteAccess = hasTrialsAccess && hasValidTeamScope;
  currentUserEmail = email || null;
  setRosterUiEnabled(hasRosterWriteAccess);
  setTrialsWriteEnabled(hasTrialsWriteAccess);

  if (canManageAllTeams) {
    populateTeamSelect(teamSelect);
    populateTeamSelect(trialsTeamFilter, { includeAll: true });
    populateTeamSelect(trialTeamSelect);
    if (selectedTeam && Array.from(teamSelect.options).some((option) => option.value === selectedTeam)) {
      teamSelect.value = selectedTeam;
      trialsTeamFilter.value = selectedTeam;
      trialTeamSelect.value = selectedTeam;
    }
    teamSelect.disabled = !hasRosterWriteAccess;
    trialsTeamFilter.disabled = !hasTrialsWriteAccess;
    trialTeamSelect.disabled = !hasTrialsWriteAccess;
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

  applyTeamWorkspaceBranding(selectedTeam);

  if (hasRosterWriteAccess) {
    setMessage(
      rosterMessage,
      assignedTeamId
        ? `Authorized for ${assignedTeamId}.`
        : (email ? `Authorized as ${email}. Select a team to edit roster.` : 'Authorized. Select a team to edit roster.')
    );
  } else if (assignedTeamId) {
    setMessage(rosterMessage, `Roster access for ${assignedTeamId} is read-only.`);
  } else {
    setMessage(rosterMessage, 'Your role does not include roster editing.', true);
  }

  if (hasTrialsWriteAccess) {
    setMessage(trialsMessage, assignedTeamId ? `Trials access is limited to ${assignedTeamId}.` : 'Trials access enabled.');
  } else {
    setMessage(trialsMessage, 'Your role does not include trial management.', true);
  }

  await loadTrials();
  if (selectedTeam) {
    await loadRoster();
  }
  scrollToRequestedWorkspaceSection();
});
