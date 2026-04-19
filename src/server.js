import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  assignViewerCharacter,
  clamp,
  createWorldConfig,
  sanitizeAvatar,
  sanitizeChatMessage,
  sanitizeName
} from './world.js';
import { collectSystemMetrics, systemMonitorPageTemplate } from './system-monitor.js';
import { createMemeService } from './meme-service.js';

const STALE_VIEWER_MS = 120_000;
const MAX_CHAT_MESSAGES = 30;
const MAX_ADMIN_ATTEMPTS = 5;
const ADMIN_BLOCK_MS = 60_000;
const DEFAULT_ADMIN_PASSWORD = 'bicassdooandyou';

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
        data-world-admin-auth-url="/world/admin-auth"
        data-signals='{"_percentage":100,"_contents":"loading...","_name":"${viewer.name}","_character":"${viewer.character}","_users":[],"_messages":[],"_admin":false}'
        data-init="@get('/world/updates')"
      >
        <span data-text="\`Synced: \${$_percentage.toFixed(2)}%\`">Synced: 100.00%</span>
      </label>

      <label>
        Your name
        <input type="text" maxlength="24" data-world-name value="${viewer.name}" />
      </label>

      <section class="admin-auth" aria-label="Admin authentication">
        <h2>Admin Auth</h2>
        <form data-world-admin-form>
          <label>
            Admin password
            <input type="password" autocomplete="off" data-world-admin-input />
          </label>
          <button type="submit">Unlock Admin</button>
        </form>
        <p data-world-admin-status aria-live="polite">Admin features are locked.</p>
      </section>

      <section class="avatar-customization" aria-label="Avatar customization">
        <h2>Avatar Customization</h2>
        <label>
          CHARACTER
          <input type="text" data-avatar-character value="${viewer.character}" />
        </label>
        <label>
          FONT
          <select data-avatar-font>
            <option value="monospace">Monospace</option>
            <option value="serif">Serif</option>
            <option value="sans-serif">Sans-serif</option>
            <option value="cursive">Cursive</option>
            <option value="fantasy">Fantasy</option>
          </select>
        </label>
        <label>
          COLOR (R, G, B, Y, PINK)
          <select data-avatar-color>
            <option value="R">R</option>
            <option value="G">G</option>
            <option value="B">B</option>
            <option value="Y">Y</option>
            <option value="PINK" selected>PINK</option>
            <option value="FREE" data-admin-only>FREE</option>
          </select>
        </label>
        <label>
          COLOR (FREE) - ADMIN
          <input type="text" placeholder="#c0ffee" data-avatar-free-color data-admin-only />
        </label>
        <label>
          FONT WEIGHT
          <select data-avatar-font-weight>
            <option value="300">300</option>
            <option value="400">400</option>
            <option value="500">500</option>
            <option value="700" selected>700</option>
            <option value="900">900</option>
            <option value="normal">normal</option>
            <option value="bold">bold</option>
          </select>
        </label>
        <label>
          AVATAR SHAPE - ADMIN
          <select data-avatar-shape data-admin-only>
            <option value="square">square</option>
            <option value="circle">circle</option>
            <option value="diamond">diamond</option>
            <option value="star">star</option>
          </select>
        </label>
        <label>
          AVATAR SIZE - ADMIN
          <input type="number" min="1" max="5" step="1" value="1" data-avatar-size data-admin-only />
        </label>
        <p>Preview: <span class="avatar-preview" data-avatar-preview data-shape="square" data-size="1">${viewer.character}</span></p>
      </section>

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
    grid[viewer.y][viewer.x] = viewer.avatar.character;
  });

  return grid.map((row) => row.join('')).join('\n');
}



function memePageTemplate(meme) {
  const payload = JSON.stringify(meme.config);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Milky Baby Meme</title>
    <link rel="stylesheet" href="/src/site.css" />
  </head>
  <body class="meme-body">
    <main class="meme-composition">
      <section class="meme-hero">
        <p class="meme-brand">Milky Baby Meme</p>
        <h1>Your meme is live for 48 hours.</h1>
        <p class="meme-support">Share this URL before it expires at ${new Date(meme.expiresAt).toISOString()}.</p>
      </section>
      <section class="meme-preview-wrap">
        <canvas data-meme-view aria-label="Rendered meme"></canvas>
      </section>
    </main>
    <script type="module">
      import { drawMemePreview } from '/src/meme-generator.js';

      const meme = ${payload};
      const canvas = document.querySelector('[data-meme-view]');
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        drawMemePreview({
          canvas,
          image,
          topText: meme.topText,
          bottomText: meme.bottomText,
          fontSize: meme.fontSize,
          fillColor: meme.textColor,
          strokeColor: meme.strokeColor
        });
      };
      image.onerror = () => {
        drawMemePreview({
          canvas,
          image: null,
          topText: meme.topText,
          bottomText: meme.bottomText,
          fontSize: meme.fontSize,
          fillColor: meme.textColor,
          strokeColor: meme.strokeColor
        });
      };
      image.src = meme.imageUrl;
    </script>
  </body>
</html>`;
}

function resolveAdminPassword(env = process.env) {
  if (typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length > 0) {
    return env.ADMIN_PASSWORD;
  }

  return DEFAULT_ADMIN_PASSWORD;
}

function safePasswordMatch(rawInput, expectedPassword) {
  const input = Buffer.from(typeof rawInput === 'string' ? rawInput : '', 'utf8');
  const expected = Buffer.from(expectedPassword, 'utf8');
  const maxLength = Math.max(input.length, expected.length, 1);
  const safeInput = Buffer.alloc(maxLength);
  const safeExpected = Buffer.alloc(maxLength);

  input.copy(safeInput);
  expected.copy(safeExpected);

  const equal = timingSafeEqual(safeInput, safeExpected);
  return equal && input.length === expected.length;
}

function createWorldRuntime({ random, now, adminPassword }) {
  const world = createWorldConfig();
  const viewers = new Map();
  const chatMessages = [];
  const adminViewerIds = new Set();
  const adminAttempts = new Map();

  function pruneStaleViewers() {
    const cutoff = now() - STALE_VIEWER_MS;
    viewers.forEach((viewer, id) => {
      if (viewer.lastSeenAt < cutoff) {
        viewers.delete(id);
        adminViewerIds.delete(id);
        adminAttempts.delete(id);
      }
    });
  }

  function upsertViewer(rawViewer) {
    if (!rawViewer || typeof rawViewer.id !== 'string' || !rawViewer.id.trim()) {
      return null;
    }

    const isAdmin = adminViewerIds.has(rawViewer.id);
    const safeAvatar = sanitizeAvatar(
      { ...(rawViewer.avatar ?? {}), character: rawViewer.avatar?.character ?? rawViewer.character },
      { isAdmin, fallbackCharacter: assignViewerCharacter(random) }
    );

    const viewer = {
      id: rawViewer.id,
      character: safeAvatar.character,
      avatar: safeAvatar,
      isAdmin,
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
      avatar: viewer.avatar,
      isAdmin: viewer.isAdmin,
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

  function authenticateAdmin({ viewerId, password }) {
    if (typeof viewerId !== 'string' || !viewerId.trim()) {
      return { authorized: false };
    }

    const current = adminAttempts.get(viewerId) ?? { count: 0, blockedUntil: 0 };

    if (current.blockedUntil > now()) {
      return { authorized: false };
    }

    if (safePasswordMatch(password, adminPassword)) {
      adminViewerIds.add(viewerId);
      adminAttempts.set(viewerId, { count: 0, blockedUntil: 0 });
      const existing = viewers.get(viewerId);

      if (existing) {
        existing.isAdmin = true;
        existing.avatar = sanitizeAvatar(existing.avatar, { isAdmin: true, fallbackCharacter: existing.character });
        existing.character = existing.avatar.character;
      }

      return { authorized: true };
    }

    const nextCount = current.count + 1;
    const blockedUntil = nextCount >= MAX_ADMIN_ATTEMPTS ? now() + ADMIN_BLOCK_MS : 0;
    adminAttempts.set(viewerId, { count: blockedUntil ? 0 : nextCount, blockedUntil });
    return { authorized: false };
  }

  return {
    world,
    authenticateAdmin,
    registerViewer() {
      const character = assignViewerCharacter(random);
      const avatar = sanitizeAvatar({ character }, { isAdmin: false, fallbackCharacter: character });
      const viewer = {
        id: randomUUID(),
        character,
        avatar,
        isAdmin: false,
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
          messages: [],
          isAdmin: false
        };
      }

      const viewer = upsertViewer(body.viewer);

      if (!viewer) {
        return {
          percentage: 0,
          contents: 'Sync error. Viewer payload invalid.',
          users: [],
          messages: [],
          isAdmin: false
        };
      }

      addChatMessage(viewer, body.chatMessage);
      return {
        ...createSnapshot(),
        isAdmin: viewer.isAdmin
      };
    },
    snapshot() {
      return createSnapshot();
    }
  };
}

export function createServer({ random = Math.random, now, adminPassword, env = process.env } = {}) {
  const app = express();
  const memeService = createMemeService({ now: typeof now === 'function' ? now : Date.now });
  const runtime = createWorldRuntime({
    random,
    now: typeof now === 'function' ? now : Date.now,
    adminPassword: typeof adminPassword === 'string' ? adminPassword : resolveAdminPassword(env)
  });

  app.use(express.json());
  app.use('/src', express.static('src'));

  app.get('/', (_req, res) => {
    res.sendFile('index.html', { root: process.cwd() });
  });

  app.get('/world', (_req, res) => {
    const viewer = runtime.registerViewer();
    res.type('html').send(worldPageTemplate({ viewer, world: runtime.world }));
  });

  app.get('/memegenerator', (_req, res) => {
    res.sendFile('memegenerator.html', { root: process.cwd() });
  });

  app.get('/system_monitor', (_req, res) => {
    res.type('html').send(systemMonitorPageTemplate());
  });

  app.get('/memes/templates', (_req, res) => {
    res.json({ templates: memeService.templates });
  });

  app.post('/memes', (req, res) => {
    const body = req.body ?? {};
    const providedPassword = typeof body.adminPassword === 'string' ? body.adminPassword : '';
    const expectedPassword = typeof adminPassword === 'string' ? adminPassword : resolveAdminPassword(env);
    const allowSlug = safePasswordMatch(providedPassword, expectedPassword);
    const created = memeService.createMeme(body, { allowSlug });

    if (!created.ok) {
      res.status(created.status).json({ error: created.error });
      return;
    }

    res.status(created.status).json(created.meme);
  });

  app.get('/memes/:identifier', (req, res) => {
    const meme = memeService.getMeme(req.params.identifier);

    if (!meme) {
      res.status(404).json({ error: 'Meme not found or expired.' });
      return;
    }

    res.type('html').send(memePageTemplate(meme));
  });

  app.get('/system_monitor/metrics', (_req, res) => {
    res.json(collectSystemMetrics());
  });

  app.get('/world/updates', (_req, res) => {
    res.json(runtime.snapshot());
  });

  app.post('/world/admin-auth', (req, res) => {
    res.json(runtime.authenticateAdmin(req.body ?? {}));
  });

  app.post('/world/updates', (req, res) => {
    res.json(runtime.applyUpdate(req.body));
  });

  return app;
}
