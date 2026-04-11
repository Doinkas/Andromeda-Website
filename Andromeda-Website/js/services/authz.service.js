import { auth } from '/js/core/firebase.js';
import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { isEmailAllowlisted } from '/js/services/admin.service.js';

export function getCurrentUser() {
  return auth.currentUser || null;
}

export async function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  return user;
}

function hasCaptainClaims(claims) {
  if (!claims || typeof claims !== 'object') return false;

  if (claims.captain === true) return true;

  const role = String(claims.role || '').toLowerCase().trim();
  if (role === 'captain' || role === 'admin') return true;

  if (Array.isArray(claims.roles)) {
    return claims.roles.some((value) => {
      const normalized = String(value || '').toLowerCase().trim();
      return normalized === 'captain' || normalized === 'admin';
    });
  }

  return false;
}

export async function requireAdminOrCaptain() {
  const user = await requireAuth();
  const email = String(user.email || '').trim().toLowerCase();

  let allowlisted = false;
  try {
    allowlisted = await isEmailAllowlisted(email);
  } catch (error) {
    console.error('Allowlist check failed:', error);
  }

  const tokenResult = await getIdTokenResult(user, false);
  const captainByClaims = hasCaptainClaims(tokenResult?.claims);

  if (!allowlisted && !captainByClaims) {
    throw new Error('You are not authorized to submit match reports.');
  }

  return {
    user,
    email,
    allowlisted,
    captainByClaims
  };
}
