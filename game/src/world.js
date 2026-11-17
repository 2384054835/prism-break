// The world: Prism Break's whole simulation in one state object, advanced in fixed steps.
// It owns the paddle, the orbs, the brick field, falling power-ups, particles, floating score
// text, pending chain explosions and the phase machine (banner, serve, play, clear, over, win).
// It never draws and never plays sound: it queues sound cues in state.fx for main.js to drain,
// which keeps the rules testable and the renderer a pure picture of the state.
//
// Brick kinds, one character each in the level maps below:
//   n  normal crystal, one hit        t  tough crystal, cracks then breaks
//   p  prism, explodes and chains     s  dark glass, unbreakable

import {
  BALL, BANNER_SECONDS, BRICK, CLEAR_SECONDS, COMBO_MAX_MULTIPLIER, COMBO_PER_STEP, FIELD,
  FX, LIVES, PADDLE, POWERUP, THEMES,
} from './config.js';
import { chance, pickWeighted, range } from './random.js';

export const BRICK_NORMAL = 'normal';
export const BRICK_TOUGH = 'tough';
export const BRICK_PRISM = 'prism';
export const BRICK_SOLID = 'solid';

const KIND_OF = { n: BRICK_NORMAL, t: BRICK_TOUGH, p: BRICK_PRISM, s: BRICK_SOLID };
const SCORE_OF = { normal: BRICK.scoreNormal, tough: BRICK.scoreTough, prism: BRICK.scorePrism };

/** The six fields. Every row is twelve characters; a short row is padded with air. */
export const LEVELS = [
  [
    '............',
    '.nnnnnnnnnn.',
    '.nnpnnnnpnn.',
    '.nnnnnnnnnn.',
    '..n..pp..n..',
  ],
  [
    'ntntntntntnt',
    'npnnnnnnnnpn',
    'ntntntntntnt',
    '.nnnppppnnn.',
    '.ntnnnnnntn.',
    '..nnnnnnnn..',
  ],
  [
    '....nnnn....',
    '..nttnnttn..',
    '.ntnppppntn.',
    '.nntnnnntnn.',
    'nnnns..snnnn',
    '..nnnnnnnn..',
  ],
  [
    'pnnn........',
    'tpnnn.......',
    'nntpnnn.....',
    '...nntpnnn..',
    '.....nntpnn',
    '.......nntp.',
    'nnnnnnnnnnnn',
  ],
  [
    'stttttttttts',
    'tnnnnnnnnnnt',
    'tnppttpptnnt',
    'tnntnnnntnnt',
    '.tnnnnnnnnt.',
    '..nppppppn..',
    '...nnnnnn...',
  ],
  [
    '..n..pp..n..',
    '.ntnnnnnntn.',
    'nnppnnnnppnn',
    'tnntnpptnnnt',
    'tnnnnnnnnnnt',
    '.sppnnnnppn.',
    '..ntnnnntn..',
    '...n.pp.n...',
  ],
];

const BRICK_W = (FIELD.width - 2 * BRICK.marginX - (BRICK.cols - 1) * BRICK.gap) / BRICK.cols;
const PADDLE_Y = FIELD.height - PADDLE.lift;
const EXPLOSION_RADIUS = 122;
const EXPLOSION_DELAY = 0.07;
const MAX_PARTICLES = 460;
const SHAKE_PER_BREAK = 0.08;
const SHAKE_PER_EXPLOSION = 0.22;

export function createWorld(random) {
  const state = {
    phase: 'banner',
    phaseTime: 0,
    time: 0,
    levelIndex: 0,
    score: 0,
    lives: LIVES,
    combo: 0,
    bestCombo: 0,
    remaining: 0,
    paddle: { x: FIELD.width / 2, width: PADDLE.width, wideTime: 0 },
    balls: [],
    bricks: [],
    powerups: [],
    particles: [],
    floaters: [],
    explosions: [],
    bgPrisms: [],
    slowTime: 0,
    shake: 0,
    demo: false,
    fx: [],
  };

  function cue(name, value) {
    state.fx.push(value === undefined ? [name] : [name, value]);
  }

  function ballSpeed() {
    return Math.min(BALL.maxSpeed, BALL.baseSpeed + state.levelIndex * BALL.speedPerLevel);
  }

  function makeBall(x, y, angleDeg) {
    const speed = ballSpeed();
    const angle = (angleDeg * Math.PI) / 180;
    return {
      x, y,
      vx: speed * Math.sin(angle),
      vy: -speed * Math.cos(angle),
      trail: [],
    };
  }

  function serveBall() {
    state.balls = [makeBall(state.paddle.x, PADDLE_Y - PADDLE.height / 2 - BALL.radius - 1, 0)];
    const ball = state.balls[0];
    ball.vx = 0;
    ball.vy = 0;
  }

  function startLevel(index) {
    state.levelIndex = index;
    const theme = THEMES[index];
    state.bricks = [];
    state.remaining = 0;
    LEVELS[index].forEach((rowText, row) => {
      const line = rowText.padEnd(BRICK.cols, '.').slice(0, BRICK.cols);
      for (let col = 0; col < BRICK.cols; col += 1) {
        const kind = KIND_OF[line[col]];
        if (!kind) continue;
        const aurora = index === THEMES.length - 1;
        const hue = aurora
          ? (col / BRICK.cols) * 360 + row * 14
          : theme.hue + row * 7 + range(random, -4, 4);
        state.bricks.push({
          x: BRICK.marginX + col * (BRICK_W + BRICK.gap),
          y: BRICK.top + row * (BRICK.height + BRICK.gap),
          w: BRICK_W,
          h: BRICK.height,
          kind,
          hp: kind === BRICK_TOUGH ? 2 : 1,
          hue,
          alive: true,
          seed: random(),
        });
        if (kind !== BRICK_SOLID) state.remaining += 1;
      }
    });
    state.powerups = [];
    state.explosions = [];
    state.slowTime = 0;
    state.paddle.wideTime = 0;
    state.paddle.width = PADDLE.width;
    state.paddle.x = FIELD.width / 2;
    state.combo = 0;
    state.bgPrisms = [];
    for (let index2 = 0; index2 < 7; index2 += 1) {
      state.bgPrisms.push({
        x: range(random, 40, FIELD.width - 40),
        y: range(random, 60, FIELD.height - 80),
        r: range(random, 16, 46),
        rot: range(random, 0, Math.PI * 2),
        vr: range(random, -0.14, 0.14),
        hue: theme.hue + range(random, -26, 26),
        drift: range(random, 0, Math.PI * 2),
      });
    }
    serveBall();
    state.phase = 'banner';
    state.phaseTime = 0;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.bestCombo = 0;
    state.particles = [];
    state.floaters = [];
    startLevel(0);
  }

  /** Launch the served orb, if there is one waiting. A demo launches itself. */
  function launch() {
    if (state.phase !== 'serve') return;
    const ball = state.balls[0];
    if (!ball) return;
    const speed = ballSpeed();
    const lean = range(random, -BALL.serveLean, BALL.serveLean) * (Math.PI / 180);
    ball.vx = speed * Math.sin(lean);
    ball.vy = -speed * Math.cos(lean);
    state.phase = 'play';
    state.phaseTime = 0;
    cue('launch');
  }

  function burst(x, y, hue, count, power) {
    for (let index = 0; index < count; index += 1) {
      const angle = range(random, 0, Math.PI * 2);
      const speed = range(random, 30, 190) * power;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0,
        maxLife: range(random, 0.35, 0.85),
        size: range(random, 2.5, 6.5),
        hue: hue + range(random, -14, 14),
        rot: range(random, 0, Math.PI),
        vr: range(random, -6, 6),
        shape: chance(random, 0.6) ? 'shard' : 'spark',
      });
    }
    if (state.particles.length > MAX_PARTICLES) {
      state.particles.splice(0, state.particles.length - MAX_PARTICLES);
    }
  }

  function floater(x, y, text, hue) {
    state.floaters.push({ x, y, text, hue, life: 0, maxLife: 0.9 });
    if (state.floaters.length > 24) state.floaters.shift();
  }

  function multiplier() {
    return Math.min(COMBO_MAX_MULTIPLIER, 1 + Math.floor(state.combo / COMBO_PER_STEP));
  }

  function maybeDrop(x, y) {
    if (!chance(random, POWERUP.dropChance)) return;
    // Multi-ball is the swingiest gift, so it falls a little less often than the others.
    const type = pickWeighted(random, [['multi', 0.3], ['wide', 0.35], ['slow', 0.35]]);
    state.powerups.push({ x, y, type, vy: POWERUP.fallSpeed });
  }

  function breakBrick(brick, byExplosion) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    brick.alive = false;
    if (state.demo) {
      // The title attract mode breaks bricks for show: no score, no chain, and the brick
      // quietly regrows a few seconds later so the field never empties.
      brick.regrow = range(random, 3.5, 6.5);
      burst(cx, cy, brick.hue, 10, 0.9);
      return;
    }
    state.remaining -= 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const gained = SCORE_OF[brick.kind] * multiplier();
    state.score += gained;
    burst(cx, cy, brick.hue, brick.kind === BRICK_PRISM ? 26 : 15, brick.kind === BRICK_PRISM ? 1.35 : 1);
    floater(cx, cy - 6, `+${gained}`, brick.hue);
    state.shake = Math.min(1, state.shake + (brick.kind === BRICK_PRISM ? SHAKE_PER_EXPLOSION : SHAKE_PER_BREAK));
    if (brick.kind === BRICK_PRISM) {
      cue('shatter');
      state.explosions.push({ x: cx, y: cy, delay: EXPLOSION_DELAY });
    } else {
      cue('chime', state.combo);
    }
    if (!byExplosion) maybeDrop(cx, cy);
    if (state.remaining <= 0 && state.phase === 'play') {
      state.phase = 'clear';
      state.phaseTime = 0;
      cue('clear');
      for (let index = 0; index < 5; index += 1) {
        burst(range(random, 120, FIELD.width - 120), range(random, 90, 260), range(random, 0, 360), 18, 1.1);
      }
    }
  }

  /** Hurt a brick without bouncing the orb: explosion damage and chain fire. */
  function damageBrick(brick, byExplosion) {
    if (!brick.alive || brick.kind === BRICK_SOLID) return;
    if (brick.kind === BRICK_TOUGH && brick.hp > 1) {
      // An explosion cracks a tough brick instead of breaking it outright.
      brick.hp = 1;
      burst(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.hue, 8, 0.8);
      return;
    }
    breakBrick(brick, byExplosion);
  }

  function runExplosions(dt) {
    for (let index = state.explosions.length - 1; index >= 0; index -= 1) {
      const boom = state.explosions[index];
      boom.delay -= dt;
      if (boom.delay > 0) continue;
      state.explosions.splice(index, 1);
      state.shake = Math.min(1, state.shake + SHAKE_PER_EXPLOSION);
      for (const brick of state.bricks) {
        if (!brick.alive || brick.kind === BRICK_SOLID) continue;
        const dx = brick.x + brick.w / 2 - boom.x;
        const dy = brick.y + brick.h / 2 - boom.y;
        if (dx * dx + dy * dy <= EXPLOSION_RADIUS * EXPLOSION_RADIUS) damageBrick(brick, true);
      }
    }
  }

  /** Damage a brick the orb just touched. The bounce itself is moveBall's job (see below). */
  function hitBrick(ball, brick) {
    if (brick.kind === BRICK_SOLID) {
      burst(ball.x, ball.y, brick.hue, 4, 0.5);
      cue('tick');
    } else if (brick.kind === BRICK_TOUGH && brick.hp > 1) {
      brick.hp = 1;
      state.score += BRICK.scoreChip;
      burst(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.hue, 9, 0.85);
      floater(brick.x + brick.w / 2, brick.y - 2, `+${BRICK.scoreChip}`, brick.hue);
      cue('chip');
    } else {
      breakBrick(brick, false);
    }
  }

  function keepBallSteep(ball) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed === 0) return;
    const minVy = speed * BALL.minVerticalShare;
    if (Math.abs(ball.vy) < minVy) {
      const signY = ball.vy < 0 ? -1 : 1;
      ball.vy = signY * minVy;
      const vxMag = Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy));
      ball.vx = (ball.vx < 0 ? -1 : 1) * vxMag;
    }
  }

  function bounceOffPaddle(ball) {
    const speed = Math.hypot(ball.vx, ball.vy) || ballSpeed();
    const rel = Math.max(-1, Math.min(1, (ball.x - state.paddle.x) / (state.paddle.width / 2 + BALL.radius)));
    const angle = (rel * 68 * Math.PI) / 180;
    ball.vx = speed * Math.sin(angle);
    ball.vy = -speed * Math.cos(angle);
    ball.y = PADDLE_Y - PADDLE.height / 2 - BALL.radius - 0.5;
    state.combo = 0;
    cue('thock');
    burst(ball.x, ball.y + BALL.radius, THEMES[state.levelIndex].hue, 3, 0.4);
  }

  function moveBall(ball, dt, demo) {
    const timeScale = state.slowTime > 0 ? POWERUP.slowFactor : 1;
    const dist = Math.hypot(ball.vx, ball.vy) * dt * timeScale;
    const steps = Math.max(1, Math.ceil(dist / (BALL.radius * 0.85)));
    const sub = (dt * timeScale) / steps;
    for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
      ball.x += ball.vx * sub;
      ball.y += ball.vy * sub;
      if (ball.x < BALL.radius) {
        ball.x = BALL.radius;
        ball.vx = Math.abs(ball.vx);
        cue('tick');
      } else if (ball.x > FIELD.width - BALL.radius) {
        ball.x = FIELD.width - BALL.radius;
        ball.vx = -Math.abs(ball.vx);
        cue('tick');
      }
      if (ball.y < BALL.radius) {
        ball.y = BALL.radius;
        ball.vy = Math.abs(ball.vy);
        cue('tick');
      }
      if (ball.vy > 0 && ball.y + BALL.radius >= PADDLE_Y - PADDLE.height / 2
        && ball.y - BALL.radius <= PADDLE_Y + PADDLE.height / 2
        && Math.abs(ball.x - state.paddle.x) <= state.paddle.width / 2 + BALL.radius) {
        bounceOffPaddle(ball);
      }
      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        const nearX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
        const nearY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
        const dx = ball.x - nearX;
        const dy = ball.y - nearY;
        const distSq = dx * dx + dy * dy;
        if (distSq > BALL.radius * BALL.radius) continue;
        // Reflect about the contact normal and push the orb clear of the brick, so a corner
        // hit leaves the way it came instead of jittering inside the crystal.
        let nx;
        let ny;
        if (distSq > 1e-9) {
          const dist = Math.sqrt(distSq);
          nx = dx / dist;
          ny = dy / dist;
          ball.x = nearX + nx * (BALL.radius + 0.1);
          ball.y = nearY + ny * (BALL.radius + 0.1);
        } else {
          // The centre is inside the brick: leave by the axis of least penetration.
          const cx = brick.x + brick.w / 2;
          const cy = brick.y + brick.h / 2;
          const penX = brick.w / 2 + BALL.radius - Math.abs(ball.x - cx);
          const penY = brick.h / 2 + BALL.radius - Math.abs(ball.y - cy);
          if (penX < penY) {
            nx = ball.x < cx ? -1 : 1;
            ny = 0;
            ball.x = cx + nx * (brick.w / 2 + BALL.radius + 0.1);
          } else {
            nx = 0;
            ny = ball.y < cy ? -1 : 1;
            ball.y = cy + ny * (brick.h / 2 + BALL.radius + 0.1);
          }
        }
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
        keepBallSteep(ball);
        hitBrick(ball, brick);
        break;
      }
      if (ball.y - BALL.radius > FIELD.height) return false;
      if (demo && ball.y + BALL.radius > FIELD.height) {
        ball.y = FIELD.height - BALL.radius;
        ball.vy = -Math.abs(ball.vy);
      }
    }
    return true;
  }

  function applyPowerup(type) {
    cue('power');
    if (type === 'wide') {
      state.paddle.wideTime = PADDLE.wideSeconds;
    } else if (type === 'slow') {
      state.slowTime = POWERUP.slowSeconds;
    } else if (type === 'multi') {
      const born = [];
      for (const ball of state.balls) {
        for (const lean of [-30, 30]) {
          if (state.balls.length + born.length >= POWERUP.maxBalls) break;
          const speed = Math.hypot(ball.vx, ball.vy) || ballSpeed();
          const base = Math.atan2(ball.vy, ball.vx);
          const angle = base + (lean * Math.PI) / 180;
          born.push({
            x: ball.x, y: ball.y,
            vx: speed * Math.cos(angle),
            vy: speed * Math.sin(angle),
            trail: [],
          });
        }
      }
      state.balls.push(...born);
    }
  }

  function movePowerups(dt) {
    for (let index = state.powerups.length - 1; index >= 0; index -= 1) {
      const drop = state.powerups[index];
      drop.y += drop.vy * dt;
      const caught = drop.y + POWERUP.height / 2 >= PADDLE_Y - PADDLE.height / 2
        && drop.y - POWERUP.height / 2 <= PADDLE_Y + PADDLE.height / 2
        && Math.abs(drop.x - state.paddle.x) <= state.paddle.width / 2 + POWERUP.width / 2;
      if (caught) {
        burst(drop.x, drop.y, 150, 10, 0.7);
        floater(drop.x, drop.y - 10, drop.type === 'multi' ? 'MULTI ✕3' : drop.type === 'wide' ? 'WIDE' : 'SLOW', 160);
        applyPowerup(drop.type);
        state.powerups.splice(index, 1);
      } else if (drop.y - POWERUP.height / 2 > FIELD.height) {
        state.powerups.splice(index, 1);
      }
    }
  }

  function loseBall() {
    state.lives -= 1;
    state.combo = 0;
    state.powerups = [];
    state.slowTime = 0;
    state.paddle.wideTime = 0;
    if (state.lives <= 0) {
      state.phase = 'over';
      state.phaseTime = 0;
      cue('over');
    } else {
      cue('lose');
      serveBall();
      state.phase = 'serve';
      state.phaseTime = 0;
    }
  }

  function movePaddle(dt, control, demo) {
    const paddle = state.paddle;
    if (demo) {
      const ball = state.balls[0];
      if (ball) {
        const target = ball.x + ball.vx * 0.12;
        paddle.x += Math.max(-PADDLE.keyboardSpeed * dt, Math.min(PADDLE.keyboardSpeed * dt, target - paddle.x));
      }
    } else if (control.pointerX !== null && control.pointerX !== undefined) {
      const delta = control.pointerX - paddle.x;
      paddle.x += delta * Math.min(1, PADDLE.pointerEase * dt);
      if (control.dir !== 0) paddle.x += control.dir * PADDLE.keyboardSpeed * dt;
    } else {
      paddle.x += control.dir * PADDLE.keyboardSpeed * dt;
    }
    const half = paddle.width / 2;
    paddle.x = Math.max(half, Math.min(FIELD.width - half, paddle.x));
    const targetWidth = paddle.wideTime > 0 ? PADDLE.width * PADDLE.wideFactor : PADDLE.width;
    paddle.width += (targetWidth - paddle.width) * Math.min(1, dt * 10);
  }

  function stepFx(dt) {
    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const p = state.particles[index];
      p.life += dt;
      if (p.life >= p.maxLife) {
        state.particles.splice(index, 1);
        continue;
      }
      p.vy += FX.particleGravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let index = state.floaters.length - 1; index >= 0; index -= 1) {
      const f = state.floaters[index];
      f.life += dt;
      f.y -= FX.floaterRise * dt;
      if (f.life >= f.maxLife) state.floaters.splice(index, 1);
    }
    for (const prism of state.bgPrisms) {
      prism.rot += prism.vr * dt;
      prism.y += Math.sin(state.time * 0.4 + prism.drift) * 3.2 * dt;
    }
    if (state.demo) {
      for (const brick of state.bricks) {
        if (brick.alive || brick.regrow === undefined) continue;
        brick.regrow -= dt;
        if (brick.regrow <= 0) {
          brick.alive = true;
          brick.hp = brick.kind === BRICK_TOUGH ? 2 : 1;
          brick.regrow = undefined;
        }
      }
    }
    state.shake = Math.max(0, state.shake - dt * 2.4);
  }

  /**
   * Advance the world one fixed step. `control` is { dir, pointerX }; `demo` runs the title
   * attract mode, where the paddle pilots itself, the floor is kind and nothing is scored.
   */
  function step(dt, control, demo) {
    state.demo = demo;
    state.time += dt;
    state.phaseTime += dt;
    if (state.paddle.wideTime > 0) state.paddle.wideTime -= dt;
    if (state.slowTime > 0) state.slowTime -= dt;
    movePaddle(dt, control, demo);
    runExplosions(dt);

    if (state.phase === 'banner') {
      if (state.phaseTime >= BANNER_SECONDS) {
        state.phase = demo ? 'play' : 'serve';
        state.phaseTime = 0;
        if (demo) {
          const ball = state.balls[0];
          if (ball && ball.vy === 0) {
            const speed = ballSpeed();
            ball.vx = speed * 0.36;
            ball.vy = -speed * 0.93;
          }
        }
      }
    } else if (state.phase === 'serve') {
      const ball = state.balls[0];
      if (ball) {
        ball.x = state.paddle.x;
        ball.y = PADDLE_Y - PADDLE.height / 2 - BALL.radius - 1;
        ball.trail.length = 0;
      }
      if (demo) launch();
    } else if (state.phase === 'play') {
      const alive = [];
      for (const ball of state.balls) {
        ball.trail.unshift({ x: ball.x, y: ball.y });
        if (ball.trail.length > BALL.trailLength) ball.trail.pop();
        if (moveBall(ball, dt, demo)) alive.push(ball);
      }
      state.balls = alive;
      if (!demo && state.balls.length === 0 && state.phase === 'play') loseBall();
      movePowerups(dt);
    } else if (state.phase === 'clear') {
      const alive = [];
      for (const ball of state.balls) {
        if (moveBall(ball, dt, true)) alive.push(ball);
      }
      state.balls = alive;
      if (state.phaseTime >= CLEAR_SECONDS) {
        if (state.levelIndex + 1 >= LEVELS.length) {
          state.phase = 'win';
          state.phaseTime = 0;
          cue('win');
        } else {
          startLevel(state.levelIndex + 1);
        }
      }
    }
    stepFx(dt);
  }

  reset();

  return {
    state,
    reset,
    startLevel,
    launch,
    step,
    burst,
    floater,
    multiplier,
    /** Take the sound cues queued since the last call, as [name, value?] pairs. */
    drainFx() {
      const out = state.fx;
      state.fx = [];
      return out;
    },
  };
}
