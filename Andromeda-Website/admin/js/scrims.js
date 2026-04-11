import { listRosterTeams } from '/js/services/rosters.service.js';
import { createMatchEntry } from '/js/services/scrims.service.js';

const form = document.getElementById('scrim-form');
const submitButton = document.getElementById('scrim-submit-btn');
const resetButton = document.getElementById('scrim-reset-btn');
const statusEl = document.getElementById('scrim-form-status');

const teamSelect = document.getElementById('scrim-team');
const typeSelect = document.getElementById('scrim-type');
const opponentInput = document.getElementById('scrim-opponent');
const replayCodeInput = document.getElementById('scrim-replay-code');
const resultInput = document.getElementById('scrim-result');
const scoreForInput = document.getElementById('scrim-score-for');
const scoreAgainstInput = document.getElementById('scrim-score-against');
const mapsInput = document.getElementById('scrim-maps');
const notesInput = document.getElementById('scrim-notes');
const statsInput = document.getElementById('scrim-stats');
const screenshotsInput = document.getElementById('scrim-screenshots');

const FALLBACK_TEAMS = [
  { teamId: 'horizon', teamName: 'Horizon' },
  { teamId: 'spiral', teamName: 'Spiral' },
  { teamId: 'proxima', teamName: 'Proxima' },
  { teamId: 'comet', teamName: 'Comet' },
  { teamId: 'supernova', teamName: 'Supernova' },
  { teamId: 'void', teamName: 'Void' },
  { teamId: 'faceit', teamName: 'Andromeda: FACEIT' }
];

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--text-muted)';
}

function normalizeTeamName(value) {
  const match = (teamSelect.dataset.options || '').split('||').map((entry) => {
    const [teamId, teamName] = entry.split('::');
    return { teamId, teamName };
  }).find((item) => item.teamId === value);

  if (match) return match.teamName;
  return value;
}

function renderTeamOptions(items) {
  const sorted = [...items].sort((a, b) => a.teamName.localeCompare(b.teamName));
  const optionsIndex = sorted.map((item) => `${item.teamId}::${item.teamName}`).join('||');
  teamSelect.dataset.options = optionsIndex;

  teamSelect.innerHTML = '<option value="">Select team</option>';
  sorted.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.teamId;
    option.textContent = item.teamName;
    teamSelect.appendChild(option);
  });
}

async function loadTeams() {
  try {
    const teams = await listRosterTeams();
    if (teams.length) {
      renderTeamOptions(teams);
      return;
    }
  } catch (error) {
    console.error('Could not load teams from rosters:', error);
  }

  renderTeamOptions(FALLBACK_TEAMS);
}

function clearForm() {
  form.reset();
  setStatus('Ready to submit.');
}

async function handleSubmit(event) {
  event.preventDefault();

  const teamId = String(teamSelect.value || '').trim();
  const teamName = normalizeTeamName(teamId);

  if (!teamId) {
    setStatus('Team is required.', true);
    return;
  }

  const files = Array.from(screenshotsInput.files || []);

  const payload = {
    type: typeSelect.value,
    teamId,
    teamName,
    opponentName: opponentInput.value,
    replayCode: replayCodeInput.value,
    result: resultInput.value,
    mapScoreFor: scoreForInput.value,
    mapScoreAgainst: scoreAgainstInput.value,
    mapsPlayed: mapsInput.value,
    notes: notesInput.value,
    stats: statsInput.value
  };

  try {
    submitButton.disabled = true;
    resetButton.disabled = true;
    const label = typeSelect.value === 'official' ? 'official match' : 'scrim';
    setStatus(`Uploading screenshots and submitting ${label}...`);

    const scrimId = await createMatchEntry(payload, files, (progress) => {
      setStatus(`Uploading screenshots (${progress.uploaded}/${progress.total})...`);
    });

    setStatus(`Match submitted successfully (${scrimId}).`);
    clearForm();
  } catch (error) {
    console.error('Scrim submission failed:', error);
    setStatus(error?.message || 'Failed to submit scrim.', true);
  } finally {
    submitButton.disabled = false;
    resetButton.disabled = false;
  }
}

resetButton.addEventListener('click', clearForm);
form.addEventListener('submit', handleSubmit);

window.addEventListener('admin:authorized', async () => {
  await loadTeams();
  setStatus('Ready to submit.');
});
