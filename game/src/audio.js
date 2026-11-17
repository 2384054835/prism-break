// All of Prism Break's sound is synthesized with WebAudio: no audio files, nothing fetched.
// Crystal bricks ring on a pentatonic ladder, so a long combo literally climbs the scale; the
// paddle answers with a soft wooden thock, walls tick, prisms burst in a shimmer of noise and
// falling notes. The context is created on the first user gesture, as browsers require, and
// every entry point is a no-op until then (and forever in a context with no audio at all).

import { MUTE_KEY } from './config.js';

/** Semitone steps of a major pentatonic ladder, three octaves of C D E G A. */
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33];
const BASE_FREQ = 523.25; // C5

function ladderFreq(index) {
  const step = LADDER[Math.max(0, Math.min(LADDER.length - 1, index))];
  return BASE_FREQ * Math.pow(2, step / 12);
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(value) {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be off: the choice then lasts this visit only.
  }
}

export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = readMuted();

  /** Create (or resume) the context. Called from the first pointer or key gesture. */
  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.42;
    // A gentle compressor at the end of the chain, so a long chain reaction stays glassy
    // instead of clipping when a dozen crystals ring in the same instant.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 6;
    master.connect(compressor).connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }

  /** One decaying tone; `glideTo` bends its pitch, `delay` starts it late. */
  function tone({ freq, delay = 0, dur = 0.4, type = 'sine', gain = 0.2, glideTo = null }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), start + dur);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /** A burst of filtered noise: the glassy part of a shatter, the click inside a thock. */
  function noise({ delay = 0, dur = 0.2, gain = 0.15, from = 6000, to = 1200, type = 'bandpass' }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + dur);
    const amp = context.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(filter).connect(amp).connect(master);
    source.start(start);
    source.stop(start + dur + 0.05);
  }

  /** A crystal strike: fundamental plus two inharmonic partials, the higher ones dying first. */
  function crystal(index, { delay = 0, gain = 0.22, dur = 0.55 } = {}) {
    const freq = ladderFreq(index);
    tone({ freq, delay, dur, gain });
    tone({ freq: freq * 2.99, delay, dur: dur * 0.38, gain: gain * 0.36 });
    tone({ freq: freq * 4.16, delay, dur: dur * 0.2, gain: gain * 0.14 });
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    /** Flip the mute and say which way it went. The choice is remembered between visits. */
    toggleMute() {
      muted = !muted;
      saveMuted(muted);
      if (master) master.gain.value = muted ? 0 : 0.42;
      return muted;
    },
    /** A brick broke: ring the ladder at the combo's height. */
    chime(combo) {
      crystal(combo % LADDER.length, { gain: 0.16 + Math.min(combo, 20) * 0.004 });
    },
    /** A tough brick was chipped, not broken: a harder, shorter ring. */
    chip() {
      tone({ freq: 1560, dur: 0.09, type: 'triangle', gain: 0.12 });
      noise({ dur: 0.05, gain: 0.05, from: 7000, to: 3000 });
    },
    /** A prism went up: noise shimmer, a falling cascade and a low bloom. */
    shatter() {
      noise({ dur: 0.34, gain: 0.2, from: 8200, to: 700 });
      crystal(11, { gain: 0.14, dur: 0.4 });
      crystal(8, { delay: 0.05, gain: 0.13, dur: 0.4 });
      crystal(5, { delay: 0.1, gain: 0.12, dur: 0.45 });
      tone({ freq: 196, dur: 0.3, gain: 0.1, glideTo: 98 });
    },
    /** The paddle met the orb. */
    thock() {
      tone({ freq: 175, dur: 0.09, type: 'triangle', gain: 0.22, glideTo: 92 });
      noise({ dur: 0.04, gain: 0.06, from: 2400, to: 900 });
    },
    /** The orb kissed a wall or the ceiling. */
    tick() {
      tone({ freq: 1320, dur: 0.035, type: 'square', gain: 0.045 });
    },
    /** The orb left the paddle on a serve. */
    launch() {
      tone({ freq: 587, dur: 0.14, gain: 0.12, glideTo: 988 });
    },
    /** A falling power-up was caught: three notes, up and bright. */
    powerup() {
      crystal(4, { gain: 0.15, dur: 0.3 });
      crystal(7, { delay: 0.06, gain: 0.15, dur: 0.3 });
      crystal(9, { delay: 0.12, gain: 0.16, dur: 0.42 });
    },
    /** The last orb fell: two notes down, unhurried. */
    lose() {
      crystal(6, { gain: 0.16, dur: 0.4 });
      crystal(3, { delay: 0.16, gain: 0.16, dur: 0.6 });
    },
    /** A level cleared: the ladder climbs home. */
    clear() {
      [0, 2, 4, 6, 8, 10].forEach((index, order) => {
        crystal(index + 2, { delay: order * 0.07, gain: 0.15, dur: 0.5 });
      });
      noise({ delay: 0.1, dur: 0.5, gain: 0.05, from: 5000, to: 8000, type: 'highpass' });
    },
    /** The game ended: a slow descent. */
    over() {
      [9, 7, 5, 3, 1].forEach((index, order) => {
        crystal(index, { delay: order * 0.17, gain: 0.14, dur: 0.55 });
      });
    },
    /** The crown broke: the whole ladder, then a chord to sit in. */
    win() {
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((index, order) => {
        crystal(index, { delay: order * 0.06, gain: 0.15, dur: 0.55 });
      });
      [2, 6, 9, 12].forEach((index) => crystal(index, { delay: 0.55, gain: 0.1, dur: 1.1 }));
    },
  };
}
