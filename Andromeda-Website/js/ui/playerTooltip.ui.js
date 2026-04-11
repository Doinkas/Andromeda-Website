/**
 * Player Profile Tooltip (Hover Card)
 * Single shared tooltip for all roster pages
 * Handles keyboard focus, mobile tap, and safe text rendering
 */

const TOOLTIP_ID = 'player-profile-tooltip';

function createTooltipElement() {
  const tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.style.cssText = `
    position: fixed;
    z-index: 1000;
    background: var(--bg-elevated);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    padding: 12px;
    box-shadow: var(--shadow-lg);
    max-width: 280px;
    max-height: 400px;
    overflow-y: auto;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 200ms ease, visibility 200ms ease;
  `;
  tooltip.innerHTML = ''; // Will be populated dynamically
  return tooltip;
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderProfileContent(profile, playerName) {
  if (!profile) {
    return `
      <p style="color: var(--text-muted); margin: 0; font-size: 0.95rem;">
        Profile coming soon
      </p>
    `;
  }

  let html = `<div style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.5;">`;

  if (profile.bio) {
    html += `<p style="margin: 0 0 8px; color: var(--text-muted);">`;
    html += escapeText(profile.bio);
    html += `</p>`;
  }

  if (profile.mains && Array.isArray(profile.mains) && profile.mains.length > 0) {
    html += `<p style="margin: 8px 0; font-weight: 600; color: var(--accent-primary);">Mains</p>`;
    html += `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">`;
    profile.mains.forEach((main) => {
      html += `<span style="background: rgba(255, 255, 255, 0.10); border-radius: 6px; padding: 4px 8px; font-size: 0.85rem;">`;
      html += escapeText(main);
      html += `</span>`;
    });
    html += `</div>`;
  }

  if (profile.strength) {
    html += `<p style="margin: 8px 0 0;"><strong>Strength:</strong> `;
    html += escapeText(profile.strength);
    html += `</p>`;
  }

  if (profile.teamValue) {
    html += `<p style="margin: 4px 0 0;"><strong>Team Value:</strong> `;
    html += escapeText(profile.teamValue);
    html += `</p>`;
  }

  if (profile.favoriteHero) {
    html += `<p style="margin: 4px 0 0;"><strong>Favorite Hero:</strong> `;
    html += escapeText(profile.favoriteHero);
    html += `</p>`;
  }

  if (profile.favoriteMap) {
    html += `<p style="margin: 4px 0 0;"><strong>Favorite Map:</strong> `;
    html += escapeText(profile.favoriteMap);
    html += `</p>`;
  }

  if (profile.funFact) {
    html += `<p style="margin: 4px 0 0; font-style: italic; color: var(--text-muted);">`;
    html += escapeText(profile.funFact);
    html += `</p>`;
  }

  if (profile.socials && typeof profile.socials === 'object') {
    const socials = profile.socials;
    if (socials.twitch || socials.twitter || socials.youtube) {
      html += `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.10); display: flex; gap: 8px;">`;
      if (socials.twitch) {
        html += `<a href="${escapeText(socials.twitch)}" target="_blank" rel="noopener" style="color: var(--accent-primary); font-size: 0.85rem;">Twitch</a>`;
      }
      if (socials.twitter) {
        html += `<a href="${escapeText(socials.twitter)}" target="_blank" rel="noopener" style="color: var(--accent-primary); font-size: 0.85rem;">Twitter</a>`;
      }
      if (socials.youtube) {
        html += `<a href="${escapeText(socials.youtube)}" target="_blank" rel="noopener" style="color: var(--accent-primary); font-size: 0.85rem;">YouTube</a>`;
      }
      html += `</div>`;
    }
  }

  html += `</div>`;
  return html;
}

function showTooltip(tooltip, trigger, profile, playerName) {
  const rect = trigger.getBoundingClientRect();

  // Populate content safely
  tooltip.innerHTML = renderProfileContent(profile, playerName);

  // Position tooltip
  const tooltipHeight = 200; // Estimate, will adjust
  let top = rect.bottom + 8;
  let left = rect.left;

  // Ensure tooltip doesn't go off-screen horizontally
  if (left + 280 > window.innerWidth) {
    left = Math.max(8, window.innerWidth - 288);
  }

  // Ensure tooltip doesn't go off-screen vertically
  if (top + tooltipHeight > window.innerHeight) {
    top = Math.max(8, rect.top - tooltipHeight - 8);
  }

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.style.opacity = '1';
  tooltip.style.visibility = 'visible';
}

function hideTooltip(tooltip) {
  tooltip.style.opacity = '0';
  tooltip.style.visibility = 'hidden';
}

export function initPlayerTooltips() {
  let tooltip = document.getElementById(TOOLTIP_ID);
  if (!tooltip) {
    tooltip = createTooltipElement();
    document.body.appendChild(tooltip);
  }

  let currentTrigger = null;
  let isMobile = false;

  function closeTooltip() {
    hideTooltip(tooltip);
    currentTrigger = null;
  }

  // Detect if touch is available
  function updateIsMobile() {
    isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }

  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);

  // Delegate event handlers to document
  document.addEventListener('mouseenter', (e) => {
    const trigger = e.target.closest('[data-player-name][data-player-profile]');
    if (!trigger || isMobile) return;

    const playerName = trigger.getAttribute('data-player-name');
    const profileJson = trigger.getAttribute('data-player-profile');
    let profile = null;

    if (profileJson) {
      try {
        profile = JSON.parse(profileJson);
      } catch (err) {
        console.warn('Failed to parse player profile', err);
      }
    }

    currentTrigger = trigger;
    showTooltip(tooltip, trigger, profile, playerName);
  }, true);

  document.addEventListener('mouseleave', (e) => {
    if (e.target.closest('[data-player-name][data-player-profile]') || e.target === tooltip) {
      return;
    }
    closeTooltip();
  }, true);

  document.addEventListener('focus', (e) => {
    const trigger = e.target.closest('[data-player-name][data-player-profile]');
    if (!trigger || isMobile) return;

    const playerName = trigger.getAttribute('data-player-name');
    const profileJson = trigger.getAttribute('data-player-profile');
    let profile = null;

    if (profileJson) {
      try {
        profile = JSON.parse(profileJson);
      } catch (err) {
        console.warn('Failed to parse player profile', err);
      }
    }

    currentTrigger = trigger;
    showTooltip(tooltip, trigger, profile, playerName);
  }, true);

  document.addEventListener('blur', (e) => {
    if (e.target.closest('[data-player-name][data-player-profile]')) {
      closeTooltip();
    }
  }, true);

  // Mobile: tap to toggle
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-player-name][data-player-profile]');
    if (!trigger || !isMobile) return;

    e.preventDefault();

    if (currentTrigger === trigger && tooltip.style.visibility === 'visible') {
      closeTooltip();
    } else {
      const playerName = trigger.getAttribute('data-player-name');
      const profileJson = trigger.getAttribute('data-player-profile');
      let profile = null;

      if (profileJson) {
        try {
          profile = JSON.parse(profileJson);
        } catch (err) {
          console.warn('Failed to parse player profile', err);
        }
      }

      currentTrigger = trigger;
      showTooltip(tooltip, trigger, profile, playerName);
    }
  }, true);

  // Close tooltip on tap outside (mobile)
  document.addEventListener('click', (e) => {
    if (!isMobile || e.target === tooltip || tooltip.contains(e.target)) return;
    if (!e.target.closest('[data-player-name][data-player-profile]')) {
      closeTooltip();
    }
  }, true);
}

