import { BUILTIN_PRESETS } from './presets.js';
import { generateSegments, calculateTotalSeconds } from './segments.js';
import { createEngine } from './engine.js';
import { cueBetween, SET_CHOICES } from './cues.js';
import { unlockAudio, playCue, keepScreenOn, wakeLockSupported, screenLockHeld } from './device.js';

const base = BUILTIN_PRESETS[1];
const clock = () => Date.now();
let preset = base;
let engine = createEngine(generateSegments(preset), clock);
let last = engine.snapshot();
const labels = { prep: '준비', work: '운동', rest: '종목 사이 휴식', lapRest: '바퀴 사이 휴식', setRest: '세트 사이 휴식', cooldown: '쿨다운' };
const find = id => document.getElementById(id);
const format = ms => {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

function choose(sets) {
  if (engine.snapshot().state !== 'idle') return;
  preset = { ...base, sets, name: `동계 서킷 30/15 · 7종목 × 2바퀴 × ${sets}세트` };
  reset();
}
function reset() {
  engine = createEngine(generateSegments(preset), clock);
  last = engine.snapshot();
  keepScreenOn(false);
  render();
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
  const segment = s.segment;
  const done = s.state === 'done';
  find('timer-active').hidden = done;
  find('timer-result').hidden = !done;
  for (const choice of SET_CHOICES) {
    const button = find(`sets-${choice.sets}`);
    button.disabled = s.state !== 'idle';
    button.setAttribute('aria-pressed', String(preset.sets === choice.sets));
  }
  find('preset-name').textContent = `동계 서킷 · 7종목 × 2바퀴 × ${preset.sets}세트 · 총 ${format(calculateTotalSeconds(preset) * 1000)}`;
  describeDevice();
  if (done) { find('result-time').textContent = format(s.elapsedMs); keepScreenOn(false); return; }
  const { kind, stationIndex, lapIndex, setIndex } = segment;
  let laps = lapIndex ? preset.laps - lapIndex + 1 : preset.laps;
  let sets = setIndex ? preset.sets - setIndex + 1 : preset.sets;
  if (kind === 'lapRest') laps--;
  if (kind === 'setRest') sets--;
  if (kind === 'cooldown') laps = sets = 0;
  find('laps-left').textContent = laps;
  find('sets-left').textContent = sets;
  find('station').textContent = `${stationIndex ?? '—'}/${preset.stations}`;
  find('phase').className = `phase ${kind.endsWith('Rest') ? 'rest' : kind}`;
  find('phase-label').textContent = `${labels[kind]}${s.state === 'paused' ? ' · 일시정지' : ''}`;
  find('segment-time').textContent = format(s.segmentRemainingMs);
  find('total-time').textContent = format(s.totalRemainingMs);
  find('timer-progress').value = s.progress;
  find('start').disabled = s.state !== 'idle';
  find('pause').disabled = s.state === 'idle';
  find('pause').textContent = s.state === 'paused' ? '재개' : '일시정지';
  find('skip').disabled = s.state === 'idle';
  find('reset').disabled = s.state === 'idle';
}

function confirmReset() {
  const button = find('reset');
  if (button.dataset.armed === '1') { delete button.dataset.armed; button.textContent = '처음으로'; return true; }
  button.dataset.armed = '1'; button.textContent = '한 번 더 누르면 처음으로';
  setTimeout(() => { if (button.dataset.armed) { delete button.dataset.armed; button.textContent = '처음으로'; } }, 3000);
  return false;
}

for (const choice of SET_CHOICES) find(`sets-${choice.sets}`).addEventListener('click', () => choose(choice.sets));
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
setInterval(render, 200);
document.addEventListener('visibilitychange', render);
render();
