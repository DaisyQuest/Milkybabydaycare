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

const ORBIT_EMOJIS = ['✨', '🫧', '💖', '🌈', '⭐'];

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

export function resolveParallaxOffsets(scrollY = 0) {
  return {
    decor: scrollY * 0.3,
    hero: scrollY * 0.9,
    mesh: scrollY * 0.15
  };
}

export function resolveMagnetTilt(rect, pointer, maxDistance = 120, maxTiltDeg = 6) {
  if (!rect || !pointer) {
    return { tiltX: 0, tiltY: 0, active: false };
  }

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = pointer.x - centerX;
  const dy = pointer.y - centerY;
  const distance = Math.hypot(dx, dy);

  if (distance > maxDistance || distance === 0) {
    return { tiltX: 0, tiltY: 0, active: false };
  }

  const normalized = (maxDistance - distance) / maxDistance;
  const tiltX = Number(((-dy / maxDistance) * maxTiltDeg * normalized).toFixed(3));
  const tiltY = Number(((dx / maxDistance) * maxTiltDeg * normalized).toFixed(3));
  return { tiltX, tiltY, active: true };
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

export function createButtonRipple({ doc, button, x, y, scheduleRemoval = setTimeout, removeAfterMs = 520 }) {
  if (!doc || !button) {
    return null;
  }

  const rect = button.getBoundingClientRect();
  const ripple = doc.createElement('span');
  const localX = Number.isFinite(x) ? x - rect.left : rect.width / 2;
  const localY = Number.isFinite(y) ? y - rect.top : rect.height / 2;

  ripple.className = 'button-ripple';
  ripple.style.setProperty('--ripple-x', `${localX}px`);
  ripple.style.setProperty('--ripple-y', `${localY}px`);
  button.appendChild(ripple);
  scheduleRemoval(() => ripple.remove(), removeAfterMs);
  return ripple;
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

export function setupAmbientLayers(doc, root, palette, reducedMotion, rng = Math.random) {
  if (!doc || !root) {
    return null;
  }

  const meshLayer = doc.createElement('section');
  meshLayer.className = 'ambient-mesh';
  meshLayer.dataset.ambientMesh = 'true';

  for (let i = 0; i < 4; i += 1) {
    const blob = doc.createElement('span');
    blob.className = 'ambient-blob';
    blob.style.setProperty('--blob-index', String(i));
    blob.style.setProperty('--blob-left', `${Math.floor(rng() * 100)}%`);
    blob.style.setProperty('--blob-top', `${Math.floor(rng() * 100)}%`);
    meshLayer.appendChild(blob);
  }

  const bubbleLayer = doc.createElement('section');
  bubbleLayer.className = 'bubble-layer';
  bubbleLayer.dataset.bubbleLayer = 'true';

  const starsLayer = doc.createElement('section');
  starsLayer.className = 'stars-layer';
  starsLayer.dataset.starsLayer = 'true';

  if (palette === 'night') {
    for (let i = 0; i < 16; i += 1) {
      const star = doc.createElement('span');
      star.className = 'twinkle-star';
      star.textContent = '✨';
      star.style.setProperty('--star-left', `${Math.floor(rng() * 100)}%`);
      star.style.setProperty('--star-top', `${Math.floor(rng() * 100)}%`);
      star.style.setProperty('--star-delay', `${Math.floor(rng() * 2000)}ms`);
      starsLayer.appendChild(star);
    }
  }

  root.prepend(meshLayer, bubbleLayer, starsLayer);

  if (reducedMotion) {
    return { meshLayer, bubbleLayer, starsLayer, spawnBubble: () => null };
  }

  const spawnBubble = () => {
    const bubble = doc.createElement('span');
    bubble.className = 'bubble-layer__bubble';
    bubble.textContent = '🫧';
    bubble.style.setProperty('--bubble-left', `${Math.floor(rng() * 100)}%`);
    bubble.style.setProperty('--bubble-size', `${0.8 + rng() * 1.4}`);
    bubble.style.setProperty('--bubble-duration', `${4200 + Math.floor(rng() * 3200)}ms`);
    bubble.style.setProperty('--bubble-drift', `${-16 + Math.floor(rng() * 32)}px`);
    bubbleLayer.appendChild(bubble);
    return bubble;
  };

  return { meshLayer, bubbleLayer, starsLayer, spawnBubble };
}

export function createMilkyBabyDaycareApp(doc, win = window, now = new Date()) {
  const root = doc.querySelector('[data-app-root]');
  const responseEl = doc.querySelector('[data-response]');
  const buttons = [...doc.querySelectorAll('button[data-choice]')];
  const burstLayer = doc.querySelector('[data-burst-layer]') ?? root;
  const hero = root?.querySelector('.hero-content');
  const decor = root?.querySelector('.floating-decor');

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
  const ambient = setupAmbientLayers(doc, root, state.palette, state.reducedMotion);

  function render(choice) {
    state.choice = normalizeChoice(choice);
    responseEl.textContent = reactionForChoice(state.choice);
    responseEl.dataset.choice = state.choice ?? 'none';
    responseEl.dataset.visible = 'true';

    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.choice === state.choice ? 'true' : 'false');
    });
  }

  if (!state.reducedMotion && ambient) {
    const bubbleTick = () => {
      const bubble = ambient.spawnBubble();
      if (bubble) {
        (win.setTimeout?.bind(win) ?? setTimeout)(() => bubble.remove(), 7600);
      }
    };

    bubbleTick();
    (win.setInterval?.bind(win) ?? setInterval)(bubbleTick, 920);
  }

  const updateParallax = () => {
    const scrollY = Number(win.scrollY ?? win.pageYOffset ?? 0);
    const offsets = resolveParallaxOffsets(scrollY);
    root.style.setProperty('--parallax-hero', `${offsets.hero}px`);
    root.style.setProperty('--parallax-decor', `${offsets.decor}px`);
    root.style.setProperty('--parallax-mesh', `${offsets.mesh}px`);
  };
  updateParallax();
  win.addEventListener?.('scroll', updateParallax, { passive: true });

  let cursorTarget = null;
  let cursorTrailFrame = null;
  const scheduleRaf = win.requestAnimationFrame?.bind(win) ?? ((cb) => setTimeout(cb, 16));
  win.addEventListener?.('pointermove', (event) => {
    cursorTarget = { x: event.clientX, y: event.clientY };
    if (cursorTrailFrame) {
      return;
    }

    cursorTrailFrame = scheduleRaf(() => {
      cursorTrailFrame = null;
      root.style.setProperty('--cursor-x', `${cursorTarget.x}px`);
      root.style.setProperty('--cursor-y', `${cursorTarget.y}px`);
      root.dataset.cursorActive = 'true';
    });
  });

  let idleTimeout = null;
  const armIdle = () => {
    if (idleTimeout) {
      (win.clearTimeout?.bind(win) ?? clearTimeout)(idleTimeout);
    }

    root.dataset.idlePulse = 'false';
    idleTimeout = (win.setTimeout?.bind(win) ?? setTimeout)(() => {
      root.dataset.idlePulse = 'true';
    }, 4000);
  };
  armIdle();
  ['pointerdown', 'pointermove', 'keydown', 'scroll'].forEach((name) => {
    win.addEventListener?.(name, armIdle, { passive: true });
  });

  const updateMagnetTiltForEvent = (event) => {
    const pointer = { x: event.clientX, y: event.clientY };
    buttons.forEach((button) => {
      const tilt = resolveMagnetTilt(button.getBoundingClientRect(), pointer);
      button.style.setProperty('--tilt-x', `${tilt.tiltX}deg`);
      button.style.setProperty('--tilt-y', `${tilt.tiltY}deg`);
      button.dataset.magnet = tilt.active ? 'on' : 'off';
    });
  };
  win.addEventListener?.('pointermove', updateMagnetTiltForEvent, { passive: true });

  buttons.forEach((button, buttonIndex) => {
    const orbit = doc.createElement('span');
    orbit.className = 'button-orbit';
    orbit.dataset.orbit = 'true';
    const orbitCount = 2 + (buttonIndex % 2);

    for (let i = 0; i < orbitCount; i += 1) {
      const atom = doc.createElement('span');
      atom.className = 'button-orbit__atom';
      atom.style.setProperty('--orbit-index', String(i));
      atom.textContent = ORBIT_EMOJIS[(buttonIndex + i) % ORBIT_EMOJIS.length];
      orbit.appendChild(atom);
    }

    button.appendChild(orbit);

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

      createButtonRipple({
        doc,
        button,
        x,
        y,
        scheduleRemoval: win.setTimeout?.bind(win) ?? setTimeout
      });

      root.dataset.shake = 'on';
      (win.setTimeout?.bind(win) ?? setTimeout)(() => {
        root.dataset.shake = 'off';
      }, 120);
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
