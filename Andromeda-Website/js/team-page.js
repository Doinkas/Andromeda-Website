import { getRoster } from '/js/services/rosters.service.js';
import { listMatchesByTeam } from '/js/services/matches.service.js';
import { TEAM_REGISTRY, TEAM_IDS, SCHEDULE_LABEL_TO_TEAM_ID } from '/js/config/teams.config.js';

const VALID_TEAMS = TEAM_IDS;
const matchCenterState = {
  matches: [],
  calendarDate: new Date(),
  selectedDateKey: null
};

const TEAM_CONFIG = Object.fromEntries(
  Object.entries(TEAM_REGISTRY).map(([teamId, meta]) => [
    teamId,
    {
      name: meta.name,
      tier: meta.tier,
      region: meta.region,
      rating: meta.rating,
      banner: meta.banner,
      logo: meta.logo,
      description: meta.description,
      manager: meta.staff?.manager || 'TBD',
      coaches: meta.staff?.coaches || 'TBD',
      captain: meta.staff?.captain || 'TBD',
      highlights: Array.isArray(meta.highlights) ? meta.highlights : [],
      achievements: Array.isArray(meta.achievements) ? meta.achievements : []
    }
  ])
);

function pickText(value, fallback = '') {
  const next = String(value || '').trim();
  return next || fallback;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getSafeHttpUrl(value) {
  const url = String(value || '').trim();
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : '';
}

function pickList(value, fallback = []) {
  if (Array.isArray(value) && value.length) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return Array.isArray(fallback) ? fallback : [];
}

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
  if (!base) return { metadata: null, roster: null, rosterError: null };

  try {
    const rosterDoc = await getRoster(teamId);
    const profile = rosterDoc?.teamProfile || {};

    return {
      metadata: {
        ...base,
        name: pickText(profile.displayName, base.name),
        tier: pickText(profile.tier, base.tier),
        region: pickText(profile.region, base.region),
        rating: pickText(profile.rating, base.rating),
        description: pickText(profile.description, base.description),
        manager: pickText(profile.manager, base.manager),
        coaches: pickText(profile.coaches, base.coaches),
        captain: pickText(profile.captain, base.captain),
        highlights: pickList(profile.highlights, base.highlights),
        achievements: pickList(profile.achievements, base.achievements)
      },
      roster: rosterDoc,
      rosterError: null
    };
  } catch (error) {
    return { metadata: base, roster: null, rosterError: error };
  }
}

function renderTeamHero(teamId, metadata) {
  applyTeamTheme(teamId);

  const heroBanner = document.querySelector('.team-hero__banner');
  heroBanner.style.setProperty('--team-banner-image', buildBannerBackground(metadata.banner));

  document.getElementById('team-logo').src = metadata.logo;
  document.getElementById('team-logo').alt = `${metadata.name} logo`;
  document.getElementById('team-tier').textContent = metadata.tier;
  document.getElementById('team-name').textContent = metadata.name;
  document.title = `${metadata.name} | Andromeda Esports`;

  const descEl = document.getElementById('team-desc');
  if (descEl) descEl.textContent = metadata.description || '';

  const upcomingEmptyEl = document.getElementById('upcoming-empty');
  if (upcomingEmptyEl) {
    upcomingEmptyEl.textContent = `No upcoming matches are currently listed for ${metadata.name}.`;
  }

  const recentEmptyEl = document.getElementById('recent-empty');
  if (recentEmptyEl) {
    recentEmptyEl.textContent = `No recent official matches are listed for ${metadata.name} yet.`;
  }

  setIdentityField('team-region', metadata.region || 'NA');
  setIdentityField('team-rating', metadata.rating || 'Development');
  setIdentityField('team-manager', metadata.manager || 'TBD');
  setIdentityField('team-coaches', metadata.coaches || 'TBD');
  setIdentityField('team-captain', metadata.captain || 'TBD');
  renderIdentityList('team-achievements-list', metadata.achievements || [], 'team-achievements-card');
}

function setIdentityField(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderIdentityList(listId, items, cardId) {
  const listEl = document.getElementById(listId);
  const cardEl = document.getElementById(cardId);
  if (!listEl) return;

  const normalized = Array.isArray(items)
    ? items.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  listEl.innerHTML = '';
  normalized.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  });

  if (cardEl) {
    cardEl.style.display = normalized.length ? 'block' : 'none';
  }
}

function applyTeamTheme(teamId) {
  document.body.setAttribute('data-team-theme', teamId);
}

function setHeroStatValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function hasStaffRole(player) {
  const roles = Array.isArray(player?.roles)
    ? player.roles
    : String(player?.roles || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);

  return roles.some((role) => String(role || '').toLowerCase().trim() === 'staff');
}

function renderStaffInline(staffPlayers) {
  const staffRow = document.getElementById('team-staff-row');
  const staffValue = document.getElementById('team-staff-inline');
  if (!staffRow || !staffValue) return;

  const normalized = Array.isArray(staffPlayers)
    ? staffPlayers.map((player) => String(player?.name || '').trim()).filter(Boolean)
    : [];

  if (!normalized.length) {
    staffRow.style.display = 'none';
    staffValue.textContent = 'TBD';
    return;
  }

  staffValue.textContent = normalized.join(' / ');
  staffRow.style.display = 'grid';
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

  const staffPlayers = normalizedPlayers.filter((player) => hasStaffRole(player));
  const competitivePlayers = normalizedPlayers.filter((player) => !hasStaffRole(player));
  const starters = competitivePlayers.filter((player) => player.lineup === 'starter');
  const subs = competitivePlayers.filter((player) => player.lineup === 'sub');

  renderStaffInline(staffPlayers);

  startersListEl.innerHTML = '';
  subsListEl.innerHTML = '';

  const renderPlayer = (listEl, player) => {
    const li = document.createElement('li');
    li.className = 'roster-player';

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

function getMatchDate(match) {
  const date = match?.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match?.scheduledAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMatchEventLabel(match) {
  return pickText(match?.eventName, pickText(match?.event, pickText(match?.tournamentName, pickText(match?.source, 'Official Match'))));
}

function getMatchStreamUrl(match) {
  return getSafeHttpUrl(pickText(match?.streamUrl, pickText(match?.vodUrl, pickText(match?.watchUrl, ''))));
}

function getMatchScoreLabel(match) {
  const score = pickText(match?.score, '');
  if (score) return score;

  const mapScoreFor = Number(match?.mapScoreFor);
  const mapScoreAgainst = Number(match?.mapScoreAgainst);
  if (Number.isFinite(mapScoreFor) && Number.isFinite(mapScoreAgainst)) {
    return `${mapScoreFor}-${mapScoreAgainst}`;
  }

  return '';
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
    if (result === 'W' || result === 'L' || result === 'D') {
      strong.textContent = result;
      strong.classList.add(result === 'W' ? 'match-result--win' : result === 'L' ? 'match-result--loss' : 'match-result--draw');
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

    const eventLabel = getMatchEventLabel(match);
    if (eventLabel) {
      const eventSpan = document.createElement('span');
      eventSpan.className = 'match-event';
      eventSpan.textContent = eventLabel;
      metaRow.appendChild(eventSpan);
    }

    const scoreLabel = getMatchScoreLabel(match);
    if (scoreLabel) {
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'match-score';
      scoreSpan.textContent = `Score: ${scoreLabel}`;
      metaRow.appendChild(scoreSpan);
    }

    if (Array.isArray(match.mapsPlayed) && match.mapsPlayed.length) {
      const mapsSpan = document.createElement('span');
      mapsSpan.className = 'match-maps';
      mapsSpan.textContent = `Maps: ${match.mapsPlayed.join(', ')}`;
      metaRow.appendChild(mapsSpan);
    }

    if (match.replayCode) {
      const replaySpan = document.createElement('span');
      replaySpan.className = 'match-replay';
      replaySpan.textContent = `Replay: ${match.replayCode}`;
      metaRow.appendChild(replaySpan);
    }

    const streamUrl = getMatchStreamUrl(match);
    if (streamUrl) {
      const streamLink = document.createElement('a');
      streamLink.className = 'match-watch-link';
      streamLink.href = streamUrl;
      streamLink.target = '_blank';
      streamLink.rel = 'noopener';
      streamLink.textContent = 'Watch';
      metaRow.appendChild(streamLink);
    }

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

function initMatchCenterTabs() {
  const tabs = Array.from(document.querySelectorAll('[data-match-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-match-panel]'));
  if (!tabs.length || !panels.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.matchTab;

      tabs.forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.matchPanel === target;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });
    });
  });
}

function initTeamCalendarControls() {
  document.getElementById('team-calendar-prev')?.addEventListener('click', () => {
    matchCenterState.calendarDate = new Date(
      matchCenterState.calendarDate.getFullYear(),
      matchCenterState.calendarDate.getMonth() - 1,
      1
    );
    renderTeamCalendar();
  });

  document.getElementById('team-calendar-next')?.addEventListener('click', () => {
    matchCenterState.calendarDate = new Date(
      matchCenterState.calendarDate.getFullYear(),
      matchCenterState.calendarDate.getMonth() + 1,
      1
    );
    renderTeamCalendar();
  });
}

function setMatchCenterMatches(upcoming = [], recent = []) {
  const merged = [...upcoming, ...recent]
    .map((match) => ({ ...match, __date: getMatchDate(match) }))
    .filter((match) => match.__date)
    .sort((a, b) => a.__date.getTime() - b.__date.getTime());

  matchCenterState.matches = merged;
  const nextUpcoming = upcoming.map((match) => getMatchDate(match)).find(Boolean);
  const fallbackDate = merged[0]?.__date || new Date();
  const baseDate = nextUpcoming || fallbackDate;
  matchCenterState.calendarDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  matchCenterState.selectedDateKey = getDateKey(nextUpcoming || fallbackDate);
  renderTeamCalendar();
}

function renderTeamCalendar() {
  const daysEl = document.getElementById('team-calendar-days');
  const currentEl = document.getElementById('team-calendar-current');
  if (!daysEl || !currentEl) return;

  const monthDate = matchCenterState.calendarDate;
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstOfMonth.getDay());
  const todayKey = getDateKey(new Date());
  const byDate = groupMatchesByDate(matchCenterState.matches);

  currentEl.textContent = monthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  daysEl.innerHTML = '';
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateKey = getDateKey(date);
    const matches = byDate.get(dateKey) || [];

    const button = document.createElement('button');
    button.className = 'team-calendar__day';
    button.type = 'button';
    button.dataset.dateKey = dateKey;
    button.classList.toggle('is-outside-month', date.getMonth() !== month);
    button.classList.toggle('is-today', dateKey === todayKey);
    button.classList.toggle('is-selected', dateKey === matchCenterState.selectedDateKey);
    button.disabled = !matches.length;
    button.innerHTML = `
      <span class="team-calendar__day-number">${date.getDate()}</span>
      ${matches.length ? `<span class="team-calendar__day-count">${matches.length}</span>` : ''}
    `;
    button.addEventListener('click', () => {
      matchCenterState.selectedDateKey = dateKey;
      renderTeamCalendar();
    });

    daysEl.appendChild(button);
  }

  renderCalendarAgenda(byDate);
}

function groupMatchesByDate(matches) {
  const byDate = new Map();
  matches.forEach((match) => {
    const dateKey = getDateKey(match.__date || getMatchDate(match));
    if (!dateKey) return;
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(match);
  });
  return byDate;
}

function renderCalendarAgenda(byDate) {
  const titleEl = document.getElementById('team-calendar-agenda-title');
  const listEl = document.getElementById('team-calendar-agenda-list');
  if (!titleEl || !listEl) return;

  const selectedKey = matchCenterState.selectedDateKey;
  const selectedDate = selectedKey ? new Date(`${selectedKey}T12:00:00`) : null;
  const matches = selectedKey ? byDate.get(selectedKey) || [] : [];

  titleEl.textContent = selectedDate && !Number.isNaN(selectedDate.getTime())
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : 'Selected Day';

  listEl.innerHTML = '';
  if (!matchCenterState.matches.length) {
    listEl.innerHTML = '<p class="team-calendar__empty">No match dates are available for this team yet.</p>';
    return;
  }

  if (!matches.length) {
    listEl.innerHTML = '<p class="team-calendar__empty">No matches on this day.</p>';
    return;
  }

  matches.forEach((match) => {
    const item = document.createElement('article');
    item.className = 'team-calendar__agenda-item';
    const streamUrl = getMatchStreamUrl(match);
    item.innerHTML = `
      <strong>vs ${escapeHtml(match.opponent || match.opponentName || 'TBD')}</strong>
      <span>${escapeHtml(formatMatchDate(match.scheduledAt))}</span>
      <span>${escapeHtml(getMatchEventLabel(match))}</span>
      ${streamUrl ? `<a href="${escapeHtml(streamUrl)}" target="_blank" rel="noopener">Watch</a>` : ''}
    `;
    listEl.appendChild(item);
  });
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

    const payloadScript = doc.getElementById('schedule-data');
    if (payloadScript?.textContent) {
      const payload = JSON.parse(payloadScript.textContent);
      const now = Date.now();
      const items = Array.isArray(payload?.events)
        ? payload.events
            .map((event) => {
              if (String(event?.teamId || '').trim().toLowerCase() !== teamId) return null;

              const date = new Date(event.date);
              if (Number.isNaN(date.getTime()) || date.getTime() < now) return null;

              const opponent = String(event.opponent || event.opponentName || '').trim();
              if (!opponent || opponent.toUpperCase() === 'BYE') return null;

              return {
                opponent,
                opponentName: opponent,
                scheduledAt: date,
                streamUrl: String(event.streamUrl || '').trim() || null,
                eventName: String(event.eventName || event.event || event.tournamentName || '').trim() || null,
                type: String(event.type || 'official').trim().toLowerCase() || 'official',
                source: 'schedule-data'
              };
            })
            .filter(Boolean)
            .sort((a, b) => {
              const aTime = a.scheduledAt instanceof Date ? a.scheduledAt.getTime() : new Date(a.scheduledAt).getTime();
              const bTime = b.scheduledAt instanceof Date ? b.scheduledAt.getTime() : new Date(b.scheduledAt).getTime();
              return aTime - bTime;
            })
        : [];

      if (items.length) {
        return items.slice(0, limit);
      }
    }

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

  const now = Date.now();
  const matches = await listMatchesByTeam(teamId, { limit: 50, upcomingOnly: false });
  let upcoming = matches
    .filter((match) => {
      const date = match.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match.scheduledAt);
      return !Number.isNaN(date.getTime()) && date.getTime() >= now;
    })
    .sort((a, b) => getMatchDate(a) - getMatchDate(b))
    .slice(0, 5);
  if (!upcoming.length) {
    upcoming = await loadUpcomingFromPublicSchedule(teamId, 5);
  }
  renderUpcomingSchedule(upcoming);

  const recent = matches
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
    .slice(0, 10);

  renderRecentMatches(recent);
  setMatchCenterMatches(upcoming, recent);
}

async function init() {
  initMatchCenterTabs();
  initTeamCalendarControls();
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
    const { metadata, roster, rosterError } = await loadTeamMetadata(teamId);
    renderTeamHero(teamId, metadata);
    showTeam();

    if (rosterError) {
      console.error('Failed to load roster:', rosterError);
      document.querySelector('.roster-loading').textContent = 'Error loading roster.';
    } else {
      renderRoster(roster);
    }

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
