import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  STAFF_DISPLAY_NAME_MAX_LENGTH,
  getStaffDisplayName,
  needsStaffNameSetup,
  normalizeStaffDisplayName,
  validateStaffDisplayName
} from '../js/services/staff-identity.js';
import { resolveStaffAccessSnapshot } from '../js/services/staff-roles.js';

describe('staff display identity', () => {
  it('uses staffAccess name, Google display name, then email', () => {
    assert.equal(getStaffDisplayName({
      staffName: 'Whozi',
      firebaseDisplayName: 'Google Name',
      email: 'staff@example.com'
    }), 'Whozi');
    assert.equal(getStaffDisplayName({
      firebaseDisplayName: 'Google Name',
      email: 'staff@example.com'
    }), 'Google Name');
    assert.equal(getStaffDisplayName({ email: 'staff@example.com' }), 'staff@example.com');
  });

  it('trims and validates the chosen name', () => {
    assert.equal(normalizeStaffDisplayName('  Whozi   Prime  '), 'Whozi Prime');
    assert.equal(validateStaffDisplayName(' Whozi '), 'Whozi');
    assert.throws(() => validateStaffDisplayName('   '), /enter the name/i);
    assert.throws(
      () => validateStaffDisplayName('x'.repeat(STAFF_DISPLAY_NAME_MAX_LENGTH + 1)),
      /characters or fewer/i
    );
    assert.throws(() => validateStaffDisplayName('Whozi\nAdmin'), /unsupported characters/i);
  });

  it('requires setup for newly invited staff and unnamed legacy staff', () => {
    assert.equal(needsStaffNameSetup({ name: 'Invite Name', nameSetupComplete: false }), true);
    assert.equal(needsStaffNameSetup({ name: '', nameSetupComplete: null }), true);

    const legacyAuthz = resolveStaffAccessSnapshot({
      user: { uid: 'legacy-uid', email: 'legacy@example.com', displayName: 'Google Prefill' },
      staffRecord: {
        name: '',
        email: 'legacy@example.com',
        role: 'admin',
        teamId: null,
        active: true
      }
    });
    assert.equal(legacyAuthz.name, 'Google Prefill');
    assert.equal(legacyAuthz.staffRecordName, '');
    assert.equal(needsStaffNameSetup(legacyAuthz), true);
  });

  it('lets existing named staff skip setup', () => {
    assert.equal(needsStaffNameSetup({ name: 'Existing Staff', nameSetupComplete: null }), false);
    assert.equal(needsStaffNameSetup({ name: 'Existing Staff', nameSetupComplete: true }), false);
  });

  it('preserves the setup state in staff authorization snapshots', () => {
    const authz = resolveStaffAccessSnapshot({
      user: { uid: 'uid-1', email: 'whozi@example.com', displayName: 'Google Whozi' },
      staffRecord: {
        name: 'Invite Whozi',
        email: 'whozi@example.com',
        role: 'manager',
        teamId: 'polaris',
        active: true,
        nameSetupComplete: false
      }
    });

    assert.equal(authz.name, 'Invite Whozi');
    assert.equal(authz.nameSetupComplete, false);
    assert.equal(needsStaffNameSetup(authz), true);
  });

  it('writes only display-name setup fields from the self-service flow', async () => {
    const source = await readFile(
      new URL('../js/services/staff-profile.service.js', import.meta.url),
      'utf8'
    );
    const updateStart = source.indexOf("await updateDoc(doc(db, 'staffAccess', uid), {");
    const updateEnd = source.indexOf('  });', updateStart);
    const updateBlock = source.slice(updateStart, updateEnd);

    assert.notEqual(updateStart, -1);
    assert.match(updateBlock, /name,/);
    assert.match(updateBlock, /nameSetupComplete: true/);
    assert.match(updateBlock, /updatedAt: serverTimestamp\(\)/);
    assert.match(updateBlock, /lastModifiedBy: email/);
    assert.doesNotMatch(updateBlock, /role:/);
    assert.doesNotMatch(updateBlock, /teamId:/);
    assert.doesNotMatch(updateBlock, /active:/);
    assert.doesNotMatch(updateBlock, /email:/);
  });

  it('wires first-login setup and name-based roster attribution', async () => {
    const [gate, claim, roster, rosterUi] = await Promise.all([
      readFile(new URL('../js/admin/admin-gate.ui.js', import.meta.url), 'utf8'),
      readFile(new URL('../js/services/staff-invite-claim.service.js', import.meta.url), 'utf8'),
      readFile(new URL('../js/services/rosters.service.js', import.meta.url), 'utf8'),
      readFile(new URL('../admin/js/admin.js', import.meta.url), 'utf8')
    ]);

    assert.match(claim, /nameSetupComplete: false/);
    assert.match(gate, /What name should staff see for you\?/);
    assert.match(gate, /completeStaffNameSetup/);
    assert.match(roster, /verifiedByUid/);
    assert.match(roster, /verifiedByEmail/);
    assert.match(roster, /verifiedByName/);
    assert.match(rosterUi, /currentRosterVerification\.verifiedByName/);
  });
});
