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
import { buildStudyPlan, EVAL_PATH_IDS } from './studyPlan.js';

const app = document.getElementById('app');
const MAX_ATTEMPTS = 5;

const TARGET_COLORS = ['#e8f0ea', '#7ec8a3', '#f0a05a'];

function targetColors() {
  return TARGET_COLORS;
}

function bestMatch(result) {
  return result.best ?? result.ranked?.[0] ?? null;
}

function dominantPointerType(stroke) {
  const counts = {};
  for (const p of stroke) {
    const pt = p.pointerType || 'unknown';
    counts[pt] = (counts[pt] || 0) + 1;
  }
  let top = 'unknown';
  let max = 0;
  for (const [pt, n] of Object.entries(counts)) {
    if (n > max) {
      max = n;
      top = pt;
    }
  }
  return top;
}

const state = {
  screen: 'home',
  participantCode: localStorage.getItem('mm_participant') || '',
  testingFormat: 'online',
  apiOnline: null,
  sessionId: null,

  practice: [],
  part1: [],
  part2: [],
  currentQueue: [],
  taskIndex: 0,
  queueKind: 'practice',
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

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function speedEnabled() {
  return !!state.currentTaskDef?.speedEnabled;
}

function formalTaskCount() {
  return state.part1.length + state.part2.length;
}

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
  const s = state.screen;
  if (s === 'home') renderHome();
  else if (s === 'instructions') renderInstructions();
  else if (s === 'part1Intro') renderPart1Intro();
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
  if (td.practice) return t('practice');
  return td.speedEnabled ? t('part2') : t('part1');
}

/* ═══════════ HOME ═══════════ */

function renderHome() {
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand">${t('brand')}</p>
        <h1>${t('homeTitle')}</h1>
        <p class="lede">${t('homeLede')}</p>
        <p class="lede touch-note">${t('touchRequired')}</p>
      </header>
      <label class="field home-field">
        <span>${t('participantCode')}</span>
        <input class="text-input" id="participant" type="text" maxlength="64"
               placeholder="${escapeHtml(t('participantPlaceholder'))}" value="${escapeHtml(state.participantCode)}" required />
      </label>
      <label class="field home-field">
        <span>${t('testingFormat')}</span>
        <select class="text-input" id="testing-format">
          <option value="online" ${state.testingFormat === 'online' ? 'selected' : ''}>${t('formatOnline')}</option>
          <option value="in_person" ${state.testingFormat === 'in_person' ? 'selected' : ''}>${t('formatInPerson')}</option>
        </select>
      </label>
      <div class="home-actions">
        <button class="btn primary" id="btn-start" type="button">${t('beginStudy')}</button>
      </div>
    </main>
  `;

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
  state.practice = plan.practice;
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
        <p class="brand sm">${t('brand')}</p>
        <h1>${t('howItWorks')}</h1>
        <p class="lede touch-note">${t('touchRequired')}</p>
      </header>
      <div class="instructions-body">
        <ol class="instr-list">
          <li>${t('instr1')}</li>
          <li>${t('instr2', { n: state.practice.length })}</li>
          <li>${t('instr3', { n: state.part1.length })}</li>
          <li>${t('instr4', { n: state.part2.length })}</li>
        </ol>
      </div>
      <div class="home-actions">
        <button class="btn primary" id="btn-start-practice" type="button">${t('startPractice')}</button>
      </div>
    </main>
  `;

  document.getElementById('btn-start-practice').onclick = () => {
    state.queueKind = 'practice';
    state.currentQueue = state.practice;
    state.taskIndex = 0;
    startNextTask();
  };
}

function renderPart1Intro() {
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand sm">${t('brand')}</p>
        <h1>${t('part1Title')}</h1>
        <p class="lede">${t('part1Lede', { n: state.part1.length })}</p>
      </header>
      <div class="home-actions">
        <button class="btn primary" id="btn-part1" type="button">${t('startPart1')}</button>
      </div>
    </main>
  `;
  document.getElementById('btn-part1').onclick = () => {
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
        <p class="brand sm">${t('brand')}</p>
        <h1>${t('part2Title')}</h1>
        <p class="lede">${t('part2Lede', { n: state.part2.length })}</p>
      </header>
      <div class="home-actions">
        <button class="btn primary" id="btn-part2" type="button">${t('startPart2')}</button>
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
  if (state.queueKind === 'practice') {
    state.screen = 'part1Intro';
    renderShell();
    return;
  }
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
  state.taskStartMs = 0;
  state.lastMessage = '';
  state.lastResult = null;

  if (state.apiOnline && state.sessionId) {
    try {
      const row = await createTask({
        session_id: state.sessionId,
        task_number: taskDef.taskNumber,
        practice: !!taskDef.practice,
        speed_enabled: taskDef.speedEnabled,
        condition_id: taskDef.conditionId,
        path_id: taskDef.pathId,
        path_label: taskDef.pathLabel,
        path_characteristics: taskDef.pathCharacteristics,
        speed_label: taskDef.speedLabel,
        speed_ms: taskDef.speedMs,
        target_count: 3,
      });
      state.currentTaskDbId = row.id;
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

function taskElapsedMs() {
  if (!state.taskStartMs) return 0;
  return Math.round(performance.now() - state.taskStartMs);
}

async function finalizeTaskSuccess(result) {
  const top = result.best;
  const elapsed = taskElapsedMs();

  if (state.apiOnline && state.currentTaskDbId) {
    try {
      await completeTask(state.currentTaskDbId, {
        completed: true,
        success_attempt_index: state.attemptIndex,
        total_attempts: state.attemptIndex,
        error_count: state.errorCount,
        completion_time_ms: elapsed,
      });
    } catch (e) {
      console.warn('completeTask failed', e);
    }
  }

  state.lastResult = {
    failed: false,
    score: top.score,
    attempts: state.attemptIndex,
    errors: state.errorCount,
    elapsedMs: elapsed,
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
}

async function finalizeTaskFailure() {
  const elapsed = taskElapsedMs();

  if (state.apiOnline && state.currentTaskDbId) {
    try {
      await completeTask(state.currentTaskDbId, {
        completed: true,
        success_attempt_index: null,
        total_attempts: state.attemptIndex,
        error_count: state.errorCount,
        completion_time_ms: elapsed,
      });
    } catch (e) {
      console.warn('completeTask failed', e);
    }
  }

  state.lastResult = {
    failed: true,
    attempts: state.attemptIndex,
    errors: state.errorCount,
    elapsedMs: elapsed,
    ranked: [],
  };

  state.screen = 'taskResult';
  renderShell();
}

async function checkMaxAttempts() {
  if (state.attemptIndex < MAX_ATTEMPTS) return false;
  state.lastMessage = t('maxAttempts');
  playClick('miss');
  await finalizeTaskFailure();
  return true;
}

/* ═══════════ TRIAL ═══════════ */

function renderTrial() {
  cancelAnim();
  const td = state.currentTaskDef;
  const progress = `${state.taskIndex + 1} / ${state.currentQueue.length}`;
  const intended = state.intendedTarget;
  const modeHint = td.speedEnabled
    ? `${td.pathLabel} · ${td.speedLabel}`
    : `${td.pathLabel} · ${t('matchPathOnly')}`;

  app.innerHTML = `
    <main class="page trial">
      <header class="trial-bar">
        <button class="back subtle" id="btn-exit" type="button">${t('exit')}</button>
        <div class="trial-status">
          <span class="mode-pill">${phaseLabel()} · ${progress}</span>
          <span class="intend">${t('matchTarget')} <strong>${intended?.label || '?'}</strong> · ${modeHint}</span>
        </div>
        <button class="back subtle" id="btn-clear" type="button">${t('clear')}</button>
      </header>

      <div class="stage-wrap">
        <canvas id="stage" aria-label="Motion matching stage"></canvas>
        <div class="tap-layer" id="draw-layer" role="application" aria-label="Draw area"></div>
      </div>

      <footer class="trial-foot">
        <p class="speed-live" id="speed-live" ${td.speedEnabled ? '' : 'hidden'}>${t('yourSpeed')}: —</p>
        <p class="foot-hint" id="foot-hint">${
          td.speedEnabled ? t('hintPathSpeed') : t('hintPathOnly')
        }</p>
      </footer>
    </main>
  `;

  document.getElementById('btn-exit').onclick = () => {
    if (confirm(t('exitConfirm'))) {
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
      pointerType: e.pointerType || 'unknown',
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
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.screen === 'trial') {
        state.taskStartMs = performance.now();
      }
    });
  });
  loop();
}

function resetAttempt() {
  state.stroke = [];
  state.selectedId = null;
  state.lastResult = null;
  state.lastMessage = '';
}

function strokePayloadFrom(stroke) {
  return stroke.map((p) => ({
    x: Number(p.x.toFixed(1)),
    y: Number(p.y.toFixed(1)),
    t: Number((p.t ?? 0).toFixed(1)),
    pointerType: p.pointerType || 'unknown',
  }));
}

async function finishStroke() {
  const len = strokeLength(state.stroke);
  const strokePayload = strokePayloadFrom(state.stroke);
  const pointerType = dominantPointerType(state.stroke);

  if (state.stroke.length < 8 || len < 40) {
    state.attemptIndex++;
    state.errorCount++;
    state.stroke = [];
    state.lastMessage = t('strokeTooShort');
    playClick('miss');
    await submitAttempt(
      false,
      { best: null, ranked: [] },
      strokePayload,
      'too_short',
      pointerType,
    );
    updateHud();
    if (await checkMaxAttempts()) return;
    return;
  }
  if (state.selectedId) return;

  state.attemptIndex++;
  const useSpeed = speedEnabled();
  const result = recognizeStroke(state.targets, state.stroke, { useSpeed });
  const top = bestMatch(result);
  const isCorrect = result.confident && result.best?.target.id === state.intendedTarget.id;

  if (isCorrect) {
    state.selectedId = result.best.target.id;
    playClick('success');
    await submitAttempt(true, result, strokePayload, 'ok', pointerType);
    await finalizeTaskSuccess(result);
    return;
  }

  state.errorCount++;
  const reason = result.confident ? 'wrong_target' : result.reason || 'no_match';
  await submitAttempt(false, result, strokePayload, reason, pointerType);

  state.lastMessage = result.confident
    ? t('wrongTarget', {
        got: result.best.target.label,
        want: state.intendedTarget.label,
      })
    : t('noMatch');
  playClick('miss');
  updateHud();

  if (await checkMaxAttempts()) return;

  setTimeout(() => {
    if (!state.selectedId) {
      state.stroke = [];
      updateHud();
    }
  }, 500);
}

async function submitAttempt(success, result, strokePayload, reason = null, pointerType = null) {
  if (!state.apiOnline || !state.currentTaskDbId) return;
  const top = bestMatch(result);
  try {
    await createAttempt({
      task_id: state.currentTaskDbId,
      attempt_index: state.attemptIndex,
      success,
      matched_target_id: top?.target?.id || null,
      matched_label: top?.target?.label || null,
      elapsed_ms: taskElapsedMs(),
      score: top ? Number(top.score.toFixed(3)) : 0,
      shape_score: top ? Number((top.shape ?? 0).toFixed(3)) : 0,
      speed_score: top ? Number((top.speed ?? 0).toFixed(3)) : 0,
      point_count: strokePayload.length,
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
      pointer_type: pointerType,
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
    : `${td.pathLabel} ${t('pathOnlyTag')}`;
  const moreInQueue = state.taskIndex + 1 < state.currentQueue.length;
  let nextLabel = t('nextTask');
  if (!moreInQueue) {
    if (state.queueKind === 'practice') nextLabel = t('continuePart1');
    else if (state.queueKind === 'part1') nextLabel = t('continuePart2');
    else nextLabel = t('finishStudy');
  }

  const title = r.failed ? t('taskFailed') : t('taskComplete');
  const titleClass = r.failed ? 'fail' : 'ok';
  const scoreLine = r.failed
    ? `${t('attempts')}: ${r.attempts} · ${t('errors')}: ${r.errors} · ${t('time')}: ${(r.elapsedMs / 1000).toFixed(1)}s`
    : `${t('score')}: ${r.score.toFixed(2)} · ${t('attempts')}: ${r.attempts} · ${t('errors')}: ${r.errors} · ${t('time')}: ${(r.elapsedMs / 1000).toFixed(1)}s`;

  const rankedHtml = r.ranked?.length
    ? `<ul class="score-list">
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
      </ul>`
    : '';

  app.innerHTML = `
    <main class="page result">
      <p class="brand sm">${t('brand')}</p>
      <h1 class="${titleClass}">${title}</h1>
      <p class="lede tight">
        ${phaseLabel()} · ${state.taskIndex + 1} / ${state.currentQueue.length}<br>
        ${t('target')}: ${state.intendedTarget.label} · ${modeText}<br>
        ${scoreLine}
      </p>
      ${rankedHtml}
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
      <p>${t(key)}</p>
      <div class="scale-ends">
        <span>${t('scaleDisagree')}</span>
        <span>${t('scaleHint')}</span>
        <span>${t('scaleAgree')}</span>
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
      <label for="${key}">${t(key)} <span style="color:var(--fg-dim)">${t('openOptional')}</span></label>
      <textarea id="${key}" name="${key}" rows="3"></textarea>
    </div>`,
  ).join('');

  app.innerHTML = `
    <main class="page questionnaire">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand sm">${t('brand')}</p>
        <h1>${t('questionnaireTitle')}</h1>
        <p class="lede">${t('questionnaireLede')}</p>
      </header>
      <form class="questionnaire-form" id="questionnaire-form">
        ${likertHtml}
        <h2>${t('openTitle')}</h2>
        ${openHtml}
        <p class="form-error" id="form-error" hidden></p>
        <div class="home-actions">
          <button class="btn primary" id="btn-submit-q" type="submit">${t('submitQuestionnaire')}</button>
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
        errEl.textContent = t('requiredRatings');
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
    btn.textContent = t('submitting');

    if (state.apiOnline && state.sessionId) {
      try {
        await submitQuestionnaire({
          session_id: state.sessionId,
          language: 'en',
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
  app.innerHTML = `
    <main class="page home">
      <div class="atmosphere" aria-hidden="true"></div>
      <header class="brand-block">
        <p class="brand">${t('thankYou')}</p>
        <h1>${t('evalComplete')}</h1>
        <p class="lede">${t('evalCompleteLede', { n: formalTaskCount() })}</p>
      </header>
      <div class="home-actions">
        <button class="btn ghost" id="btn-restart" type="button">${t('startNew')}</button>
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
    el.textContent = `${t('yourSpeed')}: —`;
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
    ? `${t('yourSpeed')}: ${v.toFixed(2)} u/s · ${t('closest')} ${nearest.label} (${nearest.targetSp.toFixed(2)})`
    : `${t('yourSpeed')}: ${v.toFixed(2)} u/s`;
}

function updateHud() {
  const hint = document.getElementById('foot-hint');
  if (!hint) return;
  updateUserSpeedHud();

  if (state.selectedId) {
    const tgt = state.targets.find((x) => x.id === state.selectedId);
    hint.textContent = t('matchedCorrect', { label: tgt?.label ?? '' });
  } else if (state.lastMessage) {
    hint.textContent = state.lastMessage;
  } else if (state.drawing) {
    hint.textContent = t('drawing');
  } else {
    hint.textContent = speedEnabled()
      ? t('hintIdleSpeed', { label: state.intendedTarget?.label || '?' })
      : t('hintIdlePath', { label: state.intendedTarget?.label || '?' });
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
  ctx.fillText(t('drawBelow'), w / 2, layout.drawTop + 16);

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
