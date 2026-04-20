import { describe, expect, it } from 'vitest';
import {
  addNoiseToImage,
  base64ToBytes,
  base64ToImage,
  bytesToBase64,
  colorRandomizer,
  decryptImageNoKey,
  decryptImageWithKey,
  encryptImageNoKey,
  encryptImageWithKey,
  imageToBase64,
  parseImageInput,
  randomCryptographicImage,
  toDataUrl
} from '../src/crypto-image-service.js';

describe('parseImageInput', () => {
  it('requires image input', () => {
    expect(parseImageInput()).toEqual({ ok: false, error: 'imageBase64 is required.' });
  });

  it('parses data urls and raw base64', () => {
    expect(parseImageInput('data:image/png;base64,AA==')).toEqual({
      ok: true,
      mimeType: 'image/png',
      base64: 'AA=='
    });

    expect(parseImageInput('AA==')).toEqual({
      ok: true,
      mimeType: 'application/octet-stream',
      base64: 'AA=='
    });
  });
});

describe('binary transforms', () => {
  it('converts between bytes and base64 and data urls', () => {
    const bytes = base64ToBytes('AQID');
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(bytesToBase64(bytes)).toBe('AQID');
    expect(toDataUrl('AQID', 'image/png')).toBe('data:image/png;base64,AQID');
  });

  it('handles empty base64 safely', () => {
    expect(base64ToBytes('')).toEqual(Buffer.alloc(0));
  });
});

describe('encryption and decryption', () => {
  const base64 = 'AQIDBA==';

  it('encrypts and decrypts without user key', () => {
    const encrypted = encryptImageNoKey(base64);
    expect(encrypted.ok).toBe(true);
    expect(encrypted.imageBase64).not.toBe(base64);

    const decrypted = decryptImageNoKey(encrypted.imageBase64);
    expect(decrypted.imageBase64).toBe(base64);
  });

  it('encrypts and decrypts with key', () => {
    const encrypted = encryptImageWithKey(base64, 'abc');
    expect(encrypted.ok).toBe(true);

    const decrypted = decryptImageWithKey(encrypted.imageBase64, 'abc');
    expect(decrypted.imageBase64).toBe(base64);
  });

  it('rejects missing image or key', () => {
    expect(encryptImageNoKey()).toEqual({ ok: false, error: 'imageBase64 is required.' });
    expect(encryptImageWithKey(base64, '')).toEqual({ ok: false, error: 'key is required.' });
  });

  it('covers no-key fallback seed path with empty image bytes', () => {
    const encrypted = encryptImageNoKey('');
    expect(encrypted).toEqual({ ok: false, error: 'imageBase64 is required.' });
  });
});

describe('noise and color mutation', () => {
  const source = 'AAEC';

  it('applies gaussian/random/salt_pepper noise modes', () => {
    const gaussian = addNoiseToImage(source, 'gaussian', 0.5, () => 0.75);
    const random = addNoiseToImage(source, 'random', 0.5, () => 0.5);
    const saltPepper = addNoiseToImage(source, 'salt_pepper', 0.8, () => 0.99);

    expect(gaussian.ok).toBe(true);
    expect(random.ok).toBe(true);
    expect(saltPepper.ok).toBe(true);
    expect(saltPepper.imageBase64).not.toBe(source);
  });

  it('clamps invalid intensity and rejects missing image', () => {
    const result = addNoiseToImage(source, 'random', Number.NaN, () => 0.5);
    expect(result.intensity).toBe(0.15);
    expect(addNoiseToImage()).toEqual({ ok: false, error: 'imageBase64 is required.' });
  });

  it('randomizes colors and handles empty bytes', () => {
    const randomized = colorRandomizer(source, () => 0.5);
    expect(randomized.ok).toBe(true);
    expect(randomized.colorShift).toEqual({ r: 0, g: 0, b: 0 });

    const empty = colorRandomizer('  ', () => 0.5);
    expect(empty).toEqual({ ok: false, error: 'imageBase64 is required.' });
  });
});

describe('image/base64 helpers', () => {
  it('normalizes image to base64 and converts base64 to image data url', () => {
    expect(imageToBase64('data:image/jpeg;base64,AQID')).toEqual({
      ok: true,
      mimeType: 'image/jpeg',
      imageBase64: 'AQID'
    });

    expect(base64ToImage('AQID', 'image/jpeg')).toEqual({
      ok: true,
      imageDataUrl: 'data:image/jpeg;base64,AQID'
    });
  });

  it('rejects empty base64 in base64-to-image', () => {
    expect(base64ToImage()).toEqual({ ok: false, error: 'base64 is required.' });
  });
});

describe('random cryptographic images', () => {
  it('creates simple, complex, and extreme outputs and defaults invalid mode to simple', () => {
    const simple = randomCryptographicImage('simple', () => 0.1);
    const complex = randomCryptographicImage('complex', () => 0.2);
    const extreme = randomCryptographicImage('extreme', () => 0.3);
    const fallback = randomCryptographicImage('unknown', () => 0.4);

    expect(simple.ok).toBe(true);
    expect(simple.mode).toBe('simple');
    expect(complex.mode).toBe('complex');
    expect(extreme.mode).toBe('extreme');
    expect(fallback.mode).toBe('simple');
    expect(simple.imageDataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});
