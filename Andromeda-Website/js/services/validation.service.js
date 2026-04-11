export function validateRoster(players) {
  if (!Array.isArray(players)) {
    throw new Error('Roster players must be an array');
  }
  
  if (players.length === 0) {
    throw new Error('Roster cannot be empty');
  }
  
  players.forEach((player, index) => {
    if (!player.name || typeof player.name !== 'string' || player.name.trim().length === 0) {
      throw new Error(`Player ${index}: name is required and must be a non-empty string`);
    }
    
    if (!Array.isArray(player.roles)) {
      throw new Error(`Player ${index} (${player.name}): roles must be an array`);
    }
    
    player.roles.forEach((role, roleIndex) => {
      if (typeof role !== 'string' || role.trim().length === 0) {
        throw new Error(`Player ${index} (${player.name}), role ${roleIndex}: must be non-empty string`);
      }
    });

    if (player.lineup && !['starter', 'sub'].includes(String(player.lineup).toLowerCase())) {
      throw new Error(`Player ${index} (${player.name}): lineup must be either starter or sub`);
    }
  });
  
  return true;
}

export function validateTrial(trial) {
  if (!trial.name || typeof trial.name !== 'string' || trial.name.trim().length === 0) {
    throw new Error('Trial name is required and must be a non-empty string');
  }
  
  if (!trial.teamId || typeof trial.teamId !== 'string') {
    throw new Error('Trial teamId is required and must be a string');
  }
  
  if (trial.status && !['pending', 'approved', 'rejected', 'dropped'].includes(trial.status)) {
    throw new Error(`Trial status must be one of: pending, approved, rejected, dropped. Got: ${trial.status}`);
  }
  
  if (trial.roles && !Array.isArray(trial.roles)) {
    throw new Error('Trial roles must be an array');
  }
  
  return true;
}

export function validateTrialStatus(status) {
  const validStatuses = ['pending', 'approved', 'rejected', 'dropped'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }
  return true;
}
