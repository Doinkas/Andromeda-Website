import { auth, db } from '/js/core/firebase.js';
import { doc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { normalizeEmail } from './staff-roles.js';
import { validateStaffDisplayName } from './staff-identity.js';

export async function completeStaffNameSetup(value) {
  const user = auth.currentUser;
  const uid = String(user?.uid || '').trim();
  const email = normalizeEmail(user?.email);

  if (!uid || !email) {
    throw new Error('Sign in again to finish staff name setup.');
  }

  const name = validateStaffDisplayName(value);
  await updateDoc(doc(db, 'staffAccess', uid), {
    name,
    nameSetupComplete: true,
    updatedAt: serverTimestamp(),
    lastModifiedBy: email
  });

  return { uid, email, name };
}
