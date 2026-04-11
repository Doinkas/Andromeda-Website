import { getRoster } from '/js/services/rosters.service.js';
import { initPlayerTooltips } from '/js/ui/playerTooltip.ui.js';

const teams = ['horizon', 'spiral', 'proxima', 'comet', 'supernova', 'void', 'faceit'];
const teamSections = {
  horizon: document.querySelector('#horizon ul'),
  spiral: document.querySelector('#spiral ul'),
  proxima: document.querySelector('#proxima ul'),
  comet: document.querySelector('#comet ul'),
  supernova: document.querySelector('#supernova ul'),
  void: document.querySelector('#void ul'),
  faceit: document.querySelector('section.team:not([id]) ul')
};
const fallbackHtml = {};

teams.forEach((team) => {
  const ul = teamSections[team];
  if (ul) {
    fallbackHtml[team] = ul.innerHTML;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderRoster(team, players) {
  const ul = teamSections[team];
  if (!ul) return;

  if (!Array.isArray(players) || players.length === 0) {
    if (fallbackHtml[team]) {
      ul.innerHTML = fallbackHtml[team];
    }
    return;
  }

  ul.innerHTML = '';

  players.forEach(player => {
    const li = document.createElement('li');
    li.className = 'player';

    // Attach player data for tooltip initialization
    li.setAttribute('data-player-name', player.name);
    li.setAttribute('data-player-profile', JSON.stringify(player.profile || {}));

    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';

    const playerName = document.createElement('span');
    playerName.className = 'player-name';
    playerName.textContent = player.name;

    const playerTooltip = document.createElement('div');
    playerTooltip.className = 'player-tooltip';
    const tooltipP = document.createElement('p');
    tooltipP.textContent = 'Favorite hero: Placeholder';
    playerTooltip.appendChild(tooltipP);

    playerInfo.appendChild(playerName);
    playerInfo.appendChild(playerTooltip);

    const playerRoles = document.createElement('span');
    playerRoles.className = 'player-roles';

    if (Array.isArray(player.roles)) {
      player.roles.forEach((role) => {
        const roleSpan = document.createElement('span');
        roleSpan.className = `role ${String(role).toLowerCase()}`;
        roleSpan.textContent = role;
        playerRoles.appendChild(roleSpan);
        playerRoles.appendChild(document.createTextNode(' '));
      });
    } else if (player.role) {
      const roleSpan = document.createElement('span');
      roleSpan.className = `role ${String(player.role).toLowerCase()}`;
      roleSpan.textContent = player.role;
      playerRoles.appendChild(roleSpan);
    }

    li.appendChild(playerInfo);
    li.appendChild(playerRoles);
    ul.appendChild(li);
  });

  // Initialize player tooltips
  initPlayerTooltips();
}

async function loadRosters() {
  for (const team of teams) {
    try {
      const roster = await getRoster(team);
      if (roster && roster.players && teamSections[team]) {
        renderRoster(team, roster.players);
      } else if (fallbackHtml[team]) {
        teamSections[team].innerHTML = fallbackHtml[team];
      }
    } catch (error) {
      if (fallbackHtml[team]) {
        teamSections[team].innerHTML = fallbackHtml[team];
      }
      console.warn('Roster load failed for', team, error);
    }
  }

  // Initialize player tooltips after all rosters loaded
  initPlayerTooltips();
}

document.addEventListener('DOMContentLoaded', () => {
  loadRosters();
});
