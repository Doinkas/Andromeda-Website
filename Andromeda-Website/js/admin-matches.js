import { adminSignOut, onAdminAuthState } from '/js/admin/admin-auth.js';
import { isEmailAllowlisted } from '/js/services/admin.service.js';
import { listMatchReportsForAdmin } from '/js/services/matches.service.js';
import { listRosterTeams } from '/js/services/rosters.service.js';

const appShell = document.getElementById('adminApp');
const gateEl = document.getElementById('admin-matches-gate');
const statusEl = document.getElementById('admin-match-status');
const listEl = document.getElementById('admin-match-list');
const typeFilterEl = document.getElementById('admin-match-type-filter');
const teamFilterEl = document.getElementById('admin-match-team-filter');
const emailEl = document.querySelector('[data-admin-email]');

let reports = [];

function normalizeString(value) {
  return String(value || '').trim();
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getDisplayDate(report) {
  return report.scheduledAt || report.createdAt || null;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--admin-muted)';
}

function redirectToAdminIndex(message) {
  gateEl.hidden = false;
  gateEl.textContent = message;

  setTimeout(() => {
    window.location.href = '/admin/index.html';
  }, 1500);
}

function getTeamLabel(report) {
  return normalizeString(report.teamName) || normalizeString(report.teamId) || 'Unknown team';
}

function getOpponentLabel(report) {
  return normalizeString(report.opponentName) || normalizeString(report.opponent) || 'Unknown opponent';
}

function buildDetailRows(report) {
  const rows = [];

  if (report.type === 'scrim') {
    if (report.replayCode) rows.push(`<p><strong>Replay:</strong> ${escapeHtml(report.replayCode)}</p>`);
    if (Array.isArray(report.mapsPlayed) && report.mapsPlayed.length) {
      rows.push(`<p><strong>Maps:</strong> ${escapeHtml(report.mapsPlayed.join(', '))}</p>`);
    }
    if (report.notes) rows.push(`<p><strong>Notes:</strong> ${escapeHtml(report.notes)}</p>`);
  }

  if (report.type === 'official') {
    const streamUrl = normalizeString(report.streamUrl);
    if (streamUrl) {
      rows.push(`<p><strong>VOD/Stream:</strong> <a href="${escapeHtml(streamUrl)}" target="_blank" rel="noopener">${escapeHtml(streamUrl)}</a></p>`);
    }
  }

  const scoreAvailable = Number.isFinite(report.mapScoreFor) || Number.isFinite(report.mapScoreAgainst);
  if (scoreAvailable) {
    const wins = Number.isFinite(report.mapScoreFor) ? report.mapScoreFor : 0;
    const losses = Number.isFinite(report.mapScoreAgainst) ? report.mapScoreAgainst : 0;
    rows.push(`<p><strong>Score:</strong> ${wins}-${losses}</p>`);
  }

  return rows.join('') || '<p class="admin-text-muted">No additional details.</p>';
}

function renderList() {
  const selectedType = normalizeString(typeFilterEl.value).toLowerCase();
  const selectedTeam = normalizeString(teamFilterEl.value).toLowerCase();

  const filtered = reports.filter((report) => {
    const matchesType = selectedType === 'all' || normalizeString(report.type).toLowerCase() === selectedType;
    const matchesTeam = !selectedTeam || normalizeString(report.teamId).toLowerCase() === selectedTeam;
    return matchesType && matchesTeam;
  });

  listEl.innerHTML = '';

  if (!filtered.length) {
    listEl.innerHTML = '<p class="admin-empty">No reports found for this filter.</p>';
    setStatus('No match reports found.');
    return;
  }

  filtered.forEach((report) => {
    const details = document.createElement('details');
    details.className = 'admin-match-report';

    const result = normalizeString(report.result).toUpperCase() || '-';
    details.innerHTML = `
      <summary class="admin-match-report__summary">
        <span>${escapeHtml(formatDate(getDisplayDate(report)))}</span>
        <span>${escapeHtml(getTeamLabel(report))}</span>
        <span>${escapeHtml(getOpponentLabel(report))}</span>
        <span>${escapeHtml(normalizeString(report.type).toUpperCase() || '-')}</span>
        <span>${escapeHtml(result)}</span>
      </summary>
      <div class="admin-match-report__details">
        ${buildDetailRows(report)}
      </div>
    `;

    listEl.appendChild(details);
  });

  setStatus(`Showing ${filtered.length} report(s).`);
}

function renderTeamOptions(rosterTeams) {
  const normalized = rosterTeams
    .map((item) => ({
      teamId: normalizeString(item.teamId).toLowerCase(),
      teamName: normalizeString(item.teamName) || normalizeString(item.teamId)
    }))
    .filter((item) => item.teamId);

  const reportTeams = reports
    .map((item) => ({
      teamId: normalizeString(item.teamId).toLowerCase(),
      teamName: normalizeString(item.teamName) || normalizeString(item.teamId)
    }))
    .filter((item) => item.teamId);

  const mergedMap = new Map();
  [...normalized, ...reportTeams].forEach((item) => {
    if (!mergedMap.has(item.teamId)) {
      mergedMap.set(item.teamId, item.teamName);
    }
  });

  const entries = Array.from(mergedMap.entries())
    .map(([teamId, teamName]) => ({ teamId, teamName }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

  teamFilterEl.innerHTML = '<option value="">All teams</option>';
  entries.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.teamId;
    option.textContent = item.teamName;
    teamFilterEl.appendChild(option);
  });
}

async function loadData() {
  try {
    setStatus('Loading match reports...');

    const [items, rosterTeams] = await Promise.all([
      listMatchReportsForAdmin({ limit: 400 }),
      listRosterTeams().catch(() => [])
    ]);

    reports = items;
    renderTeamOptions(rosterTeams);
    renderList();
  } catch (error) {
    console.error('Failed to load admin match reports:', error);
    listEl.innerHTML = '<p class="admin-empty">Unable to load match reports.</p>';
    setStatus(error?.message || 'Failed to load reports.', true);
  }
}

document.querySelectorAll('[data-admin-signout]').forEach((button) => {
  button.addEventListener('click', async () => {
    await adminSignOut();
  });
});

typeFilterEl.addEventListener('change', renderList);
teamFilterEl.addEventListener('change', renderList);

onAdminAuthState(async (user) => {
  if (!user) {
    redirectToAdminIndex('Sign in required. Redirecting to admin...');
    return;
  }

  const email = normalizeString(user.email).toLowerCase();
  if (emailEl) {
    emailEl.textContent = email || '—';
  }

  try {
    const allowlisted = await isEmailAllowlisted(email);
    if (!allowlisted) {
      redirectToAdminIndex('Access denied. Redirecting to admin...');
      return;
    }

    appShell.hidden = false;
    gateEl.hidden = true;
    await loadData();
  } catch (error) {
    console.error('Allowlist check failed:', error);
    redirectToAdminIndex('Could not verify access. Redirecting to admin...');
  }
});
