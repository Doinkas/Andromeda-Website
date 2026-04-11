import { listAdminMatches, saveAdminMatch } from '/js/services/matches.service.js';

const form = document.getElementById('match-form');
const saveButton = document.getElementById('save-match-btn');
const clearButton = document.getElementById('clear-match-btn');
const refreshButton = document.getElementById('refresh-matches-btn');
const sortButton = document.getElementById('sort-direction-btn');
const formStatus = document.getElementById('match-form-status');
const listStatus = document.getElementById('match-list-status');
const listContainer = document.getElementById('upcoming-matches-list');

const fieldTeam = document.getElementById('match-team');
const fieldOpponent = document.getElementById('match-opponent');
const fieldDate = document.getElementById('match-date');
const fieldTime = document.getElementById('match-time');
const fieldStream = document.getElementById('match-stream-url');
const fieldId = document.getElementById('match-id');

let adminEmail = null;
let sortDirection = 'asc';

function setStatus(el, message, isError = false) {
  el.textContent = message;
  el.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--text-muted)';
}

function toLocalDateInputParts(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }

  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const timePart = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return { date: datePart, time: timePart };
}

function parseDateTime(dateText, timeText) {
  if (!dateText || !timeText) return null;
  const value = new Date(`${dateText}T${timeText}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function clearForm() {
  form.reset();
  fieldId.value = '';
  saveButton.textContent = 'Create Match';
  setStatus(formStatus, 'Ready to create a match.');
}

function fillForm(match) {
  const parts = toLocalDateInputParts(match.scheduledAt);
  fieldId.value = match.id || '';
  fieldTeam.value = match.teamId || '';
  fieldOpponent.value = match.opponent || '';
  fieldDate.value = parts.date;
  fieldTime.value = parts.time;
  fieldStream.value = match.streamUrl || '';
  saveButton.textContent = 'Update Match';
  setStatus(formStatus, `Editing ${match.opponent || 'match'} (${match.id}).`);
}

function renderMatchList(matches) {
  listContainer.innerHTML = '';

  if (!matches.length) {
    listContainer.innerHTML = '<div class="admin-empty">No matches yet</div>';
    setStatus(listStatus, 'No upcoming matches found.');
    return;
  }

  const sorted = [...matches].sort((a, b) => {
    const aDate = a.scheduledAt?.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
    const bDate = b.scheduledAt?.toDate ? b.scheduledAt.toDate() : new Date(b.scheduledAt);
    return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
  });

  sorted.forEach((match) => {
    const card = document.createElement('article');
    card.className = 'admin-card';

    const when = match.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match.scheduledAt);
    const title = document.createElement('h4');
    title.textContent = `${match.teamId?.toUpperCase() || 'TEAM'} vs ${match.opponent || 'TBD'}`;

    const meta = document.createElement('p');
    meta.className = 'admin-text-muted';
    meta.textContent = `${when.toLocaleString()}${match.streamUrl ? ` • ${match.streamUrl}` : ''}`;

    const actions = document.createElement('div');
    actions.className = 'admin-inline-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'admin-btn admin-btn--secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => fillForm(match));

    actions.appendChild(edit);
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(actions);
    listContainer.appendChild(card);
  });

  setStatus(listStatus, `Showing ${sorted.length} upcoming match(es).`);
}

async function loadMatches() {
  try {
    setStatus(listStatus, 'Loading upcoming matches...');
    const matches = await listAdminMatches({ limit: 200, upcomingOnly: true });
    renderMatchList(matches);
  } catch (error) {
    console.error('Load matches failed:', error);
    setStatus(listStatus, 'Could not load matches.', true);
  }
}

async function onSaveMatch(event) {
  event.preventDefault();

  const scheduledAt = parseDateTime(fieldDate.value, fieldTime.value);
  if (!scheduledAt) {
    setStatus(formStatus, 'Match date/time is required.', true);
    return;
  }

  const payload = {
    id: fieldId.value || undefined,
    teamId: fieldTeam.value,
    opponent: fieldOpponent.value.trim(),
    scheduledAt,
    streamUrl: fieldStream.value.trim() || null,
    source: 'admin'
  };

  if (!payload.teamId || !payload.opponent) {
    setStatus(formStatus, 'Team and opponent are required.', true);
    return;
  }

  try {
    saveButton.disabled = true;
    setStatus(formStatus, 'Saving match...');
    const savedId = await saveAdminMatch(payload, adminEmail);
    setStatus(formStatus, `Saved match (${savedId}).`);
    clearForm();
    await loadMatches();
  } catch (error) {
    console.error('Save match failed:', error);
    setStatus(formStatus, 'Could not save match. Please try again.', true);
  } finally {
    saveButton.disabled = false;
  }
}

sortButton.addEventListener('click', () => {
  sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  sortButton.textContent = sortDirection === 'asc' ? 'Sort: Soonest first' : 'Sort: Latest first';
  loadMatches();
});

clearButton.addEventListener('click', clearForm);
refreshButton.addEventListener('click', loadMatches);
form.addEventListener('submit', onSaveMatch);

window.addEventListener('admin:authorized', async (event) => {
  adminEmail = String(event?.detail?.email || '').trim().toLowerCase() || null;
  clearForm();
  await loadMatches();
});
