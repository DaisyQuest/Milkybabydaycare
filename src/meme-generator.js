const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const FILTER_PRESETS = {
  sepia: 'sepia(0.9)',
  blackAndWhite: 'grayscale(1)',
  noire: 'grayscale(1) contrast(1.25) brightness(0.82)',
  sharp: 'contrast(1.45) saturate(1.15)',
  dull: 'saturate(0.55) contrast(0.92)',
  warm: 'saturate(1.12) sepia(0.2) hue-rotate(-8deg)',
  cool: 'saturate(1.05) hue-rotate(16deg)'
};

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

export function clampCropValue(value) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

export function normalizeCrop(rawCrop = {}) {
  const x = clampCropValue(rawCrop.x ?? 0);
  const y = clampCropValue(rawCrop.y ?? 0);
  let width = clampCropValue(rawCrop.width ?? 100);
  let height = clampCropValue(rawCrop.height ?? 100);

  width = Math.max(1, width);
  height = Math.max(1, height);

  if (x + width > 100) {
    width = 100 - x;
  }

  if (y + height > 100) {
    height = 100 - y;
  }

  return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
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

export function buildFilterChain(filters = {}) {
  const chain = [];

  if (filters.negativeColorToggle) {
    chain.push('invert(1)');
  }

  Object.entries(FILTER_PRESETS).forEach(([key, value]) => {
    if (filters[key]) {
      chain.push(value);
    }
  });

  return chain.join(' ') || 'none';
}

export function createBorderSegments(width, twoColorSegment1LengthPx, twoColorSegment2LengthPx) {
  const safeWidth = Math.max(0, Number.parseInt(width, 10) || 0);
  const segmentOne = Math.max(1, Number.parseInt(twoColorSegment1LengthPx, 10) || 24);
  const segmentTwo = Math.max(1, Number.parseInt(twoColorSegment2LengthPx, 10) || 24);

  const segments = [];
  let cursor = 0;
  let useFirst = true;

  while (cursor < safeWidth) {
    const length = useFirst ? segmentOne : segmentTwo;
    const end = Math.min(safeWidth, cursor + length);
    segments.push({ start: cursor, end, isPrimary: useFirst });
    cursor = end;
    useFirst = !useFirst;
  }

  return segments;
}

function createRainbowGradient(context, width) {
  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#ff4f70');
  gradient.addColorStop(0.17, '#ff9a4f');
  gradient.addColorStop(0.34, '#ffe55f');
  gradient.addColorStop(0.51, '#5fd988');
  gradient.addColorStop(0.68, '#58c9ff');
  gradient.addColorStop(0.84, '#7873ff');
  gradient.addColorStop(1, '#de67ff');
  return gradient;
}

function drawBorder(context, width, height, border = {}) {
  const strokeWidth = Math.max(0, Number.parseInt(border.strokeWidth, 10) || 0);

  if (strokeWidth === 0) {
    context.shadowBlur = 0;
    return;
  }

  const shadow = !!border.shadow;
  context.lineWidth = strokeWidth;
  context.shadowBlur = shadow ? Math.max(4, Math.round(strokeWidth * 0.8)) : 0;
  context.shadowColor = shadow ? 'rgba(10, 27, 46, 0.55)' : 'transparent';

  if (border.mode === 'rainbow') {
    context.strokeStyle = createRainbowGradient(context, width);
    context.strokeRect(0, 0, width, height);
    context.shadowBlur = 0;
    return;
  }

  if (border.mode === 'two-color') {
    const primaryColor = border.color || '#ffffff';
    const secondaryColor = border.twoColorSecondColor || '#000000';
    const segments = createBorderSegments(width, border.segmentColor1LengthPx, border.segmentColor2LengthPx);

    segments.forEach((segment) => {
      context.beginPath();
      context.strokeStyle = segment.isPrimary ? primaryColor : secondaryColor;
      context.moveTo(segment.start, strokeWidth / 2);
      context.lineTo(segment.end, strokeWidth / 2);
      context.moveTo(segment.start, height - strokeWidth / 2);
      context.lineTo(segment.end, height - strokeWidth / 2);
      context.stroke();
    });

    context.beginPath();
    context.strokeStyle = primaryColor;
    context.moveTo(strokeWidth / 2, 0);
    context.lineTo(strokeWidth / 2, height);
    context.moveTo(width - strokeWidth / 2, 0);
    context.lineTo(width - strokeWidth / 2, height);
    context.stroke();
    context.shadowBlur = 0;
    return;
  }

  context.strokeStyle = border.color || '#ffffff';
  context.strokeRect(0, 0, width, height);
  context.shadowBlur = 0;
}

function drawPanelText(context, width, height, panel = {}, fontSize = 42, fillColor = '#ffffff', strokeColor = '#091025') {
  context.textAlign = 'center';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(2, Math.floor(fontSize / 8));
  context.font = `900 ${fontSize}px "Bungee", "Impact", "Anton", fantasy`;
  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;

  const topLines = splitMemeText(panel.topText || '');
  const bottomLines = splitMemeText(panel.bottomText || '');
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
}

function drawPanelContent(context, panelWidth, panelHeight, panel = {}, filters = {}) {
  context.save();
  context.filter = buildFilterChain(filters);

  if (panel.image) {
    const imageWidth = panel.image.naturalWidth || panel.image.width || panelWidth;
    const imageHeight = panel.image.naturalHeight || panel.image.height || panelHeight;
    const crop = normalizeCrop(panel.crop);
    const sx = Math.floor((crop.x / 100) * imageWidth);
    const sy = Math.floor((crop.y / 100) * imageHeight);
    const sw = Math.max(1, Math.floor((crop.width / 100) * imageWidth));
    const sh = Math.max(1, Math.floor((crop.height / 100) * imageHeight));
    context.drawImage(panel.image, sx, sy, sw, sh, 0, 0, panelWidth, panelHeight);
  } else {
    const gradient = context.createLinearGradient(0, 0, panelWidth, panelHeight);
    gradient.addColorStop(0, '#8fe8ff');
    gradient.addColorStop(0.5, '#ffd8aa');
    gradient.addColorStop(1, '#ff9fb8');
    context.fillStyle = gradient;
    context.fillRect(0, 0, panelWidth, panelHeight);
  }

  context.restore();
}

export function drawMemePreview({
  canvas,
  image,
  topText = '',
  bottomText = '',
  fontSize = 42,
  strokeColor = '#091025',
  fillColor = '#ffffff',
  border = {},
  filters = {},
  panels = null
}) {
  const context = canvas?.getContext?.('2d');

  if (!context || !canvas) {
    return { drawn: false, reason: 'missing-canvas' };
  }

  const fallbackPanel = {
    image: image || null,
    topText,
    bottomText,
    crop: { x: 0, y: 0, width: 100, height: 100 }
  };
  const normalizedPanels = Array.isArray(panels) && panels.length > 0 ? panels : [fallbackPanel];
  const baseImage = normalizedPanels[0]?.image || image;

  const panelWidth = baseImage?.naturalWidth || baseImage?.width || 1200;
  const panelHeight = baseImage?.naturalHeight || baseImage?.height || 675;
  const dividerHeight = normalizedPanels.length > 1 ? 8 : 0;
  const height = panelHeight * normalizedPanels.length + dividerHeight * Math.max(0, normalizedPanels.length - 1);

  canvas.width = panelWidth;
  canvas.height = height;

  context.clearRect(0, 0, panelWidth, height);

  normalizedPanels.forEach((panel, panelIndex) => {
    const yOffset = panelIndex * (panelHeight + dividerHeight);
    context.save();
    context.translate(0, yOffset);
    drawPanelContent(context, panelWidth, panelHeight, panel, filters);
    drawPanelText(context, panelWidth, panelHeight, panel, fontSize, fillColor, strokeColor);
    drawBorder(context, panelWidth, panelHeight, border);
    context.restore();

    if (dividerHeight && panelIndex < normalizedPanels.length - 1) {
      context.fillStyle = 'rgba(10, 35, 54, 0.45)';
      context.fillRect(0, yOffset + panelHeight, panelWidth, dividerHeight);
    }
  });

  return { drawn: true, width: panelWidth, height, panelCount: normalizedPanels.length };
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

  const safeBlob =
    blob instanceof Blob && blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });

  return loadImageFromFile(safeBlob, {
    createObjectURL,
    revokeObjectURL,
    ImageCtor
  });
}

function createDefaultPanel(baseImage = null) {
  return {
    topText: '',
    bottomText: '',
    image: baseImage,
    crop: { x: 0, y: 0, width: 100, height: 100 }
  };
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
  const cropXInput = doc.querySelector('[data-meme-crop-x]');
  const cropYInput = doc.querySelector('[data-meme-crop-y]');
  const cropWidthInput = doc.querySelector('[data-meme-crop-width]');
  const cropHeightInput = doc.querySelector('[data-meme-crop-height]');
  const borderModeInput = doc.querySelector('[data-meme-border-mode]');
  const borderColorInput = doc.querySelector('[data-meme-border-color]');
  const borderSecondColorInput = doc.querySelector('[data-meme-border-color-second]');
  const borderSegmentOneInput = doc.querySelector('[data-meme-border-segment1]');
  const borderSegmentTwoInput = doc.querySelector('[data-meme-border-segment2]');
  const borderStrokeInput = doc.querySelector('[data-meme-border-stroke]');
  const borderShadowInput = doc.querySelector('[data-meme-border-shadow]');
  const addPanelButton = doc.querySelector('[data-meme-add-panel]');
  const panelRows = doc.querySelector('[data-meme-panel-rows]');

  if (
    !root ||
    !fileInput ||
    !urlInput ||
    !urlButton ||
    !topInput ||
    !bottomInput ||
    !sizeInput ||
    !status ||
    !canvas ||
    !cropXInput ||
    !cropYInput ||
    !cropWidthInput ||
    !cropHeightInput ||
    !borderModeInput ||
    !borderColorInput ||
    !borderSecondColorInput ||
    !borderSegmentOneInput ||
    !borderSegmentTwoInput ||
    !borderStrokeInput ||
    !borderShadowInput ||
    !addPanelButton ||
    !panelRows
  ) {
    throw new Error('Meme generator requires all required DOM controls and canvas.');
  }

  const filterInputs = {
    negativeColorToggle: doc.querySelector('[data-meme-filter-negative]'),
    sepia: doc.querySelector('[data-meme-filter-sepia]'),
    blackAndWhite: doc.querySelector('[data-meme-filter-bw]'),
    noire: doc.querySelector('[data-meme-filter-noire]'),
    sharp: doc.querySelector('[data-meme-filter-sharp]'),
    dull: doc.querySelector('[data-meme-filter-dull]'),
    warm: doc.querySelector('[data-meme-filter-warm]'),
    cool: doc.querySelector('[data-meme-filter-cool]')
  };

  const missingFilter = Object.values(filterInputs).some((node) => !node);
  if (missingFilter) {
    throw new Error('Meme generator requires all required DOM controls and canvas.');
  }

  const state = {
    fontSize: clampMemeTextSize(sizeInput.value),
    activePanelIndex: 0,
    panels: [createDefaultPanel()],
    border: {
      mode: borderModeInput.value,
      color: borderColorInput.value,
      twoColorSecondColor: borderSecondColorInput.value,
      segmentColor1LengthPx: Number.parseInt(borderSegmentOneInput.value, 10) || 24,
      segmentColor2LengthPx: Number.parseInt(borderSegmentTwoInput.value, 10) || 24,
      strokeWidth: Number.parseInt(borderStrokeInput.value, 10) || 6,
      shadow: borderShadowInput.checked
    },
    filters: {
      negativeColorToggle: false,
      sepia: false,
      blackAndWhite: false,
      noire: false,
      sharp: false,
      dull: false,
      warm: false,
      cool: false
    }
  };

  function activePanel() {
    return state.panels[state.activePanelIndex] || state.panels[0];
  }

  function syncPanelInputs() {
    const panel = activePanel();
    topInput.value = panel.topText;
    bottomInput.value = panel.bottomText;
    cropXInput.value = String(panel.crop.x);
    cropYInput.value = String(panel.crop.y);
    cropWidthInput.value = String(panel.crop.width);
    cropHeightInput.value = String(panel.crop.height);
  }

  function renderPanelRows() {
    panelRows.innerHTML = '';
    state.panels.forEach((panel, index) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'meme-panel-row';
      button.setAttribute('data-meme-panel-row', String(index));
      button.setAttribute('aria-pressed', String(index === state.activePanelIndex));
      const imageLabel = panel.image ? '🖼️ image' : '🎨 gradient';
      button.textContent = `Panel ${index + 1} · ${imageLabel}`;
      button.addEventListener('click', () => {
        state.activePanelIndex = index;
        syncPanelInputs();
        render();
        renderPanelRows();
      });
      panelRows.append(button);
    });
  }

  function render() {
    drawMemePreview({
      canvas,
      fontSize: state.fontSize,
      border: state.border,
      filters: state.filters,
      panels: state.panels
    });
  }

  function updateActivePanel(patch) {
    const panel = activePanel();
    Object.assign(panel, patch);
    render();
    renderPanelRows();
  }

  async function handleFile(file, panelIndex = state.activePanelIndex) {
    if (!file) {
      state.panels[panelIndex].image = null;
      status.textContent = 'No image selected yet. Choose a file to get started.';
      render();
      renderPanelRows();
      return;
    }

    try {
      status.textContent = 'Loading your image…';
      state.panels[panelIndex].image = await loadImageFromFile(file, {
        createObjectURL: win.URL.createObjectURL.bind(win.URL),
        revokeObjectURL: win.URL.revokeObjectURL.bind(win.URL),
        ImageCtor: win.Image
      });
      status.textContent = `Loaded ${file.name} for panel ${panelIndex + 1}. Keep typing to style your meme live.`;
      render();
      renderPanelRows();
    } catch (error) {
      state.panels[panelIndex].image = null;
      status.textContent = error.message;
      render();
      renderPanelRows();
    }
  }

  async function handleRemoteUrl(rawUrl = urlInput.value, panelIndex = state.activePanelIndex) {
    try {
      status.textContent = 'Fetching your remote image…';
      state.panels[panelIndex].image = await retrieveMemeByUrl(rawUrl, {
        fetchImpl: win.fetch.bind(win),
        createObjectURL: win.URL.createObjectURL.bind(win.URL),
        revokeObjectURL: win.URL.revokeObjectURL.bind(win.URL),
        ImageCtor: win.Image
      });
      status.textContent = `Remote image loaded for panel ${panelIndex + 1}. Keep typing to style your meme live.`;
      render();
      renderPanelRows();
    } catch (error) {
      state.panels[panelIndex].image = null;
      status.textContent = error.message;
      render();
      renderPanelRows();
    }
  }

  function handleCropInput() {
    const nextCrop = normalizeCrop({
      x: cropXInput.value,
      y: cropYInput.value,
      width: cropWidthInput.value,
      height: cropHeightInput.value
    });
    cropXInput.value = String(nextCrop.x);
    cropYInput.value = String(nextCrop.y);
    cropWidthInput.value = String(nextCrop.width);
    cropHeightInput.value = String(nextCrop.height);
    updateActivePanel({ crop: nextCrop });
  }

  fileInput.addEventListener('change', () => {
    handleFile(fileInput.files?.[0]);
  });

  urlButton.addEventListener('click', () => {
    handleRemoteUrl(urlInput.value);
  });

  topInput.addEventListener('input', () => {
    updateActivePanel({ topText: topInput.value });
  });

  bottomInput.addEventListener('input', () => {
    updateActivePanel({ bottomText: bottomInput.value });
  });

  sizeInput.addEventListener('input', () => {
    state.fontSize = clampMemeTextSize(sizeInput.value);
    sizeInput.value = String(state.fontSize);
    render();
  });

  [cropXInput, cropYInput, cropWidthInput, cropHeightInput].forEach((element) => {
    element.addEventListener('input', handleCropInput);
  });

  borderModeInput.addEventListener('change', () => {
    state.border.mode = borderModeInput.value;
    render();
  });

  borderColorInput.addEventListener('input', () => {
    state.border.color = borderColorInput.value;
    render();
  });

  borderSecondColorInput.addEventListener('input', () => {
    state.border.twoColorSecondColor = borderSecondColorInput.value;
    render();
  });

  borderSegmentOneInput.addEventListener('input', () => {
    state.border.segmentColor1LengthPx = Number.parseInt(borderSegmentOneInput.value, 10) || 24;
    render();
  });

  borderSegmentTwoInput.addEventListener('input', () => {
    state.border.segmentColor2LengthPx = Number.parseInt(borderSegmentTwoInput.value, 10) || 24;
    render();
  });

  borderStrokeInput.addEventListener('input', () => {
    state.border.strokeWidth = Math.max(0, Number.parseInt(borderStrokeInput.value, 10) || 0);
    borderStrokeInput.value = String(state.border.strokeWidth);
    render();
  });

  borderShadowInput.addEventListener('change', () => {
    state.border.shadow = borderShadowInput.checked;
    render();
  });

  Object.entries(filterInputs).forEach(([key, element]) => {
    element.addEventListener('change', () => {
      state.filters[key] = element.checked;
      render();
    });
  });

  addPanelButton.addEventListener('click', () => {
    const currentImage = activePanel().image || null;
    state.panels.push(createDefaultPanel(currentImage));
    state.activePanelIndex = state.panels.length - 1;
    syncPanelInputs();
    render();
    renderPanelRows();
    status.textContent = `Added panel ${state.activePanelIndex + 1}. Customize text and image independently.`;
  });

  syncPanelInputs();
  renderPanelRows();
  render();

  return {
    getState() {
      return {
        ...state,
        image: state.panels[state.activePanelIndex]?.image || null,
        topText: state.panels[state.activePanelIndex]?.topText || '',
        bottomText: state.panels[state.activePanelIndex]?.bottomText || ''
      };
    },
    render,
    handleFile,
    handleRemoteUrl
  };
}

export function initMemeGenerator(doc = document, win = window) {
  return createMemeGeneratorApp(doc, win);
}
