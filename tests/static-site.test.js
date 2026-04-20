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
    expect(html).toContain('<main class="page-shell" data-app-root>');
    expect(html).toContain('<section class="hero-content">');
    expect(html).toContain('<section class="button-row" data-intro-buttons aria-label="Main actions">');
    expect(html).toContain('<section class="experience-grid">');
    expect(html).toContain('<section class="link-panel link-stack" data-intro-links>');
    expect(html).toContain('<section class="floating-decor" aria-hidden="true">');
    expect(html).toContain('<section data-burst-layer aria-hidden="true"></section>');
    expect(html).toContain("import { initMilkyBabyDaycare } from './src/site.js';");
    expect(html).toContain('initMilkyBabyDaycare(document, window, new Date());');
    expect(html).toContain('<a href="/world">Visit the interactive ASCII world →</a>');
    expect(html).toContain('<a href="/daycare">Play the daycare whiny baby management minigame →</a>');
    expect(html).toContain('<a href="/system_monitor">Open the live system monitor dashboard →</a>');
    expect(html).toContain('<a href="/memegenerator">Create a meme with live preview →</a>');
    expect(html).toContain('<a href="/cryptographic-images">Generate cryptographic images + API playground →</a>');
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



describe('site stylesheet layout contract', () => {
  it('uses full viewport layout rather than centered container', () => {
    const css = readProjectFile('src/site.css');

    expect(css).toContain('.page-shell {');
    expect(css).toContain('width: 100%;');
    expect(css).toContain('min-height: 100vh;');
    expect(css).toContain('.experience-grid {');
    expect(css).toContain('grid-template-columns: minmax(300px, 1fr);');
    expect(css).not.toContain('place-items: center;');
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

describe('cryptographic image playground entrypoint file', () => {
  it('provides a dedicated cryptographic image page with operation controls', () => {
    const html = readProjectFile('cryptographic-images.html');

    expect(html).toContain('<title>Generate Cryptographic Images</title>');
    expect(html).toContain('data-crypto-root');
    expect(html).toContain('data-crypto-request');
    expect(html).toContain('data-crypto-file');
    expect(html).toContain('data-crypto-upload');
    expect(html).toContain('data-crypto-response');
    expect(html).toContain('data-crypto-preview');
    expect(html).toContain('data-crypto-op="encrypt-no-key"');
    expect(html).toContain('data-crypto-op="decrypt-no-key"');
    expect(html).toContain('data-crypto-op="encrypt-with-key"');
    expect(html).toContain('data-crypto-op="decrypt-with-key"');
    expect(html).toContain('data-crypto-op="add-noise"');
    expect(html).toContain('data-crypto-op="color-randomizer"');
    expect(html).toContain('data-crypto-op="image-to-base64"');
    expect(html).toContain('data-crypto-op="base64-to-image"');
    expect(html).toContain('data-crypto-op="random-simple"');
    expect(html).toContain('data-crypto-op="random-complex"');
    expect(html).toContain('data-crypto-op="random-extreme"');
    expect(html).toContain("import { initCryptoImageApp } from './src/crypto-image-page.js';");
  });
});


describe('daycare minigame entrypoint file', () => {
  it('provides daycare route UI and initialization hook', () => {
    const html = readProjectFile('daycare.html');

    expect(html).toContain('<title>Milky Baby Daycare Minigame</title>');
    expect(html).toContain('data-daycare-root');
    expect(html).toContain('data-daycare-health-fill');
    expect(html).toContain('data-daycare-tool="milk"');
    expect(html).toContain('data-daycare-tool="caress"');
    expect(html).toContain('data-daycare-tool="cleanup"');
    expect(html).toContain('data-daycare-board');
    expect(html).toContain('data-daycare-trash');
    expect(html).toContain("import { initDaycareGame } from './src/daycare-game.js';");
  });
});
