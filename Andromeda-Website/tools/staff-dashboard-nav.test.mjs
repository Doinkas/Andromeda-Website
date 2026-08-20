import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldShowStaffDashboard } from '../js/services/staff-roles.js';

const user = {
  uid: 'staff-user',
  email: 'staff@example.com',
  displayName: 'Staff User'
};

function staff(role, extras = {}) {
  return {
    name: 'Staff User',
    email: user.email,
    role,
    active: true,
    teamId: ['manager', 'captain'].includes(role) ? 'polaris' : null,
    ...extras
  };
}

describe('public Dashboard navigation visibility', () => {
  it('hides Dashboard for anonymous visitors', () => {
    assert.equal(shouldShowStaffDashboard(), false);
  });

  it('hides Dashboard for signed-in users without a staff record', () => {
    assert.equal(shouldShowStaffDashboard({ user, staffRecord: null }), false);
  });

  for (const role of ['media', 'manager', 'captain', 'admin', 'owner', 'superadmin']) {
    it(`shows Dashboard for an active ${role}`, () => {
      assert.equal(shouldShowStaffDashboard({ user, staffRecord: staff(role) }), true);
    });
  }

  it('hides Dashboard for inactive staff', () => {
    assert.equal(shouldShowStaffDashboard({
      user,
      staffRecord: staff('admin', { active: false })
    }), false);
  });

  it('hides Dashboard for an unrecognized role', () => {
    assert.equal(shouldShowStaffDashboard({
      user,
      staffRecord: staff('viewer')
    }), false);
  });

  it('hides Dashboard for a team-scoped role without a valid assignment', () => {
    assert.equal(shouldShowStaffDashboard({
      user,
      staffRecord: staff('manager', { teamId: null })
    }), false);
  });
});
