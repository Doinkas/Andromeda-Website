// /js/core/firebase.js

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { APP_CHECK_CONFIG } from "/js/config/app-check.config.js";

const firebaseConfig = {
  apiKey: "AIzaSyDOadPpnM8RJOCa2zPt9gVr8x3rnasiCiI",
  authDomain: "andromeda-website-f255f.firebaseapp.com",
  projectId: "andromeda-website-f255f",
  storageBucket: "andromeda-website-f255f.firebasestorage.app",
  messagingSenderId: "106401301554",
  appId: "1:106401301554:web:4d8dbd0032f1f042a9682b",
  measurementId: "G-HC6PL9SYZH"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

function isLocalDevelopmentHost() {
  const hostname = String(globalThis.location?.hostname || '').trim().toLowerCase();
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function isLocalAppCheckDebugEnabled() {
  if (!isLocalDevelopmentHost()) return false;

  try {
    return globalThis.localStorage?.getItem(APP_CHECK_CONFIG.localhostDebugStorageKey) === 'true';
  } catch (_error) {
    return false;
  }
}

function initializeConfiguredAppCheck() {
  const siteKey = String(APP_CHECK_CONFIG.recaptchaEnterpriseSiteKey || '').trim();
  if (!siteKey) return null;

  if (isLocalAppCheckDebugEnabled()) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: APP_CHECK_CONFIG.isTokenAutoRefreshEnabled === true
    });
  } catch (error) {
    console.warn('Firebase App Check initialization failed:', error);
    return null;
  }
}

export const appCheck = initializeConfiguredAppCheck();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
