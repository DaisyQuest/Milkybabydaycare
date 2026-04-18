import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';

describe('express server', () => {
  it('serves homepage and world pages with multiplayer ui sections', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000 });

    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('Milky Baby Daycare');

    const world = await request(app).get('/world');
    expect(world.status).toBe(200);
    expect(world.text).toContain('Milky Baby Daycare World');
    expect(world.text).toContain('data-world-bootstrap');
    expect(world.text).toContain('"character":"!"');
    expect(world.text).toContain('"width":48');
    expect(world.text).toContain('data-world-updates-url="/world/updates"');
    expect(world.text).toContain('data-world-users');
    expect(world.text).toContain('data-world-chat-form');
    expect(world.text).toContain('@sudodevnull/datastar');
  });

  it('serves world snapshot payload and static source files', async () => {
    const app = createServer({ now: () => 1_000 });

    const updates = await request(app).get('/world/updates');
    expect(updates.status).toBe(200);
    expect(updates.body.percentage).toBe(100);
    expect(updates.body.users).toEqual([]);
    expect(updates.body.messages).toEqual([]);
    expect(updates.body.contents.split('\n')).toHaveLength(24);
    expect(updates.body.contents.split('\n').every((row) => row === '.'.repeat(48))).toBe(true);

    const staticScript = await request(app).get('/src/world-client.js');
    expect(staticScript.status).toBe(200);
    expect(staticScript.text).toContain('initWorld');
  });

  it('accepts world sync posts and returns multiplayer snapshots with users and chat', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000 });

    const firstSync = await request(app).post('/world/updates').send({
      viewer: { id: 'v1', name: 'Comet', character: 'C', x: 1, y: 2 },
      world: { width: 48, height: 24 },
      contents: 'map',
      chatMessage: 'Hello world'
    });
    expect(firstSync.status).toBe(200);
    expect(firstSync.body.percentage).toBe(100);
    expect(firstSync.body.users).toEqual([
      { id: 'v1', name: 'Comet', character: 'C', x: 1, y: 2 }
    ]);
    expect(firstSync.body.messages).toEqual([{ id: expect.any(String), name: 'Comet', text: 'Hello world' }]);

    const secondSync = await request(app).post('/world/updates').send({
      viewer: { id: 'v2', name: 'Nova', character: 'N', x: 3, y: 2 },
      world: { width: 48, height: 24 },
      contents: 'map'
    });

    expect(secondSync.status).toBe(200);
    expect(secondSync.body.users).toHaveLength(2);
    expect(secondSync.body.contents.split('\n')[2][1]).toBe('C');
    expect(secondSync.body.contents.split('\n')[2][3]).toBe('N');
  });

  it('validates update payload completeness and viewer shape', async () => {
    const app = createServer();

    const invalid = await request(app).post('/world/updates').send({ viewer: {}, world: {} });
    expect(invalid.status).toBe(200);
    expect(invalid.body).toEqual({
      percentage: 0,
      contents: 'Sync error. Client payload incomplete.',
      users: [],
      messages: []
    });

    const invalidViewer = await request(app).post('/world/updates').send({
      viewer: { id: '   ' },
      world: { width: 48, height: 24 },
      contents: 'map'
    });

    expect(invalidViewer.status).toBe(200);
    expect(invalidViewer.body).toEqual({
      percentage: 0,
      contents: 'Sync error. Viewer payload invalid.',
      users: [],
      messages: []
    });
  });

  it('prunes stale viewers and trims chat history size', async () => {
    let now = 1000;
    const app = createServer({ now: () => now, random: () => 0 });

    for (let index = 0; index < 35; index += 1) {
      // keep first viewer stale, actively update second viewer
      const id = index === 0 ? 'stale' : 'active';
      await request(app).post('/world/updates').send({
        viewer: { id, name: `User-${index}`, character: '#', x: 0, y: 0 },
        world: { width: 48, height: 24 },
        contents: 'map',
        chatMessage: `msg-${index}`
      });
    }

    now += 130_000;

    const snapshot = await request(app).post('/world/updates').send({
      viewer: { id: 'active', name: 'Active', character: '#', x: 0, y: 0 },
      world: { width: 48, height: 24 },
      contents: 'map'
    });

    expect(snapshot.status).toBe(200);
    expect(snapshot.body.users).toEqual([{ id: 'active', name: 'Active', character: '#', x: 0, y: 0 }]);
    expect(snapshot.body.messages).toHaveLength(30);
    expect(snapshot.body.messages[0].text).toBe('msg-5');
  });


  it('falls back coordinates to defaults when viewer coordinates are non-finite', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000 });

    const response = await request(app).post('/world/updates').send({
      viewer: { id: 'v3', name: 'Floaty', character: 'F', x: 'NaN', y: null },
      world: { width: 48, height: 24 },
      contents: 'map'
    });

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([{ id: 'v3', name: 'Floaty', character: 'F', x: 0, y: 0 }]);
  });

  it('sanitizes incoming viewer and chat data', async () => {
    const app = createServer({ random: () => 0, now: () => 1_000 });

    const response = await request(app).post('/world/updates').send({
      viewer: { id: 'v1', name: '   ', character: '', x: -100, y: 1000 },
      world: { width: 48, height: 24 },
      contents: 'map',
      chatMessage: ' '.repeat(20)
    });

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([{ id: 'v1', name: 'Starling', character: '!', x: 0, y: 23 }]);
    expect(response.body.messages).toEqual([]);
  });
});
