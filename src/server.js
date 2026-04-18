import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  assignViewerCharacter,
  clamp,
  createWorldConfig,
  sanitizeChatMessage,
  sanitizeName
} from './world.js';

const STALE_VIEWER_MS = 120_000;
const MAX_CHAT_MESSAGES = 30;

function worldPageTemplate({ viewer, world }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Milky Baby Daycare World</title>
    <link rel="stylesheet" href="/src/site.css" />
  </head>
  <body>
    <main class="container" data-app-root>
      <h1>Milky Baby Daycare World</h1>
      <p class="subtitle">Move with WASD, arrow keys, or click controls.</p>

      <label
        data-world-signals
        data-world-updates-url="/world/updates"
        data-signals='{"_percentage":100,"_contents":"loading...","_name":"${viewer.name}","_character":"${viewer.character}","_users":[],"_messages":[]}'
        data-init="@get('/world/updates')"
      >
        <span data-text="\`Synced: \${$_percentage.toFixed(2)}%\`">Synced: 100.00%</span>
      </label>

      <label>
        Your name
        <input type="text" maxlength="24" data-world-name value="${viewer.name}" />
      </label>

      <p data-world-status aria-live="polite"></p>

      <section class="button-row" aria-label="Movement controls">
        <button type="button" data-world-move="up">Up</button>
        <button type="button" data-world-move="left">Left</button>
        <button type="button" data-world-move="down">Down</button>
        <button type="button" data-world-move="right">Right</button>
      </section>

      <pre style="line-height: 100%" data-world-canvas data-text="$_contents"></pre>

      <section aria-label="Online users">
        <h2>Online users</h2>
        <ul data-world-users></ul>
      </section>

      <section aria-label="World chat">
        <h2>Chat</h2>
        <form data-world-chat-form>
          <input type="text" maxlength="240" placeholder="Say hi to everyone..." data-world-chat-input />
          <button type="submit">Send</button>
        </form>
        <ul data-world-chat></ul>
      </section>

      <script type="application/json" data-world-bootstrap>${JSON.stringify({ viewer, world })}</script>
    </main>

    <script type="module" src="https://cdn.jsdelivr.net/npm/@sudodevnull/datastar"></script>
    <script type="module" src="/src/world-client.js"></script>
    <script type="module">
      import { initWorld } from '/src/world-client.js';
      initWorld(document);
    </script>
  </body>
</html>`;
}

function renderWorldFromViewers(world, viewers) {
  const grid = Array.from({ length: world.height }, () => Array.from({ length: world.width }, () => '.'));

  viewers.forEach((viewer) => {
    grid[viewer.y][viewer.x] = viewer.character;
  });

  return grid.map((row) => row.join('')).join('\n');
}

function createWorldRuntime({ random, now }) {
  const world = createWorldConfig();
  const viewers = new Map();
  const chatMessages = [];

  function pruneStaleViewers() {
    const cutoff = now() - STALE_VIEWER_MS;
    viewers.forEach((viewer, id) => {
      if (viewer.lastSeenAt < cutoff) {
        viewers.delete(id);
      }
    });
  }

  function upsertViewer(rawViewer) {
    if (!rawViewer || typeof rawViewer.id !== 'string' || !rawViewer.id.trim()) {
      return null;
    }

    const viewer = {
      id: rawViewer.id,
      character: typeof rawViewer.character === 'string' && rawViewer.character.length > 0 ? rawViewer.character[0] : assignViewerCharacter(random),
      name: sanitizeName(rawViewer.name),
      x: clamp(Number.isFinite(rawViewer.x) ? rawViewer.x : 0, 0, world.width - 1),
      y: clamp(Number.isFinite(rawViewer.y) ? rawViewer.y : 0, 0, world.height - 1),
      lastSeenAt: now()
    };

    viewers.set(viewer.id, viewer);
    return viewer;
  }

  function addChatMessage(rawViewer, rawMessage) {
    const text = sanitizeChatMessage(rawMessage);

    if (!text) {
      return;
    }

    chatMessages.push({
      id: randomUUID(),
      name: sanitizeName(rawViewer?.name),
      text
    });

    if (chatMessages.length > MAX_CHAT_MESSAGES) {
      chatMessages.splice(0, chatMessages.length - MAX_CHAT_MESSAGES);
    }
  }

  function createSnapshot() {
    pruneStaleViewers();

    const activeUsers = [...viewers.values()].map((viewer) => ({
      id: viewer.id,
      name: viewer.name,
      character: viewer.character,
      x: viewer.x,
      y: viewer.y
    }));

    return {
      percentage: 100,
      contents: renderWorldFromViewers(world, activeUsers),
      users: activeUsers,
      messages: [...chatMessages]
    };
  }

  return {
    world,
    registerViewer() {
      const viewer = {
        id: randomUUID(),
        character: assignViewerCharacter(random),
        name: 'Starling',
        x: 0,
        y: 0,
        lastSeenAt: now()
      };

      viewers.set(viewer.id, viewer);
      return viewer;
    },
    applyUpdate(body) {
      const hasRequiredPayload = body?.viewer && body?.world && typeof body?.contents === 'string';

      if (!hasRequiredPayload) {
        return {
          percentage: 0,
          contents: 'Sync error. Client payload incomplete.',
          users: [],
          messages: []
        };
      }

      const viewer = upsertViewer(body.viewer);

      if (!viewer) {
        return {
          percentage: 0,
          contents: 'Sync error. Viewer payload invalid.',
          users: [],
          messages: []
        };
      }

      addChatMessage(viewer, body.chatMessage);
      return createSnapshot();
    },
    snapshot() {
      return createSnapshot();
    }
  };
}

export function createServer({ random = Math.random, now } = {}) {
  const app = express();
  const runtime = createWorldRuntime({ random, now: typeof now === 'function' ? now : Date.now });

  app.use(express.json());
  app.use('/src', express.static('src'));

  app.get('/', (_req, res) => {
    res.sendFile('index.html', { root: process.cwd() });
  });

  app.get('/world', (_req, res) => {
    const viewer = runtime.registerViewer();
    res.type('html').send(worldPageTemplate({ viewer, world: runtime.world }));
  });

  app.get('/world/updates', (_req, res) => {
    res.json(runtime.snapshot());
  });

  app.post('/world/updates', (req, res) => {
    res.json(runtime.applyUpdate(req.body));
  });

  return app;
}
