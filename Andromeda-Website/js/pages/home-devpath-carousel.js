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

  setIndex(0);
  startAutoRotate();
}
