const routes = ['timer', 'presets', 'stopwatch', 'settings'];

export function startRouter() {
  const panels = [...document.querySelectorAll('[data-panel]')];
  const links = [...document.querySelectorAll('nav a')];
  function render() {
    const requested = location.hash.slice(1);
    const route = routes.includes(requested) ? requested : 'timer';
    if (requested !== route) {
      location.replace(`#${route}`);
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== route;
    for (const link of links) {
      if (link.hash === `#${route}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.title = `${links.find(link => link.hash === `#${route}`).textContent} · 백만킬로 서킷 타이머`;
  }
  window.addEventListener('hashchange', render);
  render();
}
startRouter();
