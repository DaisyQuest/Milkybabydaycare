const MIN_BOARD_SIZE = 5;
const MAX_BOARD_SIZE = 120;
const MAX_NAME_LENGTH = 24;
const MAX_CHAT_LENGTH = 240;
const FONT_OPTIONS = ['monospace', 'serif', 'sans-serif', 'cursive', 'fantasy'];
const FONT_WEIGHT_OPTIONS = ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const AVATAR_SHAPES = ['square', 'circle', 'diamond', 'star'];
const AVATAR_COLOR_PRESETS = {
  R: '#ef4444',
  G: '#22c55e',
  B: '#3b82f6',
  Y: '#eab308',
  PINK: '#ec4899'
};
const DEFAULT_WORLD = {
  width: 48,
  height: 24,
  baseName: 'Starling',
  startX: 0,
  startY: 0
};

export function clamp(value, min, max) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function normalizeBoardSize(raw, fallback) {
  const size = Number.parseInt(raw, 10);

  if (Number.isNaN(size)) {
    return fallback;
  }

  return clamp(size, MIN_BOARD_SIZE, MAX_BOARD_SIZE);
}

export function sanitizeName(rawName, fallback = DEFAULT_WORLD.baseName) {
  const value = typeof rawName === 'string' ? rawName.trim() : '';

  if (!value) {
    return fallback;
  }

  return value.slice(0, MAX_NAME_LENGTH);
}

export function sanitizeChatMessage(rawMessage) {
  const value = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  return value.slice(0, MAX_CHAT_LENGTH);
}

export function assignViewerCharacter(random = Math.random) {
  const ascii = '!@#$%^&*+=?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const index = Math.floor(random() * ascii.length);
  return ascii[index] ?? '@';
}

export function sanitizeAvatarCharacter(rawCharacter, fallback = '@') {
  const value = typeof rawCharacter === 'string' ? rawCharacter.trim() : '';
  return value ? Array.from(value)[0] : fallback;
}

export function sanitizeAvatarFont(rawFont) {
  return FONT_OPTIONS.includes(rawFont) ? rawFont : 'monospace';
}

export function sanitizeAvatarFontWeight(rawWeight) {
  return FONT_WEIGHT_OPTIONS.includes(rawWeight) ? rawWeight : '700';
}

export function sanitizeAvatarShape(rawShape, isAdmin = false) {
  if (!isAdmin) {
    return 'square';
  }

  return AVATAR_SHAPES.includes(rawShape) ? rawShape : 'square';
}

export function sanitizeAvatarSize(rawSize, isAdmin = false) {
  if (!isAdmin) {
    return 1;
  }

  const parsed = Number.parseInt(rawSize, 10);

  if (Number.isNaN(parsed)) {
    return 1;
  }

  return clamp(parsed, 1, 5);
}

function isSafeCssColor(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';

  if (!candidate || candidate.length > 32) {
    return false;
  }

  if (/^#[0-9a-f]{3,8}$/i.test(candidate)) {
    return true;
  }

  if (/^rgb(a)?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(candidate)) {
    return true;
  }

  return /^[a-z]+$/i.test(candidate);
}

export function sanitizeAvatarColor(rawColor, rawFreeColor, isAdmin = false) {
  const presetKey = typeof rawColor === 'string' ? rawColor.toUpperCase() : '';

  if (AVATAR_COLOR_PRESETS[presetKey]) {
    return {
      colorKey: presetKey,
      colorValue: AVATAR_COLOR_PRESETS[presetKey]
    };
  }

  if (isAdmin && presetKey === 'FREE') {
    return {
      colorKey: 'FREE',
      colorValue: isSafeCssColor(rawFreeColor) ? rawFreeColor.trim() : AVATAR_COLOR_PRESETS.PINK
    };
  }

  return {
    colorKey: 'PINK',
    colorValue: AVATAR_COLOR_PRESETS.PINK
  };
}

export function sanitizeAvatar(rawAvatar = {}, { isAdmin = false, fallbackCharacter = '@' } = {}) {
  const safeCharacter = sanitizeAvatarCharacter(rawAvatar.character, fallbackCharacter);
  const color = sanitizeAvatarColor(rawAvatar.colorKey, rawAvatar.freeColor, isAdmin);

  return {
    character: safeCharacter,
    font: sanitizeAvatarFont(rawAvatar.font),
    colorKey: color.colorKey,
    colorValue: color.colorValue,
    freeColor: color.colorKey === 'FREE' ? color.colorValue : '',
    fontWeight: sanitizeAvatarFontWeight(rawAvatar.fontWeight),
    shape: sanitizeAvatarShape(rawAvatar.shape, isAdmin),
    size: sanitizeAvatarSize(rawAvatar.size, isAdmin)
  };
}

export function createWorldConfig({ width, height } = {}) {
  return {
    width: normalizeBoardSize(width, DEFAULT_WORLD.width),
    height: normalizeBoardSize(height, DEFAULT_WORLD.height)
  };
}

export function createViewerState({
  id,
  character,
  avatar,
  name = DEFAULT_WORLD.baseName,
  x = DEFAULT_WORLD.startX,
  y = DEFAULT_WORLD.startY,
  world = createWorldConfig(),
  isAdmin = false
}) {
  const safeCharacter = sanitizeAvatarCharacter(character, '@');
  const safeAvatar = sanitizeAvatar({ ...avatar, character: avatar?.character ?? safeCharacter }, { isAdmin, fallbackCharacter: safeCharacter });

  return {
    id: id || `viewer-${Date.now()}`,
    character: safeAvatar.character,
    avatar: safeAvatar,
    isAdmin,
    name: sanitizeName(name),
    x: clamp(Number.isFinite(x) ? x : DEFAULT_WORLD.startX, 0, world.width - 1),
    y: clamp(Number.isFinite(y) ? y : DEFAULT_WORLD.startY, 0, world.height - 1)
  };
}

export function nextPosition(state, intent, world) {
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  const movement = directions[intent];

  if (!movement) {
    return { x: state.x, y: state.y };
  }

  return {
    x: clamp(state.x + movement.x, 0, world.width - 1),
    y: clamp(state.y + movement.y, 0, world.height - 1)
  };
}

export function moveViewer(state, intent, world) {
  const next = nextPosition(state, intent, world);
  return {
    ...state,
    ...next
  };
}

export function renderAsciiCanvas({ viewer, world }) {
  const rows = [];
  const character = viewer.avatar?.character ?? viewer.character;

  for (let y = 0; y < world.height; y += 1) {
    let row = '';

    for (let x = 0; x < world.width; x += 1) {
      row += x === viewer.x && y === viewer.y ? character : '.';
    }

    rows.push(row);
  }

  return rows.join('\n');
}

function intentFromKeyboard(key) {
  const normalized = String(key).toLowerCase();
  const map = {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
    arrowup: 'up',
    arrowleft: 'left',
    arrowdown: 'down',
    arrowright: 'right'
  };

  return map[normalized] ?? null;
}

function renderOnlineUsers(target, users) {
  target.textContent = '';

  users.forEach((user) => {
    const item = target.ownerDocument.createElement('li');
    const role = user.isAdmin ? 'ADMIN' : 'PLAYER';
    item.textContent = `${user.name} (${user.avatar?.character ?? user.character}) @ [${user.x}, ${user.y}] • ${role}`;
    target.append(item);
  });
}

function renderChatMessages(target, messages) {
  target.textContent = '';

  messages.forEach((message) => {
    const item = target.ownerDocument.createElement('li');
    item.textContent = `${message.name}: ${message.text}`;
    target.append(item);
  });
}

function applyAvatarPreview(preview, viewer) {
  preview.textContent = viewer.avatar.character;
  preview.style.fontFamily = viewer.avatar.font;
  preview.style.fontWeight = viewer.avatar.fontWeight;
  preview.style.color = viewer.avatar.colorValue;
  preview.dataset.shape = viewer.avatar.shape;
  preview.dataset.size = String(viewer.avatar.size);
}

export function createWorldController({ doc, initialViewer, world }) {
  const state = {
    viewer: createViewerState({ ...initialViewer, world }),
    world,
    syncPercentage: 0,
    users: [],
    messages: [],
    adminAuthorized: Boolean(initialViewer?.isAdmin)
  };

  const canvas = doc.querySelector('[data-world-canvas]');
  const status = doc.querySelector('[data-world-status]');
  const nameInput = doc.querySelector('[data-world-name]');
  const controls = [...doc.querySelectorAll('[data-world-move]')];
  const signalRoot = doc.querySelector('[data-world-signals]');
  const usersList = doc.querySelector('[data-world-users]');
  const chatList = doc.querySelector('[data-world-chat]');
  const chatForm = doc.querySelector('[data-world-chat-form]');
  const chatInput = doc.querySelector('[data-world-chat-input]');
  const adminForm = doc.querySelector('[data-world-admin-form]');
  const adminInput = doc.querySelector('[data-world-admin-input]');
  const adminStatus = doc.querySelector('[data-world-admin-status]');
  const avatarCharacter = doc.querySelector('[data-avatar-character]');
  const avatarFont = doc.querySelector('[data-avatar-font]');
  const avatarColor = doc.querySelector('[data-avatar-color]');
  const avatarFreeColor = doc.querySelector('[data-avatar-free-color]');
  const avatarFontWeight = doc.querySelector('[data-avatar-font-weight]');
  const avatarShape = doc.querySelector('[data-avatar-shape]');
  const avatarSize = doc.querySelector('[data-avatar-size]');
  const avatarPreview = doc.querySelector('[data-avatar-preview]');
  const adminOnlyControls = [...doc.querySelectorAll('[data-admin-only]')];

  if (
    !canvas ||
    !status ||
    !nameInput ||
    controls.length === 0 ||
    !signalRoot ||
    !usersList ||
    !chatList ||
    !chatForm ||
    !chatInput ||
    !adminForm ||
    !adminInput ||
    !adminStatus ||
    !avatarCharacter ||
    !avatarFont ||
    !avatarColor ||
    !avatarFreeColor ||
    !avatarFontWeight ||
    !avatarShape ||
    !avatarSize ||
    !avatarPreview
  ) {
    throw new Error('World UI is missing required elements.');
  }

  const syncState =
    typeof doc.defaultView?.fetch === 'function'
      ? createWorldSync({
          fetchFn: doc.defaultView.fetch.bind(doc.defaultView),
          url: signalRoot.dataset.worldUpdatesUrl ?? '/world/updates'
        })
      : null;

  const authState =
    typeof doc.defaultView?.fetch === 'function'
      ? createAdminAuthRequest({
          fetchFn: doc.defaultView.fetch.bind(doc.defaultView),
          url: signalRoot.dataset.worldAdminAuthUrl ?? '/world/admin-auth'
        })
      : null;

  function syncSignals() {
    signalRoot.dataset.signals = JSON.stringify({
      _percentage: state.syncPercentage,
      _contents: canvas.textContent,
      _name: state.viewer.name,
      _character: state.viewer.character,
      _x: state.viewer.x,
      _y: state.viewer.y,
      _users: state.users,
      _messages: state.messages,
      _admin: state.adminAuthorized,
      _avatar: state.viewer.avatar
    });
  }

  function refreshPanels() {
    renderOnlineUsers(usersList, state.users);
    renderChatMessages(chatList, state.messages);
  }

  function refreshAvatarControls() {
    avatarCharacter.value = state.viewer.avatar.character;
    avatarFont.value = state.viewer.avatar.font;
    avatarColor.value = state.viewer.avatar.colorKey;
    avatarFreeColor.value = state.viewer.avatar.freeColor;
    avatarFontWeight.value = state.viewer.avatar.fontWeight;
    avatarShape.value = state.viewer.avatar.shape;
    avatarSize.value = String(state.viewer.avatar.size);

    const adminDisabled = !state.adminAuthorized;
    adminOnlyControls.forEach((control) => {
      control.disabled = adminDisabled;
    });

    avatarFreeColor.disabled = adminDisabled || state.viewer.avatar.colorKey !== 'FREE';
    applyAvatarPreview(avatarPreview, state.viewer);
  }

  function render() {
    canvas.textContent = renderAsciiCanvas(state);
    status.textContent = `${state.viewer.name} (${state.viewer.character}) at [${state.viewer.x}, ${state.viewer.y}]`;
    nameInput.value = state.viewer.name;
    refreshPanels();
    refreshAvatarControls();
    syncSignals();
    void syncWithServer();
  }

  function applyAvatar(raw) {
    state.viewer = {
      ...state.viewer,
      avatar: sanitizeAvatar({ ...state.viewer.avatar, ...raw }, { isAdmin: state.adminAuthorized, fallbackCharacter: state.viewer.character })
    };
    state.viewer.character = state.viewer.avatar.character;
    render();
  }

  async function syncWithServer(chatMessage = '') {
    if (!syncState) {
      state.syncPercentage = 100;
      syncSignals();
      return;
    }

    const result = await syncState({
      viewer: state.viewer,
      world: state.world,
      contents: canvas.textContent,
      chatMessage
    });

    state.syncPercentage = result.percentage;

    if (typeof result.contents === 'string') {
      canvas.textContent = result.contents;
    }

    if (Array.isArray(result.users)) {
      state.users = result.users;
    }

    if (Array.isArray(result.messages)) {
      state.messages = result.messages;
    }

    if (typeof result.isAdmin === 'boolean') {
      state.adminAuthorized = result.isAdmin;
      state.viewer.isAdmin = result.isAdmin;
      state.viewer.avatar = sanitizeAvatar(state.viewer.avatar, {
        isAdmin: result.isAdmin,
        fallbackCharacter: state.viewer.character
      });
      state.viewer.character = state.viewer.avatar.character;
    }

    refreshPanels();
    refreshAvatarControls();
    syncSignals();
  }

  function move(intent) {
    state.viewer = moveViewer(state.viewer, intent, state.world);
    render();
  }

  controls.forEach((control) => {
    control.addEventListener('click', () => {
      move(control.dataset.worldMove);
    });
  });

  doc.addEventListener('keydown', (event) => {
    const intent = intentFromKeyboard(event.key);

    if (intent) {
      event.preventDefault();
      move(intent);
    }
  });

  nameInput.addEventListener('input', () => {
    state.viewer = {
      ...state.viewer,
      name: sanitizeName(nameInput.value)
    };
    render();
  });

  avatarCharacter.addEventListener('input', () => {
    applyAvatar({ character: avatarCharacter.value });
  });

  avatarFont.addEventListener('change', () => {
    applyAvatar({ font: avatarFont.value });
  });

  avatarColor.addEventListener('change', () => {
    applyAvatar({ colorKey: avatarColor.value, freeColor: avatarFreeColor.value });
  });

  avatarFreeColor.addEventListener('input', () => {
    applyAvatar({ colorKey: avatarColor.value, freeColor: avatarFreeColor.value });
  });

  avatarFontWeight.addEventListener('change', () => {
    applyAvatar({ fontWeight: avatarFontWeight.value });
  });

  avatarShape.addEventListener('change', () => {
    applyAvatar({ shape: avatarShape.value });
  });

  avatarSize.addEventListener('change', () => {
    applyAvatar({ size: avatarSize.value });
  });

  adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!authState) {
      adminStatus.textContent = 'Admin authentication unavailable in this environment.';
      return;
    }

    const password = String(adminInput.value ?? '');
    adminInput.value = '';

    const result = await authState({ viewerId: state.viewer.id, password });
    state.adminAuthorized = result.authorized;
    state.viewer.isAdmin = result.authorized;
    adminStatus.textContent = result.authorized
      ? 'Admin mode enabled. Advanced avatar controls unlocked.'
      : 'Admin authentication failed.';
    render();
  });

  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = sanitizeChatMessage(chatInput.value);

    if (!message) {
      return;
    }

    chatInput.value = '';
    void syncWithServer(message);
  });

  render();

  return {
    getState() {
      return {
        viewer: { ...state.viewer, avatar: { ...state.viewer.avatar } },
        world: { ...state.world },
        users: [...state.users],
        messages: [...state.messages],
        adminAuthorized: state.adminAuthorized
      };
    },
    move,
    rename(name) {
      state.viewer = {
        ...state.viewer,
        name: sanitizeName(name)
      };
      render();
    },
    render
  };
}

export function createWorldSync({ fetchFn, url }) {
  return async function sync(payload) {
    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return { percentage: 0 };
      }

      const parsed = await response.json();
      return {
        percentage: clamp(Number(parsed.percentage) || 0, 0, 100),
        contents: typeof parsed.contents === 'string' ? parsed.contents : payload.contents,
        users: Array.isArray(parsed.users) ? parsed.users : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        isAdmin: typeof parsed.isAdmin === 'boolean' ? parsed.isAdmin : undefined
      };
    } catch {
      return { percentage: 0 };
    }
  };
}

export function createAdminAuthRequest({ fetchFn, url }) {
  return async function authorize(payload) {
    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return { authorized: false };
      }

      const parsed = await response.json();
      return { authorized: parsed?.authorized === true };
    } catch {
      return { authorized: false };
    }
  };
}
