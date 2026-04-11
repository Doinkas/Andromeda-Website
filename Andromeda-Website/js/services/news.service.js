import { db } from '/js/core/firebase.js';
import {
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const newsRef = collection(db, 'news');

export async function listRecentNews({ limit = 5 } = {}) {
  const q = query(newsRef, orderBy('createdAt', 'desc'), fbLimit(limit));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}
