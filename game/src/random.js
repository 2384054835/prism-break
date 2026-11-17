// A small seeded random number generator (mulberry32) plus the helpers the game draws from it.
// The same seed always gives the same stream, which is what makes the screenshot scenes and a
// shared ?seed= game repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max], both ends included. */
export function integer(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** True with probability `chance` (0 to 1). */
export function chance(random, probability) {
  return random() < probability;
}

/** One element of `items`, chosen by the stream. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/**
 * One value from `entries` ([value, weight] pairs), chosen with probability proportional to
 * its weight: how the game makes multi-ball rarer than the other power-ups.
 */
export function pickWeighted(random, entries) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}
