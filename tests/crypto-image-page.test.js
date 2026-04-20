import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { createCryptoImageApp, initCryptoImageApp } from '../src/crypto-image-page.js';

function buildDom() {
  document.body.innerHTML = `
    <main data-crypto-root>
      <textarea data-crypto-request>{"imageBase64":"AQID","key":"k","base64":"AQID"}</textarea>
      <pre data-crypto-response>{}</pre>
      <p data-crypto-status></p>
      <img data-crypto-preview hidden />
      <button data-crypto-op="encrypt-no-key"></button>
      <button data-crypto-op="base64-to-image"></button>
      <button data-crypto-op="random-simple"></button>
      <button data-crypto-op="unknown-op"></button>
    </main>
  `;
}

describe('createCryptoImageApp', () => {
  it('throws when required elements are missing', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => createCryptoImageApp(document, window)).toThrow(
      'Crypto image app requires root, request, response, and controls.'
    );
  });

  it('runs selected operations, handles json parse fallback, and toggles preview image', async () => {
    buildDom();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, imageDataUrl: 'data:image/png;base64,AQID' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'bad request' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, mode: 'simple' }) });

    const win = { fetch };
    const app = createCryptoImageApp(document, win);

    document.querySelector('[data-crypto-request]').value = '{bad json';
    fireEvent.click(document.querySelector('[data-crypto-op="encrypt-no-key"]'));
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith('/api/crypto/encrypt/no-key', expect.objectContaining({ method: 'POST' }));
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('completed');
    expect(document.querySelector('[data-crypto-preview]').hidden).toBe(false);

    fireEvent.click(document.querySelector('[data-crypto-op="base64-to-image"]'));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('[data-crypto-status]').textContent).toContain('failed');
    expect(document.querySelector('[data-crypto-preview]').hidden).toBe(true);

    const payload = await app.runOperation(app.operations.find((entry) => entry.id === 'random-simple'));
    expect(payload.mode).toBe('simple');
    expect(fetch).toHaveBeenLastCalledWith('/api/crypto/random/simple-color', expect.objectContaining({ method: 'GET' }));
  });

  it('handles unknown operations and fetch exceptions', async () => {
    buildDom();
    const fetch = vi.fn().mockRejectedValue(new Error('network down'));
    createCryptoImageApp(document, { fetch });

    fireEvent.click(document.querySelector('[data-crypto-op="unknown-op"]'));
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('Unknown operation');

    fireEvent.click(document.querySelector('[data-crypto-op="encrypt-no-key"]'));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('unexpectedly');
    expect(document.querySelector('[data-crypto-response]').textContent).toContain('network down');
  });
});

describe('initCryptoImageApp', () => {
  it('delegates to createCryptoImageApp', () => {
    buildDom();
    const app = initCryptoImageApp(document, { fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) });
    expect(app.operations.length).toBeGreaterThan(5);
  });
});
