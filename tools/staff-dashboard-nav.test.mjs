import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  STAFF_LOGIN_UNAUTHORIZED_MESSAGE,
  createStaffDashboardNavController
} from '../js/pages/staff-dashboard-nav-controller.js';
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

function createDashboardControllerHarness({
  staffRecord = null,
  signInWithGoogle = async () => {},
  signOutOfFirebase = async () => {}
} = {}) {
  const state = {
    busy: false,
    dashboardVisible: false,
    loginVisible: false,
    lookupUids: [],
    status: '',
    statusError: false,
    statusCanSignOut: false
  };

  const controller = createStaffDashboardNavController({
    onAuthStateChanged(callback) {
      state.authCallback = callback;
      return () => {
        state.authCallback = null;
      };
    },
    signInWithGoogle,
    signOutOfFirebase,
    async getStaffDashboardAccessForUser(authUser) {
      state.lookupUids.push(authUser.uid);
      return {
        staffRecord,
        showDashboard: shouldShowStaffDashboard({ user: authUser, staffRecord })
      };
    },
    setDashboardVisible(isVisible) {
      state.dashboardVisible = isVisible;
    },
    setLoginVisible(isVisible) {
      state.loginVisible = isVisible;
    },
    setLoginBusy(isBusy) {
      state.busy = isBusy;
    },
    setStatus(message, { error = false, canSignOut = false } = {}) {
      state.status = message;
      state.statusError = error;
      state.statusCanSignOut = canSignOut;
    },
    clearStatus() {
      state.status = '';
      state.statusError = false;
      state.statusCanSignOut = false;
    }
  });

  return { controller, state };
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

  it('does not look up staffAccess for anonymous auth state', async () => {
    const { controller, state } = createDashboardControllerHarness();

    const result = await controller.handleAuthState(null);

    assert.equal(result.authenticated, false);
    assert.equal(state.dashboardVisible, false);
    assert.equal(state.loginVisible, true);
    assert.deepEqual(state.lookupUids, []);
  });

  it('keeps both staff navigation options hidden while auth state is loading', () => {
    const { controller, state } = createDashboardControllerHarness();
    state.loginVisible = true;
    state.dashboardVisible = true;

    controller.start();

    assert.equal(state.loginVisible, false);
    assert.equal(state.dashboardVisible, false);
  });

  it('starts Google sign-in without doing a staffAccess lookup first', async () => {
    let signInCalls = 0;
    const { controller, state } = createDashboardControllerHarness({
      signInWithGoogle: async () => {
        signInCalls += 1;
      }
    });

    const result = await controller.signIn();

    assert.equal(result, true);
    assert.equal(signInCalls, 1);
    assert.equal(state.busy, true);
    assert.equal(state.status, 'Checking staff access...');
    assert.deepEqual(state.lookupUids, []);
  });

  it('shows Dashboard after an active staff member signs in', async () => {
    const { controller, state } = createDashboardControllerHarness({
      staffRecord: staff('admin')
    });

    await controller.signIn();
    const result = await controller.handleAuthState(user);

    assert.equal(result.showDashboard, true);
    assert.equal(state.dashboardVisible, true);
    assert.equal(state.loginVisible, false);
    assert.equal(state.busy, false);
    assert.equal(state.status, '');
    assert.deepEqual(state.lookupUids, [user.uid]);
  });

  it('restores Dashboard when Firebase reports a persisted staff session', async () => {
    const { controller, state } = createDashboardControllerHarness({
      staffRecord: staff('manager')
    });

    controller.start();
    assert.equal(state.loginVisible, false);
    assert.equal(state.dashboardVisible, false);

    await state.authCallback(user);

    assert.equal(state.loginVisible, false);
    assert.equal(state.dashboardVisible, true);
    assert.deepEqual(state.lookupUids, [user.uid]);
  });

  it('uses the confirmed popup user if auth state does not emit again', async () => {
    const { controller, state } = createDashboardControllerHarness({
      staffRecord: staff('owner'),
      signInWithGoogle: async () => ({ user })
    });

    const result = await controller.signIn();

    assert.equal(result, true);
    assert.equal(state.dashboardVisible, true);
    assert.equal(state.busy, false);
    assert.equal(state.status, '');
    assert.deepEqual(state.lookupUids, [user.uid]);
  });

  it('keeps Dashboard hidden for inactive staff', async () => {
    const { controller, state } = createDashboardControllerHarness({
      staffRecord: staff('admin', { active: false })
    });

    const result = await controller.handleAuthState(user);

    assert.equal(result.showDashboard, false);
    assert.equal(state.dashboardVisible, false);
    assert.equal(state.loginVisible, false);
    assert.equal(state.status, STAFF_LOGIN_UNAUTHORIZED_MESSAGE);
    assert.equal(state.statusError, true);
    assert.equal(state.statusCanSignOut, true);
  });

  it('keeps Dashboard hidden for signed-in users without staff access', async () => {
    const { controller, state } = createDashboardControllerHarness();

    const result = await controller.handleAuthState(user);

    assert.equal(result.showDashboard, false);
    assert.equal(state.dashboardVisible, false);
    assert.equal(state.loginVisible, false);
    assert.equal(state.status, STAFF_LOGIN_UNAUTHORIZED_MESSAGE);
    assert.equal(state.statusCanSignOut, true);
    assert.deepEqual(state.lookupUids, [user.uid]);
  });

  it('removes Dashboard after sign-out', async () => {
    const { controller, state } = createDashboardControllerHarness({
      staffRecord: staff('owner')
    });

    await controller.handleAuthState(user);
    assert.equal(state.dashboardVisible, true);

    await controller.handleAuthState(null);

    assert.equal(state.dashboardVisible, false);
    assert.equal(state.loginVisible, true);
    assert.deepEqual(state.lookupUids, [user.uid]);
  });

  it('uses Firebase sign-out and returns the nav to Staff Login', async () => {
    let harness;
    harness = createDashboardControllerHarness({
      staffRecord: staff('owner'),
      signOutOfFirebase: async () => {
        await harness.state.authCallback(null);
      }
    });

    harness.controller.start();
    await harness.state.authCallback(user);
    assert.equal(harness.state.dashboardVisible, true);

    const result = await harness.controller.signOut();

    assert.equal(result, true);
    assert.equal(harness.state.dashboardVisible, false);
    assert.equal(harness.state.loginVisible, true);
  });
});

describe('staff navigation and unauthorized UI wiring', () => {
  it('places Staff Login in the main navigation instead of the footer', async () => {
    const source = await readFile(
      new URL('../js/pages/staff-dashboard-nav.js', import.meta.url),
      'utf8'
    );

    assert.match(source, /dataSiteNavMenu|data-site-nav-menu/);
    assert.match(source, /data\.staffLogin|data-staff-login/);
    assert.doesNotMatch(source, /querySelector\(['"]footer['"]\)/);
  });

  it('gives unauthorized admin users dashboard, back, home, and sign-out exits', async () => {
    const source = await readFile(
      new URL('../js/admin/admin-gate.ui.js', import.meta.url),
      'utf8'
    );

    assert.match(source, /Back to Dashboard/);
    assert.match(source, /Back to Home/);
    assert.match(source, /data-gate-back/);
    assert.match(source, /data-gate-signout/);
  });

  it('routes admin action visibility through the shared authorization helper', async () => {
    const files = [
      '../admin/js/admin-calendar.js',
      '../admin/js/admin.js',
      '../admin/js/analytics.js',
      '../admin/js/audit-logs.js',
      '../admin/js/media-hub.js'
    ];
    const sources = await Promise.all(
      files.map((file) => readFile(new URL(file, import.meta.url), 'utf8'))
    );

    sources.forEach((source, index) => {
      assert.match(source, /authzHasAnyPermission/, files[index]);
      assert.doesNotMatch(source, /permissions\.includes\(/, files[index]);
    });
  });

  it('keeps Match Ops and Team Ops tied to their real permissions', async () => {
    const dashboard = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
    const teamOps = await readFile(new URL('../admin/admin.html', import.meta.url), 'utf8');

    assert.match(dashboard, /data-admin-permissions-visible="matches:read"/);
    assert.match(dashboard, /data-admin-permissions-visible="rosters:write,trials:write"/);
    assert.match(teamOps, /data-admin-permissions="rosters:write,trials:write"/);
  });
});
