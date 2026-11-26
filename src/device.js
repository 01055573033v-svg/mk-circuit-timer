/** Browser-only helpers: self-made beeps, vibration and screen wake lock.
 * Every feature is optional; unsupported devices simply stay silent or let the screen sleep. */
const TONES = {
  go: [{ hz: 1320, ms: 450 }],
  rest: [{ hz: 660, ms: 350 }],
  count: [{ hz: 880, ms: 120 }],
  done: [{ hz: 880, ms: 200 }, { hz: 1100, ms: 200 }, { hz: 1320, ms: 500 }],
};
const PULSES = { go: [400], rest: [200, 100, 200], count: [60], done: [300, 100, 300, 100, 600] };

let audio = null;

/** Must be called inside a tap (start / resume), as iOS Safari only unlocks audio from a user gesture. */
export function unlockAudio() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    audio ??= new Context();
    if (audio.state === 'suspended') audio.resume();
    const silent = audio.createBuffer(1, 1, 22050);
    const source = audio.createBufferSource();
    source.buffer = silent; source.connect(audio.destination); source.start(0);
    return true;
  } catch { return false; }
}

export function playCue(cue) {
  if (!cue) return;
  if (navigator.vibrate) { try { navigator.vibrate(PULSES[cue]); } catch { /* unsupported */ } }
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  let at = audio.currentTime + 0.01;
  for (const { hz, ms } of TONES[cue]) {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'square'; osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01);
    gain.gain.setValueAtTime(0.5, at + ms / 1000 - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
    osc.connect(gain).connect(audio.destination);
    osc.start(at); osc.stop(at + ms / 1000 + 0.02);
    at += ms / 1000 + 0.08;
  }
}

let lock = null;
let wanted = false;

export function wakeLockSupported() { return 'wakeLock' in navigator; }

/** Keep the screen on while wanted. Browsers drop the lock when the page is hidden, so it is retaken on return. */
export async function keepScreenOn(on) {
  wanted = on;
  if (!on) { const held = lock; lock = null; try { await held?.release(); } catch { /* already gone */ } return false; }
  if (!wakeLockSupported() || lock || document.visibilityState !== 'visible') return !!lock;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
    return true;
  } catch { lock = null; return false; }
}
document.addEventListener('visibilitychange', () => { if (wanted && document.visibilityState === 'visible') keepScreenOn(true); });
export function screenLockHeld() { return !!lock; }
