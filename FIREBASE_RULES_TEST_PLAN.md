# Firebase Security Rules Test Plan

The JavaScript authorization and rules-policy tests verify the shared role matrix and expected rule structure, but they do not execute `firestore.rules` or `storage.rules`. Run the Firebase Local Emulator Suite before production deployment to verify the backend boundary.

## Prerequisites

1. Install Java JDK 21 or newer and confirm `java -version` works.
2. Install the test dependencies without changing production dependencies:

   ```powershell
   npm install --save-dev @firebase/rules-unit-testing firebase
   ```

3. The repository's `firebase.json` already points the Firestore emulator at `firestore.rules`.
4. After implementing `tools/firestore-rules.test.mjs` from the cases below, run it through an isolated demo project ID:

   ```powershell
   firebase emulators:exec --only firestore --project demo-andromeda "node --test tools/firestore-rules.test.mjs"
   ```

Use a `demo-` project ID so tests cannot connect to production resources.

## Required Firestore Cases

- Public and ordinary authenticated users can read official matches, but cannot read scrims or write protected data.
- Media can update the Media Hub but cannot write rosters, trials, matches, events, tournaments, or staff records.
- A Polaris Manager can read and write Polaris rosters, trials, and matches, but cannot access Spiral records.
- A Polaris Manager cannot change a Spiral trial or match `teamId` to Polaris as an update bypass.
- A Manager without a valid team assignment cannot perform team operations.
- A Polaris Captain can view the Polaris roster, manage permitted Polaris trials, and report result fields on existing Polaris matches, but cannot create/delete matches, change scheduling fields, write any roster, or access the corresponding Spiral admin records.
- A Polaris Captain cannot change a Polaris trial `teamId` to Spiral or change a Spiral trial `teamId` to Polaris as an update bypass.
- A newly invited staff member can set a valid display name once, but that self-service update cannot change email, role, `teamId`, active status, invitation linkage, or timestamps other than the required update metadata.
- An existing named staff member cannot use the first-login name rule as an unrestricted profile editor.
- Admin, Owner, and Super Admin retain all-team operations; staff-management hierarchy remains unchanged.
- An inactive `staffAccess` record cannot regain access through the legacy allowlist or token claims.
- Manager and Captain staff invitations/records without a valid team are rejected.
- Analytics creation rejects unknown fields, missing required fields, incorrect types, oversized strings, and client-supplied timestamps.

## Required Storage Cases

After Firebase Storage is enabled, add Storage emulator coverage for image type/size limits, public official images, private scrim images, Media Hub access, and cross-team upload denial. Storage remains a draft integration until billing and the product are enabled.
