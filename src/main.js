import {
  computeLayout,
  pathToScreen,
  indicatorAt,
  PATH_LIBRARY,
  SPEED_PERIODS,
} from './paths.js';
import { recognizeStroke, strokeLength, targetAvgSpeed, userAvgSpeed } from './recognizer.js';
import { playClick, unlockAudio } from './audio.js';
import {
  getHealth,
  createSession,
  endSession,
  createTask,
  completeTask,
  createAttempt,
  submitQuestionnaire,
} from './api.js';
import { t, LIKERT_KEYS, OPEN_KEYS } from './i18n.js';

const app = document.getElementById('app');

const PATH_CHARS = {
  L_down_right: 'Two segments, one direction change, straight, open',
  L_right_down: 'Two segments, one direction change, straight, open',
  circle: 'Continuous curve, no direction change, curved, closed',
  diagonal: 'Single segment, no direction change, straight, open',
  zigzag: 'Four segments, three direction changes, straight, open',
  U_shape: 'Curved bottom, two direction changes, mixed, open',
};

const EVAL_PATH_IDS = Object.keys(PATH_LIBRARY);
const TARGET_COLORS_DARK = ['#e8f0ea', '#7ec8a3', '#f0a05a'];
const TARGET_COLORS_LIGHT = ['#1a2420', '#2f7a5a', '#c56a2a'];

function targetColors() {
  return state.theme === 'light' ? TARGET_COLORS_LIGHT : TARGET_COLORS_DARK;
}

/* ───────── balanced assignment across ~13 participants ───────── */

function participantIndex(code) {
  const m = String(code).match(/(\d+)/);
  if (m) return (parseInt(m[1], 10) - 1 + 1300) % 13;
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return Math.abs(h) % 13;
}

function makeTaskDef({ taskNumber, speedEnabled, pathId, speed }) {
  const prefix = speedEnabled ? 'path_speed' : 'path_only';
  return {
    taskNumber,
    speedEnabled,
    conditionId: speedEnabled
      ? `${prefix}_${pathId}_${speed.speedLabel}`
      : `${prefix}_${pathId}`,
    pathId,
    pathLabel: PATH_LIBRARY[pathId].label,
    pathCharacteristics: PATH_CHARS[pathId] || null,
    speedLabel: speed.speedLabel,
    speedMs: speed.period,
  };
}

/** Part 1: 3 path-only tasks. Paths rotate by participant index. */
function assignPart1Paths(index) {
  return [0, 1, 2].map((k) => EVAL_PATH_IDS[(index + k) % EVAL_PATH_IDS.length]);
}

function buildStudyPlan(participantCode) {
  const index = participantIndex(participantCode);
  const paths = assignPart1Paths(index);
  const speeds = [0, 1, 2].map((k) => SPEED_PERIODS[(index + k) % SPEED_PERIODS.length]);

  const part1 = paths.map((pathId, i) =>
    makeTaskDef({
      taskNumber: i + 1,
      speedEnabled: false,
      pathId,
      speed: speeds[i],
    }),
  );

  const part2 = paths.map((pathId, i) =>
    makeTaskDef({
      taskNumber: i + 1,
      speedEnabled: true,
      pathId,
      speed: speeds[i],
    }),
  );

  return { part1, part2 };
}

/* ───────── state ───────── */

const state = {
  screen: 'home',
  // home | instructions | trial | taskResult | part2Intro | questionnaire | evalEnd
  lang: localStorage.getItem('mm_lang') === 'zh' ? 'zh' : 'en',
  theme: localStorage.getItem('mm_theme') === 'light' ? 'light' : 'dark',
  participantCode: localStorage.getItem('mm_participant') || '',
  testingFormat: 'online',
  apiOnline: null,
  sessionId: null,

  part1: [],
  part2: [],
  currentQueue: [],
  taskIndex: 0,
  queueKind: 'part1',
  // part1 | part2
  currentTaskDef: null,
  currentTaskDbId: null,

  targets: [],
  intendedTarget: null,
  stroke: [],
  drawing: false,
  selectedId: null,
  attemptIndex: 0,
  errorCount: 0,
  taskStartMs: 0,
  lastMessage: '',
  lastResult: null,

  animId: null,
  canvas: null,
  ctx: null,
  size: { w: 0, h: 0 },
  startMs: 0,
};

function tt(key, vars) {
  return t(state.lang, key, vars);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = state.theme === 'dark' ? '#0e1512' : '#eef3f0';
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function speedEnabled() {
  return !!state.currentTaskDef?.speedEnabled;
}

async function boot() {
  applyTheme();
  try {
    await getHealth();
    state.apiOnline = true;
  } catch {
    state.apiOnline = false;
  }
  renderShell();
}

function renderShell() {
  const s = state.screen;
  if (s === 'home') renderHome();
  else if (s === 'instructions') renderInstructions();
  else if (s === 'trial') renderTrial();
  else if (s === 'taskResult') renderTaskResult();
  else if (s === 'part2Intro') renderPart2Intro();
  else if (s === 'questionnaire') renderQuestionnaire();
  else if (s === 'evalEnd') renderEvalEnd();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function phaseLabel() {
  const td = state.currentTaskDef;
  if (!td) return '';
  return td.speedEnabled ? tt('part2') : tt('part1');
}

/* ═══════════ HOME ═══════════ */

function renderHome() {
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <div class="prefs-bar">
        <div class="pref-group"><span>${tt('language')}</span>
          <div class="seg">
            <button type="button" id="lang-en" class="${state.lang === 'en' ? 'active' : ''}">EN</button>
            <button type="button" id="lang-zh" class="${state.lang === 'zh' ? 'active' : ''}">中文</button>
          </div>
        </div>
        <div class="pref-group"><span>${tt('theme')}</span>
          <div class="seg">
            <button type="button" id="theme-dark" class="${state.theme === 'dark' ? 'active' : ''}">${tt('themeDark')}</button>
            <button type="button" id="theme-light" class="${state.theme === 'light' ? 'active' : ''}">${tt('themeLight')}</button>
          </div>
        </div>
      </div>
      <header class="brand-block">
        <p class="brand">${tt('brand')}</p>
        <h1>${tt('homeTitle')}</h1>
        <p class="lede">${tt('homeLede')}</p>
      </header>
      <label class="field home-field">
        <span>${tt('participantCode')}</span>
        <input class="text-input" id="participant" type="text" maxlength="64"
               placeholder="${escapeHtml(tt('participantPlaceholder'))}" value="${escapeHtml(state.participantCode)}" required />
      </label>
      <label class="field home-field">
        <span>${tt('testingFormat')}</span>
        <select class="text-input" id="testing-format">
          <option value="online" ${state.testingFormat === 'online' ? 'selected' : ''}>${tt('formatOnline')}</option>
          <option value="in_person" ${state.testingFormat === 'in_person' ? 'selected' : ''}>${tt('formatInPerson')}</option>
        </select>
      </label>
      <div class="home-actions">
        <button class="btn primary" id="btn-start" type="button">${tt('beginStudy')}</button>
      </div>
    </main>
  `;

  document.getElementById('lang-en').onclick = () => {
    state.lang = 'en';
    localStorage.setItem('mm_lang', 'en');
    renderHome();
  };
  document.getElementById('lang-zh').onclick = () => {
    state.lang = 'zh';
    localStorage.setItem('mm_lang', 'zh');
    renderHome();
  };
  document.getElementById('theme-dark').onclick = () => {
    state.theme = 'dark';
    localStorage.setItem('mm_theme', 'dark');
    applyTheme();
    renderHome();
  };
  document.getElementById('theme-light').onclick = () => {
    state.theme = 'light';
    localStorage.setItem('mm_theme', 'light');
    applyTheme();
    renderHome();
  };

  const inp = document.getElementById('participant');
  inp.oninput = () => {
    state.participantCode = inp.value.trim();
    localStorage.setItem('mm_participant', state.participantCode);
  };
  document.getElementById('testing-format').onchange = (e) => {
    state.testingFormat = e.target.value;
  };
  document.getElementById('btn-start').onclick = () => {
    if (!state.participantCode) {
      inp.focus();
      inp.reportValidity?.();
      return;
    }
    unlockAudio();
    beginStudy();
  };
}

async function beginStudy() {
  const plan = buildStudyPlan(state.participantCode);
  state.part1 = plan.part1;
  state.part2 = plan.part2;

  if (state.apiOnline) {
    try {
      const s = await createSession({
        participant_code: state.participantCode,
        testing_format: state.testingFormat,
        device_info: navigator.userAgent,
      });
      state.sessionId = s.id;
    } catch (e) {
      console.warn('Session creation failed', e);
    }
  }

  state.screen = 'instructions';
  renderShell();
}

/* ═══════════ INSTRUCTIONS ═══════════ */

function renderInstructions() {
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand sm">${tt('brand')}</p>
        <h1>${tt('howItWorks')}</h1>
      </header>
      <div class="instructions-body">
        <ol class="instr-list">
          <li>${tt('instr1')}</li>
          <li>${tt('instr2', { n: state.part1.length })}</li>
          <li>${tt('instr3', { n: state.part2.length })}</li>
        </ol>
      </div>
      <div class="home-actions">
        <button class="btn primary" id="btn-start-part1" type="button">${tt('startPart1')}</button>
      </div>
    </main>
  `;

  document.getElementById('btn-start-part1').onclick = () => {
    state.queueKind = 'part1';
    state.currentQueue = state.part1;
    state.taskIndex = 0;
    startNextTask();
  };
}

function renderPart2Intro() {
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand sm">${tt('brand')}</p>
        <h1>${tt('part2Title')}</h1>
        <p class="lede">${tt('part2Lede', { n: state.part2.length })}</p>
      </header>
      <div class="home-actions">
        <button class="btn primary" id="btn-part2" type="button">${tt('startPart2')}</button>
      </div>
    </main>
  `;
  document.getElementById('btn-part2').onclick = () => {
    state.queueKind = 'part2';
    state.currentQueue = state.part2;
    state.taskIndex = 0;
    startNextTask();
  };
}

/* ═══════════ TASK LIFECYCLE ═══════════ */

function advanceAfterQueue() {
  if (state.queueKind === 'part1') {
    state.screen = 'part2Intro';
    renderShell();
    return;
  }
  finishStudy();
}

async function startNextTask() {
  if (state.taskIndex >= state.currentQueue.length) {
    advanceAfterQueue();
    return;
  }

  const taskDef = state.currentQueue[state.taskIndex];
  state.currentTaskDef = taskDef;
  state.currentTaskDbId = null;

  const targets = buildTrialTargets(taskDef);
  state.targets = targets;
  state.intendedTarget = targets.find((t) => t.isIntended);

  state.stroke = [];
  state.drawing = false;
  state.selectedId = null;
  state.attemptIndex = 0;
  state.errorCount = 0;
  state.taskStartMs = performance.now();
  state.lastMessage = '';
  state.lastResult = null;

  if (state.apiOnline && state.sessionId) {
    try {
      const t = await createTask({
        session_id: state.sessionId,
        task_number: taskDef.taskNumber,
        speed_enabled: taskDef.speedEnabled,
        condition_id: taskDef.conditionId,
        path_id: taskDef.pathId,
        path_label: taskDef.pathLabel,
        path_characteristics: taskDef.pathCharacteristics,
        speed_label: taskDef.speedLabel,
        speed_ms: taskDef.speedMs,
        target_count: 3,
      });
      state.currentTaskDbId = t.id;
    } catch (e) {
      console.warn('Task creation failed', e);
    }
  }

  state.screen = 'trial';
  renderShell();
}

function makeTarget(i, pathId, speed, isIntended) {
  const def = PATH_LIBRARY[pathId];
  return {
    id: `t${i}`,
    label: String.fromCharCode(65 + i),
    pathId,
    pathLabel: def.label,
    speedLabel: speed.speedLabel,
    template: def.points.map(([x, y]) => ({ x, y })),
    period: speed.period,
    color: targetColors()[i],
    isIntended,
  };
}

function buildTrialTargets(taskDef) {
  const otherPaths = EVAL_PATH_IDS.filter((id) => id !== taskDef.pathId).sort(
    () => Math.random() - 0.5,
  );
  const intendedSpeed = SPEED_PERIODS.find((s) => s.speedLabel === taskDef.speedLabel);
  const otherSpeeds = SPEED_PERIODS.filter((s) => s.speedLabel !== taskDef.speedLabel);
  const intendedIdx = Math.floor(Math.random() * 3);
  const targets = [];
  let distIdx = 0;

  for (let i = 0; i < 3; i++) {
    if (i === intendedIdx) {
      targets.push(makeTarget(i, taskDef.pathId, intendedSpeed, true));
    } else {
      targets.push(
        makeTarget(
          i,
          otherPaths[distIdx % otherPaths.length],
          otherSpeeds[distIdx % otherSpeeds.length],
          false,
        ),
      );
      distIdx++;
    }
  }
  return targets;
}

async function finishStudy() {
  if (state.apiOnline && state.sessionId) {
    try {
      await endSession(state.sessionId);
    } catch (e) {
      console.warn('End session failed', e);
    }
  }
  state.screen = 'questionnaire';
  renderShell();
}

/* ═══════════ TRIAL ═══════════ */

function renderTrial() {
  cancelAnim();
  const td = state.currentTaskDef;
  const progress = `${state.taskIndex + 1} / ${state.currentQueue.length}`;
  const intended = state.intendedTarget;
  const modeHint = td.speedEnabled
    ? `${td.pathLabel} · ${td.speedLabel}`
    : `${td.pathLabel} · ${tt('matchPathOnly')}`;

  app.innerHTML = `
    <main class="page trial">
      <header class="trial-bar">
        <button class="back subtle" id="btn-exit" type="button">${tt('exit')}</button>
        <div class="trial-status">
          <span class="mode-pill">${phaseLabel()} · ${progress}</span>
          <span class="intend">${tt('matchTarget')} <strong>${intended?.label || '?'}</strong> · ${modeHint}</span>
        </div>
        <button class="back subtle" id="btn-clear" type="button">${tt('clear')}</button>
      </header>

      <div class="stage-wrap">
        <canvas id="stage" aria-label="Motion matching stage"></canvas>
        <div class="tap-layer" id="draw-layer" role="application" aria-label="Draw area"></div>
      </div>

      <footer class="trial-foot">
        <p class="speed-live" id="speed-live" ${td.speedEnabled ? '' : 'hidden'}>${tt('yourSpeed')}: —</p>
        <p class="foot-hint" id="foot-hint">${
          td.speedEnabled ? tt('hintPathSpeed') : tt('hintPathOnly')
        }</p>
      </footer>
    </main>
  `;

  document.getElementById('btn-exit').onclick = () => {
    if (confirm(tt('exitConfirm'))) {
      cancelAnim();
      state.screen = 'home';
      renderShell();
    }
  };
  document.getElementById('btn-clear').onclick = () => {
    resetAttempt();
    updateHud();
  };

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
    if (e.type !== 'pointercancel') state.stroke.push(pointFromEvent(e));
    finishStroke();
  };

  layer.addEventListener('pointerdown', onDown, { passive: false });
  layer.addEventListener('pointermove', onMove, { passive: false });
  layer.addEventListener('pointerup', onUp, { passive: false });
  layer.addEventListener('pointercancel', onUp, { passive: false });

  state.startMs = performance.now();
  loop();
}

function resetAttempt() {
  state.stroke = [];
  state.selectedId = null;
  state.lastResult = null;
  state.lastMessage = '';
}

async function finishStroke() {
  const len = strokeLength(state.stroke);
  if (state.stroke.length < 8 || len < 40) {
    state.stroke = [];
    state.lastMessage = tt('strokeTooShort');
    playClick('miss');
    updateHud();
    return;
  }
  if (state.selectedId) return;

  state.attemptIndex++;
  const useSpeed = speedEnabled();
  const result = recognizeStroke(state.targets, state.stroke, { useSpeed });

  const strokePayload = state.stroke.map((p) => ({
    x: Number(p.x.toFixed(1)),
    y: Number(p.y.toFixed(1)),
    t: Number((p.t ?? 0).toFixed(1)),
  }));

  const elapsed = performance.now() - state.taskStartMs;
  const isCorrect = result.confident && result.best.target.id === state.intendedTarget.id;

  if (result.confident && isCorrect) {
    state.selectedId = result.best.target.id;
    playClick('success');
    await submitAttempt(true, result, strokePayload);

    if (state.apiOnline && state.currentTaskDbId) {
      try {
        await completeTask(state.currentTaskDbId, {
          completed: true,
          success_attempt_index: state.attemptIndex,
          total_attempts: state.attemptIndex,
          error_count: state.errorCount,
          completion_time_ms: Math.round(elapsed),
        });
      } catch (e) {
        console.warn('completeTask failed', e);
      }
    }

    state.lastResult = {
      score: result.best.score,
      attempts: state.attemptIndex,
      errors: state.errorCount,
      elapsedMs: Math.round(elapsed),
      ranked: result.ranked.map((r) => ({
        id: r.target.id,
        label: r.target.label,
        speed: r.target.speedLabel,
        score: Number(r.score.toFixed(3)),
      })),
    };

    updateHud();
    setTimeout(() => {
      state.screen = 'taskResult';
      renderShell();
    }, 800);
    return;
  }

  state.errorCount++;
  const reason = result.confident ? 'wrong_target' : result.reason || 'no_match';
  await submitAttempt(false, result, strokePayload, reason);

  state.lastMessage = result.confident
    ? tt('wrongTarget', {
        got: result.best.target.label,
        want: state.intendedTarget.label,
      })
    : tt('noMatch');
  playClick('miss');
  updateHud();
  setTimeout(() => {
    if (!state.selectedId) {
      state.stroke = [];
      updateHud();
    }
  }, 500);
}

async function submitAttempt(success, result, strokePayload, reason = null) {
  if (!state.apiOnline || !state.currentTaskDbId) return;
  const best = result.best;
  try {
    await createAttempt({
      task_id: state.currentTaskDbId,
      attempt_index: state.attemptIndex,
      success,
      matched_target_id: best?.target?.id || null,
      matched_label: best?.target?.label || null,
      elapsed_ms: Math.round(performance.now() - state.taskStartMs),
      score: best ? Number(best.score.toFixed(3)) : 0,
      shape_score: best ? Number((best.shape ?? 0).toFixed(3)) : 0,
      speed_score: best ? Number((best.speed ?? 0).toFixed(3)) : 0,
      point_count: state.stroke.length,
      stroke: strokePayload,
      ranked: result.ranked.map((r) => ({
        id: r.target.id,
        label: r.target.label,
        score: Number(r.score.toFixed(3)),
        pathId: r.target.pathId,
        speed: r.target.speedLabel,
        shape: Number((r.shape ?? 0).toFixed(3)),
        speedScore: Number((r.speed ?? 0).toFixed(3)),
      })),
      reason: reason || (success ? 'ok' : 'no_match'),
    });
  } catch (e) {
    console.warn('submitAttempt failed', e);
  }
}

/* ═══════════ TASK RESULT ═══════════ */

function renderTaskResult() {
  cancelAnim();
  const r = state.lastResult;
  const td = state.currentTaskDef;
  if (!r) {
    state.screen = 'home';
    renderShell();
    return;
  }

  const modeText = td.speedEnabled
    ? `${td.pathLabel} ${td.speedLabel}`
    : `${td.pathLabel} ${tt('pathOnlyTag')}`;
  const moreInQueue = state.taskIndex + 1 < state.currentQueue.length;
  let nextLabel = tt('nextTask');
  if (!moreInQueue) {
    nextLabel = state.queueKind === 'part1' ? tt('continuePart2') : tt('finishStudy');
  }

  app.innerHTML = `
    <main class="page result">
      <p class="brand sm">${tt('brand')}</p>
      <h1 class="ok">${tt('taskComplete')}</h1>
      <p class="lede tight">
        ${phaseLabel()} · ${state.taskIndex + 1} / ${state.currentQueue.length}<br>
        ${tt('target')}: ${state.intendedTarget.label} · ${modeText}<br>
        ${tt('score')}: ${r.score.toFixed(2)} · ${tt('attempts')}: ${r.attempts} · ${tt('errors')}: ${r.errors} · ${tt('time')}: ${(r.elapsedMs / 1000).toFixed(1)}s
      </p>

      <ul class="score-list">
        ${r.ranked
          .map(
            (row, i) => `
          <li class="${row.id === state.intendedTarget.id ? 'winner' : ''}">
            <span class="rank">${i + 1}</span>
            <span class="lab">${row.label}${td.speedEnabled && row.speed ? ` ${row.speed}` : ''}</span>
            <span class="bar"><i style="width:${Math.round(row.score * 100)}%"></i></span>
            <span class="num">${row.score.toFixed(2)}</span>
          </li>`,
          )
          .join('')}
      </ul>

      <div class="home-actions">
        <button class="btn primary" id="btn-next" type="button">${nextLabel}</button>
      </div>
    </main>
  `;

  document.getElementById('btn-next').onclick = () => {
    state.taskIndex++;
    startNextTask();
  };
}

/* ═══════════ QUESTIONNAIRE ═══════════ */

function renderQuestionnaire() {
  cancelAnim();

  const likertHtml = LIKERT_KEYS.map(
    (key) => `
    <div class="likert-item" data-key="${key}">
      <p>${tt(key)}</p>
      <div class="scale-ends">
        <span>${tt('scaleDisagree')}</span>
        <span>${tt('scaleHint')}</span>
        <span>${tt('scaleAgree')}</span>
      </div>
      <div class="likert-scale">
        ${[1, 2, 3, 4, 5, 6, 7]
          .map(
            (n) => `
          <label>
            <input type="radio" name="${key}" value="${n}" />
            ${n}
          </label>`,
          )
          .join('')}
      </div>
    </div>`,
  ).join('');

  const openHtml = OPEN_KEYS.map(
    (key) => `
    <div class="open-item">
      <label for="${key}">${tt(key)} <span style="color:var(--fg-dim)">${tt('openOptional')}</span></label>
      <textarea id="${key}" name="${key}" rows="3"></textarea>
    </div>`,
  ).join('');

  app.innerHTML = `
    <main class="page questionnaire">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand sm">${tt('brand')}</p>
        <h1>${tt('questionnaireTitle')}</h1>
        <p class="lede">${tt('questionnaireLede')}</p>
      </header>
      <form class="questionnaire-form" id="questionnaire-form">
        ${likertHtml}
        <h2>${tt('openTitle')}</h2>
        ${openHtml}
        <p class="form-error" id="form-error" hidden></p>
        <div class="home-actions">
          <button class="btn primary" id="btn-submit-q" type="submit">${tt('submitQuestionnaire')}</button>
        </div>
      </form>
    </main>
  `;

  const form = document.getElementById('questionnaire-form');
  const errEl = document.getElementById('form-error');
  const btn = document.getElementById('btn-submit-q');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.hidden = true;

    const ratings = {};
    for (const key of LIKERT_KEYS) {
      const checked = form.querySelector(`input[name="${key}"]:checked`);
      if (!checked) {
        errEl.textContent = tt('requiredRatings');
        errEl.hidden = false;
        return;
      }
      ratings[key] = Number(checked.value);
    }

    const open_answers = {};
    for (const key of OPEN_KEYS) {
      const el = document.getElementById(key);
      const val = (el?.value || '').trim();
      if (val) open_answers[key] = val;
    }

    btn.disabled = true;
    btn.textContent = tt('submitting');

    if (state.apiOnline && state.sessionId) {
      try {
        await submitQuestionnaire({
          session_id: state.sessionId,
          language: state.lang,
          ratings,
          open_answers,
        });
      } catch (err) {
        console.warn('Questionnaire submit failed', err);
      }
    }

    state.screen = 'evalEnd';
    renderShell();
  };
}

/* ═══════════ EVAL END ═══════════ */

function renderEvalEnd() {
  cancelAnim();
  const formalCount = state.part1.length + state.part2.length;
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand">${tt('thankYou')}</p>
        <h1>${tt('evalComplete')}</h1>
        <p class="lede">${tt('evalCompleteLede', { n: formalCount })}</p>
      </header>
      <div class="home-actions">
        <button class="btn ghost" id="btn-restart" type="button">${tt('startNew')}</button>
      </div>
    </main>
  `;

  document.getElementById('btn-restart').onclick = () => {
    state.sessionId = null;
    state.screen = 'home';
    renderShell();
  };
}

/* ═══════════ HUD ═══════════ */

function updateUserSpeedHud() {
  const el = document.getElementById('speed-live');
  if (!el) return;
  if (!speedEnabled()) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (state.stroke.length < 2) {
    el.textContent = `${tt('yourSpeed')}: —`;
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
    ? `${tt('yourSpeed')}: ${v.toFixed(2)} u/s · ${tt('closest')} ${nearest.label} (${nearest.targetSp.toFixed(2)})`
    : `${tt('yourSpeed')}: ${v.toFixed(2)} u/s`;
}

function updateHud() {
  const hint = document.getElementById('foot-hint');
  if (!hint) return;
  updateUserSpeedHud();

  if (state.selectedId) {
    const t = state.targets.find((x) => x.id === state.selectedId);
    hint.textContent = tt('matchedCorrect', { label: t?.label ?? '' });
  } else if (state.lastMessage) {
    hint.textContent = state.lastMessage;
  } else if (state.drawing) {
    hint.textContent = tt('drawing');
  } else {
    hint.textContent = speedEnabled()
      ? tt('hintIdleSpeed', { label: state.intendedTarget?.label || '?' })
      : tt('hintIdlePath', { label: state.intendedTarget?.label || '?' });
  }
}

/* ═══════════ Canvas ═══════════ */

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

  const now = performance.now() - state.startMs;
  const layout = computeLayout(w, h, state.targets.length);
  const showSpeed = speedEnabled();

  const canvasGlow = cssVar('--canvas-glow');
  const canvasPanel = cssVar('--canvas-panel');
  const canvasPanelIntended = cssVar('--canvas-panel-intended');
  const canvasPanelSelected = cssVar('--canvas-panel-selected');
  const canvasPath = cssVar('--canvas-path');
  const canvasMuted = cssVar('--canvas-muted');
  const canvasLabel = cssVar('--canvas-label');
  const strokeUser = cssVar('--stroke-user');
  const strokeOk = cssVar('--stroke-ok');
  const accent = cssVar('--accent');

  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.2, 10, w * 0.5, h * 0.35, h * 0.6);
  g.addColorStop(0, canvasGlow || 'rgba(55, 90, 72, 0.32)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = canvasMuted || 'rgba(232, 240, 234, 0.35)';
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(16, layout.drawTop);
  ctx.lineTo(w - 16, layout.drawTop);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = canvasMuted || 'rgba(232, 240, 234, 0.35)';
  ctx.font = '500 11px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tt('drawBelow'), w / 2, layout.drawTop + 16);

  state.targets.forEach((target, i) => {
    const demo = layout.demos[i];
    const selected = state.selectedId === target.id;
    const isIntended = target.isIntended;

    ctx.fillStyle = selected
      ? canvasPanelSelected || 'rgba(126, 200, 163, 0.18)'
      : isIntended
        ? canvasPanelIntended || 'rgba(126, 200, 163, 0.10)'
        : canvasPanel || 'rgba(232, 240, 234, 0.05)';
    roundRect(ctx, demo.x, demo.y, demo.size, demo.size, 14);
    ctx.fill();

    if (isIntended && !selected) {
      ctx.strokeStyle = accent || 'rgba(126, 200, 163, 0.45)';
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      roundRect(ctx, demo.x, demo.y, demo.size, demo.size, 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const screenPath = pathToScreen(target.template, demo);
    ctx.strokeStyle = canvasPath || 'rgba(232, 240, 234, 0.28)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    screenPath.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    if (screenPath.length) {
      ctx.fillStyle = canvasMuted || 'rgba(232, 240, 234, 0.5)';
      ctx.beginPath();
      ctx.arc(screenPath[0].x, screenPath[0].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const ind = indicatorAt(target, now, demo);
    ctx.fillStyle = target.color;
    ctx.beginPath();
    ctx.arc(ind.x, ind.y, selected ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = canvasLabel || '#e8f0ea';
    ctx.font = '700 12px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (showSpeed) {
      const avg = targetAvgSpeed(target);
      ctx.fillText(
        `${target.label} ${target.pathLabel} · ${target.speedLabel}`,
        demo.x + demo.size / 2,
        demo.y + demo.size - 20,
      );
      ctx.fillStyle = canvasMuted || 'rgba(232, 240, 234, 0.7)';
      ctx.font = '500 11px "DM Sans", sans-serif';
      ctx.fillText(`${avg.toFixed(2)} u/s`, demo.x + demo.size / 2, demo.y + demo.size - 6);
    } else {
      ctx.fillText(
        `${target.label} ${target.pathLabel}`,
        demo.x + demo.size / 2,
        demo.y + demo.size - 10,
      );
    }
  });

  if (state.stroke.length > 1) {
    ctx.strokeStyle = state.selectedId
      ? strokeOk || 'rgba(126, 200, 163, 0.95)'
      : strokeUser || 'rgba(240, 160, 90, 0.9)';
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
