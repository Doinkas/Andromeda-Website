import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_APPLICATION_PERMISSIONS,
  STAFF_PERMISSIONS,
  authzHasAnyPermission,
  authzHasAllPermissions,
  authzHasRole,
  canManageStaffRole,
  canAccessTeam,
  canAccessTeamTransition,
  getAssignableStaffRoles,
  getScopedTeamId,
  isValidTeamId,
  roleRequiresTeamAssignment,
  resolveClaimRole,
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
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_REPORT]), true);
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

  it('keeps Captain rosters read-only while allowing assigned-team Trials', () => {
    const authz = accessFor({
      email: user.email,
      role: 'captain',
      active: true,
      teamId: 'horizon'
    });
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_WRITE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.MATCHES_REPORT]), true);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.EVENTS_WRITE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.ROSTERS_WRITE]), false);
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TRIALS_WRITE]), true);
    assert.equal(canAccessTeam(authz, 'horizon'), true);
    assert.equal(getScopedTeamId(authz, ''), 'horizon');
    assert.equal(canAccessTeamTransition(authz, 'horizon', 'horizon'), true);
  });

  it('blocks captains from another team\'s Trials and team operations', () => {
    const authz = accessFor({
      email: user.email,
      role: 'captain',
      active: true,
      teamId: 'horizon'
    });
    assert.equal(canAccessTeam(authz, 'spiral'), false);
    assert.equal(getScopedTeamId(authz, 'spiral'), null);
    assert.equal(canAccessTeamTransition(authz, 'horizon', 'spiral'), false);
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

  it('keeps /admin/ access limited to active valid staff roles', () => {
    for (const role of ['superadmin', 'owner', 'admin', 'media', 'manager', 'captain']) {
      const teamId = roleRequiresTeamAssignment(role) ? 'polaris' : null;
      const authz = accessFor({ email: user.email, role, active: true, teamId });
      assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.ADMIN_ACCESS]), true);
    }

    const inactive = accessFor({ email: user.email, role: 'admin', active: false });
    const viewer = accessFor({ email: user.email, role: 'viewer', active: true });

    assert.equal(authzHasAnyPermission(inactive, [STAFF_PERMISSIONS.ADMIN_ACCESS]), false);
    assert.equal(authzHasAnyPermission(viewer, [STAFF_PERMISSIONS.ADMIN_ACCESS]), false);
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

  it('gives Super Admin every current application capability', () => {
    const authz = accessFor({ email: user.email, role: 'superadmin', active: true });

    assert.deepEqual(authz.permissions, ALL_APPLICATION_PERMISSIONS);
    assert.equal(authzHasAllPermissions(authz, ALL_APPLICATION_PERMISSIONS), true);

    for (const permission of ALL_APPLICATION_PERMISSIONS) {
      assert.equal(authzHasAnyPermission(authz, [permission]), true, permission);
    }
  });

  it('allows Super Admin Match Ops and Event CRUD permissions', () => {
    const authz = accessFor({ email: user.email, role: 'superadmin', active: true });
    const operations = [
      ['view Match Ops', STAFF_PERMISSIONS.MATCHES_WRITE],
      ['create Match', STAFF_PERMISSIONS.MATCHES_WRITE],
      ['edit Match', STAFF_PERMISSIONS.MATCHES_WRITE],
      ['delete Match', STAFF_PERMISSIONS.MATCHES_WRITE],
      ['create Event', STAFF_PERMISSIONS.EVENTS_WRITE],
      ['edit Event', STAFF_PERMISSIONS.EVENTS_WRITE],
      ['delete Event', STAFF_PERMISSIONS.EVENTS_WRITE],
      ['access Team Ops', STAFF_PERMISSIONS.ROSTERS_WRITE]
    ];

    for (const [operation, permission] of operations) {
      assert.equal(authzHasAnyPermission(authz, [permission]), true, operation);
    }
  });

  it('does not downgrade an explicit Super Admin claim because of a legacy Captain flag', () => {
    assert.equal(resolveClaimRole({ role: 'superadmin', captain: true }), 'superadmin');
    assert.equal(resolveClaimRole({ roles: ['captain', 'superadmin'], captain: true }), 'superadmin');

    const authz = accessFor(null, {
      tokenClaims: { role: 'superadmin', captain: true }
    });
    assert.equal(authz.role, 'superadmin');
    assert.equal(authzHasAnyPermission(authz, [STAFF_PERMISSIONS.EVENTS_WRITE]), true);
    assert.equal(canAccessTeam(authz, 'polaris'), true);
  });

  it('lets authorized Super Admin bypass incomplete consumer capability arrays', () => {
    const incompleteAuthz = {
      role: 'superadmin',
      isSuperAdmin: true,
      isAuthorized: true,
      permissions: []
    };

    assert.equal(authzHasRole(incompleteAuthz, ['manager']), true);
    assert.equal(authzHasAnyPermission(incompleteAuthz, [STAFF_PERMISSIONS.EVENTS_WRITE]), true);
    assert.equal(authzHasAllPermissions(incompleteAuthz, [
      STAFF_PERMISSIONS.MATCHES_WRITE,
      STAFF_PERMISSIONS.EVENTS_WRITE,
      STAFF_PERMISSIONS.ROSTERS_WRITE
    ]), true);
    assert.equal(canAccessTeam(incompleteAuthz, 'polaris'), true);
    assert.equal(authzHasAnyPermission(incompleteAuthz, ['unknown:permission']), false);

    const spoofedFlag = {
      role: 'admin',
      isSuperAdmin: true,
      isAuthorized: true,
      permissions: []
    };
    assert.equal(authzHasAnyPermission(spoofedFlag, [STAFF_PERMISSIONS.EVENTS_WRITE]), false);
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
