import { listAuditLogs } from '/js/services/audit.service.js';

const teamFilter = document.getElementById('audit-team-filter');
const actionFilter = document.getElementById('audit-action-filter');
const startDateFilter = document.getElementById('audit-start-date');
const endDateFilter = document.getElementById('audit-end-date');
const limitFilter = document.getElementById('audit-limit-filter');
const applyButton = document.getElementById('audit-apply-btn');
const clearButton = document.getElementById('audit-clear-btn');
const statusEl = document.getElementById('audit-status');
const tableBody = document.getElementById('audit-table-body');

let hasAdminAccess = false;

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--admin-muted)';
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveTeamId(entry) {
  const metaTeam = String(entry?.meta?.teamId || '').trim().toLowerCase();
  if (metaTeam) return metaTeam;

  const afterTeam = String(entry?.after?.teamId || '').trim().toLowerCase();
  if (afterTeam) return afterTeam;

  const beforeTeam = String(entry?.before?.teamId || '').trim().toLowerCase();
  if (beforeTeam) return beforeTeam;

  const targetId = String(entry?.targetId || '').trim().toLowerCase();
  return targetId || '—';
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString();
}

function stringifyDiffSummary(diffSummary) {
  if (!diffSummary || typeof diffSummary !== 'object') return '';

  const parts = [];
  if (typeof diffSummary.addedCount === 'number') parts.push(`added ${diffSummary.addedCount}`);
  if (typeof diffSummary.removedCount === 'number') parts.push(`removed ${diffSummary.removedCount}`);
  if (typeof diffSummary.renamedCount === 'number') parts.push(`renamed ${diffSummary.renamedCount}`);
  if (typeof diffSummary.roleChangeCount === 'number') parts.push(`role changes ${diffSummary.roleChangeCount}`);
  if (typeof diffSummary.statusChangeCount === 'number') parts.push(`status changes ${diffSummary.statusChangeCount}`);
  if (typeof diffSummary.lineupChangeCount === 'number') parts.push(`lineup changes ${diffSummary.lineupChangeCount}`);
  return parts.join(', ');
}

function summarizeLog(entry) {
  const meta = entry?.meta || {};

  if (typeof meta.summary === 'string' && meta.summary.trim()) {
    return meta.summary.trim();
  }

  const diffFromMeta = stringifyDiffSummary(meta.diffSummary);
  if (diffFromMeta) {
    return diffFromMeta;
  }

  const beforeCount = Array.isArray(entry?.before?.players) ? entry.before.players.length : null;
  const afterCount = Array.isArray(entry?.after?.players) ? entry.after.players.length : null;
  if (beforeCount !== null || afterCount !== null) {
    return `players: ${beforeCount ?? '—'} -> ${afterCount ?? '—'}`;
  }

  if (entry?.before && entry?.after) {
    return 'record updated';
  }

  return '—';
}

function renderRows(logs) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (!logs.length) {
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'admin-text-muted';
    cell.textContent = 'No audit logs matched these filters.';
    emptyRow.appendChild(cell);
    tableBody.appendChild(emptyRow);
    return;
  }

  logs.forEach((entry) => {
    const row = document.createElement('tr');

    const whenCell = document.createElement('td');
    whenCell.textContent = formatDate(entry.performedAt);

    const actionCell = document.createElement('td');
    actionCell.textContent = String(entry.action || 'unknown');

    const resourceCell = document.createElement('td');
    const targetCollection = String(entry.targetCollection || '—');
    const targetId = String(entry.targetId || '—');
    resourceCell.textContent = `${targetCollection}/${targetId}`;

    const teamCell = document.createElement('td');
    teamCell.textContent = resolveTeamId(entry);

    const actorCell = document.createElement('td');
    actorCell.textContent = String(entry.performedBy || '—');

    const summaryCell = document.createElement('td');
    summaryCell.textContent = summarizeLog(entry);

    row.appendChild(whenCell);
    row.appendChild(actionCell);
    row.appendChild(resourceCell);
    row.appendChild(teamCell);
    row.appendChild(actorCell);
    row.appendChild(summaryCell);
    tableBody.appendChild(row);
  });
}

function parseDateInput(value, isEnd = false) {
  const text = String(value || '').trim();
  if (!text) return null;

  const date = new Date(`${text}T${isEnd ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function loadLogs() {
  if (!hasAdminAccess) {
    renderRows([]);
    setStatus('Your role cannot view audit logs.', true);
    return;
  }

  try {
    setStatus('Loading audit logs...');
    applyButton.disabled = true;

    const logs = await listAuditLogs({
      teamId: teamFilter.value,
      action: actionFilter.value,
      startDate: parseDateInput(startDateFilter.value, false),
      endDate: parseDateInput(endDateFilter.value, true),
      limitCount: Number(limitFilter.value) || 250
    });

    renderRows(logs);
    setStatus(`Showing ${logs.length} audit log entr${logs.length === 1 ? 'y' : 'ies'}.`);
  } catch (error) {
    console.error('Failed to load audit logs:', error);
    renderRows([]);
    setStatus(error?.message || 'Failed to load audit logs.', true);
  } finally {
    applyButton.disabled = false;
  }
}

function clearFilters() {
  teamFilter.value = '';
  actionFilter.value = '';
  startDateFilter.value = '';
  endDateFilter.value = '';
  limitFilter.value = '250';
}

applyButton.addEventListener('click', loadLogs);
clearButton.addEventListener('click', async () => {
  clearFilters();
  await loadLogs();
});

window.addEventListener('admin:authorized', async (event) => {
  const permissions = Array.isArray(event?.detail?.permissions) ? event.detail.permissions : [];
  hasAdminAccess = permissions.includes('auditLogs:read');
  await loadLogs();
});
