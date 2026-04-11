// /js/core/firebase.js

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

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
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);