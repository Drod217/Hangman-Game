# Seinfeld Hangman

A hangman game about nothing. Guess the quote, the character, the episode — 491 puzzles
across six categories, with sound clips from the show.

Originally built in 2018; rebuilt in 2026 to be playable on a phone.

**[▶ Play it](https://drod217.github.io/Hangman-Game/)**

## How to play

Guess letters before the drawing finishes. You get **8 wrong guesses**. The category is
shown as a nudge. Tap the on-screen keys or use a physical keyboard — `?` burns a life
for a free letter, `Enter` starts the next round.

Wins, losses, and your best streak persist in `localStorage`. Puzzles won't repeat until
you've worked through the whole bank. Tap the category pill in the top bar to narrow the
bank to one category — episodes only, quotes only — and the progress bar under the
scoreboard tracks how much of that pool you've cleared.

## Categories

| Category | Count | Examples |
| --- | --- | --- |
| Quote | 129 | *These pretzels are making me thirsty*, *The card says Moops* |
| Episode | 169 | *The Marine Biologist* — every episode, all nine seasons |
| Character | 66 | *Cosmo Kramer*, *Jackie Chiles*, *Bob Sacamano* |
| Thing | 60 | *Festivus*, *Shrinkage*, *The Kavorka*, *Kramerica Industries* |
| Place & Eats | 50 | *Monks Cafe*, *Chocolate babka*, *Mulligatawny* |
| Show Within a Show | 17 | *Rochelle Rochelle*, *Death Blow*, *Prognosis Negative* |

Episodes cover the full run; clip shows are left out, and two-parters are listed once
under their title.

Add your own in `assets/javascript/words.js` — each entry is `["Phrase", "categoryKey"]`.
Categories live in the same file: add a key with a `label` and a `color` and it shows up
as a filter chip automatically.

## Sound

The 24 clips in `assets/audio/` are the ones that shipped with the original build. They're
used two ways now:

- **Contextual** — solve a puzzle the game has on tape and you hear *that* line. Guess
  *These pretzels are making me thirsty* and the pretzels clip plays, not a random quip.
  The mapping is the `SIGNATURE` table in `game.js`.
- **Random** — everything else pulls from the wrong-guess pool (`sound1`) or the win pool
  (`sound2`).

Under that sits a **synthesised slap-bass layer** — pure Web Audio, no files. Correct
letters climb a pentatonic run as the puzzle fills in, wrong guesses land on a low thunk,
and wins get a five-note bass lick. On phones each of those is paired with a haptic tap.
All of it respects the mute button and `prefers-reduced-motion`.

**Adding clips:** drop an mp3 into `assets/audio/sound1/` (wrong guess) or `sound2/` (win),
add one line to the `CLIPS` manifest in `game.js`, and optionally map a phrase to it in
`SIGNATURE`. The test suite fails if a manifest entry has no file behind it, or if a
`SIGNATURE` phrase doesn't match a real puzzle.

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
- **Bigger bank** — 36 quotes → 491 puzzles in 6 categories, with no-repeat rotation
- **Scoreboard** — wins, losses, current and best streak, persisted locally
- **Hint system** — reveals a letter at the cost of one life
- **Sound handling** — clips load on demand instead of 24 eager `<audio>` tags, start
  behind a user gesture (modern browsers block autoplay), and can be muted
- **Accessibility** — live region for the puzzle, labelled controls, visible focus rings,
  `prefers-reduced-motion` support
- **Category filter** — play one category at a time; no-repeat rotation applies per pool
- **Bank progress** — a bar showing how far through the current pool you are
- **Contextual + synthesised audio** — signature clips on matching solves, a Web Audio
  slap-bass layer, and haptics on mobile (see *Sound* above)
- **Copy result** — a one-tap summary of the round for sharing

Bugs fixed along the way: the win sound retriggered on every keypress after a solve;
correct letters weren't tracked, so re-guessing one re-revealed it; the win check ran
before any guess was made; and the README's "8 wrong guesses" didn't match the code's 10.

## Tests

```bash
npm install   # jsdom, dev-only — the game itself ships with zero dependencies
npm test
```

55 assertions covering the win and loss paths, repeat-guess handling, hint cost, keyboard
state, gallows stages, persistence, and input lockout after a round ends — plus bank
integrity (no duplicate phrases, every category declared, all nine seasons present), the
audio manifest (every clip exists on disk, every signature phrase exists in the bank), and
category filtering. On top of that, a 500-round soak drives the puzzle bank past
exhaustion to confirm the no-repeat rotation resets cleanly instead of hanging.
