import { describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import {
  createButtonBurst,
  createMilkyBabyDaycareApp,
  initMilkyBabyDaycare,
  isReducedMotion,
  normalizeChoice,
  particleEmojiForChoice,
  reactionForChoice,
  resolvePaletteByHour
} from '../src/site.js';

function buildDom() {
  document.body.innerHTML = `
    <main data-app-root>
      <section data-burst-layer></section>
      <button type="button" data-choice="pickup" aria-pressed="false">I’m Picking Up</button>
      <button type="button" data-choice="dropoff" aria-pressed="false">I’m Dropping Off</button>
      <section data-response data-choice="none" data-visible="false"></section>
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
      { matchMedia: () => ({ matches: true }) },
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

  it('renders pickup and dropoff via clicks and updates aria-pressed state', () => {
    buildDom();
    createMilkyBabyDaycareApp(document, { matchMedia: () => ({ matches: false }) }, new Date('2026-01-01T02:00:00Z'));

    const pickupButton = getByRole(document.body, 'button', { name: 'I’m Picking Up' });
    const dropoffButton = getByRole(document.body, 'button', { name: 'I’m Dropping Off' });
    const response = document.querySelector('[data-response]');

    fireEvent.click(pickupButton, { clientX: 12, clientY: 24 });
    expect(response.dataset.choice).toBe('pickup');
    expect(response.dataset.visible).toBe('true');
    expect(pickupButton.getAttribute('aria-pressed')).toBe('true');
    expect(dropoffButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(dropoffButton, { clientX: 18, clientY: 36 });
    expect(response.dataset.choice).toBe('dropoff');
    expect(pickupButton.getAttribute('aria-pressed')).toBe('false');
    expect(dropoffButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('supports rendering an invalid choice through app API for defensive branch', () => {
    buildDom();
    const app = createMilkyBabyDaycareApp(document, { matchMedia: () => ({ matches: false }) }, new Date('2026-01-01T08:00:00Z'));

    app.render('invalid');

    expect(getByText(document.body, /Pick pickup or dropoff/)).toBeTruthy();
    const response = document.querySelector('[data-response]');
    expect(response.dataset.choice).toBe('none');
  });

  it('skips visual burst effects when reduced motion is enabled', () => {
    buildDom();
    createMilkyBabyDaycareApp(document, { matchMedia: () => ({ matches: true }) }, new Date('2026-01-01T08:00:00Z'));

    const pickupButton = getByRole(document.body, 'button', { name: 'I’m Picking Up' });
    fireEvent.click(pickupButton, { clientX: 10, clientY: 20 });

    expect(document.querySelector('.click-burst')).toBeNull();
  });

  it('falls back to button center when click coordinates are unavailable', () => {
    buildDom();
    const setTimeoutSpy = vi.fn((cb) => cb());
    const appWin = {
      matchMedia: () => ({ matches: false }),
      setTimeout: setTimeoutSpy
    };
    createMilkyBabyDaycareApp(document, appWin, new Date('2026-01-01T08:00:00Z'));

    const pickupButton = getByRole(document.body, 'button', { name: 'I’m Picking Up' });
    pickupButton.dispatchEvent(new Event('click'));

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('uses global timeout fallback and mixed coordinate fallback branches', () => {
    vi.useFakeTimers();
    buildDom();
    createMilkyBabyDaycareApp(document, { matchMedia: () => ({ matches: false }) }, new Date('2026-01-01T08:00:00Z'));

    const pickupButton = getByRole(document.body, 'button', { name: 'I’m Picking Up' });
    fireEvent.click(pickupButton, { clientX: 33 });

    expect(document.querySelector('.click-burst')).toBeTruthy();
    vi.runAllTimers();
    expect(document.querySelector('.click-burst')).toBeNull();
    vi.useRealTimers();
  });
});

describe('initMilkyBabyDaycare', () => {
  it('delegates to app creation', () => {
    buildDom();
    const app = initMilkyBabyDaycare(document, { matchMedia: () => ({ matches: false }) }, new Date('2026-01-01T10:00:00Z'));
    expect(app.getState().palette).toBe('day');
  });
});
