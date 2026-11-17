// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), sound cues the world queued are played, and the
// renderer paints what is there. The game moves between five screens: title (where the world
// demos itself), play, paused, game over and victory.
//
// ?seed=N fixes the random stream. ?shot=start|play|clear|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP, THEMES } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Play the sound cues the world queued, at most a handful a frame so a cascade stays musical. */
function playCues() {
  const cues = world.drainFx();
  let played = 0;
  for (const [name, value] of cues) {
    if (played >= 6) break;
    if (name === 'chime') audio.chime(value ?? 0);
    else if (name === 'chip') audio.chip();
    else if (name === 'shatter') audio.shatter();
    else if (name === 'thock') audio.thock();
    else if (name === 'tick') audio.tick();
    else if (name === 'power') audio.powerup();
    else if (name === 'launch') audio.launch();
    else if (name === 'lose') audio.lose();
    else if (name === 'clear') audio.clear();
    else if (name === 'over') audio.over();
    else if (name === 'win') audio.win();
    else continue;
    played += 1;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.multiplier(), audio.muted);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (clientX) => renderer.logicalX(clientX));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let announcedLives = LIVES;
  let announcedLevel = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each loss.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    announcedLives = LIVES;
    announcedLevel = 0;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Shatter every crystal.`);
  }

  function finishGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `You win. Score ${world.state.score}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.unlock();
      announce(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_PLAY && world.state.phase === 'serve') world.launch();
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dir: 0, pointerX: null }, true);
      world.drainFx();
      return;
    }
    const control = { dir: input.direction(), pointerX: input.pointer() };
    world.step(STEP, control, false);
    if (world.state.levelIndex !== announcedLevel) {
      announcedLevel = world.state.levelIndex;
      announce(`Level ${announcedLevel + 1}. ${THEMES[announcedLevel].name}.`);
    }
    if (world.state.lives !== announcedLives) {
      announcedLives = world.state.lives;
      if (announcedLives > 0) announce(announcedLives === 1 ? 'Orb lost. 1 life left.' : `Orb lost. ${announcedLives} lives left.`);
    }
    if (world.state.phase === 'over') finishGame(false);
    else if (world.state.phase === 'win') finishGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
      playCues();
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.multiplier(), audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting orbs fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Prism Break. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
