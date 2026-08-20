const accordion = document.querySelector('[data-module="teams-accordion"]');

if (accordion) {
  const expandSection = (trigger, body) => {
    body.hidden = false;
    body.style.maxHeight = '0px';

    requestAnimationFrame(() => {
      trigger.setAttribute('aria-expanded', 'true');
      body.classList.add('is-open');
      body.style.maxHeight = `${body.scrollHeight}px`;
    });

    const handleExpandEnd = (event) => {
      if (event.target !== body || event.propertyName !== 'max-height') {
        return;
      }

      body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', handleExpandEnd);
    };

    body.addEventListener('transitionend', handleExpandEnd);
  };

  const collapseSection = (trigger, body) => {
    body.style.maxHeight = `${body.scrollHeight}px`;

    requestAnimationFrame(() => {
      trigger.setAttribute('aria-expanded', 'false');
      body.classList.remove('is-open');
      body.style.maxHeight = '0px';
    });

    const handleCollapseEnd = (event) => {
      if (event.target !== body || event.propertyName !== 'max-height') {
        return;
      }

      body.hidden = true;
      body.removeEventListener('transitionend', handleCollapseEnd);
    };

    body.addEventListener('transitionend', handleCollapseEnd);
  };

  accordion.querySelectorAll('.division-panel__trigger').forEach((trigger) => {
    const body = document.getElementById(trigger.getAttribute('aria-controls'));

    if (body) {
      body.style.maxHeight = '0px';
    }

    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';

      if (!body) {
        return;
      }

      if (expanded) {
        collapseSection(trigger, body);
      } else {
        expandSection(trigger, body);
      }
    });
  });
}
