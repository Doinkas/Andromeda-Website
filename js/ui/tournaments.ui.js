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

export function formatDateRange(startValue, endValue = null) {
  const startDate = toDate(startValue);
  const endDate = toDate(endValue);

  const format = (date) => date?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) || 'TBD';

  if (!endDate) {
    return format(startDate);
  }

  return `${format(startDate)} - ${format(endDate)}`;
}

export function getTournamentTotals(items = []) {
  return items.reduce((acc, tournament) => {
    const wins = Number(tournament?.record?.wins);
    const losses = Number(tournament?.record?.losses);

    acc.totalTournaments += 1;
    acc.totalWins += Number.isFinite(wins) ? wins : 0;
    acc.totalLosses += Number.isFinite(losses) ? losses : 0;

    const achievementsCount = Array.isArray(tournament?.achievements)
      ? tournament.achievements.length
      : 0;
    acc.totalAchievements += achievementsCount;

    return acc;
  }, {
    totalTournaments: 0,
    totalWins: 0,
    totalLosses: 0,
    totalAchievements: 0
  });
}

function buildBulletItems(items = [], maxItems = 2) {
  const normalized = Array.isArray(items)
    ? items.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return normalized.slice(0, maxItems);
}

function getSafeExternalUrl(value) {
  const url = String(value || '').trim();
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : '';
}

export function createTournamentCard(tournament, { maxBullets = 2 } = {}) {
  const card = document.createElement('article');
  card.className = 'card tournament-card';

  const wins = Number(tournament?.record?.wins);
  const losses = Number(tournament?.record?.losses);
  const safeWins = Number.isFinite(wins) ? wins : 0;
  const safeLosses = Number.isFinite(losses) ? losses : 0;

  const bullets = [
    ...buildBulletItems(tournament?.achievements, maxBullets),
    ...buildBulletItems(tournament?.highlights, maxBullets)
  ].slice(0, maxBullets);

  const placement = String(tournament?.placementText || '').trim();
  const link = getSafeExternalUrl(tournament?.link);

  card.innerHTML = `
    <header class="tournament-card__header">
      <h3>${escapeHtml(tournament?.name || 'Unnamed tournament')}</h3>
      <span class="tournament-card__game">${escapeHtml(tournament?.game || 'Unknown game')}</span>
    </header>
    <p class="tournament-card__meta">${escapeHtml(formatDateRange(tournament?.startDate, tournament?.endDate))}</p>
    <p class="tournament-card__record">Record: <strong>${safeWins}W-${safeLosses}L</strong>${placement ? ` | ${escapeHtml(placement)}` : ''}</p>
    ${bullets.length ? `<ul class="tournament-card__bullets">${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    ${link ? `<p><a href="${escapeHtml(link)}" target="_blank" rel="noopener">External Link</a></p>` : ''}
  `;

  return card;
}

