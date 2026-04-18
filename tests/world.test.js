import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import {
  assignViewerCharacter,
  clamp,
  createViewerState,
  createWorldConfig,
  createWorldController,
  createWorldSync,
  moveViewer,
  nextPosition,
  normalizeBoardSize,
  renderAsciiCanvas,
  sanitizeName
} from '../src/world.js';
import { initWorld } from '../src/world-client.js';

function mountWorldDom(bootstrap) {
  document.body.innerHTML = `
    <main>
      <label data-world-signals data-signals="{}"></label>
      <input data-world-name />
      <p data-world-status></p>
      <button data-world-move="up">up</button>
      <button data-world-move="left">left</button>
      <button data-world-move="down">down</button>
      <button data-world-move="right">right</button>
      <pre data-world-canvas></pre>
      <script type="application/json" data-world-bootstrap>${JSON.stringify(bootstrap)}</script>
    </main>
  `;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('world primitives', () => {
  it('clamps values correctly', () => {
    expect(clamp(-2, 0, 5)).toBe(0);
    expect(clamp(8, 0, 5)).toBe(5);
    expect(clamp(3, 0, 5)).toBe(3);
  });

  it('normalizes board size with fallback and min/max constraints', () => {
    expect(normalizeBoardSize('abc', 12)).toBe(12);
    expect(normalizeBoardSize('1', 12)).toBe(5);
    expect(normalizeBoardSize('999', 12)).toBe(120);
  });

  it('sanitizes names and falls back as needed', () => {
    expect(sanitizeName('  Nova  ')).toBe('Nova');
    expect(sanitizeName('', 'Fallback')).toBe('Fallback');
    expect(sanitizeName('x'.repeat(40)).length).toBe(24);
  });

  it('assigns viewer characters deterministically with rng and safe fallback', () => {
    expect(assignViewerCharacter(() => 0)).toBe('!');
    expect(assignViewerCharacter(() => 1)).toBe('@');
  });

  it('creates world config and viewer state safely', () => {
    const world = createWorldConfig({ width: '9', height: '1000' });
    expect(world).toEqual({ width: 9, height: 120 });

    const viewer = createViewerState({
      id: '',
      character: '',
      name: '   ',
      x: -1,
      y: 999,
      world
    });

    expect(viewer.character).toBe('@');
    expect(viewer.name).toBe('Starling');
    expect(viewer.x).toBe(0);
    expect(viewer.y).toBe(119);
    expect(viewer.id.startsWith('viewer-')).toBe(true);
  });


  it('handles non-string names and non-finite coordinates defensively', () => {
    expect(sanitizeName(undefined, 'Fallback')).toBe('Fallback');

    const viewer = createViewerState({
      id: 'safe',
      character: 'Q',
      name: 'Pilot',
      x: Number.NaN,
      y: Number.POSITIVE_INFINITY,
      world: { width: 5, height: 5 }
    });

    expect(viewer.x).toBe(0);
    expect(viewer.y).toBe(0);
  });

  it('calculates movement, including invalid intents and boundary clamps', () => {
    const world = { width: 2, height: 2 };
    const viewer = { x: 0, y: 0, character: '@', name: 'N', id: '1' };

    expect(nextPosition(viewer, 'invalid', world)).toEqual({ x: 0, y: 0 });
    expect(nextPosition(viewer, 'right', world)).toEqual({ x: 1, y: 0 });
    expect(moveViewer(viewer, 'down', world)).toEqual({ ...viewer, x: 0, y: 1 });
  });

  it('renders ascii canvas with viewer position', () => {
    const canvas = renderAsciiCanvas({
      world: { width: 3, height: 2 },
      viewer: { x: 1, y: 0, character: '*', id: '1', name: 'N' }
    });

    expect(canvas).toBe('.*.\n...');
  });
});

describe('createWorldController and initWorld', () => {
  it('throws when expected ui nodes are missing', () => {
    document.body.innerHTML = '<main></main>';
    expect(() =>
      createWorldController({
        doc: document,
        world: { width: 5, height: 5 },
        initialViewer: { id: '1', character: '@', name: 'N', x: 0, y: 0 }
      })
    ).toThrow('World UI is missing required elements.');
  });

  it('initializes through world-client and supports click and keyboard movement + rename + sync', async () => {
    mountWorldDom({
      world: { width: 5, height: 5 },
      viewer: { id: '1', character: '&', name: 'Comet', x: 1, y: 1 }
    });

    global.fetch = async () => ({
      ok: true,
      async json() {
        return { percentage: 100, contents: 'synced-map' };
      }
    });

    const controller = initWorld(document);
    const status = document.querySelector('[data-world-status]');
    const canvas = document.querySelector('[data-world-canvas]');
    const nameInput = document.querySelector('[data-world-name]');
    const signals = document.querySelector('[data-world-signals]');

    expect(status.textContent).toContain('Comet (&) at [1, 1]');
    expect(canvas.textContent.split('\n').length).toBe(5);

    fireEvent.click(document.querySelector('[data-world-move="up"]'));
    expect(status.textContent).toContain('[1, 0]');

    fireEvent.keyDown(document, { key: 'a' });
    expect(status.textContent).toContain('[0, 0]');

    fireEvent.keyDown(document, { key: 'x' });
    expect(status.textContent).toContain('[0, 0]');

    fireEvent.keyDown(document, { key: undefined });
    expect(status.textContent).toContain('[0, 0]');

    fireEvent.input(nameInput, { target: { value: '  Aurora  ' } });
    expect(status.textContent).toContain('Aurora (&)');

    controller.rename('');
    expect(status.textContent).toContain('Starling (&)');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(signals.dataset.signals)._contents).toBe('synced-map');
    expect(JSON.parse(signals.dataset.signals)._percentage).toBe(100);

    controller.move('right');
    expect(controller.getState().viewer.x).toBe(1);
    expect(controller.getState().world.width).toBe(5);
  });

  it('throws when bootstrap payload is missing', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => initWorld(document)).toThrow('Missing world bootstrap payload.');
  });

  it('marks sync complete locally when fetch is unavailable', async () => {
    mountWorldDom({
      world: { width: 5, height: 5 },
      viewer: { id: '1', character: '&', name: 'Comet', x: 1, y: 1 }
    });

    vi.stubGlobal('fetch', undefined);
    initWorld(document);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const signals = document.querySelector('[data-world-signals]');
    expect(JSON.parse(signals.dataset.signals)._percentage).toBe(100);
  });
});

describe('createWorldSync', () => {
  it('returns clamped sync percentage and fallback contents when server omits it', async () => {
    const sync = createWorldSync({
      url: '/world/updates',
      fetchFn: async () => ({
        ok: true,
        async json() {
          return { percentage: 320 };
        }
      })
    });

    await expect(sync({ contents: '..' })).resolves.toEqual({
      percentage: 100,
      contents: '..'
    });
  });

  it('falls back to zero percentage when payload is not numeric', async () => {
    const sync = createWorldSync({
      url: '/world/updates',
      fetchFn: async () => ({
        ok: true,
        async json() {
          return { percentage: 'not-a-number', contents: 'map' };
        }
      })
    });

    await expect(sync({ contents: '..' })).resolves.toEqual({
      percentage: 0,
      contents: 'map'
    });
  });

  it('returns zero sync when request fails or response is non-ok', async () => {
    const failing = createWorldSync({
      url: '/world/updates',
      fetchFn: async () => {
        throw new Error('network');
      }
    });

    const nonOk = createWorldSync({
      url: '/world/updates',
      fetchFn: async () => ({
        ok: false
      })
    });

    await expect(failing({})).resolves.toEqual({ percentage: 0 });
    await expect(nonOk({})).resolves.toEqual({ percentage: 0 });
  });
});
