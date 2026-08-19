import {
  createStaffInvite,
  listStaffAccess,
  listStaffInvites,
  revokeStaffInvite,
  saveStaffAccess
} from '/js/services/staff.service.js';
import {
  canManageStaffRole,
  getAssignableStaffRoles,
  getStaffRoleLabel
} from '/js/services/staff-roles.js';
import { TEAM_OPTIONS, TEAM_REGISTRY } from '/js/config/teams.config.js';

const form = document.getElementById('staff-access-form');
const formTitle = document.getElementById('staff-form-title');
const formPurpose = document.getElementById('staff-form-purpose');
const uidInput = document.getElementById('staff-uid');
const nameInput = document.getElementById('staff-name');
const emailInput = document.getElementById('staff-email');
const roleInput = document.getElementById('staff-role');
const teamInput = document.getElementById('staff-team');
const teamLabel = document.getElementById('staff-team-label');
const activeRow = document.getElementById('staff-active-row');
const activeInput = document.getElementById('staff-active');
const submitButton = document.getElementById('staff-submit-btn');
const clearButton = document.getElementById('staff-clear-btn');
const statusEl = document.getElementById('staff-access-status');
const staffListEl = document.getElementById('staff-access-list');
const inviteListEl = document.getElementById('staff-invite-list');

let currentRole = null;
let currentUid = null;

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--admin-muted)';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatTimestamp(value) {
  if (!value) return 'Not yet';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function getTeamName(teamId) {
  return TEAM_REGISTRY[teamId]?.name || String(teamId || '').trim() || 'Not assigned';
}

function populateTeamOptions(selectedTeamId = '') {
  if (!teamInput) return;
  const normalizedSelected = String(selectedTeamId || '').trim().toLowerCase();
  const knownTeam = TEAM_OPTIONS.some((team) => team.id === normalizedSelected);
  const options = [
    '<option value="">Organization-wide / Not applicable</option>',
    ...TEAM_OPTIONS.map((team) => (
      `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`
    ))
  ];

  if (normalizedSelected && !knownTeam) {
    options.push(`<option value="${escapeHtml(normalizedSelected)}">${escapeHtml(normalizedSelected)} (legacy)</option>`);
  }

  teamInput.innerHTML = options.join('');
  teamInput.value = normalizedSelected;
}

function populateRoleOptions(selectedRole = '') {
  if (!roleInput) return;
  const roles = getAssignableStaffRoles(currentRole);
  roleInput.innerHTML = roles.map((role) => (
    `<option value="${escapeHtml(role)}">${escapeHtml(getStaffRoleLabel(role))}</option>`
  )).join('');

  if (roles.includes(selectedRole)) {
    roleInput.value = selectedRole;
  } else if (roles.includes('manager')) {
    roleInput.value = 'manager';
  }
  updateTeamRequirement();
}

function updateTeamRequirement() {
  if (!teamInput) return;
  const selectedRole = roleInput?.value || '';
  const captainSelected = selectedRole === 'captain';
  const managerSelected = selectedRole === 'manager';
  const teamApplies = captainSelected || managerSelected;

  if (!teamApplies) teamInput.value = '';
  teamInput.disabled = !teamApplies;
  teamInput.required = teamApplies;
  if (teamLabel) {
    teamLabel.textContent = teamApplies ? 'Assigned Team' : 'Team';
  }
}

function clearForm() {
  form?.reset();
  if (uidInput) uidInput.value = '';
  if (emailInput) emailInput.disabled = false;
  if (activeInput) activeInput.checked = true;
  if (activeRow) activeRow.hidden = true;
  if (formTitle) formTitle.textContent = 'Invite Staff';
  if (formPurpose) {
    formPurpose.textContent = 'Assign access by email. The invitation activates automatically when that verified account signs in.';
  }
  if (submitButton) submitButton.textContent = 'Create Invitation';
  populateTeamOptions('');
  populateRoleOptions('manager');
  setStatus('Ready.');
}

function fillForm(staff) {
  if (!canManageStaffRole(currentRole, staff.role)) return;
  if (uidInput) uidInput.value = staff.uid || '';
  if (nameInput) nameInput.value = staff.name || '';
  if (emailInput) {
    emailInput.value = staff.email || '';
    emailInput.disabled = true;
  }
  populateTeamOptions(staff.teamId);
  populateRoleOptions(staff.role);
  if (activeInput) activeInput.checked = staff.active === true;
  if (activeRow) activeRow.hidden = false;
  if (formTitle) formTitle.textContent = 'Update Staff Access';
  if (formPurpose) formPurpose.textContent = 'Change this staff assignment or deactivate access while keeping its history.';
  if (submitButton) submitButton.textContent = 'Save Changes';
  setStatus(`Editing ${staff.email || staff.uid}.`);
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderStaffList(staffRecords) {
  if (!staffListEl) return;
  staffListEl.innerHTML = '';

  if (!staffRecords.length) {
    staffListEl.innerHTML = '<p class="admin-empty">No staff role records found.</p>';
    return;
  }

  staffRecords.forEach((staff) => {
    const item = document.createElement('article');
    item.className = 'admin-help-block';
    item.innerHTML = `
      <h3>${escapeHtml(staff.name || staff.email || staff.uid)}</h3>
      <p class="admin-text-muted">${escapeHtml(staff.email || 'No email')} - ${escapeHtml(getStaffRoleLabel(staff.role))}</p>
      <p class="admin-text-muted">Status: ${staff.active ? 'Active' : 'Inactive'}${staff.teamId ? ` - Team: ${escapeHtml(getTeamName(staff.teamId))}` : ''}</p>
    `;

    if (canManageStaffRole(currentRole, staff.role) && staff.uid !== currentUid) {
      const actions = document.createElement('div');
      actions.className = 'admin-inline-actions';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'admin-btn admin-btn--secondary';
      editButton.textContent = staff.active ? 'Edit Access' : 'Review / Reactivate';
      editButton.addEventListener('click', () => fillForm(staff));
      actions.appendChild(editButton);
      item.appendChild(actions);
    }

    staffListEl.appendChild(item);
  });
}

function renderInviteList(invites) {
  if (!inviteListEl) return;
  inviteListEl.innerHTML = '';

  if (!invites.length) {
    inviteListEl.innerHTML = '<p class="admin-empty">No staff invitations found.</p>';
    return;
  }

  invites.forEach((invite) => {
    const item = document.createElement('article');
    item.className = 'admin-help-block';
    item.innerHTML = `
      <h3>${escapeHtml(invite.name || invite.email)}</h3>
      <p class="admin-text-muted">${escapeHtml(invite.email)} - ${escapeHtml(getStaffRoleLabel(invite.role))}</p>
      <p class="admin-text-muted">Status: ${escapeHtml(invite.status || 'unknown')}${invite.teamId ? ` - Team: ${escapeHtml(getTeamName(invite.teamId))}` : ''}</p>
      <p class="admin-text-muted">Created: ${escapeHtml(formatTimestamp(invite.createdAt))}</p>
    `;

    if (invite.status === 'pending' && canManageStaffRole(currentRole, invite.role)) {
      const actions = document.createElement('div');
      actions.className = 'admin-inline-actions';
      const revokeButton = document.createElement('button');
      revokeButton.type = 'button';
      revokeButton.className = 'admin-btn admin-btn--danger';
      revokeButton.textContent = 'Revoke';
      revokeButton.addEventListener('click', async () => {
        if (!confirm(`Revoke the invitation for ${invite.email}?`)) return;
        try {
          revokeButton.disabled = true;
          await revokeStaffInvite(invite.id);
          await loadStaffAccess();
          setStatus('Invitation revoked.');
        } catch (error) {
          console.error('Revoke staff invitation failed:', error);
          setStatus(error?.message || 'Failed to revoke invitation.', true);
          revokeButton.disabled = false;
        }
      });
      actions.appendChild(revokeButton);
      item.appendChild(actions);
    }

    inviteListEl.appendChild(item);
  });
}

async function loadStaffAccess() {
  try {
    setStatus('Loading staff access...');
    const [staffRecords, invitations] = await Promise.all([
      listStaffAccess(),
      listStaffInvites()
    ]);
    renderStaffList(staffRecords);
    renderInviteList(invitations);
    setStatus(`Loaded ${staffRecords.length} staff record${staffRecords.length === 1 ? '' : 's'} and ${invitations.length} invitation${invitations.length === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error('Load staff access failed:', error);
    renderStaffList([]);
    renderInviteList([]);
    setStatus(error?.message || 'Failed to load staff access.', true);
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitButton) submitButton.disabled = true;

  try {
    const uid = String(uidInput?.value || '').trim();
    if (uid) {
      setStatus('Saving staff access...');
      await saveStaffAccess({
        uid,
        name: nameInput?.value,
        email: emailInput?.value,
        role: roleInput?.value,
        teamId: teamInput?.value,
        active: activeInput?.checked === true
      });
      clearForm();
      await loadStaffAccess();
      setStatus('Staff access saved.');
    } else {
      setStatus('Creating staff invitation...');
      await createStaffInvite({
        name: nameInput?.value,
        email: emailInput?.value,
        role: roleInput?.value,
        teamId: teamInput?.value
      });
      clearForm();
      await loadStaffAccess();
      setStatus('Invitation created. Access will activate when that verified email signs in.');
    }
  } catch (error) {
    console.error('Staff access save failed:', error);
    setStatus(error?.message || 'Failed to save staff access.', true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

clearButton?.addEventListener('click', clearForm);
roleInput?.addEventListener('change', updateTeamRequirement);
window.addEventListener('admin:authorized', async (event) => {
  currentRole = String(event?.detail?.role || '').trim().toLowerCase() || null;
  currentUid = String(event?.detail?.user?.uid || '').trim() || null;
  clearForm();
  await loadStaffAccess();
});
