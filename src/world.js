const MIN_BOARD_SIZE = 5;
const MAX_BOARD_SIZE = 120;
const MAX_NAME_LENGTH = 24;
const MAX_CHAT_LENGTH = 240;
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

export function createWorldConfig({ width, height } = {}) {
  return {
    width: normalizeBoardSize(width, DEFAULT_WORLD.width),
    height: normalizeBoardSize(height, DEFAULT_WORLD.height)
  };
}

export function createViewerState({
  id,
  character,
  name = DEFAULT_WORLD.baseName,
  x = DEFAULT_WORLD.startX,
  y = DEFAULT_WORLD.startY,
  world = createWorldConfig()
}) {
  const safeCharacter = typeof character === 'string' && character.length > 0 ? character[0] : '@';

  return {
    id: id || `viewer-${Date.now()}`,
    character: safeCharacter,
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

  for (let y = 0; y < world.height; y += 1) {
    let row = '';

    for (let x = 0; x < world.width; x += 1) {
      row += x === viewer.x && y === viewer.y ? viewer.character : '.';
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
    item.textContent = `${user.name} (${user.character}) @ [${user.x}, ${user.y}]`;
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

export function createWorldController({ doc, initialViewer, world }) {
  const state = {
    viewer: createViewerState({ ...initialViewer, world }),
    world,
    syncPercentage: 0,
    users: [],
    messages: []
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

  if (!canvas || !status || !nameInput || controls.length === 0 || !signalRoot || !usersList || !chatList || !chatForm || !chatInput) {
    throw new Error('World UI is missing required elements.');
  }

  const syncState =
    typeof doc.defaultView?.fetch === 'function'
      ? createWorldSync({
          fetchFn: doc.defaultView.fetch.bind(doc.defaultView),
          url: signalRoot.dataset.worldUpdatesUrl ?? '/world/updates'
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
      _messages: state.messages
    });
  }

  function refreshPanels() {
    renderOnlineUsers(usersList, state.users);
    renderChatMessages(chatList, state.messages);
  }

  function render() {
    canvas.textContent = renderAsciiCanvas(state);
    status.textContent = `${state.viewer.name} (${state.viewer.character}) at [${state.viewer.x}, ${state.viewer.y}]`;
    nameInput.value = state.viewer.name;
    refreshPanels();
    syncSignals();
    void syncWithServer();
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

    refreshPanels();
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
        viewer: { ...state.viewer },
        world: { ...state.world },
        users: [...state.users],
        messages: [...state.messages]
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
        messages: Array.isArray(parsed.messages) ? parsed.messages : []
      };
    } catch {
      return { percentage: 0 };
    }
  };
}
