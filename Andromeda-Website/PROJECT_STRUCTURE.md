## Current Layout

- `index.html` - public homepage.
- `pages/` - public secondary pages.
- `admin/` - admin HTML pages and admin-only page scripts.
- `css/` - global and admin stylesheets.
- `js/config/` - shared static configuration such as team metadata.
- `js/config/app-check.config.js` - public reCAPTCHA Enterprise site-key and App Check browser configuration. The blank key keeps App Check inactive until Firebase setup is complete.
- `js/core/` - shared runtime setup such as Firebase initialization.
- `js/services/` - Firestore, Storage, validation, analytics, and domain service modules.
- `js/pages/` - public page-specific JavaScript.
- `js/admin/` - shared admin auth/gating helpers.
- `images/` - current public image assets.
- `tools/` - local validation scripts.
- `firestore.rules` - source-controlled Firestore rules referenced by `firebase.json` for CLI deployment.
- `storage.rules` - draft Storage rules for the future upload integration; not deployed or required by the current URL-based Media Hub.
- `FIREBASE_RULES_TEST_PLAN.md` - backend emulator coverage required before production deployment.
- `FIREBASE_APP_CHECK_SETUP.md` - manual reCAPTCHA Enterprise registration, localhost debug, monitoring, and staged enforcement guide.

## Access Model

- `staffAccess/{uid}` - preferred staff role records with `name`, `email`, `role`, `active`, and `teamId`. Manager and Captain records require one valid team; other roles store `teamId: null`.
- `staffInvites/{inviteId}` - email-first staff invitations. A matching verified account accepts its pending invitation atomically when it signs in to Admin.
- `config/adminAllowlist` - legacy admin email allowlist kept as a migration fallback for existing admins.
- `js/services/staff-roles.js` - shared role and permission matrix for admin UI visibility and service checks.
- `superadmin` is the root security role and can assign every role. `owner` can invite and manage `media`, `manager`, and `captain` records. `admin` is the broad operational oversight role; legacy allowlisted accounts continue to resolve as `admin`.
- `superadmin`, `owner`, and `admin` may operate across teams. `manager` is restricted to roster, trial, and match operations for its assigned team. `captain` is restricted to allowed match operations for its assigned team.
- Official match records remain publicly readable for schedule/results pages. Scrims and their Storage screenshots require active staff access for the matching team.

## Public Staff Navigation

- `js/pages/staff-dashboard-nav.js` is loaded by every public HTML page. It waits for the initial Firebase Auth state and exits without a Firestore read for anonymous visitors.
- A signed-in visitor triggers one read of only `staffAccess/{uid}`. Dashboard is inserted into the existing navigation only when the record is active, its role is recognized, and assigned-team roles have a valid `teamId`.
- Dashboard visibility is a convenience, not authorization. `/admin/` always repeats the existing authentication and role gate before privileged data loads, and Firebase Security Rules continue to enforce backend access.

## Firebase App Check

- `js/core/firebase.js` initializes App Check on the existing Firebase app with the reCAPTCHA Enterprise provider before Auth, Firestore, and Storage service instances are created.
- App Check token auto-refresh is enabled. The official debug provider can be opted into through localStorage only on localhost-style hostnames; no debug token is stored in the repository.
- App Check complements Firebase Authentication and Security Rules. Enforcement remains a manual Firebase Console rollout after production traffic has been monitored.
