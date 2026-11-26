/** Pure cue decisions between two engine snapshots (no audio, no DOM).
 * 'go'    : a work segment just began (higher tone, long vibration)
 * 'rest'  : a rest, prep or cooldown segment just began (lower tone)
 * 'count' : 3, 2, 1 seconds left in the current segment (short tick)
 * 'done'  : the whole run finished
 * Only the latest boundary is cued, so a phone waking from sleep does not replay missed beeps. */
export const COUNT_FROM = 3;

export function cueBetween(previous, current) {
  if (!previous || !current) return null;
  if (current.state === 'done') return previous.state === 'done' ? null : 'done';
  if (current.state !== 'running') return null;
  if (previous.state === 'idle' || current.index !== previous.index) {
    return current.segment.kind === 'work' ? 'go' : 'rest';
  }
  const before = Math.ceil(previous.segmentRemainingMs / 1000);
  const now = Math.ceil(current.segmentRemainingMs / 1000);
  if (now < before && now >= 1 && now <= COUNT_FROM && current.segment.seconds > COUNT_FROM) return 'count';
  return null;
}

/** Choices offered on the timer screen today: middle school 2 sets, high school 3 sets. */
export const SET_CHOICES = Object.freeze([
  Object.freeze({ sets: 2, label: '중등 2세트' }),
  Object.freeze({ sets: 3, label: '고등 3세트' }),
]);
