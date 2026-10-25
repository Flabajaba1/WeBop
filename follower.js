(function() {
  const frames = [
    chrome.runtime.getURL('frame1.png'),
    chrome.runtime.getURL('frame2.png'),
    chrome.runtime.getURL('frame3.png'),
    chrome.runtime.getURL('frame4.png'),
    chrome.runtime.getURL('frame5.png')
  ];

  let follower, settings = { followerEnabled: true, followerSize: 80, followerSpeed: 1, followerSitesMode: 'all', followerSites: [], reducedMotion: false };
  let posX = 0, posY = 0, animationFrame = 0;
  let mouseX = 0, mouseY = 0;
  let scaleX = 1;
  let currentFrame = 0;
  let frameCounter = 0;
  const frameDelay = 35;
  const reducedPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  function matchesSite() {
    const sites = Array.isArray(settings.followerSites) ? settings.followerSites : [];
    const matches = sites.some(site => location.hostname === site || location.hostname.endsWith('.' + site));
    if (settings.followerSitesMode === 'allowlist') return matches;
    if (settings.followerSitesMode === 'blocklist') return !matches;
    return true;
  }

  function shouldShow() {
    return settings.followerEnabled !== false && !settings.reducedMotion && !reducedPreference.matches && matchesSite();
  }

  function stop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    follower?.remove();
    follower = null;
  }

  function update() {
    if (!follower) return;
    const size = Math.max(40, Math.min(120, Number(settings.followerSize) || 80));
    const dX = mouseX - size / 2 - posX, dY = mouseY - size / 2 - posY;
    if (dX > 1) scaleX = 1;
    else if (dX < -1) scaleX = -1;
    posX += dX * 0.001 * Math.max(0.5, Math.min(5, Number(settings.followerSpeed) || 1));
    posY += dY * 0.001 * Math.max(0.5, Math.min(5, Number(settings.followerSpeed) || 1));
    follower.style.transform = `translate3d(${posX}px, ${posY}px, 0) scaleX(${scaleX})`;
    frameCounter++;
    if (frameCounter >= frameDelay) {
      frameCounter = 0;
      currentFrame = (currentFrame + 1) % frames.length;
      follower.style.backgroundImage = `url("${frames[currentFrame]}")`;
    }
    animationFrame = requestAnimationFrame(update);
  }

  function start() {
    if (!document.body || !shouldShow()) { stop(); return; }
    if (!follower) {
      follower = document.createElement('div');
      follower.id = 'follower';
      Object.assign(follower.style, {
        position: 'fixed', top: '0px', left: '0px',
        backgroundColor: 'transparent', backgroundImage: `url("${frames[0]}")`,
        backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
        pointerEvents: 'none', zIndex: '2147483647'
      });
      document.body.appendChild(follower);
    }
    const size = Math.max(40, Math.min(120, Number(settings.followerSize) || 80));
    follower.style.width = `${size}px`;
    follower.style.height = `${size}px`;
    if (!animationFrame) animationFrame = requestAnimationFrame(update);
  }

  window.addEventListener('mousemove', event => { mouseX = event.clientX; mouseY = event.clientY; }, { passive: true });
  reducedPreference.addEventListener('change', start);
  document.addEventListener('DOMContentLoaded', start);
  chrome.storage.local.get('webopSettings', result => {
    settings = { ...settings, ...(result.webopSettings || {}) };
    start();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.webopSettings) {
      settings = { ...settings, ...(changes.webopSettings.newValue || {}) };
      start();
    }
  });

})();
