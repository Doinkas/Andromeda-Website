import { TEAM_REGISTRY } from '/js/config/teams.config.js';

const root = document.querySelector('[data-home-team-showcase]');
const featuredTeamIds = ['polaris', 'octantis', 'void'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildTeamHref(team) {
  const href = String(team?.href || '').trim();
  return href.startsWith('pages/') ? href : `pages/${href || 'teams.html'}`;
}

function createTeamCard(team) {
  const article = document.createElement('article');
  article.className = `home-showcase-card theme--${team.id}`;

  const achievement = Array.isArray(team.achievements) && team.achievements.length
    ? team.achievements[0]
    : 'Competitive roster';

  article.innerHTML = `
    <a class="home-showcase-card__link" href="${escapeHtml(buildTeamHref(team))}" aria-label="View ${escapeHtml(team.name)} team page">
      <span class="home-showcase-card__media">
        <img src="${escapeHtml(team.logo)}" alt="${escapeHtml(team.name)} logo" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/images/teams/logos/andro-faceit.png';">
      </span>
      <span class="home-showcase-card__body">
        <span class="home-showcase-card__eyebrow">${escapeHtml(team.region)} / ${escapeHtml(team.tier)}</span>
        <strong>${escapeHtml(team.name)}</strong>
        <span>${escapeHtml(team.summary)}</span>
        <span class="home-showcase-card__achievement">${escapeHtml(achievement)}</span>
      </span>
    </a>
  `;

  return article;
}

function init() {
  if (!root) return;

  const teams = featuredTeamIds
    .map((teamId) => TEAM_REGISTRY[teamId])
    .filter(Boolean);

  root.innerHTML = '';
  teams.forEach((team) => {
    root.appendChild(createTeamCard(team));
  });
}

init();
