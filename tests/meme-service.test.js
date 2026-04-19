import { describe, expect, it } from 'vitest';
import { createMemeService, normalizeMemePayload, resolveMemeImageUrl } from '../src/meme-service.js';

describe('resolveMemeImageUrl', () => {
  it('prefers explicit URLs and validates protocol', () => {
    expect(resolveMemeImageUrl({ url: 'https://example.com/a.png' })).toBe('https://example.com/a.png');
    expect(resolveMemeImageUrl({ url: 'ftp://example.com/a.png' })).toBe('');
  });

  it('falls back to known templates', () => {
    expect(resolveMemeImageUrl({ template: 'drake' })).toContain('imgflip.com');
    expect(resolveMemeImageUrl({ template: 'unknown' })).toBe('');
    expect(resolveMemeImageUrl({ template: 42 })).toBe('');
  });

  it('rejects malformed explicit URLs', () => {
    expect(resolveMemeImageUrl({ url: '::not-a-url::' })).toBe('');
  });
});

describe('normalizeMemePayload', () => {
  it('sanitizes and clamps optional inputs', () => {
    const normalized = normalizeMemePayload({
      url: 'https://example.com/meme.jpg',
      text: 'HELLO',
      textColor: 'not-a-color!@#',
      strokeColor: '#fff',
      font: "Impact<script>alert(1)</script>",
      fontSize: '999',
      align: '',
      width: '9',
      height: '99999',
      slug: '  My Slug!! '
    });

    expect(normalized.topText).toBe('HELLO');
    expect(normalized.textColor).toBe('#ffffff');
    expect(normalized.strokeColor).toBe('#fff');
    expect(normalized.font).toBe('Impactscriptalert1script');
    expect(normalized.fontSize).toBe(144);
    expect(normalized.align).toBe('center');
    expect(normalized.width).toBe(100);
    expect(normalized.height).toBe(4096);
    expect(normalized.slug).toBe('my-slug');
  });

  it('supports named colors, default font fallback, and short slug rejection', () => {
    const normalized = normalizeMemePayload({
      template: 'drake',
      textColor: 'white',
      strokeColor: 'blue',
      font: '!!!',
      fontSize: '35',
      slug: 'x'
    });

    expect(normalized.textColor).toBe('white');
    expect(normalized.strokeColor).toBe('blue');
    expect(normalized.font).toBe('Impact');
    expect(normalized.fontSize).toBe(35);
    expect(normalized.slug).toBe('');
  });
});

describe('createMemeService', () => {
  it('creates and retrieves memes by id', () => {
    let now = 1000;
    const service = createMemeService({ now: () => now, randomId: () => 'id-1' });

    const created = service.createMeme({ url: 'https://example.com/meme.jpg' });
    expect(created.ok).toBe(true);
    expect(created.meme.path).toBe('/memes/id-1');

    const found = service.getMeme('id-1');
    expect(found?.id).toBe('id-1');

    now += service.ttlMs + 1;
    expect(service.getMeme('id-1')).toBeNull();
  });

  it('validates required url/template and slug privileges', () => {
    const service = createMemeService({ randomId: () => 'id-2' });

    expect(service.createMeme({}).error).toContain('Either url or a known template');
    expect(service.createMeme({ template: 'drake', slug: 'custom' }).status).toBe(403);
  });

  it('supports admin slug and rejects duplicates', () => {
    let counter = 0;
    const service = createMemeService({ randomId: () => `id-${++counter}` });

    const one = service.createMeme({ template: 'drake', slug: 'featured' }, { allowSlug: true });
    expect(one.ok).toBe(true);
    expect(one.meme.path).toBe('/memes/featured');

    const duplicate = service.createMeme({ template: 'drake', slug: 'featured' }, { allowSlug: true });
    expect(duplicate.status).toBe(409);

    expect(service.getMeme('featured')?.id).toBe('id-1');
    expect(service.getMeme('does-not-exist')).toBeNull();
  });


  it('prunes expired slug entries from slug lookup map', () => {
    let now = 5_000;
    const service = createMemeService({ now: () => now, randomId: () => 'slug-id' });

    service.createMeme({ template: 'drake', slug: 'temp-slug' }, { allowSlug: true });
    expect(service.getMeme('temp-slug')?.id).toBe('slug-id');

    now += service.ttlMs + 1;
    expect(service.getMeme('temp-slug')).toBeNull();
  });

  it('handles empty identifiers and expired entries without slug maps', () => {
    let now = 1_000;
    let counter = 0;
    const service = createMemeService({ now: () => now, randomId: () => `solo-${++counter}` });

    service.createMeme({ template: 'drake' });
    expect(service.getMeme('   ')).toBeNull();

    now += service.ttlMs + 1;
    expect(service.getMeme('solo-1')).toBeNull();
    expect(service.getMeme('missing-after-prune')).toBeNull();
  });
});
