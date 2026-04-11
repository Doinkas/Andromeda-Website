import { auth } from '/js/core/firebase.js';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export async function adminSignIn() {
  return signInWithPopup(auth, provider);
}

export async function adminSignOut() {
  return signOut(auth);
}

export function onAdminAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
