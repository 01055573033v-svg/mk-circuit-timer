/** Pure wall-clock engine. Timestamps are milliseconds from an injected clock.
 * elapsedMs counts active time only; progress includes skipped durations.
 * Callers supply finite, nondecreasing timestamps (for example Date.now()). */
export function createEngine(segments, now) {
  const timeline = segments.map(segment => ({ ...segment }));
  const total = timeline.reduce((sum, segment) => sum + segment.seconds * 1000, 0);
  let state = 'idle';
  let index = 0;
  let segmentStart = 0;
  let pausedAt = 0;
  let pausedMs = 0;
  let completedMs = 0;
  let skippedMs = 0;

  function advance(time) {
    if (state !== 'running') return;
    while (index < timeline.length) {
      const duration = timeline[index].seconds * 1000;
      if (time - segmentStart - pausedMs < duration) break;
      segmentStart += duration + pausedMs;
      pausedMs = 0;
      completedMs += duration;
      index++;
    }
    if (index === timeline.length) state = 'done';
  }

  function snapshot(time = now()) {
    advance(time);
    const segment = timeline[index] ?? null;
    const spent = state === 'idle' || !segment ? 0
      : Math.max(0, (state === 'paused' ? pausedAt : time) - segmentStart - pausedMs);
    const segmentRemainingMs = segment ? segment.seconds * 1000 - spent : 0;
    const consumed = completedMs + spent;
    return {
      state, index, segment: segment ? { ...segment } : null,
      segmentRemainingMs, totalRemainingMs: total - consumed,
      elapsedMs: consumed - skippedMs,
      progress: total ? consumed / total : 1,
    };
  }

  return {
    snapshot,
    start(time = now()) {
      if (state === 'idle') { state = 'running'; segmentStart = time; }
      return snapshot(time);
    },
    pause(time = now()) {
      advance(time);
      if (state === 'running') { pausedAt = time; state = 'paused'; }
      return snapshot(time);
    },
    resume(time = now()) {
      if (state === 'paused') { pausedMs += time - pausedAt; state = 'running'; }
      return snapshot(time);
    },
    skip(time = now()) {
      advance(time);
      if (state === 'running' || state === 'paused') {
        const remaining = snapshot(time).segmentRemainingMs;
        skippedMs += remaining;
        completedMs += timeline[index].seconds * 1000;
        index++;
        segmentStart = time;
        pausedMs = 0;
        pausedAt = time;
        if (index === timeline.length) state = 'done';
      }
      return snapshot(time);
    },
  };
}
