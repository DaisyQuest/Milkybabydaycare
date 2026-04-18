import { createViewerState, createWorldConfig, createWorldController } from './world.js';

function parseWorldBootstrap(doc) {
  const node = doc.querySelector('[data-world-bootstrap]');

  if (!node) {
    throw new Error('Missing world bootstrap payload.');
  }

  return JSON.parse(node.textContent);
}

export function initWorld(doc = document) {
  const bootstrap = parseWorldBootstrap(doc);
  const world = createWorldConfig(bootstrap.world);
  const viewer = createViewerState({ ...bootstrap.viewer, world });

  return createWorldController({ doc, initialViewer: viewer, world });
}
