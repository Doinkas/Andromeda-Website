import { listPublishedTournaments } from '/js/services/tournaments.service.js';
import { createTournamentCard, getTournamentTotals } from '/js/ui/tournaments.ui.js';

const filterEl = document.getElementById('tournaments-game-filter');
const listEl = document.getElementById('tournaments-list');
const statusEl = document.getElementById('tournaments-status');
const totalsEl = {
  tournaments: document.querySelector('[data-total-tournaments]'),
  record: document.querySelector('[data-total-record]'),
  achievements: document.querySelector('[data-total-achievements]')
};

let allTournaments = [];

function updateTotals(items) {
  const totals = getTournamentTotals(items);
  if (totalsEl.tournaments) totalsEl.tournaments.textContent = String(totals.totalTournaments);
  if (totalsEl.record) totalsEl.record.textContent = `${totals.totalWins}W-${totals.totalLosses}L`;
  if (totalsEl.achievements) totalsEl.achievements.textContent = String(totals.totalAchievements);
}

function renderFilterOptions(items) {
  const games = Array.from(new Set(items.map((item) => String(item.game || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const selected = filterEl.value;

  filterEl.innerHTML = '<option value="">All games</option>';
  games.forEach((game) => {
    const option = document.createElement('option');
    option.value = game;
    option.textContent = game;
    filterEl.appendChild(option);
  });

  if (selected && games.includes(selected)) {
    filterEl.value = selected;
  }
}

function renderList() {
  const game = String(filterEl.value || '').trim();
  const filtered = game
    ? allTournaments.filter((item) => String(item.game || '').trim() === game)
    : allTournaments;

  updateTotals(filtered);
  listEl.innerHTML = '';

  if (!filtered.length) {
    statusEl.textContent = 'No tournaments found for this filter.';
    return;
  }

  filtered.forEach((item) => {
    listEl.appendChild(createTournamentCard(item, { maxBullets: 2 }));
  });

  statusEl.textContent = `Showing ${filtered.length} tournament(s).`;
}

async function init() {
  try {
    statusEl.textContent = 'Loading tournaments...';
    allTournaments = await listPublishedTournaments(200);
    renderFilterOptions(allTournaments);
    renderList();
  } catch (error) {
    console.error('Failed to load tournaments:', error);
    statusEl.textContent = 'Unable to load tournaments right now.';
  }
}

filterEl.addEventListener('change', renderList);
init();
