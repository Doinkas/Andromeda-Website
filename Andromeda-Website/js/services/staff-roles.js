import { TEAM_IDS } from '../config/teams.config.js';

export const STAFF_ROLES = Object.freeze([
  'superadmin',
  'owner',
  'admin',
  'media',
  'manager',
  'captain'
]);

export const STAFF_ROLE_LABELS = Object.freeze({
  superadmin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  media: 'Media',
  manager: 'Manager',
  captain: 'Captain'
});

export const OPERATIONAL_STAFF_ROLES = Object.freeze([
  'media',
  'manager',
  'captain'
]);

export const STAFF_PERMISSIONS = Object.freeze({
  ADMIN_ACCESS: 'admin:access',
  STAFF_READ: 'staff:read',
  STAFF_INVITE: 'staff:invite',
  STAFF_MANAGE_OPERATIONAL: 'staff:manageOperational',
  STAFF_MANAGE: 'staff:manage',
  ROSTERS_WRITE: 'rosters:write',
  TRIALS_WRITE: 'trials:write',
  MATCHES_READ: 'matches:read',
  MATCHES_WRITE: 'matches:write',
  EVENTS_WRITE: 'events:write',
  MEDIA_HUB_WRITE: 'mediaHub:write',
  TOURNAMENTS_WRITE: 'tournaments:write',
  ANALYTICS_READ: 'analytics:read',
  AUDIT_LOGS_READ: 'auditLogs:read',
  STORAGE_UPLOAD: 'storage:upload',
  TEAMS_ANY: 'teams:any',
  TEAMS_ASSIGNED: 'teams:assigned'
});

const ROLE_PERMISSION_MAP = Object.freeze({
  superadmin: Object.freeze([
    STAFF_PERMISSIONS.ADMIN_ACCESS,
    STAFF_PERMISSIONS.STAFF_READ,
    STAFF_PERMISSIONS.STAFF_INVITE,
    STAFF_PERMISSIONS.STAFF_MANAGE_OPERATIONAL,
    STAFF_PERMISSIONS.STAFF_MANAGE,
    STAFF_PERMISSIONS.ROSTERS_WRITE,
    STAFF_PERMISSIONS.TRIALS_WRITE,
    STAFF_PERMISSIONS.MATCHES_READ,
    STAFF_PERMISSIONS.MATCHES_WRITE,
    STAFF_PERMISSIONS.EVENTS_WRITE,
    STAFF_PERMISSIONS.MEDIA_HUB_WRITE,
    STAFF_PERMISSIONS.TOURNAMENTS_WRITE,
    STAFF_PERMISSIONS.ANALYTICS_READ,
    STAFF_PERMISSIONS.AUDIT_LOGS_READ,
    STAFF_PERMISSIONS.STORAGE_UPLOAD,
    STAFF_PERMISSIONS.TEAMS_ANY
  ]),
  owner: Object.freeze([
    STAFF_PERMISSIONS.ADMIN_ACCESS,
    STAFF_PERMISSIONS.STAFF_READ,
    STAFF_PERMISSIONS.STAFF_INVITE,
    STAFF_PERMISSIONS.STAFF_MANAGE_OPERATIONAL,
    STAFF_PERMISSIONS.ROSTERS_WRITE,
    STAFF_PERMISSIONS.TRIALS_WRITE,
    STAFF_PERMISSIONS.MATCHES_READ,
    STAFF_PERMISSIONS.MATCHES_WRITE,
    STAFF_PERMISSIONS.EVENTS_WRITE,
    STAFF_PERMISSIONS.MEDIA_HUB_WRITE,
    STAFF_PERMISSIONS.TOURNAMENTS_WRITE,
    STAFF_PERMISSIONS.ANALYTICS_READ,
    STAFF_PERMISSIONS.AUDIT_LOGS_READ,
    STAFF_PERMISSIONS.STORAGE_UPLOAD,
    STAFF_PERMISSIONS.TEAMS_ANY
  ]),
  admin: Object.freeze([
    STAFF_PERMISSIONS.ADMIN_ACCESS,
    STAFF_PERMISSIONS.STAFF_READ,
    STAFF_PERMISSIONS.ROSTERS_WRITE,
    STAFF_PERMISSIONS.TRIALS_WRITE,
    STAFF_PERMISSIONS.MATCHES_READ,
    STAFF_PERMISSIONS.MATCHES_WRITE,
    STAFF_PERMISSIONS.EVENTS_WRITE,
    STAFF_PERMISSIONS.MEDIA_HUB_WRITE,
    STAFF_PERMISSIONS.TOURNAMENTS_WRITE,
    STAFF_PERMISSIONS.ANALYTICS_READ,
    STAFF_PERMISSIONS.AUDIT_LOGS_READ,
    STAFF_PERMISSIONS.STORAGE_UPLOAD,
    STAFF_PERMISSIONS.TEAMS_ANY
  ]),
  media: Object.freeze([
    STAFF_PERMISSIONS.ADMIN_ACCESS,
    STAFF_PERMISSIONS.MEDIA_HUB_WRITE,
    STAFF_PERMISSIONS.ANALYTICS_READ,
    STAFF_PERMISSIONS.STORAGE_UPLOAD
  ]),
  manager: Object.freeze([
    STAFF_PERMISSIONS.ADMIN_ACCESS,
    STAFF_PERMISSIONS.ROSTERS_WRITE,
    STAFF_PERMISSIONS.TRIALS_WRITE,
    STAFF_PERMISSIONS.MATCHES_READ,
    STAFF_PERMISSIONS.MATCHES_WRITE,
    STAFF_PERMISSIONS.TEAMS_ASSIGNED
  ]),
  captain: Object.freeze([
    STAFF_PERMISSIONS.ADMIN_ACCESS,
    STAFF_PERMISSIONS.MATCHES_READ,
    STAFF_PERMISSIONS.MATCHES_WRITE,
    STAFF_PERMISSIONS.TEAMS_ASSIGNED
  ])
});

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeTeamId(teamId) {
  return String(teamId || '').trim().toLowerCase();
}

export function isValidTeamId(teamId) {
  return TEAM_IDS.includes(normalizeTeamId(teamId));
}

export function normalizeStaffRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return STAFF_ROLES.includes(normalized) ? normalized : null;
}

export function isStaffRole(role) {
  return normalizeStaffRole(role) !== null;
}

export function roleRequiresTeamAssignment(role) {
  return ['manager', 'captain'].includes(normalizeStaffRole(role));
}

export function getStaffRoleLabel(role) {
  const normalized = normalizeStaffRole(role);
  return normalized ? STAFF_ROLE_LABELS[normalized] : 'Viewer';
}

export function getAssignableStaffRoles(actorRole) {
  const normalizedActorRole = normalizeStaffRole(actorRole);
  if (normalizedActorRole === 'superadmin') return [...STAFF_ROLES];
  if (normalizedActorRole === 'owner') return [...OPERATIONAL_STAFF_ROLES];
  return [];
}

export function canManageStaffRole(actorRole, targetRole) {
  const normalizedActorRole = normalizeStaffRole(actorRole);
  const normalizedTargetRole = normalizeStaffRole(targetRole);
  if (!normalizedTargetRole) return false;
  if (normalizedActorRole === 'superadmin') return true;
  return normalizedActorRole === 'owner' && OPERATIONAL_STAFF_ROLES.includes(normalizedTargetRole);
}

export function parseRoleList(value) {
  if (Array.isArray(value)) {
    return unique(value.map((role) => normalizeStaffRole(role)));
  }

  return unique(
    String(value || '')
      .split(',')
      .map((role) => normalizeStaffRole(role))
  );
}

export function parsePermissionList(value) {
  if (Array.isArray(value)) {
    return unique(value.map((permission) => String(permission || '').trim()).filter(Boolean));
  }

  return unique(
    String(value || '')
      .split(',')
      .map((permission) => String(permission || '').trim())
      .filter(Boolean)
  );
}

export function getRolePermissions(role) {
  const normalized = normalizeStaffRole(role);
  return normalized ? [...ROLE_PERMISSION_MAP[normalized]] : [];
}

export function roleHasPermission(role, permission) {
  const normalizedPermission = String(permission || '').trim();
  if (!normalizedPermission) return false;
  return getRolePermissions(role).includes(normalizedPermission);
}

export function roleHasAnyPermission(role, permissions = []) {
  const normalizedPermissions = parsePermissionList(permissions);
  if (!normalizedPermissions.length) return true;
  const rolePermissions = getRolePermissions(role);
  return normalizedPermissions.some((permission) => rolePermissions.includes(permission));
}

export function roleHasAllPermissions(role, permissions = []) {
  const normalizedPermissions = parsePermissionList(permissions);
  if (!normalizedPermissions.length) return true;
  const rolePermissions = getRolePermissions(role);
  return normalizedPermissions.every((permission) => rolePermissions.includes(permission));
}

export function getAuthorizedRolesForPermission(permission) {
  const normalizedPermission = String(permission || '').trim();
  if (!normalizedPermission) return [];

  return STAFF_ROLES.filter((role) => roleHasPermission(role, normalizedPermission));
}

export function normalizeStaffRecord(record = {}, fallback = {}) {
  const role = normalizeStaffRole(record?.role);
  const email = normalizeEmail(record?.email || fallback.email);
  const teamId = normalizeTeamId(record?.teamId || fallback.teamId);
  const name = String(record?.name || fallback.name || '').trim();

  return {
    uid: String(record?.uid || fallback.uid || '').trim() || null,
    name,
    email,
    role,
    active: record?.active === true,
    teamId: teamId || null,
    inviteId: String(record?.inviteId || fallback.inviteId || '').trim() || null
  };
}

export function resolveClaimRole(claims = {}) {
  if (!claims || typeof claims !== 'object') return null;
  if (claims.captain === true) return 'captain';

  const directRole = normalizeStaffRole(claims.role);
  if (directRole) return directRole;

  const roles = parseRoleList(claims.roles);
  const priority = ['superadmin', 'owner', 'admin', 'manager', 'media', 'captain'];
  return priority.find((role) => roles.includes(role)) || null;
}

export function resolveClaimTeamId(claims = {}) {
  return normalizeTeamId(claims?.teamId || claims?.team_id || claims?.team) || null;
}

export function resolveStaffAccessSnapshot({
  user = null,
  staffRecord = null,
  allowlisted = false,
  tokenClaims = {}
} = {}) {
  const uid = String(user?.uid || '').trim() || null;
  const email = normalizeEmail(user?.email);
  const isAuthenticated = Boolean(uid);
  const staffRecordExists = staffRecord && typeof staffRecord === 'object';
  const claimRole = resolveClaimRole(tokenClaims);
  const claimTeamId = resolveClaimTeamId(tokenClaims);

  let role = null;
  let source = null;
  let name = String(user?.displayName || '').trim();
  let teamId = null;
  let active = false;
  let inactiveStaffRecord = false;

  if (staffRecordExists) {
    const staffProfile = normalizeStaffRecord(staffRecord, { uid, email, name });
    role = staffProfile.active ? staffProfile.role : null;
    source = 'staffAccess';
    name = staffProfile.name || name;
    teamId = staffProfile.teamId;
    active = Boolean(staffProfile.active && role);
    inactiveStaffRecord = !active;
  } else if (allowlisted) {
    role = 'admin';
    source = 'legacyAllowlist';
    active = true;
  } else if (claimRole) {
    role = claimRole;
    source = 'customClaims';
    teamId = claimTeamId;
    active = true;
  }

  const permissions = active ? getRolePermissions(role) : [];

  return {
    user,
    uid,
    email,
    name,
    role,
    roleLabel: getStaffRoleLabel(role),
    active,
    source,
    teamId,
    permissions,
    isAuthenticated,
    isAuthorized: Boolean(active && role),
    isSuperAdmin: role === 'superadmin',
    isOwner: role === 'owner',
    isAdmin: role === 'superadmin' || role === 'owner' || role === 'admin',
    isMedia: role === 'media',
    isManager: role === 'manager',
    isCaptain: role === 'captain',
    allowlisted: allowlisted === true,
    claimRole,
    claimTeamId,
    captainByClaims: claimRole === 'captain',
    staffRecordExists: Boolean(staffRecordExists),
    inactiveStaffRecord
  };
}

export function authzHasRole(authz = {}, allowedRoles = []) {
  const roles = parseRoleList(allowedRoles);
  if (!roles.length) return Boolean(authz?.isAuthorized);
  return Boolean(authz?.isAuthorized && roles.includes(normalizeStaffRole(authz.role)));
}

export function authzHasAnyPermission(authz = {}, permissions = []) {
  const normalizedPermissions = parsePermissionList(permissions);
  if (!normalizedPermissions.length) return Boolean(authz?.isAuthorized);
  const granted = Array.isArray(authz?.permissions) ? authz.permissions : [];
  return Boolean(
    authz?.isAuthorized
    && normalizedPermissions.some((permission) => granted.includes(permission))
  );
}

export function authzHasAllPermissions(authz = {}, permissions = []) {
  const normalizedPermissions = parsePermissionList(permissions);
  if (!normalizedPermissions.length) return Boolean(authz?.isAuthorized);
  const granted = Array.isArray(authz?.permissions) ? authz.permissions : [];
  return Boolean(
    authz?.isAuthorized
    && normalizedPermissions.every((permission) => granted.includes(permission))
  );
}

export function canAccessTeam(authz = {}, teamId = '') {
  if (!authz?.isAuthorized) return false;
  const normalizedTeamId = normalizeTeamId(teamId);
  const permissions = Array.isArray(authz.permissions) ? authz.permissions : [];

  if (!isValidTeamId(normalizedTeamId)) return false;
  if (permissions.includes(STAFF_PERMISSIONS.TEAMS_ANY)) return true;
  const assignedTeamId = normalizeTeamId(authz.teamId);
  if (!permissions.includes(STAFF_PERMISSIONS.TEAMS_ASSIGNED) || !isValidTeamId(assignedTeamId)) {
    return false;
  }

  return assignedTeamId === normalizedTeamId;
}

export function canAccessTeamTransition(authz = {}, currentTeamId = '', nextTeamId = '') {
  const currentTeam = normalizeTeamId(currentTeamId);
  const nextTeam = normalizeTeamId(nextTeamId);
  if (!isValidTeamId(currentTeam) || !isValidTeamId(nextTeam)) return false;

  const permissions = Array.isArray(authz.permissions) ? authz.permissions : [];
  if (permissions.includes(STAFF_PERMISSIONS.TEAMS_ANY)) return true;

  return currentTeam === nextTeam && canAccessTeam(authz, currentTeam);
}

export function getScopedTeamId(authz = {}, requestedTeamId = '') {
  const normalizedRequested = normalizeTeamId(requestedTeamId);
  const permissions = Array.isArray(authz.permissions) ? authz.permissions : [];

  if (normalizedRequested && !isValidTeamId(normalizedRequested)) {
    return null;
  }

  if (permissions.includes(STAFF_PERMISSIONS.TEAMS_ANY)) {
    return normalizedRequested || '';
  }

  const assignedTeam = normalizeTeamId(authz.teamId);
  if (!isValidTeamId(assignedTeam)) {
    return null;
  }

  if (normalizedRequested && normalizedRequested !== assignedTeam) {
    return null;
  }

  return assignedTeam;
}
