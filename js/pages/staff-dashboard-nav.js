import {
  onFirebaseAuthState,
  signInWithGoogle,
  signOutOfFirebase
} from '/js/services/firebase-auth.service.js';
import { getStaffDashboardAccessForUser } from '/js/services/authz.service.js';
import { createStaffDashboardNavController } from '/js/pages/staff-dashboard-nav-controller.js';

function ensureStaffNavControls() {
  const nav = document.querySelector('body > header nav');
  if (!nav) return null;

  const target = nav.querySelector('[data-site-nav-menu]') || nav;
  const existingSlot = target.querySelector('[data-staff-nav-slot]');
  if (existingSlot) {
    return {
      slot: existingSlot,
      loginButton: existingSlot.querySelector('[data-staff-login]'),
      dashboardLink: existingSlot.querySelector('[data-staff-dashboard]')
    };
  }

  const slot = document.createElement('span');
  slot.className = 'site-nav__staff-slot';
  slot.dataset.staffNavSlot = 'true';
  slot.hidden = true;

  const loginButton = document.createElement('button');
  loginButton.type = 'button';
  loginButton.className = 'site-nav__staff-login';
  loginButton.dataset.staffLogin = 'true';
  loginButton.textContent = 'Staff Login';
  loginButton.setAttribute('aria-label', 'Staff Login with Google');
  loginButton.hidden = true;

  const dashboardLink = document.createElement('a');
  dashboardLink.href = '/admin/';
  dashboardLink.textContent = 'Dashboard';
  dashboardLink.dataset.staffDashboard = 'true';
  dashboardLink.hidden = true;

  slot.append(loginButton, dashboardLink);
  target.appendChild(slot);

  return { slot, loginButton, dashboardLink };
}

function ensureStaffAccessNotice() {
  const header = document.querySelector('body > header');
  if (!header) return null;

  const existing = document.querySelector('[data-staff-access-notice]');
  if (existing) {
    return {
      root: existing,
      status: existing.querySelector('[data-staff-login-status]'),
      actions: existing.querySelector('[data-staff-access-actions]'),
      signOutButton: existing.querySelector('[data-staff-signout]')
    };
  }

  const root = document.createElement('section');
  root.className = 'staff-access-notice';
  root.dataset.staffAccessNotice = 'true';
  root.hidden = true;

  const inner = document.createElement('div');
  inner.className = 'staff-access-notice__inner';

  const status = document.createElement('p');
  status.className = 'staff-access-notice__message';
  status.dataset.staffLoginStatus = 'true';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'staff-access-notice__actions';
  actions.dataset.staffAccessActions = 'true';
  actions.hidden = true;

  const homeLink = document.createElement('a');
  homeLink.href = '/';
  homeLink.className = 'staff-access-notice__action';
  homeLink.textContent = 'Back to Home';

  const signOutButton = document.createElement('button');
  signOutButton.type = 'button';
  signOutButton.className = 'staff-access-notice__action';
  signOutButton.dataset.staffSignout = 'true';
  signOutButton.textContent = 'Sign out';

  actions.append(homeLink, signOutButton);
  inner.append(status, actions);
  root.appendChild(inner);
  header.insertAdjacentElement('afterend', root);

  return { root, status, actions, signOutButton };
}

const navControls = ensureStaffNavControls();
const accessNotice = ensureStaffAccessNotice();

function syncStaffNavSlot() {
  if (!navControls) return;
  navControls.slot.hidden = navControls.loginButton.hidden && navControls.dashboardLink.hidden;
}

function setDashboardVisible(isVisible) {
  if (!navControls?.dashboardLink) return;
  navControls.dashboardLink.hidden = !isVisible;
  syncStaffNavSlot();
}

function setLoginVisible(isVisible) {
  if (!navControls?.loginButton) return;
  navControls.loginButton.hidden = !isVisible;
  syncStaffNavSlot();
}

function setLoginBusy(isBusy) {
  if (!navControls?.loginButton) return;
  navControls.loginButton.disabled = isBusy;
  navControls.loginButton.setAttribute('aria-busy', isBusy ? 'true' : 'false');
}

function setStatus(message, { error = false, canSignOut = false } = {}) {
  if (!accessNotice) return;

  const normalizedMessage = String(message || '');
  accessNotice.status.textContent = normalizedMessage;
  accessNotice.root.hidden = !normalizedMessage;
  accessNotice.root.classList.toggle('is-error', error);
  accessNotice.actions.hidden = !normalizedMessage || !canSignOut;
}

function clearStatus() {
  setStatus('');
}

const controller = createStaffDashboardNavController({
  onAuthStateChanged: onFirebaseAuthState,
  signInWithGoogle,
  signOutOfFirebase,
  getStaffDashboardAccessForUser,
  setDashboardVisible,
  setLoginVisible,
  setLoginBusy,
  setStatus,
  clearStatus
});

if (navControls?.loginButton) {
  navControls.loginButton.addEventListener('click', () => {
    controller.signIn();
  });
}

if (accessNotice?.signOutButton) {
  accessNotice.signOutButton.addEventListener('click', async () => {
    accessNotice.signOutButton.disabled = true;
    await controller.signOut();
    accessNotice.signOutButton.disabled = false;
  });
}

controller.start();
