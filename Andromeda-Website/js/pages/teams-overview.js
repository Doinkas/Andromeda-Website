import { getRoster } from '/js/services/rosters.service.js';
import { listMatchesByTeam } from '/js/services/matches.service.js';
import { TEAM_REGISTRY } from '/js/config/teams.config.js';

const TEAM_OVERVIEW_BASE = Object.fromEntries(
  Object.entries(TEAM_REGISTRY).map(([teamId, team]) => [
    teamId,
    {
      name: team.name,
      tier: team.tier,
      region: team.region,
      rating: team.rating,
      summary: team.summary,
      highlights: Array.isArray(team.highlights) ? [...team.highlights] : [],
      staff: {
        manager: team.staff?.manager || 'TBD',
        coaches: team.staff?.coaches || 'TBD',
        captain: team.staff?.captain || 'TBD'
      },
      achievements: Array.isArray(team.achievements) ? [...team.achievements] : [],
      href: team.href
    }
  ])
);

const root = document.querySelector('[data-module="teams-accordion"]');

if (!root) {
  // no-op outside teams page
} else {
  const teamContextCache = new Map();
  const OVERVIEW_OPEN_MS = 220;
  const OVERVIEW_CLOSE_MS = 180;

  root.querySelectorAll('.division-panel__body').forEach((body) => {
    const cards = Array.from(body.querySelectorAll('.division-team-card[data-team-id]'));
    if (!cards.length) {
      return;
    }

    const panel = document.createElement('section');
    panel.className = 'team-overview';
    panel.setAttribute('aria-live', 'polite');
    panel.hidden = true;

    const grid = body.querySelector('.division-team-grid');
    if (grid) {
      grid.insertAdjacentElement('afterend', panel);
    } else {
      body.appendChild(panel);
    }

    cards.forEach((card) => {
      const teamId = card.dataset.teamId;
      const meta = TEAM_OVERVIEW_BASE[teamId];
      if (!teamId || !meta) {
        return;
      }

      card.classList.add('is-selectable');
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `Show quick overview for ${meta.name}`);
      ensureCardProfileLink(card, meta);

      getTeamContext(teamId).then((context) => {
        if (!context) return;
        hydrateCard(card, context.meta);
      });

      card.addEventListener('mouseenter', () => {
        card.classList.add('is-hovered');
      });

      card.addEventListener('mouseleave', () => {
        card.classList.remove('is-hovered');
      });

      card.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) {
          return;
        }

        if (card.classList.contains('is-selected') && !panel.hidden) {
          hideOverview(body, panel);
          return;
        }

        showOverview(body, panel, teamId);
      });

      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();

          if (card.classList.contains('is-selected') && !panel.hidden) {
            hideOverview(body, panel);
            return;
          }

          showOverview(body, panel, teamId);
        }
      });
    });
  });

  async function showOverview(body, panel, teamId) {
    const context = await getTeamContext(teamId);
    if (!context) {
      return;
    }
    const { meta, roster } = context;

    const selectedCards = body.querySelectorAll('.division-team-card[data-team-id]');
    let selectedCard = null;
    selectedCards.forEach((card) => {
      const isActive = card.dataset.teamId === teamId;
      card.classList.toggle('is-selected', isActive);
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) {
        selectedCard = card;
      }
    });

    syncPanelTheme(panel, selectedCard);

    panel.hidden = false;
    panel.classList.add('is-visible');
    panel.innerHTML = buildLoadingMarkup(meta);
    animatePanelOpen(panel);

    const [nextMatchText, matchCount] = await Promise.all([
      getNextMatchText(teamId),
      getUpcomingMatchCount(teamId)
    ]);

    const markup = buildOverviewMarkup(meta, roster, nextMatchText, matchCount);
    panel.innerHTML = markup;
  }

  function hideOverview(body, panel) {
    const selectedCards = body.querySelectorAll('.division-team-card[data-team-id]');
    selectedCards.forEach((card) => {
      card.classList.remove('is-selected');
      card.setAttribute('aria-pressed', 'false');
    });

    animatePanelClose(panel);
  }

  async function getTeamContext(teamId) {
    if (teamContextCache.has(teamId)) {
      return teamContextCache.get(teamId);
    }

    const baseMeta = TEAM_OVERVIEW_BASE[teamId];
    if (!baseMeta) {
      return null;
    }

    const roster = await getRosterSafe(teamId);
    const meta = buildMeta(baseMeta, roster?.teamProfile || {});
    const context = { meta, roster };
    teamContextCache.set(teamId, context);
    return context;
  }

  function hydrateCard(card, meta) {
    const badge = card.querySelector('.tier-badge');
    const title = card.querySelector('h3');
    const desc = card.querySelector('.division-team-card__content p.muted');
    const content = card.querySelector('.division-team-card__content');

    if (badge) {
      badge.textContent = meta.tier;
    }

    if (title) {
      title.textContent = meta.name;
    }

    const previewText = String(meta.summary || '').trim();
    if (!previewText || !content) {
      return;
    }

    if (desc) {
      desc.textContent = previewText;
      ensureCardProfileLink(card, meta);
      return;
    }

    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = previewText;
    content.appendChild(p);
    ensureCardProfileLink(card, meta);
  }

  function ensureCardProfileLink(card, meta) {
    const content = card.querySelector('.division-team-card__content');
    if (!content || !meta?.href) return;

    let link = content.querySelector('.division-team-card__action');
    if (!link) {
      link = document.createElement('a');
      link.className = 'division-team-card__action';
      link.textContent = 'Open Profile';
      content.appendChild(link);
    }

    link.href = meta.href;
    link.setAttribute('aria-label', `Open ${meta.name} profile`);
  }

  function animatePanelOpen(panel) {
    if (typeof panel.animate !== 'function') {
      return;
    }

    panel.__overviewAnimation?.cancel?.();
    panel.__overviewAnimation = panel.animate(
      [
        { opacity: 0, transform: 'translateY(-6px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: OVERVIEW_OPEN_MS, easing: 'ease' }
    );
  }

  function animatePanelClose(panel) {
    if (typeof panel.animate !== 'function') {
      panel.hidden = true;
      panel.classList.remove('is-visible');
      panel.innerHTML = '';
      return;
    }

    panel.__overviewAnimation?.cancel?.();
    const animation = panel.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-6px)' }
      ],
      { duration: OVERVIEW_CLOSE_MS, easing: 'ease' }
    );

    panel.__overviewAnimation = animation;
    animation.onfinish = () => {
      panel.hidden = true;
      panel.classList.remove('is-visible');
      panel.innerHTML = '';
      panel.__overviewAnimation = null;
    };
  }

  function syncPanelTheme(panel, selectedCard) {
    panel.classList.remove('theme--horizon', 'theme--spiral', 'theme--proxima', 'theme--comet', 'theme--supernova', 'theme--void', 'theme--faceit', 'theme--polaris');
    if (!selectedCard) return;

    const themeClass = Array.from(selectedCard.classList).find((name) => name.startsWith('theme--'));
    if (themeClass) {
      panel.classList.add(themeClass);
    }
  }

  function buildMeta(baseMeta, teamProfile) {
    const toText = (value, fallback = '') => {
      const text = String(value || '').trim();
      return text || fallback;
    };
    const toList = (value, fallback = []) => {
      if (Array.isArray(value)) {
        const next = value.map((item) => String(item || '').trim()).filter(Boolean);
        return next.length ? next : fallback;
      }
      if (typeof value === 'string') {
        const next = value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
        return next.length ? next : fallback;
      }
      return fallback;
    };

    return {
      ...baseMeta,
      name: toText(teamProfile.displayName, baseMeta.name),
      tier: toText(teamProfile.tier, baseMeta.tier),
      region: toText(teamProfile.region, baseMeta.region),
      rating: toText(teamProfile.rating, baseMeta.rating),
      summary: toText(teamProfile.description, baseMeta.summary),
      staff: {
        manager: toText(teamProfile.manager, baseMeta.staff?.manager || 'TBD'),
        coaches: toText(teamProfile.coaches, baseMeta.staff?.coaches || 'TBD'),
        captain: toText(teamProfile.captain, baseMeta.staff?.captain || 'TBD')
      },
      highlights: toList(teamProfile.highlights, baseMeta.highlights || []),
      achievements: toList(teamProfile.achievements, baseMeta.achievements || [])
    };
  }

  function buildLoadingMarkup(meta) {
    return `
      <div class="team-overview__head">
        <p class="team-overview__tier">${meta.tier}</p>
        <h3>${meta.name}</h3>
      </div>
      <div class="team-overview__chips">
        <span class="team-overview__chip">${meta.region}</span>
        <span class="team-overview__chip">${meta.rating}</span>
      </div>
      <p class="team-overview__summary">Loading quick overview...</p>
    `;
  }

  function buildOverviewMarkup(meta, roster, nextMatchText, matchCount) {
    const players = Array.isArray(roster?.players) ? roster.players : [];
    const rosterCount = players.length;
    const highlights = (meta.highlights || [])
      .map((item) => `<span class="team-overview__chip">${escapeHtml(item)}</span>`)
      .join('');

    const playersMarkup = buildPlayersMarkup(players);
    const staff = meta.staff || {};

    return `
      <div class="team-overview__head">
        <p class="team-overview__tier">${escapeHtml(meta.tier)}</p>
        <h3>${escapeHtml(meta.name)}</h3>
      </div>
      <div class="team-overview__chips">
        <span class="team-overview__chip">${escapeHtml(meta.region)}</span>
        <span class="team-overview__chip">${escapeHtml(meta.rating)}</span>
      </div>
      <p class="team-overview__summary">${escapeHtml(meta.summary)}</p>
      <div class="team-overview__stats">
        <span><strong>${rosterCount}</strong> players</span>
        <span><strong>${matchCount}</strong> upcoming</span>
        <span><strong>Next:</strong> ${escapeHtml(nextMatchText)}</span>
      </div>
      <div class="team-overview__split">
        <section class="team-overview__section">
          <h4>Staff</h4>
          <dl class="team-overview__staff">
            <div><dt>Manager</dt><dd>${escapeHtml(staff.manager || 'TBD')}</dd></div>
            <div><dt>Coaches</dt><dd>${escapeHtml(staff.coaches || 'TBD')}</dd></div>
            <div><dt>Captain</dt><dd>${escapeHtml(staff.captain || 'TBD')}</dd></div>
          </dl>
        </section>
        <section class="team-overview__section">
          <h4>Players ${rosterCount ? `(${rosterCount})` : ''}</h4>
          <ul class="team-overview__players">${playersMarkup}</ul>
        </section>
      </div>
      ${highlights ? `<div class="team-overview__chips">${highlights}</div>` : ''}
      <div class="team-overview__actions">
        <a class="btn primary" href="${meta.href}">Open ${escapeHtml(meta.name)} Profile</a>
      </div>
    `;
  }

  function buildPlayersMarkup(players) {
    if (!players.length) {
      return '<li class="team-overview__empty">Roster publishing soon</li>';
    }

    return players
      .slice(0, 8)
      .map((player) => {
        const name = escapeHtml(player?.name || 'Player');
        const primaryRole = Array.isArray(player?.roles) && player.roles.length
          ? String(player.roles[0]).toUpperCase()
          : 'PLAYER';

        return `<li><span>${name}</span><em>${escapeHtml(primaryRole)}</em></li>`;
      })
      .join('');
  }

  async function getRosterSafe(teamId) {
    try {
      return await getRoster(teamId);
    } catch (_error) {
      return { players: [] };
    }
  }

  async function getNextMatchText(teamId) {
    try {
      const matches = await listMatchesByTeam(teamId, { limit: 1, upcomingOnly: true });
      const next = matches[0];
      if (!next) {
        return 'No upcoming match listed';
      }
      const opponent = String(next.opponent || next.opponentName || 'TBD').trim();
      const date = formatMatchDate(next.scheduledAt);
      return `${opponent} (${date})`;
    } catch (_error) {
      return 'Schedule unavailable';
    }
  }

  async function getUpcomingMatchCount(teamId) {
    try {
      const matches = await listMatchesByTeam(teamId, { limit: 12, upcomingOnly: true });
      return Array.isArray(matches) ? matches.length : 0;
    } catch (_error) {
      return 0;
    }
  }

  function formatMatchDate(value) {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'TBD';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
