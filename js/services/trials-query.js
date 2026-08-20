import { TEAM_IDS } from '../config/teams.config.js';
import {
  STAFF_PERMISSIONS,
  authzHasAnyPermission,
  getScopedTeamId,
  normalizeTeamId
} from './staff-roles.js';

function toMillis(value) {
  if (!value) return 0;

  if (typeof value.toMillis === 'function') {
    const millis = Number(value.toMillis());
    return Number.isFinite(millis) ? millis : 0;
  }

  if (typeof value.toDate === 'function') {
    const millis = value.toDate().getTime();
    return Number.isFinite(millis) ? millis : 0;
  }

  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

export function buildTrialsReadPlan(authz = {}, filters = {}) {
  if (!authzHasAnyPermission(authz, [STAFF_PERMISSIONS.TRIALS_WRITE])) {
    throw new Error('You are not authorized to view trials.');
  }

  const requestedTeamId = normalizeTeamId(filters.teamId);
  if (requestedTeamId && !TEAM_IDS.includes(requestedTeamId)) {
    throw new Error('Select a valid Andromeda team.');
  }

  const scopedTeamId = getScopedTeamId(authz, requestedTeamId);
  if (scopedTeamId === null) {
    throw new Error('You are not authorized to view trials for this team.');
  }

  return {
    scopedTeamId,
    teamIds: scopedTeamId ? [scopedTeamId] : [...TEAM_IDS],
    status: String(filters.status || '').trim().toLowerCase()
  };
}

export function applyTrialsReadPlan(trials = [], readPlan = {}) {
  const allowedTeamIds = new Set(readPlan.teamIds || []);
  const status = String(readPlan.status || '').trim().toLowerCase();

  return trials
    .filter((trial) => {
      const teamId = normalizeTeamId(trial?.teamId);
      const trialStatus = String(trial?.status || '').trim().toLowerCase();
      return allowedTeamIds.has(teamId) && (!status || trialStatus === status);
    })
    .sort((left, right) => toMillis(right?.createdAt) - toMillis(left?.createdAt));
}
