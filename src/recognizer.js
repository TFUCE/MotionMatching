/**
 * Stroke–path recognizer for motion matching.
 *
 * Location-invariant (translate + scale).
 * Open paths: direction fixed (↓→ ≠ →↓).
 * Closed paths (○): try start-point shifts + reverse (CW/CCW).
 */

const SAMPLE_N = 32;

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function resample(points, n = SAMPLE_N) {
  if (!points.length) return [];
  if (points.length === 1) {
    return Array.from({ length: n }, () => ({ ...points[0] }));
  }

  let length = 0;
  const seg = [0];
  for (let i = 1; i < points.length; i++) {
    length += dist(points[i - 1], points[i]);
    seg.push(length);
  }
  if (length < 1e-6) {
    return Array.from({ length: n }, () => ({ ...points[0] }));
  }

  const out = [];
  const step = length / (n - 1);
  let i = 0;
  for (let s = 0; s < n; s++) {
    const target = s * step;
    while (i < seg.length - 1 && seg[i + 1] < target) i++;
    const t0 = seg[i];
    const t1 = seg[i + 1] ?? t0;
    const p0 = points[i];
    const p1 = points[Math.min(i + 1, points.length - 1)];
    const u = t1 === t0 ? 0 : (target - t0) / (t1 - t0);
    out.push({
      x: p0.x + (p1.x - p0.x) * u,
      y: p0.y + (p1.y - p0.y) * u,
    });
  }
  return out;
}

function normalize(points) {
  if (!points.length) return [];
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  const shifted = points.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  let meanR = 0;
  for (const p of shifted) meanR += Math.hypot(p.x, p.y);
  meanR /= shifted.length || 1;
  if (meanR < 1e-6) return shifted;
  return shifted.map((p) => ({ x: p.x / meanR, y: p.y / meanR }));
}

function meanDistance(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return Infinity;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += dist(a[i], b[i]);
  return sum / n;
}

function directionSimilarity(a, b) {
  let dot = 0;
  let count = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 1; i < n; i++) {
    const ax = a[i].x - a[i - 1].x;
    const ay = a[i].y - a[i - 1].y;
    const bx = b[i].x - b[i - 1].x;
    const by = b[i].y - b[i - 1].y;
    const aL = Math.hypot(ax, ay) || 1e-6;
    const bL = Math.hypot(bx, by) || 1e-6;
    dot += (ax / aL) * (bx / bL) + (ay / aL) * (by / bL);
    count++;
  }
  if (!count) return 0;
  return (dot / count + 1) / 2;
}

function isClosed(points, ratio = 0.25) {
  if (points.length < 4) return false;
  let L = 0;
  for (let i = 1; i < points.length; i++) L += dist(points[i - 1], points[i]);
  if (L < 1e-6) return false;
  return dist(points[0], points[points.length - 1]) / L <= ratio;
}

function rotateLeft(points, k) {
  const n = points.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = points[(i + k) % n];
  return out;
}

/** Compare open paths as-is; closed paths search start phase + reverse. */
function compareNormalized(user, tmpl, closedTemplate) {
  if (!closedTemplate) {
    return {
      distance: meanDistance(user, tmpl),
      dirSim: directionSimilarity(user, tmpl),
    };
  }

  let bestD = Infinity;
  let bestDir = 0;
  const variants = [user, [...user].reverse()];

  for (const variant of variants) {
    for (let k = 0; k < variant.length; k++) {
      const shifted = rotateLeft(variant, k);
      const d = meanDistance(shifted, tmpl);
      if (d < bestD) {
        bestD = d;
        bestDir = directionSimilarity(shifted, tmpl);
      }
    }
  }
  return { distance: bestD, dirSim: bestDir };
}

/** 1 = round, 0 = skinny / line-like. */
function circularity(points) {
  if (points.length < 4) return 0;
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length || 1;
  let varSum = 0;
  for (const r of radii) varSum += (r - mean) ** 2;
  const cv = Math.sqrt(varSum / radii.length) / mean;
  return Math.max(0, Math.min(1, 1 - cv * 2));
}

function scoreStrokeAgainstTemplate(stroke, template, target = null, opts = {}) {
  const { useSpeed = true } = opts;
  const user = normalize(resample(stroke));
  const tmpl = normalize(resample(template));
  if (user.length < 2 || tmpl.length < 2) {
    return { score: 0, distance: Infinity, dirSim: 0, shape: 0, speed: 0 };
  }

  const tmplClosed = isClosed(template);
  const userClosed = isClosed(stroke);

  const { distance: d, dirSim } = compareNormalized(user, tmpl, tmplClosed);
  const shapeSim = Math.max(0, Math.min(1, 1 - d / 0.9));
  let shape = 0.4 * shapeSim + 0.6 * dirSim;

  if (userClosed !== tmplClosed) {
    shape *= 0.4;
  }

  if (tmplClosed) {
    shape = shape * (0.55 + 0.45 * circularity(stroke));
  }

  const userSp = userAvgSpeed(stroke);
  const tgtSp = target ? targetAvgSpeed(target) : userSp;
  const speed = speedSimilarityByRate(userSp, tgtSp);

  let score;
  if (!useSpeed) {
    score = shape;
  } else if (shape < 0.45) {
    score = shape * 0.5;
  } else {
    score = 0.22 * shape + 0.78 * speed;
  }

  return { score, distance: d, dirSim, shape, speed, userSp, tgtSp };
}

/**
 * Compare speeds in the same units shown on screen (u/s).
 * ratio≈1 → perfect; far from 1 → low score.
 */
function speedSimilarityByRate(userSpeed, targetSpeed) {
  if (!(userSpeed > 0) || !(targetSpeed > 0)) return 0;
  const r = userSpeed / targetSpeed;
  return Math.exp(-((Math.log(r)) ** 2) / (2 * 0.2 ** 2));
}

export function recognizeStroke(targets, stroke, opts = {}) {
  const {
    selectThreshold = 0.55,
    margin = 0.05,
    minPoints = 8,
    useSpeed = true,
  } = opts;

  if (!stroke || stroke.length < minPoints) {
    return {
      confident: false,
      best: null,
      ranked: [],
      reason: 'too_short',
    };
  }

  const ranked = targets
    .map((target) => {
      const scored = scoreStrokeAgainstTemplate(stroke, target.template, target, {
        useSpeed,
      });
      return { target, ...scored };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0] ?? null;
  const second = ranked[1];

  let clearWinner =
    !!top &&
    top.score >= selectThreshold &&
    top.shape >= 0.45 &&
    (!second || top.score - second.score >= margin);

  if (useSpeed) {
    const bySpeed = [...ranked].sort((a, b) => b.speed - a.speed);
    const speedBest = bySpeed[0];
    const speedSecond = bySpeed[1];
    clearWinner =
      clearWinner &&
      top.speed >= 0.45 &&
      !(
        speedBest &&
        speedBest.target.id !== top.target.id &&
        speedBest.speed - top.speed >= 0.12 &&
        (!speedSecond || speedBest.speed - speedSecond.speed >= 0.05)
      );
  }

  if (!clearWinner) {
    return {
      confident: false,
      best: null,
      ranked,
      reason: 'no_match',
      topScore: top?.score ?? 0,
    };
  }

  return {
    confident: true,
    best: top,
    ranked,
    reason: 'ok',
    topScore: top.score,
  };
}

export function strokeLength(stroke) {
  let L = 0;
  for (let i = 1; i < stroke.length; i++) L += dist(stroke[i - 1], stroke[i]);
  return L;
}

/** Average speed in normalized path-units / second. */
function normalizedAvgSpeed(points, durationMs) {
  if (!points?.length || durationMs < 16) return 0;
  const n = normalize(resample(points));
  return strokeLength(n) / (durationMs / 1000);
}

/** Target indicator average speed for one full loop. */
export function targetAvgSpeed(target) {
  return normalizedAvgSpeed(target.template, target.period);
}

/** Live user stroke average speed so far. */
export function userAvgSpeed(stroke) {
  if (!stroke || stroke.length < 2) return 0;
  const t0 = stroke[0].t ?? 0;
  const t1 = stroke[stroke.length - 1].t ?? t0;
  return normalizedAvgSpeed(stroke, Math.max(16, t1 - t0));
}
