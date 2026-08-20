export const STAFF_LOGIN_UNAUTHORIZED_MESSAGE = 'This Google account does not have staff access.';
export const STAFF_LOGIN_VERIFY_ERROR_MESSAGE = 'We could not verify staff access. Please try again.';
export const STAFF_LOGIN_SIGNIN_ERROR_MESSAGE = 'We could not complete sign-in. Please try again.';
export const STAFF_LOGIN_SIGNOUT_ERROR_MESSAGE = 'We could not sign you out. Please try again.';

export function createStaffDashboardNavController({
  onAuthStateChanged,
  signInWithGoogle,
  signOutOfFirebase = async () => {},
  getStaffDashboardAccessForUser,
  setDashboardVisible = () => {},
  setLoginVisible = () => {},
  setLoginBusy = () => {},
  setStatus = () => {},
  clearStatus = () => {}
} = {}) {
  let unsubscribe = null;
  let activeCheckId = 0;
  let pendingSignIn = false;

  async function handleAuthState(user) {
    const checkId = ++activeCheckId;

    if (!user?.uid) {
      pendingSignIn = false;
      setDashboardVisible(false);
      setLoginVisible(true);
      setLoginBusy(false);
      clearStatus();
      return {
        authenticated: false,
        staffLookup: false,
        showDashboard: false
      };
    }

    setDashboardVisible(false);
    setLoginVisible(false);

    if (pendingSignIn) {
      setStatus('Checking staff access...');
    }

    try {
      const dashboardAccess = await getStaffDashboardAccessForUser(user);
      if (checkId !== activeCheckId) {
        return {
          authenticated: true,
          stale: true,
          staffLookup: true,
          showDashboard: false
        };
      }

      const showDashboard = dashboardAccess?.showDashboard === true;
      setDashboardVisible(showDashboard);
      setLoginVisible(false);
      setLoginBusy(false);
      pendingSignIn = false;

      if (showDashboard) {
        clearStatus();
      } else {
        setStatus(STAFF_LOGIN_UNAUTHORIZED_MESSAGE, { error: true, canSignOut: true });
      }

      return {
        authenticated: true,
        staffLookup: true,
        showDashboard
      };
    } catch (_error) {
      if (checkId !== activeCheckId) {
        return {
          authenticated: true,
          stale: true,
          staffLookup: true,
          showDashboard: false
        };
      }

      setDashboardVisible(false);
      setLoginVisible(false);
      setLoginBusy(false);
      pendingSignIn = false;
      setStatus(STAFF_LOGIN_VERIFY_ERROR_MESSAGE, { error: true, canSignOut: true });

      return {
        authenticated: true,
        staffLookup: true,
        showDashboard: false,
        error: true
      };
    }
  }

  async function signIn() {
    if (pendingSignIn) return false;

    pendingSignIn = true;
    setLoginBusy(true);
    setStatus('Opening Google sign-in...');

    try {
      const signInResult = await signInWithGoogle();
      setStatus('Checking staff access...');

      const signedInUser = signInResult?.user || null;
      if (signedInUser?.uid) {
        const checkIdBeforeFallback = activeCheckId;
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });

        if (pendingSignIn && activeCheckId === checkIdBeforeFallback) {
          await handleAuthState(signedInUser);
        }
      }

      return true;
    } catch (_error) {
      pendingSignIn = false;
      setLoginBusy(false);
      setStatus(STAFF_LOGIN_SIGNIN_ERROR_MESSAGE, { error: true });
      return false;
    }
  }

  async function signOut() {
    setLoginBusy(true);
    setStatus('Signing out...');

    try {
      await signOutOfFirebase();
      return true;
    } catch (_error) {
      setLoginBusy(false);
      setStatus(STAFF_LOGIN_SIGNOUT_ERROR_MESSAGE, { error: true, canSignOut: true });
      return false;
    }
  }

  function start() {
    if (unsubscribe) return unsubscribe;
    setDashboardVisible(false);
    setLoginVisible(false);
    unsubscribe = onAuthStateChanged(handleAuthState);
    return unsubscribe;
  }

  function stop() {
    activeCheckId += 1;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    handleAuthState,
    signIn,
    signOut,
    start,
    stop
  };
}
