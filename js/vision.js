/* ============================================================
   TRACK B — camera detection.  Owner: Bhone

   TensorFlow.js coco-ssd via CDN. It ships a 'cell phone' class
   out of the box — hold up your phone and the app sees it. We
   also watch for 'person' disappearing, which means you left.

   Everything here runs on-device. No frame ever leaves the
   browser — that is worth saying out loud in the pitch, because
   a judge will ask.

   index.html is frozen, so the CDN scripts are injected from
   here rather than added as <script> tags.
   ============================================================ */

const TFJS = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0';
const COCO = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3';

const PHONE_MIN_SCORE  = 0.45;  // phones are small in frame — be lenient
const PERSON_MIN_SCORE = 0.55;

let model = null;
let loading = null;

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
 * Lazy-load TF.js + coco-ssd. Safe to call repeatedly — concurrent
 * callers share one in-flight promise.
 *
 * Call this the moment the Focus tab opens, NOT when the user hits
 * Start. First load is 5-10s and you do not want that dead air on
 * stage after someone clicks a button.
 */
export function loadModel() {
  if (model) return Promise.resolve(model);
  if (loading) return loading;

  loading = (async () => {
    await inject(TFJS);
    await inject(COCO);
    model = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
    return model;
  })();

  return loading;
}

export function isReady() {
  return !!model;
}

/**
 * One detection pass over a <video>.
 * @returns {Promise<{phone: boolean, personPresent: boolean}>}
 */
export async function detect(videoEl) {
  const m = await loadModel();

  // A video that has not buffered a frame yet throws inside coco-ssd.
  if (!videoEl || videoEl.readyState < 2) {
    return { phone: false, personPresent: true };
  }

  const preds = await m.detect(videoEl);

  return {
    phone:         preds.some(p => p.class === 'cell phone' && p.score >= PHONE_MIN_SCORE),
    personPresent: preds.some(p => p.class === 'person'     && p.score >= PERSON_MIN_SCORE),
  };
}
