import { validatePreset } from './presets.js';

/** Pure expansion. Indices are one-based; inapplicable indices are null.
 * A rest belongs to the station/lap/set that just finished. */
export function generateSegments(preset) {
  validatePreset(preset);
  const segments = [];
  const add = (kind, seconds, setIndex = null, lapIndex = null, stationIndex = null) => {
    if (seconds > 0) segments.push({ kind, seconds, setIndex, lapIndex, stationIndex });
  };
  add('prep', preset.prep);
  for (let set = 1; set <= preset.sets; set++) {
    for (let lap = 1; lap <= preset.laps; lap++) {
      for (let station = 1; station <= preset.stations; station++) {
        add('work', preset.work, set, lap, station);
        if (station < preset.stations) add('rest', preset.rest, set, lap, station);
      }
      if (lap < preset.laps) add('lapRest', preset.lapRest, set, lap);
    }
    if (set < preset.sets) add('setRest', preset.setRest, set);
  }
  add('cooldown', preset.cooldown);
  return segments;
}

export function calculateTotalSeconds(preset) {
  validatePreset(preset);
  const { stations: n, laps: l, sets: s, work, rest, lapRest, setRest, prep, cooldown } = preset;
  return prep + s * l * (n * work + (n - 1) * rest)
    + s * (l - 1) * lapRest + (s - 1) * setRest + cooldown;
}
