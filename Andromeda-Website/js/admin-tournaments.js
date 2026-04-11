import { adminSignOut, onAdminAuthState } from '/js/admin/admin-auth.js';
import { isEmailAllowlisted } from '/js/services/admin.service.js';
import {
  createTournament,
  deleteTournament,
  listAllTournamentsForAdmin,
  updateTournament
} from '/js/services/tournaments.service.js';
import { createTournamentCard, formatDateRange } from '/js/ui/tournaments.ui.js';

const appShell = document.getElementById('adminApp');
const accessMessage = document.getElementById('admin-tournaments-gate');
const statusEl = document.getElementById('admin-tournaments-status');
const emailEl = document.querySelector('[data-admin-email]');

const form = document.getElementById('tournament-form');
const idInput = document.getElementById('tournament-id');
const nameInput = document.getElementById('tournament-name');
const gameInput = document.getElementById('tournament-game');
const startInput = document.getElementById('tournament-start-date');
const endInput = document.getElementById('tournament-end-date');
const placementInput = document.getElementById('tournament-placement');
const winsInput = document.getElementById('tournament-wins');
const lossesInput = document.getElementById('tournament-losses');
const achievementsInput = document.getElementById('tournament-achievements');
const highlightsInput = document.getElementById('tournament-highlights');
const linkInput = document.getElementById('tournament-link');
const isPublishedInput = document.getElementById('tournament-published');
const resetButton = document.getElementById('tournament-reset-btn');

const listEl = document.getElementById('admin-tournaments-list');

let tournaments = [];
let editingTournament = null;

function toDateInputValue(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value, fallbackEndOfDay = false) {
  const text = String(value || '').trim();
  if (!text) return null;

  const date = fallbackEndOfDay
    ? new Date(`${text}T23:59:59`)
    : new Date(`${text}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeListInput(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--admin-muted)';
}

function redirectWithMessage(message) {
  accessMessage.hidden = false;
  accessMessage.textContent = message;
  setTimeout(() => {
    window.location.href = '/admin/index.html';
  }, 1400);
}

function validateFormData(data) {
  if (!data.name || !data.game || !data.startDate) {
    return 'Name, game, and start date are required.';
  }

  if (!Number.isFinite(data.record.wins) || data.record.wins < 0) {
    return 'Wins must be a number greater than or equal to 0.';
  }

  if (!Number.isFinite(data.record.losses) || data.record.losses < 0) {
    return 'Losses must be a number greater than or equal to 0.';
  }

  return null;
}

function getFormPayload() {
  const payload = {
    name: String(nameInput.value || '').trim(),
    game: String(gameInput.value || '').trim(),
    startDate: parseDateInput(startInput.value),
    endDate: parseDateInput(endInput.value, true),
    placementText: String(placementInput.value || '').trim(),
    record: {
      wins: Number(winsInput.value),
      losses: Number(lossesInput.value)
    },
    achievements: normalizeListInput(achievementsInput.value),
    highlights: normalizeListInput(highlightsInput.value),
    link: String(linkInput.value || '').trim(),
    isPublished: Boolean(isPublishedInput.checked)
  };

  return payload;
}

function clearForm() {
  editingTournament = null;
  idInput.value = '';
  form.reset();
  isPublishedInput.checked = true;
  setStatus('Ready.');
}

function fillForm(tournament) {
  editingTournament = tournament;
  idInput.value = tournament.id;
  nameInput.value = tournament.name || '';
  gameInput.value = tournament.game || '';
  startInput.value = toDateInputValue(tournament.startDate);
  endInput.value = toDateInputValue(tournament.endDate);
  placementInput.value = tournament.placementText || '';
  winsInput.value = Number(tournament?.record?.wins) || 0;
  lossesInput.value = Number(tournament?.record?.losses) || 0;
  achievementsInput.value = Array.isArray(tournament.achievements) ? tournament.achievements.join(', ') : '';
  highlightsInput.value = Array.isArray(tournament.highlights) ? tournament.highlights.join(', ') : '';
  linkInput.value = tournament.link || '';
  isPublishedInput.checked = tournament.isPublished !== false;
  setStatus(`Editing ${tournament.name}.`);
}

function buildAdminCard(tournament) {
  const wrapper = document.createElement('article');
  wrapper.className = 'admin-card';

  const card = createTournamentCard(tournament, { maxBullets: 2 });
  wrapper.appendChild(card);

  const meta = document.createElement('p');
  meta.className = 'admin-text-muted';
  meta.textContent = `Published: ${tournament.isPublished ? 'Yes' : 'No'} • Date: ${formatDateRange(tournament.startDate, tournament.endDate)}`;
  wrapper.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'admin-inline-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'admin-btn admin-btn--secondary';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => fillForm(tournament));

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'admin-btn admin-btn--secondary';
  toggleBtn.textContent = tournament.isPublished ? 'Unpublish' : 'Publish';
  toggleBtn.addEventListener('click', async () => {
    try {
      setStatus('Updating publish status...');
      await updateTournament(tournament.id, {
        ...tournament,
        isPublished: !tournament.isPublished,
        createdAt: tournament.createdAt
      });
      await loadTournaments();
      setStatus('Publish status updated.');
    } catch (error) {
      console.error('Failed to toggle tournament:', error);
      setStatus(error?.message || 'Failed to update publish status.', true);
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'admin-btn admin-btn--danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    const confirmed = window.confirm(`Delete ${tournament.name}?`);
    if (!confirmed) return;

    try {
      setStatus('Deleting tournament...');
      await deleteTournament(tournament.id);
      await loadTournaments();
      if (editingTournament?.id === tournament.id) {
        clearForm();
      }
      setStatus('Tournament deleted.');
    } catch (error) {
      console.error('Failed to delete tournament:', error);
      setStatus(error?.message || 'Failed to delete tournament.', true);
    }
  });

  actions.append(editBtn, toggleBtn, deleteBtn);
  wrapper.appendChild(actions);

  return wrapper;
}

async function loadTournaments() {
  tournaments = await listAllTournamentsForAdmin(200);
  listEl.innerHTML = '';

  if (!tournaments.length) {
    listEl.innerHTML = '<p class="admin-empty">No tournaments found yet.</p>';
    return;
  }

  tournaments.forEach((item) => {
    listEl.appendChild(buildAdminCard(item));
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = getFormPayload();
  const validationError = validateFormData(payload);
  if (validationError) {
    setStatus(validationError, true);
    return;
  }

  try {
    if (idInput.value && editingTournament) {
      setStatus('Updating tournament...');
      await updateTournament(idInput.value, {
        ...editingTournament,
        ...payload,
        createdAt: editingTournament.createdAt
      });
      setStatus('Tournament updated.');
    } else {
      setStatus('Creating tournament...');
      await createTournament(payload);
      setStatus('Tournament created.');
    }

    clearForm();
    await loadTournaments();
  } catch (error) {
    console.error('Tournament save failed:', error);
    setStatus(error?.message || 'Failed to save tournament.', true);
  }
}

document.querySelectorAll('[data-admin-signout]').forEach((button) => {
  button.addEventListener('click', async () => {
    await adminSignOut();
  });
});

form.addEventListener('submit', handleSubmit);
resetButton.addEventListener('click', clearForm);

onAdminAuthState(async (user) => {
  if (!user) {
    redirectWithMessage('Sign in required. Redirecting to admin login...');
    return;
  }

  const email = String(user.email || '').trim().toLowerCase();
  emailEl.textContent = email || '—';

  try {
    const allowlisted = await isEmailAllowlisted(email);
    if (!allowlisted) {
      redirectWithMessage('You are not allowlisted for tournament admin. Redirecting...');
      return;
    }

    appShell.hidden = false;
    accessMessage.hidden = true;
    await loadTournaments();
    setStatus('Ready.');
  } catch (error) {
    console.error('Admin tournaments auth failed:', error);
    redirectWithMessage('Could not verify access. Redirecting to admin login...');
  }
});
