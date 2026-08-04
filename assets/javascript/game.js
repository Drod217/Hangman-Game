/**
 * Seinfeld Hangman
 * A show about nothing. A game about guessing letters.
 */
(() => {
  "use strict";

  const MAX_WRONG = 8;
  const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
  const STORAGE_KEY = "seinfeld-hangman-v2";

  const WRONG_SOUNDS = [
    "bubble", "cantstandya", "contest", "dingo", "fakes", "getdown", "getout",
    "giddyup", "icare", "idiot", "jackass", "machine", "pirate", "pretzels",
    "rediculous",
  ];
  const WIN_SOUNDS = [
    "reguifter", "risk", "serenity", "society", "switzerland", "thebro",
    "yada", "youstink",
  ];

  // ── Element handles ───────────────────────────────────────────────────────
  const el = {
    start: document.getElementById("start"),
    startBtn: document.getElementById("startBtn"),
    game: document.getElementById("game"),
    word: document.getElementById("word"),
    category: document.getElementById("category"),
    keyboard: document.getElementById("keyboard"),
    lives: document.getElementById("lives"),
    wins: document.getElementById("wins"),
    losses: document.getElementById("losses"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    hintBtn: document.getElementById("hintBtn"),
    soundBtn: document.getElementById("soundBtn"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalWord: document.getElementById("modalWord"),
    modalNote: document.getElementById("modalNote"),
    nextBtn: document.getElementById("nextBtn"),
    figure: document.getElementById("figure"),
  };

  // ── Persisted state ───────────────────────────────────────────────────────
  const defaults = { wins: 0, losses: 0, streak: 0, best: 0, sound: true, seen: [] };
  let store = load();

  function load() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...defaults };
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* private browsing — scores just won't persist */
    }
  }

  // ── Round state ───────────────────────────────────────────────────────────
  let answer = "";
  let categoryKey = "";
  let guessed = new Set();
  let wrong = 0;
  let over = true;
  let hintUsed = false;

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audioCache = new Map();
  let currentClip = null;

  function play(name, folder) {
    if (!store.sound) return;
    let clip = audioCache.get(name);
    if (!clip) {
      clip = new Audio(`assets/audio/${folder}/${name}.mp3`);
      audioCache.set(name, clip);
    }
    // Only one Seinfeld quip at a time — overlapping clips are chaos.
    if (currentClip && currentClip !== clip) {
      currentClip.pause();
      currentClip.currentTime = 0;
    }
    clip.currentTime = 0;
    clip.play().catch(() => {
      /* autoplay policy or missing file — silence is fine */
    });
    currentClip = clip;
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ── Puzzle selection ──────────────────────────────────────────────────────
  /** Avoid repeats until the bank is exhausted, then reshuffle. */
  function nextPuzzle() {
    if (store.seen.length >= PUZZLES.length) store.seen = [];
    let idx;
    do {
      idx = Math.floor(Math.random() * PUZZLES.length);
    } while (store.seen.includes(idx));
    store.seen.push(idx);
    save();
    return PUZZLES[idx];
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  const isLetter = (ch) => ALPHABET.includes(ch.toLowerCase());

  function renderWord() {
    el.word.innerHTML = "";
    // Split on spaces so long phrases wrap by word, never mid-word.
    answer.split(" ").forEach((chunk) => {
      const group = document.createElement("span");
      group.className = "word-group";
      [...chunk].forEach((ch) => {
        const tile = document.createElement("span");
        if (isLetter(ch)) {
          const hit = guessed.has(ch.toLowerCase());
          tile.className = `tile${hit ? " tile--filled" : ""}`;
          tile.textContent = hit ? ch : "";
        } else {
          tile.className = "tile tile--punct";
          tile.textContent = ch;
        }
        group.appendChild(tile);
      });
      el.word.appendChild(group);
    });

    const shown = answer
      .split("")
      .map((ch) => (!isLetter(ch) || guessed.has(ch.toLowerCase()) ? ch : "blank"))
      .join(" ");
    el.word.setAttribute("aria-label", `Puzzle: ${shown}`);
  }

  function renderFigure() {
    el.figure.querySelectorAll("[data-stage]").forEach((part) => {
      part.classList.toggle("show", Number(part.dataset.stage) <= wrong);
    });
  }

  function renderKeyboard() {
    el.keyboard.querySelectorAll("button").forEach((btn) => {
      const letter = btn.dataset.key;
      btn.classList.remove("key--hit", "key--miss");
      const used = guessed.has(letter);
      btn.disabled = used || over;
      if (used) {
        btn.classList.add(
          answer.toLowerCase().includes(letter) ? "key--hit" : "key--miss"
        );
      }
    });
  }

  function renderStats() {
    el.lives.textContent = MAX_WRONG - wrong;
    el.lives.classList.toggle("danger", MAX_WRONG - wrong <= 2);
    el.wins.textContent = store.wins;
    el.losses.textContent = store.losses;
    el.streak.textContent = store.streak;
    el.best.textContent = store.best;
  }

  function renderAll() {
    renderWord();
    renderFigure();
    renderKeyboard();
    renderStats();
    el.hintBtn.disabled = over || hintUsed || MAX_WRONG - wrong <= 1;
  }

  // ── Round flow ────────────────────────────────────────────────────────────
  function newRound() {
    const [phrase, key] = nextPuzzle();
    answer = phrase;
    categoryKey = key;
    guessed = new Set();
    wrong = 0;
    over = false;
    hintUsed = false;

    el.category.textContent = CATEGORIES[key].label;
    el.category.style.setProperty("--chip", CATEGORIES[key].color);
    el.modal.classList.remove("show");
    el.modal.setAttribute("aria-hidden", "true");
    renderAll();
  }

  function solved() {
    return [...answer]
      .filter(isLetter)
      .every((ch) => guessed.has(ch.toLowerCase()));
  }

  function guess(letter) {
    if (over || guessed.has(letter) || !isLetter(letter)) return;
    guessed.add(letter);

    const hit = answer.toLowerCase().includes(letter);
    if (!hit) {
      wrong++;
      play(pick(WRONG_SOUNDS), "sound1");
    }

    renderAll();

    if (solved()) finish(true);
    else if (wrong >= MAX_WRONG) finish(false);
  }

  function finish(won) {
    over = true;
    if (won) {
      store.wins++;
      store.streak++;
      store.best = Math.max(store.best, store.streak);
      play(pick(WIN_SOUNDS), "sound2");
    } else {
      store.losses++;
      store.streak = 0;
      guessed = new Set(ALPHABET); // reveal the answer
      renderWord();
    }
    save();
    renderAll();

    el.modalTitle.textContent = won ? "Giddy up!" : "No soup for you.";
    el.modalTitle.className = won ? "won" : "lost";
    el.modalWord.textContent = answer;
    el.modalNote.textContent = won
      ? `${CATEGORIES[categoryKey].label} · streak ${store.streak}`
      : `${CATEGORIES[categoryKey].label} · that's a shame`;

    el.modal.classList.add("show");
    el.modal.setAttribute("aria-hidden", "false");
    setTimeout(() => el.nextBtn.focus(), 50);
  }

  function useHint() {
    if (over || hintUsed) return;
    const remaining = [...new Set(
      [...answer].filter(isLetter).map((c) => c.toLowerCase())
    )].filter((c) => !guessed.has(c));
    if (!remaining.length) return;

    hintUsed = true;
    wrong++; // a hint costs you a limb
    guessed.add(pick(remaining));
    renderAll();

    if (solved()) finish(true);
    else if (wrong >= MAX_WRONG) finish(false);
  }

  // ── Keyboard build ────────────────────────────────────────────────────────
  ["qwertyuiop", "asdfghjkl", "zxcvbnm"].forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    [...row].forEach((letter) => {
      const btn = document.createElement("button");
      btn.className = "key";
      btn.type = "button";
      btn.dataset.key = letter;
      btn.textContent = letter;
      btn.setAttribute("aria-label", `Guess ${letter}`);
      btn.addEventListener("click", () => guess(letter));
      rowEl.appendChild(btn);
    });
    el.keyboard.appendChild(rowEl);
  });

  // ── Wiring ────────────────────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (el.start.classList.contains("show")) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); begin(); }
      return;
    }
    if (over) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); newRound(); }
      return;
    }
    if (e.key === "?") { useHint(); return; }
    const k = e.key.toLowerCase();
    if (isLetter(k)) guess(k);
  });

  el.nextBtn.addEventListener("click", newRound);
  el.hintBtn.addEventListener("click", useHint);

  el.soundBtn.addEventListener("click", () => {
    store.sound = !store.sound;
    save();
    syncSoundBtn();
    if (!store.sound && currentClip) currentClip.pause();
  });

  function syncSoundBtn() {
    el.soundBtn.textContent = store.sound ? "🔊" : "🔇";
    el.soundBtn.setAttribute(
      "aria-label",
      store.sound ? "Mute sound effects" : "Unmute sound effects"
    );
    el.soundBtn.setAttribute("aria-pressed", String(!store.sound));
  }

  function begin() {
    el.start.classList.remove("show");
    el.start.setAttribute("aria-hidden", "true");
    el.game.removeAttribute("aria-hidden");
    // The theme doubles as the gesture that unlocks audio on mobile.
    play("seinfeld", "sound2");
    newRound();
  }

  el.startBtn.addEventListener("click", begin);

  // ── Boot ──────────────────────────────────────────────────────────────────
  syncSoundBtn();
  renderStats();
  el.start.classList.add("show");
})();
