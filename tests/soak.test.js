const { JSDOM } = require('jsdom'); const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(ROOT+'/index.html','utf8'),
  { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost:8765/' });
dom.window.Audio = class { play(){return Promise.resolve();} pause(){} set currentTime(v){} };
dom.window.eval(fs.readFileSync(ROOT+'/assets/javascript/words.js','utf8')+'\n'+
                fs.readFileSync(ROOT+'/assets/javascript/game.js','utf8'));
const d = dom.window.document, N = 500;
const t0 = Date.now();
d.getElementById('startBtn').click();
const answers = [];
for (let i=0;i<N;i++){
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(c =>
    d.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:c,bubbles:true})));
  if(!d.getElementById('modal').classList.contains('show')) { console.log('HANG at round',i); process.exit(1); }
  answers.push(d.getElementById('modalWord').textContent);
  d.getElementById('nextBtn').click();
}
const bank = new Function(fs.readFileSync(ROOT+'/assets/javascript/words.js','utf8')+'\n; return PUZZLES;')();
console.log(`${N} rounds in ${Date.now()-t0}ms — no hang across bank exhaustion`);
console.log('bank size:', bank.length, '| distinct answers seen:', new Set(answers).size);
// Within any window of `bank.length` consecutive rounds, expect no repeat.
// Guarantee is per-cycle: the seen-list resets once the bank is exhausted.
for (let c=0; (c+1)*bank.length<=N; c++){
  const cycle = answers.slice(c*bank.length,(c+1)*bank.length);
  console.log(`cycle ${c+1}: ${new Set(cycle).size}/${bank.length} distinct ${new Set(cycle).size===bank.length?'✓':'✗'}`);
}
const saved = JSON.parse(dom.window.localStorage.getItem('seinfeld-hangman-v2'));
console.log('final: wins', saved.wins, 'losses', saved.losses, 'best streak', saved.best, '| seen list size', saved.seen.length);
