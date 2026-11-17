// The renderer: every pixel of Prism Break, drawn from the world state and nothing else.
// Pastel glass on a pale sky — bricks are faceted crystals with a lit top edge and a soft
// shadow, the orb is a pearl with a comet trail, the paddle a bar of glass with a gem at its
// heart. The canvas is scaled to fit the window (letterboxed, devicePixelRatio-aware) and the
// world is drawn in its fixed 960x640 coordinates under a whisper of screen shake.

import { BALL, COMBO_MAX_MULTIPLIER, COMBO_PER_STEP, FIELD, FONT, PADDLE, POWERUP, THEMES } from './config.js';
import { BRICK_PRISM, BRICK_SOLID, BRICK_TOUGH } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const INK = '#33404f';
const INK_SOFT = 'rgba(51, 64, 79, 0.62)';
const PADDLE_Y = FIELD.height - PADDLE.lift;

function hsla(hue, sat, light, alpha) {
  return `hsla(${((hue % 360) + 360) % 360}, ${sat}%, ${light}%, ${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { width: 960, height: 640, scale: 1, offsetX: 0, offsetY: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const scale = Math.min(width / FIELD.width, height / FIELD.height);
    view = {
      width, height, dpr, scale,
      offsetX: (width - FIELD.width * scale) / 2,
      offsetY: (height - FIELD.height * scale) / 2,
    };
  }
  window.addEventListener('resize', resize);
  resize();

  /** Turn a pointer event's clientX into a playfield x (for the paddle to follow). */
  function logicalX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left - view.offsetX) / view.scale;
  }

  function drawBackground(state, theme) {
    const grad = ctx.createLinearGradient(0, 0, 0, view.height);
    grad.addColorStop(0, '#f8fbfe');
    grad.addColorStop(0.55, hsla(theme.hue, 72, 95, 1));
    grad.addColorStop(1, hsla(theme.hue + 24, 68, 89, 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.width, view.height);
    const glow = ctx.createRadialGradient(view.width * 0.22, view.height * 0.1, 10, view.width * 0.22, view.height * 0.1, view.width * 0.55);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.width, view.height);
    const glow2 = ctx.createRadialGradient(view.width * 0.85, view.height * 0.95, 10, view.width * 0.85, view.height * 0.95, view.width * 0.5);
    glow2.addColorStop(0, hsla(theme.hue + 40, 85, 78, 0.4));
    glow2.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, view.width, view.height);
  }

  /** The parts of the backdrop that live in playfield coordinates: prisms and the floor line. */
  function drawBackdrop(state, theme) {
    ctx.fillStyle = hsla(theme.hue, 60, 70, 0.35);
    ctx.fillRect(0, PADDLE_Y + PADDLE.height / 2 + 14, FIELD.width, 2);
    for (let index = 0; index < state.bgPrisms.length; index += 1) {
      const prism = state.bgPrisms[index];
      const sides = 3 + (index % 3);
      ctx.save();
      ctx.translate(prism.x, prism.y);
      ctx.rotate(prism.rot);
      ctx.beginPath();
      for (let s = 0; s < sides; s += 1) {
        const a = (s / sides) * Math.PI * 2;
        if (s === 0) ctx.moveTo(Math.cos(a) * prism.r, Math.sin(a) * prism.r);
        else ctx.lineTo(Math.cos(a) * prism.r, Math.sin(a) * prism.r);
      }
      ctx.closePath();
      ctx.fillStyle = hsla(prism.hue, 75, 82, 0.1);
      ctx.fill();
      ctx.strokeStyle = hsla(prism.hue, 65, 68, 0.18);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBrick(state, brick) {
    const { x, y, w, h } = brick;
    if (brick.kind === BRICK_SOLID) {
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#5a6a80');
      grad.addColorStop(0.5, '#42506a');
      grad.addColorStop(1, '#333f55');
      roundRect(ctx, x, y, w, h, 6);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 5, y + h - 5);
      ctx.lineTo(x + w - 12, y + 5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();
      return;
    }
    const hue = brick.hue;
    ctx.save();
    ctx.shadowColor = hsla(hue, 85, 62, 0.45);
    ctx.shadowBlur = brick.kind === BRICK_PRISM ? 14 + Math.sin(state.time * 3.2 + brick.seed * 9) * 5 : 9;
    ctx.shadowOffsetY = 3;
    const grad = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    grad.addColorStop(0, hsla(hue, 92, 87, 1));
    grad.addColorStop(0.45, hsla(hue, 82, 69, 1));
    grad.addColorStop(1, hsla(hue, 76, 57, 1));
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    // Facets: a lit cap, a diagonal cut, and a bright rim.
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h - 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.lineTo(x + w * 0.52, y + 3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.52, y + 2);
    ctx.lineTo(x + w - 4, y + h - 3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (brick.kind === BRICK_PRISM) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = 7 + Math.sin(state.time * 3.2 + brick.seed * 9) * 1.2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(-r / 1.6, -r / 1.6, r * 1.24, r * 1.24);
      ctx.strokeStyle = hsla(hue, 90, 45, 0.65);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-r / 1.6, -r / 1.6, r * 1.24, r * 1.24);
      ctx.restore();
    }
    if (brick.kind === BRICK_TOUGH) {
      if (brick.hp > 1) {
        roundRect(ctx, x + w * 0.3, y + 4, w * 0.4, h - 8, 4);
        ctx.fillStyle = hsla(hue, 70, 46, 0.35);
        ctx.fill();
      } else {
        // Cracked: three jagged seams seeded by the brick, so they never crawl.
        ctx.strokeStyle = 'rgba(38, 48, 60, 0.42)';
        ctx.lineWidth = 1.1;
        const s = brick.seed * 997;
        for (let crack = 0; crack < 3; crack += 1) {
          const startX = x + ((Math.sin(s + crack * 2.3) * 0.5 + 0.5) * 0.7 + 0.15) * w;
          ctx.beginPath();
          ctx.moveTo(startX, y + 2);
          ctx.lineTo(startX + Math.sin(s + crack * 5.1) * 6, y + h * 0.45);
          ctx.lineTo(startX + Math.sin(s + crack * 3.7) * 9, y + h - 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawPowerup(state, drop) {
    const colors = { multi: 275, wide: 168, slow: 214 };
    const glyphs = { multi: '✕3', wide: '↔', slow: '◐' };
    const hue = colors[drop.type];
    const w = POWERUP.width;
    const h = POWERUP.height;
    const pulse = 1 + Math.sin(state.time * 5 + drop.x) * 0.05;
    ctx.save();
    ctx.translate(drop.x, drop.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = hsla(hue, 85, 60, 0.65);
    ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, hsla(hue, 90, 82, 1));
    grad.addColorStop(1, hsla(hue, 80, 58, 1));
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyphs[drop.type], 0, 1);
    ctx.restore();
  }

  function drawPaddle(state, theme) {
    const paddle = state.paddle;
    const w = paddle.width;
    const h = PADDLE.height;
    const x = paddle.x - w / 2;
    const y = PADDLE_Y - h / 2;
    ctx.save();
    ctx.shadowColor = hsla(theme.hue, 85, 60, 0.55);
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.5, hsla(theme.hue, 88, 80, 0.95));
    grad.addColorStop(1, hsla(theme.hue, 80, 62, 0.95));
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();
    // The heart gem.
    const gem = ctx.createRadialGradient(paddle.x - 1.5, PADDLE_Y - 1.5, 0.5, paddle.x, PADDLE_Y, 6);
    gem.addColorStop(0, '#ffffff');
    gem.addColorStop(0.55, hsla(theme.hue + 40, 92, 70, 1));
    gem.addColorStop(1, hsla(theme.hue + 40, 85, 52, 1));
    ctx.beginPath();
    ctx.arc(paddle.x, PADDLE_Y, 5, 0, Math.PI * 2);
    ctx.fillStyle = gem;
    ctx.fill();
    if (paddle.wideTime > 0) {
      ctx.fillStyle = hsla(168, 75, 45, 0.55);
      ctx.fillRect(x, y + h + 5, w * Math.min(1, paddle.wideTime / 12), 3);
    }
  }

  function drawBall(state, ball, theme) {
    for (let index = ball.trail.length - 1; index >= 0; index -= 1) {
      const point = ball.trail[index];
      const share = 1 - index / BALL.trailLength;
      ctx.beginPath();
      ctx.arc(point.x, point.y, BALL.radius * (0.35 + share * 0.55), 0, Math.PI * 2);
      ctx.fillStyle = hsla(theme.hue + 30, 90, 68, share * 0.3);
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = hsla(theme.hue + 30, 95, 62, 0.85);
    ctx.shadowBlur = 15;
    const grad = ctx.createRadialGradient(ball.x - 2.5, ball.y - 2.5, 0.5, ball.x, ball.y, BALL.radius + 1);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, hsla(theme.hue + 30, 95, 80, 1));
    grad.addColorStop(1, hsla(theme.hue + 30, 88, 58, 1));
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      const share = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 'shard') {
        ctx.beginPath();
        ctx.moveTo(-p.size, p.size * 0.7);
        ctx.lineTo(0, -p.size);
        ctx.lineTo(p.size, p.size * 0.7);
        ctx.closePath();
        ctx.fillStyle = hsla(p.hue, 85, 68, share * 0.9);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = hsla(p.hue, 95, 76, share);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFloaters(state) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of state.floaters) {
      const share = 1 - f.life / f.maxLife;
      ctx.font = `700 15px ${FONT}`;
      ctx.fillStyle = hsla(f.hue, 65, 36, share);
      ctx.fillText(f.text, f.x, f.y);
    }
  }

  function text(str, x, y, font, fill, align = 'center') {
    ctx.font = font;
    ctx.fillStyle = fill;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawHud(state, best, multiplier) {
    text('SCORE', 50, 30, `600 11px ${FONT}`, INK_SOFT, 'left');
    text(String(state.score).padStart(6, '0'), 50, 52, `800 24px ${FONT}`, INK, 'left');
    text('BEST', FIELD.width - 50, 30, `600 11px ${FONT}`, INK_SOFT, 'right');
    text(String(Math.max(best, state.score)).padStart(6, '0'), FIELD.width - 50, 52, `800 24px ${FONT}`, INK, 'right');
    const theme = THEMES[state.levelIndex];
    text(`LEVEL ${state.levelIndex + 1} · ${theme.name.toUpperCase()}`, FIELD.width / 2, 34, `700 13px ${FONT}`, INK_SOFT);
    // Lives, as little crystal orbs under the score.
    for (let index = 0; index < state.lives; index += 1) {
      const x = 58 + index * 22;
      const grad = ctx.createRadialGradient(x - 2, 76, 0.5, x, 79, 8);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, hsla(345, 90, 74, 1));
      grad.addColorStop(1, hsla(345, 82, 55, 1));
      ctx.beginPath();
      ctx.arc(x, 79, 7, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    if (state.combo >= 2) {
      const mult = multiplier;
      text(`COMBO ${state.combo}  ×${mult}`, FIELD.width / 2, 58, `800 15px ${FONT}`, hsla(28 + state.combo * 6, 85, 46, 1));
      const into = (state.combo % COMBO_PER_STEP) / COMBO_PER_STEP;
      ctx.fillStyle = hsla(28 + state.combo * 6, 85, 60, 0.35);
      roundRect(ctx, FIELD.width / 2 - 44, 70, 88, 4, 2);
      ctx.fill();
      ctx.fillStyle = hsla(28 + state.combo * 6, 85, 52, 0.9);
      roundRect(ctx, FIELD.width / 2 - 44, 70, 88 * (mult >= COMBO_MAX_MULTIPLIER ? 1 : into), 4, 2);
      ctx.fill();
    }
    if (state.slowTime > 0) {
      text(`◐ SLOW ${Math.ceil(state.slowTime)}s`, FIELD.width - 50, 79, `700 12px ${FONT}`, hsla(214, 70, 42, 0.9), 'right');
    }
  }

  function veil(alpha) {
    ctx.fillStyle = `rgba(244, 248, 252, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(90, 120, 160, 0.25)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fill();
    ctx.restore();
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 22);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawBanner(state) {
    const theme = THEMES[state.levelIndex];
    if (state.phase === 'banner') {
      const pop = Math.min(1, state.phaseTime / 0.3);
      ctx.save();
      ctx.globalAlpha = pop;
      text(`LEVEL ${state.levelIndex + 1}`, FIELD.width / 2, 268, `700 15px ${FONT}`, INK_SOFT);
      text(theme.name, FIELD.width / 2, 306, `800 44px ${FONT}`, INK);
      text('shatter every crystal', FIELD.width / 2, 344, `500 16px ${FONT}`, INK_SOFT);
      ctx.restore();
    } else if (state.phase === 'clear') {
      text('✦ LEVEL CLEAR ✦', FIELD.width / 2, 292, `800 40px ${FONT}`, hsla(theme.hue, 80, 42, 1));
      if (state.levelIndex + 1 < THEMES.length) {
        text(`next: ${THEMES[state.levelIndex + 1].name}`, FIELD.width / 2, 330, `600 16px ${FONT}`, INK_SOFT);
      }
    }
  }

  function drawTitle(state, best) {
    veil(0.34);
    // The name in a slow rainbow of glass hues, with a facet sparkle riding it.
    const title = 'PRISM BREAK';
    ctx.font = `800 86px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(title).width;
    const grad = ctx.createLinearGradient(FIELD.width / 2 - width / 2, 0, FIELD.width / 2 + width / 2, 0);
    grad.addColorStop(0, '#5db9e8');
    grad.addColorStop(0.35, '#7fd8c0');
    grad.addColorStop(0.62, '#c3a6f2');
    grad.addColorStop(1, '#f49ec4');
    ctx.save();
    ctx.shadowColor = 'rgba(120, 170, 220, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = grad;
    ctx.fillText(title, FIELD.width / 2, 128);
    ctx.restore();
    text('a crystal breakout', FIELD.width / 2, 182, `600 19px ${FONT}`, INK_SOFT);
    panel(FIELD.width / 2 - 238, 218, 476, 118);
    text('Bounce the orb · shatter every crystal · clear all 6 levels', FIELD.width / 2, 248, `600 15.5px ${FONT}`, INK);
    text('Move — mouse or ← → · Launch — Space or click', FIELD.width / 2, 278, `500 15px ${FONT}`, INK_SOFT);
    text('Prisms explode and chain · catch ✕3 ↔ ◐ power-ups', FIELD.width / 2, 304, `500 15px ${FONT}`, INK_SOFT);
    const pulse = 0.72 + Math.sin(state.time * 3.4) * 0.28;
    text('CLICK OR PRESS SPACE TO PLAY', FIELD.width / 2, 386, `800 17px ${FONT}`, hsla(210, 75, 42, pulse));
    if (best > 0) text(`BEST ${best}`, FIELD.width / 2, 424, `700 14px ${FONT}`, INK_SOFT);
    text('P pause · M mute', FIELD.width / 2, FIELD.height - 26, `500 12.5px ${FONT}`, INK_SOFT);
  }

  function drawPaused() {
    veil(0.45);
    panel(FIELD.width / 2 - 150, 258, 300, 124);
    text('PAUSED', FIELD.width / 2, 306, `800 34px ${FONT}`, INK);
    text('P or Esc to resume', FIELD.width / 2, 348, `500 15px ${FONT}`, INK_SOFT);
  }

  function drawOver(state, best) {
    veil(0.5);
    panel(FIELD.width / 2 - 210, 196, 420, 248);
    text('GAME OVER', FIELD.width / 2, 248, `800 40px ${FONT}`, INK);
    text('SCORE', FIELD.width / 2, 296, `600 11px ${FONT}`, INK_SOFT);
    text(String(state.score), FIELD.width / 2, 326, `800 40px ${FONT}`, hsla(210, 80, 45, 1));
    text(`best ${Math.max(best, state.score)} · best combo ${state.bestCombo} · reached level ${state.levelIndex + 1}`, FIELD.width / 2, 366, `500 14.5px ${FONT}`, INK_SOFT);
    const pulse = 0.72 + Math.sin(state.time * 3.4) * 0.28;
    text('CLICK OR PRESS SPACE TO PLAY AGAIN', FIELD.width / 2, 408, `800 14.5px ${FONT}`, hsla(210, 75, 42, pulse));
  }

  function drawWin(state, best) {
    veil(0.42);
    panel(FIELD.width / 2 - 230, 190, 460, 260);
    text('✦ AURORA CROWN SHATTERED ✦', FIELD.width / 2, 242, `800 30px ${FONT}`, hsla(280, 70, 48, 1));
    text('all six levels cleared', FIELD.width / 2, 278, `600 16px ${FONT}`, INK_SOFT);
    text('SCORE', FIELD.width / 2, 316, `600 11px ${FONT}`, INK_SOFT);
    text(String(state.score), FIELD.width / 2, 348, `800 42px ${FONT}`, hsla(210, 80, 45, 1));
    text(`best ${Math.max(best, state.score)} · best combo ${state.bestCombo}`, FIELD.width / 2, 388, `500 14.5px ${FONT}`, INK_SOFT);
    const pulse = 0.72 + Math.sin(state.time * 3.4) * 0.28;
    text('CLICK OR PRESS SPACE TO PLAY AGAIN', FIELD.width / 2, 420, `800 14.5px ${FONT}`, hsla(280, 70, 46, pulse));
  }

  /**
   * Paint the world on `screen`. `muted` only changes the little speaker glyph in the corner;
   * `multiplier` is the world's current combo multiplier, for the HUD.
   */
  function draw(state, screen, best, multiplier, muted) {
    const theme = THEMES[state.levelIndex];
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawBackground(state, theme);
    const shakeAmp = state.shake * state.shake * 9;
    const shakeX = Math.sin(state.time * 131.7) * shakeAmp;
    const shakeY = Math.cos(state.time * 149.3) * shakeAmp * 0.7;
    ctx.translate(view.offsetX + shakeX * view.scale, view.offsetY + shakeY * view.scale);
    ctx.scale(view.scale, view.scale);

    drawBackdrop(state, theme);
    for (const brick of state.bricks) if (brick.alive) drawBrick(state, brick);
    for (const drop of state.powerups) drawPowerup(state, drop);
    drawPaddle(state, theme);
    for (const ball of state.balls) drawBall(state, ball, theme);
    drawParticles(state);
    drawFloaters(state);

    if (screen !== SCREEN_TITLE) drawHud(state, best, multiplier);
    if (screen === SCREEN_PLAY && state.phase === 'serve') {
      const pulse = 0.6 + Math.sin(state.time * 4.2) * 0.4;
      text('SPACE OR CLICK TO LAUNCH', FIELD.width / 2, PADDLE_Y - 44, `700 14px ${FONT}`, hsla(theme.hue, 70, 40, pulse));
    }
    if (screen === SCREEN_PLAY) drawBanner(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
    // The sound hint sits in the margin strip below the floor line, clear of it and of the
    // field's right edge. (♫, not ♪: the single note's flag is a hairline in the system-ui
    // fallback font and all but vanishes at this size.)
    text(muted ? '♫̸ muted (M)' : '♫ sound (M)', FIELD.width - 14, FIELD.height - 10, `500 11.5px ${FONT}`, INK_SOFT, 'right');
  }

  return { draw, logicalX };
}
