const DATA_URL_PREFIX = /^data:(?<mime>[\w/+.-]+);base64,(?<data>[A-Za-z0-9+/=\s]+)$/i;

function normalizeBase64(raw) {
  if (typeof raw !== 'string') {
    return '';
  }

  return raw.replace(/\s+/g, '').trim();
}

export function parseImageInput(rawInput) {
  if (typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return { ok: false, error: 'imageBase64 is required.' };
  }

  const trimmed = rawInput.trim();
  const match = trimmed.match(DATA_URL_PREFIX);

  if (match?.groups?.data) {
    return {
      ok: true,
      mimeType: match.groups.mime || 'application/octet-stream',
      base64: normalizeBase64(match.groups.data)
    };
  }

  return {
    ok: true,
    mimeType: 'application/octet-stream',
    base64: normalizeBase64(trimmed)
  };
}

export function base64ToBytes(base64) {
  const normalized = normalizeBase64(base64);

  if (!normalized) {
    return Buffer.alloc(0);
  }

  return Buffer.from(normalized, 'base64');
}

export function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

export function toDataUrl(base64, mimeType = 'application/octet-stream') {
  return `data:${mimeType};base64,${normalizeBase64(base64)}`;
}

function xorTransform(bytes, keyBytes) {
  if (keyBytes.length === 0) {
    return Uint8Array.from(bytes);
  }

  const out = new Uint8Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    out[index] = bytes[index] ^ keyBytes[index % keyBytes.length];
  }

  return out;
}

export function encryptImageNoKey(imageBase64) {
  const parsed = parseImageInput(imageBase64);

  if (!parsed.ok) {
    return parsed;
  }

  const bytes = base64ToBytes(parsed.base64);
  const fallbackSeed = bytes.length === 0 ? 197 : bytes.length;
  const keyBytes = Uint8Array.from([31, 47, 67, 83, fallbackSeed % 251]);
  const cipherBytes = xorTransform(bytes, keyBytes);

  return {
    ok: true,
    mimeType: parsed.mimeType,
    imageBase64: bytesToBase64(cipherBytes),
    algorithm: 'xor-no-key-v1'
  };
}

export function decryptImageNoKey(imageBase64) {
  const decrypted = encryptImageNoKey(imageBase64);

  if (!decrypted.ok) {
    return decrypted;
  }

  return {
    ...decrypted,
    algorithm: 'xor-no-key-v1'
  };
}

export function encryptImageWithKey(imageBase64, key) {
  const parsed = parseImageInput(imageBase64);

  if (!parsed.ok) {
    return parsed;
  }

  if (typeof key !== 'string' || key.length === 0) {
    return { ok: false, error: 'key is required.' };
  }

  const bytes = base64ToBytes(parsed.base64);
  const keyBytes = Buffer.from(key, 'utf8');
  const cipherBytes = xorTransform(bytes, keyBytes);

  return {
    ok: true,
    mimeType: parsed.mimeType,
    imageBase64: bytesToBase64(cipherBytes),
    algorithm: 'xor-key-v1'
  };
}

export function decryptImageWithKey(imageBase64, key) {
  return encryptImageWithKey(imageBase64, key);
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function addNoiseToImage(imageBase64, noiseType = 'random', intensity = 0.15, rng = Math.random) {
  const parsed = parseImageInput(imageBase64);

  if (!parsed.ok) {
    return parsed;
  }

  const safeIntensity = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.15;
  const bytes = base64ToBytes(parsed.base64);

  const noisy = Uint8Array.from(bytes, (value) => {
    if (noiseType === 'gaussian') {
      const gaussianOffset = (rng() + rng() + rng() - 1.5) * 255 * safeIntensity;
      return clampChannel(value + gaussianOffset);
    }

    if (noiseType === 'salt_pepper') {
      const roll = rng();
      if (roll < safeIntensity / 2) {
        return 0;
      }
      if (roll > 1 - safeIntensity / 2) {
        return 255;
      }
      return value;
    }

    const randomOffset = (rng() * 2 - 1) * 255 * safeIntensity;
    return clampChannel(value + randomOffset);
  });

  return {
    ok: true,
    mimeType: parsed.mimeType,
    imageBase64: bytesToBase64(noisy),
    noiseType,
    intensity: safeIntensity
  };
}

export function colorRandomizer(imageBase64, rng = Math.random) {
  const parsed = parseImageInput(imageBase64);

  if (!parsed.ok) {
    return parsed;
  }

  const bytes = base64ToBytes(parsed.base64);

  if (bytes.length === 0) {
    return {
      ok: true,
      mimeType: parsed.mimeType,
      imageBase64: '',
      colorShift: { r: 0, g: 0, b: 0 }
    };
  }

  const shift = {
    r: Math.floor(rng() * 128) - 64,
    g: Math.floor(rng() * 128) - 64,
    b: Math.floor(rng() * 128) - 64
  };

  const randomized = Uint8Array.from(bytes, (value, index) => {
    const channel = index % 3;
    if (channel === 0) {
      return clampChannel(value + shift.r);
    }
    if (channel === 1) {
      return clampChannel(value + shift.g);
    }
    return clampChannel(value + shift.b);
  });

  return {
    ok: true,
    mimeType: parsed.mimeType,
    imageBase64: bytesToBase64(randomized),
    colorShift: shift
  };
}

export function imageToBase64(input) {
  const parsed = parseImageInput(input);

  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    mimeType: parsed.mimeType,
    imageBase64: parsed.base64
  };
}

export function base64ToImage(base64, mimeType = 'image/png') {
  if (typeof base64 !== 'string' || base64.trim() === '') {
    return { ok: false, error: 'base64 is required.' };
  }

  return {
    ok: true,
    imageDataUrl: toDataUrl(base64, mimeType)
  };
}

function randomHex(rng) {
  return `#${Math.floor(rng() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;
}

function randomRect(index, complexity, rng) {
  const x = Math.floor(rng() * 100);
  const y = Math.floor(rng() * 100);
  const width = 4 + Math.floor(rng() * 28);
  const height = 4 + Math.floor(rng() * 28);
  const opacity = Math.max(0.2, Math.min(1, 0.3 + rng() * 0.7));
  return `<rect data-i=\"${index}\" x=\"${x}\" y=\"${y}\" width=\"${width}\" height=\"${height}\" fill=\"${randomHex(rng)}\" fill-opacity=\"${opacity.toFixed(2)}\" transform=\"rotate(${Math.floor(rng() * complexity)} 50 50)\"/>`;
}

export function randomCryptographicImage(mode = 'simple', rng = Math.random) {
  const normalized = ['simple', 'complex', 'extreme'].includes(mode) ? mode : 'simple';
  const rectCount = normalized === 'simple' ? 8 : normalized === 'complex' ? 24 : 64;
  const complexity = normalized === 'simple' ? 45 : normalized === 'complex' ? 180 : 360;
  const background = randomHex(rng);

  const rects = Array.from({ length: rectCount }, (_, index) => randomRect(index, complexity, rng)).join('');
  const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" fill=\"${background}\"/>${rects}</svg>`;

  return {
    ok: true,
    mode: normalized,
    mimeType: 'image/svg+xml',
    imageBase64: Buffer.from(svg, 'utf8').toString('base64'),
    imageDataUrl: toDataUrl(Buffer.from(svg, 'utf8').toString('base64'), 'image/svg+xml')
  };
}
