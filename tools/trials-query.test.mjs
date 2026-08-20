import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { TEAM_IDS } from '../js/config/teams.config.js';
import { resolveStaffAccessSnapshot } from '../js/services/staff-roles.js';
import {
  applyTrialsReadPlan,
  buildTrialsReadPlan
} from '../js/services/trials-query.js';

const user = {
  uid: 'trials-user',
  email: 'trials@example.com',
  displayName: 'Trials User'
};

function accessFor(role, teamId = null) {
  return resolveStaffAccessSnapshot({
    user,
    staffRecord: {
      email: user.email,
      role,
      active: true,
      teamId
    }
  });
}

function timestamp(millis) {
  return { toMillis: () => millis };
}

const trialRecords = [
  { id: 'polaris-old', teamId: 'polaris', status: 'pending', createdAt: timestamp(100) },
  { id: 'spiral-new', teamId: 'spiral', status: 'approved', createdAt: timestamp(300) },
  { id: 'polaris-new', teamId: 'polaris', status: 'approved', createdAt: timestamp(200) }
];

describe('Trials read planning', () => {
  it('lets Super Admin load trials across every known team without an assigned team', () => {
    const plan = buildTrialsReadPlan(accessFor('superadmin'));
    assert.equal(plan.scopedTeamId, '');
    assert.deepEqual(plan.teamIds, TEAM_IDS);
    assert.deepEqual(
      applyTrialsReadPlan(trialRecords, plan).map(({ id }) => id),
      ['spiral-new', 'polaris-new', 'polaris-old']
    );
  });

  it('preserves organization-wide Owner and Admin trial access', () => {
    for (const role of ['owner', 'admin']) {
      const plan = buildTrialsReadPlan(accessFor(role));
      assert.equal(plan.scopedTeamId, '', role);
      assert.deepEqual(plan.teamIds, TEAM_IDS, role);
    }
  });

  it('limits a Manager query and its results to the assigned team', () => {
    const authz = accessFor('manager', 'polaris');
    const plan = buildTrialsReadPlan(authz);
    assert.deepEqual(plan.teamIds, ['polaris']);
    assert.deepEqual(
      applyTrialsReadPlan(trialRecords, plan).map(({ id }) => id),
      ['polaris-new', 'polaris-old']
    );
    assert.throws(
      () => buildTrialsReadPlan(authz, { teamId: 'spiral' }),
      /not authorized to view trials for this team/i
    );
  });

  it('limits a Captain query and its results to the assigned team', () => {
    const authz = accessFor('captain', 'spiral');
    const plan = buildTrialsReadPlan(authz);
    assert.deepEqual(plan.teamIds, ['spiral']);
    assert.deepEqual(
      applyTrialsReadPlan(trialRecords, plan).map(({ id }) => id),
      ['spiral-new']
    );
    assert.throws(
      () => buildTrialsReadPlan(authz, { teamId: 'polaris' }),
      /not authorized to view trials for this team/i
    );
  });

  it('shows a newly created trial on the next refresh and applies status filters', () => {
    const plan = buildTrialsReadPlan(accessFor('manager', 'polaris'), { status: 'pending' });
    const beforeRefresh = applyTrialsReadPlan(trialRecords, plan);
    const afterRefresh = applyTrialsReadPlan([
      ...trialRecords,
      { id: 'just-created', teamId: 'polaris', status: 'pending', createdAt: timestamp(400) }
    ], plan);

    assert.deepEqual(beforeRefresh.map(({ id }) => id), ['polaris-old']);
    assert.deepEqual(afterRefresh.map(({ id }) => id), ['just-created', 'polaris-old']);
  });

  it('treats an empty permitted snapshot as an empty result', () => {
    const plan = buildTrialsReadPlan(accessFor('captain', 'horizon'));
    assert.deepEqual(applyTrialsReadPlan([], plan), []);
  });

  it('uses the same collection for writes and team-only indexed reads', async () => {
    const serviceSource = await readFile(
      new URL('../js/services/trials.service.js', import.meta.url),
      'utf8'
    );

    assert.match(serviceSource, /const trialsCollection = collection\(db, 'trials'\)/);
    assert.match(serviceSource, /const trialRef = doc\(trialsCollection\)/);
    assert.match(serviceSource, /where\('teamId', '==', readPlan\.scopedTeamId\)/);
    assert.match(serviceSource, /where\('teamId', 'in', readPlan\.teamIds\)/);
    assert.doesNotMatch(serviceSource, /where\('status'/);
    assert.doesNotMatch(serviceSource, /orderBy\(/);
  });
});
