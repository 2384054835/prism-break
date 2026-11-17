# prism-break

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/2384054835/prism-break/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/2384054835/prism-break/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Prism Break** is a crystal breakout game for the desktop browser, drawn in soft pastel glass.
Bounce a glowing orb off a glass paddle and shatter six fields of crystal bricks — faceted,
translucent, and tuned to chime. Chain prism explosions, ride combo multipliers, catch falling
power-ups, and clear every brick to break the aurora crown.

## How to play

- Move the paddle to keep the orb in the air. Every brick it touches shatters — clear all the
  breakable bricks to finish the level, and finish all six levels to win.
- You have 3 lives. If the last orb falls past the paddle, you lose one and serve again.
- **Normal** bricks break in one hit. **Tough** bricks crack first, then break. **Prism** bricks
  explode and chain-break their neighbours. **Dark** bricks cannot be broken — route around them.
- Broken bricks sometimes drop power-ups: catch **✕3** for multi-ball, **↔** for a wide paddle,
  and **◐** for slow-time. Consecutive breaks build your combo, which raises both your score
  multiplier and the pitch of the crystal chimes.

## Controls

- **Mouse** — steer the paddle · **← / →** or **A / D** — steer from the keyboard
- **Space** or **click** — launch the orb, start, restart
- **P** or **Esc** — pause · **M** — mute the chimes

## Features

- Six hand-laid levels, each with its own hue theme, from First Light to the Aurora Crown
- Hand-rolled canvas rendering: faceted glass bricks, orb trails, shatter particles, floating
  score text, drifting background prisms and a whisper of screen shake
- Fully synthesized WebAudio sound — pentatonic crystal chimes that climb with your combo; no
  audio files, no network requests, runs completely offline from static files
- Deterministic seeded play, a persistent best score, pause, level transitions, game over and
  victory screens

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Node 22 or later, no install and no build step: the game is the
plain static files under `game/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zjg0qbmr&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
