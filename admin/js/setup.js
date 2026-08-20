import { auth } from '/js/core/firebase.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { createAllowlistEntry, removeAllowlistEntry, listAllowlist } from '/js/services/admin.service.js';

const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const authStatus = document.getElementById('auth-status');
const emailInput = document.getElementById('email-input');
const addBtn = document.getElementById('add-btn');
const addStatus = document.getElementById('add-status');
const allowlistContainer = document.getElementById('allowlist-container');
const listStatus = document.getElementById('list-status');
const seedEmailsInput = document.getElementById('seed-emails');
const seedBtn = document.getElementById('seed-btn');
const seedStatus = document.getElementById('seed-status');

let currentUser = null;

function setStatus(el, message, isError = false) {
  el.textContent = message;
  el.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--text-muted)';
}

signInBtn.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Sign-in failed:', error);
    setStatus(authStatus, 'Sign-in failed', true);
  }
});

signOutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out failed:', error);
  }
});

addBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    setStatus(addStatus, 'Enter an email address', true);
    return;
  }

  try {
    addBtn.disabled = true;
    setStatus(addStatus, 'Adding to allowlist...');
    await createAllowlistEntry(email);
    setStatus(addStatus, `Added ${email} to allowlist`);
    emailInput.value = '';
    await loadAllowlist();
  } catch (error) {
    console.error('Add to allowlist failed:', error);
    const message = String(error?.message || '').trim();
    setStatus(addStatus, message ? `Failed to add email: ${message}` : 'Failed to add email', true);
  } finally {
    addBtn.disabled = false;
  }
});

seedBtn.addEventListener('click', async () => {
  const text = seedEmailsInput.value.trim();
  if (!text) {
    setStatus(seedStatus, 'Enter at least one email', true);
    return;
  }

  const emails = text.split('\n').map(e => e.trim()).filter(e => e.length > 0);
  if (emails.length === 0) {
    setStatus(seedStatus, 'No valid emails found', true);
    return;
  }

  try {
    seedBtn.disabled = true;
    setStatus(seedStatus, `Adding ${emails.length} email(s)...`);
    let successCount = 0;
    for (const email of emails) {
      try {
        await createAllowlistEntry(email);
        successCount++;
        setStatus(seedStatus, `Added ${successCount}/${emails.length}...`);
      } catch (itemError) {
        console.error(`Failed to add ${email}:`, itemError);
        setStatus(seedStatus, `Partially complete: added ${successCount}/${emails.length}. Last error: ${itemError.message}`, true);
        return;
      }
    }
    setStatus(seedStatus, `Successfully added ${successCount} admin email(s)`);
    seedEmailsInput.value = '';
    await loadAllowlist();
  } catch (error) {
    console.error('Seed failed:', error);
    setStatus(seedStatus, `Seed failed: ${error.message}`, true);
  } finally {
    seedBtn.disabled = false;
  }
});

async function loadAllowlist() {
  try {
    setStatus(listStatus, 'Loading allowlist...');
    const emails = await listAllowlist();

    allowlistContainer.innerHTML = '';
    if (emails.length === 0) {
      allowlistContainer.innerHTML = '<div class="admin-empty">No emails in allowlist yet</div>';
      setStatus(listStatus, 'Allowlist is empty');
      return;
    }

    emails.forEach(email => {
      const card = document.createElement('article');
      card.className = 'admin-card';

      const title = document.createElement('p');
      title.style.margin = '0 0 10px';
      title.style.fontWeight = '600';
      title.textContent = email;

      const actions = document.createElement('div');
      actions.className = 'admin-inline-actions';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'admin-btn admin-btn--danger';
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', async () => {
        if (confirm(`Remove ${email} from allowlist?`)) {
          try {
            removeBtn.disabled = true;
            await removeAllowlistEntry(email);
            await loadAllowlist();
          } catch (error) {
            console.error('Remove failed:', error);
            alert('Failed to remove email');
            removeBtn.disabled = false;
          }
        }
      });

      actions.appendChild(removeBtn);
      card.appendChild(title);
      card.appendChild(actions);
      allowlistContainer.appendChild(card);
    });

    setStatus(listStatus, `${emails.length} email(s) in allowlist`);
  } catch (error) {
    console.error('Load allowlist failed:', error);
    const message = String(error?.message || '').trim();
    setStatus(listStatus, message ? `Failed to load allowlist: ${message}` : 'Failed to load allowlist', true);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    signInBtn.style.display = 'inline-flex';
    signOutBtn.style.display = 'none';
    setStatus(authStatus, 'Not signed in');
    addBtn.disabled = true;
    seedBtn.disabled = true;
    allowlistContainer.innerHTML = '';
    setStatus(listStatus, 'Sign in to view allowlist');
    return;
  }

  currentUser = user;
  signInBtn.style.display = 'none';
  signOutBtn.style.display = 'inline-flex';
  setStatus(authStatus, `Signed in as ${user.email}`);
  addBtn.disabled = false;
  seedBtn.disabled = false;
  await loadAllowlist();
});
