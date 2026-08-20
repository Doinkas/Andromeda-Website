const dataScript = document.getElementById('schedule-data');
const currentMonthEl = document.getElementById('schedule-current-month');
const calendarGridEl = document.getElementById('schedule-calendar-grid');
const selectedLabelEl = document.getElementById('schedule-selected-label');
const selectedEmptyEl = document.getElementById('schedule-selected-empty');
const selectedEventsEl = document.getElementById('schedule-selected-events');
const agendaListEl = document.getElementById('schedule-agenda-list');
const teamFilterEl = document.getElementById('schedule-team-filter');
const prevMonthButton = document.getElementById('schedule-prev-month');
const nextMonthButton = document.getElementById('schedule-next-month');

const totalsEls = {
  events: document.getElementById('schedule-total-events'),
  teams: document.getElementById('schedule-total-teams'),
  streams: document.getElementById('schedule-total-streams')
};

function parsePayload() {
  if (!dataScript?.textContent) return [];

  try {
    const payload = JSON.parse(dataScript.textContent);
    if (!Array.isArray(payload?.events)) return [];

    return payload.events
      .map((event) => {
        const date = new Date(event.date);
        if (Number.isNaN(date.getTime())) return null;

        return {
          ...event,
          date,
          teamId: String(event.teamId || '').trim().toLowerCase(),
          teamLabel: String(event.teamLabel || event.teamId || 'Andromeda').trim(),
          opponent: String(event.opponent || event.opponentName || 'Unknown opponent').trim(),
          streamUrl: String(event.streamUrl || '').trim()
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch (error) {
    console.error('Failed to parse schedule data:', error);
    return [];
  }
}

const allEvents = parsePayload();
const monthKeys = Array.from(new Set(allEvents.map((event) => `${event.date.getFullYear()}-${event.date.getMonth()}`)));

let monthIndex = Math.max(0, monthKeys.findIndex((key) => {
  const today = new Date();
  return key === `${today.getFullYear()}-${today.getMonth()}`;
}));

if (monthIndex < 0) monthIndex = 0;

let selectedDateKey = null;

function formatMonth(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

function getActiveMonth() {
  if (!monthKeys.length) return null;
  const [yearText, monthText] = monthKeys[monthIndex].split('-');
  return new Date(Number(yearText), Number(monthText), 1);
}

function getFilteredEvents() {
  const teamId = String(teamFilterEl?.value || '').trim().toLowerCase();
  if (!teamId) return allEvents;
  return allEvents.filter((event) => event.teamId === teamId);
}

function getVisibleEvents() {
  const month = getActiveMonth();
  if (!month) return [];
  const filtered = getFilteredEvents();
  return filtered.filter((event) => event.date.getFullYear() === month.getFullYear() && event.date.getMonth() === month.getMonth());
}

function getDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function ensureSelectedDate(events) {
  if (!events.length) {
    selectedDateKey = null;
    return;
  }

  if (selectedDateKey && events.some((event) => getDateKey(event.date) === selectedDateKey)) {
    return;
  }

  selectedDateKey = getDateKey(events[0].date);
}

function renderTotals() {
  const filtered = getFilteredEvents();
  const teams = new Set(filtered.map((event) => event.teamId).filter(Boolean));
  const streams = filtered.filter((event) => event.streamUrl).length;

  if (totalsEls.events) totalsEls.events.textContent = String(filtered.length);
  if (totalsEls.teams) totalsEls.teams.textContent = String(teams.size);
  if (totalsEls.streams) totalsEls.streams.textContent = String(streams);
}

function renderFilterOptions() {
  if (!teamFilterEl) return;

  const teams = Array.from(new Map(allEvents.map((event) => [event.teamId, event.teamLabel])).entries())
    .sort((a, b) => a[1].localeCompare(b[1]));

  const selected = teamFilterEl.value;
  teamFilterEl.innerHTML = '<option value="">All rosters</option>';

  teams.forEach(([teamId, label]) => {
    const option = document.createElement('option');
    option.value = teamId;
    option.textContent = label;
    teamFilterEl.appendChild(option);
  });

  teamFilterEl.value = teams.some(([teamId]) => teamId === selected) ? selected : '';
}

function renderCalendar() {
  if (!calendarGridEl || !currentMonthEl) return;

  const month = getActiveMonth();
  if (!month) {
    currentMonthEl.textContent = 'No schedule loaded';
    calendarGridEl.innerHTML = '';
    return;
  }

  const visibleEvents = getVisibleEvents();
  const eventsByDay = new Map();
  visibleEvents.forEach((event) => {
    const key = getDateKey(event.date);
    const list = eventsByDay.get(key) || [];
    list.push(event);
    eventsByDay.set(key, list);
  });

  ensureSelectedDate(visibleEvents);
  currentMonthEl.textContent = formatMonth(month);
  calendarGridEl.innerHTML = '';

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    const dayDate = new Date(cursor);
    const key = getDateKey(dayDate);
    const events = eventsByDay.get(key) || [];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'schedule-calendar-day';

    if (dayDate.getMonth() !== month.getMonth()) button.classList.add('is-outside-month');
    if (events.length) button.classList.add('is-clickable');
    if (selectedDateKey === key) button.classList.add('is-selected');
    if (sameDay(dayDate, new Date())) button.classList.add('is-today');

    button.innerHTML = `
      <span class="schedule-calendar-day__number">${dayDate.getDate()}</span>
      ${events.length ? `<span class="schedule-calendar-day__count">${events.length} match${events.length === 1 ? '' : 'es'}</span>` : ''}
      <div class="schedule-calendar-day__items">
        ${events.slice(0, 2).map((event) => `
          <span class="schedule-calendar-day__item">
            <span class="schedule-calendar-day__team">${event.teamLabel}</span>
            <span class="schedule-calendar-day__opponent">vs ${event.opponent}</span>
          </span>
        `).join('')}
      </div>
    `;

    button.disabled = events.length === 0;
    button.addEventListener('click', () => {
      selectedDateKey = key;
      renderCalendar();
      renderSelectedDay();
    });

    calendarGridEl.appendChild(button);
  }
}

function renderSelectedDay() {
  if (!selectedLabelEl || !selectedEmptyEl || !selectedEventsEl) return;

  const events = getVisibleEvents().filter((event) => getDateKey(event.date) === selectedDateKey);
  selectedEventsEl.innerHTML = '';

  if (!events.length) {
    selectedLabelEl.textContent = 'Pick a date';
    selectedEmptyEl.hidden = false;
    selectedEmptyEl.textContent = 'Select a highlighted date to see the full match card.';
    return;
  }

  selectedLabelEl.textContent = formatDayLabel(events[0].date);
  selectedEmptyEl.hidden = true;

  events.forEach((event) => {
    const article = document.createElement('article');
    article.className = 'schedule-day-event';
    article.innerHTML = `
      <strong>${event.teamLabel}</strong>
      <p>vs ${event.opponent}</p>
      <div class="schedule-day-event__meta">
        <span>${formatTime(event.date)}</span>
        <span>${String(event.type || 'official').toUpperCase()}</span>
        ${event.streamUrl ? `<a class="schedule-day-event__link" href="${event.streamUrl}" target="_blank" rel="noopener">Watch stream</a>` : '<span>No stream posted</span>'}
      </div>
    `;
    selectedEventsEl.appendChild(article);
  });
}

function renderAgenda() {
  if (!agendaListEl) return;

  const events = getVisibleEvents();
  agendaListEl.innerHTML = '';

  if (!events.length) {
    agendaListEl.innerHTML = '<p class="muted">No matches found for this month and filter.</p>';
    return;
  }

  events.forEach((event) => {
    const article = document.createElement('article');
    article.className = 'schedule-agenda-item';
    article.innerHTML = `
      <strong>${formatDayLabel(event.date)}</strong>
      <p>${event.teamLabel} vs ${event.opponent}</p>
      <div class="schedule-agenda-item__meta">
        <span>${formatTime(event.date)}</span>
        <span>${String(event.type || 'official').toUpperCase()}</span>
        ${event.streamUrl ? `<a class="schedule-agenda-item__link" href="${event.streamUrl}" target="_blank" rel="noopener">Watch stream</a>` : '<span>No stream posted</span>'}
      </div>
    `;
    agendaListEl.appendChild(article);
  });
}

function render() {
  renderTotals();
  renderCalendar();
  renderSelectedDay();
  renderAgenda();

  if (prevMonthButton) prevMonthButton.disabled = monthIndex <= 0;
  if (nextMonthButton) nextMonthButton.disabled = monthIndex >= monthKeys.length - 1;
}

renderFilterOptions();
render();

teamFilterEl?.addEventListener('change', () => {
  selectedDateKey = null;
  render();
});

prevMonthButton?.addEventListener('click', () => {
  if (monthIndex <= 0) return;
  monthIndex -= 1;
  selectedDateKey = null;
  render();
});

nextMonthButton?.addEventListener('click', () => {
  if (monthIndex >= monthKeys.length - 1) return;
  monthIndex += 1;
  selectedDateKey = null;
  render();
});