import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { getRosterWorkflowState } from '../admin/js/roster-workflow-state.js';
import {
  buildOrganizationReviewQueue,
  canViewOrganizationReview
} from '../js/services/review-queue.js';

describe('Roster save and verification workflow', () => {
  it('uses one Save Changes action after the editor and before verification', async () => {
    const html = await readFile(new URL('../admin/admin.html', import.meta.url), 'utf8');

    assert.match(html, />Save Changes<\/button>/);
    assert.doesNotMatch(html, />Save Roster<\/button>/);
    assert.equal((html.match(/id="save-roster-btn"/g) || []).length, 1);
    assert.ok(html.indexOf('id="trials-heading"') < html.indexOf('class="admin-save-bar"'));
    assert.ok(html.indexOf('class="admin-save-bar"') < html.indexOf('id="roster-verification"'));
  });

  it('marks changed work unsaved and enables only the save action', () => {
    const state = getRosterWorkflowState({
      hasWriteAccess: true,
      hasSelectedTeam: true,
      hasUnsavedChanges: true
    });

    assert.equal(state.saveStatus, 'Unsaved changes');
    assert.equal(state.saveDisabled, false);
    assert.equal(state.verifyDisabled, true);
    assert.equal(state.verificationGuidance, 'Save your changes before verifying the roster.');
  });

  it('marks clean work saved, disables save, and enables verification', () => {
    const state = getRosterWorkflowState({
      hasWriteAccess: true,
      hasSelectedTeam: true,
      hasUnsavedChanges: false
    });

    assert.equal(state.saveStatus, 'All changes saved');
    assert.equal(state.saveDisabled, true);
    assert.equal(state.verifyDisabled, false);
  });

  it('keeps save and verification disabled while loading or saving', () => {
    const loading = getRosterWorkflowState({
      hasWriteAccess: true,
      hasSelectedTeam: true,
      hasUnsavedChanges: true,
      isLoading: true
    });
    const saving = getRosterWorkflowState({
      hasWriteAccess: true,
      hasSelectedTeam: true,
      hasUnsavedChanges: true,
      isSaving: true
    });

    assert.equal(loading.saveDisabled, true);
    assert.equal(loading.verifyDisabled, true);
    assert.equal(saving.saveLabel, 'Saving...');
    assert.equal(saving.verifyDisabled, true);
  });

  it('detects profile-list edits and retains edits when a save fails', async () => {
    const source = await readFile(new URL('../admin/js/admin.js', import.meta.url), 'utf8');
    const saveStart = source.indexOf('async function confirmRosterSave()');
    const verifyStart = source.indexOf('async function handleVerifyRoster()', saveStart);
    const saveBlock = source.slice(saveStart, verifyStart);
    const catchStart = saveBlock.indexOf('} catch (error) {');
    const finallyStart = saveBlock.indexOf('} finally {', catchStart);
    const catchBlock = saveBlock.slice(catchStart, finallyStart);

    assert.match(source, /\['highlights', 'Highlights'\]/);
    assert.match(source, /\['achievements', 'Achievements'\]/);
    assert.ok(saveBlock.indexOf('await saveRoster(') < saveBlock.indexOf('savedRosterSnapshot ='));
    assert.doesNotMatch(catchBlock, /currentRoster\s*=/);
    assert.doesNotMatch(catchBlock, /savedRosterSnapshot\s*=/);
    assert.doesNotMatch(catchBlock, /loadRoster\(/);
    assert.match(catchBlock, /Your edits are still here/);
  });

  it('guards verification with the same unsaved-change state', async () => {
    const source = await readFile(new URL('../admin/js/admin.js', import.meta.url), 'utf8');
    const verifyStart = source.indexOf('async function handleVerifyRoster()');
    const verifyEnd = source.indexOf('function handleAddPlayer()', verifyStart);
    const verifyBlock = source.slice(verifyStart, verifyEnd);

    assert.match(verifyBlock, /changes\.hasChanges/);
    assert.match(verifyBlock, /Save your changes before verifying the roster\./);
    assert.ok(verifyBlock.indexOf('changes.hasChanges') < verifyBlock.indexOf('await verifyRoster(selectedTeam)'));
  });
});

describe('Organization Needs Review queue', () => {
  it('is visible only to Super Admin, Owner, and Admin', () => {
    ['superadmin', 'owner', 'admin'].forEach((role) => {
      assert.equal(canViewOrganizationReview({ isAuthorized: true, role }), true, role);
    });
    ['manager', 'captain', 'media'].forEach((role) => {
      assert.equal(canViewOrganizationReview({ isAuthorized: true, role }), false, role);
    });
  });

  it('includes only unverified rosters and links to the selected team', () => {
    const queue = buildOrganizationReviewQueue({
      rosters: [
        { teamId: 'polaris', needsReview: true },
        { teamId: 'spiral', needsReview: false }
      ]
    });

    assert.equal(queue.rosterCount, 1);
    assert.equal(queue.rosterItems[0].teamName, 'Polaris');
    assert.equal(queue.rosterItems[0].href, 'admin.html?team=polaris#roster-verification');
  });

  it('includes only existing pending trial decisions', () => {
    const queue = buildOrganizationReviewQueue({
      trials: [
        { id: 'pending-1', teamId: 'spiral', name: 'Player One', status: 'pending' },
        { id: 'approved-1', teamId: 'polaris', name: 'Player Two', status: 'approved' },
        { id: 'dropped-1', teamId: 'horizon', name: 'Player Three', status: 'dropped' }
      ]
    });

    assert.equal(queue.trialCount, 1);
    assert.equal(queue.trialItems[0].name, 'Player One');
    assert.equal(queue.trialItems[0].status, 'pending');
    assert.equal(queue.trialItems[0].href, 'admin.html?team=spiral#trials-heading');
  });

  it('performs no review reads before the organization-role guard passes', async () => {
    const [html, script, rosterService] = await Promise.all([
      readFile(new URL('../admin/index.html', import.meta.url), 'utf8'),
      readFile(new URL('../admin/js/dashboard-review.js', import.meta.url), 'utf8'),
      readFile(new URL('../js/services/rosters.service.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /data-admin-visible="superadmin,owner,admin"/);
    const handlerStart = script.indexOf("window.addEventListener('admin:authorized'");
    const readsStart = script.indexOf('await Promise.all', handlerStart);
    const guardStart = script.indexOf('if (!canViewOrganizationReview(authz))', handlerStart);
    const guardReturn = script.indexOf('return;', guardStart);
    assert.ok(handlerStart >= 0 && guardStart < guardReturn && guardReturn < readsStart);
    assert.match(script, /listTrials\(\{ status: 'pending' \}\)/);
    assert.match(rosterService, /where\('needsReview', '==', true\)/);
  });

  it('uses a non-sticky mobile save bar and responsive review columns', async () => {
    const css = await readFile(new URL('../css/admin.css', import.meta.url), 'utf8');
    const mobileStart = css.indexOf('@media (max-width: 640px)');
    const mobileCss = css.slice(mobileStart);

    assert.match(css, /\.admin-save-bar\s*\{[\s\S]*position: sticky/);
    assert.match(mobileCss, /\.admin-save-bar\s*\{[\s\S]*position: static/);
    assert.match(css, /\.admin-review-columns/);
    assert.match(mobileCss, /\.admin-verification-panel__content/);
  });
});
