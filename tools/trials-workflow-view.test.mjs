import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  TRIALS_VIEWS,
  filterTrialsForView,
  getTrialsViewCounts,
  normalizeTrialsView
} from '../admin/js/trials-view-state.js';

const trials = [
  { id: 'pending-1', status: 'pending' },
  { id: 'approved-1', status: 'approved' },
  { id: 'rejected-1', status: 'rejected' },
  { id: 'dropped-1', status: 'dropped' }
];

describe('Trials queue navigation', () => {
  it('defaults to Pending and counts active versus history records', () => {
    assert.equal(normalizeTrialsView('unknown'), TRIALS_VIEWS.PENDING);
    assert.deepEqual(getTrialsViewCounts(trials), {
      pending: 1,
      history: 3,
      all: 4
    });
    assert.deepEqual(
      filterTrialsForView(trials).map(({ id }) => id),
      ['pending-1']
    );
  });

  it('keeps approved, rejected, and dropped records in History', () => {
    assert.deepEqual(
      filterTrialsForView(trials, { view: 'history' }).map(({ id }) => id),
      ['approved-1', 'rejected-1', 'dropped-1']
    );
    assert.deepEqual(
      filterTrialsForView(trials, { view: 'history', historyStatus: 'dropped' }).map(({ id }) => id),
      ['dropped-1']
    );
  });

  it('shows every record only when All is deliberately selected', () => {
    assert.deepEqual(
      filterTrialsForView(trials, { view: 'all' }).map(({ id }) => id),
      trials.map(({ id }) => id)
    );
  });

  it('renders Pending, History, and All as the primary queue navigation', async () => {
    const html = await readFile(new URL('../admin/admin.html', import.meta.url), 'utf8');

    assert.match(html, /data-trials-view="pending"/);
    assert.match(html, /data-trials-view="history"/);
    assert.match(html, /data-trials-view="all"/);
    assert.match(html, /data-trials-view="pending"[^>]*>[\s\S]*Pending/);
    assert.match(html, /<details class="admin-trial-create">/);
    assert.doesNotMatch(html, /id="trials-status-filter"/);
  });

  it('loads the permitted team once and filters views locally', async () => {
    const source = await readFile(new URL('../admin/js/admin.js', import.meta.url), 'utf8');
    const loadStart = source.indexOf('async function loadTrials()');
    const loadEnd = source.indexOf('async function handleAddTrial()', loadStart);
    const loadBlock = source.slice(loadStart, loadEnd);

    assert.match(loadBlock, /teamId: trialsTeamFilter\.value \|\| undefined/);
    assert.doesNotMatch(loadBlock, /status:/);
    assert.match(source, /status === 'pending'\) card\.appendChild\(createPendingTrialActions\(trial\)\)/);
    assert.match(source, /Trial dropped and kept in History\./);
  });

  it('records drop and reject transition metadata instead of deleting records', async () => {
    const source = await readFile(new URL('../js/services/trials.service.js', import.meta.url), 'utf8');
    const statusStart = source.indexOf('export async function setTrialStatus');
    const statusEnd = source.indexOf('export async function approveTrialToRoster', statusStart);
    const statusBlock = source.slice(statusStart, statusEnd);

    assert.match(statusBlock, /droppedAt = serverTimestamp\(\)/);
    assert.match(statusBlock, /droppedBy = performedBy/);
    assert.match(statusBlock, /rejectedAt = serverTimestamp\(\)/);
    assert.match(statusBlock, /rejectedBy = performedBy/);
    assert.match(statusBlock, /await updateTrial/);
    assert.doesNotMatch(statusBlock, /delete/);
  });

  it('keeps the compact queue responsive on mobile', async () => {
    const css = await readFile(new URL('../css/admin.css', import.meta.url), 'utf8');
    const mobile = css.slice(css.indexOf('@media (max-width: 640px)'));

    assert.match(css, /\.admin-trials-tabs/);
    assert.match(css, /\.admin-trial-card__header/);
    assert.match(css, /\.admin-trial-approval__grid/);
    assert.match(mobile, /\.admin-trials-toolbar\s*\{[\s\S]*grid-template-columns: 1fr/);
    assert.match(mobile, /\.admin-trial-approval__grid\s*\{[\s\S]*grid-template-columns: 1fr/);
  });
});
