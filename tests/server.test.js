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
  });

  it('serves world updates payload and static source files', async () => {
    const app = createServer();

    const updates = await request(app).get('/world/updates');
    expect(updates.status).toBe(200);
    expect(updates.body).toEqual({
      percentage: 100,
      contents: 'World client manages rendering locally for responsiveness.'
    });

    const staticScript = await request(app).get('/src/world-client.js');
    expect(staticScript.status).toBe(200);
    expect(staticScript.text).toContain('initWorld');
  });
});
