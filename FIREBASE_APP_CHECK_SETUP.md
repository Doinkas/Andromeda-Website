# Firebase App Check Setup

Firebase App Check is integrated with the existing Firebase web app, but it is
inactive until the reCAPTCHA Enterprise site key is configured. Enforcement is
not enabled by this repository change.

App Check is an additional abuse-resistance layer. Firebase Authentication,
the `/admin/` authorization gate, and Firestore/Storage Security Rules remain
the security boundaries for staff permissions.

## 1. Create the reCAPTCHA Enterprise website key

1. Open Google Cloud Console and select project `andromeda-website-f255f`.
2. Open reCAPTCHA Enterprise (Google Cloud Fraud Defense) and choose **Keys**,
   then **Create key**. Enable the API if Google Cloud asks.
3. Choose **Web application** and a score-based key. Do not choose a checkbox
   challenge key.
4. Keep domain verification enabled.
5. Register `andromeda3sports.com`, the current production domain. That domain
   entry also covers its subdomains, including `www.andromeda3sports.com`.
   Register `andromeda-website-f255f.web.app` and
   `andromeda-website-f255f.firebaseapp.com` only if those default Firebase
   Hosting URLs also serve the deployed website. Do not register `localhost` as
   a production domain.
6. Create the key and copy its public **Key ID** (the site key). This value is
   client configuration, not a private secret.

Official reference: https://docs.cloud.google.com/recaptcha/docs/create-key-website

## 2. Register the Firebase web app

1. Open Firebase Console for project `andromeda-website-f255f`.
2. Go to **Build > App Check** (or **Security > App Check**, depending on the
   current Console navigation).
3. Select the existing Andromeda web app with app ID
   `1:106401301554:web:4d8dbd0032f1f042a9682b`.
4. Register it with **reCAPTCHA Enterprise** and paste the Key ID/site key.
5. Leave App Check enforcement off for Firestore, Storage, and Authentication.
6. In `js/config/app-check.config.js`, paste the same public key into
   `recaptchaEnterpriseSiteKey`.

The shared `js/core/firebase.js` initializer then creates App Check on the
existing Firebase app before Auth, Firestore, and Storage are created. Automatic
token refresh is enabled through the Firebase SDK.

Official reference: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider

## 3. Use the supported localhost debug provider

Do this only after registering the Firebase app and setting the site key:

1. Serve the site on `localhost`, `127.0.0.1`, or `::1`.
2. Open the browser developer console on the local site and run:

   ```js
   localStorage.setItem('andromeda.firebase.appCheckDebug', 'true');
   location.reload();
   ```

3. After reload, copy the App Check debug token printed by Firebase in the
   browser console.
4. In Firebase Console, open **App Check > Apps**, open the web app menu, choose
   **Manage debug tokens**, and register that token.
5. Keep the token only in the local browser and Firebase Console. Never paste it
   into source code, documentation, configuration files, or GitHub.
6. Turn local debug mode off with:

   ```js
   localStorage.removeItem('andromeda.firebase.appCheckDebug');
   location.reload();
   ```

The code honors the debug opt-in only on local hostnames. Production hosts
ignore the localStorage flag and use the reCAPTCHA Enterprise provider normally.

Official reference: https://firebase.google.com/docs/app-check/web/debug-provider

## 4. Monitor before enforcement

1. Deploy through the normal release process after the key is configured.
2. Exercise sign-in, public pages, every staff dashboard role, Firestore reads
   and writes, and Storage only after the Storage workflow is enabled.
3. In Firebase Console, open **App Check > APIs** and inspect request metrics for
   each product.
4. Confirm legitimate production traffic is reported as verified. Investigate
   outdated, unknown, or invalid traffic before enabling enforcement.
5. Leave the application in monitoring mode long enough to cover normal staff
   and public workflows.

Official reference: https://firebase.google.com/docs/app-check/monitor-metrics

## 5. Enable enforcement later

When verified traffic is healthy, enable enforcement manually, one product at a
time:

1. Start with Cloud Firestore and retest public data plus every staff role.
2. Enable Firebase Authentication enforcement only after Google sign-in,
   sign-out, session restoration, and denied-user flows are verified.
3. Enable Cloud Storage enforcement only after Firebase Storage itself is
   enabled and its future upload workflow has been tested. The current URL-based
   media workflow does not require Storage enforcement.
4. After each change, wait for it to take effect, monitor App Check metrics and
   application errors, and be ready to disable enforcement if legitimate users
   are blocked.

Cloud Firestore, Cloud Storage, and Firebase Authentication currently support
App Check enforcement. Firebase notes that an enforcement change can take up to
15 minutes to take effect.

Official reference: https://firebase.google.com/docs/app-check/enable-enforcement

## Firebase activity by scenario

1. **Anonymous public visitor:** Firebase Auth restores/checks local auth state.
   The Dashboard module stops when there is no user and performs zero
   `staffAccess` Firestore reads. App Check initializes/refreshes a token when a
   site key is configured.
2. **Authorized signed-in staff on a public page:** Auth restores the user and
   the module performs one `staffAccess/{uid}` document read. It adds Dashboard
   only for a valid active role. App Check supplies a token to protected Firebase
   requests when configured.
3. **Unauthorized signed-in user on a public page:** Auth restores the user and
   the module performs the same single document read. A missing, inactive, or
   invalid record leaves Dashboard absent.
4. **Someone loads `/admin/`:** The admin page independently restores Auth and
   runs the existing admin gate. It does not rely on public navigation. The gate
   checks the current staff record and uses the existing migration fallbacks
   only when needed before privileged dashboard data is loaded.
5. **Authorized staff opens Dashboard:** Navigating to `/admin/` starts a new
   page and repeats the independent authorization gate. After authorization,
   role-specific data loads according to the existing UI permissions and
   backend rules.

The public visibility module uses a one-time initial Auth observer and one
document lookup for signed-in users. It does not query all staff, staff invites,
or the admin allowlist, and it does not keep a live Firestore listener open.
