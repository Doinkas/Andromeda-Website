import { trackEvent } from '/js/services/analytics.service.js';

const heroCtas = Array.from(document.querySelectorAll('#hero .hero-ctas a'));

heroCtas.forEach((link, index) => {
  link.addEventListener('click', () => {
    trackEvent('homepage_cta_click', {
      cta_label: String(link.textContent || '').trim() || `cta_${index + 1}`,
      cta_href: String(link.getAttribute('href') || '').trim(),
      cta_position: index + 1,
      section: 'hero'
    });
  });
});
