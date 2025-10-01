(() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // Controls
  const nameEl   = $('#studentName');
  const modeEl   = $('#mode');                 // << uses your Mode selector
  const qCountEl = $('#questionCount');
  const minsEl   = $('#minutes');
  const startBtn = $('#startBtn');
  const timerEl  = $('#timer');

  // Quiz / Results / Cert
  const quizEl   = $('#quiz');
  const qListEl  = $('#qList');
  const submitBtn= $('#submitBtn');
  const restartBtn = $('#restartBtn');
  const resultEl = $('#result');
  const scoreLine= $('#scoreLine');
  const detailLine= $('#detailLine');
  const certUnlock = $('#certUnlock');
  const showCertBtn= $('#showCertBtn');

  const certSection = $('#certificate');
  const certSvg     = $('#certSvg');
  const certName    = $('#certName');
  const certScore   = $('#certScore');
  const certDate    = $('#certDate');
  const printBtn    = $('#printCertBtn');
  const dlPngBtn    = $('#downloadPngBtn');
  const closeCertBtn= $('#closeCertBtn');

  $('#yr').textContent = new Date().getFullYear();

  // Config
  const PASS_PCT     = 80;
  const MCQ_CHOICES  = 5;                     // A–E
  const LETTERS      = ['A','B','C','D','E'];

  // State
  let questions = []; // [{expr, val, options?: number[]}]
  let remaining = 0;
  let timerId   = null;
  let finished  = false;

  // ---------- Helpers ----------
  const randInt = (min, max) => Math.floor(Math.random()*(max-min+1))+min;

  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  function makeDivisionPair(){
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    return [a*b, a]; // dividend, divisor → quotient = b
  }

  function makeExpression(){
    const pick = randInt(1, 7);
    let expr = '';
    let val  = 0;

    const a = randInt(6, 99), b = randInt(2, 25), c = randInt(2, 25), d = randInt(2, 25);

    switch(pick){
      case 1: expr = `(${a} + ${b}) × ${c}`; val = (a + b) * c; break;
      case 2: expr = `${a} + ${b} × ${c}`;   val = a + (b * c); break;
      case 3:{
        const [, divisor] = makeDivisionPair();
        let A = a, left = A - b;
        if (left % divisor !== 0){
          const rem = ((left % divisor) + divisor) % divisor;
          let newA = A - rem;
          if (newA - b <= 0) newA += divisor;
          A = newA; left = A - b;
        }
        expr = `(${A} − ${b}) ÷ ${divisor}`;
        val  = left / divisor;
        break;
      }
      case 4: expr = `${a} × (${b} + ${c})`; val = a * (b + c); break;
      case 5: expr = `${a} − ${b} + ${c} × ${d}`; val = a - b + (c * d); break;
      case 6:{
        const c2 = Math.max(c, d), d2 = Math.min(c, d);
        expr = `(${a} + ${b}) × (${c2} − ${d2})`;
        val  = (a + b) * (c2 - d2);
        break;
      }
      case 7:{
        const [dividend, divisor] = makeDivisionPair();
        const z = randInt(2, 50);
        expr = `(${dividend} ÷ ${divisor}) + ${z}`;
        val  = (dividend / divisor) + z;
        break;
      }
    }
    return { expr: expr.replace(/\*/g,'×').replace(/\//g,'÷'), val };
  }

  // Build 4 distractors + 1 correct; include near-miss/ops traps
  function buildOptions(correct){
    const set = new Set([correct]);
    const offsets = [1,2,3,4,5,6,7,8,9,10,12,15,20,25];

    // one near miss
    set.add(Math.max(0, correct + (Math.random()<0.5?-1:1)*randInt(1,3)));
    // one bigger jump
    set.add(Math.max(0, correct + (Math.random()<0.5?-1:1)*randInt(4,10)));
    // factor-ish or multiple-ish
    if (correct > 0){
      const k = [2,3,4][randInt(0,2)];
      set.add(correct * k);
    }
    // random offset fillers
    while (set.size < MCQ_CHOICES){
      const off  = offsets[randInt(0, offsets.length-1)] * (Math.random()<0.5?-1:1);
      const cand = Math.max(0, correct + off);
      set.add(cand);
    }

    // ensure exactly MCQ_CHOICES
    const arr = [...set];
    // keep the correct, trim extras if overshot
    if (arr.length > MCQ_CHOICES){
      const idx = arr.indexOf(correct);
      arr.splice(idx,1); // remove correct
      while (arr.length > (MCQ_CHOICES - 1)) arr.pop();
      arr.push(correct);
    }
    return shuffle(arr);
  }

  function generatePaper(n, mode){
    const unique = new Set();
    questions = [];
    while (questions.length < n){
      const {expr, val} = makeExpression();
      const key = `${expr}=${val}`;
      if (unique.has(key)) continue;
      unique.add(key);

      const q = { expr, val };
      if (mode === 'mcq'){
        q.options = buildOptions(val);
      }
      questions.push(q);
    }
  }

  function renderQuestions(mode){
    qListEl.innerHTML = '';
    questions.forEach((q, idx) => {
      const li = document.createElement('li');
      li.className = 'q';

      if (mode === 'mcq'){
        const optsHtml = q.options.map((opt, oi) => `
          <label>
            <input type="radio" name="q${idx}" value="${opt}" data-i="${idx}" />
            <span class="opt-badge">${LETTERS[oi]}</span>
            <span>${opt}</span>
          </label>
        `).join('');
        // find letter of correct option
        const correctIndex = q.options.findIndex(v => v === q.val);
        const correctLetter = LETTERS[Math.max(0, correctIndex)];

        li.innerHTML = `
          <div class="expr">${q.expr}</div>
          <div class="opts">${optsHtml}</div>
          <div class="ans" id="ans-${idx}">
            <span class="tag">Correct:</span> <b>${correctLetter}. ${q.val}</b>
          </div>
        `;
      } else {
        li.innerHTML = `
          <div class="expr">${q.expr}</div>
          <div style="display:flex; align-items:center; gap:.5rem;">
            <input type="number" inputmode="numeric" pattern="[0-9]*" data-i="${idx}" placeholder="Answer" />
          </div>
          <div class="ans" id="ans-${idx}">
            <span class="tag">Answer:</span> <b>${q.val}</b>
          </div>
        `;
      }
      qListEl.appendChild(li);
    });
  }

  function startTimer(mins){
    stopTimer();
    remaining = Math.max(1, Number(mins)) * 60;
    tick();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer(){ if (timerId){ clearInterval(timerId); timerId = null; } }

  function tick(){
    if (remaining < 0) remaining = 0;
    const m = Math.floor(remaining/60);
    const s = remaining%60;
    timerEl.textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (remaining === 0){
      stopTimer();
      if (!finished) {
        finished = true;
        mark(modeEl.value);
      }
    } else {
      remaining -= 1;
    }
  }

  function collectUserAnswers(mode){
    const vals = [];
    if (mode === 'mcq'){
      questions.forEach((_, i) => {
        const chosen = $(`input[name="q${i}"]:checked`);
        vals[i] = chosen ? Number(chosen.value) : null;
      });
    } else {
      $$('input[data-i]').forEach(inp => {
        const v = inp.value.trim();
        vals[Number(inp.dataset.i)] = (v === '') ? null : Number(v);
      });
    }
    return vals;
  }

  function mark(mode){
    finished = true;
    const ua = collectUserAnswers(mode);
    let correct = 0;

    $$('li.q').forEach((li, i) => {
      const ansEl = li.querySelector(`#ans-${i}`);
      li.classList.remove('correct', 'wrong');

      let isRight = false;

      if (mode === 'mcq'){
        const radios = Array.from(li.querySelectorAll(`input[name="q${i}"]`));
        radios.forEach(r => r.disabled = true);          // lock
        isRight = ua[i] === questions[i].val;
      } else {
        const inp = li.querySelector('input[data-i]');
        if (inp) inp.disabled = true;                    // lock
        isRight = ua[i] === questions[i].val;
      }

      if (isRight) { li.classList.add('correct'); correct++; }
      else         { li.classList.add('wrong'); }

      ansEl.style.display = 'block';
    });

    const total = questions.length;
    const pct   = Math.round((correct / total) * 100);
    scoreLine.textContent  = `Score: ${correct} / ${total}  (${pct}%)`;
    detailLine.textContent = (mode === 'mcq')
      ? `Correct option (A–E) is shown under each question.`
      : `Correct integer answer is shown under each question.`;

    resultEl.classList.remove('hidden');
    if (pct >= PASS_PCT) { certUnlock.classList.remove('hidden'); }
    else                 { certUnlock.classList.add('hidden'); }

    fillCertificate(nameEl.value || 'Student', pct, correct, total);
  }

  function fillCertificate(name, pct, correct, total){
    certName.textContent  = name;
    certScore.textContent = `Score: ${pct}% (${correct} / ${total})`;
    const d = new Date();
    const fmt = d.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
    certDate.textContent  = `Dated: ${fmt}`;
  }

  function showCertificate(){
    certSection.classList.remove('hidden');
    certSection.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  function closeCertificate(){ certSection.classList.add('hidden'); }

  async function downloadPng(){
    const xml = new XMLSerializer().serializeToString(certSvg);
    const svgBlob = new Blob([xml], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    const canvas = document.createElement('canvas');
    canvas.width = 3508; canvas.height = 2480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ExamTeq-Certificate-${(nameEl.value||'Student').replace(/\s+/g,'_')}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
  function printCertificate(){ window.print(); }

  // ---------- Events ----------
  startBtn.addEventListener('click', () => {
    const n    = Number(qCountEl.value);
    const mins = Number(minsEl.value);
    const mode = modeEl.value; // 'mcq' | 'fill'
    if (!Number.isFinite(n) || n <= 0) return;

    // reset UI
    resultEl.classList.add('hidden');
    certUnlock.classList.add('hidden');
    certSection.classList.add('hidden');
    finished = false;

    generatePaper(n, mode);
    renderQuestions(mode);
    quizEl.classList.remove('hidden');
    startTimer(mins);
  });

  submitBtn.addEventListener('click', () => {
    if (finished) return;
    stopTimer();
    mark(modeEl.value);
  });

  restartBtn.addEventListener('click', () => {
    stopTimer();
    resultEl.classList.add('hidden');
    certUnlock.classList.add('hidden');
    certSection.classList.add('hidden');
    timerEl.textContent = '⏱ –:–';
    qListEl.innerHTML = '';
    quizEl.classList.add('hidden');
    finished = false;
  });

  showCertBtn.addEventListener('click', showCertificate);
  closeCertBtn.addEventListener('click', closeCertificate);
  printBtn.addEventListener('click', printCertificate);
  dlPngBtn.addEventListener('click', downloadPng);
})();
