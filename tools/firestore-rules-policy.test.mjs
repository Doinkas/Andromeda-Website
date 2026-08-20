import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = rules.indexOf(startMarker);
  const end = rules.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing rules section: ${startMarker}`);
  assert.notEqual(end, -1, `Missing rules section boundary: ${endMarker}`);
  return rules.slice(start, end);
}

describe('Firestore team-scoped roster and trial policy', () => {
  it('keeps Super Admin as a central override for staff records and token claims', () => {
    const staffRoleHelper = section('function activeStaffHasAnyRole(roles)', 'function tokenHasAnyRole(roles)');
    const tokenRoleHelper = section('function tokenHasAnyRole(roles)', 'function isLegacyAllowlistedAdmin()');

    assert.match(staffRoleHelper, /staffData\(\)\.role == 'superadmin'/);
    assert.match(tokenRoleHelper, /tokenRole == 'superadmin'/);
    assert.match(tokenRoleHelper, /tokenRoles\.hasAny\(\['superadmin'\]\)/);
  });

  it('keeps Manager and Captain match/trial access behind assigned-team matching', () => {
    const helper = section('function canManageTeam(teamId)', 'function rosterTeamId(teamId)');

    assert.match(helper, /hasAnyRole\(\['owner', 'admin'\]\)/);
    assert.match(helper, /hasAnyRole\(\['manager', 'captain'\]\)/);
    assert.match(helper, /assignedTeamMatches\(teamId\)/);
    assert.doesNotMatch(helper, /media/);
  });

  it('keeps roster writes Manager-scoped and excludes Captain', () => {
    const rosterHelper = section('function canManageRoster(teamId)', 'function validStaffAccessData()');
    const rosterRules = section('match /rosters/{teamId}', 'match /trials/{trialId}');

    assert.match(rosterHelper, /hasAnyRole\(\['manager'\]\)/);
    assert.match(rosterHelper, /assignedTeamMatches\(rosterTeamId\(teamId\)\)/);
    assert.doesNotMatch(rosterHelper, /captain/);
    assert.match(
      rosterRules,
      /allow create, update: if validTeamId\(teamId\) && canManageRoster\(teamId\);/
    );
    assert.match(rosterRules, /allow delete: if canManageRoster\(teamId\);/);
  });

  it('checks both old and new trial teamId values on updates', () => {
    const trialRules = section('match /trials/{trialId}', 'match /matches/{matchId}');

    assert.match(trialRules, /allow read: if canManageTeam\(resource\.data\.teamId\);/);
    assert.match(trialRules, /allow create: if canManageTeam\(request\.resource\.data\.teamId\);/);
    assert.match(trialRules, /allow update: if canManageTeam\(resource\.data\.teamId\)/);
    assert.match(trialRules, /&& canManageTeam\(request\.resource\.data\.teamId\)/);
    assert.match(trialRules, /resource\.data\.teamId == request\.resource\.data\.teamId/);
    assert.match(trialRules, /allow delete: if canManageTeam\(resource\.data\.teamId\);/);
  });

  it('allows organization roles and assigned Managers to administer Matches', () => {
    const matchHelper = section('function canManageMatch(teamId)', 'function captainReportsAssignedMatch()');
    const matchRules = section('match /matches/{matchId}', 'match /events/{eventId}');
    const eventRules = section('match /events/{eventId}', 'match /tournaments/{tournamentId}');

    assert.match(matchHelper, /hasAnyRole\(\['owner', 'admin'\]\)/);
    assert.match(matchHelper, /hasAnyRole\(\['manager'\]\)/);
    assert.doesNotMatch(matchHelper, /captain/);
    assert.match(matchRules, /allow create: if canManageMatch\(request\.resource\.data\.teamId\);/);
    assert.match(matchRules, /canManageMatch\(resource\.data\.teamId\)/);
    assert.match(matchRules, /canManageMatch\(request\.resource\.data\.teamId\)/);
    assert.match(matchRules, /allow delete: if canManageMatch\(resource\.data\.teamId\);/);
    assert.match(eventRules, /allow create, update, delete: if hasAnyRole\(\['owner', 'admin'\]\);/);
  });

  it('limits Captain match updates to assigned-team report fields', () => {
    const reportHelper = section('function captainReportsAssignedMatch()', 'function rosterTeamId(teamId)');
    const matchRules = section('match /matches/{matchId}', 'match /events/{eventId}');

    assert.match(reportHelper, /hasAnyRole\(\['captain'\]\)/);
    assert.match(reportHelper, /assignedTeamMatches\(resource\.data\.teamId\)/);
    assert.match(reportHelper, /resource\.data\.teamId == request\.resource\.data\.teamId/);
    assert.match(reportHelper, /affectedKeys\(\)\.hasOnly/);
    assert.doesNotMatch(reportHelper, /opponent/);
    assert.doesNotMatch(reportHelper, /scheduledAt/);
    assert.match(matchRules, /\|\| captainReportsAssignedMatch\(\);/);
  });

  it('allows first-login staff to update only their display-name setup fields', () => {
    const nameSetupHelper = section('function staffCompletesOwnName(staffUid)', 'function ownerUpdatesOperationalStaff()');
    const staffRules = section('match /staffAccess/{staffUid}', 'match /staffInvites/{inviteId}');

    assert.match(nameSetupHelper, /request\.auth\.uid == staffUid/);
    assert.match(nameSetupHelper, /validStaffDisplayName\(request\.resource\.data\.name\)/);
    assert.match(nameSetupHelper, /request\.resource\.data\.nameSetupComplete == true/);
    assert.match(nameSetupHelper, /affectedKeys\(\)\.hasOnly/);
    assert.doesNotMatch(nameSetupHelper, /'role'/);
    assert.doesNotMatch(nameSetupHelper, /'teamId'/);
    assert.doesNotMatch(nameSetupHelper, /'active'/);
    assert.doesNotMatch(nameSetupHelper, /'email'/);
    assert.match(staffRules, /staffCompletesOwnName\(staffUid\)/);
  });
});
