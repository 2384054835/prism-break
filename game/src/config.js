// Every tuning number for Prism Break in one place. The playfield is a fixed 960x640 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 960, height: 640 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PADDLE = {
  width: 112,
  height: 16,
  /** Distance from the field's bottom edge to the paddle's centre line. */
  lift: 42,
  keyboardSpeed: 660,
  /** How fast the paddle eases toward the pointer, per second (a rate, not a cap). */
  pointerEase: 26,
  wideFactor: 1.6,
  wideSeconds: 12,
};

export const BALL = {
  radius: 7,
  baseSpeed: 405,
  speedPerLevel: 16,
  maxSpeed: 660,
  /** The ball never flies flatter than this share of its speed vertically: no endless loops. */
  minVerticalShare: 0.3,
  /** Degrees the launch may lean from straight up, either way. */
  serveLean: 32,
  trailLength: 14,
};

export const BRICK = {
  cols: 12,
  maxRows: 8,
  gap: 5,
  /** Left and right margins of the brick field; the top sits below the HUD. */
  marginX: 48,
  top: 106,
  height: 25,
  scoreNormal: 50,
  scoreTough: 90,
  scorePrism: 120,
  scoreChip: 10,
};

export const POWERUP = {
  width: 36,
  height: 20,
  fallSpeed: 155,
  dropChance: 0.17,
  slowFactor: 0.62,
  slowSeconds: 8,
  /** The most orbs slow-time and multi-ball may ever leave in play. */
  maxBalls: 9,
};

export const LIVES = 3;

/** Score multiplier grows one step per this many unanswered breaks; the paddle resets the run. */
export const COMBO_PER_STEP = 8;
export const COMBO_MAX_MULTIPLIER = 6;

/** How long the level banner and the level-clear celebration hold, in seconds. */
export const BANNER_SECONDS = 1.6;
export const CLEAR_SECONDS = 2.6;

/** Particle and score-text motion, shared by every burst the world spawns. */
export const FX = {
  particleGravity: 620,
  floaterRise: 34,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score and the mute choice are kept between visits (this browser only). */
export const BEST_KEY = 'prism-break.best';
export const MUTE_KEY = 'prism-break.muted';

/**
 * The six levels' names and colour themes. `hue` is the field's base hue; each row leans a few
 * degrees further, so a wall of bricks reads as one crystal in many lights. Level 6 ignores its
 * hue and shades every column of the rainbow instead (see world.js).
 */
export const THEMES = [
  { name: 'First Light', hue: 205 },
  { name: 'Mint Garden', hue: 152 },
  { name: 'Peach Conservatory', hue: 24 },
  { name: 'Violet Hour', hue: 262 },
  { name: 'Rose Vault', hue: 336 },
  { name: 'Aurora Crown', hue: 0 },
];
