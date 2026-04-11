import { clearImportedScheduleMatches, upsertMatches } from '/js/services/matches.service.js';

// Mapping from Nebula label to internal teamId
const LABEL_TO_TEAM_ID = {
  'COMET': 'comet',
  'HORIZON': 'spiral',
  'PROXIMA': 'proxima',
  'SUPERNOVA': 'supernova',
  'VOID': 'void',
  'FACEIT': 'faceit'
};

const MONTH_MAP = {
  'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
  'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
};

const DAY_TOKENS = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];

function log(message) {
  const outputEl = document.getElementById('log-output');
  outputEl.style.display = 'block';
  outputEl.textContent += message + '\n';
}

function clearLog() {
  const outputEl = document.getElementById('log-output');
  outputEl.textContent = '';
  outputEl.style.display = 'none';
}

/**
 * Parse a date range from h2 text like "Week 1 (Feb 16 - Feb 22)" or "Week 7 (Mar 30 - Apr 5)"
 * Returns { startDate: Date, endDate: Date } for the week range.
 */
function parseDateRange(h2Text, year) {
  // Extract the parentheses content: "(Feb 16 - Feb 22)"
  const match = h2Text.match(/\(([^)]+)\)/);
  if (!match) {
    throw new Error(`Could not parse date range from: ${h2Text}`);
  }

  const rangeText = match[1]; // "Feb 16 - Feb 22" or "Mar 30 - Apr 5"
  const parts = rangeText.split('-').map(s => s.trim());
  
  if (parts.length !== 2) {
    throw new Error(`Invalid date range format: ${rangeText}`);
  }

  // Parse start date: "Feb 16"
  const startParts = parts[0].split(' ');
  const startMonth = MONTH_MAP[startParts[0].toUpperCase()];
  const startDay = parseInt(startParts[1], 10);
  
  // Parse end date: "Feb 22" or "Apr 5"
  const endParts = parts[1].split(' ');
  const endMonth = MONTH_MAP[endParts[0].toUpperCase()];
  const endDay = parseInt(endParts[1], 10);

  if (startMonth === undefined || endMonth === undefined) {
    throw new Error(`Could not parse month from: ${rangeText}`);
  }

  const startDate = new Date(year, startMonth, startDay);
  const endDate = new Date(year, endMonth, endDay);

  return { startDate, endDate };
}

/**
 * Build a map from weekday token (SUN, MON, etc.) to actual Date within the week range.
 */
function buildWeekdayMap(startDate, endDate) {
  const map = {};
  let current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const token = DAY_TOKENS[dayOfWeek];
    
    // Use the first occurrence of each weekday in the range
    if (!map[token]) {
      map[token] = new Date(current);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return map;
}

/**
 * Parse time string like "8:00 PM EST" and return { hours, minutes }
 */
function parseTime(timeStr) {
  // Remove " EST" and trim
  const cleaned = timeStr.replace(/\s*EST\s*$/i, '').trim();
  
  // Match "8:00 PM" or "8:00 AM"
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    throw new Error(`Could not parse time: ${timeStr}`);
  }
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  
  if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
}

/**
 * Parse td[0] like "FRI 8:00 PM EST" and return weekday token and time.
 */
function parseDateTimeCell(cell) {
  const text = cell.trim();
  
  // Extract weekday token (first word)
  const tokens = text.split(/\s+/);
  const weekdayToken = tokens[0].toUpperCase();
  
  // The remaining text is the time
  const timeStr = tokens.slice(1).join(' ');
  const time = parseTime(timeStr);
  
  return { weekdayToken, ...time };
}

/**
 * Parse td[1] like "ANDROMEDA: HORIZON" and extract the team label.
 */
function parseTeamLabel(cell) {
  const text = cell.trim();
  
  // Extract text after ":"
  const colonIndex = text.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }
  
  return text.substring(colonIndex + 1).trim().toUpperCase();
}

/**
 * Main import function
 */
async function importSchedule() {
  const yearInput = document.getElementById('year-input');
  const importBtn = document.getElementById('import-btn');
  
  const year = parseInt(yearInput.value, 10);
  
  clearLog();
  log(`Starting import for year ${year}...`);
  
  importBtn.disabled = true;
  
  try {
    // Fetch schedule.html
    log('Fetching /pages/schedule.html...');
    const response = await fetch('/pages/schedule.html');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule.html: ${response.status}`);
    }
    
    const html = await response.text();
    log('Parsing HTML...');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const weekSections = doc.querySelectorAll('.schedule-week');
    log(`Found ${weekSections.length} week sections`);
    
    const allMatches = [];
    const skipped = [];
    const teamCounts = {};
    
    for (const section of weekSections) {
      const h2 = section.querySelector('h2');
      if (!h2) continue;
      
      const weekText = h2.textContent;
      log(`\nProcessing: ${weekText}`);
      
      try {
        const { startDate, endDate } = parseDateRange(weekText, year);
        const weekdayMap = buildWeekdayMap(startDate, endDate);
        
        const rows = section.querySelectorAll('tbody tr');
        
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length < 4) continue;
          
          const dateTimeCell = cells[0].textContent;
          const teamCell = cells[1].textContent;
          const opponentCell = cells[2].textContent.trim();
          const streamCell = cells[3].querySelector('a');
          
          try {
            // Parse date/time
            const { weekdayToken, hours, minutes } = parseDateTimeCell(dateTimeCell);
            
            if (!weekdayMap[weekdayToken]) {
              skipped.push(`Unknown weekday token: ${weekdayToken}`);
              continue;
            }
            
            const matchDate = new Date(weekdayMap[weekdayToken]);
            matchDate.setHours(hours, minutes, 0, 0);
            
            // Parse team label
            const teamLabel = parseTeamLabel(teamCell);
            
            if (!teamLabel) {
              skipped.push(`Could not parse team from: ${teamCell}`);
              continue;
            }
            
            const teamId = LABEL_TO_TEAM_ID[teamLabel];
            
            if (!teamId) {
              skipped.push(`Unknown team label: ${teamLabel}`);
              continue;
            }
            
            // Skip BYE weeks
            if (opponentCell.toUpperCase() === 'BYE') {
              skipped.push(`Skipping BYE week for ${teamId}`);
              continue;
            }
            
            // Parse stream URL
            const streamUrl = streamCell && streamCell.href !== '#' ? streamCell.href : null;
            
            // Create match object
            allMatches.push({
              teamId,
              opponent: opponentCell,
              scheduledAt: matchDate,
              streamUrl
            });
            
            teamCounts[teamId] = (teamCounts[teamId] || 0) + 1;
            
          } catch (err) {
            skipped.push(`Error parsing row: ${err.message}`);
          }
        }
      } catch (err) {
        log(`  Error parsing week: ${err.message}`);
      }
    }
    
    log(`\n--- Import Summary ---`);
    log(`Total matches parsed: ${allMatches.length}`);
    log(`Matches per team:`);
    for (const [teamId, count] of Object.entries(teamCounts)) {
      log(`  ${teamId}: ${count}`);
    }
    
    if (skipped.length > 0) {
      log(`\nSkipped rows (${skipped.length}):`);
      skipped.forEach(msg => log(`  - ${msg}`));
    }
    
    if (allMatches.length === 0) {
      log('\nNo matches to import.');
      return;
    }

    const targetTeams = Object.keys(teamCounts);
    log(`\nClearing previous imported schedule matches for: ${targetTeams.join(', ') || 'none'}...`);
    const removedCount = await clearImportedScheduleMatches(targetTeams);
    log(`Removed ${removedCount} old imported match(es).`);
    
    log(`\nWriting ${allMatches.length} matches to Firestore...`);
    await upsertMatches(allMatches, adminEmail);
    
    log('\n✓ Import completed successfully!');
    
  } catch (err) {
    log(`\n✗ Import failed: ${err.message}`);
    console.error(err);
  } finally {
    importBtn.disabled = false;
  }
}

let adminEmail = null;
const importButton = document.getElementById('import-btn');
importButton.disabled = true;

window.addEventListener('admin:authorized', (event) => {
  adminEmail = String(event?.detail?.email || '').trim().toLowerCase() || null;
  importButton.disabled = false;
  log('Authorized. Ready to import schedule.');
  console.log('Admin email captured:', adminEmail);
});

importButton.addEventListener('click', async () => {
  log(`\n[DEBUG] Starting import with adminEmail = ${adminEmail || '(null)'}`);
  await importSchedule();
});
