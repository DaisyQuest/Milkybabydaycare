import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import {
  clampMemeTextSize,
  createMemeGeneratorApp,
  drawMemePreview,
  initMemeGenerator,
  loadImageFromFile,
  retrieveMemeByUrl,
  splitMemeText
} from '../src/meme-generator.js';

function createCanvasContext() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    strokeText: vi.fn(),
    fillText: vi.fn(),
    textAlign: '',
    lineJoin: '',
    lineWidth: 0,
    font: '',
    fillStyle: '',
    strokeStyle: ''
  };
}

function buildDom() {
  document.body.innerHTML = `
    <main data-meme-root>
      <input type="file" data-meme-file />
      <input type="url" data-meme-url />
      <button type="button" data-meme-url-load>Retrieve</button>
      <textarea data-meme-top></textarea>
      <textarea data-meme-bottom></textarea>
      <input type="range" value="42" data-meme-size />
      <p data-meme-status></p>
      <canvas data-meme-canvas></canvas>
    </main>
  `;

  const context = createCanvasContext();
  const canvas = document.querySelector('[data-meme-canvas]');
  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: vi.fn(() => context)
  });

  return { canvas, context };
}

describe('clampMemeTextSize', () => {
  it('returns default when value is not numeric', () => {
    expect(clampMemeTextSize('abc')).toBe(42);
  });

  it('clamps below and above threshold', () => {
    expect(clampMemeTextSize('10')).toBe(18);
    expect(clampMemeTextSize('200')).toBe(96);
    expect(clampMemeTextSize('30')).toBe(30);
  });
});

describe('splitMemeText', () => {
  it('returns clean lines and limits count', () => {
    expect(splitMemeText(' a \n\n b \n c \n d \n e ')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns empty list for non-string values', () => {
    expect(splitMemeText(undefined)).toEqual([]);
  });
});

describe('drawMemePreview', () => {
  it('returns graceful failure when canvas context is missing', () => {
    const result = drawMemePreview({ canvas: { getContext: () => null } });
    expect(result).toEqual({ drawn: false, reason: 'missing-canvas' });
  });

  it('draws gradient placeholder without image', () => {
    const { canvas, context } = buildDom();
    const result = drawMemePreview({ canvas, topText: 'Top', bottomText: 'Bottom', fontSize: 40 });

    expect(result.drawn).toBe(true);
    expect(context.fillRect).toHaveBeenCalled();
    expect(context.strokeText).toHaveBeenCalledWith('TOP', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('BOTTOM', expect.any(Number), expect.any(Number));
  });

  it('draws image when present with natural dimensions', () => {
    const { canvas, context } = buildDom();
    const image = { naturalWidth: 800, naturalHeight: 400 };
    drawMemePreview({ canvas, image });
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 800, 400);
  });

  it('falls back to width and height when natural dimensions are missing', () => {
    const { canvas, context } = buildDom();
    const image = { width: 640, height: 360 };
    drawMemePreview({ canvas, image });
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 640, 360);
  });
});

describe('loadImageFromFile', () => {
  it('rejects unsupported file type', async () => {
    await expect(loadImageFromFile({ type: 'text/plain' })).rejects.toThrow('Please choose a PNG, JPG, GIF, or WEBP image.');
  });

  it('resolves when image loader succeeds', async () => {
    class FakeImage {
      set src(value) {
        this._src = value;
        this.width = 50;
        this.height = 20;
        this.onload();
      }
    }

    const createObjectURL = vi.fn(() => 'blob:demo');
    const revokeObjectURL = vi.fn();

    const image = await loadImageFromFile(
      { type: 'image/png' },
      { createObjectURL, revokeObjectURL, ImageCtor: FakeImage }
    );

    expect(image).toBeInstanceOf(FakeImage);
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:demo');
  });


  it('supports default URL handlers when environment provides them', async () => {
    class FakeImage {
      set src(value) {
        this._src = value;
        this.onload();
      }
    }

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:default';
    URL.revokeObjectURL = () => {};

    const image = await loadImageFromFile({ type: 'image/png' }, { ImageCtor: FakeImage });
    expect(image).toBeInstanceOf(FakeImage);

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('rejects when image loader fails', async () => {
    class FakeImage {
      set src(value) {
        this._src = value;
        this.onerror();
      }
    }

    const revokeObjectURL = vi.fn();

    await expect(
      loadImageFromFile(
        { type: 'image/jpeg' },
        { createObjectURL: () => 'blob:oops', revokeObjectURL, ImageCtor: FakeImage }
      )
    ).rejects.toThrow('We could not read that image. Try another one!');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:oops');
  });
});

describe('retrieveMemeByUrl', () => {
  const goodResponse = {
    ok: true,
    blob: async () => ({ type: 'image/png' })
  };

  class SuccessImage {
    set src(value) {
      this._src = value;
      this.naturalWidth = 100;
      this.naturalHeight = 50;
      this.onload();
    }
  }

  it('rejects when url is empty', async () => {
    await expect(retrieveMemeByUrl('')).rejects.toThrow('Please enter an image URL first.');
  });

  it('rejects invalid url formats', async () => {
    await expect(retrieveMemeByUrl('not a valid url')).rejects.toThrow('Please enter a valid URL.');
  });

  it('rejects unsupported protocols', async () => {
    await expect(retrieveMemeByUrl('ftp://example.com/file.png')).rejects.toThrow('Only http and https image URLs are supported.');
  });

  it('rejects fetch network failures', async () => {
    await expect(retrieveMemeByUrl('https://example.com/a.png', { fetchImpl: () => Promise.reject(new Error('net')) })).rejects.toThrow(
      'Could not fetch that URL. Check the link and try again.'
    );
  });

  it('rejects unsuccessful responses', async () => {
    await expect(retrieveMemeByUrl('https://example.com/a.png', { fetchImpl: async () => ({ ok: false }) })).rejects.toThrow(
      'Could not fetch that URL. The server returned an error.'
    );
  });

  it('rejects unsupported blob mime types', async () => {
    await expect(
      retrieveMemeByUrl('https://example.com/a.png', {
        fetchImpl: async () => ({ ok: true, blob: async () => ({ type: 'text/plain' }) })
      })
    ).rejects.toThrow('The URL did not return a supported image type.');
  });

  it('loads remote image when fetch and blob are valid', async () => {
    const createObjectURL = vi.fn(() => 'blob:remote');
    const revokeObjectURL = vi.fn();

    const image = await retrieveMemeByUrl('https://example.com/meme.png', {
      fetchImpl: async () => goodResponse,
      createObjectURL,
      revokeObjectURL,
      ImageCtor: SuccessImage
    });

    expect(image).toBeInstanceOf(SuccessImage);
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:remote');
  });


  it('supports default fetch and URL handlers when environment provides them', async () => {
    class SuccessImageTwo {
      set src(value) {
        this._src = value;
        this.onload();
      }
    }

    const originalFetch = globalThis.fetch;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    globalThis.fetch = async () => ({ ok: true, blob: async () => ({ type: 'image/png' }) });
    URL.createObjectURL = () => 'blob:defaults-remote';
    URL.revokeObjectURL = () => {};

    const image = await retrieveMemeByUrl('https://example.com/defaults.png', { ImageCtor: SuccessImageTwo });
    expect(image).toBeInstanceOf(SuccessImageTwo);

    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('uses png fallback mime type when blob type is missing', async () => {
    const image = await retrieveMemeByUrl('https://example.com/fallback', {
      fetchImpl: async () => ({ ok: true, blob: async () => ({}) }),
      createObjectURL: () => 'blob:remote2',
      revokeObjectURL: () => {},
      ImageCtor: SuccessImage
    });

    expect(image).toBeInstanceOf(SuccessImage);
  });
});

describe('createMemeGeneratorApp', () => {
  it('throws when required elements are missing', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => createMemeGeneratorApp(document, window)).toThrow('Meme generator requires all required DOM controls and canvas.');
  });

  it('updates text and size state during interaction', () => {
    buildDom();
    const app = createMemeGeneratorApp(document, window);

    const top = document.querySelector('[data-meme-top]');
    const bottom = document.querySelector('[data-meme-bottom]');
    const size = document.querySelector('[data-meme-size]');

    fireEvent.input(top, { target: { value: 'hello top' } });
    fireEvent.input(bottom, { target: { value: 'hello bottom' } });
    fireEvent.input(size, { target: { value: '999' } });

    expect(app.getState()).toMatchObject({
      topText: 'hello top',
      bottomText: 'hello bottom',
      fontSize: 96
    });
    expect(size.value).toBe('96');
  });

  it('handles empty file selection branch', async () => {
    buildDom();
    const app = createMemeGeneratorApp(document, window);

    await app.handleFile(undefined);

    expect(app.getState().image).toBeNull();
    expect(document.querySelector('[data-meme-status]').textContent).toContain('No image selected');
  });

  it('handles file load failure in app flow', async () => {
    buildDom();

    const win = {
      URL: {
        createObjectURL: () => 'blob:bad',
        revokeObjectURL: () => {}
      },
      fetch: vi.fn(),
      Image: class {
        set src(value) {
          this._src = value;
          this.onerror();
        }
      }
    };

    const app = createMemeGeneratorApp(document, win);
    await app.handleFile({ type: 'image/png', name: 'x.png' });

    expect(document.querySelector('[data-meme-status]').textContent).toContain('could not read');
    expect(app.getState().image).toBeNull();
  });

  it('loads a file from change event and updates status with filename', async () => {
    buildDom();

    const win = {
      URL: {
        createObjectURL: () => 'blob:good',
        revokeObjectURL: () => {}
      },
      fetch: vi.fn(),
      Image: class {
        set src(value) {
          this._src = value;
          this.naturalWidth = 100;
          this.naturalHeight = 50;
          this.onload();
        }
      }
    };

    const app = createMemeGeneratorApp(document, win);
    const input = document.querySelector('[data-meme-file]');
    const file = { type: 'image/png', name: 'baby.png' };

    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => [file]
    });

    fireEvent.change(input);
    await Promise.resolve();

    expect(document.querySelector('[data-meme-status]').textContent).toContain('Loaded baby.png');
    expect(app.getState().image).toBeTruthy();
  });

  it('handles remote url load failures through button interaction', async () => {
    buildDom();

    const win = {
      URL: {
        createObjectURL: () => 'blob:any',
        revokeObjectURL: () => {}
      },
      fetch: vi.fn(async () => ({ ok: false })),
      Image: class {}
    };

    createMemeGeneratorApp(document, win);
    const urlInput = document.querySelector('[data-meme-url]');
    const button = document.querySelector('[data-meme-url-load]');

    urlInput.value = 'https://example.com/404.png';
    fireEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-meme-status]').textContent).toContain('server returned an error');
  });

  it('loads remote url successfully through api and button paths', async () => {
    buildDom();

    const win = {
      URL: {
        createObjectURL: () => 'blob:remote-ui',
        revokeObjectURL: () => {}
      },
      fetch: vi.fn(async () => ({ ok: true, blob: async () => ({ type: 'image/png' }) })),
      Image: class {
        set src(value) {
          this._src = value;
          this.naturalWidth = 120;
          this.naturalHeight = 80;
          this.onload();
        }
      }
    };

    const app = createMemeGeneratorApp(document, win);
    await app.handleRemoteUrl('https://example.com/ok.png');
    expect(document.querySelector('[data-meme-status]').textContent).toContain('Remote image loaded');

    const urlInput = document.querySelector('[data-meme-url]');
    const button = document.querySelector('[data-meme-url-load]');
    urlInput.value = 'https://example.com/second.png';
    fireEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(win.fetch).toHaveBeenCalledTimes(2);
    expect(app.getState().image).toBeTruthy();
  });
});

describe('initMemeGenerator', () => {
  it('delegates to app creation', () => {
    buildDom();
    const app = initMemeGenerator(document, {
      ...window,
      fetch: vi.fn(async () => ({ ok: false })),
      URL: window.URL,
      Image: window.Image
    });
    expect(app.getState().fontSize).toBe(42);
  });
});
