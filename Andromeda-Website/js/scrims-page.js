import { listOfficialMatches } from '/js/services/matches.service.js';

const filterEl = document.getElementById('scrims-team-filter');
const statusEl = document.getElementById('scrims-page-status');
const listEl = document.getElementById('scrims-page-list');

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown date';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function scoreLabel(scrim) {
  const hasFor = Number.isFinite(scrim.mapScoreFor);
  const hasAgainst = Number.isFinite(scrim.mapScoreAgainst);
  if (!hasFor && !hasAgainst) return '';
  return `${hasFor ? scrim.mapScoreFor : 0} - ${hasAgainst ? scrim.mapScoreAgainst : 0}`;
}

function renderScrimCard(scrim) {
  const details = document.createElement('details');
  details.className = 'scrim-item card';

  const summary = document.createElement('summary');
  summary.className = 'scrim-item__summary';

  const heading = document.createElement('div');
  heading.className = 'scrim-item__heading';
  heading.innerHTML = `
    <strong>${scrim.teamName || scrim.teamId || 'Team'}</strong>
    <span class="scrim-item__vs">vs ${scrim.opponentName || 'Unknown opponent'}</span>
  `;

  const meta = document.createElement('div');
  meta.className = 'scrim-item__meta';
  const score = scoreLabel(scrim);
  meta.innerHTML = `
    <span class="result-badge result-badge--${String(scrim.result || '').toLowerCase()}">${scrim.result || '-'}</span>
    <span>${formatDate(scrim.createdAt)}</span>
    <span>Replay: ${scrim.replayCode || 'N/A'}</span>
    ${score ? `<span>Score: ${score}</span>` : ''}
  `;

  summary.appendChild(heading);
  summary.appendChild(meta);

  const body = document.createElement('div');
  body.className = 'scrim-item__body';

  if (scrim.notes) {
    const notes = document.createElement('p');
    notes.textContent = scrim.notes;
    body.appendChild(notes);
  }

  if (Array.isArray(scrim.mapsPlayed) && scrim.mapsPlayed.length) {
    const maps = document.createElement('p');
    maps.className = 'muted';
    maps.textContent = `Maps: ${scrim.mapsPlayed.join(', ')}`;
    body.appendChild(maps);
  }

  if (scrim.stats && typeof scrim.stats === 'object') {
    const stats = document.createElement('pre');
    stats.className = 'scrim-item__stats';
    stats.textContent = JSON.stringify(scrim.stats, null, 2);
    body.appendChild(stats);
  }

  if (Array.isArray(scrim.screenshotUrls) && scrim.screenshotUrls.length) {
    const mediaGrid = document.createElement('div');
    mediaGrid.className = 'scrim-item__media';
    scrim.screenshotUrls.forEach((url) => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener';

      const image = document.createElement('img');
      image.src = url;
      image.alt = 'Scrim screenshot';

      anchor.appendChild(image);
      mediaGrid.appendChild(anchor);
    });
    body.appendChild(mediaGrid);
  }

  details.appendChild(summary);
  details.appendChild(body);

  return details;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--text-muted)';
}

async function loadScrims() {
  try {
    setStatus('Loading matches...');
    listEl.innerHTML = '';

    const teamId = String(filterEl.value || '').trim() || null;
    const items = await listOfficialMatches({ teamId, limit: 40 });

    if (!items.length) {
      setStatus('No official matches found.');
      return;
    }

    items.forEach((scrim) => {
      listEl.appendChild(renderScrimCard(scrim));
    });

    setStatus(`Showing ${items.length} match(es).`);
  } catch (error) {
    console.error('Failed to load matches:', error);
    setStatus('Could not load matches right now.', true);
  }
}

filterEl.addEventListener('change', loadScrims);

const params = new URLSearchParams(window.location.search);
const teamIdFromUrl = String(params.get('teamId') || '').trim().toLowerCase();
if (teamIdFromUrl) {
  filterEl.value = teamIdFromUrl;
}

loadScrims();
