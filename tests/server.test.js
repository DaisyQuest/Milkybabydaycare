import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';

describe('express server', () => {
  it('serves homepage, world, meme generator, and system monitor pages with expected ui', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000 });

    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('Milky Baby Daycare');

    const monitor = await request(app).get('/system_monitor');
    expect(monitor.status).toBe(200);
    expect(monitor.text).toContain('System Monitor');
    expect(monitor.text).toContain('data-monitor-signals');
    expect(monitor.text).toContain('@sudodevnull/datastar');


    const memeGenerator = await request(app).get('/memegenerator');
    expect(memeGenerator.status).toBe(200);
    expect(memeGenerator.text).toContain('Milky Baby Meme Generator');
    expect(memeGenerator.text).toContain('data-meme-file');
    expect(memeGenerator.text).toContain('data-meme-canvas');

    const world = await request(app).get('/world');
    expect(world.status).toBe(200);
    expect(world.text).toContain('Milky Baby Daycare World');
    expect(world.text).toContain('data-world-bootstrap');
    expect(world.text).toContain('"character":"!"');
    expect(world.text).toContain('"width":64');
    expect(world.text).toContain('data-world-updates-url="/world/updates"');
    expect(world.text).toContain('data-world-admin-auth-url="/world/admin-auth"');
    expect(world.text).toContain('data-world-admin-form');
    expect(world.text).toContain('data-avatar-shape');
    expect(world.text).toContain('data-avatar-character');
    expect(world.text).not.toContain('maxlength="1" data-avatar-character');
    expect(world.text).toContain('@sudodevnull/datastar');
  });

  it('serves world snapshot payload and static source files', async () => {
    const app = createServer({ now: () => 1_000 });

    const updates = await request(app).get('/world/updates');
    expect(updates.status).toBe(200);
    expect(updates.body.percentage).toBe(100);
    expect(updates.body.users).toEqual([]);
    expect(updates.body.messages).toEqual([]);
    expect(updates.body.contents.split('\n')).toHaveLength(32);
    expect(updates.body.contents.split('\n').every((row) => row === '.'.repeat(64))).toBe(true);

    const metrics = await request(app).get('/system_monitor/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.body).toMatchObject({
      runtime: expect.any(Object),
      host: expect.any(Object),
      cpu: expect.any(Object),
      memory: expect.any(Object),
      processResources: expect.any(Object)
    });

    const staticScript = await request(app).get('/src/world-client.js');
    expect(staticScript.status).toBe(200);
    expect(staticScript.text).toContain('initWorld');

    const memeScript = await request(app).get('/src/meme-generator.js');
    expect(memeScript.status).toBe(200);
    expect(memeScript.text).toContain('createMemeGeneratorApp');
  });


  it('creates memes over webservices and serves them by uuid for 48 hours', async () => {
    let now = 2_000;
    const app = createServer({ now: () => now, adminPassword: 'pw' });

    const created = await request(app).post('/memes').send({
      url: 'https://example.com/meme.png',
      topText: 'Top',
      bottomText: 'Bottom',
      textColor: '#00ff99',
      font: 'Bungee'
    });

    expect(created.status).toBe(201);
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.path).toBe(`/memes/${created.body.id}`);
    expect(created.body.config.font).toBe('Bungee');

    const served = await request(app).get(created.body.path);
    expect(served.status).toBe(200);
    expect(served.text).toContain('Your meme is live for 48 hours.');
    expect(served.text).toContain('https://example.com/meme.png');

    now += 48 * 60 * 60 * 1000 + 1;
    const expired = await request(app).get(created.body.path);
    expect(expired.status).toBe(404);
    expect(expired.body).toEqual({ error: 'Meme not found or expired.' });
  });

  it('requires admin password to set slug and allows slug with correct password', async () => {
    const app = createServer({ now: () => 3_000, adminPassword: 'letmein' });

    const denied = await request(app).post('/memes').send({
      template: 'drake',
      slug: 'hero-meme',
      adminPassword: 'wrong'
    });

    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: 'Admin password required to specify slug.' });

    const allowed = await request(app).post('/memes').send({
      template: 'drake',
      slug: 'hero-meme',
      adminPassword: 'letmein',
      text: 'fallback top text',
      etc: 'supported but ignored'
    });

    expect(allowed.status).toBe(201);
    expect(allowed.body.path).toBe('/memes/hero-meme');
    expect(allowed.body.config.topText).toBe('fallback top text');

    const served = await request(app).get('/memes/hero-meme');
    expect(served.status).toBe(200);
    expect(served.text).toContain('fallback top text');

    const duplicate = await request(app).post('/memes').send({
      template: 'drake',
      slug: 'hero-meme',
      adminPassword: 'letmein'
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'That slug is already taken.' });
  });

  it('exposes standard template catalog and validates meme payload requirements', async () => {
    const app = createServer({ now: () => 4_000 });

    const templates = await request(app).get('/memes/templates');
    expect(templates.status).toBe(200);
    expect(templates.body.templates).toMatchObject({
      drake: expect.stringContaining('imgflip.com'),
      changeMyMind: expect.stringContaining('imgflip.com')
    });

    const invalid = await request(app).post('/memes').send({ template: 'missing-template' });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ error: 'Either url or a known template is required.' });

    const noJsonBody = await request(app).post('/memes').type('text/plain').send('raw=1');
    expect(noJsonBody.status).toBe(400);
    expect(noJsonBody.body).toEqual({ error: 'Either url or a known template is required.' });
  });

  it('authenticates admin with configured password and unlocks admin-only avatar settings', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000, adminPassword: 'letmein' });

    const wrongAuth = await request(app).post('/world/admin-auth').send({ viewerId: 'v1', password: 'wrong' });
    expect(wrongAuth.status).toBe(200);
    expect(wrongAuth.body).toEqual({ authorized: false });

    const okAuth = await request(app).post('/world/admin-auth').send({ viewerId: 'v1', password: 'letmein' });
    expect(okAuth.status).toBe(200);
    expect(okAuth.body).toEqual({ authorized: true });

    const sync = await request(app).post('/world/updates').send({
      viewer: {
        id: 'v1',
        name: 'Comet',
        character: 'C',
        avatar: {
          character: 'Z',
          colorKey: 'FREE',
          freeColor: '#abc123',
          shape: 'circle',
          size: 5,
          font: 'serif',
          fontWeight: 'bold'
        },
        x: 1,
        y: 2
      },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(sync.status).toBe(200);
    expect(sync.body.isAdmin).toBe(true);
    expect(sync.body.users[0].avatar.colorKey).toBe('FREE');
    expect(sync.body.users[0].avatar.colorValue).toBe('#abc123');
    expect(sync.body.users[0].avatar.shape).toBe('circle');
    expect(sync.body.users[0].avatar.size).toBe(5);
  });

  it('uses fallback admin password when ADMIN_PASSWORD is not set', async () => {
    const app = createServer({ now: () => 1_000, env: {} });

    const auth = await request(app).post('/world/admin-auth').send({ viewerId: 'v2', password: 'bicassdooandyou' });
    expect(auth.status).toBe(200);
    expect(auth.body).toEqual({ authorized: true });
  });

  it('uses ADMIN_PASSWORD from environment when provided', async () => {
    const app = createServer({ now: () => 1_000, env: { ADMIN_PASSWORD: 'from-env' } });
    const auth = await request(app).post('/world/admin-auth').send({ viewerId: 'v9', password: 'from-env' });
    expect(auth.status).toBe(200);
    expect(auth.body).toEqual({ authorized: true });
  });

  it('rejects admin auth when viewer id is missing', async () => {
    const app = createServer({ now: () => 1_000, adminPassword: 'secret' });
    const auth = await request(app).post('/world/admin-auth').send({ viewerId: '   ', password: 'secret' });
    expect(auth.status).toBe(200);
    expect(auth.body).toEqual({ authorized: false });
  });

  it('handles admin auth payload edge cases with missing body and non-string passwords', async () => {
    const app = createServer({ now: () => 1_000, adminPassword: '1234' });

    const noBody = await request(app).post('/world/admin-auth');
    expect(noBody.status).toBe(200);
    expect(noBody.body).toEqual({ authorized: false });

    const numericPassword = await request(app).post('/world/admin-auth').send({ viewerId: 'v-edge', password: 1234 });
    expect(numericPassword.status).toBe(200);
    expect(numericPassword.body).toEqual({ authorized: false });
  });

  it('rate-limits repeated failed admin auth attempts', async () => {
    let now = 1_000;
    const app = createServer({ now: () => now, adminPassword: 'secret' });

    for (let index = 0; index < 5; index += 1) {
      const attempt = await request(app).post('/world/admin-auth').send({ viewerId: 'v3', password: 'nope' });
      expect(attempt.body).toEqual({ authorized: false });
    }

    const blocked = await request(app).post('/world/admin-auth').send({ viewerId: 'v3', password: 'secret' });
    expect(blocked.body).toEqual({ authorized: false });

    now += 61_000;
    const later = await request(app).post('/world/admin-auth').send({ viewerId: 'v3', password: 'secret' });
    expect(later.body).toEqual({ authorized: true });
  });

  it('accepts world sync posts and returns multiplayer snapshots with users and chat', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000 });

    const firstSync = await request(app).post('/world/updates').send({
      viewer: { id: 'v1', name: 'Comet', character: 'C', x: 1, y: 2 },
      world: { width: 64, height: 32 },
      contents: 'map',
      chatMessage: 'Hello world'
    });
    expect(firstSync.status).toBe(200);
    expect(firstSync.body.percentage).toBe(100);
    expect(firstSync.body.users).toEqual([
      {
        id: 'v1',
        name: 'Comet',
        character: 'C',
        avatar: {
          character: 'C',
          font: 'monospace',
          colorKey: 'PINK',
          colorValue: '#ec4899',
          freeColor: '',
          fontWeight: '700',
          shape: 'square',
          size: 1
        },
        isAdmin: false,
        x: 1,
        y: 2
      }
    ]);
    expect(firstSync.body.messages).toEqual([{ id: expect.any(String), name: 'Comet', text: 'Hello world' }]);

    const secondSync = await request(app).post('/world/updates').send({
      viewer: { id: 'v2', name: 'Nova', character: 'N', x: 3, y: 2 },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(secondSync.status).toBe(200);
    expect(secondSync.body.users).toHaveLength(2);
    expect(secondSync.body.contents.split('\n')[2][1]).toBe('C');
    expect(secondSync.body.contents.split('\n')[2][3]).toBe('N');
  });

  it('renders custom avatar from avatar payload when legacy character differs', async () => {
    const app = createServer({ now: () => 1_000 });

    const sync = await request(app).post('/world/updates').send({
      viewer: {
        id: 'v-avatar',
        name: 'Painter',
        character: 'L',
        avatar: { character: '🎨' },
        x: 4,
        y: 1
      },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(sync.status).toBe(200);
    expect(sync.body.users[0].character).toBe('🎨');
    expect(sync.body.users[0].avatar.character).toBe('🎨');
    expect(sync.body.contents.split('\n')[1]).toContain('🎨');
  });

  it('keeps unicode avatar characters intact in multiplayer world snapshots', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000, adminPassword: 'pw' });

    await request(app).post('/world/admin-auth').send({ viewerId: 'unicode-admin', password: 'pw' });

    const sync = await request(app).post('/world/updates').send({
      viewer: {
        id: 'unicode-admin',
        name: 'Unicode',
        character: 'U',
        avatar: {
          character: '🍼',
          colorKey: 'FREE',
          freeColor: '#abcdef'
        },
        x: 2,
        y: 3
      },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(sync.status).toBe(200);
    expect(sync.body.users[0].avatar.character).toBe('🍼');
    expect(sync.body.contents.split('\n')[3]).toContain('🍼');
  });

  it('applies admin upgrade to an already connected viewer', async () => {
    const app = createServer({ now: () => 1_000, adminPassword: 'pw' });

    await request(app).post('/world/updates').send({
      viewer: { id: 'existing', name: 'Existing', character: 'E', x: 1, y: 1 },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    const auth = await request(app).post('/world/admin-auth').send({ viewerId: 'existing', password: 'pw' });
    expect(auth.body).toEqual({ authorized: true });

    const followup = await request(app).post('/world/updates').send({
      viewer: { id: 'existing', name: 'Existing', character: 'E', avatar: { colorKey: 'FREE', freeColor: '#112233' }, x: 1, y: 1 },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(followup.body.users[0].isAdmin).toBe(true);
    expect(followup.body.users[0].avatar.colorKey).toBe('FREE');
  });

  it('validates update payload completeness and viewer shape', async () => {
    const app = createServer();

    const invalid = await request(app).post('/world/updates').send({ viewer: {}, world: {} });
    expect(invalid.status).toBe(200);
    expect(invalid.body).toEqual({
      percentage: 0,
      contents: 'Sync error. Client payload incomplete.',
      users: [],
      messages: [],
      isAdmin: false
    });

    const invalidViewer = await request(app).post('/world/updates').send({
      viewer: { id: '   ' },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(invalidViewer.status).toBe(200);
    expect(invalidViewer.body).toEqual({
      percentage: 0,
      contents: 'Sync error. Viewer payload invalid.',
      users: [],
      messages: [],
      isAdmin: false
    });
  });

  it('prunes stale viewers and trims chat history size', async () => {
    let now = 1000;
    const app = createServer({ now: () => now, random: () => 0 });

    for (let index = 0; index < 35; index += 1) {
      const id = index === 0 ? 'stale' : 'active';
      await request(app).post('/world/updates').send({
        viewer: { id, name: `User-${index}`, character: '#', x: 0, y: 0 },
        world: { width: 64, height: 32 },
        contents: 'map',
        chatMessage: `msg-${index}`
      });
    }

    now += 130_000;

    const snapshot = await request(app).post('/world/updates').send({
      viewer: { id: 'active', name: 'Active', character: '#', x: 0, y: 0 },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(snapshot.status).toBe(200);
    expect(snapshot.body.users).toHaveLength(1);
    expect(snapshot.body.messages).toHaveLength(30);
    expect(snapshot.body.messages[0].text).toBe('msg-5');
  });

  it('sanitizes incoming viewer and chat data and denies admin-only values from non-admin users', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000 });

    const response = await request(app).post('/world/updates').send({
      viewer: {
        id: 'v1',
        name: '   ',
        character: '',
        avatar: { colorKey: 'FREE', freeColor: '#010203', shape: 'circle', size: 4 },
        x: -100,
        y: 1000
      },
      world: { width: 64, height: 32 },
      contents: 'map',
      chatMessage: ' '.repeat(20)
    });

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([
      {
        id: 'v1',
        name: 'Starling',
        character: '!',
        avatar: {
          character: '!',
          font: 'monospace',
          colorKey: 'PINK',
          colorValue: '#ec4899',
          freeColor: '',
          fontWeight: '700',
          shape: 'square',
          size: 1
        },
        isAdmin: false,
        x: 0,
        y: 31
      }
    ]);
    expect(response.body.messages).toEqual([]);
  });

  it('sanitizes invalid free colors and non-finite coordinates for admin users', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000, adminPassword: 'pw' });
    await request(app).post('/world/admin-auth').send({ viewerId: 'v-admin', password: 'pw' });

    const response = await request(app).post('/world/updates').send({
      viewer: {
        id: 'v-admin',
        name: 'Admin',
        character: 'A',
        avatar: { colorKey: 'FREE', freeColor: 'x'.repeat(33), character: '🪐' },
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY
      },
      world: { width: 64, height: 32 },
      contents: 'map'
    });

    expect(response.status).toBe(200);
    expect(response.body.users[0].x).toBe(0);
    expect(response.body.users[0].y).toBe(0);
    expect(response.body.users[0].avatar.colorKey).toBe('FREE');
    expect(response.body.users[0].avatar.colorValue).toBe('#ec4899');
    expect(response.body.contents.split('\n')[0]).toContain('🪐');
  });
});
