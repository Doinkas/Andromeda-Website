export const STAFF_DISPLAY_NAME_MAX_LENGTH = 60;

export function normalizeStaffDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function validateStaffDisplayName(value) {
  const rawName = String(value || '');
  if (/[\u0000-\u001f\u007f]/.test(rawName)) {
    throw new Error('Staff name contains unsupported characters.');
  }

  const name = normalizeStaffDisplayName(rawName);

  if (!name) {
    throw new Error('Enter the name staff should see for you.');
  }
  if (name.length > STAFF_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Staff name must be ${STAFF_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return name;
}

export function isValidStaffDisplayName(value) {
  try {
    validateStaffDisplayName(value);
    return true;
  } catch (_error) {
    return false;
  }
}

export function getStaffDisplayName({ staffName = '', firebaseDisplayName = '', email = '' } = {}) {
  const candidates = [staffName, firebaseDisplayName, email];
  return candidates
    .map(normalizeStaffDisplayName)
    .find(Boolean) || 'Staff member';
}

export function needsStaffNameSetup(staffProfile = {}) {
  if (staffProfile?.staffRecordExists === false) return false;
  if (staffProfile?.nameSetupComplete === true) return false;
  if (staffProfile?.nameSetupComplete === false) return true;
  const storedName = Object.prototype.hasOwnProperty.call(staffProfile, 'staffRecordName')
    ? staffProfile.staffRecordName
    : staffProfile?.name;
  return !isValidStaffDisplayName(storedName);
}
