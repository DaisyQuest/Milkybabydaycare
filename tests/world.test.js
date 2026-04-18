import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import {
  assignViewerCharacter,
  clamp,
  createAdminAuthRequest,
  createViewerState,
  createWorldConfig,
  createWorldController,
  createWorldSync,
  moveViewer,
  nextPosition,
  normalizeBoardSize,
  renderAsciiCanvas,
  sanitizeAvatar,
  sanitizeAvatarColor,
  sanitizeChatMessage,
  sanitizeName
} from '../src/world.js';
import { initWorld } from '../src/world-client.js';

function mountWorldDom(bootstrap) {
  document.body.innerHTML = `
    <main>
      <label data-world-signals data-signals="{}" data-world-updates-url="/world/updates" data-world-admin-auth-url="/world/admin-auth"></label>
      <input data-world-name />
      <form data-world-admin-form>
        <input data-world-admin-input />
      </form>
      <p data-world-admin-status></p>
      <input data-avatar-character />
      <select data-avatar-font><option value="monospace">monospace</option><option value="serif">serif</option></select>
      <select data-avatar-color>
        <option value="R">R</option><option value="G">G</option><option value="B">B</option><option value="Y">Y</option><option value="PINK">PINK</option><option value="FREE" data-admin-only>FREE</option>
      </select>
      <input data-avatar-free-color data-admin-only />
      <select data-avatar-font-weight><option value="700">700</option><option value="bold">bold</option></select>
      <select data-avatar-shape data-admin-only><option value="square">square</option><option value="circle">circle</option></select>
      <input data-avatar-size data-admin-only />
      <span data-avatar-preview></span>
      <p data-world-status></p>
      <button data-world-move="up">up</button>
      <button data-world-move="left">left</button>
      <button data-world-move="down">down</button>
      <button data-world-move="right">right</button>
      <pre data-world-canvas></pre>
      <section><ul data-world-users></ul></section>
      <section>
        <form data-world-chat-form>
          <input data-world-chat-input />
        </form>
        <ul data-world-chat></ul>
      </section>
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

  it('sanitizes chat messages including empty values and max length', () => {
    expect(sanitizeChatMessage('  hello there  ')).toBe('hello there');
    expect(sanitizeChatMessage(undefined)).toBe('');
    expect(sanitizeChatMessage('x'.repeat(500)).length).toBe(240);
  });

  it('sanitizes avatar options for admin and non-admin flows', () => {
    const nonAdmin = sanitizeAvatar(
      {
        character: ' A ',
        colorKey: 'FREE',
        freeColor: '#00ff00',
        font: 'serif',
        fontWeight: 'bold',
        shape: 'circle',
        size: 4
      },
      { isAdmin: false, fallbackCharacter: '@' }
    );
    expect(nonAdmin).toMatchObject({
      character: 'A',
      colorKey: 'PINK',
      shape: 'square',
      size: 1
    });

    const admin = sanitizeAvatar(
      {
        character: ' Z ',
        colorKey: 'FREE',
        freeColor: '#00ff00',
        font: 'invalid',
        fontWeight: 'invalid',
        shape: 'circle',
        size: 4
      },
      { isAdmin: true, fallbackCharacter: '@' }
    );

    expect(admin).toMatchObject({
      character: 'Z',
      colorKey: 'FREE',
      colorValue: '#00ff00',
      font: 'monospace',
      fontWeight: '700',
      shape: 'circle',
      size: 4
    });

    expect(sanitizeAvatarColor('R', '', false).colorValue).toBe('#ef4444');
  });

  it('preserves full unicode code points for avatar characters', () => {
    const adminAvatar = sanitizeAvatar(
      {
        character: '🍼',
        colorKey: 'PINK'
      },
      { isAdmin: true, fallbackCharacter: '@' }
    );

    expect(adminAvatar.character).toBe('🍼');
    expect(sanitizeAvatar({ character: '  👶  ' }, { isAdmin: false, fallbackCharacter: '@' }).character).toBe('👶');
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
    expect(viewer.avatar.character).toBe('@');
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
      viewer: { x: 1, y: 0, character: '*', avatar: { character: '*' }, id: '1', name: 'N' }
    });

    expect(canvas).toBe('.*.\n...');
  });

  it('renders unicode avatar characters in the ascii canvas', () => {
    const canvas = renderAsciiCanvas({
      world: { width: 2, height: 2 },
      viewer: { x: 0, y: 1, character: '?', avatar: { character: '🍼' }, id: '1', name: 'N' }
    });

    expect(canvas).toBe('..\n🍼.');
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

  it('initializes through world-client and supports movement, avatar customization, admin auth, users panel, and chat', async () => {
    mountWorldDom({
      world: { width: 5, height: 5 },
      viewer: { id: '1', character: '&', name: 'Comet', x: 1, y: 1 }
    });

    const serverMessages = [];
    const fetchMock = vi.fn(async (url, options) => {
      if (url.endsWith('/world/admin-auth')) {
        const payload = JSON.parse(options.body);
        return {
          ok: true,
          async json() {
            return { authorized: payload.password === 'correct' };
          }
        };
      }

      const payload = JSON.parse(options.body);

      if (payload.chatMessage) {
        serverMessages.push({ id: `m-${serverMessages.length + 1}`, name: payload.viewer.name, text: payload.chatMessage });
      }

      return {
        ok: true,
        async json() {
          return {
            percentage: 100,
            contents: 'synced-map',
            isAdmin: Boolean(payload.viewer.isAdmin),
            users: [
              {
                id: payload.viewer.id,
                name: payload.viewer.name,
                character: payload.viewer.character,
                avatar: payload.viewer.avatar,
                isAdmin: Boolean(payload.viewer.isAdmin),
                x: payload.viewer.x,
                y: payload.viewer.y
              }
            ],
            messages: [...serverMessages]
          };
        }
      };
    });

    vi.stubGlobal('fetch', fetchMock);

    const controller = initWorld(document);
    const status = document.querySelector('[data-world-status]');
    const canvas = document.querySelector('[data-world-canvas]');
    const nameInput = document.querySelector('[data-world-name]');
    const signals = document.querySelector('[data-world-signals]');
    const usersList = document.querySelector('[data-world-users]');
    const chatForm = document.querySelector('[data-world-chat-form]');
    const chatInput = document.querySelector('[data-world-chat-input]');
    const chatList = document.querySelector('[data-world-chat]');
    const adminForm = document.querySelector('[data-world-admin-form]');
    const adminInput = document.querySelector('[data-world-admin-input]');
    const adminStatus = document.querySelector('[data-world-admin-status]');
    const avatarShape = document.querySelector('[data-avatar-shape]');
    const avatarColor = document.querySelector('[data-avatar-color]');
    const avatarFreeColor = document.querySelector('[data-avatar-free-color]');
    const avatarFontWeight = document.querySelector('[data-avatar-font-weight]');
    const avatarSize = document.querySelector('[data-avatar-size]');
    const avatarCharacter = document.querySelector('[data-avatar-character]');
    const avatarFont = document.querySelector('[data-avatar-font]');

    expect(status.textContent).toContain('Comet (&) at [1, 1]');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(canvas.textContent).toBe('synced-map');
    expect(avatarShape.disabled).toBe(true);

    fireEvent.click(document.querySelector('[data-world-move="up"]'));
    expect(status.textContent).toContain('[1, 0]');
    fireEvent.keyDown(document, { key: 'a' });
    expect(status.textContent).toContain('[0, 0]');

    fireEvent.input(nameInput, { target: { value: '  Aurora  ' } });
    expect(status.textContent).toContain('Aurora (&)');
    fireEvent.input(avatarCharacter, { target: { value: '$' } });
    fireEvent.change(avatarFont, { target: { value: 'serif' } });

    fireEvent.submit(chatForm);
    fireEvent.input(chatInput, { target: { value: ' Hello everyone! ' } });
    fireEvent.submit(chatForm);

    fireEvent.input(adminInput, { target: { value: 'wrong' } });
    fireEvent.submit(adminForm);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(adminStatus.textContent).toContain('failed');

    fireEvent.input(adminInput, { target: { value: 'correct' } });
    fireEvent.submit(adminForm);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(adminStatus.textContent).toContain('enabled');
    expect(avatarShape.disabled).toBe(false);

    fireEvent.input(avatarFreeColor, { target: { value: '#123abc' } });
    fireEvent.change(avatarColor, { target: { value: 'FREE' } });
    fireEvent.input(avatarFreeColor, { target: { value: '#123abc' } });
    fireEvent.change(avatarFontWeight, { target: { value: 'bold' } });
    fireEvent.change(avatarShape, { target: { value: 'circle' } });
    fireEvent.change(avatarSize, { target: { value: '3' } });

    controller.rename('');
    expect(status.textContent).toContain('Starling ($)');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const signalPayload = JSON.parse(signals.dataset.signals);
    expect(signalPayload._percentage).toBe(100);
    expect(signalPayload._admin).toBe(true);
    expect(signalPayload._avatar.shape).toBe('circle');
    expect(signalPayload._avatar.fontWeight).toBe('bold');
    expect(signalPayload._avatar.size).toBe(3);
    expect(signalPayload._avatar.colorValue).toBe('#123abc');
    expect(usersList.textContent).toContain('ADMIN');
    expect(chatList.textContent).toContain('Aurora: Hello everyone!');

    controller.move('right');
    expect(controller.getState().viewer.x).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws when bootstrap payload is missing', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => initWorld(document)).toThrow('Missing world bootstrap payload.');
  });

  it('marks sync complete locally when fetch is unavailable and auth cannot be used', async () => {
    mountWorldDom({
      world: { width: 5, height: 5 },
      viewer: { id: '1', character: '&', name: 'Comet', x: 1, y: 1 }
    });

    vi.stubGlobal('fetch', undefined);
    initWorld(document);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const signals = document.querySelector('[data-world-signals]');
    expect(JSON.parse(signals.dataset.signals)._percentage).toBe(100);

    fireEvent.submit(document.querySelector('[data-world-admin-form]'));
    expect(document.querySelector('[data-world-admin-status]').textContent).toContain('unavailable');
  });
});

describe('createWorldSync and auth request', () => {
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
      contents: '..',
      users: [],
      messages: [],
      isAdmin: undefined
    });
  });

  it('parses users and chat messages arrays and handles non-numeric percentage', async () => {
    const sync = createWorldSync({
      url: '/world/updates',
      fetchFn: async () => ({
        ok: true,
        async json() {
          return {
            percentage: 'not-a-number',
            contents: 'map',
            users: [{ id: 'v1' }],
            messages: [{ id: 'm1' }],
            isAdmin: true
          };
        }
      })
    });

    await expect(sync({ contents: '..' })).resolves.toEqual({
      percentage: 0,
      contents: 'map',
      users: [{ id: 'v1' }],
      messages: [{ id: 'm1' }],
      isAdmin: true
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

  it('auth request returns false on errors and only true on explicit true payload', async () => {
    const auth = createAdminAuthRequest({
      url: '/world/admin-auth',
      fetchFn: async () => ({
        ok: true,
        async json() {
          return { authorized: true };
        }
      })
    });

    const nonOk = createAdminAuthRequest({
      url: '/world/admin-auth',
      fetchFn: async () => ({ ok: false })
    });

    const throwing = createAdminAuthRequest({
      url: '/world/admin-auth',
      fetchFn: async () => {
        throw new Error('boom');
      }
    });

    const explicitFalse = createAdminAuthRequest({
      url: '/world/admin-auth',
      fetchFn: async () => ({
        ok: true,
        async json() {
          return { authorized: 'yes' };
        }
      })
    });

    await expect(auth({})).resolves.toEqual({ authorized: true });
    await expect(nonOk({})).resolves.toEqual({ authorized: false });
    await expect(throwing({})).resolves.toEqual({ authorized: false });
    await expect(explicitFalse({})).resolves.toEqual({ authorized: false });
  });
});
