(() => {
  const defaults = { theme: 'xp', masterVolume: 50 };
  let settings = { ...defaults }, context, lastSound = 0;
  const storage = globalThis.chrome?.storage;
  function apply(value) {
    settings = { ...defaults, ...value };
    const theme = ['xp', 'vista', 'frutiger-aero'].includes(settings.theme) ? settings.theme : 'xp';
    document.body.classList.remove('theme-xp', 'theme-vista', 'theme-frutiger-aero');
    document.body.classList.add('theme-' + theme);
    document.body.classList.toggle('reduced-motion', settings.reducedMotion === true);
  }
  function ensureAudio() {
    context ||= new AudioContext();
    context.resume().catch(() => {});
    return context;
  }
  function tone(frequency, duration, volume, options = {}) {
    const audio = ensureAudio();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    const start = audio.currentTime + (options.delay || 0);
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, options.endFrequency || frequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(start); oscillator.stop(start + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function noise(duration, volume, frequency = 1800, delay = 0) {
    const audio = ensureAudio();
    const frames = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
    const start = audio.currentTime + delay;
    filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 0.8;
    gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(audio.destination);
    source.start(start); source.stop(start + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  function sound(kind = 'click') {
    const volume = Math.max(0, Math.min(100, Number(settings.masterVolume))) / 100;
    const cooldown = kind === 'race' || kind === 'reel' ? 60 : 28;
    if (!volume || document.hidden || performance.now() - lastSound < cooldown) return;
    lastSound = performance.now();
    try {
      const theme = document.body.classList;
      const bright = theme.contains('theme-frutiger-aero') ? 1.15 : theme.contains('theme-vista') ? 1.05 : 1;
      const level = volume * 0.12;
      if (kind === 'click' || kind === 'tap') {
        noise(0.022, level, 1900 * bright);
        tone(1050 * bright, 0.028, level * 0.65, { type: 'square', endFrequency: 560 * bright });
      } else if (kind === 'cookie') {
        noise(0.028, level * 0.65, 900);
        tone(210, 0.055, level * 0.7, { type: 'triangle', endFrequency: 135 });
      } else if (kind === 'buy') {
        tone(520 * bright, 0.07, level, { type: 'triangle', endFrequency: 620 * bright });
        tone(780 * bright, 0.09, level * 0.8, { delay: 0.065, endFrequency: 900 * bright });
      } else if (kind === 'race') {
        noise(0.045, level * 0.75, 520);
        tone(145, 0.05, level * 0.6, { type: 'triangle', endFrequency: 105 });
      } else if (kind === 'reel') {
        noise(0.018, level * 0.7, 2400);
        tone(1250 * bright, 0.022, level * 0.4, { type: 'square', endFrequency: 920 * bright });
      } else if (kind === 'win') {
        [523, 659, 784].forEach((note, i) => tone(note * bright, 0.15, level, { delay: i * 0.09, endFrequency: note * bright * 1.02 }));
      } else if (kind === 'lose') {
        tone(310, 0.12, level * 0.8, { type: 'triangle', endFrequency: 220 });
        tone(220, 0.16, level * 0.7, { delay: 0.1, type: 'triangle', endFrequency: 165 });
      } else if (kind === 'error') {
        tone(180, 0.09, level, { type: 'square', endFrequency: 140 });
        tone(150, 0.11, level * 0.8, { delay: 0.08, type: 'square', endFrequency: 115 });
      }
    } catch { /* Sound is optional when audio is unavailable. */ }
  }
  window.Webop = { sound, preview: value => { settings = { ...settings, ...value }; } };
  document.addEventListener('DOMContentLoaded', () => {
    apply(defaults);
    if (storage?.local) storage.local.get('webopSettings', result => apply(result.webopSettings));
    else { try { apply(JSON.parse(localStorage.getItem('webopSettings'))); } catch { apply(defaults); } }
    document.addEventListener('click', e => {
      if (e.target.closest('button:not(:disabled)') && !e.target.closest('#cookie-btn, .upgrade-btn, .desktop-icon')) sound('click');
    });
    document.getElementById('master-volume')?.addEventListener('input', e => window.Webop.preview({ masterVolume: Number(e.target.value) }));
    document.getElementById('master-volume')?.addEventListener('change', () => sound('buy'));
    document.getElementById('preview-sound')?.addEventListener('click', () => sound('win'));
  });
  storage?.onChanged?.addListener((changes, area) => { if (area === 'local' && changes.webopSettings) apply(changes.webopSettings.newValue); });
})();
