/**
 * Path templates for motion-matching targets.
 * Coordinates are in a unit box [0,1]×[0,1], y grows downward (screen space).
 */

export const PATH_LIBRARY = {
  L_down_right: {
    label: '↓→',
    points: [
      [0.2, 0.15],
      [0.2, 0.35],
      [0.2, 0.55],
      [0.2, 0.75],
      [0.35, 0.75],
      [0.55, 0.75],
      [0.8, 0.75],
    ],
  },
  L_right_down: {
    label: '→↓',
    points: [
      [0.15, 0.2],
      [0.35, 0.2],
      [0.55, 0.2],
      [0.8, 0.2],
      [0.8, 0.4],
      [0.8, 0.6],
      [0.8, 0.8],
    ],
  },
  circle: {
    label: '○',
    points: (() => {
      const pts = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pts.push([0.5 + 0.32 * Math.cos(a), 0.5 + 0.32 * Math.sin(a)]);
      }
      return pts;
    })(),
  },
  diagonal: {
    label: '↘',
    points: [
      [0.2, 0.2],
      [0.35, 0.35],
      [0.5, 0.5],
      [0.65, 0.65],
      [0.8, 0.8],
    ],
  },
  zigzag: {
    label: '∾',
    points: [
      [0.15, 0.3],
      [0.35, 0.7],
      [0.5, 0.3],
      [0.65, 0.7],
      [0.85, 0.3],
    ],
  },
  U_shape: {
    label: '⋃',
    points: [
      [0.2, 0.2],
      [0.2, 0.45],
      [0.2, 0.7],
      [0.35, 0.82],
      [0.5, 0.82],
      [0.65, 0.82],
      [0.8, 0.7],
      [0.8, 0.45],
      [0.8, 0.2],
    ],
  },
};

/** Periods in ms for one full loop (fast → slow). */
export const SPEED_PERIODS = [
  { period: 900, speedLabel: 'Fast' },
  { period: 1600, speedLabel: 'Med' },
  { period: 2600, speedLabel: 'Slow' },
];

/** Layout: row of button demos across upper area; lower area is free for drawing. */
export function computeLayout(width, height, count) {
  const topH = Math.min(height * 0.4, 240);
  const demoSize = Math.min((width - 24) / count - 8, topH - 36, 130);
  const gap = 8;
  const totalW = count * demoSize + (count - 1) * gap;
  const startX = (width - totalW) / 2;
  const demos = [];
  for (let i = 0; i < count; i++) {
    demos.push({
      x: startX + i * (demoSize + gap),
      y: 12,
      size: demoSize,
    });
  }
  return { demos, drawTop: topH + 8 };
}

/** Map unit path → pixels inside a demo box. */
export function pathToScreen(template, demo) {
  const pad = demo.size * 0.18;
  const s = demo.size - pad * 2;
  return template.map((p) => ({
    x: demo.x + pad + p.x * s,
    y: demo.y + pad + p.y * s,
  }));
}

/** Position of moving indicator at time t along looping path. */
export function indicatorAt(target, tMs, demo) {
  const pts = pathToScreen(target.template, demo);
  if (pts.length < 2) return pts[0] || { x: demo.x, y: demo.y };

  const period = target.period;
  const u = (((tMs % period) + period) % period) / period;
  const total = pts.length - 1;
  const f = u * total;
  const i = Math.min(Math.floor(f), total - 1);
  const t = f - i;
  return {
    x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
    y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
  };
}
