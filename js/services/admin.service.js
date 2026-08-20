import { db } from '/js/core/firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function isEmailAllowlisted(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  try {
    const allowlistRef = doc(db, 'config', 'adminAllowlist');
    const allowlistDoc = await getDoc(allowlistRef);
    
    if (!allowlistDoc.exists()) return false;
    
    const emails = allowlistDoc.data().emails || {};
    return emails[normalizedEmail] === true;
  } catch (error) {
    console.error('Allowlist check error:', error);
    throw error;
  }
}

export async function createAllowlistEntry(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Valid email address required');

  try {
    const allowlistRef = doc(db, 'config', 'adminAllowlist');
    const allowlistDoc = await getDoc(allowlistRef);
    
    const emails = allowlistDoc.exists() ? (allowlistDoc.data().emails || {}) : {};
    emails[normalizedEmail] = true;
    
    await setDoc(allowlistRef, { 
      emails,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error(`Failed to create allowlist entry for ${normalizedEmail}:`, error);
    throw new Error(`Failed to add ${email}: ${error.message}`);
  }
}

export async function removeAllowlistEntry(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Valid email address required');

  try {
    const allowlistRef = doc(db, 'config', 'adminAllowlist');
    const allowlistDoc = await getDoc(allowlistRef);
    
    if (!allowlistDoc.exists()) return;
    
    const emails = allowlistDoc.data().emails || {};
    delete emails[normalizedEmail];
    
    await setDoc(allowlistRef, { 
      emails,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error(`Failed to remove allowlist entry for ${normalizedEmail}:`, error);
    throw new Error(`Failed to remove ${email}: ${error.message}`);
  }
}

export async function listAllowlist() {
  try {
    const allowlistRef = doc(db, 'config', 'adminAllowlist');
    const allowlistDoc = await getDoc(allowlistRef);
    
    if (!allowlistDoc.exists()) return [];
    
    const emails = allowlistDoc.data().emails || {};
    return Object.keys(emails);
  } catch (error) {
    console.error('Failed to list allowlist:', error);
    throw error;
  }
}
