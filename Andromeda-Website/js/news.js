document.addEventListener('DOMContentLoaded', function () {
  const modules = document.querySelectorAll('[data-module="news-tabs"]');
  modules.forEach(root => {
    const tabs = root.querySelectorAll('.news-tabs-nav .tab');
    const panels = root.querySelectorAll('.news-tabs-panels .panel');

    function activate(targetId) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.target === targetId));
      panels.forEach(p => p.classList.toggle('active', p.id === targetId));
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => activate(tab.dataset.target));
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(tab.dataset.target);
        }
      });
    });
  });
});
