import { listRostersNeedingReview } from '/js/services/rosters.service.js';
import { listTrials } from '/js/services/trials.service.js';
import {
  buildOrganizationReviewQueue,
  canViewOrganizationReview
} from '/js/services/review-queue.js';

const reviewSection = document.getElementById('needs-review-section');
const reviewStatus = document.getElementById('needs-review-status');
const reviewTotal = document.getElementById('needs-review-total');
const rosterCount = document.getElementById('needs-review-roster-count');
const trialCount = document.getElementById('needs-review-trial-count');
const rosterList = document.getElementById('needs-review-rosters');
const trialList = document.getElementById('needs-review-trials');

function setReviewStatus(text, isError = false) {
  if (!reviewStatus) return;
  reviewStatus.textContent = text;
  reviewStatus.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--admin-muted)';
}

function formatReviewDate(value) {
  if (!value) return 'Update time unavailable';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Update time unavailable';
  return `Updated ${date.toLocaleString()}`;
}

function createReviewItem(item) {
  const link = document.createElement('a');
  link.className = 'admin-review-item';
  link.href = item.href;

  const logo = document.createElement('img');
  logo.className = 'admin-review-item__logo';
  logo.src = item.teamLogo;
  logo.alt = `${item.teamName} logo`;
  logo.loading = 'lazy';

  const copy = document.createElement('span');
  copy.className = 'admin-review-item__copy';

  const title = document.createElement('strong');
  title.className = 'admin-review-item__title';
  title.textContent = item.type === 'trial'
    ? `${item.name} - ${item.teamName}`
    : `${item.teamName} roster`;

  const status = document.createElement('span');
  status.className = 'admin-review-item__status';
  status.textContent = item.type === 'trial'
    ? `Trial status: ${item.status}`
    : item.status;

  const meta = document.createElement('span');
  meta.className = 'admin-review-item__meta';
  const modifier = item.lastModifiedBy ? ` by ${item.lastModifiedBy}` : '';
  meta.textContent = `${formatReviewDate(item.updatedAt)}${modifier}`;

  copy.append(title, status, meta);
  link.append(logo, copy);
  return link;
}

function renderReviewList(target, items, emptyText) {
  if (!target) return;
  target.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-review-empty';
    empty.textContent = emptyText;
    target.appendChild(empty);
    return;
  }

  items.forEach((item) => target.appendChild(createReviewItem(item)));
}

function renderReviewQueue(queue) {
  if (reviewTotal) reviewTotal.textContent = String(queue.totalCount);
  if (rosterCount) rosterCount.textContent = String(queue.rosterCount);
  if (trialCount) trialCount.textContent = String(queue.trialCount);

  renderReviewList(rosterList, queue.rosterItems, 'No rosters currently need verification.');
  renderReviewList(trialList, queue.trialItems, 'No trials are awaiting a decision.');
  setReviewStatus(queue.totalCount ? `${queue.totalCount} item(s) need attention.` : 'Everything is currently reviewed.');
}

window.addEventListener('admin:authorized', async (event) => {
  const authz = event?.detail || {};
  if (!canViewOrganizationReview(authz)) {
    if (reviewSection) reviewSection.hidden = true;
    return;
  }

  if (reviewSection) reviewSection.hidden = false;
  setReviewStatus('Loading review items...');

  try {
    const [rosters, trials] = await Promise.all([
      listRostersNeedingReview(),
      listTrials({ status: 'pending' })
    ]);
    renderReviewQueue(buildOrganizationReviewQueue({ rosters, trials }));
  } catch (error) {
    console.error('Load organization review queue failed:', {
      code: String(error?.code || 'unknown'),
      message: String(error?.message || error)
    });
    setReviewStatus('Needs Review could not be loaded. Please try again later.', true);
  }
});
