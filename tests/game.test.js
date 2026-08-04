const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');

const dom = new JSDOM(fs.readFileSync(ROOT + '/index.html', 'utf8'), {
  runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:8765/'
});
const { window } = dom;
window.Audio = class { play(){return Promise.resolve();} pause(){} set currentTime(v){} };

// Single eval so top-level const is shared, matching two <script> tags in a browser.
window.eval(
  fs.readFileSync(ROOT + '/assets/javascript/words.js', 'utf8') + '\n' +
  fs.readFileSync(ROOT + '/assets/javascript/game.js', 'utf8')
);

const d = window.document;
const $ = (id) => d.getElementById(id);
const press = (k) => d.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
const shown = () => [...$('word').querySelectorAll('.tile:not(.tile--punct)')]
  .filter(t => t.textContent.trim()).length;
const blanks = () => [...$('word').querySelectorAll('.tile:not(.tile--punct)')]
  .filter(t => !t.textContent.trim()).length;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)); };

// Deterministic puzzle selection
const PUZZLES = new Function(fs.readFileSync(ROOT + '/assets/javascript/words.js','utf8') + '\n; return PUZZLES;')();
let forced = null;
const real = Math.random;
window.Math.random = () => forced === null ? real() : forced / PUZZLES.length + 1e-9;
const letters = (s) => [...new Set(s.toLowerCase().split('').filter(c => c >= 'a' && c <= 'z'))];
const notIn = (s) => 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => !s.toLowerCase().includes(c));

console.log('\n[boot]');
ok($('start').classList.contains('show'), 'start overlay visible on boot');
ok(d.querySelectorAll('#keyboard .key').length === 26, '26 keys built');
ok($('game').getAttribute('aria-hidden') === 'true', 'game hidden behind start gate');

forced = 0;
$('startBtn').click();
console.log('\n[round starts]');
ok(!$('start').classList.contains('show'), 'start overlay dismissed');
ok($('game').getAttribute('aria-hidden') === null, 'game revealed');
ok($('word').querySelectorAll('.tile').length === PUZZLES[0][0].replace(/ /g,'').length, 'one tile per non-space character');
ok($('category').textContent.length > 0, 'category chip populated');
ok(Number($('lives').textContent) === 8, 'lives start at 8');

console.log('\n[win path]');
const ans0 = PUZZLES[0][0];
letters(ans0).forEach(press);
ok($('modal').classList.contains('show'), 'modal opens on completion');
ok($('modalTitle').classList.contains('won'), `won "${ans0}" with only correct letters`);
ok(blanks() === 0, 'no blanks remain');
ok(Number($('lives').textContent) === 8, 'no lives lost on a clean win');
ok(Number($('wins').textContent) === 1, 'wins = 1');
ok(Number($('streak').textContent) === 1, 'streak = 1');
ok(Number($('best').textContent) === 1, 'best = 1');

console.log('\n[loss path]');
forced = 1;
$('nextBtn').click();
const ans1 = PUZZLES[1][0];
const misses = notIn(ans1).slice(0, 8);
ok(misses.length === 8, 'found 8 letters absent from the answer');
misses.forEach(press);
ok($('modal').classList.contains('show'), 'modal opens on loss');
ok($('modalTitle').classList.contains('lost'), `lost "${ans1}" after 8 misses`);
ok($('modalWord').textContent === ans1, 'answer revealed in modal');
ok(blanks() === 0, 'full answer revealed on the board');
ok(Number($('lives').textContent) === 0, 'lives = 0');
ok(Number($('losses').textContent) === 1, 'losses = 1');
ok(Number($('streak').textContent) === 0, 'streak reset');
ok(Number($('best').textContent) === 1, 'best preserved after loss');
ok(d.querySelectorAll('#figure [data-stage].show').length === 8, 'all 8 gallows stages drawn');

console.log('\n[repeat guesses do not double-penalise]');
forced = 2;
$('nextBtn').click();
const ans2 = PUZZLES[2][0];
const miss = notIn(ans2)[0];
press(miss); const afterFirst = Number($('lives').textContent);
press(miss); press(miss);
ok(Number($('lives').textContent) === afterFirst, 'repeating a wrong letter costs nothing extra');
const hit = letters(ans2)[0];
press(hit); const revealed = shown();
press(hit);
ok(shown() === revealed, 'repeating a correct letter is a no-op');

console.log('\n[keyboard state]');
const hitKey = d.querySelector(`[data-key="${hit}"]`);
const missKey = d.querySelector(`[data-key="${miss}"]`);
ok(hitKey.disabled && missKey.disabled, 'guessed keys disabled');
ok(hitKey.classList.contains('key--hit'), 'correct key marked hit');
ok(missKey.classList.contains('key--miss'), 'wrong key marked miss');
ok(!d.querySelector('[data-key="z"]').disabled || 'z' === hit || 'z' === miss, 'unguessed keys stay live');

console.log('\n[hint]');
forced = 3;
$('nextBtn').click();
const b4 = shown(), lives4 = Number($('lives').textContent);
$('hintBtn').click();
ok(shown() > b4, 'hint reveals at least one letter');
ok(Number($('lives').textContent) === lives4 - 1, 'hint costs exactly one life');
ok($('hintBtn').disabled, 'hint disabled after use');

console.log('\n[input ignored after round ends]');
forced = 4;
$('nextBtn').click();
const ans4 = PUZZLES[4][0];
notIn(ans4).slice(0, 8).forEach(press);
const livesAtEnd = Number($('lives').textContent);
'abcdefghijklm'.split('').forEach(press);
ok(Number($('lives').textContent) === livesAtEnd, 'keypresses ignored once the round is over');

console.log('\n[persistence]');
const saved = JSON.parse(window.localStorage.getItem('seinfeld-hangman-v2'));
ok(saved && saved.wins === Number($('wins').textContent), 'wins persisted to localStorage');
ok(Array.isArray(saved.seen) && saved.seen.length > 0, 'seen-puzzle history persisted');

console.log('\n[sound toggle]');
const s0 = JSON.parse(window.localStorage.getItem('seinfeld-hangman-v2')).sound;
$('soundBtn').click();
const s1 = JSON.parse(window.localStorage.getItem('seinfeld-hangman-v2')).sound;
ok(s0 !== s1, 'sound toggle flips and persists');
ok($('soundBtn').textContent === (s1 ? '\u{1F50A}' : '\u{1F507}'), 'sound icon reflects state');

console.log('\n[no-repeat until bank exhausted]');
forced = null;
window.localStorage.clear();
const fresh = new JSDOM(fs.readFileSync(ROOT + '/index.html', 'utf8'),
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:8765/' });
fresh.window.Audio = window.Audio;
fresh.window.eval(
  fs.readFileSync(ROOT + '/assets/javascript/words.js', 'utf8') + '\n' +
  fs.readFileSync(ROOT + '/assets/javascript/game.js', 'utf8'));
const fd = fresh.window.document;
fd.getElementById('startBtn').click();
const seenWords = [];
for (let i = 0; i < 60; i++) {
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(c =>
    fd.dispatchEvent(new fresh.window.KeyboardEvent('keydown', { key: c, bubbles: true })));
  seenWords.push(fd.getElementById('modalWord').textContent);   // revealed answer, win or lose
  fd.getElementById('nextBtn').click();
}
ok(new Set(seenWords).size === 60, `60 consecutive rounds, ${new Set(seenWords).size} distinct answers (no repeats)`);

console.log('\n[puzzle bank integrity]');
const CATEGORIES = new Function(fs.readFileSync(ROOT + '/assets/javascript/words.js','utf8') + '\n; return CATEGORIES;')();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const dupes = [];
const bankSeen = new Map();
PUZZLES.forEach(([p]) => {
  const k = norm(p);
  if (bankSeen.has(k)) dupes.push(p); else bankSeen.set(k, p);
});
ok(dupes.length === 0, `no duplicate phrases (${PUZZLES.length} puzzles)` + (dupes.length ? ` — ${dupes}` : ''));
ok(PUZZLES.every(([, c]) => CATEGORIES[c]), 'every puzzle uses a declared category');
ok(PUZZLES.every(([p]) => /[a-z]/i.test(p)), 'every puzzle has at least one guessable letter');
ok(PUZZLES.every(([p]) => p === p.trim() && !/\s\s/.test(p)), 'no stray or doubled whitespace');
const epCount = PUZZLES.filter(([, c]) => c === 'episode').length;
ok(epCount >= 169, `all nine seasons of episodes present (${epCount})`);

console.log('\n[audio manifest]');
const gameSrc = fs.readFileSync(ROOT + '/assets/javascript/game.js', 'utf8');
const grab = (name) => new Function('return ' + gameSrc.match(new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\n  \\});'))[1])();
const CLIPS = grab('CLIPS'), SIGNATURE = grab('SIGNATURE');
const missingFiles = Object.entries(CLIPS)
  .filter(([n, dir]) => !fs.existsSync(`${ROOT}/assets/audio/${dir}/${n}.mp3`)).map(([n]) => n);
ok(missingFiles.length === 0, `every manifest clip exists on disk (${Object.keys(CLIPS).length})` + (missingFiles.length ? ` — missing ${missingFiles}` : ''));
const orphanClips = [...new Set(Object.values(SIGNATURE))].filter((c) => !CLIPS[c]);
ok(orphanClips.length === 0, 'signature clips are all in the manifest' + (orphanClips.length ? ` — ${orphanClips}` : ''));
const bankLower = new Set(PUZZLES.map(([p]) => p.toLowerCase()));
const orphanPhrases = Object.keys(SIGNATURE).filter((p) => !bankLower.has(p));
ok(orphanPhrases.length === 0, `signature phrases all exist in the bank (${Object.keys(SIGNATURE).length})` + (orphanPhrases.length ? ` — ${orphanPhrases}` : ''));

console.log('\n[category filter]');
const fresh2 = new JSDOM(fs.readFileSync(ROOT + '/index.html', 'utf8'),
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:8765/' });
fresh2.window.Audio = window.Audio;
fresh2.window.localStorage.clear();
fresh2.window.eval(
  fs.readFileSync(ROOT + '/assets/javascript/words.js', 'utf8') + '\n' +
  fs.readFileSync(ROOT + '/assets/javascript/game.js', 'utf8'));
const f2 = fresh2.window.document;
ok(f2.querySelectorAll('#cats .cat').length === Object.keys(CATEGORIES).length + 1, 'a chip per category, plus All');
const mediaCount = PUZZLES.filter(([, c]) => c === 'media').length;
f2.querySelector('[data-filter="media"]').click();
ok(f2.querySelector('[data-filter="media"]').classList.contains('cat--on'), 'chosen category chip marked active');
ok(f2.getElementById('filterBtn').textContent === CATEGORIES.media.label, 'topbar reflects the chosen category');
f2.getElementById('startBtn').click();
const drawn = [];
for (let i = 0; i < mediaCount + 3; i++) {
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(c =>
    f2.dispatchEvent(new fresh2.window.KeyboardEvent('keydown', { key: c, bubbles: true })));
  drawn.push(f2.getElementById('modalWord').textContent);
  f2.getElementById('nextBtn').click();
}
const mediaPhrases = new Set(PUZZLES.filter(([, c]) => c === 'media').map(([p]) => p));
ok(drawn.every(a => mediaPhrases.has(a)), `filtered rounds only draw from that category (${drawn.length} rounds)`);
ok(new Set(drawn.slice(0, mediaCount)).size === mediaCount, `no repeats within the ${mediaCount}-puzzle pool`);
ok(drawn.length > mediaCount, 'pool recycles instead of hanging once exhausted');
ok(/\d+ \/ \d+/.test(f2.getElementById('bankText').textContent), 'bank progress renders');

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
