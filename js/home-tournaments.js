import { listPublishedTournaments } from '/js/services/tournaments.service.js';
import { createTournamentCard, getTournamentTotals } from '/js/ui/tournaments.ui.js';

const root = document.querySelector('[data-module="home-tournaments"]');

function setText(selector, value) {
  const el = root?.querySelector(selector);
  if (el) el.textContent = value;
}

function renderTotals(items) {
  const totals = getTournamentTotals(items);
  setText('[data-total-tournaments]', String(totals.totalTournaments));
  setText('[data-total-record]', `${totals.totalWins}W-${totals.totalLosses}L`);
  setText('[data-total-achievements]', String(totals.totalAchievements));
}

async function init() {
  if (!root) return;

  const listEl = root.querySelector('[data-home-tournament-list]');
  const statusEl = root.querySelector('[data-home-tournament-status]');

  try {
    const tournaments = await listPublishedTournaments(50);
    renderTotals(tournaments);

    const latest = tournaments.slice(0, 3);
    listEl.innerHTML = '';

    if (!latest.length) {
      statusEl.textContent = 'No event records have been published yet.';
      return;
    }

    latest.forEach((item) => {
      listEl.appendChild(createTournamentCard(item, { maxBullets: 2 }));
    });

    statusEl.textContent = `Showing latest ${latest.length} event record(s).`;
  } catch (error) {
    console.error('Failed to load homepage competition records:', error);
    statusEl.textContent = 'Unable to load competition history right now.';
  }
}

init();
