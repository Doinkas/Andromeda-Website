import { trackEvent } from '/js/services/analytics.service.js';

function currentPath() {
  return String(window.location.pathname || '').trim().toLowerCase();
}

function trackPageView() {
  const key = `andromeda.analytics.pageview:${currentPath()}`;

  try {
    if (window.sessionStorage.getItem(key) === '1') return;
    window.sessionStorage.setItem(key, '1');
  } catch (_error) {
    // ignore storage failures
  }

  trackEvent('page_view', {
    label: currentPath()
  });
}

function trackTeamView() {
  const path = currentPath();
  if (!path.endsWith('/team.html')) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = params.get('team') || params.get('id') || params.get('teamId');
  const normalized = String(teamId || '').trim().toLowerCase();
  if (!normalized) return;

  trackEvent('team_profile_view', {
    team_id: normalized,
    label: normalized
  });
}

function getSocialPlatformFromHref(href) {
  const value = String(href || '').toLowerCase();
  if (value.includes('discord.gg') || value.includes('discord.com')) return 'discord';
  if (value.includes('twitch.tv')) return 'twitch';
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
  if (value.includes('tiktok.com')) return 'tiktok';
  return null;
}

function setupClickTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;

    const href = String(link.getAttribute('href') || '').trim();
    if (!href) return;

    const platform = getSocialPlatformFromHref(href);
    if (platform) {
      trackEvent('social_click', {
        platform,
        destination: href,
        label: String(link.textContent || '').trim() || platform
      });
      return;
    }

    if (href.startsWith('mailto:')) {
      trackEvent('contact_click', {
        destination: href,
        label: String(link.textContent || '').trim() || 'mailto'
      });
      return;
    }

    if (href.includes('contact.html')) {
      trackEvent('contact_intent_click', {
        destination: href,
        label: String(link.textContent || '').trim() || 'contact'
      });
    }
  });
}

function setupContactFormTracking() {
  const forms = Array.from(document.querySelectorAll('form[action^="mailto:"]'));
  forms.forEach((form) => {
    form.addEventListener('submit', () => {
      trackEvent('contact_form_submit_intent', {
        destination: String(form.getAttribute('action') || '').trim() || 'mailto:contact'
      });
    });
  });
}

trackPageView();
trackTeamView();
setupClickTracking();
setupContactFormTracking();
