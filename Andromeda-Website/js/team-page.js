import { getRoster } from '/js/services/rosters.service.js';
import { listMatchesByTeam } from '/js/services/matches.service.js';
import { initPlayerTooltips } from '/js/ui/playerTooltip.ui.js';
import { TEAM_REGISTRY, TEAM_IDS, SCHEDULE_LABEL_TO_TEAM_ID } from '/js/config/teams.config.js';

const VALID_TEAMS = TEAM_IDS;

const TEAM_CONFIG = Object.fromEntries(
  Object.entries(TEAM_REGISTRY).map(([teamId, meta]) => [
    teamId,
    {
      name: meta.name,
      tier: meta.tier,
      banner: meta.banner,
      logo: meta.logo,
      description: meta.description
    }
  ])
);

function getTeamIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const teamId = params.get('team');
  return teamId && VALID_TEAMS.includes(teamId) ? teamId : null;
}

function showError() {
  document.getElementById('team-error').style.display = 'block';
  document.getElementById('team-content').style.display = 'none';
  document.title = 'Team Not Found | Andromeda Esports';
}

function showTeam() {
  document.getElementById('team-error').style.display = 'none';
  document.getElementById('team-content').style.display = 'block';
}

async function loadTeamMetadata(teamId) {
  const base = TEAM_CONFIG[teamId];
  if (!base) return null;

  try {
    const rosterDoc = await getRoster(teamId);
    const profile = rosterDoc?.teamProfile || {};

    const pickText = (value, fallback = '') => {
      const next = String(value || '').trim();
      return next || fallback;
    };

    return {
      ...base,
      name: pickText(profile.displayName, base.name),
      tier: pickText(profile.tier, base.tier),
      description: pickText(profile.description, base.description)
    };
  } catch (_error) {
    return base;
  }
}

function renderTeamHero(teamId, metadata) {
  applyTeamTheme(teamId);

  const heroBanner = document.querySelector('.team-hero__banner');
  heroBanner.style.backgroundImage = buildBannerBackground(metadata.banner);

  document.getElementById('team-logo').src = metadata.logo;
  document.getElementById('team-logo').alt = `${metadata.name} logo`;
  document.getElementById('team-tier').textContent = metadata.tier;
  document.getElementById('team-name').textContent = metadata.name;
  document.title = `${metadata.name} | Andromeda Esports`;

  const descEl = document.getElementById('team-desc');
  if (descEl) descEl.textContent = metadata.description || '';
}

function applyTeamTheme(teamId) {
  document.body.setAttribute('data-team-theme', teamId);
}

function setHeroStatValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function buildBannerBackground(bannerUrl) {
  if (!bannerUrl) {
    return 'none';
  }

  const lowerUrl = bannerUrl.toLowerCase();
  if (lowerUrl.endsWith('.png')) {
    const jpgUrl = bannerUrl.replace(/\.png$/i, '.jpg');
    return `url('${bannerUrl}'), url('${jpgUrl}')`;
  }

  if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) {
    const pngUrl = bannerUrl.replace(/\.jpe?g$/i, '.png');
    return `url('${pngUrl}'), url('${bannerUrl}')`;
  }

  return `url('${bannerUrl}')`;
}

function renderRoster(roster) {
  const loadingEl = document.querySelector('.roster-loading');
  const groupsEl = document.querySelector('.roster-groups');
  const startersListEl = document.querySelector('.roster-list--starters');
  const subsListEl = document.querySelector('.roster-list--subs');
  const startersGroupEl = document.querySelector('.roster-group--starters');
  const subsGroupEl = document.querySelector('.roster-group--subs');
  const emptyEl = document.querySelector('.roster-empty');

  loadingEl.style.display = 'none';

  if (!roster || !roster.players || roster.players.length === 0) {
    emptyEl.style.display = 'block';
    setHeroStatValue('team-stat-roster', '0 Players');
    return;
  }

  const normalizedPlayers = roster.players.map((player, index) => {
    const lineup = String(player?.lineup || '').toLowerCase().trim();
    return {
      ...player,
      lineup: lineup === 'starter' || lineup === 'sub' ? lineup : (index < 5 ? 'starter' : 'sub')
    };
  });

  const starters = normalizedPlayers.filter((player) => player.lineup === 'starter');
  const subs = normalizedPlayers.filter((player) => player.lineup === 'sub');

  startersListEl.innerHTML = '';
  subsListEl.innerHTML = '';

  const renderPlayer = (listEl, player) => {
    const li = document.createElement('li');
    li.className = 'roster-player';

    // Attach player data for tooltip initialization
    li.setAttribute('data-player-name', player.name);
    li.setAttribute('data-player-profile', JSON.stringify(player.profile || {}));

    const playerName = document.createElement('span');
    playerName.className = 'player-name-inline';
    playerName.textContent = player.name;
    li.appendChild(playerName);

    if (player.roles && player.roles.length) {
      li.appendChild(document.createTextNode(' '));
      const rolesSpan = document.createElement('span');
      rolesSpan.className = 'player-roles-inline';

      player.roles.forEach((role) => {
        const roleTag = document.createElement('span');
        const roleValue = String(role || '').toLowerCase();
        roleTag.className = `role-tag role-tag--${roleValue}`;
        roleTag.textContent = roleValue.toUpperCase();
        rolesSpan.appendChild(roleTag);
        rolesSpan.appendChild(document.createTextNode(' '));
      });

      li.appendChild(rolesSpan);
    }

    listEl.appendChild(li);
  };

  starters.forEach((player) => renderPlayer(startersListEl, player));
  subs.forEach((player) => renderPlayer(subsListEl, player));

  startersGroupEl.style.display = starters.length ? 'block' : 'none';
  subsGroupEl.style.display = subs.length ? 'block' : 'none';

  groupsEl.style.display = 'grid';
  if (subs.length) {
    setHeroStatValue('team-stat-roster', `${starters.length} + ${subs.length}`);
  } else {
    setHeroStatValue('team-stat-roster', `${starters.length} Players`);
  }

  // Initialize player tooltips
  initPlayerTooltips();
}

function formatMatchDate(timestamp) {
  if (!timestamp) return 'TBD';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function renderMatches(listEl, matches) {
  listEl.innerHTML = '';

  matches.forEach((match) => {
    const li = document.createElement('li');
    li.className = 'schedule-match';

    const topRow = document.createElement('div');
    topRow.className = 'match-row';

    const strong = document.createElement('span');
    strong.className = 'match-result';
    const result = String(match.result || '').trim().toUpperCase();
    if (result === 'W' || result === 'L') {
      strong.textContent = result;
      strong.classList.add(result === 'W' ? 'match-result--win' : 'match-result--loss');
    } else {
      strong.textContent = 'UPCOMING';
      strong.classList.add('match-result--upcoming');
    }

    const opponentStrong = document.createElement('strong');
    opponentStrong.className = 'match-opponent';
    opponentStrong.textContent = `vs ${match.opponent || 'TBD'}`;

    topRow.appendChild(strong);
    topRow.appendChild(opponentStrong);

    const metaRow = document.createElement('div');
    metaRow.className = 'match-meta';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'match-date';
    dateSpan.textContent = formatMatchDate(match.scheduledAt);

    metaRow.appendChild(dateSpan);
    li.appendChild(topRow);
    li.appendChild(metaRow);

    listEl.appendChild(li);
  });

  listEl.style.display = 'block';
}

function renderUpcomingSchedule(matches) {
  const loadingEl = document.getElementById('upcoming-loading');
  const listEl = document.getElementById('upcoming-matches-list');
  const emptyEl = document.getElementById('upcoming-empty');

  if (!loadingEl || !listEl || !emptyEl) return;

  loadingEl.style.display = 'none';
  listEl.style.display = 'none';
  emptyEl.style.display = 'none';

  if (!matches || matches.length === 0) {
    emptyEl.style.display = 'block';
    setHeroStatValue('team-stat-upcoming', 'No Upcoming');
    return;
  }

  renderMatches(listEl, matches);
  setHeroStatValue('team-stat-upcoming', `${matches.length} Upcoming`);
}

function renderRecentMatches(matches) {
  const loadingEl = document.getElementById('recent-loading');
  const listEl = document.getElementById('recent-matches-list');
  const emptyEl = document.getElementById('recent-empty');

  if (!loadingEl || !listEl || !emptyEl) return;

  loadingEl.style.display = 'none';
  listEl.style.display = 'none';
  emptyEl.style.display = 'none';

  if (!matches || matches.length === 0) {
    emptyEl.style.display = 'block';
    setHeroStatValue('team-stat-recent', 'No Recent');
    return;
  }

  renderMatches(listEl, matches);
  setHeroStatValue('team-stat-recent', `${matches.length} Recent`);
}

function parseScheduleTeamLabel(rawTeamCell) {
  const text = String(rawTeamCell || '').trim();
  const colonIndex = text.indexOf(':');
  if (colonIndex === -1) return null;
  const label = text.slice(colonIndex + 1).trim().toUpperCase();
  return SCHEDULE_LABEL_TO_TEAM_ID[label] || null;
}

function parseScheduleDateTime(rawDateCell) {
  const text = String(rawDateCell || '').trim().toUpperCase();
  const match = text.match(/^(SUN|MON|TUE|WED|THUR|FRI|SAT)\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*EST$/);
  if (!match) return null;

  const [, weekdayToken, hourText, minuteText, meridiem] = match;
  let hours = Number(hourText);
  const minutes = Number(minuteText);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];
  const targetWeekday = weekdays.indexOf(weekdayToken);
  if (targetWeekday < 0) return null;

  const now = new Date();
  const nextDate = new Date(now);
  nextDate.setSeconds(0, 0);
  nextDate.setHours(hours, minutes, 0, 0);

  const currentWeekday = nextDate.getDay();
  let deltaDays = targetWeekday - currentWeekday;
  if (deltaDays < 0 || (deltaDays === 0 && nextDate.getTime() < now.getTime())) {
    deltaDays += 7;
  }
  nextDate.setDate(nextDate.getDate() + deltaDays);

  return nextDate;
}

async function loadUpcomingFromPublicSchedule(teamId, limit = 5) {
  try {
    const response = await fetch('/pages/schedule.html', { cache: 'no-store' });
    if (!response.ok) return [];

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('.schedule-week tbody tr'));

    const now = Date.now();
    const items = rows
      .map((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return null;

        const mappedTeamId = parseScheduleTeamLabel(cells[1]?.textContent || '');
        if (mappedTeamId !== teamId) return null;

        const date = parseScheduleDateTime(cells[0]?.textContent || '');
        if (!date || Number.isNaN(date.getTime()) || date.getTime() < now) return null;

        const opponent = String(cells[2]?.textContent || '').trim();
        if (!opponent || opponent.toUpperCase() === 'BYE') return null;

        return {
          opponent,
          opponentName: opponent,
          scheduledAt: date,
          type: 'official',
          source: 'schedule.html'
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.scheduledAt instanceof Date ? a.scheduledAt.getTime() : new Date(a.scheduledAt).getTime();
        const bTime = b.scheduledAt instanceof Date ? b.scheduledAt.getTime() : new Date(b.scheduledAt).getTime();
        return aTime - bTime;
      });

    return items.slice(0, limit);
  } catch (error) {
    console.error('Schedule HTML fallback failed:', error);
    return [];
  }
}

async function loadTeamSchedule(teamId) {
  const upcomingLoadingEl = document.getElementById('upcoming-loading');
  const upcomingListEl = document.getElementById('upcoming-matches-list');
  const upcomingEmptyEl = document.getElementById('upcoming-empty');
  const recentLoadingEl = document.getElementById('recent-loading');
  const recentListEl = document.getElementById('recent-matches-list');
  const recentEmptyEl = document.getElementById('recent-empty');

  if (upcomingLoadingEl) upcomingLoadingEl.style.display = 'block';
  if (upcomingListEl) upcomingListEl.style.display = 'none';
  if (upcomingEmptyEl) upcomingEmptyEl.style.display = 'none';

  if (recentLoadingEl) recentLoadingEl.style.display = 'block';
  if (recentListEl) recentListEl.style.display = 'none';
  if (recentEmptyEl) recentEmptyEl.style.display = 'none';

  let upcoming = await listMatchesByTeam(teamId, { limit: 5, upcomingOnly: true });
  if (!upcoming.length) {
    upcoming = await loadUpcomingFromPublicSchedule(teamId, 5);
  }
  renderUpcomingSchedule(upcoming);

  const now = Date.now();
  const recent = (await listMatchesByTeam(teamId, { limit: 50, upcomingOnly: false }))
    .filter((match) => {
      const date = match.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match.scheduledAt);
      return !Number.isNaN(date.getTime()) && date.getTime() < now;
    })
    .sort((a, b) => {
      const aDate = a.scheduledAt?.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
      const bDate = b.scheduledAt?.toDate ? b.scheduledAt.toDate() : new Date(b.scheduledAt);
      const aTime = Number.isNaN(aDate.getTime()) ? 0 : aDate.getTime();
      const bTime = Number.isNaN(bDate.getTime()) ? 0 : bDate.getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  renderRecentMatches(recent);
}

function setRecentMatchesLink(teamId) {
  const viewAllLink = document.getElementById('view-all-scrims-link');

  if (viewAllLink) {
    viewAllLink.href = `scrims.html?teamId=${encodeURIComponent(teamId)}`;
  }
}

async function init() {
  const teamId = getTeamIdFromUrl();

  if (!teamId) {
    showError();
    return;
  }

  showTeam();
  setHeroStatValue('team-stat-roster', '...');
  setHeroStatValue('team-stat-upcoming', '...');
  setHeroStatValue('team-stat-recent', '...');

  try {
    const metadata = await loadTeamMetadata(teamId);
    renderTeamHero(teamId, metadata);

    // Load roster
    getRoster(teamId)
      .then(renderRoster)
      .catch((err) => {
        console.error('Failed to load roster:', err);
        document.querySelector('.roster-loading').textContent = 'Error loading roster.';
      });

    setRecentMatchesLink(teamId);

    // Load schedule and recent official matches into separate sections
    loadTeamSchedule(teamId)
      .catch((err) => {
        console.error('Failed to load matches:', err);
        const upcomingLoadingEl = document.getElementById('upcoming-loading');
        const recentLoadingEl = document.getElementById('recent-loading');
        if (upcomingLoadingEl) upcomingLoadingEl.textContent = 'Error loading matches.';
        if (recentLoadingEl) recentLoadingEl.textContent = 'Error loading matches.';
      });
  } catch (err) {
    console.error('Failed to initialize team page:', err);
    showError();
  }
}

init();
