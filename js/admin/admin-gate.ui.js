import { adminSignIn, adminSignOut, onAdminAuthState } from '/js/admin/admin-auth.js';
import { requireStaffAccess } from '/js/services/authz.service.js';
import { completeStaffNameSetup } from '/js/services/staff-profile.service.js';
import {
  STAFF_DISPLAY_NAME_MAX_LENGTH,
  getStaffDisplayName,
  needsStaffNameSetup,
  validateStaffDisplayName
} from '/js/services/staff-identity.js';
import {
  authzHasAnyPermission,
  authzHasRole,
  getStaffRoleLabel,
  parsePermissionList,
  parseRoleList
} from '/js/services/staff-roles.js';

const appShell = document.getElementById('adminApp');
if (appShell) {
  appShell.hidden = true;
}

const gateRoot = document.createElement('div');
gateRoot.id = 'adminGate';
gateRoot.className = 'admin-gate';
document.body.appendChild(gateRoot);

function addHomeLink() {
  document.querySelectorAll('.admin-user').forEach((adminUser) => {
    if (adminUser.querySelector('[data-admin-home]')) return;

    const homeLink = document.createElement('a');
    homeLink.href = '/';
    homeLink.className = 'admin-btn admin-btn--secondary';
    homeLink.textContent = 'Back to Home';
    homeLink.dataset.adminHome = 'true';
    adminUser.prepend(homeLink);
  });
}

addHomeLink();

let inFlightCheck = 0;
let pendingSignIn = false;

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bindGateActions() {
  const signInButton = gateRoot.querySelector('[data-gate-signin]');
  if (signInButton) {
    signInButton.addEventListener('click', async () => {
      if (pendingSignIn) return;
      pendingSignIn = true;
      renderGate({
        title: 'Signing in',
        message: 'Opening Google sign-in…',
        loading: true
      });

      try {
        await adminSignIn();
      } catch (error) {
        console.error('Admin sign-in failed:', error);
        renderGate({
          title: 'Sign in failed',
          message: 'We could not complete sign-in. Please try again.',
          error: true,
          showSignIn: true
        });
      } finally {
        pendingSignIn = false;
      }
    });
  }

  const signOutButton = gateRoot.querySelector('[data-gate-signout]');
  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      try {
        await adminSignOut();
      } catch (error) {
        console.error('Admin sign-out failed:', error);
      }
    });
  }

  const backButton = gateRoot.querySelector('[data-gate-back]');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.history.back();
    });
  }
}

function bindTopbarActions() {
  document.querySelectorAll('[data-admin-signout]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';

    button.addEventListener('click', async () => {
      try {
        await adminSignOut();
      } catch (error) {
        console.error('Admin topbar sign-out failed:', error);
      }
    });
  });
}

function setSignedInIdentity(user, authz) {
  const name = getStaffDisplayName({
    staffName: authz?.name,
    firebaseDisplayName: user?.displayName,
    email: user?.email
  });
  document.querySelectorAll('[data-admin-email]').forEach((el) => {
    el.textContent = name;
  });
}

function getPageAccessRequirements() {
  const roleSource = appShell?.getAttribute('data-admin-roles') || document.body.getAttribute('data-admin-roles') || '';
  const permissionSource = appShell?.getAttribute('data-admin-permissions') || document.body.getAttribute('data-admin-permissions') || '';

  return {
    roles: parseRoleList(roleSource),
    permissions: parsePermissionList(permissionSource)
  };
}

function isVisibleForAuthz(el, authz) {
  const allowedRoles = parseRoleList(el.getAttribute('data-admin-visible') || '');
  const requiredPermissions = parsePermissionList(el.getAttribute('data-admin-permissions-visible') || '');

  if (allowedRoles.length && !authzHasRole(authz, allowedRoles)) {
    return false;
  }

  if (requiredPermissions.length && !authzHasAnyPermission(authz, requiredPermissions)) {
    return false;
  }

  return true;
}

function hasPageAccess(authz) {
  const { roles, permissions } = getPageAccessRequirements();
  if (roles.length && !authzHasRole(authz, roles)) return false;
  if (permissions.length && !authzHasAnyPermission(authz, permissions)) return false;
  return true;
}

function applyRoleScope(authz = null) {
  const role = String(authz?.role || '').trim().toLowerCase() || 'viewer';

  document.querySelectorAll('[data-admin-role]').forEach((el) => {
    el.textContent = getStaffRoleLabel(role);
  });

  document.querySelectorAll('[data-admin-visible], [data-admin-permissions-visible]').forEach((el) => {
    el.hidden = !isVisibleForAuthz(el, authz);
  });
}

function showAuthorizedApp(user, authz = null) {
  setSignedInIdentity(user, authz);
  applyRoleScope(authz);
  bindTopbarActions();

  if (appShell) {
    appShell.hidden = false;
  }

  gateRoot.remove();
  window.dispatchEvent(
    new CustomEvent('admin:authorized', {
      detail: {
        user,
        email: String(user?.email || '').toLowerCase().trim(),
        name: getStaffDisplayName({
          staffName: authz?.name,
          firebaseDisplayName: user?.displayName,
          email: user?.email
        }),
        role: String(authz?.role || '').trim().toLowerCase() || null,
        roleLabel: authz?.roleLabel || null,
        active: authz?.active === true,
        isAuthenticated: authz?.isAuthenticated === true,
        isAuthorized: authz?.isAuthorized === true,
        source: authz?.source || null,
        teamId: authz?.teamId || null,
        permissions: Array.isArray(authz?.permissions) ? [...authz.permissions] : [],
        allowlisted: authz?.allowlisted === true,
        captainByClaims: authz?.captainByClaims === true,
        isSuperAdmin: authz?.isSuperAdmin === true,
        isOwner: authz?.isOwner === true,
        isAdmin: authz?.isAdmin === true,
        isManager: authz?.isManager === true,
        isMedia: authz?.isMedia === true,
        isCaptain: authz?.isCaptain === true
      }
    })
  );
}

function renderNameSetup(user, authz, checkToken) {
  const suggestedName = getStaffDisplayName({
    staffName: authz?.name,
    firebaseDisplayName: user?.displayName,
    email: user?.email
  });

  gateRoot.innerHTML = `
    <section class="admin-gate__panel" role="dialog" aria-modal="true" aria-labelledby="staff-name-setup-title">
      <p class="admin-gate__eyebrow">Andromeda Staff</p>
      <h1 id="staff-name-setup-title">Choose your staff name</h1>
      <p class="admin-gate__message">What name should staff see for you?</p>
      <form class="admin-gate__form" data-name-setup-form>
        <label class="admin-gate__field" for="staff-name-setup-input">
          <span>Staff name</span>
          <input
            id="staff-name-setup-input"
            class="admin-input"
            name="staffName"
            type="text"
            maxlength="${STAFF_DISPLAY_NAME_MAX_LENGTH}"
            value="${escapeHtml(suggestedName)}"
            autocomplete="nickname"
            required
          >
        </label>
        <p class="admin-gate__form-status" data-name-setup-status role="status" aria-live="polite"></p>
        <div class="admin-gate__actions">
          <button class="admin-btn admin-btn--primary" type="submit">Continue to Dashboard</button>
          <button class="admin-btn admin-btn--secondary" type="button" data-gate-signout>Sign out</button>
        </div>
      </form>
    </section>
  `;

  bindGateActions();
  const form = gateRoot.querySelector('[data-name-setup-form]');
  const input = gateRoot.querySelector('#staff-name-setup-input');
  const status = gateRoot.querySelector('[data-name-setup-status]');
  const submitButton = form?.querySelector('button[type="submit"]');

  input?.focus();
  input?.select();
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const name = validateStaffDisplayName(input?.value);
      if (submitButton) submitButton.disabled = true;
      if (status) {
        status.textContent = 'Saving your staff name...';
        status.classList.remove('is-error');
      }

      await completeStaffNameSetup(name);
      const refreshedAuthz = await requireStaffAccess({
        message: 'This account does not have active staff access.'
      });

      if (checkToken !== inFlightCheck) return;
      if (needsStaffNameSetup(refreshedAuthz)) {
        throw new Error('Staff name setup did not complete.');
      }
      if (!hasPageAccess(refreshedAuthz)) {
        throw new Error('This account does not have permission to access this admin page.');
      }

      showAuthorizedApp(user, refreshedAuthz);
    } catch (error) {
      console.error('Staff name setup failed:', {
        operation: 'complete staff display name',
        collection: 'staffAccess',
        code: error?.code || null,
        message: error?.message || String(error),
        error
      });
      if (status) {
        status.textContent = error?.code
          ? 'We could not save your staff name. Please try again.'
          : (error?.message || 'Enter a valid staff name.');
        status.classList.add('is-error');
      }
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function renderGate({
  title,
  message,
  loading = false,
  error = false,
  unauthorized = false,
  showDashboardReturn = false,
  showSignIn = false
}) {
  if (!gateRoot.isConnected) {
    document.body.appendChild(gateRoot);
  }

  gateRoot.innerHTML = `
    <section class="admin-gate__panel" role="dialog" aria-modal="true" aria-live="polite">
      <p class="admin-gate__eyebrow">Andromeda Admin</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="admin-gate__message ${error ? 'is-error' : ''}">${escapeHtml(message)}</p>
      <div class="admin-gate__actions">
        ${showSignIn ? '<button class="admin-btn admin-btn--primary" type="button" data-gate-signin>Sign in with Google</button>' : ''}
        ${unauthorized && showDashboardReturn ? '<a class="admin-btn admin-btn--primary" href="/admin/">Back to Dashboard</a>' : ''}
        ${unauthorized && !showDashboardReturn ? '<a class="admin-btn admin-btn--primary" href="/">Back to Home</a>' : ''}
        ${unauthorized ? '<button class="admin-btn admin-btn--secondary" type="button" data-gate-back>Back</button>' : ''}
        ${unauthorized ? '<button class="admin-btn admin-btn--secondary" type="button" data-gate-signout>Sign out</button>' : ''}
        ${loading ? '<div class="admin-gate__spinner" aria-hidden="true"></div>' : ''}
      </div>
    </section>
  `;

  bindGateActions();
}

renderGate({
  title: 'Sign in to continue',
  message: 'Sign in with Google',
  showSignIn: true
});

onAdminAuthState(async (user) => {
  const checkToken = ++inFlightCheck;

  if (!user) {
    if (appShell) {
      appShell.hidden = true;
    }

    renderGate({
      title: 'Sign in to continue',
      message: 'Sign in with Google',
      showSignIn: true
    });
    return;
  }

  renderGate({
    title: 'Checking access',
    message: 'Verifying staff access...',
    loading: true
  });

  let staffAuthz = null;

  try {
    staffAuthz = await requireStaffAccess({
      message: 'This account does not have active staff access.'
    });

    if (checkToken !== inFlightCheck) return;

    if (needsStaffNameSetup(staffAuthz)) {
      renderNameSetup(user, staffAuthz, checkToken);
      return;
    }

    if (!hasPageAccess(staffAuthz)) {
      throw new Error('This account does not have permission to access this admin page.');
    }

    showAuthorizedApp(user, staffAuthz);
  } catch (error) {
    if (checkToken !== inFlightCheck) return;
    console.error('Authorization check failed:', error);
    renderGate({
      title: 'Not authorized',
      message: 'Your account is signed in, but it does not have access to this admin page.',
      error: true,
      unauthorized: true,
      showDashboardReturn: staffAuthz?.isAuthorized === true
    });
  }
});
