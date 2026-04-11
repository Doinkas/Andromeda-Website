import { getRoster, saveRoster } from '/js/services/rosters.service.js';
import { createTrial, listTrials, setTrialStatus } from '/js/services/trials.service.js';

const rosterMessage = document.getElementById('roster-message');
const trialsMessage = document.getElementById('trials-message');
const rosterTableBody = document.getElementById('roster-table-body');
const teamSelect = document.getElementById('team-select');
const playerNameInput = document.getElementById('player-name');
const playerLineupInput = document.getElementById('player-lineup');
const addPlayerButton = document.getElementById('add-player-btn');
const saveRosterButton = document.getElementById('save-roster-btn');
const importHtmlButton = document.getElementById('import-html-btn');
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

let selectedTeam = '';
let currentRoster = [];
let currentTeamProfile = {};
let currentUserEmail = null;
let hasAdminAccess = false;

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
  faceit: {
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

function normalizeRoster(players) {
  if (!Array.isArray(players)) return [];

  return players
    .map((player, index) => {
      const name = String(player?.name || '').trim();
      const roles = normalizeRoles(player?.roles ?? player?.role ?? '');
      const lineup = normalizeLineup(player?.lineup, index);
      return { name, roles, lineup };
    })
    .filter((player) => player.name.length > 0);
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
  addPlayerButton.disabled = !enabled;
  saveRosterButton.disabled = !enabled;
  importHtmlButton.disabled = !enabled;
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
  setMessage(target, 'Not authorized. Sign in with an allowlisted admin account.', true);
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

function parsePlayersFromList(list) {
  const players = [];
  list.querySelectorAll('li.player').forEach((item) => {
    const name = item.querySelector('.player-name')?.textContent?.trim() || '';
    const roleSpans = Array.from(item.querySelectorAll('.player-roles .role'));
    const roles = roleSpans.map((span) => span.textContent.trim()).filter(Boolean);

    if (!name) return;
    players.push({ name, roles });
  });
  return players;
}

async function importRosterFromHtml() {
  if (!requireAdminWriteAccess(rosterMessage)) return;

  if (!selectedTeam) {
    setMessage(rosterMessage, 'Select a team before importing.', true);
    return;
  }

  try {
    setMessage(rosterMessage, 'Importing from teams.html...');

    const response = await fetch('/pages/teams.html', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Failed to fetch teams.html (${response.status})`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let section = null;
    if (selectedTeam === 'faceit') {
      section = doc.querySelector('section.team:not([id])');
    } else {
      section = doc.getElementById(selectedTeam);
    }

    if (!section) {
      setMessage(rosterMessage, `Could not find roster section for ${selectedTeam} in teams.html.`, true);
      return;
    }

    const list = section.querySelector('ul');
    if (!list) {
      setMessage(rosterMessage, 'No roster list found in the team section.', true);
      return;
    }

    const imported = parsePlayersFromList(list);
    if (!imported.length) {
      setMessage(rosterMessage, 'No players found in teams.html roster.', true);
      return;
    }

    const normalized = normalizeRoster(imported);
    await saveRoster(selectedTeam, normalized, currentUserEmail || null);
    await loadRoster();
    setMessage(rosterMessage, `Imported ${normalized.length} players from teams.html and saved to Firestore.`);
  } catch (error) {
    console.error('Import roster failed:', error);
    setMessage(rosterMessage, 'Import failed. Please try again.', true);
  }
}

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
    row.appendChild(actionsCell);
    rosterTableBody.appendChild(row);
  });
}

async function loadRoster() {
  if (!hasAdminAccess || !selectedTeam) {
    currentRoster = [];
    currentTeamProfile = {};
    renderTeamProfileFields(getProfileDefaults(selectedTeam));
    renderRoster();
    return;
  }

  try {
    setMessage(rosterMessage, 'Loading roster...');
    const rosterDoc = await getRoster(selectedTeam);
    currentRoster = normalizeRoster(rosterDoc.players || []);
    currentTeamProfile = rosterDoc.teamProfile || {};
    renderTeamProfileFields(currentTeamProfile);
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

  try {
    await saveRoster(selectedTeam, cleanedRoster, currentUserEmail || null, teamProfile);
    currentRoster = cleanedRoster;
    currentTeamProfile = teamProfile;
    setMessage(rosterMessage, 'Roster and team profile saved.');
    renderRoster();
  } catch (error) {
    console.error('Save roster failed:', error);
    setMessage(rosterMessage, 'Save failed. Please try again.', true);
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

  if (!name) {
    setMessage(rosterMessage, 'Player name is required.', true);
    return;
  }

  currentRoster.push({ name, roles, lineup });
  playerNameInput.value = '';
  if (playerLineupInput) {
    playerLineupInput.value = 'starter';
  }
  if (playerRolesCsvInput) {
    playerRolesCsvInput.value = '';
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
    approveButton.addEventListener('click', async () => {
      if (!requireAdminWriteAccess(trialsMessage)) return;
      try {
        await setTrialStatus(trial.id, 'approved', currentUserEmail);
        if (trial.teamId) {
          const rosterDoc = await getRoster(trial.teamId);
          const nextPlayers = normalizeRoster([
            ...(rosterDoc.players || []),
            {
              name: trial.name || '',
              roles: Array.isArray(trial.roles) ? trial.roles : [],
              lineup: 'sub'
            }
          ]);
          await saveRoster(trial.teamId, nextPlayers, currentUserEmail || null);
        }
        await loadTrials();
        if (trial.teamId === selectedTeam) {
          await loadRoster();
        }
      } catch (error) {
        console.error('Approve trial failed:', error);
        setMessage(trialsMessage, 'Approve failed. Please try again.', true);
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
    setMessage(trialsMessage, 'Sign in to view trials.');
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
    await createTrial({ name, teamId, roles, notes, status: 'pending', performedByEmail: currentUserEmail || null });
    trialNameInput.value = '';
    trialTeamSelect.value = '';
    trialNotesInput.value = '';
    clearRoleCheckboxes('trial-roles');
    await loadTrials();
    setMessage(trialsMessage, 'Trial added.');
  } catch (error) {
    console.error('Add trial failed:', error);
    setMessage(trialsMessage, 'Add trial failed. Please try again.', true);
  }
}

teamSelect.addEventListener('change', async () => {
  selectedTeam = teamSelect.value;
  await loadRoster();
});
addPlayerButton.addEventListener('click', handleAddPlayer);
saveRosterButton.addEventListener('click', handleSaveRoster);
importHtmlButton.addEventListener('click', importRosterFromHtml);
refreshTrialsButton.addEventListener('click', loadTrials);
trialsTeamFilter.addEventListener('change', loadTrials);
trialsStatusFilter.addEventListener('change', loadTrials);
addTrialButton.addEventListener('click', handleAddTrial);

setMessage(rosterMessage, 'Sign in to access roster editing.');
setMessage(trialsMessage, 'Sign in to view and manage trials.');
setRosterUiEnabled(false);
setTrialsWriteEnabled(false);

window.addEventListener('admin:authorized', async (event) => {
  const email = String(event?.detail?.email || '').trim().toLowerCase();
  hasAdminAccess = true;
  currentUserEmail = email || null;
  setRosterUiEnabled(true);
  setTrialsWriteEnabled(true);
  setMessage(rosterMessage, email ? `Authorized as ${email}. Select a team to edit roster.` : 'Authorized. Select a team to edit roster.');
  await loadTrials();
  if (selectedTeam) {
    await loadRoster();
  }
});
