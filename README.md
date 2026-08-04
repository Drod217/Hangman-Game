# Seinfeld Hangman

A hangman game about nothing. Guess the quote, the character, the episode — 219 puzzles
across five categories, with sound clips from the show.

Originally built in 2018; rebuilt in 2026 to be playable on a phone.

**[▶ Play it](https://drod217.github.io/Hangman-Game/)**

## How to play

Guess letters before the drawing finishes. You get **8 wrong guesses**. The category is
shown as a nudge. Tap the on-screen keys or use a physical keyboard — `?` burns a life
for a free letter, `Enter` starts the next round.

Wins, losses, and your best streak persist in `localStorage`. Puzzles won't repeat until
you've worked through the whole bank.

## Categories

| Category | Count | Examples |
| --- | --- | --- |
| Quote | 47 | *These pretzels are making me thirsty* |
| Episode | 68 | *The Marine Biologist* |
| Character | 38 | *Cosmo Kramer*, *Jackie Chiles* |
| Thing | 39 | *Festivus*, *Shrinkage*, *The Kavorka* |
| Place & Eats | 27 | *Monks Cafe*, *Chocolate babka* |

Add your own in `assets/javascript/words.js` — each entry is `["Phrase", "categoryKey"]`.

## Running locally

No build step, no dependencies. Serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly over `file://` mostly works, but audio may be blocked.

## Structure

```
index.html
assets/css/style.css          responsive layout, Seinfeld title-card palette
assets/javascript/words.js    puzzle bank + category metadata
assets/javascript/game.js     game engine
assets/audio/sound1/          clips played on a wrong guess
assets/audio/sound2/          clips played on a win
```

## What changed in the 2026 rebuild

The original was keyboard-only with the viewport pinned to `initial-scale=0.5`, which made
it effectively unplayable on a phone. This version:

- **Mobile first** — on-screen keyboard, responsive layout, safe-area insets for notched
  screens, dedicated landscape and small-phone breakpoints
- **An actual gallows** — the original never drew one; now an 8-stage animated SVG
- **Bigger bank** — 36 quotes → 219 puzzles in 5 categories, with no-repeat rotation
- **Scoreboard** — wins, losses, current and best streak, persisted locally
- **Hint system** — reveals a letter at the cost of one life
- **Sound handling** — clips load on demand instead of 24 eager `<audio>` tags, start
  behind a user gesture (modern browsers block autoplay), and can be muted
- **Accessibility** — live region for the puzzle, labelled controls, visible focus rings,
  `prefers-reduced-motion` support

Bugs fixed along the way: the win sound retriggered on every keypress after a solve;
correct letters weren't tracked, so re-guessing one re-revealed it; the win check ran
before any guess was made; and the README's "8 wrong guesses" didn't match the code's 10.

## Tests

```bash
npm install   # jsdom, dev-only — the game itself ships with zero dependencies
npm test
```

40 assertions covering the win and loss paths, repeat-guess handling, hint cost, keyboard
state, gallows stages, persistence, and input lockout after a round ends — plus a
500-round soak that drives the puzzle bank past exhaustion to confirm the no-repeat
rotation resets cleanly instead of hanging.
