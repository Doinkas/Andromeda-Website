import { adminSignIn, adminSignOut, onAdminAuthState } from '/js/admin/admin-auth.js';
import { requireAdminOrCaptain } from '/js/services/authz.service.js';

const appShell = document.getElementById('adminApp');
if (appShell) {
  appShell.hidden = true;
}

const gateRoot = document.createElement('div');
gateRoot.id = 'adminGate';
gateRoot.className = 'admin-gate';
document.body.appendChild(gateRoot);

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

function setSignedInEmail(email) {
  const safeEmail = escapeHtml(email);
  document.querySelectorAll('[data-admin-email]').forEach((el) => {
    el.textContent = safeEmail || '—';
  });
}

function showAuthorizedApp(user) {
  setSignedInEmail(user?.email || '');
  bindTopbarActions();

  if (appShell) {
    appShell.hidden = false;
  }

  gateRoot.remove();
  window.dispatchEvent(
    new CustomEvent('admin:authorized', {
      detail: {
        user,
        email: String(user?.email || '').toLowerCase().trim()
      }
    })
  );
}

function renderGate({ title, message, loading = false, error = false, unauthorized = false, showSignIn = false }) {
  gateRoot.innerHTML = `
    <section class="admin-gate__panel" role="dialog" aria-modal="true" aria-live="polite">
      <p class="admin-gate__eyebrow">Andromeda Admin</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="admin-gate__message ${error ? 'is-error' : ''}">${escapeHtml(message)}</p>
      <div class="admin-gate__actions">
        ${showSignIn ? '<button class="admin-btn admin-btn--primary" type="button" data-gate-signin>Sign in with Google</button>' : ''}
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
    message: 'Verifying admin allowlist…',
    loading: true
  });

  try {
    const email = String(user.email || '').trim().toLowerCase();
    await requireAdminOrCaptain();

    if (checkToken !== inFlightCheck) return;

    showAuthorizedApp(user);
  } catch (error) {
    if (checkToken !== inFlightCheck) return;
    console.error('Authorization check failed:', error);
    renderGate({
      title: 'Not authorized',
      message: `${String(user.email || '').trim().toLowerCase()} is not allowed to access this admin page.`,
      error: true,
      unauthorized: true
    });
  }
});
