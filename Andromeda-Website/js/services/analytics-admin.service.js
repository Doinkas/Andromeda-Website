import { db } from '/js/core/firebase.js';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const ANALYTICS_EVENTS_REF = collection(db, 'analyticsEvents');

export async function listAnalyticsEvents({ maxItems = 5000 } = {}) {
  const normalizedLimit = Number.isFinite(Number(maxItems)) ? Math.min(5000, Math.max(100, Number(maxItems))) : 5000;

  const eventsQuery = query(
    ANALYTICS_EVENTS_REF,
    orderBy('createdAt', 'desc'),
    limit(normalizedLimit)
  );

  const snapshot = await getDocs(eventsQuery);
  return snapshot.docs.map((docSnap) => {
    const raw = docSnap.data() || {};
    return {
      id: docSnap.id,
      eventName: raw.eventName || 'unknown',
      pagePath: raw.pagePath || '/',
      pageTitle: raw.pageTitle || '',
      sessionId: raw.sessionId || '',
      teamId: raw.teamId || '',
      platform: raw.platform || '',
      destination: raw.destination || '',
      label: raw.label || '',
      section: raw.section || '',
      ctaHref: raw.ctaHref || '',
      createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate() : null
    };
  });
}
