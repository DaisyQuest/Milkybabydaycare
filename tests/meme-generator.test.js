import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import {
  buildFilterChain,
  clampCropValue,
  clampMemeTextSize,
  createBorderSegments,
  createMemeGeneratorApp,
  drawMemePreview,
  initMemeGenerator,
  loadImageFromFile,
  normalizeCrop,
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
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    textAlign: '',
    lineJoin: '',
    lineWidth: 0,
    font: '',
    fillStyle: '',
    strokeStyle: '',
    filter: 'none',
    shadowBlur: 0,
    shadowColor: ''
  };
}

function buildDom() {
  document.body.innerHTML = `
    <main data-meme-root>
      <button type="button" data-meme-add-panel>Add</button>
      <div data-meme-panel-rows></div>
      <input type="file" data-meme-file />
      <input type="url" data-meme-url />
      <button type="button" data-meme-url-load>Retrieve</button>
      <textarea data-meme-top></textarea>
      <textarea data-meme-bottom></textarea>
      <input type="range" value="42" data-meme-size />
      <input type="number" value="0" data-meme-crop-x />
      <input type="number" value="0" data-meme-crop-y />
      <input type="number" value="100" data-meme-crop-width />
      <input type="number" value="100" data-meme-crop-height />
      <select data-meme-border-mode><option value="solid">solid</option><option value="two-color">two</option><option value="rainbow">rainbow</option></select>
      <input type="color" value="#ffffff" data-meme-border-color />
      <input type="color" value="#0f172a" data-meme-border-color-second />
      <input type="number" value="24" data-meme-border-segment1 />
      <input type="number" value="24" data-meme-border-segment2 />
      <input type="range" value="6" data-meme-border-stroke />
      <input type="checkbox" data-meme-border-shadow />
      <input type="checkbox" data-meme-filter-negative />
      <input type="checkbox" data-meme-filter-sepia />
      <input type="checkbox" data-meme-filter-bw />
      <input type="checkbox" data-meme-filter-noire />
      <input type="checkbox" data-meme-filter-sharp />
      <input type="checkbox" data-meme-filter-dull />
      <input type="checkbox" data-meme-filter-warm />
      <input type="checkbox" data-meme-filter-cool />
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

describe('small helpers', () => {
  it('clamps text size values', () => {
    expect(clampMemeTextSize('abc')).toBe(42);
    expect(clampMemeTextSize('10')).toBe(18);
    expect(clampMemeTextSize('200')).toBe(96);
    expect(clampMemeTextSize('30')).toBe(30);
  });

  it('clamps crop values and normalizes crop boxes', () => {
    expect(clampCropValue('abc')).toBe(0);
    expect(clampCropValue(130)).toBe(100);
    expect(normalizeCrop({ x: 90, y: 95, width: 30, height: 12 })).toEqual({ x: 90, y: 95, width: 10, height: 5 });
    expect(normalizeCrop({ x: -10, y: 4, width: 0, height: 0 })).toEqual({ x: 0, y: 4, width: 1, height: 1 });
  });

  it('returns clean text lines and limits count', () => {
    expect(splitMemeText(' a \n\n b \n c \n d \n e ')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitMemeText(undefined)).toEqual([]);
  });

  it('builds filter chains and supports default none', () => {
    expect(buildFilterChain({})).toBe('none');
    expect(buildFilterChain({ negativeColorToggle: true, sepia: true, sharp: true })).toContain('invert(1)');
  });

  it('creates alternating border segments', () => {
    expect(createBorderSegments(0, 10, 10)).toEqual([]);
    expect(createBorderSegments(25, 10, 8)).toEqual([
      { start: 0, end: 10, isPrimary: true },
      { start: 10, end: 18, isPrimary: false },
      { start: 18, end: 25, isPrimary: true }
    ]);
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
    expect(result.panelCount).toBe(1);
    expect(context.fillRect).toHaveBeenCalled();
    expect(context.strokeText).toHaveBeenCalledWith('TOP', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('BOTTOM', expect.any(Number), expect.any(Number));
  });

  it('draws cropped images and panel dividers for multi-panel mode', () => {
    const { canvas, context } = buildDom();
    const image = { naturalWidth: 1000, naturalHeight: 500 };
    const result = drawMemePreview({
      canvas,
      fontSize: 32,
      panels: [
        { image, topText: 'one', bottomText: 'first', crop: { x: 10, y: 10, width: 80, height: 80 } },
        { image, topText: 'two', bottomText: 'second', crop: { x: 20, y: 20, width: 50, height: 50 } }
      ]
    });

    expect(result.height).toBe(1008);
    expect(context.drawImage).toHaveBeenNthCalledWith(1, image, 100, 50, 800, 400, 0, 0, 1000, 500);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, image, 200, 100, 500, 250, 0, 0, 1000, 500);
  });

  it('draws solid, rainbow, and two-color border variants', () => {
    const { canvas, context } = buildDom();
    drawMemePreview({ canvas, border: { mode: 'solid', strokeWidth: 4, color: '#fff', shadow: true } });
    expect(context.strokeRect).toHaveBeenCalled();

    drawMemePreview({ canvas, border: { mode: 'rainbow', strokeWidth: 5, shadow: false } });
    expect(context.createLinearGradient).toHaveBeenCalled();

    drawMemePreview({
      canvas,
      border: {
        mode: 'two-color',
        strokeWidth: 4,
        color: '#ffffff',
        twoColorSecondColor: '#000000',
        segmentColor1LengthPx: 20,
        segmentColor2LengthPx: 20,
        shadow: false
      }
    });
    expect(context.beginPath).toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalled();
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

  it('rejects bad urls and fetch failures', async () => {
    await expect(retrieveMemeByUrl('')).rejects.toThrow('Please enter an image URL first.');
    await expect(retrieveMemeByUrl('not a valid url')).rejects.toThrow('Please enter a valid URL.');
    await expect(retrieveMemeByUrl('ftp://example.com/file.png')).rejects.toThrow('Only http and https image URLs are supported.');
    await expect(retrieveMemeByUrl('https://example.com/a.png', { fetchImpl: () => Promise.reject(new Error('net')) })).rejects.toThrow(
      'Could not fetch that URL. Check the link and try again.'
    );
    await expect(retrieveMemeByUrl('https://example.com/a.png', { fetchImpl: async () => ({ ok: false }) })).rejects.toThrow(
      'Could not fetch that URL. The server returned an error.'
    );
    await expect(
      retrieveMemeByUrl('https://example.com/a.png', {
        fetchImpl: async () => ({ ok: true, blob: async () => ({ type: 'text/plain' }) })
      })
    ).rejects.toThrow('The URL did not return a supported image type.');
  });

  it('loads remote image and handles blob fallback branches', async () => {
    const createObjectURL = vi.fn(() => 'blob:remote');
    const revokeObjectURL = vi.fn();
    let inputToObjectUrl = null;

    const image = await retrieveMemeByUrl('https://example.com/meme.png', {
      fetchImpl: async () => goodResponse,
      createObjectURL: (value) => {
        inputToObjectUrl = value;
        return createObjectURL(value);
      },
      revokeObjectURL,
      ImageCtor: SuccessImage
    });

    expect(image).toBeInstanceOf(SuccessImage);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:remote');
    expect(inputToObjectUrl).toBeInstanceOf(Blob);

    const existingBlob = new Blob(['abc'], { type: 'image/webp' });
    let preservedBlob = null;
    await retrieveMemeByUrl('https://example.com/existing', {
      fetchImpl: async () => ({ ok: true, blob: async () => existingBlob }),
      createObjectURL: (value) => {
        preservedBlob = value;
        return 'blob:existing';
      },
      revokeObjectURL: () => {},
      ImageCtor: SuccessImage
    });
    expect(preservedBlob).toBe(existingBlob);

    let fallbackBlob = null;
    await retrieveMemeByUrl('https://example.com/fallback', {
      fetchImpl: async () => ({ ok: true, blob: async () => ({}) }),
      createObjectURL: (value) => {
        fallbackBlob = value;
        return 'blob:fallback';
      },
      revokeObjectURL: () => {},
      ImageCtor: SuccessImage
    });
    expect(fallbackBlob).toBeInstanceOf(Blob);
    expect(fallbackBlob.type).toBe('image/png');
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
});

describe('createMemeGeneratorApp', () => {
  it('throws when required elements are missing', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => createMemeGeneratorApp(document, window)).toThrow('Meme generator requires all required DOM controls and canvas.');
  });

  it('throws when any filter control is missing', () => {
    buildDom();
    document.querySelector('[data-meme-filter-cool]').remove();
    expect(() => createMemeGeneratorApp(document, window)).toThrow('Meme generator requires all required DOM controls and canvas.');
  });

  it('updates active panel state for text, crop, size, filters, border, and row selection', () => {
    buildDom();
    const app = createMemeGeneratorApp(document, window);

    const top = document.querySelector('[data-meme-top]');
    const bottom = document.querySelector('[data-meme-bottom]');
    const size = document.querySelector('[data-meme-size]');
    const cropX = document.querySelector('[data-meme-crop-x]');
    const cropWidth = document.querySelector('[data-meme-crop-width]');
    const addPanel = document.querySelector('[data-meme-add-panel]');
    const sepia = document.querySelector('[data-meme-filter-sepia]');
    const borderMode = document.querySelector('[data-meme-border-mode]');
    const borderPrimary = document.querySelector('[data-meme-border-color]');
    const borderSecondary = document.querySelector('[data-meme-border-color-second]');
    const borderSegmentOne = document.querySelector('[data-meme-border-segment1]');
    const borderSegmentTwo = document.querySelector('[data-meme-border-segment2]');
    const borderStroke = document.querySelector('[data-meme-border-stroke]');
    const borderShadow = document.querySelector('[data-meme-border-shadow]');

    fireEvent.input(top, { target: { value: 'hello top' } });
    fireEvent.input(bottom, { target: { value: 'hello bottom' } });
    fireEvent.input(size, { target: { value: '999' } });
    fireEvent.input(cropX, { target: { value: '95' } });
    fireEvent.input(cropWidth, { target: { value: '20' } });
    fireEvent.click(addPanel);

    const rowZero = document.querySelector('[data-meme-panel-row="0"]');
    fireEvent.click(rowZero);

    fireEvent.click(sepia);
    fireEvent.change(borderMode, { target: { value: 'rainbow' } });
    fireEvent.input(borderPrimary, { target: { value: '#123456' } });
    fireEvent.input(borderSecondary, { target: { value: '#654321' } });
    fireEvent.input(borderSegmentOne, { target: { value: '44' } });
    fireEvent.input(borderSegmentTwo, { target: { value: '18' } });
    fireEvent.input(borderStroke, { target: { value: '-20' } });
    fireEvent.click(borderShadow);

    expect(app.getState()).toMatchObject({
      topText: 'hello top',
      bottomText: 'hello bottom',
      fontSize: 96
    });
    expect(size.value).toBe('96');
    expect(app.getState().panels[0].crop).toEqual({ x: 95, y: 0, width: 5, height: 100 });
    expect(app.getState().filters.sepia).toBe(true);
    expect(app.getState().border.mode).toBe('rainbow');
    expect(app.getState().border.color).toBe('#123456');
    expect(app.getState().border.twoColorSecondColor).toBe('#654321');
    expect(app.getState().border.segmentColor1LengthPx).toBe(44);
    expect(app.getState().border.segmentColor2LengthPx).toBe(18);
    expect(app.getState().border.strokeWidth).toBe(0);
    expect(app.getState().border.shadow).toBe(true);
    expect(app.getState().panels).toHaveLength(2);
  });

  it('handles image load and empty file selection branches', async () => {
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

    expect(document.querySelector('[data-meme-status]').textContent).toContain('Loaded baby.png for panel 1');
    expect(app.getState().image).toBeTruthy();

    await app.handleFile(undefined);
    expect(app.getState().image).toBeNull();
    expect(document.querySelector('[data-meme-status]').textContent).toContain('No image selected');
  });

  it('handles failed file loads and remote url branches', async () => {
    buildDom();

    const win = {
      URL: {
        createObjectURL: () => 'blob:any',
        revokeObjectURL: () => {}
      },
      fetch: vi.fn(async () => ({ ok: false })),
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

    const urlInput = document.querySelector('[data-meme-url]');
    const button = document.querySelector('[data-meme-url-load]');
    urlInput.value = 'https://example.com/404.png';
    fireEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('[data-meme-status]').textContent).toContain('server returned an error');

    win.fetch = vi.fn(async () => ({ ok: true, blob: async () => ({ type: 'image/png' }) }));
    win.Image = class {
      set src(value) {
        this._src = value;
        this.onload();
      }
    };

    await app.handleRemoteUrl('https://example.com/ok.png');
    expect(document.querySelector('[data-meme-status]').textContent).toContain('Remote image loaded for panel 1');
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
