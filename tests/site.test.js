import { describe, expect, it } from 'vitest';
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import {
  createMilkyBabyDaycareApp,
  initMilkyBabyDaycare,
  isReducedMotion,
  normalizeChoice,
  reactionForChoice,
  resolvePaletteByHour
} from '../src/site.js';

function buildDom() {
  document.body.innerHTML = `
    <main data-app-root>
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

    fireEvent.click(pickupButton);
    expect(response.dataset.choice).toBe('pickup');
    expect(response.dataset.visible).toBe('true');
    expect(pickupButton.getAttribute('aria-pressed')).toBe('true');
    expect(dropoffButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(dropoffButton);
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
});

describe('initMilkyBabyDaycare', () => {
  it('delegates to app creation', () => {
    buildDom();
    const app = initMilkyBabyDaycare(document, { matchMedia: () => ({ matches: false }) }, new Date('2026-01-01T10:00:00Z'));
    expect(app.getState().palette).toBe('day');
  });
});
