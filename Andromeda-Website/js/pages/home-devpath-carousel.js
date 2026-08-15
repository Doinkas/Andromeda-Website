import { getHomeMediaHubContent } from '/js/services/media-hub.service.js';

const root = document.querySelector('[data-module="devpath-carousel"]');

if (!root) {
  // no-op when not on homepage
} else {
  const track = root.querySelector('[data-dev-carousel-track]');
  const slides = Array.from(track?.children || []);
  const prevButton = root.querySelector('[data-dev-carousel-prev]');
  const nextButton = root.querySelector('[data-dev-carousel-next]');
  const dots = Array.from(root.querySelectorAll('[data-dev-carousel-dot]'));
  const viewport = root.querySelector('.dev-carousel__viewport');
  const mediaIcons = Array.from(root.querySelectorAll('[data-media-icon]'));
  const mediaSlides = Array.from(root.querySelectorAll('[data-media-slide]'));
  const mediaTabs = Array.from(root.querySelectorAll('[data-media-tab]'));

  let activeIndex = 0;
  let timer = null;
  let paused = false;
  let touchStartX = null;

  function setIndex(nextIndex) {
    if (!slides.length) return;
    const max = slides.length - 1;
    activeIndex = Math.max(0, Math.min(nextIndex, max));

    track.style.transform = `translateX(-${activeIndex * 100}%)`;

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    dots.forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
      dot.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  function setSafeLinkAttributes(link, href) {
    const isExternal = /^https?:\/\//i.test(href);
    if (isExternal) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
      return;
    }

    link.removeAttribute('target');
    link.removeAttribute('rel');
  }

  function applyMediaHubContent(content) {
    const slidesData = Array.isArray(content?.slides) ? content.slides : [];

    mediaSlides.forEach((slideEl, index) => {
      const slide = slidesData[index];
      if (!slide) return;

      const badgeEl = slideEl.querySelector('[data-media-badge]');
      const titleEl = slideEl.querySelector('[data-media-title]');
      const descriptionEl = slideEl.querySelector('[data-media-description]');
      const bulletsEl = slideEl.querySelector('[data-media-bullets]');
      const actionsEl = slideEl.querySelector('[data-media-actions]');

      if (badgeEl) badgeEl.textContent = String(slide.badge || '').trim() || badgeEl.textContent;
      if (titleEl) titleEl.textContent = String(slide.title || '').trim() || titleEl.textContent;
      if (descriptionEl) descriptionEl.textContent = String(slide.description || '').trim() || descriptionEl.textContent;

      if (bulletsEl && Array.isArray(slide.bullets)) {
        bulletsEl.innerHTML = '';
        const bullets = slide.bullets
          .map((item) => String(item || '').trim())
          .filter(Boolean);

        if (bulletsEl.tagName.toLowerCase() === 'ul') {
          bullets.forEach((text) => {
            const li = document.createElement('li');
            li.textContent = text;
            bulletsEl.appendChild(li);
          });
        } else {
          bulletsEl.textContent = bullets
            .map((text) => /[.!?]$/.test(text) ? text : `${text}.`)
            .join(' ');
        }
      }

      if (actionsEl && Array.isArray(slide.actions)) {
        const videoUrl = String(slide.media?.videoUrl || '').trim();
        const actions = [...slide.actions];
        if (videoUrl && !actions.some((action) => String(action?.href || '').trim() === videoUrl)) {
          actions.push({ label: 'Watch media', href: videoUrl, primary: false });
        }

        actionsEl.innerHTML = '';
        actions.forEach((action) => {
          const label = String(action?.label || '').trim();
          const href = String(action?.href || '').trim();
          if (!label || !href) return;

          const link = document.createElement('a');
          link.className = action?.primary === true ? 'btn primary' : 'btn';
          link.textContent = label;
          link.href = href;
          setSafeLinkAttributes(link, href);
          actionsEl.appendChild(link);
        });
      }
    });

    mediaTabs.forEach((tabEl, index) => {
      const slide = slidesData[index];
      if (!slide) return;

      const label = String(slide.tabLabel || '').trim();
      if (!label) return;
      tabEl.textContent = label;
      tabEl.setAttribute('aria-label', `Show ${label.toLowerCase()}`);
    });

    mediaIcons.forEach((asideEl, index) => {
      const slide = slidesData[index];
      if (!slide) return;
      const mediaUrl = String(slide.media?.url || '').trim();
      const mediaAlt = String(slide.media?.alt || '').trim();
      const icon = mediaUrl || String(slide.icon || '').trim();
      if (!icon) return;

      const isUrl = /^(https?:\/\/|\/)/.test(icon) || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(icon);
      asideEl.innerHTML = '';
      if (isUrl) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = mediaAlt;
        asideEl.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'dev-slide__icon-emoji';
        span.textContent = icon;
        asideEl.appendChild(span);
      }
    });
  }

  function next() {
    const nextIndex = (activeIndex + 1) % slides.length;
    setIndex(nextIndex);
  }

  function prev() {
    const prevIndex = (activeIndex - 1 + slides.length) % slides.length;
    setIndex(prevIndex);
  }

  function stopAutoRotate() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function startAutoRotate() {
    stopAutoRotate();
    if (paused || slides.length <= 1) return;

    timer = window.setInterval(() => {
      next();
    }, 7000);
  }

  function setPaused(value) {
    paused = value;
    if (paused) {
      stopAutoRotate();
    } else {
      startAutoRotate();
    }
  }

  prevButton?.addEventListener('click', () => {
    prev();
    startAutoRotate();
  });

  nextButton?.addEventListener('click', () => {
    next();
    startAutoRotate();
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const nextIndex = Number(dot.dataset.devCarouselDot);
      if (Number.isFinite(nextIndex)) {
        setIndex(nextIndex);
        startAutoRotate();
      }
    });
  });

  root.addEventListener('mouseenter', () => setPaused(true));
  root.addEventListener('mouseleave', () => setPaused(false));
  root.addEventListener('focusin', () => setPaused(true));
  root.addEventListener('focusout', () => setPaused(false));

  viewport?.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches?.[0]?.clientX ?? null;
  }, { passive: true });

  viewport?.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;

    const touchEndX = event.changedTouches?.[0]?.clientX ?? touchStartX;
    const delta = touchEndX - touchStartX;
    touchStartX = null;

    if (Math.abs(delta) < 36) return;

    if (delta < 0) {
      next();
    } else {
      prev();
    }

    startAutoRotate();
  }, { passive: true });

  viewport?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
      startAutoRotate();
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
      startAutoRotate();
    }
  });

  async function init() {
    setIndex(0);
    startAutoRotate();

    try {
      const mediaHubContent = await getHomeMediaHubContent();
      applyMediaHubContent(mediaHubContent);
      setIndex(activeIndex);
    } catch (error) {
      console.warn('Failed to load media hub content, using fallback markup:', error);
    }
  }

  void init();
}
