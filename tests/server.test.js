import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';

describe('express server', () => {
  it('serves homepage and world pages', async () => {
    const app = createServer({ random: () => 0 });

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
  });

  it('serves world updates payload and static source files', async () => {
    const app = createServer();

    const updates = await request(app).get('/world/updates');
    expect(updates.status).toBe(200);
    expect(updates.body).toEqual({
      percentage: 100,
      contents: 'World client ready for sync.'
    });

    const staticScript = await request(app).get('/src/world-client.js');
    expect(staticScript.status).toBe(200);
    expect(staticScript.text).toContain('initWorld');
  });

  it('accepts world sync posts and validates payload completeness', async () => {
    const app = createServer();

    const success = await request(app).post('/world/updates').send({
      viewer: { id: 'v1' },
      world: { width: 48, height: 24 },
      contents: 'map'
    });
    expect(success.status).toBe(200);
    expect(success.body).toEqual({
      percentage: 100,
      contents: 'map'
    });

    const invalid = await request(app).post('/world/updates').send({ viewer: {}, world: {} });
    expect(invalid.status).toBe(200);
    expect(invalid.body).toEqual({
      percentage: 0,
      contents: 'Sync error. Client payload incomplete.'
    });
  });
});
