import { TEAM_IDS, TEAM_REGISTRY } from '/js/config/teams.config.js';
import { getRoster } from '/js/services/rosters.service.js';

const root = document.querySelector('[data-module="teams-directory"]');

if (!root) {
  // no-op outside teams page
} else {
  const grid = root.querySelector('#teams-directory-grid');
  const countEl = root.querySelector('#teams-directory-count');
  const filterButtons = Array.from(root.querySelectorAll('[data-team-filter]'));
  const rosterCache = new Map();
  const displayOrder = ['horizon', 'spiral', 'proxima', 'comet', 'supernova', 'polaris', 'octantis', 'void'];
  const teams = displayOrder
    .concat(TEAM_IDS.filter((teamId) => !displayOrder.includes(teamId)))
    .map((teamId) => TEAM_REGISTRY[teamId])
    .filter(Boolean);

  renderDirectory(teams);
  setFilter('all');

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setFilter(button.dataset.teamFilter || 'all');
    });
  });

  function renderDirectory(items) {
    if (!grid) return;

    grid.innerHTML = '';
    items.forEach((team) => {
      const card = createTeamCard(team);
      grid.appendChild(card);
    });
  }

  function createTeamCard(team) {
    const article = document.createElement('article');
    article.className = `team-directory-card theme--${team.id}`;
    article.dataset.teamId = team.id;
    article.dataset.teamDivision = team.division || 'main';

    article.innerHTML = `
      <a class="team-directory-card__link" href="${escapeHtml(team.href || `team.html?team=${team.id}`)}" aria-label="Open ${escapeHtml(team.name)} team profile">
        <span class="team-directory-card__surface">
          <span class="team-directory-card__glow" aria-hidden="true"></span>
          <span class="team-directory-card__logo-wrap">
            <img class="team-directory-card__logo" src="${escapeHtml(team.logo)}" alt="${escapeHtml(team.name)} logo" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/images/teams/logos/andro-faceit.png';">
          </span>
          <span class="team-directory-card__name">${escapeHtml(team.name)}</span>
          <span class="team-directory-card__badge">${escapeHtml(team.tier || team.division || 'Team')}</span>
        </span>
        <span class="team-directory-popout" data-team-popout>
          ${buildPopoutMarkup(team, null, true)}
        </span>
      </a>
    `;

    const prepareCard = () => {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      placePopout(article);
      if (article.dataset.hydrated === 'true') return;
      void hydrateCard(team.id, article);
    };

    article.addEventListener('pointerenter', prepareCard);
    article.addEventListener('focusin', prepareCard);

    return article;
  }

  function placePopout(card) {
    const rect = card.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const gridCenter = gridRect ? gridRect.left + (gridRect.width / 2) : window.innerWidth / 2;
    const cardCenter = rect.left + (rect.width / 2);
    const prefersLeft = cardCenter < gridCenter;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;
    const shouldOpenLeft = prefersLeft ? spaceLeft > 390 : spaceRight < 390 && spaceLeft > 390;
    const shouldAnchorBottom = rect.top > window.innerHeight * 0.42;
    card.classList.toggle('is-popout-left', shouldOpenLeft);
    card.classList.toggle('is-popout-high', shouldAnchorBottom);
  }

  async function hydrateCard(teamId, card) {
    if (!teamId || !card || card.dataset.hydrated === 'true') return;
    card.dataset.hydrated = 'true';

    const team = TEAM_REGISTRY[teamId];
    if (!team) return;

    const popout = card.querySelector('[data-team-popout]');
    if (!popout) return;

    const roster = await getRosterSafe(teamId);
    const meta = mergeRosterProfile(team, roster?.teamProfile || {});
    const players = Array.isArray(roster?.players) ? roster.players : [];
    popout.innerHTML = buildPopoutMarkup(meta, players, false);

    const link = card.querySelector('.team-directory-card__link');
    if (link) {
      link.setAttribute('aria-label', `Open ${meta.name} team profile`);
    }

    const name = card.querySelector('.team-directory-card__name');
    if (name) {
      name.textContent = meta.name || team.name;
    }

    const badge = card.querySelector('.team-directory-card__badge');
    if (badge) badge.textContent = meta.tier || team.tier || 'Team';
  }

  function setFilter(filter) {
    filterButtons.forEach((button) => {
      const isActive = (button.dataset.teamFilter || 'all') === filter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const cards = Array.from(root.querySelectorAll('.team-directory-card'));
    let visibleCount = 0;

    cards.forEach((card) => {
      const division = card.dataset.teamDivision || 'main';
      const isVisible = filter === 'all' || division === filter;
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    if (countEl) {
      const label = filter === 'all' ? 'active teams' : `${filter.toUpperCase()} teams`;
      countEl.textContent = `${visibleCount} ${label}`;
    }
  }

  function mergeRosterProfile(team, profile) {
    const toText = (value, fallback = '') => {
      const text = String(value || '').trim();
      return text || fallback;
    };

    return {
      ...team,
      name: toText(profile.displayName, team.name),
      tier: toText(profile.tier, team.tier),
      region: toText(profile.region, team.region),
      rating: toText(profile.rating, team.rating),
      summary: toText(profile.description, team.summary),
      staff: {
        manager: toText(profile.manager, team.staff?.manager || 'TBD'),
        coaches: toText(profile.coaches, team.staff?.coaches || 'TBD'),
        captain: toText(profile.captain, team.staff?.captain || 'TBD')
      }
    };
  }

  function buildPopoutMarkup(team, players, isLoading) {
    const rosterPlayers = Array.isArray(players) ? players : [];
    const staff = team.staff || {};
    const startingPlayers = getStartingPlayers(rosterPlayers);
    const playerRows = isLoading
      ? '<li class="team-directory-popout__empty">Loading roster...</li>'
      : buildPlayersMarkup(startingPlayers);

    return `
      <span class="team-directory-popout__topline">
        <strong>${escapeHtml(team.name)}</strong>
        <span>${escapeHtml(team.region || 'NA')}</span>
        <span>${escapeHtml(team.rating || team.tier || 'Team')}</span>
      </span>
      <span class="team-directory-popout__summary">${escapeHtml(team.summary || 'Roster details publishing soon.')}</span>
      <span class="team-directory-popout__section">
        <span class="team-directory-popout__heading">Coach</span>
        <span class="team-directory-popout__staff"><em>Coach</em><strong>${escapeHtml(staff.coaches || 'TBD')}</strong></span>
      </span>
      <span class="team-directory-popout__section">
        <span class="team-directory-popout__heading">Starting Five</span>
        <ul class="team-directory-popout__players">${playerRows}</ul>
      </span>
      <span class="team-directory-popout__cta">Click the team card to view full details -&gt;</span>
    `;
  }

  function getStartingPlayers(players) {
    const activePlayers = players.filter((player) => {
      const roles = Array.isArray(player?.roles) ? player.roles : [];
      const roleText = roles.join(' ').toLowerCase();
      return !/(coach|manager|staff|sub|substitute)/.test(roleText);
    });

    const starters = activePlayers.filter((player) => String(player?.lineup || '').toLowerCase() === 'starter');
    const pool = starters.length >= 5 ? starters : activePlayers;
    const selected = [];
    const selectedNames = new Set();
    const roleSlots = ['tank', 'dps', 'dps', 'support', 'support'];

    roleSlots.forEach((role) => {
      const player = pool.find((candidate) => {
        const name = String(candidate?.name || '').trim().toLowerCase();
        if (!name || selectedNames.has(name)) return false;
        return getPlayerRoles(candidate).includes(role);
      });

      if (!player) return;
      selected.push({ player, role });
      selectedNames.add(String(player.name || '').trim().toLowerCase());
    });

    if (selected.length < 5) {
      pool.forEach((player) => {
        if (selected.length >= 5) return;
        const name = String(player?.name || '').trim().toLowerCase();
        if (!name || selectedNames.has(name)) return;
        selected.push({ player, role: getPlayerRoles(player)[0] || 'player' });
        selectedNames.add(name);
      });
    }

    return selected.slice(0, 5);
  }

  function buildPlayersMarkup(players) {
    if (!players.length) {
      return '<li class="team-directory-popout__empty">Roster publishing soon</li>';
    }

    return players
      .slice(0, 5)
      .map((entry) => {
        const player = entry?.player || entry;
        const role = entry?.role || getPlayerRoles(player)[0] || 'player';
        return `
          <li>
            <span>${escapeHtml(player?.name || 'Player')}</span>
            <em>${escapeHtml(role.toUpperCase())}</em>
          </li>
        `;
      })
      .join('');
  }

  function getPlayerRoles(player) {
    return (Array.isArray(player?.roles) ? player.roles : [])
      .map((role) => String(role || '').trim().toLowerCase())
      .filter(Boolean);
  }

  async function getRosterSafe(teamId) {
    if (rosterCache.has(teamId)) {
      return rosterCache.get(teamId);
    }

    try {
      const roster = await getRoster(teamId);
      rosterCache.set(teamId, roster);
      return roster;
    } catch (_error) {
      const fallback = { players: [] };
      rosterCache.set(teamId, fallback);
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
