import { saveRoster } from '/js/services/rosters.service.js';

const seedButton = document.getElementById('seed-btn');
const statusEl = document.getElementById('status');
let adminEmail = null;

function logStatus(message) {
  statusEl.textContent += `${message}\n`;
}

function parseRoster(doc) {
  const roster = {};
  const teams = ['horizon', 'spiral', 'proxima', 'comet', 'supernova', 'void'];

  teams.forEach((team) => {
    const section = doc.querySelector(`#${team}`);
    const list = section ? section.querySelector('ul') : null;
    roster[team] = list ? extractPlayers(list) : [];
  });

  const faceitSection = doc.querySelector('section.team:not([id])');
  const faceitList = faceitSection ? faceitSection.querySelector('ul') : null;
  roster.faceit = faceitList ? extractPlayers(faceitList) : [];

  return roster;
}

function extractPlayers(list) {
  const players = [];
  list.querySelectorAll('li.player').forEach((item) => {
    const name = item.querySelector('.player-name')?.textContent?.trim() || '';
    const roleSpans = Array.from(item.querySelectorAll('.player-roles .role'));
    const roles = roleSpans.map((span) => span.textContent.trim()).filter(Boolean);

    if (!name) return;

    if (roles.length) {
      players.push({ name, roles });
    } else {
      players.push({ name, role: '' });
    }
  });
  return players;
}

async function seedRosters() {
  seedButton.disabled = true;
  statusEl.textContent = '';

  try {
    const response = await fetch('/pages/teams.html', { cache: 'no-store' });
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rosters = parseRoster(doc);

    const entries = Object.entries(rosters);
    for (const [team, players] of entries) {
      await saveRoster(team, players, adminEmail);
      logStatus(`Seeded ${team} (${players.length} players).`);
    }

    logStatus('Done.');
  } catch (error) {
    logStatus(`Seed failed: ${error.message}`);
  } finally {
    seedButton.disabled = false;
  }
}
seedButton.disabled = true;

window.addEventListener('admin:authorized', (event) => {
  adminEmail = String(event?.detail?.email || '').trim().toLowerCase() || null;
  seedButton.disabled = false;
  logStatus('Authorized. Ready to seed rosters.');
});

seedButton.addEventListener('click', seedRosters);
