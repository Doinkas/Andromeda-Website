/**
 * Profile Import Page Logic
 */

import { parseCSV, previewProfileChanges, applyProfileUpdates } from '/js/services/profilesImport.service.js';
import { getRoster } from '/js/services/rosters.service.js';

let currentChangeset = null;

const csvInput = document.getElementById('csv-input');
const parseBtn = document.getElementById('parse-btn');
const uploadFileBtn = document.getElementById('upload-file-btn');
const csvFile = document.getElementById('csv-file');
const parseStatus = document.getElementById('parse-status');

const previewSection = document.getElementById('preview-section');
const previewTotal = document.getElementById('preview-total');
const previewOk = document.getElementById('preview-ok');
const previewWarnings = document.getElementById('preview-warnings');
const previewErrors = document.getElementById('preview-errors');
const previewTableBody = document.getElementById('preview-table-body');
const applyBtn = document.getElementById('apply-btn');
const cancelBtn = document.getElementById('cancel-btn');

const resultsSection = document.getElementById('results-section');
const resultsSuccess = document.getElementById('results-success');
const resultsFailed = document.getElementById('results-failed');
const resultsTableBody = document.getElementById('results-table-body');
const resetBtn = document.getElementById('reset-btn');

parseBtn.addEventListener('click', async () => {
  const csvText = csvInput.value.trim();
  if (!csvText) {
    parseStatus.textContent = 'Error: CSV input is empty';
    parseStatus.style.color = 'var(--accent-primary-hover)';
    return;
  }

  try {
    parseStatus.textContent = 'Parsing CSV...';
    parseStatus.style.color = 'inherit';

    // Load all rosters for preview
    const teams = ['horizon', 'spiral', 'proxima', 'comet', 'supernova', 'void', 'faceit'];
    const rosters = {};
    for (const team of teams) {
      rosters[team] = await getRoster(team);
    }

    // Parse CSV
    const records = parseCSV(csvText);
    if (records.length === 0) {
      parseStatus.textContent = 'Error: No valid records found in CSV';
      parseStatus.style.color = 'var(--accent-primary-hover)';
      return;
    }

    // Generate preview
    const changeset = await previewProfileChanges(records, rosters);
    currentChangeset = changeset;

    // Render preview
    renderPreview(changeset);
    parseStatus.textContent = 'CSV parsed successfully. Review the changes below.';
    parseStatus.style.color = 'var(--accent-primary)';
  } catch (error) {
    parseStatus.textContent = `Error: ${error.message}`;
    parseStatus.style.color = 'var(--accent-primary-hover)';
    console.error('Parse failed:', error);
  }
});

uploadFileBtn.addEventListener('click', () => {
  csvFile.click();
});

csvFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    csvInput.value = ev.target?.result || '';
    parseBtn.click();
  };
  reader.readAsText(file);
});

applyBtn.addEventListener('click', async () => {
  if (!currentChangeset) return;

  const okItems = currentChangeset.filter(c => c.status === 'ok');
  if (okItems.length === 0) {
    parseStatus.textContent = 'No valid profiles to apply';
    parseStatus.style.color = 'var(--accent-primary-hover)';
    return;
  }

  applyBtn.disabled = true;
  parseStatus.textContent = 'Applying changes...';
  parseStatus.style.color = 'inherit';

  try {
    // Get current user email from auth state
    const userEmail = document.querySelector('[data-admin-email]')?.textContent || 'unknown';
    
    const results = await applyProfileUpdates(okItems, userEmail);

    // Render results
    renderResults(results);
    previewSection.style.display = 'none';
    resultsSection.style.display = 'block';

    parseStatus.textContent = 'Import complete!';
    parseStatus.style.color = 'var(--accent-primary)';
  } catch (error) {
    parseStatus.textContent = `Error applying changes: ${error.message}`;
    parseStatus.style.color = 'var(--accent-primary-hover)';
    console.error('Apply failed:', error);
  } finally {
    applyBtn.disabled = false;
  }
});

cancelBtn.addEventListener('click', () => {
  previewSection.style.display = 'none';
  currentChangeset = null;
  parseStatus.textContent = '';
  csvInput.value = '';
});

resetBtn.addEventListener('click', () => {
  resultsSection.style.display = 'none';
  previewSection.style.display = 'none';
  currentChangeset = null;
  parseStatus.textContent = '';
  csvInput.value = '';
});

function renderPreview(changeset) {
  const total = changeset.length;
  const ok = changeset.filter(c => c.status === 'ok').length;
  const warnings = changeset.filter(c => c.status === 'warning').length;
  const errors = changeset.filter(c => c.status === 'error').length;

  previewTotal.textContent = total;
  previewOk.textContent = ok;
  previewWarnings.textContent = warnings;
  previewErrors.textContent = errors;

  previewTableBody.innerHTML = '';
  changeset.forEach(change => {
    const tr = document.createElement('tr');
    tr.classList.add(`status-${change.status}`);

    const teamTd = document.createElement('td');
    teamTd.textContent = change.teamId;

    const ignTd = document.createElement('td');
    ignTd.textContent = change.ign;

    const statusTd = document.createElement('td');
    statusTd.textContent = change.status.toUpperCase();

    const messageTd = document.createElement('td');
    messageTd.textContent = change.message;

    tr.appendChild(teamTd);
    tr.appendChild(ignTd);
    tr.appendChild(statusTd);
    tr.appendChild(messageTd);

    previewTableBody.appendChild(tr);
  });

  previewSection.style.display = 'block';
}

function renderResults(results) {
  const success = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  resultsSuccess.textContent = success;
  resultsFailed.textContent = failed;

  resultsTableBody.innerHTML = '';
  results.forEach(result => {
    const tr = document.createElement('tr');
    tr.classList.add(`status-${result.status}`);

    const teamTd = document.createElement('td');
    teamTd.textContent = result.teamId;

    const statusTd = document.createElement('td');
    statusTd.textContent = result.status.toUpperCase();

    const messageTd = document.createElement('td');
    messageTd.textContent = result.message;

    tr.appendChild(teamTd);
    tr.appendChild(statusTd);
    tr.appendChild(messageTd);

    resultsTableBody.appendChild(tr);
  });

  resultsSection.style.display = 'block';
}

// Hide sections on load
window.addEventListener('admin:authorized', () => {
  previewSection.style.display = 'none';
  resultsSection.style.display = 'none';
});

