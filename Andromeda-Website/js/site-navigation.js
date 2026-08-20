const navs = Array.from(document.querySelectorAll('[data-site-nav]'));

navs.forEach((nav, index) => {
  const toggle = nav.querySelector('[data-site-nav-toggle]');
  const menu = nav.querySelector('[data-site-nav-menu]');

  if (!(toggle instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;

  if (!menu.id) {
    menu.id = `site-nav-menu-${index + 1}`;
    toggle.setAttribute('aria-controls', menu.id);
  }

  const desktopQuery = window.matchMedia('(min-width: 841px)');

  function setOpen(isOpen) {
    nav.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (link && !desktopQuery.matches) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });

  desktopQuery.addEventListener('change', (event) => {
    if (event.matches) {
      setOpen(false);
    }
  });
});
