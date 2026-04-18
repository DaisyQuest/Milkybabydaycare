const REACTIONS = {
  pickup: [
    'Pickup confirmed! Your tiny star pilot is ready for launch. ✨',
    'Scooped with love! Please accept one complimentary sparkle hug. 💖'
  ],
  dropoff: [
    'Dropoff complete! We queued bubbles, crayons, and giggles. 🫧',
    'Dropoff successful! Naptime patrol is on maximum fluffiness. ☁️'
  ]
};

export function normalizeChoice(rawChoice) {
  if (rawChoice === 'pickup') {
    return 'pickup';
  }

  if (rawChoice === 'dropoff') {
    return 'dropoff';
  }

  return null;
}

export function isReducedMotion(win) {
  if (!win || typeof win.matchMedia !== 'function') {
    return false;
  }

  return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function resolvePaletteByHour(hour) {
  if (hour >= 6 && hour < 18) {
    return 'day';
  }

  if (hour >= 18 && hour < 21) {
    return 'twilight';
  }

  return 'night';
}

export function reactionForChoice(choice, rng = Math.random, reactions = REACTIONS) {
  const normalized = normalizeChoice(choice);

  if (!normalized) {
    return 'Oopsie! Pick pickup or dropoff so the daycare magic can start. 🌈';
  }

  const pool = reactions[normalized];

  if (!Array.isArray(pool) || pool.length === 0) {
    return 'The cuteness staff is improvising. Please try again in one giggle. 🍼';
  }

  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? pool[0];
}

export function createMilkyBabyDaycareApp(doc, win = window, now = new Date()) {
  const root = doc.querySelector('[data-app-root]');
  const responseEl = doc.querySelector('[data-response]');
  const buttons = [...doc.querySelectorAll('[data-choice]')];

  if (!root || !responseEl || buttons.length === 0) {
    throw new Error('Milky app requires root, response element, and choice buttons.');
  }

  const state = {
    choice: null,
    reducedMotion: isReducedMotion(win),
    palette: resolvePaletteByHour(now.getHours())
  };

  root.dataset.motion = state.reducedMotion ? 'reduced' : 'full';
  root.dataset.palette = state.palette;

  function render(choice) {
    state.choice = normalizeChoice(choice);
    responseEl.textContent = reactionForChoice(state.choice);
    responseEl.dataset.choice = state.choice ?? 'none';
    responseEl.dataset.visible = 'true';

    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.choice === state.choice ? 'true' : 'false');
    });
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      render(button.dataset.choice);
    });
  });

  return {
    getState() {
      return { ...state };
    },
    render
  };
}

export function initMilkyBabyDaycare(doc = document, win = window, now = new Date()) {
  return createMilkyBabyDaycareApp(doc, win, now);
}
