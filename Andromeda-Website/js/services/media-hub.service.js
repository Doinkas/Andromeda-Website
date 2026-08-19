import { db } from '/js/core/firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { requirePermission } from '/js/services/authz.service.js';

const MEDIA_HUB_REF = doc(db, 'siteContent', 'homeMediaHub');

export const DEFAULT_HOME_MEDIA_HUB = {
  slides: [
    {
      tabLabel: 'Newsroom',
      badge: 'Newsroom',
      icon: 'images/branding/andro-org.png',
      media: {
        type: 'image',
        url: 'images/branding/andro-org.png',
        alt: 'Andromeda Esports logo',
        videoUrl: ''
      },
      title: 'Official Updates And Headlines',
      description: 'Track the latest announcements, post-match recaps, and organization-wide updates published by Andromeda.',
      bullets: [
        'Announcement feed and change logs',
        'Result headlines and recap highlights',
        'Featured stories from the org'
      ],
      actions: [
        { label: 'Contact for updates', href: 'pages/contact.html', primary: false }
      ]
    },
    {
      tabLabel: 'Events',
      badge: 'Events',
      icon: 'images/branding/andro-org.png',
      media: {
        type: 'image',
        url: 'images/branding/andro-org.png',
        alt: 'Andromeda Esports logo',
        videoUrl: ''
      },
      title: 'Calendar And Match Coverage',
      description: 'Monitor upcoming event windows, match days, and key competition checkpoints across active teams.',
      bullets: [
        'Upcoming event windows',
        'Match day visibility',
        'Public schedule and tournament cadence'
      ],
      actions: [
        { label: 'View schedule', href: 'pages/schedule.html', primary: false }
      ]
    },
    {
      tabLabel: 'Community',
      badge: 'Community',
      icon: 'images/branding/andro-org.png',
      media: {
        type: 'image',
        url: 'images/branding/andro-org.png',
        alt: 'Andromeda Esports logo',
        videoUrl: ''
      },
      title: 'Community Channels And Org Identity',
      description: 'Follow the channels where Andromeda posts clips, streams, short-form highlights, and learn what the org stands for.',
      bullets: [
        'Learn who we are and what we value',
        'Discord for announcements and recruiting',
        'Twitch and YouTube for streams and VODs',
        'TikTok for short-form media highlights'
      ],
      actions: [
        { label: 'Learn Who We Are', href: 'pages/contact.html#about-andromeda', primary: true },
        { label: 'Discord', href: 'https://discord.gg/yHfEKtBAbc', primary: false },
        { label: 'Twitch', href: 'https://twitch.tv/andromeda_esports_', primary: false },
        { label: 'YouTube', href: 'https://youtube.com/@andromedaesports-n5z1w', primary: false }
      ]
    }
  ]
};

function normalizeAction(action) {
  const label = String(action?.label || '').trim();
  const href = String(action?.href || '').trim();
  if (!label || !href) return null;

  return {
    label,
    href,
    primary: action?.primary === true
  };
}

function normalizeMedia(media, fallback, iconFallback = '') {
  const hasMedia = media && typeof media === 'object';
  const url = String(hasMedia ? media.url || '' : fallback?.url || iconFallback || '').trim();
  const alt = String(hasMedia ? media.alt || '' : fallback?.alt || '').trim();
  const videoUrl = String(hasMedia ? media.videoUrl || '' : fallback?.videoUrl || '').trim();

  return {
    type: 'image',
    url,
    alt,
    videoUrl
  };
}

function normalizeSlide(slide, fallback) {
  const icon = String(slide?.icon || fallback?.icon || '').trim();
  const next = {
    tabLabel: String(slide?.tabLabel || fallback?.tabLabel || '').trim(),
    badge: String(slide?.badge || fallback?.badge || '').trim(),
    icon,
    media: normalizeMedia(slide?.media, fallback?.media, icon),
    title: String(slide?.title || fallback?.title || '').trim(),
    description: String(slide?.description || fallback?.description || '').trim(),
    bullets: Array.isArray(slide?.bullets)
      ? slide.bullets.map((item) => String(item || '').trim()).filter(Boolean)
      : fallback?.bullets || [],
    actions: Array.isArray(slide?.actions)
      ? slide.actions.map((item) => normalizeAction(item)).filter(Boolean)
      : fallback?.actions || []
  };

  return next;
}

export function normalizeMediaHubConfig(config) {
  const fallbackSlides = DEFAULT_HOME_MEDIA_HUB.slides;
  const slides = Array.isArray(config?.slides) ? config.slides : [];

  return {
    slides: fallbackSlides.map((fallback, index) => normalizeSlide(slides[index], fallback))
  };
}

export async function getHomeMediaHubContent() {
  const snap = await getDoc(MEDIA_HUB_REF);
  if (!snap.exists()) {
    return normalizeMediaHubConfig(DEFAULT_HOME_MEDIA_HUB);
  }

  return normalizeMediaHubConfig(snap.data());
}

export async function saveHomeMediaHubContent(config, updatedBy = null) {
  await requirePermission('mediaHub:write', {
    message: 'You are not authorized to publish media hub content.'
  });

  const normalized = normalizeMediaHubConfig(config);
  const currentSnap = await getDoc(MEDIA_HUB_REF);

  let previousConfig = null;
  let previousUpdatedAt = null;

  if (currentSnap.exists()) {
    const currentData = currentSnap.data() || {};
    previousConfig = normalizeMediaHubConfig(currentData);
    previousUpdatedAt = currentData.updatedAt || null;
  }

  await setDoc(
    MEDIA_HUB_REF,
    {
      ...normalized,
      previousConfig,
      previousUpdatedAt,
      backupCapturedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastModifiedBy: String(updatedBy || '').trim().toLowerCase() || null
    },
    { merge: true }
  );

  return normalized;
}
