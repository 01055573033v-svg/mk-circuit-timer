import { validatePreset, BUILTIN_PRESETS } from './presets.js';

/** Device-local presets (localStorage). Pure apart from the injected storage object. */
export const STORAGE_KEY = 'mk-circuit-timer.presets.v1';
export const SELECTED_KEY = 'mk-circuit-timer.selected.v1';
export const MAX_SAVED = 20;

/** The seven rows of the editor, in the coach's order. Laps stay 1 (each round = one pass of the stations); lap rest equals rest.
 * Time rows accept seconds ("90") or minutes:seconds ("1:30"). */
export const EDIT_FIELDS = Object.freeze([
  Object.freeze({ key: 'prep', label: '준비', kind: 'time', color: 'prep', min: 0, max: 3600 }),
  Object.freeze({ key: 'work', label: '운동', kind: 'time', color: 'work', min: 1, max: 3600 }),
  Object.freeze({ key: 'rest', label: '휴식', kind: 'time', color: 'rest', min: 0, max: 3600 }),
  Object.freeze({ key: 'stations', label: '라운드', hint: '종목 수', kind: 'count', color: 'round', min: 1, max: 99 }),
  Object.freeze({ key: 'sets', label: '사이클', hint: '세트 수', kind: 'count', color: 'cycle', min: 1, max: 99 }),
  Object.freeze({ key: 'setRest', label: '사이클 사이 휴식', kind: 'time', color: 'setrest', min: 0, max: 3600 }),
  Object.freeze({ key: 'cooldown', label: '쿨 다운', kind: 'time', color: 'cooldown', min: 0, max: 3600 }),
]);

/** "90" → 90, "1:30" or "1.30" → 90 (phone number pads have a dot, not a colon). Returns NaN for anything else. */
export function parseTime(text) {
  const value = String(text ?? '').trim();
  if (/^\d{1,4}$/.test(value)) return Number(value);
  const match = /^(\d{1,2})[:.]([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
}
export function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export const NEW_PRESET = Object.freeze({
  name: '40/20 서킷', stations: 7, laps: 1, sets: 3,
  work: 40, rest: 20, lapRest: 20, setRest: 60, prep: 10, cooldown: 0,
});

export const BUILTINS = Object.freeze([
  Object.freeze({ id: 'builtin-4020', builtin: true, ...NEW_PRESET, name: '40/20 · 7종목 × 3세트' }),
  Object.freeze({ id: 'builtin-winter-2', builtin: true, ...BUILTIN_PRESETS[1], name: '동계 30/15 · 7종목 × 2바퀴 × 2세트(중등)' }),
  Object.freeze({ id: 'builtin-winter-3', builtin: true, ...BUILTIN_PRESETS[1], sets: 3, name: '동계 30/15 · 7종목 × 2바퀴 × 3세트(고등)' }),
]);

/** Build a preset from form values (strings or numbers). Throws with a Korean message when invalid. */
export function presetFromForm(values, id) {
  const name = String(values.name ?? '').trim();
  const preset = { name, laps: 1 };
  for (const { key, label, hint, kind, min, max } of EDIT_FIELDS) {
    const text = String(values[key] ?? '').trim();
    const number = kind === 'time' ? parseTime(text) : (/^\d{1,3}$/.test(text) ? Number(text) : NaN);
    if (!Number.isInteger(number) || number < min || number > max) {
      const range = kind === 'time' ? `${formatTime(min)}~${formatTime(max)}(초 또는 분:초)` : `${min}~${max}`;
      throw new RangeError(`${label}${hint ? `(${hint})` : ''}: ${range} 사이로 적어 주세요.`);
    }
    preset[key] = number;
  }
  preset.lapRest = preset.rest;
  if (!name) throw new TypeError('이름을 적어 주세요.');
  validatePreset(preset);
  return { id, ...preset };
}

function clean(item) {
  if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.startsWith('user-')) return null;
  try {
    const { id, name, stations, laps, sets, work, rest, lapRest, setRest, prep, cooldown } = item;
    const preset = { name, stations, laps, sets, work, rest, lapRest, setRest, prep, cooldown };
    validatePreset(preset);
    return { id, ...preset };
  } catch { return null; }
}

export function loadSaved(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.map(clean).filter(Boolean).slice(0, MAX_SAVED) : [];
  } catch { return []; }
}

/** Returns true when the write reached storage (private mode or a full disk can refuse it). */
export function writeSaved(storage, list) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED))); return true; } catch { return false; }
}

export function upsert(list, preset) {
  const index = list.findIndex(item => item.id === preset.id);
  if (index >= 0) return list.map((item, i) => (i === index ? preset : item));
  if (list.length >= MAX_SAVED) throw new RangeError(`저장은 ${MAX_SAVED}개까지입니다. 쓰지 않는 프리셋을 지워 주세요.`);
  return [...list, preset];
}

export function remove(list, id) { return list.filter(item => item.id !== id); }

export function allPresets(saved) { return [...BUILTINS, ...saved]; }

export function newId(now = Date.now(), random = Math.random) {
  return `user-${now.toString(36)}-${Math.floor(random() * 1e6).toString(36)}`;
}

export function loadSelected(storage, list) {
  let id = null;
  try { id = storage.getItem(SELECTED_KEY); } catch { /* unavailable */ }
  return list.find(item => item.id === id) ?? list[0];
}
export function saveSelected(storage, id) { try { storage.setItem(SELECTED_KEY, id); } catch { /* unavailable */ } }
