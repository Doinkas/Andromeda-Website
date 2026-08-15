import { listAdminMatches, saveAdminMatch, upsertMatches } from '/js/services/matches.service.js';
import { uploadMatchScreenshots } from '/js/services/scrims.service.js';
import { SCHEDULE_LABEL_TO_TEAM_ID, TEAM_OPTIONS } from '/js/config/teams.config.js';
import { db } from '/js/core/firebase.js';
import { collection, getDocs, query, orderBy, limit as fbLimit, setDoc, doc, deleteDoc, Timestamp, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

// ============================================================================
// STATE
// ============================================================================

let currentMonth = new Date();
let currentTeamFilter = '';
let adminEmail = null;
let adminRole = null;
let allMatches = [];
let allEvents = [];
let activeMatchScreenshotUrls = [];
const today = new Date();
today.setHours(0, 0, 0, 0);
let selectedDateKey = null;

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const calendarGrid = document.getElementById('calendar-grid');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const calendarPrev = document.getElementById('calendar-prev');
const calendarNext = document.getElementById('calendar-next');
const calendarTeamFilter = document.getElementById('calendar-team-filter');
const calendarStatus = document.getElementById('calendar-status');
const calendarTabs = Array.from(document.querySelectorAll('[data-calendar-tab]'));
const calendarPanels = Array.from(document.querySelectorAll('[data-calendar-panel]'));
const calendarEventsList = document.getElementById('calendar-events-list');
const calendarMatchesList = document.getElementById('calendar-matches-list');
const calendarDayDetailTitle = document.getElementById('calendar-day-detail-title');
const calendarDayDetailList = document.getElementById('calendar-day-detail-list');
const calendarDetailAddMatch = document.getElementById('calendar-detail-add-match');
const calendarDetailAddEvent = document.getElementById('calendar-detail-add-event');

const importForm = document.getElementById('import-form');
const importStatus = document.getElementById('import-status');
const importFormatSelect = document.getElementById('import-format');
const scheduleInput = document.getElementById('schedule-input');
const importEventName = document.getElementById('import-event-name');
const timezoneOffset = document.getElementById('timezone-offset');

const matchModal = document.getElementById('match-modal');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const matchEditForm = document.getElementById('match-edit-form');
const modalMatchTitle = document.getElementById('modal-match-title');
const modalStatus = document.getElementById('modal-status');

const modalMatchId = document.getElementById('modal-match-id');
const modalTeam = document.getElementById('modal-team');
const modalOpponent = document.getElementById('modal-opponent');
const modalMatchEventName = document.getElementById('modal-match-event-name');
const modalDate = document.getElementById('modal-date');
const modalTime = document.getElementById('modal-time');
const modalStreamUrl = document.getElementById('modal-stream-url');
const modalResult = document.getElementById('modal-result');
const modalScore = document.getElementById('modal-score');
const modalMaps = document.getElementById('modal-maps');
const modalReplayCode = document.getElementById('modal-replay-code');
const modalNotes = document.getElementById('modal-notes');
const modalScreenshots = document.getElementById('modal-screenshots');
const modalScreenshotNote = document.getElementById('modal-screenshot-note');
const modalDelete = document.getElementById('modal-delete');

const modalType = document.getElementById('modal-type');
const matchFields = document.getElementById('match-fields');
const eventFields = document.getElementById('event-fields');
const modalEventName = document.getElementById('modal-event-name');
const modalEventDescription = document.getElementById('modal-event-description');
const modalEventLink = document.getElementById('modal-event-link');
const modalEventNotes = document.getElementById('modal-event-notes');

const teamNameById = new Map(TEAM_OPTIONS.map((team) => [team.id, team.name]));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toLocalDateInputParts(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }

  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const timePart = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return { date: datePart, time: timePart };
}

function parseDateTime(dateText, timeText) {
  if (!dateText || !timeText) return null;
  const value = new Date(`${dateText}T${timeText}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function setStatus(el, message, type = 'info') {
  const baseClass = el.dataset.baseClass || el.className || el.id;
  el.dataset.baseClass = baseClass;
  el.textContent = message;
  el.hidden = false;
  el.className = `${baseClass} ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`.trim();
}

function getMonthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

function formatMatchDisplay(match) {
  const time = match.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match.scheduledAt);
  const hours = time.getHours().toString().padStart(2, '0');
  const mins = time.getMinutes().toString().padStart(2, '0');
  const teamName = teamNameById.get(match.teamId) || String(match.teamId || 'Team').toUpperCase();
  return `${hours}:${mins} ${teamName} vs ${match.opponent || 'TBD'}`;
}

function formatEventDisplay(event) {
  const time = event.scheduledAt?.toDate ? event.scheduledAt.toDate() : new Date(event.scheduledAt);
  const hours = time.getHours().toString().padStart(2, '0');
  const mins = time.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins} ${event.name}`;
}

function formatDateTime(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDateLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Selected date';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function normalizeMatchResult(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'WIN') return 'W';
  if (normalized === 'LOSS') return 'L';
  if (normalized === 'DRAW') return 'D';
  return ['W', 'L', 'D'].includes(normalized) ? normalized : '';
}

function parseMapScore(value) {
  const text = String(value || '').trim();
  if (!text) {
    return { score: '', mapScoreFor: null, mapScoreAgainst: null };
  }

  const match = text.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) {
    return { score: text, mapScoreFor: null, mapScoreAgainst: null };
  }

  return {
    score: `${Number(match[1])}-${Number(match[2])}`,
    mapScoreFor: Number(match[1]),
    mapScoreAgainst: Number(match[2])
  };
}

function formatScoreValue(match) {
  const score = String(match?.score || '').trim();
  if (score) return score;

  const mapScoreFor = Number(match?.mapScoreFor);
  const mapScoreAgainst = Number(match?.mapScoreAgainst);
  if (Number.isFinite(mapScoreFor) && Number.isFinite(mapScoreAgainst)) {
    return `${mapScoreFor}-${mapScoreAgainst}`;
  }

  return '';
}

function parseMapsPlayed(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateScreenshotNote(urls = []) {
  if (!modalScreenshotNote) return;
  const count = Array.isArray(urls) ? urls.length : 0;
  modalScreenshotNote.textContent = count
    ? `${count} screenshot${count === 1 ? '' : 's'} already saved. Uploading new files will add to them.`
    : 'Optional proof images, max 5MB each.';
}

function setCalendarTab(nextTab) {
  calendarTabs.forEach((tab) => {
    const active = tab.dataset.calendarTab === nextTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  calendarPanels.forEach((panel) => {
    panel.hidden = panel.dataset.calendarPanel !== nextTab;
  });
}

function populateTeamSelect(select, { includeAll = false } = {}) {
  if (!select) return;
  select.innerHTML = includeAll
    ? '<option value="">All Teams</option>'
    : '<option value="">Select team</option>';

  TEAM_OPTIONS.forEach((team) => {
    const option = document.createElement('option');
    option.value = team.id;
    option.textContent = team.name;
    select.appendChild(option);
  });
}

function toggleModalType(type) {
  if (type === 'event') {
    matchFields.style.display = 'none';
    eventFields.style.display = 'block';
    modalOpponent.removeAttribute('required');
    modalEventName.setAttribute('required', '');
  } else {
    matchFields.style.display = 'block';
    eventFields.style.display = 'none';
    modalEventName.removeAttribute('required');
    modalOpponent.setAttribute('required', '');
  }
}

// ============================================================================
// IMPORT PARSING
// ============================================================================

function parseCSVSchedule(csvText, teamIds = [], eventName = '') {
  const lines = csvText.trim().split('\n').filter(line => line.trim());
  const matches = [];
  const normalizedEventName = eventName.trim();

  for (const line of lines) {
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 4) continue;

    const [teamId, opponent, dateStr, timeStr] = parts;
    const normalizedTeamId = SCHEDULE_LABEL_TO_TEAM_ID[teamId.toUpperCase()] || teamId.toLowerCase();

    if (teamIds.length && !teamIds.includes(normalizedTeamId)) {
      continue;
    }

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) continue;

    const [hours, minutes] = timeStr.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) continue;

    date.setHours(hours, minutes, 0, 0);

    matches.push({
      teamId: normalizedTeamId,
      opponent: opponent.trim(),
      scheduledAt: date,
      eventName: normalizedEventName || null,
      streamUrl: null
    });
  }

  return matches;
}

function parseHTMLTableSchedule(htmlText, teamIds = [], eventName = '') {
  const matches = [];
  const normalizedEventName = eventName.trim();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const rows = doc.querySelectorAll('table tr');

  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    if (cells.length < 4) continue;

    const teamLabel = cells[0]?.textContent.trim();
    const teamId = SCHEDULE_LABEL_TO_TEAM_ID[String(teamLabel || '').toUpperCase()] || String(teamLabel || '').toLowerCase();
    const opponent = cells[1]?.textContent.trim();
    const dateStr = cells[2]?.textContent.trim();
    const timeStr = cells[3]?.textContent.trim();

    if (!teamId || !opponent || !dateStr || !timeStr) continue;

    if (teamIds.length && !teamIds.includes(teamId)) {
      continue;
    }

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) continue;

    const timeParts = timeStr.match(/(\d+):(\d+)/);
    if (!timeParts) continue;

    date.setHours(parseInt(timeParts[1], 10), parseInt(timeParts[2], 10), 0, 0);

    matches.push({
      teamId,
      opponent,
      scheduledAt: date,
      eventName: normalizedEventName || null,
      streamUrl: null
    });
  }

  return matches;
}

async function handleImportSubmit(event) {
  event.preventDefault();

  const format = importFormatSelect.value;
  const input = scheduleInput.value.trim();
  const eventName = importEventName.value.trim();
  const selectedTeams = currentTeamFilter ? [currentTeamFilter] : [];
  const tzOffset = parseInt(timezoneOffset.value, 10) || 0;

  if (!input) {
    setStatus(importStatus, 'Please paste schedule data.', 'error');
    return;
  }

  try {
    setStatus(importStatus, 'Parsing schedule...', 'info');

    let matches = format === 'csv'
      ? parseCSVSchedule(input, selectedTeams, eventName)
      : parseHTMLTableSchedule(input, selectedTeams, eventName);

    if (!matches.length) {
      setStatus(importStatus, 'No matches found. Check format and data.', 'error');
      return;
    }

    // Apply timezone offset
    if (tzOffset !== 0) {
      matches = matches.map(m => ({
        ...m,
        scheduledAt: new Date(m.scheduledAt.getTime() - tzOffset * 3600000)
      }));
    }

    const preview = matches.slice(0, 6).map((match) => {
      return `- ${match.teamId.toUpperCase()} vs ${match.opponent} on ${formatDateTime(match.scheduledAt)}`;
    }).join('\n');
    const eventText = eventName ? `\n\nLeague/Tournament: ${eventName}` : '';
    const filterText = currentTeamFilter ? `\n\nCurrent team filter: ${currentTeamFilter.toUpperCase()}` : '';
    const extraText = matches.length > 6 ? `\n- ...and ${matches.length - 6} more` : '';
    const confirmed = confirm(`Import ${matches.length} scheduled match(es)?${eventText}${filterText}\n\n${preview}${extraText}\n\nThis will create or update matching schedule records.`);

    if (!confirmed) {
      setStatus(importStatus, 'Import canceled. No matches were changed.', 'info');
      return;
    }

    setStatus(importStatus, `Importing ${matches.length} matches...`, 'info');
    await upsertMatches(matches, adminEmail);

    setStatus(importStatus, `✓ Successfully imported ${matches.length} matches!`, 'success');
    importForm.reset();
    await loadCalendar();
  } catch (error) {
    console.error('Import error:', error);
    setStatus(importStatus, `Error: ${error.message}`, 'error');
  }
}

// ============================================================================
// CALENDAR RENDERING
// ============================================================================

async function loadMatches() {
  try {
    allMatches = await listAdminMatches({ limit: 200, upcomingOnly: false });
  } catch (error) {
    console.error('Failed to load matches:', error);
    allMatches = [];
  }
}

async function loadEvents() {
  try {
    const eventsQuery = query(collection(db, 'events'), orderBy('scheduledAt', 'asc'), fbLimit(300));
    const snapshot = await getDocs(eventsQuery);
    allEvents = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error('Failed to load events:', error);
    allEvents = [];
  }
}

function getMatchesForDay(date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  return allMatches.filter(match => {
    const matchDate = match.scheduledAt?.toDate ? match.scheduledAt.toDate() : new Date(match.scheduledAt);
    const matchTime = matchDate.getTime();
    
    if (currentTeamFilter && match.teamId !== currentTeamFilter) {
      return false;
    }

    return matchTime >= dayStart.getTime() && matchTime < dayEnd.getTime();
  });
}

function getEventsForDay(date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  return allEvents.filter(event => {
    const eventDate = event.scheduledAt?.toDate ? event.scheduledAt.toDate() : new Date(event.scheduledAt);
    const eventTime = eventDate.getTime();
    return eventTime >= dayStart.getTime() && eventTime < dayEnd.getTime();
  });
}

function renderReviewLists() {
  if (calendarMatchesList) {
    const matches = allMatches
      .filter((match) => !currentTeamFilter || match.teamId === currentTeamFilter)
      .sort((a, b) => {
        const left = a.scheduledAt?.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
        const right = b.scheduledAt?.toDate ? b.scheduledAt.toDate() : new Date(b.scheduledAt);
        return left - right;
      });

    calendarMatchesList.innerHTML = '';
    if (!matches.length) {
      calendarMatchesList.innerHTML = '<p class="admin-empty">No scheduled matches found.</p>';
    } else {
      matches.slice(0, 80).forEach((match) => {
        const item = document.createElement('div');
        item.className = 'calendar-review-item';

        const title = document.createElement('strong');
        title.textContent = `${String(match.teamId || 'team').toUpperCase()} vs ${match.opponent || 'TBD'}`;

        const meta = document.createElement('span');
        const eventName = String(match.eventName || match.tournamentName || '').trim();
        meta.textContent = `${formatDateTime(match.scheduledAt)}${eventName ? ` | ${eventName}` : ''}${match.streamUrl ? ` | ${match.streamUrl}` : ''}`;

        item.appendChild(title);
        item.appendChild(meta);
        calendarMatchesList.appendChild(item);
      });
    }
  }

  if (calendarEventsList) {
    const events = [...allEvents].sort((a, b) => {
      const left = a.scheduledAt?.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
      const right = b.scheduledAt?.toDate ? b.scheduledAt.toDate() : new Date(b.scheduledAt);
      return left - right;
    });

    calendarEventsList.innerHTML = '';
    if (!events.length) {
      calendarEventsList.innerHTML = '<p class="admin-empty">No events found.</p>';
    } else {
      events.slice(0, 80).forEach((event) => {
        const item = document.createElement('div');
        item.className = 'calendar-review-item';

        const title = document.createElement('strong');
        title.textContent = event.name || 'Untitled event';

        const meta = document.createElement('span');
        meta.textContent = `${formatDateTime(event.scheduledAt)}${event.link ? ` | ${event.link}` : ''}`;

        item.appendChild(title);
        item.appendChild(meta);
        calendarEventsList.appendChild(item);
      });
    }
  }
}

function getSelectedDate() {
  if (!selectedDateKey) return null;
  const [year, month, day] = selectedDateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function renderSelectedDayDetail() {
  if (!calendarDayDetailTitle || !calendarDayDetailList) return;

  const selectedDate = getSelectedDate();
  calendarDayDetailList.innerHTML = '';

  if (!selectedDate) {
    calendarDayDetailTitle.textContent = 'Select a date';
    calendarDayDetailList.innerHTML = '<p class="admin-text-muted">Click a date to see that day\'s matches and events.</p>';
    return;
  }

  calendarDayDetailTitle.textContent = formatDateLabel(selectedDate);
  const matches = getMatchesForDay(selectedDate);
  const events = getEventsForDay(selectedDate);

  if (!matches.length && !events.length) {
    calendarDayDetailList.innerHTML = '<p class="admin-text-muted">Nothing scheduled for this day yet.</p>';
    return;
  }

  matches.forEach((match) => {
    const item = document.createElement('article');
    item.className = 'calendar-day-detail__item';

    const info = document.createElement('div');
    const teamName = teamNameById.get(match.teamId) || String(match.teamId || 'Team').toUpperCase();
    const eventName = String(match.eventName || match.tournamentName || '').trim();
    const result = normalizeMatchResult(match.result);
    info.innerHTML = `
      <strong>${teamName} vs ${match.opponent || 'TBD'}</strong>
      <span>${formatDateTime(match.scheduledAt)}${eventName ? ` | ${eventName}` : ''}${result ? ` | Result: ${result}` : ''}</span>
    `;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'admin-btn admin-btn--secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openMatchModal(match));

    item.appendChild(info);
    item.appendChild(edit);
    calendarDayDetailList.appendChild(item);
  });

  events.forEach((event) => {
    const item = document.createElement('article');
    item.className = 'calendar-day-detail__item';

    const info = document.createElement('div');
    info.innerHTML = `
      <strong>${event.name || 'Untitled event'}</strong>
      <span>${formatDateTime(event.scheduledAt)}${event.link ? ` | ${event.link}` : ''}</span>
    `;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'admin-btn admin-btn--secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openEventModal(event));

    item.appendChild(info);
    item.appendChild(edit);
    calendarDayDetailList.appendChild(item);
  });
}

function renderCalendarDay(date, isCurrentMonth) {
  const dayEl = document.createElement('div');
  const isToday = isCurrentMonth && date.getTime() === today.getTime();
  const dateKey = getDateKey(date);
  const isSelected = isCurrentMonth && dateKey === selectedDateKey;
  dayEl.className = `calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;

  if (!isCurrentMonth) {
    dayEl.textContent = date.getDate();
    return dayEl;
  }

  const headerEl = document.createElement('div');
  headerEl.className = 'calendar-day-header';
  headerEl.textContent = date.getDate();
  dayEl.appendChild(headerEl);

  const matches = getMatchesForDay(date);
  const events = getEventsForDay(date);

  // Render matches
  matches.forEach(match => {
    const eventEl = document.createElement('div');
    eventEl.className = `calendar-day-event ${match.result ? match.result : 'pending'}`;
    
    const indicator = document.createElement('span');
    indicator.className = 'match-result-indicator';
    indicator.className += ` ${match.result ? match.result : 'pending'}`;
    
    const text = document.createElement('span');
    text.textContent = formatMatchDisplay(match);
    
    eventEl.appendChild(indicator);
    eventEl.appendChild(text);
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openMatchModal(match);
    });

    dayEl.appendChild(eventEl);
  });

  // Render events
  events.forEach(event => {
    const eventEl = document.createElement('div');
    eventEl.className = 'calendar-day-event event';
    
    const text = document.createElement('span');
    text.textContent = formatEventDisplay(event);
    
    eventEl.appendChild(text);
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openEventModal(event);
    });

    dayEl.appendChild(eventEl);
  });

  if (isSelected) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'calendar-day-actions';

    const matchButton = document.createElement('button');
    matchButton.type = 'button';
    matchButton.className = 'calendar-day-action';
    matchButton.textContent = '+ Match';
    matchButton.addEventListener('click', (e) => {
      e.stopPropagation();
      createNewMatchForDay(date);
    });

    const eventButton = document.createElement('button');
    eventButton.type = 'button';
    eventButton.className = 'calendar-day-action';
    eventButton.textContent = '+ Event';
    eventButton.addEventListener('click', (e) => {
      e.stopPropagation();
      createNewEventForDay(date);
    });

    actionsEl.appendChild(matchButton);
    actionsEl.appendChild(eventButton);
    dayEl.appendChild(actionsEl);
  }

  dayEl.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedDateKey = selectedDateKey === dateKey ? null : dateKey;
    renderCalendar();
  });

  return dayEl;
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  calendarMonthLabel.textContent = getMonthLabel(currentMonth);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(day => {
    const el = document.createElement('div');
    el.className = 'calendar-weekday';
    el.textContent = day;
    calendarGrid.appendChild(el);
  });

  const firstDay = getFirstDayOfMonth(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);
  const prevMonthDays = getDaysInMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));

  // Previous month's trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, prevMonthDays - i);
    calendarGrid.appendChild(renderCalendarDay(date, false));
  }

  // Current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    calendarGrid.appendChild(renderCalendarDay(date, true));
  }

  // Next month's leading days
  const totalCells = calendarGrid.children.length - 7; // Subtract weekday headers
  const remainingCells = 42 - totalCells; // 6 weeks * 7 days
  for (let i = 1; i <= remainingCells; i++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i);
    calendarGrid.appendChild(renderCalendarDay(date, false));
  }

  calendarStatus.textContent = `Showing ${allMatches.length} total match(es)`;
  renderReviewLists();
  renderSelectedDayDetail();
}

async function loadCalendar() {
  await loadMatches();
  await loadEvents();
  renderCalendar();
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

function closeModal() {
  matchModal.classList.remove('active');
  matchEditForm.reset();
  modalStatus.textContent = '';
}

function openModal() {
  matchModal.classList.add('active');
}

async function openMatchModal(match) {
  modalType.value = 'match';
  toggleModalType('match');

  modalMatchId.value = match.id || '';
  modalTeam.value = match.teamId || '';
  modalOpponent.value = match.opponent || '';
  modalMatchEventName.value = match.eventName || match.tournamentName || '';
  
  const parts = toLocalDateInputParts(match.scheduledAt);
  modalDate.value = parts.date;
  modalTime.value = parts.time;
  
  modalStreamUrl.value = match.streamUrl || '';
  modalResult.value = normalizeMatchResult(match.result);
  modalScore.value = formatScoreValue(match);
  modalMaps.value = Array.isArray(match.mapsPlayed) ? match.mapsPlayed.join(', ') : '';
  modalReplayCode.value = match.replayCode || '';
  modalNotes.value = match.notes || '';
  modalScreenshots.value = '';
  activeMatchScreenshotUrls = Array.isArray(match.screenshotUrls) ? match.screenshotUrls : [];
  updateScreenshotNote(activeMatchScreenshotUrls);

  modalMatchTitle.textContent = `${match.teamId.toUpperCase()} vs ${match.opponent}`;
  openModal();
}

async function openEventModal(event) {
  modalType.value = 'event';
  toggleModalType('event');

  modalMatchId.value = event.id || '';
  
  const parts = toLocalDateInputParts(event.scheduledAt);
  modalDate.value = parts.date;
  modalTime.value = parts.time;
  
  modalEventName.value = event.name || '';
  modalEventDescription.value = event.description || '';
  modalEventLink.value = event.link || '';
  modalEventNotes.value = event.notes || '';

  modalMatchTitle.textContent = event.name || 'Event';
  openModal();
}

function createNewMatchForDay(date) {
  const parts = toLocalDateInputParts(date);
  
  modalType.value = 'match';
  toggleModalType('match');

  modalMatchId.value = '';
  modalTeam.value = currentTeamFilter || '';
  modalOpponent.value = '';
  modalMatchEventName.value = '';
  modalDate.value = parts.date;
  modalTime.value = '19:00';
  modalStreamUrl.value = '';
  modalResult.value = '';
  modalScore.value = '';
  modalMaps.value = '';
  modalReplayCode.value = '';
  modalNotes.value = '';
  modalScreenshots.value = '';
  activeMatchScreenshotUrls = [];
  updateScreenshotNote(activeMatchScreenshotUrls);

  modalMatchTitle.textContent = 'Create New Match';
  openModal();
  selectedDateKey = null;
  renderCalendar();
}

function createNewEventForDay(date) {
  const parts = toLocalDateInputParts(date);
  
  modalType.value = 'event';
  toggleModalType('event');

  modalMatchId.value = '';
  modalDate.value = parts.date;
  modalTime.value = '19:00';
  modalEventName.value = '';
  modalEventDescription.value = '';
  modalEventLink.value = '';
  modalEventNotes.value = '';

  modalMatchTitle.textContent = 'Create New Event';
  openModal();
  selectedDateKey = null;
  renderCalendar();
}

async function handleMatchFormSubmit(event) {
  event.preventDefault();

  const type = modalType.value;
  const dateStr = modalDate.value;
  const timeStr = modalTime.value;

  if (!dateStr || !timeStr) {
    setStatus(modalStatus, 'Date and time are required.', 'error');
    return;
  }

  const scheduledAt = parseDateTime(dateStr, timeStr);
  if (!scheduledAt) {
    setStatus(modalStatus, 'Invalid date/time.', 'error');
    return;
  }

  try {
    setStatus(modalStatus, `Saving ${type}...`, 'info');
    matchEditForm.querySelector('button[type="submit"]').disabled = true;

    if (type === 'match') {
      const matchId = modalMatchId.value.trim();
      const teamId = modalTeam.value.trim();
      const opponent = modalOpponent.value.trim();

      if (!teamId) {
        setStatus(modalStatus, 'Team is required.', 'error');
        return;
      }

      if (!opponent) {
        setStatus(modalStatus, 'Opponent is required.', 'error');
        return;
      }

      const scoreParts = parseMapScore(modalScore.value);
      const pendingScreenshotFiles = Array.from(modalScreenshots.files || []);
      let screenshotUrls = [...activeMatchScreenshotUrls];

      const matchPayload = {
        id: matchId || undefined,
        teamId,
        opponent,
        eventName: modalMatchEventName.value.trim() || null,
        streamUrl: modalStreamUrl.value.trim() || null,
        result: normalizeMatchResult(modalResult.value) || null,
        score: scoreParts.score || null,
        mapScoreFor: scoreParts.mapScoreFor,
        mapScoreAgainst: scoreParts.mapScoreAgainst,
        mapsPlayed: parseMapsPlayed(modalMaps.value),
        replayCode: modalReplayCode.value.trim() || null,
        notes: modalNotes.value.trim() || null,
        screenshotUrls,
        scheduledAt,
        source: 'admin',
        type: 'official'
      };

      const savedMatchId = await saveAdminMatch(matchPayload, adminEmail);

      if (pendingScreenshotFiles.length) {
        setStatus(modalStatus, `Uploading screenshots (0/${pendingScreenshotFiles.length})...`, 'info');
        const uploadedUrls = await uploadMatchScreenshots('official', teamId, savedMatchId, pendingScreenshotFiles, (progress) => {
          setStatus(modalStatus, `Uploading screenshots (${progress.uploaded}/${progress.total})...`, 'info');
        });

        screenshotUrls = screenshotUrls.concat(uploadedUrls);
        activeMatchScreenshotUrls = screenshotUrls;
        updateScreenshotNote(activeMatchScreenshotUrls);
        await saveAdminMatch({
          ...matchPayload,
          id: savedMatchId,
          screenshotUrls
        }, adminEmail);
      }

      setStatus(modalStatus, '✓ Match saved!', 'success');
    } else if (type === 'event') {
      const eventId = modalMatchId.value.trim() || `event_${Date.now()}`;
      const name = modalEventName.value.trim();

      if (!name) {
        setStatus(modalStatus, 'Event name is required.', 'error');
        return;
      }

      const eventRef = doc(db, 'events', eventId);
      await setDoc(eventRef, {
        name,
        description: modalEventDescription.value.trim() || null,
        link: modalEventLink.value.trim() || null,
        scheduledAt: Timestamp.fromDate(scheduledAt),
        notes: modalEventNotes.value.trim() || null,
        createdBy: adminEmail || null,
        updatedAt: serverTimestamp(),
        lastModifiedBy: adminEmail || null
      }, { merge: true });

      setStatus(modalStatus, '✓ Event saved!', 'success');
    }
    
    await loadCalendar();
    setTimeout(() => closeModal(), 800);
  } catch (error) {
    console.error('Save error:', error);
    setStatus(modalStatus, `Error: ${error.message}`, 'error');
  } finally {
    matchEditForm.querySelector('button[type="submit"]').disabled = false;
  }
}

async function handleMatchDelete() {
  const id = modalMatchId.value.trim();
  const type = modalType.value;

  if (!id) {
    setStatus(modalStatus, `Cannot delete unsaved ${type}.`, 'error');
    return;
  }

  const label = type === 'event'
    ? (modalEventName.value.trim() || 'this event')
    : `${modalTeam.value.trim().toUpperCase()} vs ${modalOpponent.value.trim()}`;

  if (!confirm(`Delete ${label}?\n\nThis removes the ${type} from the admin calendar. This cannot be undone from this page.`)) {
    return;
  }

  try {
    setStatus(modalStatus, `Deleting ${type}...`, 'info');
    modalDelete.disabled = true;

    const collectionName = type === 'event' ? 'events' : 'matches';
    await deleteDoc(doc(db, collectionName, id));
    setStatus(modalStatus, `✓ ${type.charAt(0).toUpperCase() + type.slice(1)} deleted!`, 'success');

    await loadCalendar();
    setTimeout(() => closeModal(), 800);
  } catch (error) {
    console.error('Delete error:', error);
    setStatus(modalStatus, `Error: ${error.message}`, 'error');
  } finally {
    modalDelete.disabled = false;
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

calendarPrev.addEventListener('click', async () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
  renderCalendar();
});

calendarNext.addEventListener('click', async () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
  renderCalendar();
});

calendarDetailAddMatch?.addEventListener('click', () => {
  const selectedDate = getSelectedDate();
  if (!selectedDate) {
    setStatus(calendarStatus, 'Select a date before adding a match.', 'error');
    return;
  }

  createNewMatchForDay(selectedDate);
});

calendarDetailAddEvent?.addEventListener('click', () => {
  const selectedDate = getSelectedDate();
  if (!selectedDate) {
    setStatus(calendarStatus, 'Select a date before adding an event.', 'error');
    return;
  }

  createNewEventForDay(selectedDate);
});

calendarTeamFilter.addEventListener('change', (e) => {
  currentTeamFilter = e.target.value;
  renderCalendar();
});

calendarTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setCalendarTab(tab.dataset.calendarTab);
  });
});

importForm.addEventListener('submit', handleImportSubmit);

modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
matchEditForm.addEventListener('submit', handleMatchFormSubmit);
modalDelete.addEventListener('click', handleMatchDelete);

matchModal.addEventListener('click', (e) => {
  if (e.target === matchModal) closeModal();
});

// Clear the selected date when clicking outside the calendar.
document.addEventListener('click', (e) => {
  if (
    selectedDateKey
    && !e.target.closest('.calendar-day')
    && !e.target.closest('#calendar-day-detail')
    && !e.target.closest('#match-modal')
  ) {
    selectedDateKey = null;
    renderCalendar();
  }
});

// Modal type selector
modalType.addEventListener('change', (e) => {
  toggleModalType(e.target.value);
});

// ============================================================================
// INITIALIZATION
// ============================================================================

window.addEventListener('admin:authorized', async (event) => {
  adminEmail = String(event?.detail?.email || '').trim().toLowerCase() || null;
  adminRole = String(event?.detail?.role || '').trim().toLowerCase() || null;
  populateTeamSelect(calendarTeamFilter, { includeAll: true });
  populateTeamSelect(modalTeam);
  await loadCalendar();
});

// Load calendar when page becomes visible after focus
window.addEventListener('visibilitychange', async () => {
  if (!document.hidden && adminEmail) {
    await loadCalendar();
  }
});
