# Player Profiles Feature - Implementation Summary

## Overview
Complete implementation of player profile system with public-facing hover tooltips, admin CSV import tool, and Firestore validation.

## Files Created

### 1. `/js/ui/playerTooltip.ui.js` (230 lines)
- Shared tooltip component for roster pages
- Single DOM element with event delegation
- Supports keyboard focus, mobile tap toggle, responsive positioning
- Safe rendering via `textContent` and `escapeText()` helper
- Data attributes: `data-player-name`, `data-player-profile` (JSON stringified)

**Key Export:**
```javascript
export function initPlayerTooltips() { ... }
```

### 2. `/js/services/profilesImport.service.js` (175 lines)
- CSV parsing with column validation
- Preview generation with status tracking (ok/warning/error)
- Transactional batch updates per team with audit logging
- Field validation and truncation

**Key Exports:**
- `parseCSV(csvText)` — Parses CSV, returns records with profile objects
- `previewProfileChanges(records, currentRosters)` — Matches players, returns changeset with statuses
- `applyProfileUpdates(changeset, performedByEmail)` — Applies changes via transactions, returns results

**CSV Format Required:**
```
teamId,ign,bio,mains,strength,teamValue,favoriteHero,favoriteMap,funFact,twitch,twitter,youtube
```

### 3. `/admin/profiles-import.html` (130 lines)
- Admin import UI with CSV textarea and file upload
- Preview section showing matched players and status
- Results section with success/error summary
- Links in topbar to Dashboard, Rosters, Matches

### 4. `/admin/js/profiles-import.js` (210 lines)
- CSV parsing trigger with error handling
- File upload support
- Preview rendering with status table
- Apply changes with disabled button during processing
- Results display with success count

## Files Modified

### 1. `/js/services/rosters.service.js`
**Changed:** `normalizePlayers()` function
- Now preserves `profile` field from player objects
- Validates profile exists and is an object before including
- Non-destructive: ignores profile if absent

### 2. `/js/team-page.js`
**Changes:**
- Imported `initPlayerTooltips` from UI component
- Modified `renderRoster()` to:
  - Attach `data-player-name` attribute to each `<li>`
  - Attach `data-player-profile` attribute with stringified profile (if present)
  - Call `initPlayerTooltips()` after rendering list

### 3. `/js/roster-render.js`
**Changes:**
- Imported `initPlayerTooltips` from UI component
- Modified `renderRoster()` to attach same data attributes
- Modified `loadRosters()` to call `initPlayerTooltips()` after all teams load (single public call)

### 4. `/firestore.rules`
**Added Functions:**
- `isValidProfile(profile)` — Validates profile object shape and field lengths
  - `bio` (string, ≤200 chars)
  - `mains` (list, ≤6 items)
  - `strength` (string, ≤100 chars)
  - `teamValue` (string, ≤100 chars)
  - `favoriteHero` (string, ≤25 chars)
  - `favoriteMap` (string, ≤25 chars)
  - `funFact` (string, ≤80 chars)
  - `socials` (map with optional twitch/twitter/youtube)

- `isValidPlayer(player)` — Validates player with optional profile

**Modified Rules:**
- `/rosters/{teamId}` — Now validates all players have valid structure (name, roles optional, profile optional)

### 5. `/admin/index.html`
- Added "Import Player Profiles" link card to dashboard
- Links to `/admin/profiles-import.html`

## Data Architecture

### Player Profile Object (Stored in Firestore)
```javascript
{
  bio: string (≤200),
  mains: string[] (≤6 items, each ≤25 chars),
  strength: string (≤100),
  teamValue: string (≤100),
  favoriteHero?: string (≤25),
  favoriteMap?: string (≤25),
  funFact?: string (≤80),
  socials?: {
    twitch?: string,
    twitter?: string,
    youtube?: string
  }
}
```

### Roster Document Structure
```javascript
{
  players: [
    {
      name: string,
      roles: string[],
      profile?: { ...ProfileObject... }  // Optional, preserved on updates
    },
    ...
  ],
  updatedAt: serverTimestamp(),
  lastModifiedBy: string (email)
}
```

## Public-Facing Features

### Homepage & Team Pages
- **Tooltip triggers:** Hover over player names in roster lists
- **Tooltip content:** Bio, favorite hero/map, team strength, mains, fun fact, social links
- **Mobile:** Tap to toggle tooltip on/off
- **Keyboard:** Tab to focus, Enter/Space to toggle, Escape to dismiss

## Admin Features

### Profile CSV Import Tool (`/admin/profiles-import.html`)
1. **Input:** CSV textarea or file upload
2. **Parse:** Click "Parse CSV" to validate columns and match players
3. **Preview:** Shows per-row status (ok/warning/error)
   - **Ok:** Player found, profile will update
   - **Warning:** Player not found, row skipped
   - **Error:** Team not found, row skipped
4. **Apply:** Confirms changes and writes to Firestore transactionally
5. **Results:** Shows success/failure summary per team

### CSV Validation
- Required columns: `teamId`, `ign` (case-insensitive matching)
- Optional columns auto-parsed and truncated to field limits
- Invalid mains entries (>25 chars or >6 total) filtered out
- Empty rows skipped
- Teams/players not found logged as warnings

## Security

### Firestore Rules
- `/config/adminAllowlist` — Admin-only read/write
- `/rosters/{teamId}` — Public read, admin write with player validation
- All profile updates go through admin email check
- Field lengths enforced server-side (bias checks in rules, final validation in browser)

### XSS Prevention
- Profile data always rendered via `textContent`, never `innerHTML`
- `escapeText()` helper for any HTML entities in social links (though URLs are validated)
- CSV import validates data shape before write

### Audit Logging
- All batch imports logged with `profilesImport` action
- Includes: action, targetId (team), performer email, profile count

## Integration Points

### Public Pages
- `roster-render.js` — Homepage rosters now support hover tooltips
- `team-page.js` — Team detail rosters now support hover tooltips

### Admin Panel
- New tab in dashboard linking to import tool
- Import tool integrated with admin auth gate (requires pre-signin)
- Results logged to audit collection

## Testing Checklist

- [ ] CSV parsing validates column names (case-insensitive)
- [ ] Preview correctly matches players by IGN (case-insensitive trim)
- [ ] Profile fields truncated to max lengths on import
- [ ] Mains array limited to 6 items, each ≤25 chars
- [ ] Hover tooltip appears on roster player names (desktop)
- [ ] Tap toggles tooltip on mobile/touch devices
- [ ] Tab navigation focuses player elements
- [ ] Social links render correctly (no XSS from URL)
- [ ] Firestore rules reject invalid profile objects
- [ ] Transactional updates per team (all-or-nothing)
- [ ] Audit logs created for imports
- [ ] File upload works with CSV files
- [ ] Textarea CSV parse works
- [ ] Cancel button clears preview and form
- [ ] Import another button resets UI

## Future Enhancements

- Profile editing UI in admin roster page (instead of CSV-only)
- Social links validation (prevent XSS via URL injection)
- Bulk edit endpoint for multiple profiles
- CSV template download from admin UI
- Profile image/avatar support
