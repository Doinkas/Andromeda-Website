## Current Layout

- `index.html` - public homepage.
- `pages/` - public secondary pages.
- `admin/` - admin HTML pages and admin-only page scripts.
- `css/` - global and admin stylesheets.
- `js/config/` - shared static configuration such as team metadata.
- `js/core/` - shared runtime setup such as Firebase initialization.
- `js/services/` - Firestore, Storage, validation, analytics, and domain service modules.
- `js/pages/` - public page-specific JavaScript.
- `js/admin/` - shared admin auth/gating helpers.
- `images/` - current public image assets.
- `tools/` - local validation scripts.
- `firestore.rules` - source-controlled Firestore rules referenced by `firebase.json` for CLI deployment.
- `storage.rules` - draft Storage rules for the future upload integration; not deployed or required by the current URL-based Media Hub.
- `FIREBASE_RULES_TEST_PLAN.md` - backend emulator coverage required before production deployment.

## Access Model

- `staffAccess/{uid}` - preferred staff role records with `name`, `email`, `role`, `active`, and `teamId`. Manager and Captain records require one valid team; other roles store `teamId: null`.
- `staffInvites/{inviteId}` - email-first staff invitations. A matching verified account accepts its pending invitation atomically when it signs in to Admin.
- `config/adminAllowlist` - legacy admin email allowlist kept as a migration fallback for existing admins.
- `js/services/staff-roles.js` - shared role and permission matrix for admin UI visibility and service checks.
- `superadmin` is the root security role and can assign every role. `owner` can invite and manage `media`, `manager`, and `captain` records. `admin` is the broad operational oversight role; legacy allowlisted accounts continue to resolve as `admin`.
- `superadmin`, `owner`, and `admin` may operate across teams. `manager` is restricted to roster, trial, and match operations for its assigned team. `captain` is restricted to allowed match operations for its assigned team.
- Official match records remain publicly readable for schedule/results pages. Scrims and their Storage screenshots require active staff access for the matching team.
