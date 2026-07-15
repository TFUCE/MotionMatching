/** Lightweight click feedback via Web Audio API. */

let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

export function playClick(kind = 'tap') {
  try {
    const ac = getCtx();
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    if (kind === 'success') {
      osc.frequency.setValueAtTime(660, t0);
      osc.frequency.exponentialRampToValueAtTime(990, t0 + 0.08);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    } else if (kind === 'miss') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.start(t0);
      osc.stop(t0 + 0.15);
    } else {
      // Soft click feedback for each tap
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      osc.start(t0);
      osc.stop(t0 + 0.06);
    }
  } catch {
    // Audio may be blocked until user gesture; ignore.
  }
}

export function unlockAudio() {
  try {
    getCtx();
  } catch {
    /* noop */
  }
}
