import { listAnalyticsEvents } from '/js/services/analytics-admin.service.js';

const statusNode = document.querySelector('[data-analytics-status]');
const recentEventsBody = document.querySelector('[data-recent-events]');

const metricNodes = {
  totalEvents: document.querySelector('[data-metric="totalEvents"]'),
  pageViews: document.querySelector('[data-metric="pageViews"]'),
  teamViews: document.querySelector('[data-metric="teamViews"]'),
  socialClicks: document.querySelector('[data-metric="socialClicks"]'),
  contactIntents: document.querySelector('[data-metric="contactIntents"]')
};

const listNodes = {
  topPages: document.querySelector('[data-list="topPages"]'),
  topTeams: document.querySelector('[data-list="topTeams"]'),
  socialPlatforms: document.querySelector('[data-list="socialPlatforms"]'),
  topCtas: document.querySelector('[data-list="topCtas"]')
};

let hasAnalyticsAccess = false;

function incrementCount(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function sortedEntries(map, max = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function formatPath(path) {
  const value = String(path || '/').trim();
  if (value === '/') return '/ (home)';
  return value;
}

function formatEventName(name) {
  const normalized = String(name || '').toLowerCase();
  const labels = {
    page_view: 'Page view',
    team_profile_view: 'Team profile view',
    social_click: 'Social click',
    contact_click: 'Contact click',
    contact_intent_click: 'Contact intent click',
    contact_form_submit_intent: 'Contact form intent',
    homepage_cta_click: 'Homepage button click',
    media_hub_save_started: 'Media Hub save started',
    media_hub_save_completed: 'Media Hub save completed',
    media_hub_save_failed: 'Media Hub save failed'
  };

  return labels[normalized] || normalized.replace(/_/g, ' ');
}

function renderMetric(name, value) {
  const node = metricNodes[name];
  if (!node) return;
  node.textContent = formatNumber(value);
}

function renderRankedList(name, entries, emptyLabel = 'No data yet') {
  const node = listNodes[name];
  if (!node) return;

  if (!entries.length) {
    node.innerHTML = `<li>${emptyLabel}</li>`;
    return;
  }

  node.innerHTML = entries
    .map(([label, count]) => `<li><strong>${formatNumber(count)}</strong> - ${label}</li>`)
    .join('');
}

function renderRecentEvents(events) {
  if (!recentEventsBody) return;

  if (!events.length) {
    recentEventsBody.innerHTML = '<tr><td colspan="3">No events tracked yet.</td></tr>';
    return;
  }

  recentEventsBody.innerHTML = events.slice(0, 30).map((event) => {
    const detail = event.teamId || event.platform || event.destination || event.label || '—';

    return `
      <tr>
        <td>${formatEventName(event.eventName)}</td>
        <td>${formatPath(event.pagePath)}</td>
        <td>${detail}</td>
      </tr>
    `;
  }).join('');
}

function summarize(events) {
  const topPages = new Map();
  const topTeams = new Map();
  const socialPlatforms = new Map();
  const topCtas = new Map();

  let pageViews = 0;
  let teamViews = 0;
  let socialClicks = 0;
  let contactIntents = 0;

  events.forEach((event) => {
    const name = String(event.eventName || '').toLowerCase();

    if (name === 'page_view') {
      pageViews += 1;
      incrementCount(topPages, formatPath(event.pagePath));
    }

    if (name === 'team_profile_view') {
      teamViews += 1;
      incrementCount(topTeams, event.teamId || 'unknown-team');
    }

    if (name === 'social_click') {
      socialClicks += 1;
      incrementCount(socialPlatforms, event.platform || 'other');
    }

    if (name === 'homepage_cta_click') {
      incrementCount(topCtas, event.label || event.ctaHref || 'unknown-cta');
    }

    if (
      name === 'contact_click'
      || name === 'contact_intent_click'
      || name === 'contact_form_submit_intent'
    ) {
      contactIntents += 1;
    }
  });

  return {
    totalEvents: events.length,
    pageViews,
    teamViews,
    socialClicks,
    contactIntents,
    topPages: sortedEntries(topPages),
    topTeams: sortedEntries(topTeams),
    socialPlatforms: sortedEntries(socialPlatforms),
    topCtas: sortedEntries(topCtas)
  };
}

async function loadAnalytics() {
  if (!hasAnalyticsAccess) {
    if (statusNode) {
      statusNode.textContent = 'Your role cannot view analytics.';
    }
    return;
  }

  if (statusNode) {
    statusNode.textContent = 'Loading all-time analytics...';
  }

  try {
    const events = await listAnalyticsEvents({ maxItems: 5000 });
    const summary = summarize(events);

    renderMetric('totalEvents', summary.totalEvents);
    renderMetric('pageViews', summary.pageViews);
    renderMetric('teamViews', summary.teamViews);
    renderMetric('socialClicks', summary.socialClicks);
    renderMetric('contactIntents', summary.contactIntents);

    renderRankedList('topPages', summary.topPages, 'No page views tracked yet');
    renderRankedList('topTeams', summary.topTeams, 'No team profile views tracked yet');
    renderRankedList('socialPlatforms', summary.socialPlatforms, 'No social clicks tracked yet');
    renderRankedList('topCtas', summary.topCtas, 'No button clicks tracked yet');

    renderRecentEvents(events);

    if (statusNode) {
      statusNode.textContent = `Showing ${formatNumber(events.length)} recent tracked events (all-time totals above).`;
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
    if (statusNode) {
      statusNode.textContent = 'Could not load analytics events. Check Firestore rules and your admin access.';
    }
  }
}

document.addEventListener('admin:authorized', async (event) => {
  const permissions = Array.isArray(event?.detail?.permissions) ? event.detail.permissions : [];
  hasAnalyticsAccess = permissions.includes('analytics:read');
  await loadAnalytics();
});
