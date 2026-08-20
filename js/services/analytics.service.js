import { db } from '/js/core/firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const ANALYTICS_EVENTS_REF = collection(db, 'analyticsEvents');

function normalizeText(value, maxLen = 200) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, maxLen);
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem('andromeda.analytics.sessionId');
    if (existing) return existing;

    const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem('andromeda.analytics.sessionId', next);
    return next;
  } catch (_error) {
    return `${Date.now()}-no-session-storage`;
  }
}

async function persistEvent(name, payload) {
  const docPayload = {
    eventName: normalizeText(name, 80),
    pagePath: normalizeText(payload.page_path || window.location.pathname, 180),
    pageTitle: normalizeText(payload.page_title || document.title, 180),
    sessionId: normalizeText(getSessionId(), 80),
    teamId: normalizeText(payload.team_id, 40),
    platform: normalizeText(payload.platform, 40),
    destination: normalizeText(payload.destination, 180),
    label: normalizeText(payload.label || payload.cta_label, 140),
    section: normalizeText(payload.section, 80),
    ctaHref: normalizeText(payload.cta_href, 200),
    error: normalizeText(payload.error, 220),
    createdAt: serverTimestamp()
  };

  await addDoc(ANALYTICS_EVENTS_REF, docPayload);
}

export function trackEvent(eventName, params = {}) {
  const name = String(eventName || '').trim();
  if (!name) return;

  const payload = {
    ...params,
    page_path: window.location.pathname,
    page_title: document.title
  };

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: name,
        ...payload
      });
    }
  } catch (error) {
    console.warn('Analytics event dispatch failed:', error);
  }

  persistEvent(name, payload).catch((error) => {
    console.warn('Analytics event persistence failed:', error);
  });
}
