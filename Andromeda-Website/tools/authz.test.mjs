import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_PERMISSIONS,
  authzHasAnyPermission,
  canManageStaffRole,
  canAccessTeam,
  canAccessTeamTransition,
  getAssignableStaffRoles,
  getScopedTeamId,
  isValidTeamId,
  roleRequiresTeamAssignment,
  resolveStaffAccessSnapshot
} from '../js/services/staff-roles.js';

const user = {
  uid: 'user-1',
  email: 'person@example.com',
  displayName: 'Person Example'
};

function accessFor(staffRecord, extras = {}) {
  return resolveStaffAccessSnapshot({
    user,
    staffRecord,
    allowlisted: false,
    tokenClaims: {},
    ...extras
  });
}

describe('staff role authorization matrix', () => {
  it('denies public users', () => {
    const authz = resolveStaffAccessSnapshot();
    assert.equal(authz.isAuthenticated, false);
    assert.equal(authz.isAuthorized, false);
    assert.equal(authz.role, null);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.ADMIN_ACCESS]), false);
  });

  it('denies authenticated users without staff, allowlist, or claims', () => {
    const authz = accessFor(null);
    assert.equal(authz.isAuthenticated, true);
    assert.equal(authz.isAuthorized, false);
    assert.equal(authz.role, null);
  });

  it('treats legacy allowlisted users as admins when no staff record exists', () => {
    const authz = accessFor(null, { allowlisted: true });
    assert.equal(authz.role, 'admin');
    assert.equal(authz.source, 'legacyAllowlist');
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TOURNAMENTS_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_MANAGE]), false);
  });

  it('does not let an inactive staff record fall back to legacy allowlist', () => {
    const authz = accessFor(
      { email: user.email, role: 'admin', active: false },
      { allowlisted: true }
    );
    assert.equal(authz.isAuthorized, false);
    assert.equal(authz.inactiveStaffRecord, true);
    assert.equal(authz.role, null);
  });

  it('allows media users to publish media without roster access', () => {
    const authz = accessFor({ email: user.email, role: 'media', active: true });
    assert.equal(authz.role, 'media');
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MEDIA_HUB_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STORAGE_UPLOAD]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.ROSTERS_WRITE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), false);
  });

  it('limits Polaris managers to Polaris team operations', () => {
    const authz = accessFor({
      email: user.email,
      role: 'manager',
      active: true,
      teamId: 'polaris'
    });
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.ROSTERS_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TRIALS_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.EVENTS_WRITE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_MANAGE]), false);
    assert.equal(canAccessTeam(authz, 'polaris'), true);
    assert.equal(canAccessTeam(authz, 'spiral'), false);
    assert.equal(getScopedTeamId(authz, ''), 'polaris');
    assert.equal(getScopedTeamId(authz, 'spiral'), null);
  });

  it('denies team operations to managers without an assigned team', () => {
    const authz = accessFor({ email: user.email, role: 'manager', active: true });
    assert.equal(canAccessTeam(authz, ''), false);
    assert.equal(canAccessTeam(authz, 'polaris'), false);
    assert.equal(getScopedTeamId(authz, ''), null);
  });

  it('blocks managers from cross-team roster, trial, and match transitions', () => {
    const authz = accessFor({
      email: user.email,
      role: 'manager',
      active: true,
      teamId: 'polaris'
    });
    assert.equal(canAccessTeamTransition(authz, 'polaris', 'polaris'), true);
    assert.equal(canAccessTeamTransition(authz, 'polaris', 'spiral'), false);
    assert.equal(canAccessTeamTransition(authz, 'spiral', 'polaris'), false);
  });

  it('limits captains to their assigned team', () => {
    const authz = accessFor({
      email: user.email,
      role: 'captain',
      active: true,
      teamId: 'horizon'
    });
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.ROSTERS_WRITE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TRIALS_WRITE]), false);
    assert.equal(canAccessTeam(authz, 'horizon'), true);
    assert.equal(canAccessTeam(authz, 'spiral'), false);
    assert.equal(getScopedTeamId(authz, ''), 'horizon');
    assert.equal(getScopedTeamId(authz, 'spiral'), null);
    assert.equal(canAccessTeamTransition(authz, 'horizon', 'horizon'), true);
    assert.equal(canAccessTeamTransition(authz, 'spiral', 'horizon'), false);
  });

  it('requires team assignments for Manager and Captain staff records', () => {
    assert.equal(roleRequiresTeamAssignment('manager'), true);
    assert.equal(roleRequiresTeamAssignment('captain'), true);
    assert.equal(roleRequiresTeamAssignment('media'), false);
    assert.equal(roleRequiresTeamAssignment('admin'), false);
    assert.equal(isValidTeamId('polaris'), true);
    assert.equal(isValidTeamId('not-a-team'), false);
  });

  it('gives admins broad oversight access without staff management', () => {
    const authz = accessFor({ email: user.email, role: 'admin', active: true });
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.ROSTERS_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MEDIA_HUB_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TOURNAMENTS_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.AUDIT_LOGS_READ]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_MANAGE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_INVITE]), false);
    assert.deepEqual(getAssignableStaffRoles(authz.role), []);
    assert.equal(canAccessTeam(authz, 'horizon'), true);
    assert.equal(canAccessTeam(authz, 'polaris'), true);
    assert.equal(canAccessTeamTransition(authz, 'horizon', 'polaris'), true);
  });

  it('keeps owners on broad operational access without root staff management', () => {
    const authz = accessFor({ email: user.email, role: 'owner', active: true });
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_MANAGE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_INVITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_MANAGE_OPERATIONAL]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TOURNAMENTS_WRITE]), true);
    assert.deepEqual(getAssignableStaffRoles(authz.role), ['media', 'manager', 'captain']);
    assert.equal(canManageStaffRole(authz.role, 'manager'), true);
    assert.equal(canManageStaffRole(authz.role, 'admin'), false);
    assert.equal(canManageStaffRole(authz.role, 'owner'), false);
    assert.equal(canAccessTeam(authz, 'octantis'), true);
    assert.equal(canAccessTeamTransition(authz, 'octantis', 'polaris'), true);
  });

  it('reserves staff management and full access for super admins', () => {
    const authz = accessFor({ email: user.email, role: 'superadmin', active: true });
    assert.equal(authz.isSuperAdmin, true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_MANAGE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.STAFF_INVITE]), true);
    assert.deepEqual(getAssignableStaffRoles(authz.role), [
      'superadmin',
      'owner',
      'admin',
      'media',
      'manager',
      'captain'
    ]);
    assert.equal(canManageStaffRole(authz.role, 'superadmin'), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TOURNAMENTS_WRITE]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.AUDIT_LOGS_READ]), true);
    assert.equal(canAccessTeam(authz, 'octantis'), true);
    assert.equal(canAccessTeamTransition(authz, 'octantis', 'polaris'), true);
  });

  it('does not let inactive staff fall back to scoped token claims', () => {
    const authz = accessFor(
      { email: user.email, role: 'manager', active: false, teamId: 'polaris' },
      { tokenClaims: { role: 'manager', teamId: 'polaris' } }
    );
    assert.equal(authz.isAuthorized, false);
    assert.equal(canAccessTeam(authz, 'polaris'), false);
  });
});
