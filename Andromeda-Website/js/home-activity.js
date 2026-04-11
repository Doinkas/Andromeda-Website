import { listRecentOfficialMatches } from '/js/services/matches.service.js';
import { listRecentNews } from '/js/services/news.service.js';

const root = document.querySelector('[data-module="recent-activity"]');

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown date';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderMatchList(items, container) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<li class="muted">No official matches posted yet.</li>';
    return;
  }

  items.forEach((match) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="pages/scrims.html?teamId=${encodeURIComponent(match.teamId || '')}">
        <strong>${match.teamName || match.teamId || 'Team'}</strong> vs ${match.opponentName || match.opponent || 'Opponent'}
      </a>
      <span class="activity-meta">
        <span class="result-badge result-badge--${String(match.result || '').toLowerCase()}">${match.result || '-'}</span>
        <span>${formatDate(match.createdAt || match.scheduledAt)}</span>
      </span>
    `;
    container.appendChild(li);
  });
}

function renderNewsList(items, container) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<li class="muted">No news posts yet.</li>';
    return;
  }

  items.forEach((news) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${news.title || 'Untitled update'}</strong>
      <span class="activity-meta">${formatDate(news.createdAt)}</span>
    `;
    container.appendChild(li);
  });
}

async function init() {
  if (!root) return;

  const scrimsList = root.querySelector('[data-activity-scrims]');
  const newsList = root.querySelector('[data-activity-news]');

  try {
    const [matches, news] = await Promise.all([
      listRecentOfficialMatches({ limit: 3 }),
      listRecentNews({ limit: 2 })
    ]);

    renderMatchList(matches, scrimsList);
    renderNewsList(news, newsList);
  } catch (error) {
    console.error('Failed to load recent activity:', error);
    if (scrimsList) scrimsList.innerHTML = '<li class="muted">Unable to load matches.</li>';
    if (newsList) newsList.innerHTML = '<li class="muted">Unable to load news.</li>';
  }
}

init();
