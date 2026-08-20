import { getTeamMeta } from '../config/teams.config.js';
import { authzHasRole, normalizeTeamId } from './staff-roles.js';

export const ORGANIZATION_REVIEW_ROLES = Object.freeze(['superadmin', 'owner', 'admin']);
export const TRIAL_REVIEW_STATUSES = Object.freeze(['pending']);

export function canViewOrganizationReview(authz = {}) {
  return authzHasRole(authz, ORGANIZATION_REVIEW_ROLES);
}

function getTeamReviewMeta(teamId) {
  const normalizedTeamId = normalizeTeamId(teamId === 'faceit' ? 'octantis' : teamId);
  const team = getTeamMeta(normalizedTeamId);
  if (!team) return null;

  return {
    teamId: normalizedTeamId,
    teamName: team.name,
    teamLogo: team.logo || '/images/branding/andro-org.png'
  };
}

export function buildRosterReviewItems(rosters = []) {
  return rosters
    .filter((roster) => roster?.needsReview === true)
    .map((roster) => {
      const team = getTeamReviewMeta(roster?.teamId || roster?.id);
      if (!team) return null;

      return {
        id: `roster-${team.teamId}`,
        type: 'roster',
        ...team,
        status: 'Needs verification',
        updatedAt: roster?.updatedAt || null,
        lastModifiedBy: String(roster?.lastModifiedBy || '').trim() || null,
        href: `admin.html?team=${encodeURIComponent(team.teamId)}#roster-verification`
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.teamName.localeCompare(right.teamName));
}

export function buildTrialReviewItems(trials = []) {
  return trials
    .filter((trial) => TRIAL_REVIEW_STATUSES.includes(String(trial?.status || '').trim().toLowerCase()))
    .map((trial) => {
      const team = getTeamReviewMeta(trial?.teamId);
      const name = String(trial?.name || '').trim();
      if (!team || !name) return null;

      return {
        id: `trial-${String(trial?.id || name).trim()}`,
        type: 'trial',
        ...team,
        name,
        status: String(trial.status).trim().toLowerCase(),
        updatedAt: trial?.updatedAt || trial?.createdAt || null,
        href: `admin.html?team=${encodeURIComponent(team.teamId)}#trials-heading`
      };
    })
    .filter(Boolean);
}

export function buildOrganizationReviewQueue({ rosters = [], trials = [] } = {}) {
  const rosterItems = buildRosterReviewItems(rosters);
  const trialItems = buildTrialReviewItems(trials);

  return {
    rosterItems,
    trialItems,
    rosterCount: rosterItems.length,
    trialCount: trialItems.length,
    totalCount: rosterItems.length + trialItems.length
  };
}
