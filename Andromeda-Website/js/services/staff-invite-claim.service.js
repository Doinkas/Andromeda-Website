import { db } from '/js/core/firebase.js';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  normalizeEmail,
  normalizeStaffRole,
  normalizeTeamId
} from '/js/services/staff-roles.js';

const STAFF_INVITES_REF = collection(db, 'staffInvites');

export async function acceptPendingStaffInvite(user) {
  const uid = String(user?.uid || '').trim();
  const email = normalizeEmail(user?.email);

  if (!uid || !email || user?.emailVerified !== true) return null;

  try {
    const inviteSnapshot = await getDocs(query(
      STAFF_INVITES_REF,
      where('email', '==', email),
      where('status', '==', 'pending'),
      limit(1)
    ));
    const inviteDoc = inviteSnapshot.docs[0];
    if (!inviteDoc) return null;

    const invite = inviteDoc.data();
    const role = normalizeStaffRole(invite.role);
    if (!role) return null;

    const teamId = normalizeTeamId(invite.teamId) || null;
    const name = String(invite.name || user.displayName || '').trim();
    const staffRef = doc(db, 'staffAccess', uid);
    const batch = writeBatch(db);

    batch.set(staffRef, {
      name,
      email,
      role,
      active: true,
      teamId,
      inviteId: inviteDoc.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastModifiedBy: email,
      deactivatedAt: null,
      deactivatedBy: null
    });
    batch.update(inviteDoc.ref, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      acceptedByUid: uid,
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    return {
      uid,
      name,
      email,
      role,
      active: true,
      teamId,
      inviteId: inviteDoc.id
    };
  } catch (error) {
    if (error?.code !== 'permission-denied') {
      console.error('Staff invitation claim failed:', error);
    }
    return null;
  }
}
