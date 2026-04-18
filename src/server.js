import express from 'express';
import { randomUUID } from 'node:crypto';
import { assignViewerCharacter, createWorldConfig } from './world.js';

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
        data-signals='{"_percentage":100,"_contents":"loading...","_name":"${viewer.name}","_character":"${viewer.character}"}'
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
      <script type="application/json" data-world-bootstrap>${JSON.stringify({ viewer, world })}</script>
    </main>

    <script type="module" src="/src/world-client.js"></script>
    <script type="module">
      import { initWorld } from '/src/world-client.js';
      initWorld(document);
    </script>
  </body>
</html>`;
}

export function createServer({ random = Math.random } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/src', express.static('src'));

  app.get('/', (_req, res) => {
    res.sendFile('index.html', { root: process.cwd() });
  });

  app.get('/world', (_req, res) => {
    const world = createWorldConfig();
    const viewer = {
      id: randomUUID(),
      character: assignViewerCharacter(random),
      name: 'Starling',
      x: 0,
      y: 0
    };

    res.type('html').send(worldPageTemplate({ viewer, world }));
  });

  app.get('/world/updates', (_req, res) => {
    res.json({
      percentage: 100,
      contents: 'World client ready for sync.'
    });
  });

  app.post('/world/updates', (req, res) => {
    const percentage = req.body?.viewer && req.body?.world && typeof req.body?.contents === 'string' ? 100 : 0;
    res.json({
      percentage,
      contents: percentage === 100 ? req.body.contents : 'Sync error. Client payload incomplete.'
    });
  });

  return app;
}
