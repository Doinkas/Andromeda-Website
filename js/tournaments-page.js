import { TEAM_OPTIONS, TEAM_REGISTRY } from '/js/config/teams.config.js';
import { listCompletedOfficialMatches } from '/js/services/matches.service.js';
import { listPublishedTournaments } from '/js/services/tournaments.service.js';
import { createTournamentCard, getTournamentTotals } from '/js/ui/tournaments.ui.js';

const teamFilterEl = document.getElementById('competition-team-filter');
const matchListEl = document.getElementById('competition-match-list');
const matchStatusEl = document.getElementById('competition-match-status');
const gameFilterEl = document.getElementById('tournaments-game-filter');
const tournamentListEl = document.getElementById('tournaments-list');
const tournamentStatusEl = document.getElementById('tournaments-status');
const totalsEl = {
  matchReports: document.querySelector('[data-total-match-reports]'),
  matchRecord: document.querySelector('[data-total-match-record]'),
  tournaments: document.querySelector('[data-total-tournaments]')
};

let allMatches = [];
let allTournaments = [];

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getResult(match) {
  const result = String(match?.result || '').trim().toUpperCase();
  return ['W', 'L', 'D'].includes(result) ? result : 'Played';
}

function formatMatchDate(value) {
  const date = toDate(value);
  if (!date) return 'Date TBD';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getTeamName(teamId) {
  return TEAM_REGISTRY[teamId]?.name || String(teamId || 'Team').toUpperCase();
}

function updateMatchTotals(items) {
  const wins = items.filter((match) => getResult(match) === 'W').length;
  const losses = items.filter((match) => getResult(match) === 'L').length;
  const draws = items.filter((match) => getResult(match) === 'D').length;
  const record = `${wins}W-${losses}L${draws ? `-${draws}D` : ''}`;

  if (totalsEl.matchReports) totalsEl.matchReports.textContent = String(items.length);
  if (totalsEl.matchRecord) totalsEl.matchRecord.textContent = record;
}

function updateTournamentTotals(items) {
  const totals = getTournamentTotals(items);
  if (totalsEl.tournaments) totalsEl.tournaments.textContent = String(totals.totalTournaments);
}

function renderTeamFilter() {
  if (!teamFilterEl) return;

  const selected = teamFilterEl.value;
  teamFilterEl.innerHTML = '<option value="">All teams</option>';

  TEAM_OPTIONS.forEach((team) => {
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = team.name;
    teamFilterEl.appendChild(option);
  });

  if (selected && TEAM_OPTIONS.some((team) => team.id === selected)) {
    teamFilterEl.value = selected;
  }
}

function createMatchCard(match) {
  const card = document.createElement('article');
  card.className = 'competition-match-card';

  const result = getResult(match);
  const resultClass = result === 'W'
    ? 'match-result--win'
    : result === 'L'
      ? 'match-result--loss'
      : result === 'D'
        ? 'match-result--draw'
        : 'match-result--upcoming';
  const teamName = getTeamName(match.teamId);
  const opponent = String(match.opponentName || match.opponent || 'Opponent TBD').trim();
  const eventName = String(match.eventName || match.tournamentName || '').trim();
  const score = String(match.score || '').trim();
  const maps = Array.isArray(match.mapsPlayed) ? match.mapsPlayed.filter(Boolean).join(', ') : '';
  const replayCode = String(match.replayCode || '').trim();
  const notes = String(match.notes || '').trim();

  card.innerHTML = `
    <div class="competition-match-card__top">
      <span class="match-result ${resultClass}">${escapeHtml(result)}</span>
      <span>${escapeHtml(formatMatchDate(match.scheduledAt))}</span>
    </div>
    <h3>${escapeHtml(teamName)} vs ${escapeHtml(opponent)}</h3>
    <div class="competition-match-card__meta">
      ${eventName ? `<span>${escapeHtml(eventName)}</span>` : ''}
      ${score ? `<span>Score: ${escapeHtml(score)}</span>` : ''}
      ${maps ? `<span>Maps: ${escapeHtml(maps)}</span>` : ''}
      ${replayCode ? `<span>Replay: ${escapeHtml(replayCode)}</span>` : ''}
    </div>
    ${notes ? `<p>${escapeHtml(notes)}</p>` : ''}
    <a class="competition-match-card__link" href="team.html?team=${encodeURIComponent(match.teamId || '')}">View team history</a>
  `;

  return card;
}

function renderMatches() {
  if (!matchListEl || !matchStatusEl) return;

  const teamId = String(teamFilterEl?.value || '').trim();
  const filtered = teamId
    ? allMatches.filter((match) => String(match.teamId || '').trim() === teamId)
    : allMatches;

  updateMatchTotals(filtered);
  matchListEl.innerHTML = '';

  if (!filtered.length) {
    matchStatusEl.textContent = teamId
      ? `No completed match reports are listed for ${getTeamName(teamId)} yet.`
      : 'No completed match reports are listed yet.';
    return;
  }

  filtered.slice(0, 24).forEach((match) => {
    matchListEl.appendChild(createMatchCard(match));
  });

  matchStatusEl.textContent = `Showing ${Math.min(filtered.length, 24)} of ${filtered.length} completed match report${filtered.length === 1 ? '' : 's'}.`;
}

function renderGameFilterOptions(items) {
  if (!gameFilterEl) return;

  const games = Array.from(new Set(items.map((item) => String(item.game || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const selected = gameFilterEl.value;

  gameFilterEl.innerHTML = '<option value="">All games</option>';
  games.forEach((game) => {
    const option = document.createElement('option');
    option.value = game;
    option.textContent = game;
    gameFilterEl.appendChild(option);
  });

  if (selected && games.includes(selected)) {
    gameFilterEl.value = selected;
  }
}

function renderTournaments() {
  if (!gameFilterEl || !tournamentListEl || !tournamentStatusEl) return;

  const game = String(gameFilterEl.value || '').trim();
  const filtered = game
    ? allTournaments.filter((item) => String(item.game || '').trim() === game)
    : allTournaments;

  updateTournamentTotals(filtered);
  tournamentListEl.innerHTML = '';

  if (!filtered.length) {
    tournamentStatusEl.textContent = 'No event records found for this filter.';
    return;
  }

  filtered.forEach((item) => {
    tournamentListEl.appendChild(createTournamentCard(item, { maxBullets: 2 }));
  });

  tournamentStatusEl.textContent = `Showing ${filtered.length} event record${filtered.length === 1 ? '' : 's'}.`;
}

async function init() {
  renderTeamFilter();

  try {
    matchStatusEl.textContent = 'Loading match reports...';
    allMatches = await listCompletedOfficialMatches({ limit: 200 });
    renderMatches();
  } catch (error) {
    console.error('Failed to load match reports:', error);
    matchStatusEl.textContent = 'Unable to load match reports right now.';
  }

  try {
    tournamentStatusEl.textContent = 'Loading event records...';
    allTournaments = await listPublishedTournaments(200);
    renderGameFilterOptions(allTournaments);
    renderTournaments();
  } catch (error) {
    console.error('Failed to load competition records:', error);
    tournamentStatusEl.textContent = 'Unable to load event records right now.';
  }
}

teamFilterEl?.addEventListener('change', renderMatches);
gameFilterEl?.addEventListener('change', renderTournaments);
init();
