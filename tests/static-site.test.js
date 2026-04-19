import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readProjectFile(relativePath) {
  const filePath = resolve(process.cwd(), relativePath);
  return readFileSync(filePath, 'utf8');
}

describe('static site entrypoint files', () => {
  it('provides index.html as the primary app entrypoint', () => {
    const html = readProjectFile('index.html');

    expect(html).toContain('<title>Milky Baby Daycare</title>');
    expect(html).toContain('<main class="container" data-app-root>');
    expect(html).toContain('<section class="floating-decor" aria-hidden="true">');
    expect(html).toContain('<section data-burst-layer aria-hidden="true"></section>');
    expect(html).toContain("import { initMilkyBabyDaycare } from './src/site.js';");
    expect(html).toContain('initMilkyBabyDaycare(document, window, new Date());');
    expect(html).toContain('<a href="/world">Visit the interactive ASCII world →</a>');
    expect(html).toContain('<a href="/system_monitor">Open the live system monitor dashboard →</a>');
    expect(html).toContain('<a href="/memegenerator">Create a meme with live preview →</a>');
  });

  it('keeps legacy milkybabydaycare.html content aligned with index.html', () => {
    const indexHtml = readProjectFile('index.html').trim();
    const legacyHtml = readProjectFile('milkybabydaycare.html').trim();

    expect(legacyHtml).toBe(indexHtml);
  });

  it('defines an npm start script for azure deployment startup', () => {
    const packageJson = JSON.parse(readProjectFile('package.json'));
    expect(packageJson.scripts.start).toBe('node server.js');
  });
});

describe('Azure Static Web Apps fallback config', () => {
  it('rewrites fallback navigation requests to index.html', () => {
    const config = JSON.parse(readProjectFile('staticwebapp.config.json'));

    expect(config.navigationFallback).toEqual({
      rewrite: '/index.html',
      exclude: ['/assets/*', '/*.css', '/*.js', '/src/*']
    });
  });
});


describe('meme generator entrypoint file', () => {
  it('provides a dedicated meme generator page with uploader controls', () => {
    const html = readProjectFile('memegenerator.html');

    expect(html).toContain('<title>Milky Baby Meme Generator</title>');
    expect(html).toContain('data-meme-root');
    expect(html).toContain('data-meme-file');
    expect(html).toContain('data-meme-url');
    expect(html).toContain('data-meme-url-load');
    expect(html).toContain('data-meme-top');
    expect(html).toContain('data-meme-bottom');
    expect(html).toContain('data-meme-size');
    expect(html).toContain('data-meme-canvas');
    expect(html).toContain("import { initMemeGenerator } from './src/meme-generator.js';");
  });
});
