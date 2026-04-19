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

export function buildTypewriterMarkup(text) {
  const value = typeof text === 'string' ? text : '';
  return [...value].map((character, index) => ({
    character,
    index,
    isSpace: character === ' '
  }));
}

export function resolveIntroTimeline(characterCount) {
  const safeCount = Number.isFinite(characterCount) ? Math.max(0, Math.floor(characterCount)) : 0;
  const headlineDelayMs = 420;
  const charDurationMs = 45;
  const headlineDurationMs = safeCount * charDurationMs;
  const sparkleDelayMs = headlineDelayMs + headlineDurationMs + 100;
  const subtitleDelayMs = sparkleDelayMs + 120;
  const buttonDelayMs = subtitleDelayMs + 220;
  const linkDelayMs = buttonDelayMs + 480;
  const introEndMs = linkDelayMs + 400;

  return {
    headlineDelayMs,
    charDurationMs,
    headlineDurationMs,
    sparkleDelayMs,
    subtitleDelayMs,
    buttonDelayMs,
    linkDelayMs,
    introEndMs
  };
}

export function setupIntroChoreography(doc, root, reducedMotion, scheduleSettle = setTimeout) {
  if (!doc || !root) {
    return null;
  }

  const headlineCopy = root.querySelector('[data-headline-copy]');
  const sparkle = root.querySelector('[data-headline-sparkle]');
  const subtitle = root.querySelector('[data-intro-subtitle]');
  const buttonRow = root.querySelector('[data-intro-buttons]');
  const linkStack = root.querySelector('[data-intro-links]');
  const decorItems = [...root.querySelectorAll('[data-intro-decor]')];

  if (reducedMotion) {
    root.dataset.intro = 'complete';
    return {
      timeline: resolveIntroTimeline(0),
      characterCount: 0
    };
  }

  const copyText = headlineCopy?.textContent?.trim() ?? '';
  const markup = buildTypewriterMarkup(copyText);
  const timeline = resolveIntroTimeline(markup.length);
  root.dataset.intro = 'playing';
  root.style.setProperty('--headline-delay', `${timeline.headlineDelayMs}ms`);
  root.style.setProperty('--headline-char-duration', `${timeline.charDurationMs}ms`);
  root.style.setProperty('--headline-duration', `${timeline.headlineDurationMs}ms`);
  root.style.setProperty('--sparkle-delay', `${timeline.sparkleDelayMs}ms`);
  root.style.setProperty('--subtitle-delay', `${timeline.subtitleDelayMs}ms`);
  root.style.setProperty('--button-delay', `${timeline.buttonDelayMs}ms`);
  root.style.setProperty('--link-delay', `${timeline.linkDelayMs}ms`);

  if (headlineCopy) {
    headlineCopy.textContent = '';
    markup.forEach(({ character, index, isSpace }) => {
      const span = doc.createElement('span');
      span.className = 'headline-char';
      span.style.setProperty('--char-index', String(index));
      span.textContent = character;
      if (isSpace) {
        span.dataset.space = 'true';
      }
      headlineCopy.appendChild(span);
    });
  }

  if (sparkle) {
    sparkle.style.setProperty('--sparkle-delay', `${timeline.sparkleDelayMs}ms`);
  }

  if (subtitle) {
    subtitle.style.setProperty('--subtitle-delay', `${timeline.subtitleDelayMs}ms`);
  }

  if (buttonRow) {
    buttonRow.style.setProperty('--button-delay', `${timeline.buttonDelayMs}ms`);
  }

  if (linkStack) {
    linkStack.style.setProperty('--link-delay', `${timeline.linkDelayMs}ms`);
  }

  decorItems.forEach((item, index) => {
    item.style.setProperty('--decor-index', String(index));
  });

  scheduleSettle(() => {
    root.dataset.intro = 'complete';
  }, timeline.introEndMs);

  return {
    timeline,
    characterCount: markup.length
  };
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
  setupIntroChoreography(doc, root, state.reducedMotion, win.setTimeout?.bind(win) ?? setTimeout);

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
