/** UI strings (English only) */

const STRINGS = {
  brand: 'Motion Match',
  homeTitle: 'Evaluation Study',
  homeLede:
    'Practice, then two formal parts: all 6 path shapes, then each path at Fast, Med, and Slow. 24 formal tasks in total.',
  participantCode: 'Participant code',
  participantPlaceholder: 'e.g. P01',
  testingFormat: 'Testing format',
  formatOnline: 'Online (remote)',
  formatInPerson: 'In person',
  beginStudy: 'Begin study',
  touchRequired: 'Please complete this study using a touchscreen device (finger input).',

  howItWorks: 'How it works',
  instr1: 'You will see 3 targets (A, B, C). One is highlighted — match that one.',
  instr2: 'Practice ({n} tasks): get familiar with drawing. Practice data is not scored.',
  instr3: 'Part 1 ({n} tasks): match all 6 path shapes. Speed does not matter; all targets move at Medium.',
  instr4: 'Part 2 ({n} tasks): the same 6 paths, each at Fast, Med, and Slow.',
  startPractice: 'Start practice',

  part1Title: 'Part 1 · Path only',
  part1Lede: 'Match all 6 path shapes. Speed does not matter; all targets move at Medium. {n} tasks.',
  startPart1: 'Start Part 1',

  part2Title: 'Part 2 · Path + speed',
  part2Lede: 'Same 6 paths as Part 1 — now match both shape and speed (Fast, Med, Slow). {n} tasks.',
  startPart2: 'Start Part 2',

  exit: 'Exit',
  clear: 'Clear',
  practice: 'Practice',
  part1: 'Part 1',
  part2: 'Part 2',
  matchPathOnly: 'path only',
  matchTarget: 'Match',
  drawBelow: 'draw anywhere below',
  hintPathOnly: 'Draw the highlighted path shape · speed does not matter',
  hintPathSpeed: 'Draw the highlighted path at the same speed',
  yourSpeed: 'Your speed',
  closest: 'closest',
  strokeTooShort: 'Stroke too short · try again',
  noMatch: 'No match · try again',
  wrongTarget: 'Matched {got} but target is {want} · try again',
  matchedCorrect: 'Matched {label} · correct!',
  drawing: 'Drawing… release to match',
  hintIdlePath: 'Match target {label} · path shape only',
  hintIdleSpeed: 'Match target {label} · path & speed',
  exitConfirm: 'Exit the study? Progress on this task will be lost.',
  maxAttempts: 'Maximum attempts reached · moving on',

  taskComplete: 'Task complete',
  taskFailed: 'Task not completed',
  practiceComplete: 'Practice complete',
  part1Complete: 'Part 1 complete',
  part2Complete: 'Part 2 complete',
  partCompleteLede: '{phase} · all {n} tasks completed',
  target: 'Target',
  pathOnlyTag: '(path only)',
  score: 'Score',
  attempts: 'Attempts',
  errors: 'Errors',
  time: 'Time',
  nextTask: 'Next task',
  continuePart1: 'Continue to Part 1',
  continuePart2: 'Continue to Part 2',
  finishStudy: 'Finish study',

  questionnaireTitle: 'Questionnaire',
  questionnaireLede:
    'Please rate each statement from 1 (strongly disagree) to 7 (strongly agree).',
  openTitle: 'Open questions',
  openOptional: '(optional)',
  submitQuestionnaire: 'Submit',
  submitting: 'Submitting…',
  requiredRatings: 'Please answer all rating questions.',

  q_understood: 'I understood how to use the motion-matching interaction.',
  q_easyFollow: 'The displayed movements were easy to follow.',
  q_easyPath: 'It was easy to reproduce the path shapes.',
  q_easySpeed: 'It was easy to match the movement speed.',
  q_feedback: 'The system feedback was clear.',
  q_natural: 'The interaction felt natural.',
  q_comfortable: 'The interaction was physically comfortable.',
  q_confident: 'I became more confident after completing several tasks.',
  q_wouldUse: 'I would consider using this interaction technique on a smartphone.',

  o_firstImpression: 'What was your first impression of the motion-matching interaction?',
  o_easiestSpeed: 'Which speed was easiest to follow, and why?',
  o_hardestSpeed: 'Which speed was most difficult to follow, and why?',
  o_easiestPath: 'Which path was easiest to reproduce, and why?',
  o_hardestPath: 'Which path was most difficult to reproduce, and why?',
  o_uncomfortable: 'Did any movement feel uncomfortable or unnatural? If so, which one?',
  o_feedbackClarity:
    'When you succeeded or made an error, was the feedback clear enough? Why or why not?',
  o_usefulSituation: 'In what situation would this interaction be useful?',
  o_mainProblem: 'What was the main problem you experienced?',
  o_improve: 'What would you change or improve?',

  thankYou: 'Thank you!',
  evalComplete: 'Evaluation complete',
  evalCompleteLede: 'You finished practice and {n} formal tasks. Your responses have been saved.',
  startNew: 'Start new session',
  scaleDisagree: '1',
  scaleAgree: '7',
  scaleHint: '1 = strongly disagree · 7 = strongly agree',
};

export const LIKERT_KEYS = [
  'q_understood',
  'q_easyFollow',
  'q_easyPath',
  'q_easySpeed',
  'q_feedback',
  'q_natural',
  'q_comfortable',
  'q_confident',
  'q_wouldUse',
];

export const OPEN_KEYS = [
  'o_firstImpression',
  'o_easiestSpeed',
  'o_hardestSpeed',
  'o_easiestPath',
  'o_hardestPath',
  'o_uncomfortable',
  'o_feedbackClarity',
  'o_usefulSituation',
  'o_mainProblem',
  'o_improve',
];

export function t(key, vars = {}) {
  let s = STRINGS[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}
