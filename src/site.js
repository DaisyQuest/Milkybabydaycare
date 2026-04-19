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

const PARTICLE_EMOJIS = {
  pickup: ['✨', '🌟', '💖', '🧸', '🫧'],
  dropoff: ['☁️', '🫧', '🌈', '🍼', '⭐'],
  generic: ['✨', '💫', '🌸', '💖']
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

export function particleEmojiForChoice(choice, rng = Math.random, particles = PARTICLE_EMOJIS) {
  const normalized = normalizeChoice(choice);
  const pool = normalized ? particles[normalized] : particles.generic;

  if (!Array.isArray(pool) || pool.length === 0) {
    return '✨';
  }

  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? pool[0] ?? '✨';
}

export function createButtonBurst({
  doc,
  target,
  layer,
  choice,
  x,
  y,
  rng = Math.random,
  scheduleRemoval = setTimeout,
  particleCount = 14,
  removeAfterMs = 900
}) {
  if (!doc || !target) {
    return null;
  }

  const burstLayer = layer ?? target;
  const burst = doc.createElement('div');
  const normalizedChoice = normalizeChoice(choice) ?? 'generic';

  burst.className = 'click-burst';
  burst.dataset.choice = normalizedChoice;
  burst.style.setProperty('--burst-x', `${x}px`);
  burst.style.setProperty('--burst-y', `${y}px`);

  for (let index = 0; index < particleCount; index += 1) {
    const particle = doc.createElement('span');
    const angle = (index / particleCount) * Math.PI * 2;
    const distance = 42 + Math.floor(rng() * 56);

    particle.className = 'click-burst__particle';
    particle.textContent = particleEmojiForChoice(normalizedChoice, rng);
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    particle.style.setProperty('--drift-delay', `${Math.floor(rng() * 120)}ms`);
    burst.appendChild(particle);
  }

  burstLayer.appendChild(burst);
  scheduleRemoval(() => burst.remove(), removeAfterMs);
  return burst;
}

export function splitHeadline(headline, doc) {
  if (!headline || !doc) {
    return 0;
  }

  const text = headline.textContent;
  headline.textContent = '';
  headline.classList.add('h1-split');

  const tokens = text.split(/(\s+)/);
  let charIndex = 0;

  for (const token of tokens) {
    if (token.length === 0) {
      continue;
    }

    if (/^\s+$/.test(token)) {
      const spaceEl = doc.createElement('span');
      spaceEl.className = 'h1-space';
      spaceEl.textContent = token;
      headline.appendChild(spaceEl);
      continue;
    }

    const wordEl = doc.createElement('span');
    wordEl.className = 'h1-word';

    for (const char of Array.from(token)) {
      const charEl = doc.createElement('span');
      charEl.className = char === '✨' ? 'h1-char h1-sparkle' : 'h1-char';
      charEl.style.setProperty('--char-index', String(charIndex));
      charEl.textContent = char;
      wordEl.appendChild(charEl);
      charIndex += 1;
    }

    headline.appendChild(wordEl);
  }

  return charIndex;
}

export function tuneLetterStep(totalChars, targetDurationMs = 900, min = 16, max = 45) {
  if (!Number.isFinite(totalChars) || totalChars <= 0) {
    return null;
  }
  const raw = targetDurationMs / totalChars;
  return Math.max(min, Math.min(max, raw));
}

export function createMilkyBabyDaycareApp(doc, win = window, now = new Date()) {
  const root = doc.querySelector('[data-app-root]');
  const responseEl = doc.querySelector('[data-response]');
  const buttons = [...doc.querySelectorAll('[data-choice]')];
  const burstLayer = doc.querySelector('[data-burst-layer]') ?? root;

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

  const headline = root.querySelector('h1');
  const totalChars = splitHeadline(headline, doc);
  const step = tuneLetterStep(totalChars);
  if (step !== null && doc.documentElement) {
    doc.documentElement.style.setProperty('--letter-step', `${step}ms`);
  }

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
    button.addEventListener('click', (event) => {
      render(button.dataset.choice);

      if (state.reducedMotion) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const x = Number.isFinite(event?.clientX) ? event.clientX : rect.left + rect.width / 2;
      const y = Number.isFinite(event?.clientY) ? event.clientY : rect.top + rect.height / 2;

      createButtonBurst({
        doc,
        target: root,
        layer: burstLayer,
        choice: button.dataset.choice,
        x,
        y,
        scheduleRemoval: win.setTimeout?.bind(win) ?? setTimeout
      });
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
