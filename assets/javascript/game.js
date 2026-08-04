/**
 * Seinfeld Hangman
 * A show about nothing. A game about guessing letters.
 */
(() => {
  "use strict";

  const MAX_WRONG = 8;
  const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
  const STORAGE_KEY = "seinfeld-hangman-v2";

  // ── Clip manifest ─────────────────────────────────────────────────────────
  // Filename → folder. Drop a new mp3 into assets/audio/sound1 (wrong guess) or
  // sound2 (win) and add one line here; everything else picks it up.
  const CLIPS = {
    bubble: "sound1", cantstandya: "sound1", contest: "sound1", dingo: "sound1",
    fakes: "sound1", getdown: "sound1", getout: "sound1", giddyup: "sound1",
    icare: "sound1", idiot: "sound1", jackass: "sound1", machine: "sound1",
    pirate: "sound1", pretzels: "sound1", rediculous: "sound1",

    reguifter: "sound2", risk: "sound2", serenity: "sound2", society: "sound2",
    switzerland: "sound2", thebro: "sound2", yada: "sound2", youstink: "sound2",
    seinfeld: "sound2",
  };

  const WRONG_SOUNDS = Object.keys(CLIPS).filter((n) => CLIPS[n] === "sound1");
  const WIN_SOUNDS = Object.keys(CLIPS)
    .filter((n) => CLIPS[n] === "sound2" && n !== "seinfeld"); // theme is the intro

  // Solve one of these and you hear the line itself, not a random quip.
  const SIGNATURE = {
    "these pretzels are making me thirsty": "pretzels",
    "maybe the dingo ate your baby": "dingo",
    "can't stand ya": "cantstandya",
    "the contest": "contest",
    "master of my domain": "contest",
    "are you still master of your domain": "contest",
    "i'm out": "contest",
    "get out": "getout",
    "giddy up": "giddyup",
    "i don't wanna be a pirate": "pirate",
    "the puffy shirt": "pirate",
    "puffy shirt": "pirate",
    "serenity now": "serenity",
    "the serenity now": "serenity",
    "serenity now insanity later": "serenity",
    "regifter": "reguifter",
    "risk": "risk",
    "we're living in a society": "society",
    "the bro": "thebro",
    "manssiere": "thebro",
    "yada yada yada": "yada",
    "the yada yada": "yada",
    "i yada yada'd sex": "yada",
    "you yada yada'd over the best part": "yada",
    "fake fake fake fake": "fakes",
    "the bubble boy": "bubble",
    "it's moops": "bubble",
    "the card says moops": "bubble",
    "moops": "bubble",
    "the fire": "youstink",
    "i choose not to run": "youstink",
  };

  // ── Element handles ───────────────────────────────────────────────────────
  const el = {
    start: document.getElementById("start"),
    startBtn: document.getElementById("startBtn"),
    cats: document.getElementById("cats"),
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
    filterBtn: document.getElementById("filterBtn"),
    bankBar: document.getElementById("bankBar"),
    bankText: document.getElementById("bankText"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalWord: document.getElementById("modalWord"),
    modalNote: document.getElementById("modalNote"),
    nextBtn: document.getElementById("nextBtn"),
    shareBtn: document.getElementById("shareBtn"),
    figure: document.getElementById("figure"),
    board: document.querySelector(".board"),
  };

  // ── Persisted state ───────────────────────────────────────────────────────
  const defaults = {
    wins: 0, losses: 0, streak: 0, best: 0,
    sound: true, seen: [], filter: "all",
  };
  let store = load();

  function load() {
    try {
      const s = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
      // A stale filter (or a bank edit) shouldn't strand the player on an empty pool.
      if (s.filter !== "all" && !CATEGORIES[s.filter]) s.filter = "all";
      if (!Array.isArray(s.seen)) s.seen = [];
      s.seen = s.seen.filter((i) => Number.isInteger(i) && i >= 0 && i < PUZZLES.length);
      return s;
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
  let lastWon = false;
  let started = false;
  let roundFilter = null; // filter the current round was drawn under

  // ── Audio: recorded clips ─────────────────────────────────────────────────
  const audioCache = new Map();
  let currentClip = null;

  function play(name, folder) {
    if (!store.sound) return;
    const dir = folder || CLIPS[name];
    if (!dir) return;
    let clip = audioCache.get(name);
    if (!clip) {
      clip = new Audio(`assets/audio/${dir}/${name}.mp3`);
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

  // ── Audio: synthesised slap bass ──────────────────────────────────────────
  // No sample files involved — pure Web Audio, so it works even before the
  // clips load and adds punch under every keypress.
  let ctx = null;
  function audioCtx() {
    if (ctx !== null) return ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return (ctx = false);
    try {
      ctx = new Ctx();
    } catch {
      ctx = false;
    }
    return ctx;
  }

  /** One plucked note: sawtooth through a swept lowpass, short decay. */
  function note(freq, at, dur, gain, type) {
    const ac = audioCtx();
    if (!ac) return;
    const t = ac.currentTime + at;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    const lp = ac.createBiquadFilter();

    osc.type = type || "sawtooth";
    osc.frequency.setValueAtTime(freq, t);

    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.max(400, freq * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.6), t + dur);
    lp.Q.value = 6; // the honk that makes it read as a bass

    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(lp).connect(amp).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const sfx = {
    hit(revealed) {
      if (!store.sound) return;
      // Climbs a pentatonic run as more of the puzzle falls into place.
      const steps = [0, 3, 5, 7, 10, 12, 15, 17];
      const semis = steps[Math.min(revealed, steps.length - 1)];
      note(98 * Math.pow(2, semis / 12), 0, 0.14, 0.09);
    },
    miss() {
      if (!store.sound) return;
      note(73.4, 0, 0.22, 0.11);
      note(69.3, 0.05, 0.18, 0.07);
    },
    win() {
      if (!store.sound) return;
      [[98, 0], [116.5, 0.09], [130.8, 0.18], [155.6, 0.27], [196, 0.36]]
        .forEach(([f, at]) => note(f, at, 0.16, 0.1));
      note(196, 0.5, 0.4, 0.08, "triangle");
    },
    lose() {
      if (!store.sound) return;
      [[110, 0], [98, 0.12], [87.3, 0.24], [65.4, 0.4]]
        .forEach(([f, at]) => note(f, at, 0.3, 0.1));
    },
    tick() {
      if (!store.sound) return;
      note(880, 0, 0.03, 0.02, "square");
    },
  };

  /** Browsers hand out audio only after a gesture — start button counts. */
  function unlockAudio() {
    const ac = audioCtx();
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  }

  const buzz = (pattern) => {
    if (!store.sound) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      /* unsupported — no big deal */
    }
  };

  const reducedMotion = () => {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      return false;
    }
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ── Puzzle selection ──────────────────────────────────────────────────────
  /** Indices matching the active category filter. */
  function poolIndices() {
    const f = store.filter;
    const pool = [];
    for (let i = 0; i < PUZZLES.length; i++) {
      if (f === "all" || PUZZLES[i][1] === f) pool.push(i);
    }
    return pool;
  }

  /** Avoid repeats until the active pool is exhausted, then reshuffle it. */
  function nextPuzzle() {
    let pool = poolIndices();
    if (!pool.length) {           // filter points at nothing — fall back to everything
      store.filter = "all";
      pool = poolIndices();
    }

    const seen = new Set(store.seen);
    let unseen = pool.filter((i) => !seen.has(i));
    if (!unseen.length) {         // cycle complete: forget this pool, keep the rest
      const inPool = new Set(pool);
      store.seen = store.seen.filter((i) => !inPool.has(i));
      unseen = pool;
    }

    const allowed = new Set(unseen);
    let idx;
    do {
      idx = Math.floor(Math.random() * PUZZLES.length);
    } while (!allowed.has(idx));

    store.seen.push(idx);
    roundFilter = store.filter;
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

  /** How much of the current pool the player has worked through. */
  function renderBank() {
    if (!el.bankBar) return;
    const pool = poolIndices();
    const seen = new Set(store.seen);
    const done = pool.filter((i) => seen.has(i)).length;
    const label = store.filter === "all" ? "puzzles" : CATEGORIES[store.filter].label;
    el.bankBar.style.width = `${pool.length ? (done / pool.length) * 100 : 0}%`;
    el.bankText.textContent = `${done} / ${pool.length} ${label.toLowerCase()}`;
    el.bankText.parentElement.setAttribute(
      "aria-label", `Bank progress: ${done} of ${pool.length} ${label} seen`
    );
  }

  function renderFilterBtn() {
    if (!el.filterBtn) return;
    const all = store.filter === "all";
    const label = all ? "All" : CATEGORIES[store.filter].label;
    el.filterBtn.textContent = label;
    el.filterBtn.style.setProperty("--chip", all ? "var(--muted)" : CATEGORIES[store.filter].color);
    el.filterBtn.setAttribute("aria-label", `Category: ${label}. Change category`);
  }

  function renderAll() {
    renderWord();
    renderFigure();
    renderKeyboard();
    renderStats();
    renderBank();
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
    if (el.shareBtn) el.shareBtn.textContent = "Copy result";
    renderAll();
  }

  function solved() {
    return [...answer]
      .filter(isLetter)
      .every((ch) => guessed.has(ch.toLowerCase()));
  }

  function revealedCount() {
    return [...new Set([...answer].filter(isLetter).map((c) => c.toLowerCase()))]
      .filter((c) => guessed.has(c)).length;
  }

  function shake() {
    if (!el.board || reducedMotion()) return;
    el.board.classList.remove("shake");
    void el.board.offsetWidth; // restart the animation
    el.board.classList.add("shake");
  }

  function guess(letter) {
    if (over || guessed.has(letter) || !isLetter(letter)) return;
    guessed.add(letter);

    const hit = answer.toLowerCase().includes(letter);
    if (hit) {
      sfx.hit(revealedCount());
      buzz(12);
    } else {
      wrong++;
      sfx.miss();
      buzz(35);
      shake();
      play(pick(WRONG_SOUNDS), "sound1");
    }

    renderAll();

    if (solved()) finish(true);
    else if (wrong >= MAX_WRONG) finish(false);
  }

  function finish(won) {
    over = true;
    lastWon = won;
    if (won) {
      store.wins++;
      store.streak++;
      store.best = Math.max(store.best, store.streak);
      sfx.win();
      buzz([18, 55, 18]);
      // The line itself if we have it on tape, otherwise a random quip.
      play(SIGNATURE[answer.toLowerCase()] || pick(WIN_SOUNDS));
    } else {
      store.losses++;
      store.streak = 0;
      sfx.lose();
      buzz([60, 45, 120]);
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
    sfx.tick();
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

  // ── Category filter ───────────────────────────────────────────────────────
  function buildFilters() {
    if (!el.cats) return;
    const counts = { all: PUZZLES.length };
    PUZZLES.forEach(([, key]) => { counts[key] = (counts[key] || 0) + 1; });

    const options = [["all", "All"], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])];
    options.forEach(([key, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat";
      btn.dataset.filter = key;
      if (key !== "all") btn.style.setProperty("--chip", CATEGORIES[key].color);
      btn.innerHTML = `${label}<span class="cat-n">${counts[key] || 0}</span>`;
      btn.addEventListener("click", () => {
        store.filter = key;
        save();
        syncFilters();
        renderBank();
        renderFilterBtn();
      });
      el.cats.appendChild(btn);
    });
    syncFilters();
  }

  function syncFilters() {
    if (!el.cats) return;
    el.cats.querySelectorAll(".cat").forEach((btn) => {
      const on = btn.dataset.filter === store.filter;
      btn.classList.toggle("cat--on", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

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
    if (store.sound) sfx.tick();
  });

  if (el.filterBtn) el.filterBtn.addEventListener("click", openStart);

  if (el.shareBtn) {
    el.shareBtn.addEventListener("click", () => {
      const text =
        `Seinfeld Hangman — ${answer}\n` +
        `${CATEGORIES[categoryKey].label} · ${lastWon ? "solved" : "no soup"} ` +
        `with ${MAX_WRONG - wrong} lives left\n` +
        `streak ${store.streak} · best ${store.best} · ${store.wins}W ${store.losses}L`;
      const done = () => {
        el.shareBtn.textContent = "Copied!";
        setTimeout(() => { el.shareBtn.textContent = "Copy result"; }, 1400);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, () => {});
        }
      } catch {
        /* no clipboard access — the button just does nothing */
      }
    });
  }

  function syncSoundBtn() {
    el.soundBtn.textContent = store.sound ? "🔊" : "🔇";
    el.soundBtn.setAttribute(
      "aria-label",
      store.sound ? "Mute sound effects" : "Unmute sound effects"
    );
    el.soundBtn.setAttribute("aria-pressed", String(!store.sound));
  }

  function openStart() {
    syncFilters();
    renderBank();
    el.startBtn.textContent = started && !over ? "Back to the game" : "Start playing";
    el.start.classList.add("show");
    el.start.setAttribute("aria-hidden", "false");
    setTimeout(() => el.startBtn.focus(), 50);
  }

  function begin() {
    el.start.classList.remove("show");
    el.start.setAttribute("aria-hidden", "true");
    el.game.removeAttribute("aria-hidden");
    unlockAudio();

    const first = !started;
    started = true;
    // The theme doubles as the gesture that unlocks audio on mobile — but only
    // on the first go, not every time the category sheet is dismissed.
    if (first) play("seinfeld", "sound2");
    if (first || over || store.filter !== roundFilter) newRound();
    else renderAll();
  }

  el.startBtn.addEventListener("click", begin);

  // ── Boot ──────────────────────────────────────────────────────────────────
  buildFilters();
  syncSoundBtn();
  renderFilterBtn();
  renderStats();
  renderBank();
  el.start.classList.add("show");
})();
