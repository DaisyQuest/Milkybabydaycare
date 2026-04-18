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
    expect(html).toContain("<main class=\"container\" data-app-root>");
    expect(html).toContain("import { initMilkyBabyDaycare } from './src/site.js';");
    expect(html).toContain('initMilkyBabyDaycare(document, window, new Date());');
  });

  it('keeps legacy milkybabydaycare.html content aligned with index.html', () => {
    const indexHtml = readProjectFile('index.html').trim();
    const legacyHtml = readProjectFile('milkybabydaycare.html').trim();

    expect(legacyHtml).toBe(indexHtml);
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
