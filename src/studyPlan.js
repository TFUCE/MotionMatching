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

/** Decouple path and speed: each path gets all 3 speeds in a rotated order. */
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

function assignFormalPaths(index) {
  return [0, 1, 2].map((k) => EVAL_PATH_IDS[(index + k) % EVAL_PATH_IDS.length]);
}

function buildPractice() {
  return [
    makeTaskDef({
      taskNumber: 1,
      speedEnabled: false,
      pathId: 'diagonal',
      speed: SPEED_PERIODS[1],
      practice: true,
    }),
    makeTaskDef({
      taskNumber: 2,
      speedEnabled: false,
      pathId: 'circle',
      speed: SPEED_PERIODS[0],
      practice: true,
    }),
  ];
}

function buildPart1(pathIds) {
  return pathIds.map((pathId, i) =>
    makeTaskDef({
      taskNumber: i + 1,
      speedEnabled: false,
      pathId,
      speed: SPEED_PERIODS[i % SPEED_PERIODS.length],
    }),
  );
}

/** Same 3 paths, each at all 3 speeds — path and speed fully crossed. */
function buildPart2(pathIds, index) {
  const tasks = [];
  let taskNumber = 1;
  pathIds.forEach((pathId, pathIdx) => {
    const perm = SPEED_PERMUTATIONS[(index + pathIdx) % SPEED_PERMUTATIONS.length];
    perm.forEach((speedIdx) => {
      tasks.push(
        makeTaskDef({
          taskNumber: taskNumber++,
          speedEnabled: true,
          pathId,
          speed: SPEED_PERIODS[speedIdx],
        }),
      );
    });
  });
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
