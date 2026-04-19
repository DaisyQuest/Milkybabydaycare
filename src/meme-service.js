import { randomUUID } from 'node:crypto';

const MEME_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_FONT = 'Impact';
const DEFAULT_TEXT_COLOR = '#ffffff';
const DEFAULT_STROKE_COLOR = '#000000';

const STANDARD_TEMPLATES = Object.freeze({
  drake: 'https://i.imgflip.com/30b1gx.jpg',
  distractedBoyfriend: 'https://i.imgflip.com/1ur9b0.jpg',
  twoButtons: 'https://i.imgflip.com/1g8my4.jpg',
  changeMyMind: 'https://i.imgflip.com/24y43o.jpg',
  oneDoesNotSimply: 'https://i.imgflip.com/1bij.jpg'
});

function sanitizeOptionalString(value, maxLength = 240) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function sanitizeColor(value, fallback) {
  const trimmed = sanitizeOptionalString(value, 32);

  if (!trimmed) {
    return fallback;
  }

  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-zA-Z]{3,20}$/.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

function sanitizeFont(value) {
  const trimmed = sanitizeOptionalString(value, 80);

  if (!trimmed) {
    return DEFAULT_FONT;
  }

  return trimmed.replace(/[^a-zA-Z0-9\s,'"-]/g, '') || DEFAULT_FONT;
}

function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return '';
  }

  try {
    const parsed = new URL(rawUrl.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

function sanitizeSlug(rawSlug) {
  const trimmed = sanitizeOptionalString(rawSlug, 64).toLowerCase();

  if (!trimmed) {
    return '';
  }

  const slug = trimmed.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  if (!slug || slug.length < 2) {
    return '';
  }

  return slug;
}

function clampInt(rawValue, fallback, min, max) {
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed < min) {
    return min;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
}

export function resolveMemeImageUrl({ url, template }) {
  const explicitUrl = sanitizeUrl(url);

  if (explicitUrl) {
    return explicitUrl;
  }

  const safeTemplate = sanitizeOptionalString(template, 80);
  return STANDARD_TEMPLATES[safeTemplate] ?? '';
}

export function normalizeMemePayload(payload = {}) {
  const text = sanitizeOptionalString(payload.text, 240);
  const topText = sanitizeOptionalString(payload.topText, 120) || text;
  const bottomText = sanitizeOptionalString(payload.bottomText, 120);

  return {
    imageUrl: resolveMemeImageUrl(payload),
    template: sanitizeOptionalString(payload.template, 80),
    topText,
    bottomText,
    text,
    textColor: sanitizeColor(payload.textColor, DEFAULT_TEXT_COLOR),
    strokeColor: sanitizeColor(payload.strokeColor, DEFAULT_STROKE_COLOR),
    font: sanitizeFont(payload.font),
    fontSize: clampInt(payload.fontSize, 48, 16, 144),
    align: sanitizeOptionalString(payload.align, 16) || 'center',
    width: clampInt(payload.width, 1200, 100, 4096),
    height: clampInt(payload.height, 675, 100, 4096),
    slug: sanitizeSlug(payload.slug)
  };
}

function mapEntryToResponse(entry) {
  return {
    id: entry.id,
    slug: entry.slug,
    path: `/memes/${entry.slug || entry.id}`,
    expiresAt: entry.expiresAt,
    config: entry.config
  };
}

export function createMemeService({ now = Date.now, randomId = randomUUID } = {}) {
  const byId = new Map();
  const idBySlug = new Map();

  function pruneExpired() {
    const currentTime = now();
    byId.forEach((entry, id) => {
      if (entry.expiresAt <= currentTime) {
        byId.delete(id);

        if (entry.slug) {
          idBySlug.delete(entry.slug);
        }
      }
    });
  }

  function createMeme(payload, { allowSlug = false } = {}) {
    pruneExpired();
    const normalized = normalizeMemePayload(payload);

    if (!normalized.imageUrl) {
      return { ok: false, status: 400, error: 'Either url or a known template is required.' };
    }

    if (normalized.slug && !allowSlug) {
      return { ok: false, status: 403, error: 'Admin password required to specify slug.' };
    }

    if (normalized.slug && idBySlug.has(normalized.slug)) {
      return { ok: false, status: 409, error: 'That slug is already taken.' };
    }

    const id = randomId();
    const entry = {
      id,
      slug: normalized.slug,
      config: normalized,
      createdAt: now(),
      expiresAt: now() + MEME_TTL_MS
    };

    byId.set(id, entry);

    if (entry.slug) {
      idBySlug.set(entry.slug, id);
    }

    return { ok: true, status: 201, meme: mapEntryToResponse(entry) };
  }

  function getMeme(identifier) {
    pruneExpired();

    const key = sanitizeOptionalString(identifier, 80);

    if (!key) {
      return null;
    }

    const resolvedId = byId.has(key) ? key : idBySlug.get(key);

    if (!resolvedId) {
      return null;
    }

    return mapEntryToResponse(byId.get(resolvedId));
  }

  return {
    ttlMs: MEME_TTL_MS,
    templates: { ...STANDARD_TEMPLATES },
    normalizeMemePayload,
    createMeme,
    getMeme
  };
}
