// Keyboard and pointer input. Held keys give a steering direction; the pointer gives a target
// the paddle eases toward; one-shot presses (launch or start, pause, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter', 'KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

/**
 * Watch `canvas` and the window. `toLogicalX` turns a pointer event's clientX into a playfield
 * x, so the paddle can follow the mouse in the same coordinates the world uses.
 */
export function createInput(canvas, toLogicalX) {
  let left = false;
  let right = false;
  let actions = 0;
  let pointerX = null;
  let pointerSeen = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });
  window.addEventListener('pointermove', (event) => {
    pointerX = toLogicalX(event.clientX);
    pointerSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointerX = toLogicalX(event.clientX);
    pointerSeen = true;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The playfield x the pointer last named, or null before the pointer is ever seen. */
    pointer() {
      return pointerSeen ? pointerX : null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
