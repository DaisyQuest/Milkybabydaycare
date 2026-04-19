import { describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import {
  buildTypewriterMarkup,
  createButtonBurst,
  createButtonRipple,
  createMilkyBabyDaycareApp,
  initMilkyBabyDaycare,
  isReducedMotion,
  normalizeChoice,
  particleEmojiForChoice,
  reactionForChoice,
  resolveIntroTimeline,
  resolveMagnetTilt,
  resolvePaletteByHour,
  resolveParallaxOffsets,
  setupAmbientLayers,
  setupIntroChoreography
} from '../src/site.js';

function buildDom() {
  document.body.innerHTML = `
    <main class="page-shell" data-app-root>
      <section class="floating-decor">
        <span data-intro-decor>☁️</span>
        <span data-intro-decor>✨</span>
      </section>
      <section class="hero-content">
        <h1 data-headline>
          <span data-headline-copy>Welcome to the Milky Baby Daycare</span>
          <span data-headline-sparkle>✨</span>
        </h1>
        <p class="subtitle" data-intro-subtitle>Are you picking up or dropping off?</p>
        <section class="button-row" data-intro-buttons>
          <button type="button" data-choice="pickup" aria-pressed="false">I’m Picking Up</button>
          <button type="button" data-choice="dropoff" aria-pressed="false">I’m Dropping Off</button>
        </section>
        <section class="response" data-response data-choice="none" data-visible="false"></section>
      </section>
      <section class="experience-grid">
        <section class="link-panel link-stack" data-intro-links><p>Link</p></section>
      </section>
      <section data-burst-layer></section>
    </main>
  `;
}

describe('normalizeChoice', () => {
  it('supports pickup and dropoff and rejects invalid values', () => {
    expect(normalizeChoice('pickup')).toBe('pickup');
    expect(normalizeChoice('dropoff')).toBe('dropoff');
    expect(normalizeChoice('something-else')).toBeNull();
  });
});

describe('isReducedMotion', () => {
  it('returns false when window-like object is missing', () => {
    expect(isReducedMotion(undefined)).toBe(false);
  });

  it('returns false when matchMedia is not a function', () => {
    expect(isReducedMotion({})).toBe(false);
  });

  it('returns media query matches result', () => {
    const win = {
      matchMedia: () => ({ matches: true })
    };

    expect(isReducedMotion(win)).toBe(true);
  });
});

describe('resolvePaletteByHour', () => {
  it('resolves day palette', () => {
    expect(resolvePaletteByHour(9)).toBe('day');
  });

  it('resolves twilight palette', () => {
    expect(resolvePaletteByHour(20)).toBe('twilight');
  });

  it('resolves night palette', () => {
    expect(resolvePaletteByHour(2)).toBe('night');
  });
});

describe('resolveParallaxOffsets', () => {
  it('maps parallax multipliers for each layer', () => {
    expect(resolveParallaxOffsets(100)).toEqual({ decor: 30, hero: 90, mesh: 15 });
  });
});

describe('resolveMagnetTilt', () => {
  it('handles missing data and out-of-range pointers', () => {
    expect(resolveMagnetTilt()).toEqual({ tiltX: 0, tiltY: 0, active: false });
    expect(resolveMagnetTilt({ left: 0, top: 0, width: 100, height: 40 }, { x: 999, y: 999 })).toEqual({
      tiltX: 0,
      tiltY: 0,
      active: false
    });
  });

  it('returns active tilt values near the button', () => {
    const result = resolveMagnetTilt({ left: 0, top: 0, width: 100, height: 40 }, { x: 80, y: 18 });
    expect(result.active).toBe(true);
    expect(result.tiltX).not.toBe(0);
    expect(result.tiltY).not.toBe(0);
  });
});

describe('buildTypewriterMarkup', () => {
  it('builds character metadata and tracks spaces', () => {
    expect(buildTypewriterMarkup('A B')).toEqual([
      { character: 'A', index: 0, isSpace: false },
      { character: ' ', index: 1, isSpace: true },
      { character: 'B', index: 2, isSpace: false }
    ]);
  });

  it('returns empty markup for non-strings', () => {
    expect(buildTypewriterMarkup(undefined)).toEqual([]);
  });
});

describe('resolveIntroTimeline', () => {
  it('derives deterministic delay sequencing from character count', () => {
    expect(resolveIntroTimeline(3)).toEqual({
      headlineDelayMs: 420,
      charDurationMs: 45,
      headlineDurationMs: 135,
      sparkleDelayMs: 655,
      subtitleDelayMs: 775,
      buttonDelayMs: 995,
      linkDelayMs: 1475,
      introEndMs: 1875
    });
  });

  it('normalizes invalid character counts to zero', () => {
    expect(resolveIntroTimeline(Number.NaN).headlineDurationMs).toBe(0);
    expect(resolveIntroTimeline(-2).headlineDurationMs).toBe(0);
  });
});

describe('setupIntroChoreography', () => {
  it('returns null when root or document is missing', () => {
    expect(setupIntroChoreography(undefined, undefined, false)).toBeNull();
  });

  it('marks intro complete immediately in reduced-motion mode', () => {
    buildDom();
    const root = document.querySelector('[data-app-root]');
    const result = setupIntroChoreography(document, root, true);

    expect(root.dataset.intro).toBe('complete');
    expect(result.characterCount).toBe(0);
  });

  it('writes typewriter spans, sets delays, and settles intro state', () => {
    buildDom();
    const root = document.querySelector('[data-app-root]');
    const scheduleSettle = vi.fn((cb) => cb());
    const result = setupIntroChoreography(document, root, false, scheduleSettle);

    expect(root.dataset.intro).toBe('complete');
    expect(result.characterCount).toBeGreaterThan(0);
    expect(scheduleSettle).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-headline-copy] .headline-char').length).toBe(result.characterCount);
    expect(document.querySelector('[data-headline-copy] [data-space="true"]')).toBeTruthy();
    expect(root.style.getPropertyValue('--button-delay')).toContain('ms');
    expect(document.querySelector('[data-intro-decor]').style.getPropertyValue('--decor-index')).toBe('0');
  });

  it('handles missing optional intro nodes without throwing', () => {
    document.body.innerHTML = '<main data-app-root></main>';
    const root = document.querySelector('[data-app-root]');
    const scheduleSettle = vi.fn((cb) => cb());

    const result = setupIntroChoreography(document, root, false, scheduleSettle);

    expect(result.characterCount).toBe(0);
    expect(root.dataset.intro).toBe('complete');
    expect(scheduleSettle).toHaveBeenCalledTimes(1);
  });
});

describe('reactionForChoice', () => {
  it('returns invalid choice fallback message', () => {
    const message = reactionForChoice('invalid-choice');
    expect(message).toContain('Pick pickup or dropoff');
  });

  it('returns empty reaction pool fallback', () => {
    const message = reactionForChoice('pickup', () => 0.2, { pickup: [], dropoff: [] });
    expect(message).toContain('improvising');
  });

  it('returns deterministic reaction by rng', () => {
    const message = reactionForChoice('pickup', () => 0);
    expect(message).toContain('Pickup confirmed');
  });

  it('uses pool[0] fallback when random index is out of range', () => {
    const message = reactionForChoice('dropoff', () => 1, {
      dropoff: ['a'],
      pickup: ['b']
    });

    expect(message).toBe('a');
  });
});

describe('particleEmojiForChoice', () => {
  it('returns a deterministic particle emoji by choice and rng', () => {
    expect(particleEmojiForChoice('pickup', () => 0)).toBe('✨');
    expect(particleEmojiForChoice('dropoff', () => 0)).toBe('☁️');
  });

  it('falls back to generic pool and sparkle default for edge pools', () => {
    expect(particleEmojiForChoice('invalid', () => 0)).toBe('✨');
    expect(particleEmojiForChoice('pickup', () => 0, { pickup: [], dropoff: [], generic: [] })).toBe('✨');
    expect(particleEmojiForChoice('pickup', () => 1, { pickup: ['💖'], dropoff: ['⭐'], generic: ['✨'] })).toBe('💖');
    expect(particleEmojiForChoice('pickup', () => 0.6, { pickup: new Array(2), dropoff: ['⭐'], generic: ['✨'] })).toBe('✨');
  });
});

describe('createButtonBurst', () => {
  it('returns null when required args are missing', () => {
    expect(createButtonBurst({})).toBeNull();
  });

  it('creates a burst with particles and removes it after timeout', () => {
    document.body.innerHTML = '<main data-app-root><section data-burst-layer></section></main>';
    const root = document.querySelector('[data-app-root]');
    const layer = document.querySelector('[data-burst-layer]');
    const scheduleRemoval = vi.fn((cb) => cb());

    const burst = createButtonBurst({
      doc: document,
      target: root,
      layer,
      choice: 'pickup',
      x: 20,
      y: 30,
      particleCount: 3,
      rng: () => 0,
      scheduleRemoval
    });

    expect(burst).toBeTruthy();
    expect(scheduleRemoval).toHaveBeenCalledTimes(1);
    expect(layer.querySelector('.click-burst')).toBeNull();
  });

  it('defaults burst layer to target and uses generic choice for invalid type', () => {
    document.body.innerHTML = '<main data-app-root></main>';
    const root = document.querySelector('[data-app-root]');

    const burst = createButtonBurst({
      doc: document,
      target: root,
      choice: 'unknown',
      x: 40,
      y: 50,
      particleCount: 1,
      removeAfterMs: 0,
      scheduleRemoval: () => {}
    });

    expect(root.querySelector('.click-burst')).toBe(burst);
    expect(burst.dataset.choice).toBe('generic');
  });
});

describe('createButtonRipple', () => {
  it('returns null when required args are missing', () => {
    expect(createButtonRipple({})).toBeNull();
  });

  it('creates and removes a ripple and supports fallback click center', () => {
    document.body.innerHTML = '<button id="x">x</button>';
    const button = document.querySelector('#x');
    const scheduleRemoval = vi.fn((cb) => cb());
    const ripple = createButtonRipple({ doc: document, button, scheduleRemoval });
    expect(ripple).toBeTruthy();
    expect(scheduleRemoval).toHaveBeenCalledTimes(1);
    expect(button.querySelector('.button-ripple')).toBeNull();
  });
});

describe('setupAmbientLayers', () => {
  it('returns null without root/doc and supports reduced mode', () => {
    expect(setupAmbientLayers(undefined, undefined, 'day', true)).toBeNull();

    buildDom();
    const root = document.querySelector('[data-app-root]');
    const ambient = setupAmbientLayers(document, root, 'day', true, () => 0.25);
    expect(ambient.spawnBubble()).toBeNull();
    expect(root.querySelectorAll('.ambient-blob').length).toBe(4);
    expect(root.querySelectorAll('.twinkle-star').length).toBe(0);
  });

  it('adds stars at night and spawns bubbles when motion is full', () => {
    buildDom();
    const root = document.querySelector('[data-app-root]');
    const ambient = setupAmbientLayers(document, root, 'night', false, () => 0.1);
    expect(root.querySelectorAll('.twinkle-star').length).toBe(16);
    const bubble = ambient.spawnBubble();
    expect(bubble).toBeTruthy();
    expect(root.querySelector('.bubble-layer__bubble')).toBeTruthy();
  });
});

describe('createMilkyBabyDaycareApp', () => {
  it('throws when required DOM elements are missing', () => {
    document.body.innerHTML = '<main></main>';

    expect(() => createMilkyBabyDaycareApp(document, {}, new Date('2026-01-01T10:00:00Z'))).toThrow(
      'Milky app requires root, response element, and choice buttons.'
    );
  });

  it('initializes with reduced motion and twilight palette', () => {
    buildDom();
    const app = createMilkyBabyDaycareApp(
      document,
      { matchMedia: () => ({ matches: true }), addEventListener: vi.fn(), setTimeout },
      new Date('2026-01-01T19:00:00Z')
    );

    const root = document.querySelector('[data-app-root]');
    expect(root.dataset.motion).toBe('reduced');
    expect(root.dataset.palette).toBe('twilight');
    expect(app.getState()).toEqual({
      choice: null,
      reducedMotion: true,
      palette: 'twilight'
    });
  });

  it('renders clicks, ripple, burst, shake, parallax, pointer trail, and magnet tilt effects', () => {
    vi.useFakeTimers();
    buildDom();
    const listeners = {};
    const addCaptured = (name, fn) => {
      listeners[name] = listeners[name] ?? [];
      listeners[name].push(fn);
    };
    const rafQueue = [];
    const appWin = {
      matchMedia: () => ({ matches: false }),
      setTimeout,
      clearTimeout,
      setInterval: vi.fn(),
      addEventListener: vi.fn((name, fn) => {
        addCaptured(name, fn);
      }),
      requestAnimationFrame: (cb) => {
        rafQueue.push(cb);
      },
      scrollY: 50
    };

    createMilkyBabyDaycareApp(document, appWin, new Date('2026-01-01T02:00:00Z'));

    const pickupButton = getByRole(document.body, 'button', { name: /I’m Picking Up/ });
    const dropoffButton = getByRole(document.body, 'button', { name: /I’m Dropping Off/ });
    const response = document.querySelector('[data-response]');

    listeners.scroll.forEach((fn) => fn());
    expect(document.querySelector('[data-app-root]').style.getPropertyValue('--parallax-hero')).toBe('45px');

    listeners.pointermove.forEach((fn) => fn({ clientX: 44, clientY: 33 }));
    listeners.pointermove.forEach((fn) => fn({ clientX: 45, clientY: 35 }));
    expect(rafQueue.length).toBeGreaterThan(0);
    rafQueue[0]();
    expect(document.querySelector('[data-app-root]').dataset.cursorActive).toBe('true');

    fireEvent.click(pickupButton, { clientX: 12, clientY: 24 });
    expect(response.dataset.choice).toBe('pickup');
    expect(response.dataset.visible).toBe('true');
    expect(pickupButton.getAttribute('aria-pressed')).toBe('true');
    expect(dropoffButton.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.button-ripple')).toBeTruthy();
    expect(document.querySelector('.click-burst')).toBeTruthy();
    expect(document.querySelector('[data-app-root]').dataset.shake).toBe('on');

    fireEvent.click(dropoffButton, { clientX: 18, clientY: 36 });
    expect(response.dataset.choice).toBe('dropoff');
    expect(pickupButton.getAttribute('aria-pressed')).toBe('false');
    expect(dropoffButton.getAttribute('aria-pressed')).toBe('true');

    listeners.pointermove.forEach((fn) => fn({ clientX: 25, clientY: 22 }));
    expect(['on', 'off']).toContain(pickupButton.dataset.magnet);

    vi.runAllTimers();
    expect(document.querySelector('[data-app-root]').dataset.shake).toBe('off');
    vi.useRealTimers();
  });

  it('supports rendering an invalid choice through app API for defensive branch', () => {
    buildDom();
    const app = createMilkyBabyDaycareApp(
      document,
      { matchMedia: () => ({ matches: false }), setInterval: vi.fn(), addEventListener: vi.fn() },
      new Date('2026-01-01T08:00:00Z')
    );

    app.render('invalid');

    expect(getByText(document.body, /Pick pickup or dropoff/)).toBeTruthy();
    const response = document.querySelector('[data-response]');
    expect(response.dataset.choice).toBe('none');
  });

  it('skips visual burst effects when reduced motion is enabled', () => {
    buildDom();
    createMilkyBabyDaycareApp(
      document,
      { matchMedia: () => ({ matches: true }), addEventListener: vi.fn() },
      new Date('2026-01-01T08:00:00Z')
    );

    const pickupButton = getByRole(document.body, 'button', { name: /I’m Picking Up/ });
    fireEvent.click(pickupButton, { clientX: 10, clientY: 20 });

    expect(document.querySelector('.click-burst')).toBeNull();
    expect(document.querySelector('.button-ripple')).toBeNull();
  });
});

describe('initMilkyBabyDaycare', () => {
  it('delegates to app creation', () => {
    buildDom();
    const app = initMilkyBabyDaycare(
      document,
      { matchMedia: () => ({ matches: false }), setInterval: vi.fn(), addEventListener: vi.fn() },
      new Date('2026-01-01T10:00:00Z')
    );
    expect(app.getState().palette).toBe('day');
  });
});
