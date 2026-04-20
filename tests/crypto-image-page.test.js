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
      <input type="file" data-crypto-file />
      <button data-crypto-upload></button>
      <button data-crypto-op="encrypt-no-key"></button>
      <button data-crypto-op="base64-to-image"></button>
      <button data-crypto-op="random-simple"></button>
      <button data-crypto-op="unknown-op"></button>
    </main>
  `;
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
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
    await flushAsync();

    expect(fetch).toHaveBeenCalledWith('/api/crypto/encrypt/no-key', expect.objectContaining({ method: 'POST' }));
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('completed');
    expect(document.querySelector('[data-crypto-preview]').hidden).toBe(false);

    fireEvent.click(document.querySelector('[data-crypto-op="base64-to-image"]'));
    await flushAsync();

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
    await flushAsync();
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('unexpectedly');
    expect(document.querySelector('[data-crypto-response]').textContent).toContain('network down');
  });

  it('loads file input into request json using upload helper and preserves existing fields', async () => {
    buildDom();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const addEventListener = vi.fn((type, callback) => {
      if (type === 'load') {
        addEventListener.loadCallback = callback;
      }
      if (type === 'error') {
        addEventListener.errorCallback = callback;
      }
    });
    const mockReader = {
      result: 'data:image/png;base64,QUJD',
      addEventListener,
      readAsDataURL: vi.fn(function readAsDataURL() {
        addEventListener.loadCallback();
      })
    };
    const FileReader = vi.fn(() => mockReader);
    const app = createCryptoImageApp(document, { fetch, FileReader });

    const file = new File(['abc'], 'photo.png', { type: 'image/png' });
    const input = document.querySelector('[data-crypto-file]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });

    fireEvent.click(document.querySelector('[data-crypto-upload]'));
    await flushAsync();

    const nextPayload = JSON.parse(document.querySelector('[data-crypto-request]').value);
    expect(nextPayload).toMatchObject({ imageBase64: 'QUJD', mimeType: 'image/png', key: 'k', base64: 'AQID' });
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('loaded into request JSON');
    expect(app.fileToBase64).toBeTypeOf('function');
    expect(FileReader).toHaveBeenCalledTimes(1);

    const markerlessReader = {
      result: 'not-a-data-url',
      addEventListener: vi.fn((type, callback) => {
        if (type === 'load') {
          markerlessReader.loadCallback = callback;
        }
      }),
      readAsDataURL: vi.fn(function readAsDataURL() {
        markerlessReader.loadCallback();
      })
    };
    const markerlessApp = createCryptoImageApp(document, { fetch, FileReader: vi.fn(() => markerlessReader) });
    await expect(markerlessApp.fileToBase64(new File(['abc'], 'unknown.bin'))).resolves.toEqual({
      base64: '',
      mimeType: 'application/octet-stream'
    });
  });

  it('handles upload helper edge cases: no file, read failure, and no FileReader support', async () => {
    buildDom();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const addEventListener = vi.fn((type, callback) => {
      if (type === 'error') {
        addEventListener.errorCallback = callback;
      }
    });
    const mockReader = {
      result: '',
      addEventListener,
      readAsDataURL: vi.fn(function readAsDataURL() {
        addEventListener.errorCallback();
      })
    };
    const app = createCryptoImageApp(document, { fetch, FileReader: vi.fn(() => mockReader) });
    const input = document.querySelector('[data-crypto-file]');

    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    fireEvent.click(document.querySelector('[data-crypto-upload]'));
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('Choose an image');

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['abc'], 'broken.png', { type: 'image/png' })]
    });
    fireEvent.click(document.querySelector('[data-crypto-upload]'));
    await flushAsync();
    expect(document.querySelector('[data-crypto-status]').textContent).toContain('File upload failed');
    expect(document.querySelector('[data-crypto-response]').textContent).toContain('Failed to read file.');

    const noReaderApp = createCryptoImageApp(document, { fetch });
    await expect(noReaderApp.fileToBase64(new File(['abc'], 'no-reader.bin'))).rejects.toThrow(
      'FileReader is not supported in this browser.'
    );
  });
});

describe('initCryptoImageApp', () => {
  it('delegates to createCryptoImageApp', () => {
    buildDom();
    const app = initCryptoImageApp(document, { fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) });
    expect(app.operations.length).toBeGreaterThan(5);
  });
});
