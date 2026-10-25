// The desktop stores only grid positions; app destinations stay local and fixed.
const DESKTOP_APPS = [
  { id: 'settings', label: 'Settings', page: 'settings.html', icon: '<path fill="#c5d4df" stroke="#4b687b" stroke-width="2" d="M16 3h8l1 5 4 2 5-1 4 7-4 4v4l4 4-4 7-5-1-4 2-1 5h-8l-1-5-4-2-5 1-4-7 4-4v-4l-4-4 4-7 5 1 4-2z"/><circle cx="20" cy="22" r="8" fill="#4884bf" stroke="#f4fbff" stroke-width="2"/>' },
  { id: 'chatbot', label: 'Chatbot', page: 'chatbot.html', icon: '<path fill="#f5fbff" stroke="#397fae" stroke-width="2" d="M3 5h34v25H18L8 39v-9H3z"/><path stroke="#65a8cf" stroke-width="3" d="M10 13h20M10 19h16"/><circle cx="28" cy="31" r="10" fill="#73b74d" stroke="#fff"/><path stroke="#fff" stroke-width="2" d="M23 31h10m-5-5v10"/>' },
  { id: 'minigames', label: 'Minigames', page: 'minigames.html', icon: '<path fill="#e8eef5" stroke="#486a99" stroke-width="2" d="M11 11h18c7 0 11 20 8 24-4 4-10-6-12-6H15c-2 0-8 10-12 6-3-4 1-24 8-24z"/><path stroke="#3471b5" stroke-width="4" d="M12 17v12M6 23h12"/><circle cx="28" cy="19" r="3" fill="#e86758"/><circle cx="32" cy="26" r="3" fill="#67af58"/><path fill="none" stroke="#486a99" stroke-width="2" d="M20 11V3"/>' }
];
const GRID_COLUMNS = 4, GRID_ROWS = 5, DESKTOP_STORAGE_KEY = 'webopDesktop';
function normalizeLayout(saved) {
  const layout = {}, used = new Set();
  for (const app of DESKTOP_APPS) {
    let slot = saved?.[app.id];
    if (!Number.isInteger(slot) || slot < 0 || slot >= GRID_COLUMNS * GRID_ROWS || used.has(slot)) {
      slot = 0; while (used.has(slot)) slot++;
    }
    used.add(slot); layout[app.id] = slot;
  }
  return layout;
}
function moveDesktopIcon(layout, id, destination) {
  if (!(id in layout) || !Number.isInteger(destination) || destination < 0 || destination >= GRID_COLUMNS * GRID_ROWS) return layout;
  const next = { ...layout };
  const occupant = Object.keys(next).find(key => next[key] === destination);
  if (occupant) next[occupant] = next[id];
  next[id] = destination;
  return next;
}
document.addEventListener('DOMContentLoaded', async () => {
  const desktop = document.getElementById('desktop');
  const status = document.getElementById('desktop-status');
  const startButton = document.getElementById('start-button');
  const startMenu = document.getElementById('start-menu');
  const contextMenu = document.getElementById('context-menu');
  const cells = [], icons = new Map();
  let layout = normalizeLayout(), selected = null, dragging = null, contextApp = null, suppressOpenUntil = 0;
  let ready = false;
  const appById = id => DESKTOP_APPS.find(app => app.id === id);
  function saveLayout() {
    if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ [DESKTOP_STORAGE_KEY]: layout });
    else { try { localStorage.setItem(DESKTOP_STORAGE_KEY, JSON.stringify(layout)); } catch { status.textContent = 'Layout could not be saved'; } }
  }
  function select(id, focus = false) {
    selected = id;
    for (const [key, icon] of icons) {
      icon.classList.toggle('selected', key === id);
      icon.setAttribute('aria-pressed', String(key === id));
    }
    status.textContent = id ? appById(id).label + ' selected' : 'Desktop';
    if (focus && id) icons.get(id).focus();
  }
  function renderLayout() {
    for (const app of DESKTOP_APPS) cells[layout[app.id]].append(icons.get(app.id));
    cells.forEach((cell, index) => {
      const app = DESKTOP_APPS.find(app => layout[app.id] === index);
      cell.setAttribute('aria-label', `Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}${app ? ', ' + app.label : ', empty'}`);
      cell.tabIndex = app ? -1 : (index === 0 ? 0 : -1);
    });
  }
  function closeMenus(returnFocus = false) {
    const wasStart = !startMenu.hidden;
    startMenu.hidden = true; contextMenu.hidden = true;
    startButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) { if (wasStart) startButton.focus(); else if (selected) icons.get(selected).focus(); else cells[0].focus(); }
  }
  function openApp(id) {
    const app = appById(id);
    if (!app || dragging || performance.now() < suppressOpenUntil) return;
    closeMenus(); window.location.href = app.page;
  }
  function moveIcon(id, destination) {
    if (!ready) return;
    const origin = layout[id];
    layout = moveDesktopIcon(layout, id, destination);
    renderLayout(); select(id, true); saveLayout();
    status.textContent = origin === destination ? 'Icon position unchanged' : `${appById(id).label} moved to row ${Math.floor(destination / 4) + 1}, column ${destination % 4 + 1}`;
    window.Webop?.sound('tap');
  }
  function showContext(x, y, id) {
    closeMenus(); contextApp = id;
    select(id);
    document.getElementById('context-open').hidden = !id;
    contextMenu.hidden = false;
    contextMenu.style.left = Math.max(4, Math.min(x, 400 - contextMenu.offsetWidth - 4)) + 'px';
    contextMenu.style.top = Math.max(4, Math.min(y, 550 - contextMenu.offsetHeight - 42)) + 'px';
    [...contextMenu.querySelectorAll('button')].find(button => !button.hidden).focus();
  }
  for (let row = 0; row < GRID_ROWS; row++) {
    const rowElement = document.createElement('div'); rowElement.className = 'desktop-row'; rowElement.setAttribute('role', 'row');
    for (let column = 0; column < GRID_COLUMNS; column++) {
      const index = row * GRID_COLUMNS + column;
      const cell = document.createElement('div'); cell.className = 'desktop-cell'; cell.dataset.slot = index;
      cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-colindex', column + 1); cell.setAttribute('aria-rowindex', row + 1);
      cell.addEventListener('click', event => { if (!event.target.closest('.desktop-icon')) { closeMenus(); select(null); cell.focus(); } });
      cell.addEventListener('dragover', event => {
        if (!dragging) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        cells.forEach(item => item.classList.toggle('drop-target', item === cell));
      });
      cell.addEventListener('dragleave', event => { if (!cell.contains(event.relatedTarget)) cell.classList.remove('drop-target'); });
      cell.addEventListener('drop', event => {
        event.preventDefault(); if (!dragging) return;
        const id = dragging; dragging = null;
        icons.get(id).classList.remove('dragging'); cells.forEach(item => item.classList.remove('drop-target'));
        suppressOpenUntil = performance.now() + 350; moveIcon(id, index);
      });
      cell.addEventListener('keydown', event => {
        const directions = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
        if (event.key in directions) {
          event.preventDefault();
          if ((event.key === 'ArrowLeft' && index % 4 === 0) || (event.key === 'ArrowRight' && index % 4 === 3)) return;
          const target = index + directions[event.key];
          if (target < 0 || target >= 20) return;
          if (event.ctrlKey && selected) moveIcon(selected, target);
          else { const app = DESKTOP_APPS.find(app => layout[app.id] === target); select(app?.id || null); (app ? icons.get(app.id) : cells[target]).focus(); }
        } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault(); const rect = cell.getBoundingClientRect();
          showContext(rect.left + 20, rect.top + 20, event.target.closest('.desktop-icon')?.dataset.app || null);
        }
      });
      cells.push(cell); rowElement.append(cell);
    }
    desktop.append(rowElement);
  }
  for (const app of DESKTOP_APPS) {
    const button = document.createElement('button'); button.className = 'desktop-icon'; button.dataset.app = app.id;
    button.draggable = true; button.disabled = true; button.setAttribute('aria-label', app.label); button.setAttribute('aria-pressed', 'false');
    button.title = `${app.label}\nDouble-click or press Enter to open. Drag or Ctrl + arrow keys to move.`;
    // SVG markup is a fixed, local icon set, never loaded from saved data.
    button.innerHTML = `<svg viewBox="0 0 42 44" aria-hidden="true">${app.icon}</svg><span class="icon-label">${app.label}</span>`;
    button.addEventListener('click', () => { closeMenus(); select(app.id); window.Webop?.sound('click'); });
    button.addEventListener('dblclick', () => openApp(app.id));
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) { window.Webop?.sound('click'); openApp(app.id); } }
      if (event.key === ' ') { event.preventDefault(); select(app.id); }
    });
    button.addEventListener('focus', () => select(app.id));
    button.addEventListener('dragstart', event => {
      closeMenus(); select(app.id); dragging = app.id;
      event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', app.id);
      button.classList.add('dragging'); status.textContent = 'Drop on a grid space · occupied spaces swap';
    });
    button.addEventListener('dragend', () => {
      dragging = null; button.classList.remove('dragging'); cells.forEach(cell => cell.classList.remove('drop-target'));
      suppressOpenUntil = performance.now() + 350;
    });
    icons.set(app.id, button);
  }
  renderLayout();
  try {
    let saved;
    if (globalThis.chrome?.storage?.local) saved = await new Promise(resolve => chrome.storage.local.get(DESKTOP_STORAGE_KEY, data => resolve(data[DESKTOP_STORAGE_KEY])));
    else saved = JSON.parse(localStorage.getItem(DESKTOP_STORAGE_KEY));
    layout = normalizeLayout(saved); renderLayout();
  } catch { status.textContent = 'Using default layout'; }
  ready = true; icons.forEach(icon => icon.disabled = false);
  desktop.addEventListener('contextmenu', event => { event.preventDefault(); showContext(event.clientX, event.clientY, event.target.closest('.desktop-icon')?.dataset.app || null); });
  startButton.addEventListener('click', () => {
    const show = startMenu.hidden; closeMenus(); startMenu.hidden = !show; startButton.setAttribute('aria-expanded', String(show));
    if (show) startMenu.querySelector('button').focus();
  });
  document.getElementById('context-open').addEventListener('click', () => openApp(contextApp));
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openApp(button.dataset.open)));
  document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.command === 'arrange') { layout = normalizeLayout(); renderLayout(); saveLayout(); status.textContent = 'Icons arranged'; }
    else { renderLayout(); status.textContent = 'Desktop refreshed'; }
    closeMenus(true);
  }));
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.desktop-menu, #start-button')) closeMenus();
    if (!event.target.closest('.desktop-icon, .desktop-menu, .taskbar')) select(null);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { const menuOpen = !startMenu.hidden || !contextMenu.hidden; closeMenus(menuOpen); if (!menuOpen) select(null); }
    if (event.key === 'F5') { event.preventDefault(); renderLayout(); status.textContent = 'Desktop refreshed'; }
    const menu = !startMenu.hidden ? startMenu : !contextMenu.hidden ? contextMenu : null;
    if (menu && ['ArrowUp','ArrowDown','Home','End','Tab'].includes(event.key)) {
      const buttons = [...menu.querySelectorAll('button')].filter(button => !button.hidden);
      let index = buttons.indexOf(document.activeElement);
      if (event.key === 'Tab') { closeMenus(); return; }
      event.preventDefault(); index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[index].focus();
    }
  });
  function updateClock() {
    const now = new Date(), clock = document.getElementById('desktop-clock');
    clock.textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    clock.dateTime = now.toISOString(); clock.title = now.toLocaleDateString([], { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }
  updateClock(); setInterval(updateClock, 1000);
});
