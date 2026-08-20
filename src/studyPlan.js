import { PATH_LIBRARY, SPEED_PERIODS } from './paths.js';

const PATH_CHARS = {
  L_down_right: 'Two segments, one direction change, straight, open',
  L_right_down: 'Two segments, one direction change, straight, open',
  circle: 'Continuous curve, no direction change, curved, closed',
  diagonal: 'Single segment, no direction change, straight, open',
  zigzag: 'Four segments, three direction changes, straight, open',
  U_shape: 'Curved bottom, two direction changes, mixed, open',
};

export const EVAL_PATH_IDS = Object.keys(PATH_LIBRARY);
export const MEDIUM_SPEED = SPEED_PERIODS[1];

/** Rotate Fast/Med/Slow order so path and speed stay independent. */
const SPEED_PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

export function participantIndex(code) {
  const m = String(code).match(/(\d+)/);
  if (m) return (parseInt(m[1], 10) - 1 + 1300) % 13;
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return Math.abs(h) % 13;
}

export function makeTaskDef({ taskNumber, speedEnabled, pathId, speed, practice = false }) {
  const prefix = practice ? 'practice' : speedEnabled ? 'path_speed' : 'path_only';
  return {
    taskNumber,
    speedEnabled,
    practice,
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

/** Everyone gets all 6 paths; start index rotates by participant. */
function assignFormalPaths(index) {
  const n = EVAL_PATH_IDS.length;
  return Array.from({ length: n }, (_, k) => EVAL_PATH_IDS[(index + k) % n]);
}

function buildPractice() {
  return [
    makeTaskDef({
      taskNumber: 1,
      speedEnabled: false,
      pathId: 'diagonal',
      speed: MEDIUM_SPEED,
      practice: true,
    }),
    makeTaskDef({
      taskNumber: 2,
      speedEnabled: false,
      pathId: 'circle',
      speed: MEDIUM_SPEED,
      practice: true,
    }),
  ];
}

/** Path-only: all paths shown at Medium so speed does not confound shape. */
function buildPart1(pathIds) {
  return pathIds.map((pathId, i) =>
    makeTaskDef({
      taskNumber: i + 1,
      speedEnabled: false,
      pathId,
      speed: MEDIUM_SPEED,
    }),
  );
}

/**
 * Full factorial, interleaved: 3 rounds × all 6 paths.
 * Same path is never consecutive, so speed is not mixed with path learning.
 */
function buildPart2(pathIds, index) {
  const n = pathIds.length;
  const tasks = [];
  let taskNumber = 1;
  for (let round = 0; round < SPEED_PERIODS.length; round++) {
    for (let i = 0; i < n; i++) {
      const pathIdx = (i + round) % n;
      const pathId = pathIds[pathIdx];
      const perm = SPEED_PERMUTATIONS[(index + pathIdx) % SPEED_PERMUTATIONS.length];
      tasks.push(
        makeTaskDef({
          taskNumber: taskNumber++,
          speedEnabled: true,
          pathId,
          speed: SPEED_PERIODS[perm[round]],
        }),
      );
    }
  }
  return tasks;
}

export function buildStudyPlan(participantCode) {
  const index = participantIndex(participantCode);
  const pathIds = assignFormalPaths(index);
  return {
    practice: buildPractice(),
    part1: buildPart1(pathIds),
    part2: buildPart2(pathIds, index),
  };
}
