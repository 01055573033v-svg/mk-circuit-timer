import { generateSegments, calculateTotalSeconds } from './segments.js';
import { createEngine } from './engine.js';
import { cueBetween, nextPreview } from './cues.js';
import { unlockAudio, playCue, keepScreenOn, wakeLockSupported, screenLockHeld } from './device.js';
import { EDIT_FIELDS, NEW_PRESET, allPresets, loadSaved, writeSaved, upsert, remove, presetFromForm, newId, loadSelected, saveSelected } from './store.js';

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const memory = new Map();
const store = storage ?? { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
let saved = loadSaved(store);
let preset = loadSelected(store, allPresets(saved));
const clock = () => Date.now();
let segments = generateSegments(preset);
let engine = createEngine(segments, clock);
let last = engine.snapshot();
let editingId = null;
const labels = { prep: '준비', work: '운동', rest: '휴식', lapRest: '바퀴 사이 휴식', setRest: '세트 사이 휴식', cooldown: '쿨다운' };
const find = id => document.getElementById(id);
const format = ms => {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const summary = p => `운동 ${p.work}초 · 휴식 ${p.rest}초 · ${p.stations}종목${p.laps > 1 ? ` × ${p.laps}바퀴` : ''} × ${p.sets}세트 · 세트 간 ${p.setRest}초 · 준비 ${p.prep}초 · 총 ${format(calculateTotalSeconds(p) * 1000)}`;

/* ---------- timer ---------- */
function select(id) {
  if (engine.snapshot().state !== 'idle') return;
  preset = allPresets(saved).find(item => item.id === id) ?? allPresets(saved)[0];
  saveSelected(store, preset.id);
  reset();
}
function reset() {
  segments = generateSegments(preset);
  engine = createEngine(segments, clock);
  last = engine.snapshot();
  keepScreenOn(false);
  fillPicker();
  render();
}
function fillPicker() {
  const picker = find('preset-picker');
  picker.replaceChildren(...allPresets(saved).map(item => new Option(item.name, item.id, false, item.id === preset.id)));
  find('preset-name').textContent = summary(preset);
}
function describeDevice() {
  const screen = !wakeLockSupported() ? '화면 꺼짐 방지 미지원 · 폰 자동 잠금을 꺼 주세요'
    : screenLockHeld() ? '화면 꺼짐 방지 켜짐' : '시작하면 화면 꺼짐 방지가 켜집니다';
  find('device-status').textContent = `${screen} · 아이폰은 무음 스위치를 끄고 소리를 키워 주세요`;
}
function render() {
  const s = engine.snapshot();
  playCue(cueBetween(last, s));
  last = s;
  const done = s.state === 'done';
  find('timer-active').hidden = done;
  find('timer-result').hidden = !done;
  find('preset-picker').disabled = s.state !== 'idle';
  describeDevice();
  if (done) { find('result-time').textContent = format(s.elapsedMs); keepScreenOn(false); return; }
  const { kind, stationIndex, lapIndex, setIndex } = s.segment;
  let laps = lapIndex ? preset.laps - lapIndex + 1 : preset.laps;
  let sets = setIndex ? preset.sets - setIndex + 1 : preset.sets;
  if (kind === 'lapRest') laps--;
  if (kind === 'setRest') sets--;
  if (kind === 'cooldown') laps = sets = 0;
  find('laps-box').hidden = preset.laps < 2;
  find('laps-left').textContent = laps;
  find('sets-left').textContent = sets;
  find('station').textContent = `${stationIndex ?? '—'}/${preset.stations}`;
  find('phase').className = `phase ${kind.endsWith('Rest') || kind === 'rest' ? 'rest' : kind}`;
  find('phase-label').textContent = `${labels[kind]}${s.state === 'paused' ? ' · 일시정지' : ''}`;
  find('segment-time').textContent = format(s.segmentRemainingMs);
  find('total-time').textContent = format(s.totalRemainingMs);
  find('timer-progress').value = s.progress;
  const idle = s.state === 'idle';
  find('start').hidden = !idle;
  for (const id of ['pause', 'skip', 'reset']) find(id).hidden = idle;
  find('pause').textContent = s.state === 'paused' ? '재개' : '일시정지';
  const next = nextPreview(segments, s.index);
  const band = find('next-band');
  band.textContent = next.text;
  band.className = `next-band ${next.kind === 'work' || next.kind === 'prep' || next.kind === 'cooldown' ? next.kind : next.kind === 'end' ? 'end' : 'rest'}`;
}
function confirmReset() {
  const button = find('reset');
  if (button.dataset.armed === '1') { delete button.dataset.armed; button.textContent = '초기화'; return true; }
  button.dataset.armed = '1'; button.textContent = '한 번 더';
  setTimeout(() => { if (button.dataset.armed) { delete button.dataset.armed; button.textContent = '초기화'; } }, 3000);
  return false;
}

/* ---------- presets ---------- */
function renderList() {
  const list = find('preset-list');
  list.replaceChildren(...allPresets(saved).map(item => {
    const li = document.createElement('li');
    const title = document.createElement('p'); title.className = 'preset-title'; title.textContent = item.name;
    const detail = document.createElement('p'); detail.className = 'note'; detail.textContent = summary(item);
    const actions = document.createElement('div'); actions.className = 'controls';
    const use = document.createElement('button'); use.type = 'button'; use.textContent = '이걸로 타이머';
    use.addEventListener('click', () => { select(item.id); location.hash = '#timer'; });
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = item.builtin ? '복사해서 수정' : '수정';
    edit.addEventListener('click', () => openForm(item, item.builtin ? null : item.id));
    actions.append(use, edit);
    if (!item.builtin) {
      const del = document.createElement('button'); del.type = 'button'; del.textContent = '삭제';
      del.addEventListener('click', () => {
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '한 번 더 누르면 삭제'; return; }
        saved = remove(saved, item.id);
        if (!writeSaved(store, saved)) showMessage('이 기기에 저장하지 못했습니다(사생활 보호 모드 등). 새로 고치면 사라집니다.');
        if (preset.id === item.id && engine.snapshot().state === 'idle') select(allPresets(saved)[0].id);
        renderList(); fillPicker();
      });
      actions.append(del);
    }
    li.append(title, detail, actions);
    return li;
  }));
}
function openForm(source, id) {
  editingId = id;
  const form = find('preset-form');
  form.hidden = false;
  form.elements.name.value = id || source === NEW_PRESET ? source.name : `${source.name} 복사`.slice(0, 80);
  for (const { key } of EDIT_FIELDS) form.elements[key].value = source[key];
  find('form-title').textContent = id ? '프리셋 수정' : '새 프리셋';
  showMessage('');
  updatePreview();
  form.scrollIntoView({ block: 'start' });
}
function formValues() {
  const form = find('preset-form');
  return Object.fromEntries(['name', ...EDIT_FIELDS.map(f => f.key)].map(key => [key, form.elements[key].value]));
}
function updatePreview() {
  try { find('form-preview').textContent = summary(presetFromForm(formValues(), 'preview')); }
  catch (error) { find('form-preview').textContent = error.message; }
}
function showMessage(text) { find('form-message').textContent = text; }
function buildForm() {
  const box = find('form-fields');
  box.replaceChildren(...EDIT_FIELDS.map(({ key, label, min, max }) => {
    const wrap = document.createElement('label');
    wrap.append(label);
    const input = document.createElement('input');
    Object.assign(input, { name: key, type: 'number', inputMode: 'numeric', min, max, step: 1, required: true });
    wrap.append(input);
    return wrap;
  }));
  const form = find('preset-form');
  form.addEventListener('input', updatePreview);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const next = presetFromForm(formValues(), editingId ?? newId());
      saved = upsert(saved, next);
      const ok = writeSaved(store, saved);
      editingId = next.id;
      renderList();
      if (engine.snapshot().state === 'idle') select(next.id); else fillPicker();
      showMessage(ok ? `저장했습니다. 타이머에서 「${next.name}」이 선택돼 있습니다.` : '이 기기에 저장하지 못했습니다(사생활 보호 모드 등). 지금 화면에서는 쓸 수 있지만 새로 고치면 사라집니다.');
    } catch (error) { showMessage(error.message); }
  });
  find('form-close').addEventListener('click', () => { form.hidden = true; editingId = null; });
  find('new-preset').addEventListener('click', () => openForm(NEW_PRESET, null));
}

/* ---------- wiring ---------- */
find('preset-picker').addEventListener('change', event => select(event.target.value));
find('start').addEventListener('click', () => { unlockAudio(); keepScreenOn(true).then(describeDevice); engine.start(); render(); });
find('pause').addEventListener('click', () => {
  const time = clock();
  unlockAudio();
  if (engine.snapshot(time).state === 'paused') { engine.resume(time); keepScreenOn(true).then(describeDevice); } else engine.pause(time);
  render();
});
find('skip').addEventListener('click', () => { engine.skip(); render(); });
find('reset').addEventListener('click', () => { if (confirmReset()) reset(); });
find('again').addEventListener('click', reset);
buildForm();
renderList();
fillPicker();
setInterval(render, 200);
document.addEventListener('visibilitychange', render);
render();
