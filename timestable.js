(function () {
  'use strict';
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // ===== Config =====
  const AUTO_NEXT_DELAY_MS = 1000;
  const MIN_PCT_FOR_CERT   = 80;
  const LS_SETTINGS        = 'etq_tt_settings_v3'; // bumped because 'mix' answer mode

  // Footer year
  const yrEl = $('#yr'); if (yrEl) yrEl.textContent = new Date().getFullYear();

  // Build 1–12 chips
  const tablesEl = $('#tables');
  if (tablesEl) {
    for (let n = 1; n <= 12; n++) {
      const id  = 't' + n;
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.id = id; inp.value = String(n);
      const lab = document.createElement('label');
      lab.htmlFor = id; lab.textContent = n + '×';
      tablesEl.append(inp, lab);
    }
  }

  // Quick selects
  const qs = {
    all:   () => $$('#tables input').forEach(x => x.checked = true),
    none:  () => $$('#tables input').forEach(x => x.checked = false),
    evens: () => $$('#tables input').forEach(x => x.checked = Number(x.value)%2===0),
    odds:  () => $$('#tables input').forEach(x => x.checked = Number(x.value)%2===1),
  };
  ['all','none','evens','odds'].forEach(id => { const b = $('#'+id); if (b) b.onclick = qs[id]; });

  // ===== App state =====
  const state = {
    selected:[1,2,3],
    op:'mul',                // mul | div | mix  (question operation)
    mode:'fill',             // fill | mcq | mix (answer mode)
    order:'sequential',
    goal:10,

    questions:[],            // each { kind:'mul'|'div', a,b,ans,text, qMode:'fill'|'mcq' }
    idx:0, current:null,
    correct:0, attempted:0, streak:0,
    t0:0, tick:null, finished:false, autoNext:null
  };

  // ===== Restore =====
  try {
    const saved = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
    if (saved && Array.isArray(saved.selected)) state.selected = saved.selected;
    if (saved.op)    state.op    = saved.op;
    if (saved.mode)  state.mode  = saved.mode;
    if (saved.order) state.order = saved.order;
    if (saved.goal)  state.goal  = saved.goal;
  } catch {}

  // Reflect restore
  $$('#tables input').forEach(x => { x.checked = state.selected.includes(Number(x.value)); });
  const opEl = $(`input[name="op"][value="${state.op}"]`); if (opEl) opEl.checked = true;
  const mEl  = $(`input[name="mode"][value="${state.mode}"]`); if (mEl) mEl.checked = true;
  const oEl  = $(`input[name="order"][value="${state.order}"]`); if (oEl) oEl.checked = true;
  const gEl  = $(`input[name="goal"][value="${state.goal}"]`); if (gEl) gEl.checked = true;

  // ===== Helpers =====
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
  const keyBest = () => 'etq_tt_'+[state.op,state.mode,state.order,state.selected.slice().sort((a,b)=>a-b).join('-'),state.goal].join('_');
  function showBest(){ const v = localStorage.getItem(keyBest()); const el = $('#best'); if (el) el.textContent = v ? v + ' correct' : '–'; }
  function setBar(){ const bar = $('#bar'); if (!bar) return; bar.style.width = Math.min(100, (state.attempted/state.goal)*100)+'%'; }
  function stats(){ const sc=$('#sc'),sa=$('#sa'),ss=$('#ss'); if(sc)sc.textContent=state.correct; if(sa)sa.textContent=state.attempted; if(ss)ss.textContent=state.streak; setBar(); }
  function flashMsg(msg, cls){ const f=$('#msg'); if(!f)return; f.textContent=msg; f.className='feedback '+(cls||''); }
  function saveSettings(){
    try{ localStorage.setItem(LS_SETTINGS, JSON.stringify({
      selected:[...new Set(state.selected)].sort((a,b)=>a-b),
      op:state.op, mode:state.mode, order:state.order, goal:state.goal
    })); }catch{}
  }

  // ===== Timer =====
  function startTimer(){
    state.t0 = Date.now();
    const tm = $('#tm'); if (tm) tm.textContent = '0';
    clearInterval(state.tick);
    state.tick = setInterval(()=>{ const secs = Math.floor((Date.now()-state.t0)/1000); const tm2=$('#tm'); if (tm2) tm2.textContent=String(secs); }, 250);
  }
  function stopTimer(){ clearInterval(state.tick); }

  // ===== Pool builder (×, ÷, or mixed) + per-question answer mode when mode==='mix'
  function buildPool(){
  const pool = [];
  const bases = state.selected.slice(); // keep chosen order

  if (state.order === 'sequential') {
    // Interleave: for b = 1..12, add every selected table at that b
    for (let b = 1; b <= 12; b++) {
      for (const a of bases) {
        if (state.op === 'mul' || state.op === 'mix') {
          pool.push(makeQ('mul', a, b, a*b, `${a} × ${b} = ?`));
        }
        if (state.op === 'div' || state.op === 'mix') {
          const prod = a*b;
          pool.push(makeQ('div', prod, a, b, `${prod} ÷ ${a} = ?`));
          // If you also want the complementary division form, uncomment:
          // pool.push(makeQ('div', prod, b, a, `${prod} ÷ ${b} = ?`));
        }
      }
    }
  } else {
    // Your original behaviour, then shuffle
    for (const a of bases) {
      for (let b = 1; b <= 12; b++) {
        if (state.op === 'mul' || state.op === 'mix') {
          pool.push(makeQ('mul', a, b, a*b, `${a} × ${b} = ?`));
        }
        if (state.op === 'div' || state.op === 'mix') {
          const prod = a*b;
          pool.push(makeQ('div', prod, a, b, `${prod} ÷ ${a} = ?`));
          // Optional complementary division:
          // pool.push(makeQ('div', prod, b, a, `${prod} ÷ ${b} = ?`));
        }
      }
    }
    shuffle(pool);
  }

  return pool;
}

  // Create a question object with optional mixed answer mode assignment
  function makeQ(kind, a, b, ans, text){
    // If overall mode is 'mix', assign qMode randomly; else inherit the global mode
    const qMode = (state.mode==='mix')
      ? (Math.random() < 0.5 ? 'fill' : 'mcq')
      : state.mode;
    return { kind, a, b, ans, text, qMode };
  }

  // MCQ options tuned for integer answers
  function mcqOptions(correct){
    const set = new Set([correct]);
    while (set.size < 4) {
      const span  = Math.max(3, Math.round(Math.max(10, correct) * 0.25));
      const delta = Math.floor(Math.random() * span) + 1;
      const sign  = Math.random() < 0.5 ? -1 : 1;
      const cand  = Math.max(1, correct + sign * delta);
      set.add(cand);
    }
    const arr = Array.from(set); shuffle(arr); return arr;
  }

  function renderQ(){
    const c = $('#card'); if (!c) return;
    c.innerHTML = '';
    const q = document.createElement('div'); q.className='q';
    q.textContent = state.current.text;
    c.append(q);

    // Decide how THIS question is answered
    const qMode = state.current.qMode || state.mode;

    if (qMode === 'mcq') {
      const grid = document.createElement('div'); grid.className='choices';
      for (const v of mcqOptions(state.current.ans)){
        const d = document.createElement('div');
        d.className='choice'; d.textContent=String(v); d.tabIndex=0; d.setAttribute('role','button');
        d.addEventListener('click',()=>selectChoice(d));
        d.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectChoice(d); }});
        grid.append(d);
      }
      c.append(grid);
    } else {
      const wrap = document.createElement('div'); wrap.className='answer';
      const inp  = document.createElement('input');
      inp.type='number'; inp.id='ans'; inp.inputMode='numeric'; inp.setAttribute('aria-label','Your answer');
      wrap.append(inp); c.append(wrap); setTimeout(()=>inp.focus(),0);
    }

    const sb = $('#submit'); if (sb) sb.disabled = false;
  }

  function selectChoice(el){
    $$('.choice').forEach(x => x.classList.remove('selected','good','bad'));
    el.classList.add('selected');
  }

  function nextQ(){
    if (state.attempted >= state.goal || state.idx >= state.questions.length) { finish(); return; }
    state.current = state.questions[state.idx++];
    renderQ();
  }

  function submit(){
    if (!state.current || state.finished) return;

    const qMode = state.current.qMode || state.mode;
    let ok = false;

    if (qMode === 'mcq') {
      const sel = document.querySelector('.choice.selected');
      if (!sel){ flashMsg('Pick an answer first!','hint'); return; }
      ok = Number(sel.textContent) === state.current.ans;
      sel.classList.add(ok ? 'good' : 'bad');
    } else {
      const box = $('#ans'); const v = (box && box.value || '').trim();
      if (v === ''){ flashMsg('Type an answer first!','hint'); return; }
      ok = Number(v) === state.current.ans;
    }

    state.attempted++;
    if (ok){ state.correct++; state.streak++; flashMsg('Nice! ✅','ok'); }
    else { state.streak = 0; flashMsg(state.current.text.replace('?', String(state.current.ans)),'no'); }
    stats();

    const sb = $('#submit'); if (sb) sb.disabled = true;
    clearTimeout(state.autoNext);
    state.autoNext = setTimeout(()=>{ if(!state.finished) nextQ(); }, AUTO_NEXT_DELAY_MS);
  }

  function start(){
    state.selected = $$('#tables input:checked').map(x => Number(x.value));
    const op  = document.querySelector('input[name="op"]:checked');
    const m   = document.querySelector('input[name="mode"]:checked');
    const o   = document.querySelector('input[name="order"]:checked');
    const g   = document.querySelector('input[name="goal"]:checked');
    if (op) state.op = op.value;
    if (m)  state.mode = m.value;     // may be 'mix'
    if (o)  state.order = o.value;
    if (g)  state.goal = Number(g.value);

    if (state.selected.length === 0) { flashMsg('Select at least one table (e.g. 2×, 5×).','hint'); return; }
    saveSettings();

    clearTimeout(state.autoNext); stopTimer();
    state.questions = buildPool(); state.idx=0; state.correct=0; state.attempted=0; state.streak=0; state.finished=false;
    stats(); setBar(); showBest();

    const pr = $('#print'); if (pr){ pr.disabled = true; pr.style.display='none'; }
    startTimer(); nextQ();
  }

  function finish(){
    state.finished = true; stopTimer(); clearTimeout(state.autoNext);
    const sb = $('#submit'); if (sb) sb.disabled = true;

    const pct = state.attempted ? Math.round((state.correct/state.attempted)*100) : 0;
    const tmEl = $('#tm'); const tmText = tmEl ? tmEl.textContent : '0';
    const card = $('#card');
    if (card) {
      card.innerHTML =
        `<div style="display:grid;gap:10px">
           <div class="q">Great work! 🎉</div>
           <div>Score: <b>${state.correct}</b> / ${state.attempted} (${pct}%).</div>
           <div>Total time: <b>${tmText}s</b></div>
         </div>`;
    }
    const k = keyBest(); const prev = Number(localStorage.getItem(k) || '0');
    if (state.correct > prev) localStorage.setItem(k, String(state.correct));
    showBest();

    const pr = $('#print'); if (pr) pr.textContent = 'Download certificate';
    if (pct >= MIN_PCT_FOR_CERT) {
      if (pr){ pr.disabled = false; pr.style.display = ''; }
      flashMsg(`🏅 Awesome! You scored ${pct}%. Click “Download certificate”.`, 'ok');
    } else {
      if (pr){ pr.disabled = true; pr.style.display = 'none'; }
      flashMsg(`Keep going! You scored ${pct}%. Score ${MIN_PCT_FOR_CERT}% or higher to unlock the certificate.`, 'hint');
    }
  }

  // ===== Certificate bits (unchanged from your working version) =====
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function ordinal(n){ const s=["th","st","nd","rd"],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
  function formatLongDate(d){ return `${ordinal(d.getDate())} ${d.toLocaleString(undefined,{month:'long'})} ${d.getFullYear()}`; }
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const safeFile  = s => s.replace(/[^\w\-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
  function fetchLogoAsDataURL(path){
    return fetch(path, {mode:'cors'})
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }))
      .catch(()=> path);
  }
  function buildCertificateHTML({name, list, statsText, dateText, logoSrc}){
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Certificate of Achievement | ExamTeq</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root{--ink:#111827;--muted:#374151;--brand:#0b1e44;--rule:#101623;--paper:#ffffff;}
  @page{ size: A4 landscape; margin: 0 }
  html,body{height:100%; background:#e9eef6}
  body{ margin:0; display:grid; place-items:center; color:var(--ink);
        font-family:Lato,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
  .sheet{ width:297mm; height:210mm; background:var(--paper); position:relative;
          padding:18mm 24mm; box-shadow:0 10px 30px rgba(0,0,0,.12); overflow:hidden; }
  .sheet:before,.sheet:after{content:""; position:absolute; inset:10mm; border:2px solid var(--rule);}
  .sheet:after{ inset:5mm; }
  .title{text-align:center; margin-top:8mm;}
  .title h1{ font-family:"Playfair Display",serif; font-size:34pt; font-weight:700; margin:0; color:var(--brand); letter-spacing:.3px; }
  .title p{ font-style:italic; color:var(--muted); margin:.5rem 0 0; font-size:12.5pt; }
  .logo-wrap{ display:grid; place-items:center; margin:8mm 0 6mm; }
  .logo-wrap img{ max-width:110mm; height:auto; }
  .body{ text-align:center; line-height:1.55; }
  .honouree{ font-family:"Playfair Display",serif; font-size:22pt; font-weight:700; margin:.5rem 0 0; }
  .lede{ margin:6mm auto 0; max-width:200mm; font-size:12.5pt; }
  .stats{ margin:8mm 0 0; font-size:12.5pt; }
  .divider{ width:120mm; height:0; border-top:2px solid var(--rule); margin:10mm auto 8mm; }
  .signatures{ display:flex; justify-content:space-between; gap:30mm; margin-top:10mm; }
  .sig-block{ width:45%; text-align:center; }
  .sig-line{ border-bottom:2px solid var(--rule); height:28px; margin:0 0 6px; }
  .sig-label{ font-size:11pt; color:var(--muted); }
  @media print{ body{ background:var(--paper) } .sheet{ box-shadow:none; margin:0 } body,.sheet{-webkit-print-color-adjust:exact; print-color-adjust:exact}}
</style></head>
<body><div class="sheet">
<header class="title"><h1>Certificate of Achievement</h1><p>Awarded for excellence in Times Tables</p></header>
<div class="logo-wrap"><img src="${logoSrc}" alt="ExamTeq logo"></div>
<main class="body">
  <p>This Certificate is proudly presented to</p>
  <div class="honouree">${escapeHtml(name)}</div>
  <p class="lede">for outstanding performance in <strong>${list}</strong>.</p>
  <div class="stats">${statsText}<br/>Presented on <strong>${dateText}</strong>.</div>
  <div class="divider" aria-hidden="true"></div>
  <section class="signatures">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Teacher/Tutor</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Signature</div></div>
  </section>
</main></div></body></html>`;
  }
  function downloadCert(){
    if (state.finished !== true) return;
    const nm   = ($('#student') && $('#student').value) ? $('#student').value.trim() : 'Super Star';
    const pct  = state.attempted ? Math.round((state.correct/state.attempted)*100) : 0;
    const list = `${state.op==='mul'?'Multiplication':state.op==='div'?'Division':'Mixed'} • ${state.selected.slice().sort((a,b)=>a-b).join('×, ')}×`;
    const secs = Number(($('#tm') && $('#tm').textContent) ? $('#tm').textContent : '0');
    const statsText = `Awarded for scoring <strong>${state.correct}/${state.attempted} (${pct}%)</strong> in ${secs} second${secs===1?'':'s'}.`;
    const today = new Date(); const dateLong = formatLongDate(today);
    fetchLogoAsDataURL('logo.png').then(logoSrc => {
      const html = buildCertificateHTML({ name:nm, list, statsText, dateText:dateLong, logoSrc });
      const blob = new Blob([html], {type:'text/html;charset=utf-8'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); const who = safeFile(nm) || 'Student';
      a.href = url; a.download = `ExamTeq-Certificate-${who}-${isoDate(today)}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(()=> URL.revokeObjectURL(url), 500);
    });
  }

  // ===== Wires =====
  const startBtn = $('#start');
  const submitBtn = $('#submit');
  const resetBtn = $('#reset');
  const printBtn = $('#print');

  if (startBtn)  startBtn.addEventListener('click', start);
  if (submitBtn) submitBtn.addEventListener('click', submit);
  if (resetBtn)  resetBtn.addEventListener('click', ()=>location.reload());
  if (printBtn)  printBtn.addEventListener('click', downloadCert);

  document.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && (!submitBtn || !submitBtn.disabled)) submit();
  });

  // Default selection if nothing restored
  if (!$$('#tables input:checked').length) {
    $$('#tables input').forEach(x => { x.checked = Number(x.value) <= 3; });
  }

  // Build Flashcards link with current selections when clicked (if present on your page)
  const flashLink = $('#flashcardsLink');
  function buildFlashURL(){
    const selected = $$('#tables input:checked').map(x=>Number(x.value));
    const op  = (document.querySelector('input[name="op"]:checked') || {value:'mul'}).value;
    const order = (document.querySelector('input[name="order"]:checked') || {value:'sequential'}).value;
    const params = new URLSearchParams();
    if (selected.length) params.set('tables', selected.join(','));
    params.set('op', op);
    params.set('order', order);
    if (flashLink) flashLink.href = `flashcards.html?${params.toString()}`;
  }
  if (flashLink){ flashLink.addEventListener('click', buildFlashURL); flashLink.addEventListener('mousedown', buildFlashURL); }
})();
