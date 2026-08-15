(() => {
  const root = document.documentElement;

  if (window.__andromedaMotionFallback) {
    window.clearTimeout(window.__andromedaMotionFallback);
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsIntersectionObserver = 'IntersectionObserver' in window;

  const revealSelectors = [
    'main > section:not(#hero)',
    'main > h1',
    'main > .lead',
    'main > .league-badge',
    '.teams-accordion',
    '#team-error',
    '.team-hero',
    '.team-desc-wrap',
    '.card',
    '.panel',
    '.news-item',
    '.activity-column',
    '.division-panel',
    '.division-team-card',
    '.contact-card',
    '.product-card',
    '.schedule-calendar-shell',
    '.schedule-agenda',
    '.tournament-card',
    '.tournament-total-item',
    '.team-nav',
    '.team-section'
  ];

  const staggerGroups = [
    ['.tournament-totals', '.tournament-total-item'],
    ['.activity-strip', '.activity-column'],
    ['.contact-grid', '.contact-card'],
    ['.merch-grid', '.product-card'],
    ['.division-team-grid', '.division-team-card'],
    ['.tournaments-grid', '.tournament-card'],
    ['#news-list', '.news-item']
  ];

  const matchesRevealTarget = (element) => revealSelectors.some((selector) => element.matches(selector));

  const observer = !prefersReducedMotion && supportsIntersectionObserver
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -6% 0px'
      })
    : null;

  function initPageHeaders() {
    const headers = Array.from(document.querySelectorAll('.page-header-animate'));

    headers.forEach((header) => {
      const items = Array.from(header.querySelectorAll('.page-header-item'));

      items.forEach((item, index) => {
        item.style.setProperty('--page-header-delay', `${index * 50}ms`);
      });

      if (prefersReducedMotion) {
        header.classList.add('page-header-visible');
      }
    });

    if (prefersReducedMotion || headers.length === 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        headers.forEach((header, index) => {
          window.setTimeout(() => {
            header.classList.add('page-header-visible');
          }, index * 24);
        });
      }, 50);
    });
  }

  function initActiveHeaderNav() {
    const nav = document.querySelector('header nav');
    if (!(nav instanceof HTMLElement)) {
      return;
    }

    const links = Array.from(nav.querySelectorAll('a[href]'));
    if (links.length === 0) {
      return;
    }

    const path = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
    const leaf = path.split('/').pop() || 'index.html';

    let target = leaf;
    if (leaf === '' || leaf === 'index.html') target = 'index.html';
    if (leaf === 'team.html') target = 'teams.html';

    const activeLink = links.find((link) => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      return href === target || href === `pages/${target}` || href === `../${target}`;
    });

    if (!activeLink) {
      return;
    }

    links.forEach((link) => {
      if (link !== activeLink) {
        link.removeAttribute('aria-current');
      }
    });

    activeLink.setAttribute('aria-current', 'page');
  }

  function markVisible(element) {
    element.classList.add('reveal', 'reveal-up', 'is-visible');
  }

  function registerReveal(element, delay = 0) {
    if (!(element instanceof HTMLElement) || element.dataset.revealBound === 'true') {
      return;
    }

    if (element.classList.contains('page-header-animate')) {
      return;
    }

    if (element.matches('section, div') && element.querySelector('.page-header-animate')) {
      return;
    }

    if (!prefersReducedMotion && element.getClientRects().length === 0) {
      return;
    }

    element.dataset.revealBound = 'true';
    element.classList.add('reveal', 'reveal-up');

    if (delay > 0) {
      element.style.setProperty('--reveal-delay', `${delay}ms`);
    }

    if (prefersReducedMotion || !supportsIntersectionObserver) {
      markVisible(element);
      return;
    }

    const rect = element.getBoundingClientRect();
    const threshold = window.innerHeight * 0.88;

    if (rect.top <= threshold) {
      markVisible(element);
      return;
    }

    observer.observe(element);
  }

  function registerGroupChildren(group, childSelector) {
    let staggerIndex = 0;

    Array.from(group.children).forEach((child) => {
      if (!(child instanceof HTMLElement) || !child.matches(childSelector)) {
        return;
      }

      registerReveal(child, Math.min(staggerIndex * 50, 220));
      staggerIndex += 1;
    });
  }

  function scan(rootNode = document) {
    revealSelectors.forEach((selector) => {
      rootNode.querySelectorAll(selector).forEach((element) => registerReveal(element));
    });

    staggerGroups.forEach(([groupSelector, childSelector]) => {
      rootNode.querySelectorAll(groupSelector).forEach((group) => {
        if (!(group instanceof HTMLElement)) {
          return;
        }

        group.classList.add('stagger-group');
        registerGroupChildren(group, childSelector);
      });
    });
  }

  initPageHeaders();
  initActiveHeaderNav();
  scan(document);

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
        if (matchesRevealTarget(mutation.target)) {
          registerReveal(mutation.target);
        }

        scan(mutation.target);
        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        if (matchesRevealTarget(node)) {
          registerReveal(node);
        }

        scan(node);
      });
    });
  });

  if (document.body) {
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });
  }

  root.classList.add('motion-ready');
})();
