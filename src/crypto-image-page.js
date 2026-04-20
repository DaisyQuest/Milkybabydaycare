const OPERATIONS = [
  { id: 'encrypt-no-key', path: '/api/crypto/encrypt/no-key', method: 'POST', label: 'Encrypt Image (No Key)' },
  { id: 'decrypt-no-key', path: '/api/crypto/decrypt/no-key', method: 'POST', label: 'Decrypt Image (No Key)' },
  { id: 'encrypt-with-key', path: '/api/crypto/encrypt/with-key', method: 'POST', label: 'Encrypt Image (With Key)' },
  { id: 'decrypt-with-key', path: '/api/crypto/decrypt/with-key', method: 'POST', label: 'Decrypt Image (With Key)' },
  { id: 'add-noise', path: '/api/crypto/noise/add', method: 'POST', label: 'Add Noise To Image' },
  { id: 'color-randomizer', path: '/api/crypto/color-randomizer', method: 'POST', label: 'Color Randomizer' },
  { id: 'image-to-base64', path: '/api/crypto/image-to-base64', method: 'POST', label: 'Image To Base64' },
  { id: 'base64-to-image', path: '/api/crypto/base64-to-image', method: 'POST', label: 'Base64 To Image' },
  { id: 'random-simple', path: '/api/crypto/random/simple-color', method: 'GET', label: 'Random Crypto Image (Simple Color)' },
  { id: 'random-complex', path: '/api/crypto/random/complex-color', method: 'GET', label: 'Random Crypto Image (Complex Color)' },
  { id: 'random-extreme', path: '/api/crypto/random/extreme-color', method: 'GET', label: 'Random Crypto Image (Extreme Color)' }
];

function safeJsonParse(value, fallback = {}) {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function updateRequestBodyWithImage(requestInput, filePayload) {
  const parsedBody = safeJsonParse(requestInput.value, {});
  const nextBody = {
    ...parsedBody,
    imageBase64: filePayload.base64,
    mimeType: filePayload.mimeType
  };

  requestInput.value = JSON.stringify(nextBody, null, 2);
}

function fileToBase64(file, win) {
  return new Promise((resolve, reject) => {
    if (!win.FileReader) {
      reject(new Error('FileReader is not supported in this browser.'));
      return;
    }

    const reader = new win.FileReader();

    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const marker = 'base64,';
      const markerIndex = result.indexOf(marker);
      const base64 = markerIndex >= 0 ? result.slice(markerIndex + marker.length) : '';

      resolve({
        base64,
        mimeType: file.type || 'application/octet-stream'
      });
    });

    reader.addEventListener('error', () => {
      reject(new Error('Failed to read file.'));
    });

    reader.readAsDataURL(file);
  });
}

export function createCryptoImageApp(doc = document, win = window) {
  const root = doc.querySelector('[data-crypto-root]');
  const requestInput = doc.querySelector('[data-crypto-request]');
  const responseOutput = doc.querySelector('[data-crypto-response]');
  const controls = [...doc.querySelectorAll('[data-crypto-op]')];
  const status = doc.querySelector('[data-crypto-status]');
  const preview = doc.querySelector('[data-crypto-preview]');
  const fileInput = doc.querySelector('[data-crypto-file]');
  const uploadButton = doc.querySelector('[data-crypto-upload]');

  if (!root || !requestInput || !responseOutput || controls.length === 0) {
    throw new Error('Crypto image app requires root, request, response, and controls.');
  }

  async function runOperation(operation) {
    const parsedBody = safeJsonParse(requestInput.value, {});
    const requestInit = {
      method: operation.method,
      headers: {
        Accept: 'application/json'
      }
    };

    if (operation.method !== 'GET') {
      requestInit.headers['Content-Type'] = 'application/json';
      requestInit.body = JSON.stringify(parsedBody);
    }

    status.textContent = `Running ${operation.label}...`;
    responseOutput.textContent = '';

    const response = await win.fetch(operation.path, requestInit);
    const payload = await response.json();

    responseOutput.textContent = JSON.stringify(payload, null, 2);
    status.textContent = response.ok ? `${operation.label} completed.` : `${operation.label} failed.`;

    if (payload.imageDataUrl) {
      preview.src = payload.imageDataUrl;
      preview.hidden = false;
    } else {
      preview.hidden = true;
      preview.removeAttribute('src');
    }

    return payload;
  }

  controls.forEach((control) => {
    control.addEventListener('click', () => {
      const selected = OPERATIONS.find((operation) => operation.id === control.dataset.cryptoOp);

      if (!selected) {
        status.textContent = 'Unknown operation selected.';
        return;
      }

      runOperation(selected).catch((error) => {
        status.textContent = 'Operation failed unexpectedly.';
        responseOutput.textContent = JSON.stringify({ error: error.message }, null, 2);
      });
    });
  });

  if (fileInput && uploadButton) {
    uploadButton.addEventListener('click', async () => {
      const [file] = fileInput.files || [];

      if (!file) {
        status.textContent = 'Choose an image file before uploading.';
        return;
      }

      status.textContent = `Reading ${file.name}...`;

      try {
        const payload = await fileToBase64(file, win);
        updateRequestBodyWithImage(requestInput, payload);
        status.textContent = `${file.name} loaded into request JSON.`;
      } catch (error) {
        status.textContent = 'File upload failed.';
        responseOutput.textContent = JSON.stringify({ error: error.message }, null, 2);
      }
    });
  }

  return {
    runOperation,
    operations: OPERATIONS,
    fileToBase64: (file) => fileToBase64(file, win)
  };
}

export function initCryptoImageApp(doc = document, win = window) {
  return createCryptoImageApp(doc, win);
}
