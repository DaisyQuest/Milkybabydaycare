const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function clampMemeTextSize(rawSize, min = 18, max = 96) {
  const numeric = Number.parseInt(rawSize, 10);

  if (!Number.isFinite(numeric)) {
    return 42;
  }

  if (numeric < min) {
    return min;
  }

  if (numeric > max) {
    return max;
  }

  return numeric;
}

export function splitMemeText(rawText) {
  if (typeof rawText !== 'string') {
    return [];
  }

  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function drawMemePreview({
  canvas,
  image,
  topText = '',
  bottomText = '',
  fontSize = 42,
  strokeColor = '#091025',
  fillColor = '#ffffff'
}) {
  const context = canvas?.getContext?.('2d');

  if (!context || !canvas) {
    return { drawn: false, reason: 'missing-canvas' };
  }

  const width = image?.naturalWidth || image?.width || 1200;
  const height = image?.naturalHeight || image?.height || 675;

  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);

  if (image) {
    context.drawImage(image, 0, 0, width, height);
  } else {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#8fe8ff');
    gradient.addColorStop(0.5, '#ffd8aa');
    gradient.addColorStop(1, '#ff9fb8');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  context.textAlign = 'center';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(2, Math.floor(fontSize / 8));
  context.font = `900 ${fontSize}px "Bungee", "Impact", "Anton", fantasy`;
  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;

  const topLines = splitMemeText(topText);
  const bottomLines = splitMemeText(bottomText);
  const topStart = fontSize + 24;

  topLines.forEach((line, index) => {
    const y = topStart + index * (fontSize + 8);
    context.strokeText(line.toUpperCase(), width / 2, y);
    context.fillText(line.toUpperCase(), width / 2, y);
  });

  const bottomStart = height - 28 - (bottomLines.length - 1) * (fontSize + 8);
  bottomLines.forEach((line, index) => {
    const y = bottomStart + index * (fontSize + 8);
    context.strokeText(line.toUpperCase(), width / 2, y);
    context.fillText(line.toUpperCase(), width / 2, y);
  });

  return { drawn: true, width, height };
}

function defaultCreateObjectURL(blob) {
  return URL.createObjectURL(blob);
}

function defaultRevokeObjectURL(url) {
  return URL.revokeObjectURL(url);
}

export function loadImageFromFile(
  file,
  {
    createObjectURL = defaultCreateObjectURL,
    revokeObjectURL = defaultRevokeObjectURL,
    ImageCtor = Image
  } = {}
) {
  if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return Promise.reject(new Error('Please choose a PNG, JPG, GIF, or WEBP image.'));
  }

  return new Promise((resolve, reject) => {
    const objectUrl = createObjectURL(file);
    const image = new ImageCtor();

    image.onload = () => {
      revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      revokeObjectURL(objectUrl);
      reject(new Error('We could not read that image. Try another one!'));
    };

    image.src = objectUrl;
  });
}

export async function retrieveMemeByUrl(
  rawUrl,
  {
    fetchImpl = fetch,
    createObjectURL = defaultCreateObjectURL,
    revokeObjectURL = defaultRevokeObjectURL,
    ImageCtor = Image
  } = {}
) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new Error('Please enter an image URL first.');
  }

  let parsed;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Please enter a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https image URLs are supported.');
  }

  let response;

  try {
    response = await fetchImpl(parsed.toString());
  } catch {
    throw new Error('Could not fetch that URL. Check the link and try again.');
  }

  if (!response?.ok) {
    throw new Error('Could not fetch that URL. The server returned an error.');
  }

  const blob = await response.blob();
  const mimeType = blob.type || 'image/png';

  if (!ACCEPTED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error('The URL did not return a supported image type.');
  }

  return loadImageFromFile(
    { ...blob, type: mimeType },
    {
      createObjectURL,
      revokeObjectURL,
      ImageCtor
    }
  );
}

export function createMemeGeneratorApp(doc, win = window) {
  const root = doc.querySelector('[data-meme-root]');
  const fileInput = doc.querySelector('[data-meme-file]');
  const urlInput = doc.querySelector('[data-meme-url]');
  const urlButton = doc.querySelector('[data-meme-url-load]');
  const topInput = doc.querySelector('[data-meme-top]');
  const bottomInput = doc.querySelector('[data-meme-bottom]');
  const sizeInput = doc.querySelector('[data-meme-size]');
  const status = doc.querySelector('[data-meme-status]');
  const canvas = doc.querySelector('[data-meme-canvas]');

  if (!root || !fileInput || !urlInput || !urlButton || !topInput || !bottomInput || !sizeInput || !status || !canvas) {
    throw new Error('Meme generator requires all required DOM controls and canvas.');
  }

  const state = {
    topText: topInput.value,
    bottomText: bottomInput.value,
    fontSize: clampMemeTextSize(sizeInput.value),
    image: null
  };

  function render() {
    drawMemePreview({
      canvas,
      image: state.image,
      topText: state.topText,
      bottomText: state.bottomText,
      fontSize: state.fontSize
    });
  }

  async function handleFile(file) {
    if (!file) {
      state.image = null;
      status.textContent = 'No image selected yet. Choose a file to get started.';
      render();
      return;
    }

    try {
      status.textContent = 'Loading your image…';
      state.image = await loadImageFromFile(file, {
        createObjectURL: win.URL.createObjectURL.bind(win.URL),
        revokeObjectURL: win.URL.revokeObjectURL.bind(win.URL),
        ImageCtor: win.Image
      });
      status.textContent = `Loaded ${file.name}. Keep typing to style your meme live.`;
      render();
    } catch (error) {
      state.image = null;
      status.textContent = error.message;
      render();
    }
  }

  async function handleRemoteUrl(rawUrl = urlInput.value) {
    try {
      status.textContent = 'Fetching your remote image…';
      state.image = await retrieveMemeByUrl(rawUrl, {
        fetchImpl: win.fetch.bind(win),
        createObjectURL: win.URL.createObjectURL.bind(win.URL),
        revokeObjectURL: win.URL.revokeObjectURL.bind(win.URL),
        ImageCtor: win.Image
      });
      status.textContent = 'Remote image loaded. Keep typing to style your meme live.';
      render();
    } catch (error) {
      state.image = null;
      status.textContent = error.message;
      render();
    }
  }

  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files?.[0]);
  });

  urlButton.addEventListener('click', () => {
    handleRemoteUrl(urlInput.value);
  });

  topInput.addEventListener('input', () => {
    state.topText = topInput.value;
    render();
  });

  bottomInput.addEventListener('input', () => {
    state.bottomText = bottomInput.value;
    render();
  });

  sizeInput.addEventListener('input', () => {
    state.fontSize = clampMemeTextSize(sizeInput.value);
    sizeInput.value = String(state.fontSize);
    render();
  });

  render();

  return {
    getState() {
      return { ...state };
    },
    render,
    handleFile,
    handleRemoteUrl
  };
}

export function initMemeGenerator(doc = document, win = window) {
  return createMemeGeneratorApp(doc, win);
}
