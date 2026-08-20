import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  STAFF_PERMISSIONS,
  authzHasAnyPermission,
  canAccessTeam,
  resolveStaffAccessSnapshot
} from '../js/services/staff-roles.js';

const user = { uid: 'ops-user', email: 'ops@example.com', displayName: 'Ops User' };

function accessFor(role, teamId = null) {
  return resolveStaffAccessSnapshot({
    user,
    staffRecord: { name: 'Ops User', email: user.email, role, teamId, active: true }
  });
}

describe('Match and Event authorization', () => {
  it('lets Super Admin, Owner, and Admin manage Matches and Events', () => {
    for (const role of ['superadmin', 'owner', 'admin']) {
      const authz = accessFor(role);
      assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), true, role);
      assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.EVENTS_WRITE]), true, role);
      assert.equal(canAccessTeam(authz, 'polaris'), true, role);
      assert.equal(canAccessTeam(authz, 'spiral'), true, role);
    }
  });

  it('keeps Manager Match administration assigned-team scoped', () => {
    const authz = accessFor('manager', 'polaris');
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.EVENTS_WRITE]), false);
    assert.equal(canAccessTeam(authz, 'polaris'), true);
    assert.equal(canAccessTeam(authz, 'spiral'), false);
  });

  it('gives Captain assigned-team reporting without Match or Event administration', () => {
    const authz = accessFor('captain', 'polaris');
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_READ]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_REPORT]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.EVENTS_WRITE]), false);
    assert.equal(canAccessTeam(authz, 'polaris'), true);
    assert.equal(canAccessTeam(authz, 'spiral'), false);
  });

  it('does not grant Match/Event operations to Media or unauthorized users', () => {
    for (const authz of [accessFor('media'), resolveStaffAccessSnapshot({ user })]) {
      assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), false);
      assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_REPORT]), false);
      assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.EVENTS_WRITE]), false);
    }
  });

  it('does not pre-read a nonexistent Match before create', async () => {
    const source = await readFile(new URL('../js/services/matches.service.js', import.meta.url), 'utf8');
    assert.match(source, /const existing = match\.id \? await getDoc\(matchDoc\) : null/);
    assert.doesNotMatch(source, /const existingSnapshots = await Promise\.all/);
  });

  it('removes hidden Match requirements in Event mode and gates create controls', async () => {
    const [calendarJs, calendarHtml] = await Promise.all([
      readFile(new URL('../admin/js/admin-calendar.js', import.meta.url), 'utf8'),
      readFile(new URL('../admin/calendar.html', import.meta.url), 'utf8')
    ]);

    assert.match(calendarJs, /modalTeam\.removeAttribute\('required'\)/);
    assert.match(calendarJs, /modalTeam\.setAttribute\('required', ''\)/);
    assert.match(calendarJs, /canManageMatches = authzHasAnyPermission/);
    assert.match(calendarJs, /saveAdminMatchReport/);
    assert.match(calendarHtml, /id="calendar-detail-add-match"[^>]+data-admin-permissions-visible="matches:write"/);
    assert.match(calendarHtml, /id="calendar-detail-add-event"[^>]+data-admin-permissions-visible="events:write"/);
    assert.match(calendarHtml, /data-admin-permissions="matches:read"/);
  });

  it('logs safe operation context for Calendar failures', async () => {
    const source = await readFile(new URL('../admin/js/admin-calendar.js', import.meta.url), 'utf8');
    assert.match(source, /operation,/);
    assert.match(source, /collection: collectionName/);
    assert.match(source, /code: error\?\.code/);
    assert.match(source, /teamId:/);
    assert.match(source, /role: adminRole/);
    assert.match(source, /Could not save \$\{type\}\. Please try again\./);
  });

  it('keeps the Match/Event editor open when the backdrop is clicked', async () => {
    const [calendarJs, calendarHtml] = await Promise.all([
      readFile(new URL('../admin/js/admin-calendar.js', import.meta.url), 'utf8'),
      readFile(new URL('../admin/calendar.html', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(calendarJs, /matchModal\.addEventListener\('click'/);
    assert.match(calendarJs, /modalClose\.addEventListener\('click', closeModal\)/);
    assert.match(calendarJs, /modalCancel\.addEventListener\('click', closeModal\)/);
    assert.match(calendarHtml, /id="match-modal"[^>]+role="dialog"[^>]+aria-modal="true"/);
  });
});
