import {
  DEFAULT_HOME_MEDIA_HUB,
  getHomeMediaHubContent,
  normalizeMediaHubConfig,
  saveHomeMediaHubContent
} from '/js/services/media-hub.service.js';
import { trackEvent } from '/js/services/analytics.service.js';
import { uploadMediaHubImage, validateMediaImageFile } from '/js/services/media-upload.service.js';

const mediaHubMessage = document.getElementById('media-hub-message');
const loadMediaHubButton = document.getElementById('load-media-hub-btn');
const applyStarterCopyButton = document.getElementById('apply-starter-copy-btn');
const resetMediaHubButton = document.getElementById('reset-media-hub-btn');
const saveMediaHubButton = document.getElementById('save-media-hub-btn');
const panelList = document.getElementById('media-hub-panel-list');
const editorForm = document.getElementById('media-hub-editor');
const previewEl = document.getElementById('media-hub-preview');
const actionsList = document.getElementById('media-actions-list');
const addLinkButton = document.getElementById('media-add-link-btn');
const uploadButton = document.getElementById('media-upload-btn');
const clearImageButton = document.getElementById('media-clear-image-btn');

const fields = {
  tabLabel: document.getElementById('media-tab-label'),
  badge: document.getElementById('media-badge'),
  title: document.getElementById('media-title'),
  description: document.getElementById('media-description'),
  bullets: document.getElementById('media-bullets'),
  imageUrl: document.getElementById('media-image-url'),
  imageAlt: document.getElementById('media-image-alt'),
  imageFile: document.getElementById('media-image-file'),
  videoUrl: document.getElementById('media-video-url')
};

const DRAFT_KEY = 'andromeda.mediaHubDraft.v2';
const LINK_PRESETS = [
  { label: 'Discord', href: 'https://discord.gg/yHfEKtBAbc' },
  { label: 'Twitch', href: 'https://twitch.tv/andromeda_esports_' },
  { label: 'YouTube', href: 'https://youtube.com/@andromedaesports-n5z1w' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@andromeda.esports7' },
  { label: 'About', href: 'pages/contact.html' },
  { label: 'Schedule', href: 'pages/schedule.html' },
  { label: 'Teams', href: 'pages/teams.html' }
];

let currentUserEmail = null;
let hasAdminAccess = false;
let activeSlideIndex = 0;
let currentConfig = normalizeMediaHubConfig(DEFAULT_HOME_MEDIA_HUB);
let lastLoadedConfig = normalizeMediaHubConfig(DEFAULT_HOME_MEDIA_HUB);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setMessage(text, isError = false) {
  if (!mediaHubMessage) return;
  mediaHubMessage.textContent = text;
  mediaHubMessage.style.color = isError ? 'var(--accent-primary-hover)' : 'var(--text-muted)';
}

function setUiEnabled(enabled) {
  [
    loadMediaHubButton,
    applyStarterCopyButton,
    resetMediaHubButton,
    saveMediaHubButton,
    addLinkButton,
    uploadButton,
    clearImageButton
  ].forEach((element) => {
    if (element) element.disabled = !enabled;
  });

  editorForm?.querySelectorAll('input, textarea, select, button').forEach((element) => {
    element.disabled = !enabled;
  });
}

function parseBullets(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function selectedSlide() {
  const slides = currentConfig.slides || [];
  return slides[activeSlideIndex] || slides[0] || normalizeMediaHubConfig(DEFAULT_HOME_MEDIA_HUB).slides[0];
}

function readActionsFromRows() {
  if (!actionsList) return [];
  return Array.from(actionsList.querySelectorAll('[data-action-row]'))
    .map((row) => ({
      label: row.querySelector('[data-action-label]')?.value?.trim() || '',
      href: row.querySelector('[data-action-href]')?.value?.trim() || '',
      primary: row.querySelector('[data-action-primary]')?.checked === true
    }))
    .filter((action) => action.label && action.href);
}

function updateSelectedSlideFromForm() {
  if (!currentConfig?.slides?.length) return;

  const slide = selectedSlide();
  slide.tabLabel = fields.tabLabel?.value?.trim() || '';
  slide.badge = fields.badge?.value?.trim() || '';
  slide.title = fields.title?.value?.trim() || '';
  slide.description = fields.description?.value?.trim() || '';
  slide.bullets = parseBullets(fields.bullets?.value || '');
  slide.icon = fields.imageUrl?.value?.trim() || slide.icon || '';
  slide.media = {
    type: 'image',
    url: fields.imageUrl?.value?.trim() || '',
    alt: fields.imageAlt?.value?.trim() || '',
    videoUrl: fields.videoUrl?.value?.trim() || ''
  };
  slide.actions = readActionsFromRows();
}

function persistDraft() {
  try {
    updateSelectedSlideFromForm();
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(currentConfig));
  } catch (_error) {
    // Local drafts are helpful, not required.
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch (_error) {
    // ignore localStorage errors
  }
}

function buildPresetSelect(row) {
  const preset = document.createElement('select');
  preset.className = 'admin-select admin-action-row__preset';

  const blankOption = document.createElement('option');
  blankOption.value = '';
  blankOption.textContent = 'Use preset link...';
  preset.appendChild(blankOption);

  LINK_PRESETS.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${entry.label} (${entry.href})`;
    preset.appendChild(option);
  });

  preset.addEventListener('change', () => {
    const chosen = LINK_PRESETS[Number(preset.value)];
    if (!chosen) return;

    const labelInput = row.querySelector('[data-action-label]');
    const hrefInput = row.querySelector('[data-action-href]');
    if (labelInput && !String(labelInput.value || '').trim()) labelInput.value = chosen.label;
    if (hrefInput) hrefInput.value = chosen.href;

    preset.value = '';
    persistDraft();
    renderPreview();
  });

  return preset;
}

function createActionRow(action = {}) {
  const row = document.createElement('div');
  row.className = 'admin-action-row';
  row.dataset.actionRow = '';

  const labelInput = document.createElement('input');
  labelInput.className = 'admin-input';
  labelInput.type = 'text';
  labelInput.placeholder = 'Button text';
  labelInput.dataset.actionLabel = '';
  labelInput.value = String(action?.label || '');

  const hrefInput = document.createElement('input');
  hrefInput.className = 'admin-input';
  hrefInput.type = 'text';
  hrefInput.placeholder = 'Link';
  hrefInput.dataset.actionHref = '';
  hrefInput.value = String(action?.href || '');

  const primaryLabel = document.createElement('label');
  primaryLabel.className = 'admin-action-row__primary';
  const primaryCheckbox = document.createElement('input');
  primaryCheckbox.type = 'checkbox';
  primaryCheckbox.dataset.actionPrimary = '';
  primaryCheckbox.checked = action?.primary === true;
  primaryLabel.appendChild(primaryCheckbox);
  primaryLabel.append(' Primary');

  const removeBtn = document.createElement('button');
  removeBtn.className = 'admin-btn admin-btn--secondary';
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => {
    row.remove();
    persistDraft();
    renderPreview();
  });

  row.appendChild(labelInput);
  row.appendChild(hrefInput);
  row.appendChild(buildPresetSelect(row));
  row.appendChild(primaryLabel);
  row.appendChild(removeBtn);
  return row;
}

function renderActionRows(actions = []) {
  if (!actionsList) return;
  actionsList.innerHTML = '';
  const nextActions = actions.length ? actions : [{ label: '', href: '', primary: false }];
  nextActions.forEach((action) => actionsList.appendChild(createActionRow(action)));
}

function renderPanelList() {
  if (!panelList) return;
  panelList.innerHTML = '';

  currentConfig.slides.forEach((slide, index) => {
    const button = document.createElement('button');
    button.className = `media-hub-panel-tab${index === activeSlideIndex ? ' is-active' : ''}`;
    button.type = 'button';
    button.innerHTML = `
      <span>Panel ${index + 1}</span>
      <strong>${escapeHtml(slide.tabLabel || slide.badge || `Panel ${index + 1}`)}</strong>
      <small>${escapeHtml(slide.title || 'Untitled story')}</small>
    `;
    button.addEventListener('click', () => {
      if (index === activeSlideIndex) return;
      updateSelectedSlideFromForm();
      activeSlideIndex = index;
      renderEditor();
      persistDraft();
    });
    panelList.appendChild(button);
  });
}

function renderPreview() {
  if (!previewEl) return;
  updateSelectedSlideFromForm();
  const slide = selectedSlide();
  const media = slide.media || {};
  const imageUrl = String(media.url || '').trim();
  const videoUrl = String(media.videoUrl || '').trim();
  const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
  const actions = Array.isArray(slide.actions) ? slide.actions : [];

  previewEl.innerHTML = `
    ${imageUrl ? `<figure class="media-hub-preview__media"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(media.alt || '')}"></figure>` : ''}
    <p class="media-hub-preview__badge">${escapeHtml(slide.badge || 'Badge')}</p>
    <h4>${escapeHtml(slide.title || 'Headline')}</h4>
    <p>${escapeHtml(slide.description || 'Description will appear here.')}</p>
    ${bullets.length ? `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No bullet points yet.</p>'}
    <div class="media-hub-preview__actions">
      ${actions.map((action) => `<span class="media-hub-preview__pill${action.primary ? ' is-primary' : ''}">${escapeHtml(action.label)}</span>`).join('')}
      ${videoUrl ? '<span class="media-hub-preview__pill">Watch media</span>' : ''}
    </div>
  `;
}

function renderEditor() {
  const slide = selectedSlide();
  const media = slide.media || {};

  if (fields.tabLabel) fields.tabLabel.value = slide.tabLabel || '';
  if (fields.badge) fields.badge.value = slide.badge || '';
  if (fields.title) fields.title.value = slide.title || '';
  if (fields.description) fields.description.value = slide.description || '';
  if (fields.bullets) fields.bullets.value = Array.isArray(slide.bullets) ? slide.bullets.join('\n') : '';
  if (fields.imageUrl) fields.imageUrl.value = media.url || slide.icon || '';
  if (fields.imageAlt) fields.imageAlt.value = media.alt || '';
  if (fields.videoUrl) fields.videoUrl.value = media.videoUrl || '';
  if (fields.imageFile) fields.imageFile.value = '';

  renderActionRows(Array.isArray(slide.actions) ? slide.actions : []);
  renderPanelList();
  renderPreview();
}

function tryLoadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    const normalized = normalizeMediaHubConfig(parsed);
    const shouldRestore = window.confirm('A local unsaved Media Hub draft was found. Restore it now?');
    if (!shouldRestore) return false;

    currentConfig = deepClone(normalized);
    activeSlideIndex = 0;
    renderEditor();
    setMessage('Restored local draft. Publish when ready.');
    return true;
  } catch (_error) {
    return false;
  }
}

async function loadMediaHubConfig() {
  if (!hasAdminAccess) {
    setMessage('Not authorized. Your role cannot load media hub drafts.', true);
    return;
  }

  try {
    setMessage('Loading live homepage content...');
    const content = await getHomeMediaHubContent();
    const normalized = normalizeMediaHubConfig(content);
    lastLoadedConfig = deepClone(normalized);
    currentConfig = deepClone(normalized);
    activeSlideIndex = 0;
    renderEditor();

    const restored = tryLoadDraft();
    if (!restored) setMessage('Loaded live content. Update a panel, then publish when ready.');
  } catch (error) {
    console.error('Load media hub config failed:', error);
    setMessage(`Failed to load: ${String(error?.message || error)}`, true);
  }
}

function applyStarterCopy() {
  currentConfig = normalizeMediaHubConfig(DEFAULT_HOME_MEDIA_HUB);
  activeSlideIndex = 0;
  renderEditor();
  persistDraft();
  setMessage('Applied starter copy. Review each panel, then publish.');
}

function resetUnsavedChanges() {
  currentConfig = deepClone(lastLoadedConfig);
  activeSlideIndex = 0;
  clearDraft();
  renderEditor();
  setMessage('Reset to the last loaded live version.');
}

async function uploadSelectedImage() {
  if (!hasAdminAccess) {
    setMessage('Not authorized. Your role cannot upload media assets.', true);
    return;
  }

  const file = fields.imageFile?.files?.[0];
  try {
    validateMediaImageFile(file);
  } catch (error) {
    setMessage(error?.message || 'Choose a valid image file.', true);
    return;
  }

  try {
    if (uploadButton) uploadButton.disabled = true;
    setMessage('Uploading image...');

    const { url: downloadUrl } = await uploadMediaHubImage(file, {
      panelIndex: activeSlideIndex,
      uploadedBy: currentUserEmail || ''
    });

    if (fields.imageUrl) fields.imageUrl.value = downloadUrl;
    if (fields.imageAlt && !fields.imageAlt.value.trim()) {
      fields.imageAlt.value = selectedSlide().title || 'Andromeda media feature image';
    }

    updateSelectedSlideFromForm();
    persistDraft();
    renderPreview();
    renderPanelList();
    setMessage('Image uploaded and attached to this panel. Publish when ready.');
  } catch (error) {
    console.error('Media Hub image upload failed:', error);
    setMessage(`Upload failed: ${String(error?.message || error)}`, true);
  } finally {
    if (uploadButton) uploadButton.disabled = !hasAdminAccess;
  }
}

async function saveMediaHubConfig() {
  if (!hasAdminAccess) {
    setMessage('Not authorized. Your role cannot publish media content.', true);
    return;
  }

  updateSelectedSlideFromForm();
  const config = normalizeMediaHubConfig(currentConfig);

  try {
    trackEvent('media_hub_save_started', {
      slide_count: config.slides.length
    });
    setMessage('Publishing homepage carousel...');

    await saveHomeMediaHubContent(config, currentUserEmail || null);

    trackEvent('media_hub_save_completed', {
      slide_count: config.slides.length
    });

    currentConfig = deepClone(config);
    lastLoadedConfig = deepClone(config);
    clearDraft();
    renderEditor();
    setMessage('Published successfully. Refresh homepage to review your updates.');
  } catch (error) {
    console.error('Save media hub config failed:', error);
    trackEvent('media_hub_save_failed', {
      error: String(error?.message || error)
    });
    setMessage(`Publish failed: ${String(error?.message || error)}`, true);
  }
}

editorForm?.addEventListener('input', () => {
  persistDraft();
  renderPreview();
  renderPanelList();
});

editorForm?.addEventListener('submit', (event) => {
  event.preventDefault();
});

editorForm?.addEventListener('change', () => {
  persistDraft();
  renderPreview();
  renderPanelList();
});

addLinkButton?.addEventListener('click', () => {
  updateSelectedSlideFromForm();
  selectedSlide().actions.push({ label: '', href: '', primary: false });
  renderActionRows(selectedSlide().actions);
  persistDraft();
});

clearImageButton?.addEventListener('click', () => {
  if (fields.imageUrl) fields.imageUrl.value = '';
  if (fields.imageAlt) fields.imageAlt.value = '';
  updateSelectedSlideFromForm();
  persistDraft();
  renderPreview();
  renderPanelList();
  setMessage('Cleared the feature image for this panel.');
});

loadMediaHubButton?.addEventListener('click', loadMediaHubConfig);
applyStarterCopyButton?.addEventListener('click', applyStarterCopy);
resetMediaHubButton?.addEventListener('click', resetUnsavedChanges);
saveMediaHubButton?.addEventListener('click', saveMediaHubConfig);
uploadButton?.addEventListener('click', uploadSelectedImage);

renderEditor();
setUiEnabled(false);

window.addEventListener('admin:authorized', async (event) => {
  const email = String(event?.detail?.email || '').trim().toLowerCase();
  const permissions = Array.isArray(event?.detail?.permissions) ? event.detail.permissions : [];
  hasAdminAccess = permissions.includes('mediaHub:write');
  currentUserEmail = email || null;
  setUiEnabled(hasAdminAccess);

  if (hasAdminAccess) {
    await loadMediaHubConfig();
  } else {
    setMessage('Your role cannot publish media hub changes.', true);
  }
});
