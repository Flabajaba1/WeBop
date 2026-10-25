const UPGRADES = [
  { id: 'click', name: 'Better click', effect: '+1 / click', cost: 10, growth: 1.5, power: 1 },
  { id: 'auto', name: 'Auto clicker', effect: '+1 / sec', cost: 50, growth: 1.6, power: 1 },
  { id: 'grandma', name: 'Grandma', effect: '+5 / sec', cost: 200, growth: 1.7, power: 5 },
  { id: 'bakery', name: 'Bakery', effect: '+25 / sec', cost: 1200, growth: 1.3, power: 25 },
  { id: 'factory', name: 'Cookie factory', effect: '+150 / sec', cost: 10000, growth: 1.25, power: 150 },
  { id: 'portal', name: 'Cookie portal', effect: '+1,000 / sec', cost: 100000, growth: 1.2, power: 1000 }
];
const LIMIT = Number.MAX_SAFE_INTEGER;
const DEFAULT_STATE = { coins: 100, cookieCount: 0, perClick: 1, perSecond: 0, owned: {}, costs: {}, stats: {}, achievements: [], lastTick: Date.now() };
const ACHIEVEMENTS = [
  { id: 'first-cookie', title: 'Freshly Baked', description: 'Bake 100 cookies by hand.', earned: stats => stats.clicks >= 100 },
  { id: 'hundred-cookies', title: 'Cookie Jar', description: 'Bake or earn 10,000 cookies.', earned: (stats, game) => game.cookieCount >= 10000 },
  { id: 'first-upgrade', title: 'A Little Help', description: 'Own 25 upgrades.', earned: (stats, game) => Object.values(game.owned).reduce((total, count) => total + count, 0) >= 25 },
  { id: 'race-entry', title: 'Off to the Races', description: 'Enter 10 horse races.', earned: stats => stats.races >= 10 },
  { id: 'race-win', title: 'Winner’s Circle', description: 'Back the winning horse 5 times.', earned: stats => stats.raceWins >= 5 },
  { id: 'first-spin', title: 'Lucky Spin', description: 'Spin the slots 25 times.', earned: stats => stats.spins >= 25 },
  { id: 'slot-win', title: 'Jackpot!', description: 'Win 5 slots payouts.', earned: stats => stats.slotWins >= 5 },
  { id: 'wealthy', title: 'Cookie Tycoon', description: 'Reach 100,000 coins.', earned: (stats, game) => game.coins >= 100000 }
];
const DEFAULT_STATS = { clicks: 0, upgrades: 0, races: 0, raceWins: 0, spins: 0, slotWins: 0 };
let state, saveTimer, raceRunning = false, slotsRunning = false;
const $ = id => document.getElementById(id);
const format = number => new Intl.NumberFormat('en', { notation: number >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(number);
const safeNumber = (value, fallback = 0) => Number.isFinite(value) && value >= 0 ? Math.min(LIMIT, Math.floor(value)) : fallback;
function normalizeState(saved = {}) {
  if (!saved || typeof saved !== 'object') saved = {};
  const next = { ...DEFAULT_STATE, ...saved, owned: {}, costs: {} };
  for (const key of ['coins', 'cookieCount', 'perSecond']) next[key] = safeNumber(next[key], DEFAULT_STATE[key]);
  next.perClick = Math.max(1, safeNumber(next.perClick, 1));
  UPGRADES.forEach(upgrade => {
    const legacy = upgrade.id[0].toUpperCase() + upgrade.id.slice(1);
    next.owned[upgrade.id] = safeNumber(saved.owned?.[upgrade.id] ?? saved[upgrade.id + 'Owned'] ?? (upgrade.id === 'click' ? next.perClick - 1 : 0));
    next.costs[upgrade.id] = Math.max(1, safeNumber(saved.costs?.[upgrade.id] ?? saved['cost' + legacy], upgrade.cost));
  });
  next.stats = Object.fromEntries(Object.keys(DEFAULT_STATS).map(key => [key, safeNumber(saved.stats?.[key])]));
  next.achievements = Array.isArray(saved.achievements) ? saved.achievements.filter(id => ACHIEVEMENTS.some(item => item.id === id)) : [];
  next.lastTick = safeNumber(saved.lastTick, Date.now());
  return next;
}
function quotePurchase(upgrade, quantity, current = state) {
  let cost = current.costs[upgrade.id], total = 0, count = 0;
  const target = quantity === 'max' ? 10000 : Number(quantity);
  while (count < target && Number.isSafeInteger(cost) && total + cost <= current.coins && total + cost <= LIMIT) {
    total += cost; count++; cost = Math.min(LIMIT, Math.floor(cost * upgrade.growth));
    if (cost === LIMIT) break;
  }
  return { count, total, nextCost: cost };
}
function persist(immediate = false) {
  clearTimeout(saveTimer);
  const write = () => {
    if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ webopMinigames: state });
    else localStorage.setItem('webopMinigames', JSON.stringify(state));
  };
  if (immediate) write(); else saveTimer = setTimeout(write, 200);
}
function accrue() {
  const now = Date.now();
  const elapsed = Math.max(0, Math.min(8 * 60 * 60, Math.floor((now - state.lastTick) / 1000)));
  if (elapsed) {
    const earned = Math.min(LIMIT, elapsed * state.perSecond);
    state.coins = Math.min(LIMIT, state.coins + earned);
    state.cookieCount = Math.min(LIMIT, state.cookieCount + earned);
    state.lastTick = now - ((now - state.lastTick) % 1000);
    return earned;
  }
  if (state.lastTick > now) state.lastTick = now;
  return 0;
}
function notice(message, kind) { $('game-notice').textContent = message; if (kind) window.Webop?.sound(kind); }
function checkAchievements() {
  const unlocked = new Set(state.achievements);
  const newAchievements = ACHIEVEMENTS.filter(item => !unlocked.has(item.id) && item.earned(state.stats, state));
  newAchievements.forEach(item => state.achievements.push(item.id));
  if (newAchievements.length) notice(`Achievement unlocked: ${newAchievements.map(item => item.title).join(', ')}!`, 'win');
}
function render() {
  for (const id of ['coins-display', 'horse-balance', 'slots-balance']) $(id).textContent = format(state.coins);
  $('networth-display').textContent = format(Math.min(LIMIT, state.coins + state.cookieCount * 0.1));
  for (const [id, key] of [['cookie-count','cookieCount'], ['per-click','perClick'], ['per-second','perSecond']]) $(id).textContent = format(state[key]);
  UPGRADES.forEach(upgrade => {
    const quote = quotePurchase(upgrade, $('buy-amount').value);
    const button = $('upgrade-' + upgrade.id);
    button.disabled = quote.count === 0;
    button.querySelector('.upgrade-name').textContent = `${upgrade.name} · ${upgrade.effect}`;
    button.querySelector('.upgrade-cost').textContent = `${format(state.owned[upgrade.id])} owned · ${quote.count ? 'Buy ' + quote.count + ' for ' + format(quote.total) : 'Next: ' + format(state.costs[upgrade.id])} coins`;
  });
  $('achievement-count').textContent = `${state.achievements.length}/${ACHIEVEMENTS.length}`;
  $('achievement-list').replaceChildren(...ACHIEVEMENTS.map(achievement => {
    const item = document.createElement('div');
    const complete = state.achievements.includes(achievement.id);
    item.className = `achievement-item${complete ? ' earned' : ''}`;
    item.innerHTML = `<span class="achievement-mark" aria-hidden="true">${complete ? '★' : '☆'}</span><span><strong>${achievement.title}</strong><small>${achievement.description}</small></span>`;
    return item;
  }));
}
function commit() { checkAchievements(); render(); persist(); }
function switchGame(game) {
  document.querySelectorAll('.game-tab').forEach(tab => { const active = tab.dataset.game === game; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', active); });
  document.querySelectorAll('.game-screen').forEach(screen => screen.classList.toggle('active', screen.id === 'game-' + game));
  $('btn-back-menu').disabled = game === 'menu';
}
async function loadState() {
  let saved;
  try {
    if (globalThis.chrome?.storage?.local) saved = await new Promise(resolve => chrome.storage.local.get('webopMinigames', result => resolve(result.webopMinigames)));
    else saved = JSON.parse(localStorage.getItem('webopMinigames'));
  } catch { saved = {}; }
  state = normalizeState(saved);
  const earned = accrue();
  if (earned) notice(`Welcome back! Your bakers earned ${format(earned)} coins (up to 8 hours away).`);
  commit();
}
function integerBet(input) {
  const number = Number(input.value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
document.addEventListener('DOMContentLoaded', async () => {
  UPGRADES.forEach(upgrade => {
    const button = document.createElement('button');
    button.id = 'upgrade-' + upgrade.id; button.className = 'upgrade-btn'; button.disabled = true;
    const name = document.createElement('div'), cost = document.createElement('div');
    name.className = 'upgrade-name'; cost.className = 'upgrade-cost'; button.append(name, cost);
    button.addEventListener('click', () => {
      accrue();
      const quote = quotePurchase(upgrade, $('buy-amount').value);
      if (!quote.count) return;
      state.coins -= quote.total; state.costs[upgrade.id] = quote.nextCost; state.owned[upgrade.id] += quote.count;
      state.stats.upgrades += quote.count;
      const key = upgrade.id === 'click' ? 'perClick' : 'perSecond';
      state[key] = Math.min(LIMIT, state[key] + quote.count * upgrade.power);
      notice(`Bought ${quote.count} ${upgrade.name.toLowerCase()}${quote.count > 1 ? ' upgrades' : ''}.`, 'buy'); commit();
    });
    $('upgrade-list').append(button);
  });
  // Keep controls unavailable until Chrome storage has loaded.
  const controls = [...document.querySelectorAll('button, input, select')];
  controls.forEach(control => control.disabled = true);
  await loadState();
  controls.filter(control => !control.classList.contains('upgrade-btn')).forEach(control => control.disabled = false);
  render(); switchGame('menu');
  document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => switchGame(button.dataset.game)));
  $('btn-back-menu').addEventListener('click', () => switchGame('menu'));
  $('btn-back-popup').addEventListener('click', () => { persist(true); location.href = 'popup.html'; });
  $('buy-amount').addEventListener('change', render);
  $('cookie-btn').addEventListener('click', () => {
    accrue(); state.coins = Math.min(LIMIT, state.coins + state.perClick); state.cookieCount = Math.min(LIMIT, state.cookieCount + state.perClick);
    state.stats.clicks++;
    window.Webop?.sound('cookie'); commit();
  });
  setInterval(() => { if (accrue()) commit(); else persist(); }, 1000);
  window.addEventListener('pagehide', () => { accrue(); persist(true); });
  document.addEventListener('visibilitychange', () => { accrue(); persist(true); render(); });
  const horseIds = ['thunder', 'blaze', 'midnight', 'rusty'];
  const horseNames = ['Thunder', 'Blaze', 'Midnight', 'Rusty'];
  const odds = [2.5, 3, 4.5, 6];
  horseIds.forEach(id => $('bet-' + id).setAttribute('aria-label', 'Bet on ' + id));
  $('slots-bet').setAttribute('aria-label', 'Slot bet in coins');
  $('start-race').addEventListener('click', () => {
    if (raceRunning) return;
    const bets = horseIds.map(id => integerBet($('bet-' + id)));
    const total = bets.reduce((sum, bet) => sum + bet, 0);
    if (bets.includes(null) || !Number.isSafeInteger(total) || total <= 0 || total > state.coins) { notice('Enter whole, positive bets within your coin balance.', 'error'); return; }
    raceRunning = true; $('start-race').disabled = true;
    state.stats.races++;
    horseIds.forEach(id => $('bet-' + id).disabled = true);
    state.coins -= total; persist(true); render();
    window.Webop?.sound('race');
    const track = $('race-track');
    const callout = $('race-callout');
    track.style.display = 'block';
    $('race-result').textContent = '';
    const horses = [...document.querySelectorAll('.lane-horse')];
    const lanes = [...document.querySelectorAll('.race-lane')];
    horses.forEach((horse, index) => {
      horse.style.transition = 'none';
      horse.style.left = '0%';
      horse.classList.remove('running');
      lanes[index].classList.toggle('wagered', bets[index] > 0);
      lanes[index].classList.remove('winner');
    });
    // Weighted chances match the ordering of the displayed payouts.
    const weights = odds.map(odd => 1 / odd), sum = weights.reduce((a,b) => a+b,0);
    let random = Math.random() * sum, winner = weights.length - 1;
    for (let i = 0; i < weights.length; i++) { random -= weights[i]; if (random <= 0) { winner = i; break; } }
    // Settle immediately so closing the extension cannot discard a pending result.
    const winnings = Math.floor(bets[winner] * odds[winner]);
    state.coins = Math.min(LIMIT, state.coins + winnings); persist(true);
    if (bets[winner] > 0) state.stats.raceWins++;
    checkAchievements(); persist(true);
    const motionEnabled = !document.body.classList.contains('reduced-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finishRace = () => {
      horses[winner].classList.remove('running');
      lanes[winner].classList.add('winner');
      $('race-result').textContent = `${horseNames[winner]} wins! ${winnings ? '+' + format(winnings) + ' coins returned.' : 'No payout this race.'}`;
      notice('Race complete. Payouts include your winning stake.', winnings ? 'win' : 'lose');
      raceRunning = false;
      $('start-race').disabled = false;
      horseIds.forEach(id => $('bet-' + id).disabled = false);
      commit();
    };
    const moveTo = (positions, duration = 480) => {
      horses.forEach((horse, index) => {
        horse.style.transition = `left ${duration}ms cubic-bezier(.2,.75,.35,1)`;
        horse.style.left = `${positions[index]}%`;
      });
    };
    const runRace = () => {
      callout.textContent = 'AND THEY’RE OFF!';
      horses.forEach(horse => horse.classList.add('running'));
      window.Webop?.sound('race');
      let split = 0;
      const splitNames = ['Blaze surges up the rail!', 'Thunder answers with a burst of speed!', 'They’re neck and neck down the stretch!', 'Final furlong — anything can happen!'];
      const raceTimer = setInterval(() => {
        const progress = [18, 36, 56, 76][split];
        const positions = horses.map((_, index) => {
          if (split === 3 && index === winner) return 91;
          const lead = Math.random() * 23;
          return Math.min(86, progress + lead + (index === winner ? Math.random() * 6 : 0));
        });
        moveTo(positions);
        callout.textContent = splitNames[split];
        window.Webop?.sound('race');
        split++;
        if (split === splitNames.length) {
          clearInterval(raceTimer);
          setTimeout(() => {
            moveTo(horses.map((_, index) => index === winner ? 94 : 73 + Math.random() * 13), 380);
            callout.textContent = 'PHOTO FINISH!';
            horses.forEach((horse, index) => { if (index !== winner) horse.classList.remove('running'); });
            setTimeout(finishRace, 500);
          }, 460);
        }
      }, 520);
    };
    if (!motionEnabled) {
      moveTo(horses.map((_, index) => index === winner ? 94 : 73 + Math.random() * 13), 0);
      callout.textContent = 'PHOTO FINISH!';
      finishRace();
    } else {
      let count = 3;
      callout.textContent = `Riders ready… ${count}`;
      const countdown = setInterval(() => {
        count--;
        if (count > 0) {
          callout.textContent = `Riders ready… ${count}`;
          window.Webop?.sound('race');
        } else {
          clearInterval(countdown);
          runRace();
        }
      }, 650);
    }
  });
  $('spin-slots').addEventListener('click', () => {
    if (slotsRunning) return;
    const bet = integerBet($('slots-bet'));
    if (!bet || bet > state.coins) { notice('Enter a whole-number bet between 1 and your balance.', 'error'); return; }
    slotsRunning = true; $('spin-slots').disabled = true; $('slots-bet').disabled = true;
    window.Webop?.sound('reel');
    const symbols = ['🍒','🍋','🍊','💎','7️⃣'];
    const result = Array.from({ length: 3 }, () => Math.floor(Math.random() * symbols.length));
    const multiplier = result.every(symbol => symbol === result[0]) ? [5,10,15,50,100][result[0]] : 0;
    state.stats.spins++;
    state.coins -= bet; render();
    state.coins = Math.min(LIMIT, state.coins + Math.floor(bet * multiplier)); persist(true);
    if (multiplier) state.stats.slotWins++;
    checkAchievements(); persist(true);
    $('slots-result').textContent = 'Spinning…';
    const motionEnabled = !document.body.classList.contains('reduced-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animation, frame = 0;
    if (motionEnabled) {
      animation = setInterval(() => {
        for (let i=0;i<3;i++) $('reel'+(i+1)).textContent = symbols[(frame+i)%5];
        frame++; window.Webop?.sound('reel');
      }, 100);
    }
    setTimeout(() => {
      clearInterval(animation); result.forEach((symbol,i) => $('reel'+(i+1)).textContent = symbols[symbol]);
      $('slots-result').textContent = multiplier ? `${multiplier}× match! ${format(bet * multiplier)} coins returned.` : 'No match. Bake more cookies and try again.';
      window.Webop?.sound(multiplier ? 'win' : 'lose');
      slotsRunning = false; $('spin-slots').disabled = false; $('slots-bet').disabled = false; commit();
    }, motionEnabled ? 1100 : 0);
  });
});
