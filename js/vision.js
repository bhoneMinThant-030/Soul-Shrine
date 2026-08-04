/* ============================================================
   TRACK B — camera detection.  Owner: <name>

   TensorFlow.js coco-ssd via CDN. It has a 'cell phone' class out
   of the box — hold up your phone, the app warns you. Also detect
   'person' absence for "left the desk".

   Skip gaze / head-pose tracking. Not worth the hours.

   Add to index.html?  NO — index.html is frozen. Load the CDN
   scripts dynamically from here instead (see loadModel below), or
   ask the repo owner to add the two <script> tags in one commit.

   Say "all processing happens on-device, nothing leaves your
   browser" in the pitch. A judge will ask about privacy.
   ============================================================ */

let model = null;

/** Lazy-load TF.js + coco-ssd so the other two screens stay fast. */
export async function loadModel() {
  if (model) return model;
  await inject('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
  await inject('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
  model = await window.cocoSsd.load();
  return model;
}

function inject(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

/**
 * Run one detection pass over a <video>.
 * @returns {{phone:boolean, personPresent:boolean}}
 */
export async function detect(videoEl) {
  const m = await loadModel();
  const preds = await m.detect(videoEl);
  return {
    phone:         preds.some(p => p.class === 'cell phone' && p.score > 0.5),
    personPresent: preds.some(p => p.class === 'person'     && p.score > 0.5),
  };
}
