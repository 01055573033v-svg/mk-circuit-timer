/** Seconds are integers. Optional durations may be zero; work must be positive. */
export const LIMITS = Object.freeze({
  stations: [1, 99], laps: [1, 99], sets: [1, 99],
  work: [1, 3600], rest: [0, 3600], lapRest: [0, 3600],
  setRest: [0, 3600], prep: [0, 3600], cooldown: [0, 3600],
});
for (const range of Object.values(LIMITS)) Object.freeze(range);

export function validatePreset(preset) {
  if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
    throw new TypeError('프리셋 객체가 필요합니다.');
  }
  if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80) {
    throw new TypeError('이름은 공백이 아닌 1~80자여야 합니다.');
  }
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const value = preset[field];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`${field}: ${min}~${max} 범위의 정수가 필요합니다.`);
    }
  }
  return true;
}

export const DEFAULT_PRESET = Object.freeze({
  name: '새 타이머', stations: 7, laps: 2, sets: 2,
  work: 30, rest: 15, lapRest: 30, setRest: 60, prep: 5, cooldown: 60,
});
export const BUILTIN_PRESETS = Object.freeze([
  Object.freeze({ ...DEFAULT_PRESET, name: '타바타 20/10 × 8',
    stations: 8, laps: 1, sets: 1, work: 20, rest: 10 }),
  Object.freeze({ ...DEFAULT_PRESET, name: '동계 서킷 30/15 · 7종목 × 2바퀴 × 2세트' }),
]);
