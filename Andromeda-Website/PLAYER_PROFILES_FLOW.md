# Player Profiles Feature - End-to-End Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PUBLIC PAGES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Homepage (index.html)                                          │
│  ├─ roster-render.js                                            │
│  │  ├─ getRoster(teamId) [from rosters.service.js]             │
│  │  ├─ renderRoster(team, players)                             │
│  │  │  ├─ Attachdata-player-name & data-player-profile attrs  │
│  │  │  └─ Call initPlayerTooltips() [from playerTooltip.ui.js] │
│  │  └─ Tooltip appears on hover                                │
│  │                                                               │
│  Team Detail Page (team.html?team=horizon)                      │
│  ├─ team-page.js                                               │
│  │  ├─ getRoster(teamId) [from rosters.service.js]             │
│  │  ├─ renderRoster(roster)                                    │
│  │  │  ├─ Attach data-player-name & data-player-profile attrs │
│  │  │  └─ Call initPlayerTooltips() [from playerTooltip.ui.js] │
│  │  └─ Tooltip appears on hover                                │
│  │                                                               │
│  Shared Tooltip Component (playerTooltip.ui.js)                 │
│  └─ initPlayerTooltips()                                        │
│     ├─ Create single shared tooltip DOM element                 │
│     ├─ Attach event listeners (mouseenter, focus, tap, etc)     │
│     ├─ Parse data-player-profile JSON                           │
│     └─ Render safe HTML (textContent + escapeText)              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN PANEL                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Dashboard (admin/index.html)                                   │
│  └─ Navigation link to "Import Player Profiles"                │
│                                                                   │
│  Profile Import Page (admin/profiles-import.html)               │
│  ├─ profiles-import.js                                          │
│  │  ├─ Parse CSV button                                        │
│  │  │  ├─ parseCSV(csvText) [from profilesImport.service.js]  │
│  │  │  ├─ Load all rosters via getRoster(teamId)               │
│  │  │  ├─ previewProfileChanges(records, rosters)              │
│  │  │  └─ Display preview table (ok/warning/error status)      │
│  │  │                                                            │
│  │  ├─ Upload File button                                      │
│  │  │  └─ FileReader.readAsText() → triggers Parse CSV flow    │
│  │  │                                                            │
│  │  ├─ Apply Changes button                                    │
│  │  │  ├─ Filter changeset for status='ok' items              │
│  │  │  ├─ applyProfileUpdates(changeset, userEmail)            │
│  │  │  │  ├─ Group by teamId                                   │
│  │  │  │  ├─ For each team: runTransaction()                   │
│  │  │  │  │  ├─ Load current roster                            │
│  │  │  │  │  ├─ Merge profile field into matching players      │
│  │  │  │  │  ├─ Write with serverTimestamp()                   │
│  │  │  │  │  └─ Write audit log                                │
│  │  │  │  └─ Return success/error per team                     │
│  │  │  └─ Display results table                                │
│  │  │                                                            │
│  │  └─ Reset button → Clear form                               │
│  │                                                               │
│  Roster Editor (admin/admin.html) [Future enhancement]          │
│  └─ Edit profile fields inline (not yet implemented)            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOWS                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. CSV IMPORT FLOW                                             │
│  ─────────────────                                              │
│  CSV File (admin uploads)                                       │
│  ↓                                                               │
│  parseCSV() validates columns & parses rows                     │
│  ↓                                                               │
│  previewProfileChanges()                                        │
│    - Load all current rosters                                   │
│    - Match players by IGN (case-insensitive, trimmed)           │
│    - Generate changeset with status for each row                │
│  ↓                                                               │
│  Admin reviews preview table (ok/warning/error)                 │
│  ↓                                                               │
│  applyProfileUpdates()                                          │
│    - Group by teamId                                            │
│    - For each team, transactional batch update:                 │
│      * Load roster                                              │
│      * Preserve existing fields, merge in profile               │
│      * Write with updatedAt = serverTimestamp()                 │
│      * Write audit log entry                                    │
│    - Return per-team success/error                              │
│  ↓                                                               │
│  Firestore rosters/{teamId} documents updated                   │
│  ↓                                                               │
│  Public pages reload → tooltip shows new profile data           │
│                                                                   │
│  2. PUBLIC PAGE TOOLTIP FLOW                                    │
│  ──────────────────────────                                     │
│  User visits homepage or team page                              │
│  ↓                                                               │
│  roster-render.js / team-page.js                                │
│    - Fetch roster (includes profile objects)                    │
│    - Render each player as <li> with:                           │
│      * data-player-name="IGN"                                   │
│      * data-player-profile='{"bio":"...",mains:[...],…}'       │
│  ↓                                                               │
│  playerTooltip.ui.js initPlayerTooltips()                       │
│    - Create single tooltip element (appended to body)           │
│    - Attach delegated event listeners                           │
│  ↓                                                               │
│  User hovers/taps player name                                   │
│  ↓                                                               │
│  Event listener triggers                                        │
│  ↓                                                               │
│  renderProfileContent(profile, playerName)                      │
│    - Build HTML string (no innerHTML from data)                 │
│    - Use escapeText() for any user-provided text                │
│    - Use textContent for name/bio/mains/etc                     │
│    - Generate social link HTML (validated URLs)                 │
│  ↓                                                               │
│  tooltip.innerHTML = HTML (safe because generated, not parsed)  │
│  ↓                                                               │
│  showTooltip() → Position and display                           │
│  ↓                                                               │
│  User sees profile card with:                                   │
│    - Bio (first ~ 100 chars)                                    │
│    - Favorite hero / map                                        │
│    - Mains list                                                 │
│    - Strength / team value                                      │
│    - Fun fact                                                    │
│    - Social links (Twitch, Twitter, YouTube)                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 FIRESTORE VALIDATION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  When admin writes to /rosters/{teamId}:                        │
│  ├─ Rules check isAdminEmail()                                  │
│  ├─ Rules validate request.resource.data.players is list        │
│  ├─ Rules check players.size() > 0                              │
│  └─ Rules verify ALL players pass isValidPlayer():              │
│     ├─ name is string and not empty                             │
│     ├─ roles is list or absent                                  │
│     ├─ profile is map with validated fields:                    │
│     │  ├─ bio: string (≤200 chars)                             │
│     │  ├─ mains: list (≤6 items)                               │
│     │  ├─ strength: string (≤100 chars)                        │
│     │  ├─ teamValue: string (≤100 chars)                       │
│     │  ├─ favoriteHero: string (≤25 chars)                     │
│     │  ├─ favoriteMap: string (≤25 chars)                      │
│     │  ├─ funFact: string (≤80 chars)                          │
│     │  └─ socials: map (optional)                              │
│     └─ profile absent is OK (optional field)                    │
│                                                                   │
│  If validation fails → Write rejected (permission denied)        │
│  If validation passes → Write succeeds                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Transformations

### CSV Row → Profile Object
```
CSV: "horizon","PlayerOne","Flex player","Tracer,Widowmaker"
                                 ↓
ProfileImport.parseCSV()
                                 ↓
{
  teamId: "horizon",
  ign: "PlayerOne",
  profile: {
    bio: "Flex player",
    mains: ["Tracer", "Widowmaker"],
    strength: "",
    teamValue: "",
    favoriteHero: "",
    favoriteMap: "",
    funFact: "",
    socials: { twitch: null, twitter: null, youtube: null }
  }
}
```

### Profile Object → Firestore Document
```
Before update:
{
  players: [
    { name: "PlayerOne", roles: ["DPS"] }
  ]
}

After applyProfileUpdates():
{
  players: [
    {
      name: "PlayerOne",
      roles: ["DPS"],
      profile: {
        bio: "Flex player",
        mains: ["Tracer", "Widowmaker"],
        strength: "",
        teamValue: "",
        favoriteHero: "",
        favoriteMap: "",
        funFact: "",
        socials: { twitch: null, twitter: null, youtube: null }
      }
    }
  ],
  updatedAt: <serverTimestamp>,
  lastModifiedBy: "admin@andromeda.gg"
}
```

### Profile Object → HTML Tooltip
```javascript
{
  bio: "Flex player with strong fundamentals",
  mains: ["Tracer", "Widowmaker"],
  strength: "Strong mechanical skills and game awareness",
  teamValue: "",
  favoriteHero: "Tracer",
  favoriteMap: "Numbani",
  funFact: "Can play on one hand",
  socials: {
    twitch: "https://twitch.tv/playerone",
    twitter: "https://twitter.com/playerone",
    youtube: "https://youtube.com/@playerone"
  }
}
          ↓
renderProfileContent(profile, "PlayerOne")
          ↓
<div class="player-tooltip">
  <div class="tooltip-header">PlayerOne</div>
  <p class="tooltip-bio">Flex player with strong fundamentals</p>
  <div class="tooltip-mains">
    <strong>Mains:</strong> Tracer, Widowmaker
  </div>
  <div class="tooltip-heroes">
    <div>Favorite Hero: Tracer</div>
    <div>Favorite Map: Numbani</div>
  </div>
  <p class="tooltip-strength">Strong mechanical skills and game awareness</p>
  <p class="tooltip-fact">Fun fact: Can play on one hand</p>
  <div class="tooltip-socials">
    <a href="https://twitch.tv/playerone" target="_blank">Twitch</a>
    <a href="https://twitter.com/playerone" target="_blank">Twitter</a>
    <a href="https://youtube.com/@playerone" target="_blank">YouTube</a>
  </div>
</div>
```

## Security Checkpoints

```
CLIENT VALIDATION          TRANSIT                 SERVER VALIDATION
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│ CSV Parse                                                         │
│ ├─ Column names                                                   │
│ ├─ teamId & ign required                                         │
│ ├─ Data type validation                                          │
│ └─ Field length truncation                    CSV Write Request   │
│                                                │                   │
│ Preview                                        ↓                   │
│ ├─ Match by (teamId, ign)                   ┌─────────────────┐   │
│ ├─ Batch validation                         │ Firebase        │   │
│ └─ Show warnings/errors                     │ Firestore       │   │
│                                              │ Rules           │   │
│ Apply                                        │                 │   │
│ ├─ Group by teamId                          │ isAdminEmail()  │   │
│ ├─ Build profile objects                    │ isValidPlayer() │   │
│ ├─ Merge into existing rosters              │ isValidProfile()│   │
│ └─ Client-side validation before write      │                 │   │
│                                              └────────┬────────┘   │
│                                                       │             │
│ Firestore response                                   ↓             │
│ ├─ Per-team success/error logged                  STORED          │
│ └─ Users directed to results view            in Firestore         │
│                                                  (validated)       │
│                                                                    │
│ TOOLTIP RENDERING                                                 │
│ ├─ escapeText() for user data                                     │
│ ├─ textContent for all data fields                               │
│ ├─ Never innerHTML from data                                      │
│ ├─ URL validation in social links                                │
│ └─ Safe DOM creation via createElement()                         │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Audit Trail

```
When profiles are imported:

Entry in /auditLogs/{generated-id}:
{
  action: "profiles_import",
  targetCollection: "rosters",
  targetId: "horizon",  // Each team gets separate entry
  performedBy: "admin@andromeda.gg",
  timestamp: <serverTimestamp>,
  meta: {
    profilesUpdated: 3  // Number of players updated in this team
  }
}
```

## Testing Scenarios

### Happy Path
1. Admin uploads CSV with 5 records, 2 teams
2. System parses successfully
3. Preview shows: 4 "ok", 1 "warning" (player not found)
4. Admin clicks Apply
5. 4 profiles updated, 2 audit entries created
6. Homepage refresh shows updated tooltips

### Error Handling
1. CSV missing "teamId" column → Parse error
2. CSV references non-existent team → Status "error"
3. CSV references non-existent player → Status "warning" (skipped)
4. Network error during apply → Retry prompt
5. Firestore validation error (oversized bio) → Per-team failure

### Edge Cases
1. Empty mains field → Filtered out (array stays empty)
2. 7 mains in CSV → Truncated to 6
3. Bio with HTML tags → Escaped, renders as plain text
4. Duplicate player in CSV → Last one wins (processed in order)
5. Profile field already exists → Merged/overwritten
