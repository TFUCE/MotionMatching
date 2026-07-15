import {
  createTargets,
  reshuffleTargets,
  computeLayout,
  pathToScreen,
  indicatorAt,
} from './paths.js';
import { recognizeStroke, strokeLength, targetAvgSpeed, userAvgSpeed } from './recognizer.js';
import { playClick, unlockAudio } from './audio.js';
import {
  getHealth,
  submitTrial,
} from './api.js';

const app = document.getElementById('app');

const TARGET_COUNT = 3;

const state = {
  screen: 'home',
  participantCode: localStorage.getItem('mm_participant') || '',
  apiOnline: null,
  saveError: null,
  stroke: [],
  drawing: false,
  selectedId: null,
  lastResult: null,
  animId: null,
  canvas: null,
  ctx: null,
  size: { w: 0, h: 0 },
  targets: [],
  startMs: 0,
  trialStart: 0,
  lastMessage: '',
  speedEnabled: true,
};

async function boot() {
  try {
    await getHealth();
    state.apiOnline = true;
  } catch {
    state.apiOnline = false;
  }
  renderShell();
}

function renderShell() {
  if (state.screen === 'home') renderHome();
  else if (state.screen === 'trial') renderTrial();
  else if (state.screen === 'result') renderResult();
}

function apiBadge() {
  if (state.apiOnline === true) {
    return `<span class="api-badge on">API connected</span>`;
  }
  if (state.apiOnline === false) {
    return `<span class="api-badge off">API offline · local only</span>`;
  }
  return `<span class="api-badge">API…</span>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderHome() {
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand">Motion Match</p>
        <h1>Speed training</h1>
        <p class="lede">
          Match a button by drawing its path at that speed.
          You can swap trajectories anytime inside the session.
        </p>
      </header>
      <label class="field home-field">
        <span>Participant code (optional)</span>
        <input
          class="text-input"
          id="participant"
          type="text"
          maxlength="64"
          placeholder="e.g. P01"
          value="${escapeHtml(state.participantCode)}"
        />
      </label>
      <div class="home-actions">
        <button class="btn primary" id="btn-start" type="button">Start</button>
      </div>
      <p class="hint">${apiBadge()} · Best on a phone</p>
    </main>
  `;

  const input = document.getElementById('participant');
  input.oninput = () => {
    state.participantCode = input.value.trim();
    localStorage.setItem('mm_participant', state.participantCode);
  };

  document.getElementById('btn-start').onclick = () => {
    unlockAudio();
    startTrial();
  };
}

function startTrial() {
  cancelAnim();
  state.targets = createTargets();
  state.stroke = [];
  state.drawing = false;
  state.selectedId = null;
  state.lastMessage = '';
  state.saveError = null;
  state.lastResult = null;
  state.screen = 'trial';
  renderTrial();
}

/** Clear stroke / selection so the user can try again without leaving the trial. */
function resetAttempt(message = '') {
  state.stroke = [];
  state.selectedId = null;
  state.lastResult = null;
  state.lastMessage = message;
  const cont = document.getElementById('btn-continue');
  if (cont) cont.hidden = true;
}

function renderTrial() {
  app.innerHTML = `
    <main class="page trial">
      <header class="trial-bar">
        <button class="back subtle" id="btn-exit" type="button">Exit</button>
        <div class="trial-status">
          <span class="mode-pill">Speed training</span>
          <span class="intend" id="path-status">Draw the path at that speed</span>
        </div>
        <button class="back subtle" id="btn-reset" type="button">Clear</button>
      </header>

      <div class="trial-tools">
        <button class="btn ghost tool-btn" id="btn-swap" type="button">Swap paths</button>
        <button class="btn ghost tool-btn" id="btn-speed-toggle" type="button">Speed: On</button>
      </div>

      <div class="stage-wrap">
        <canvas id="stage" aria-label="Motion matching stage"></canvas>
        <div class="tap-layer" id="draw-layer" role="application" aria-label="Draw area"></div>
      </div>

      <footer class="trial-foot">
        <p class="speed-live" id="speed-live">Your speed: —</p>
        <p class="foot-hint" id="foot-hint">Watch the moving dot · match that path &amp; speed</p>
        <button class="btn primary continue-btn" id="btn-continue" type="button" hidden>View result</button>
      </footer>
    </main>
  `;

  document.getElementById('btn-exit').onclick = () => {
    cancelAnim();
    state.screen = 'home';
    renderShell();
  };
  document.getElementById('btn-reset').onclick = () => {
    resetAttempt();
    updateHud();
  };

  document.getElementById('btn-swap').onclick = () => {
    state.targets = reshuffleTargets(state.targets);
    resetAttempt('Paths updated');
    updatePathStatus();
    updateHud();
    playClick('tap');
  };

  document.getElementById('btn-speed-toggle').onclick = () => {
    state.speedEnabled = !state.speedEnabled;
    resetAttempt(state.speedEnabled ? 'Speed matching on' : 'Speed off · path only');
    syncSpeedToggleUi();
    updateHud();
    playClick('tap');
  };

  syncSpeedToggleUi();

  document.getElementById('btn-continue').onclick = () => {
    if (!state.lastResult) return;
    cancelAnim();
    state.screen = 'result';
    renderShell();
  };

  updatePathStatus();

  const canvas = document.getElementById('stage');
  const layer = document.getElementById('draw-layer');
  state.canvas = canvas;
  state.ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  const pointFromEvent = (e) => {
    const rect = layer.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now() - state.startMs,
    };
  };

  const onDown = (e) => {
    if (state.selectedId) return;
    e.preventDefault();
    unlockAudio();
    layer.setPointerCapture?.(e.pointerId);
    state.drawing = true;
    state.stroke = [pointFromEvent(e)];
    state.lastMessage = '';
    updateHud();
  };

  const onMove = (e) => {
    if (!state.drawing || state.selectedId) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    const last = state.stroke[state.stroke.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
    state.stroke.push(p);
    updateUserSpeedHud();
  };

  const onUp = (e) => {
    if (!state.drawing || state.selectedId) return;
    e.preventDefault();
    state.drawing = false;
    if (e.type !== 'pointercancel') {
      state.stroke.push(pointFromEvent(e));
    }
    finishStroke();
  };

  layer.addEventListener('pointerdown', onDown, { passive: false });
  layer.addEventListener('pointermove', onMove, { passive: false });
  layer.addEventListener('pointerup', onUp, { passive: false });
  layer.addEventListener('pointercancel', onUp, { passive: false });

  state.startMs = performance.now();
  state.trialStart = performance.now();
  loop();
}

async function recordTrial(result) {
  const elapsed = performance.now() - state.trialStart;
  const chosen = result.best.target.id;

  const strokePayload = state.stroke.map((p) => ({
    x: Number(p.x.toFixed(1)),
    y: Number(p.y.toFixed(1)),
    t: Number((p.t ?? 0).toFixed(1)),
  }));

  const entry = {
    patternId: state.speedEnabled ? 'path_and_speed' : 'path_only',
    chosenId: chosen,
    chosenLabel: result.best.target.label,
    chosenPathId: result.best.target.pathId,
    chosenSpeed: result.best.target.speedLabel,
    pointCount: state.stroke.length,
    elapsedMs: Math.round(elapsed),
    score: Number(result.best.score.toFixed(3)),
    ranked: result.ranked.map((r) => ({
      id: r.target.id,
      label: r.target.label,
      pathId: r.target.pathId,
      speed: r.target.speedLabel,
      score: Number(r.score.toFixed(3)),
      shape: Number((r.shape ?? 0).toFixed(3)),
      speedScore: Number((r.speed ?? 0).toFixed(3)),
    })),
    saved: false,
  };
  state.lastResult = entry;

  if (state.apiOnline) {
    try {
      await submitTrial({
        participant_code: state.participantCode || null,
        pattern_id: entry.patternId,
        target_count: TARGET_COUNT,
        chosen_id: entry.chosenId,
        chosen_label: entry.chosenLabel,
        point_count: entry.pointCount,
        elapsed_ms: entry.elapsedMs,
        score: entry.score,
        stroke: strokePayload,
        ranked: entry.ranked,
        user_agent: navigator.userAgent,
      });
      entry.saved = true;
    } catch (err) {
      console.warn('Trial save failed', err);
      state.saveError = err.message || 'Save failed';
      entry.saved = false;
    }
  }

  const cont = document.getElementById('btn-continue');
  if (cont) cont.hidden = false;
}

async function finishStroke() {
  const len = strokeLength(state.stroke);
  if (state.stroke.length < 8 || len < 40) {
    state.stroke = [];
    state.lastMessage = 'Stroke too short · try again';
    playClick('miss');
    updateHud();
    return;
  }

  if (state.selectedId) return;

  const result = recognizeStroke(state.targets, state.stroke, {
    useSpeed: state.speedEnabled,
  });

  if (result.confident) {
    state.selectedId = result.best.target.id;
    playClick('success');
    await recordTrial(result);
    updateHud();
    return;
  }

  state.lastMessage = 'No match · try again';
  playClick('miss');
  updateHud();
  setTimeout(() => {
    if (!state.selectedId) {
      state.stroke = [];
      updateHud();
    }
  }, 500);
}

function renderResult() {
  const r = state.lastResult;
  if (!r) {
    state.screen = 'home';
    renderShell();
    return;
  }

  const title = `Selected ${r.chosenLabel}`;

  const saveNote = !state.apiOnline
    ? 'API offline · kept in this browser only'
    : r.saved
      ? 'Saved to database (trials table)'
      : state.saveError
        ? `Not saved: ${escapeHtml(state.saveError)}`
        : 'Not saved';

  app.innerHTML = `
    <main class="page result">
      <p class="brand sm">Motion Match</p>
      <h1 class="ok">${title}</h1>
      <p class="lede tight">
        ${r.chosenSpeed || r.chosenPathId || ''} · ${r.pointCount} points · ${(r.elapsedMs / 1000).toFixed(1)}s · score ${r.score}
      </p>
      <p class="save-note">${saveNote}</p>

      <ul class="score-list">
        ${r.ranked
          .map(
            (row, i) => `
          <li class="${row.id === r.chosenId ? 'winner' : ''}">
            <span class="rank">${i + 1}</span>
            <span class="lab">${row.label}${row.speed ? ` ${row.speed}` : ''}</span>
            <span class="bar"><i style="width:${Math.round(row.score * 100)}%"></i></span>
            <span class="num">${row.score.toFixed(2)}</span>
          </li>`
          )
          .join('')}
      </ul>

      <div class="home-actions">
        <button class="btn primary" id="btn-again" type="button">Try again</button>
        <button class="btn ghost" id="btn-home" type="button">Home</button>
      </div>
    </main>
  `;

  document.getElementById('btn-again').onclick = () => startTrial();
  document.getElementById('btn-home').onclick = () => {
    state.screen = 'home';
    renderShell();
  };
}

function syncSpeedToggleUi() {
  const btn = document.getElementById('btn-speed-toggle');
  const live = document.getElementById('speed-live');
  if (btn) {
    btn.textContent = state.speedEnabled ? 'Speed: On' : 'Speed: Off';
    btn.classList.toggle('on', state.speedEnabled);
  }
  if (live) {
    live.hidden = !state.speedEnabled;
  }
}

function updatePathStatus() {
  const el = document.getElementById('path-status');
  if (!el || !state.targets.length) return;
  el.textContent = state.targets
    .map((t) => `${t.label}:${t.pathLabel}`)
    .join(' · ');
}

function updateUserSpeedHud() {
  const el = document.getElementById('speed-live');
  if (!el) return;
  if (!state.speedEnabled) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (state.stroke.length < 2) {
    el.textContent = 'Your speed: —';
    return;
  }
  const v = userAvgSpeed(state.stroke);
  const nearest = state.targets
    .map((t) => ({
      label: t.label,
      targetSp: targetAvgSpeed(t),
      diff: Math.abs(targetAvgSpeed(t) - v),
    }))
    .sort((a, b) => a.diff - b.diff)[0];
  el.textContent = nearest
    ? `Your speed: ${v.toFixed(2)} u/s · closest ${nearest.label} (${nearest.targetSp.toFixed(2)})`
    : `Your speed: ${v.toFixed(2)} u/s`;
}

function updateHud() {
  const hint = document.getElementById('foot-hint');
  if (!hint) return;

  updateUserSpeedHud();

  if (state.selectedId) {
    const t = state.targets.find((x) => x.id === state.selectedId);
    hint.textContent = `Matched ${t?.label ?? ''} · ${t?.speedLabel ?? ''} — tap View result`;
  } else if (state.lastMessage) {
    hint.textContent = state.lastMessage;
  } else if (state.drawing) {
    hint.textContent = 'Drawing… release to match';
  } else {
    hint.textContent = state.speedEnabled
      ? 'Watch the moving dot · match that path & speed'
      : 'Draw the path shape · speed does not matter';
  }

}

function resizeCanvas() {
  const canvas = state.canvas;
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  state.size = { w, h };
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function cancelAnim() {
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
  window.removeEventListener('resize', resizeCanvas);
}

function loop() {
  if (state.screen !== 'trial') return;
  state.animId = requestAnimationFrame(loop);
  draw();
}


function draw() {
  const ctx = state.ctx;
  const { w, h } = state.size;
  if (!ctx || !w) return;

  const t = performance.now() - state.startMs;
  const layout = computeLayout(w, h, state.targets.length);

  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.2, 10, w * 0.5, h * 0.35, h * 0.6);
  g.addColorStop(0, 'rgba(55, 90, 72, 0.32)');
  g.addColorStop(1, 'rgba(14, 21, 18, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Divider hint for draw zone
  ctx.strokeStyle = 'rgba(232, 240, 234, 0.1)';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(16, layout.drawTop);
  ctx.lineTo(w - 16, layout.drawTop);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(232, 240, 234, 0.35)';
  ctx.font = '500 11px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('draw anywhere below', w / 2, layout.drawTop + 16);

  // Demo panels + paths + moving indicators
  state.targets.forEach((target, i) => {
    const demo = layout.demos[i];
    const selected = state.selectedId === target.id;

    // panel
    ctx.fillStyle = selected
      ? 'rgba(126, 200, 163, 0.18)'
      : 'rgba(232, 240, 234, 0.05)';
    roundRect(ctx, demo.x, demo.y, demo.size, demo.size, 14);
    ctx.fill();

    // path guide
    const screenPath = pathToScreen(target.template, demo);
    ctx.strokeStyle = 'rgba(232, 240, 234, 0.28)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    screenPath.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // arrow hint at start
    if (screenPath.length) {
      ctx.fillStyle = 'rgba(232, 240, 234, 0.5)';
      ctx.beginPath();
      ctx.arc(screenPath[0].x, screenPath[0].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // moving indicator
    const ind = indicatorAt(target, t, demo);
    ctx.fillStyle = target.color;
    ctx.beginPath();
    ctx.arc(ind.x, ind.y, selected ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();

    // label (+ speed only when enabled)
    const avg = targetAvgSpeed(target);
    ctx.fillStyle = '#e8f0ea';
    ctx.font = '700 12px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (state.speedEnabled) {
      ctx.fillText(
        `${target.label} ${target.pathLabel} · ${target.speedLabel}`,
        demo.x + demo.size / 2,
        demo.y + demo.size - 20
      );
      ctx.fillStyle = 'rgba(232, 240, 234, 0.7)';
      ctx.font = '500 11px "DM Sans", sans-serif';
      ctx.fillText(`${avg.toFixed(2)} u/s`, demo.x + demo.size / 2, demo.y + demo.size - 6);
    } else {
      ctx.fillText(
        `${target.label} ${target.pathLabel}`,
        demo.x + demo.size / 2,
        demo.y + demo.size - 10
      );
    }
  });

  // user stroke
  if (state.stroke.length > 1) {
    ctx.strokeStyle = state.selectedId
      ? 'rgba(126, 200, 163, 0.95)'
      : 'rgba(240, 160, 90, 0.9)';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    state.stroke.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

boot();
