export function getRosterWorkflowState({
  hasWriteAccess = false,
  hasSelectedTeam = false,
  hasUnsavedChanges = false,
  isLoading = false,
  isSaving = false,
  isVerifying = false
} = {}) {
  let saveStatus = 'Select a team to edit.';
  let saveStatusKind = 'idle';

  if (isLoading) {
    saveStatus = 'Loading roster...';
    saveStatusKind = 'loading';
  } else if (hasSelectedTeam && hasUnsavedChanges) {
    saveStatus = 'Unsaved changes';
    saveStatusKind = 'unsaved';
  } else if (hasSelectedTeam) {
    saveStatus = 'All changes saved';
    saveStatusKind = 'saved';
  }

  const saveDisabled = !hasWriteAccess
    || !hasSelectedTeam
    || !hasUnsavedChanges
    || isLoading
    || isSaving
    || isVerifying;
  const verifyDisabled = !hasWriteAccess
    || !hasSelectedTeam
    || hasUnsavedChanges
    || isLoading
    || isSaving
    || isVerifying;

  let verificationGuidance = 'Select a team to review its verification status.';
  if (hasSelectedTeam && hasUnsavedChanges) {
    verificationGuidance = 'Save your changes before verifying the roster.';
  } else if (hasSelectedTeam && !hasWriteAccess) {
    verificationGuidance = 'Your role has read-only roster access.';
  } else if (hasSelectedTeam) {
    verificationGuidance = 'Verification is available when all roster changes are saved.';
  }

  return {
    saveDisabled,
    saveLabel: isSaving ? 'Saving...' : 'Save Changes',
    saveStatus,
    saveStatusKind,
    verifyDisabled,
    verificationGuidance
  };
}
