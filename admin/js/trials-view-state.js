export const TRIALS_VIEWS = Object.freeze({
  PENDING: 'pending',
  HISTORY: 'history',
  ALL: 'all'
});

export const CLOSED_TRIAL_STATUSES = Object.freeze(['approved', 'rejected', 'dropped']);

export function normalizeTrialsView(value) {
  const view = String(value || '').trim().toLowerCase();
  return Object.values(TRIALS_VIEWS).includes(view) ? view : TRIALS_VIEWS.PENDING;
}

export function getTrialStatusLabel(status) {
  const normalized = String(status || 'pending').trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getTrialsViewCounts(trials = []) {
  return trials.reduce((counts, trial) => {
    const status = String(trial?.status || 'pending').trim().toLowerCase();
    counts.all += 1;
    if (status === 'pending') counts.pending += 1;
    if (CLOSED_TRIAL_STATUSES.includes(status)) counts.history += 1;
    return counts;
  }, { pending: 0, history: 0, all: 0 });
}

export function filterTrialsForView(trials = [], { view = TRIALS_VIEWS.PENDING, historyStatus = '' } = {}) {
  const normalizedView = normalizeTrialsView(view);
  const normalizedHistoryStatus = String(historyStatus || '').trim().toLowerCase();

  return trials.filter((trial) => {
    const status = String(trial?.status || 'pending').trim().toLowerCase();
    if (normalizedView === TRIALS_VIEWS.PENDING) return status === 'pending';
    if (normalizedView === TRIALS_VIEWS.HISTORY) {
      if (!CLOSED_TRIAL_STATUSES.includes(status)) return false;
      return !normalizedHistoryStatus || status === normalizedHistoryStatus;
    }
    return true;
  });
}
