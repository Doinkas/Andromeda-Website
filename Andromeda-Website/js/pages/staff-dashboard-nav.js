import { auth, db } from '/js/core/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { shouldShowStaffDashboard } from '/js/services/staff-roles.js';

function addDashboardLink() {
  const nav = document.querySelector('body > header nav');
  if (!nav || nav.querySelector('[data-staff-dashboard]')) return;
  const linkTarget = nav.querySelector('[data-site-nav-menu]') || nav;

  const link = document.createElement('a');
  link.href = '/admin/';
  link.textContent = 'Dashboard';
  link.dataset.staffDashboard = 'true';
  linkTarget.appendChild(link);
}

let unsubscribe = null;
unsubscribe = onAuthStateChanged(auth, async (user) => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  if (!user?.uid) return;

  try {
    const staffSnapshot = await getDoc(doc(db, 'staffAccess', user.uid));
    if (!staffSnapshot.exists() || auth.currentUser?.uid !== user.uid) return;

    if (shouldShowStaffDashboard({ user, staffRecord: staffSnapshot.data() })) {
      addDashboardLink();
    }
  } catch (_error) {
    // Visibility is convenience only; failures remain hidden and the admin gate stays authoritative.
  }
});
