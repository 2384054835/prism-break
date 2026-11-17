// The screenshot scenes behind ?shot=start|play|clear|end. Each one is staged from a fresh,
// seeded world: start runs the title's attract mode, play simulates a real rally with a pilot
// who aims the paddle at the orb's landing point and then enriches the frozen moment (a falling
// power-up, a fresh shatter, a live combo), clear composes the level-clear celebration, and end
// plays with a pilot who never moves until the game is genuinely over. The same seed always
// stages the same frame.

import { FIELD, PADDLE, POWERUP, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4.5;
const PLAY_SECONDS = 11.5;
const END_LIMIT_SECONDS = 150;
const PADDLE_Y = FIELD.height - PADDLE.lift;

/** Where the orb will cross the paddle line, following its straight path and wall bounces. */
function landingX(ball) {
  if (ball.vy <= 0) return ball.x;
  const t = (PADDLE_Y - ball.y) / ball.vy;
  const raw = ball.x + ball.vx * t;
  const span = FIELD.width * 2;
  const wrapped = ((raw % span) + span) % span;
  return wrapped <= FIELD.width ? wrapped : span - wrapped;
}

/**
 * The play scene's pilot: it meets the lowest falling orb off-centre, aiming the return at the
 * nearest standing crystal — a centred paddle would drill one vertical tunnel and stall there,
 * while an aiming one keeps shattering new columns, as a player does.
 */
function pilotControl(state) {
  let ball = null;
  let lowest = -Infinity;
  for (const candidate of state.balls) {
    if (candidate.vy > 0 && candidate.y > lowest) {
      lowest = candidate.y;
      ball = candidate;
    }
  }
  if (!ball) ball = state.balls[0];
  if (!ball) return { dir: 0, pointerX: FIELD.width / 2 };
  const land = landingX(ball);
  let aimX = land;
  let bestDist = Infinity;
  for (const brick of state.bricks) {
    if (!brick.alive || brick.kind === 'solid') continue;
    const cx = brick.x + brick.w / 2;
    const dist = Math.abs(cx - land);
    if (dist < bestDist) {
      bestDist = dist;
      aimX = cx;
    }
  }
  const steer = Math.max(-40, Math.min(40, (aimX - land) * 0.4));
  return { dir: 0, pointerX: land - steer };
}

/** Run a scene's simulation, launching serves and draining sound cues as they come. */
function simulate(world, seconds, controlFor, demo) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (world.state.phase === 'serve' && !demo) world.launch();
    world.step(STEP, controlFor(world.state), demo);
    world.drainFx();
    if (world.state.phase === 'over' || world.state.phase === 'win') break;
  }
}

function stageStart(world) {
  world.reset();
  simulate(world, START_SECONDS, () => ({ dir: 0, pointerX: null }), true);
  return { screen: SCREEN_TITLE, best: 0 };
}

function stagePlay(world) {
  world.reset();
  world.startLevel(1); // Mint Garden: the green field photographs beautifully mid-rally.
  simulate(world, PLAY_SECONDS, pilotControl, false);
  const state = world.state;
  if (state.phase !== 'play' || state.balls.length === 0) {
    // The rally ended early (a rare pilot miss): fall back to a shorter, safer rally.
    world.reset();
    world.startLevel(1);
    simulate(world, PLAY_SECONDS * 0.55, pilotControl, false);
  }
  // Walk forward in small steps until the lead orb crosses the open middle of the field: the
  // frozen moment should read at a glance, not hide in a corner behind the HUD.
  for (let extra = 0; extra < 40; extra += 1) {
    const lead = state.balls[0];
    if (state.phase === 'play' && lead && lead.y > 150 && lead.y < 470 && lead.x > 130 && lead.x < 830) break;
    simulate(world, 0.25, pilotControl, false);
    if (state.phase !== 'play') break;
  }
  // Enrich the frozen moment, deterministically: a power-up on its way down near the orb, a
  // fresh shatter, one clean floater, and a combo worth showing in the HUD.
  state.floaters.length = 0;
  const ball = state.balls[0];
  if (state.powerups.length === 0 && ball) {
    const x = Math.max(200, Math.min(800, ball.x + 150));
    state.powerups.push({ x, y: 246, type: 'multi', vy: POWERUP.fallSpeed });
  }
  const brick = state.bricks.find((candidate) => candidate.alive && candidate.kind !== 'solid');
  if (brick) world.burst(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.hue, 24, 1.3);
  if (ball) world.floater(ball.x + 14, ball.y - 16, '+150', 152);
  state.combo = Math.max(state.combo, 11);
  simulate(world, 0.15, pilotControl, false);
  return { screen: SCREEN_PLAY, best: state.score };
}

function stageClear(world) {
  world.reset();
  const state = world.state;
  // A nearly-finished First Light: a scattered handful of crystals left standing.
  let kept = 0;
  for (const brick of state.bricks) {
    if (brick.kind === 'solid') continue;
    kept += 1;
    if (kept % 4 !== 0) brick.alive = false;
  }
  state.remaining = state.bricks.filter((brick) => brick.alive && brick.kind !== 'solid').length;
  state.score = 8640;
  state.combo = 13;
  state.bestCombo = 21;
  state.phase = 'clear';
  state.phaseTime = 0.65;
  const ball = state.balls[0];
  if (ball) {
    ball.x = 330;
    ball.y = 452;
    ball.vx = 150;
    ball.vy = 260; // drifting down and away, so the orb never sits on the banner text
  }
  world.burst(240, 170, 205, 22, 1.15);
  world.burst(480, 130, 152, 22, 1.15);
  world.burst(720, 180, 300, 22, 1.15);
  world.floater(480, 240, '+600', 262);
  simulate(world, 0.3, () => ({ dir: 0, pointerX: null }), true);
  state.phase = 'clear'; // the celebration holds for the camera
  state.phaseTime = 0.65;
  return { screen: SCREEN_PLAY, best: state.score };
}

function stageEnd(world) {
  world.reset();
  // A pilot who never moves: serves launch, rallies die on the left wall's indifference.
  simulate(world, END_LIMIT_SECONDS, () => ({ dir: 0, pointerX: 30 }), false);
  const state = world.state;
  if (state.phase !== 'over') {
    state.lives = 0;
    state.phase = 'over';
    state.phaseTime = 0;
  }
  if (state.score === 0) {
    state.score = 2310;
    state.bestCombo = 9;
  }
  return { screen: SCREEN_OVER, best: state.score };
}

/**
 * Set `world` to the named scene (start, play, clear or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'clear') return stageClear(world);
  if (name === 'end') return stageEnd(world);
  return stageStart(world);
}
