(function(){
  'use strict';
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // Build table chips
  const tablesEl = $('#tables');
  for (let n=1;n<=12;n++){
    const id='t'+n;
    const inp=document.createElement('input'); inp.type='checkbox'; inp.id=id; inp.value=String(n);
    const lab=document.createElement('label'); lab.htmlFor=id; lab.textContent=n+'×';
    tablesEl.append(inp,lab);
  }
  // quick selects
  const qs = {
    all:   () => $$('#tables input').forEach(x => x.checked = true),
    none:  () => $$('#tables input').forEach(x => x.checked = false),
    evens: () => $$('#tables input').forEach(x => x.checked = Number(x.value)%2===0),
    odds:  () => $$('#tables input').forEach(x => x.checked = Number(x.value)%2===1),
  };
  ['all','none','evens','odds'].forEach(id => { const b = $('#'+id); if (b) b.onclick = qs[id]; });

  // Read URL params to prefill
  const params = new URLSearchParams(location.search);
  const presetTables = (params.get('tables')||'').split(',').map(x=>Number(x)).filter(Boolean);
  const presetOp     = params.get('op') || 'mix';
  const presetOrder  = params.get('order') || 'sequential';
  if (presetTables.length){ presetTables.forEach(n => { const el = $('#t'+n); if (el) el.checked = true; }); }
  const opEl = $(`input[name="op"][value="${presetOp}"]`); if (opEl) opEl.checked = true;
  const ordEl = $(`input[name="order"][value="${presetOrder}"]`); if (ordEl) ordEl.checked = true;

  // Default select 1–3 if none
  if (!$$('#tables input:checked').length) {
    $$('#tables input').forEach(x => { x.checked = Number(x.value) <= 3; });
  }

  // State
  const state = { pool:[], idx:0, showAns:false };

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }

  function buildPool(){
    const selected = $$('#tables input:checked').map(x=>Number(x.value));
    const op = (document.querySelector('input[name="op"]:checked')||{value:'mix'}).value;
    const order = (document.querySelector('input[name="order"]:checked')||{value:'sequential'}).value;
    const pool=[];
    for(const t of selected){
      for(let i=1;i<=12;i++){
        if (op==='mul' || op==='mix'){
          pool.push({kind:'mul',a:t,b:i,ans:t*i,front:`${t} × ${i} = ?`,back:`${t} × ${i} = ${t*i}`});
        }
        if (op==='div' || op==='mix'){
          const prod=t*i;
          pool.push({kind:'div',a:prod,b:t,ans:i,front:`${prod} ÷ ${t} = ?`,back:`${prod} ÷ ${t} = ${i}`});
          // Alternate form (uncomment if you want to double the div variety):
          // pool.push({kind:'div',a:prod,b:i,ans:t,front:`${prod} ÷ ${i} = ?`,back:`${prod} ÷ ${i} = ${t}`});
        }
      }
    }
    if (order==='random') shuffle(pool);
    return pool;
  }

  function render(){
    if (!state.pool.length){ $('#fc-text').textContent = 'No cards. Choose tables and press Rebuild.'; return; }
    const item = state.pool[state.idx];
    $('#fc-text').textContent = state.showAns ? item.back : item.front;
    $('#meta').textContent = `Card ${state.idx+1}/${state.pool.length}`;
    $('#msg').textContent = state.showAns ? 'Answer shown' : '';
  }

  function rebuild(){
    state.pool = buildPool();
    state.idx = 0;
    state.showAns = false;
    render();
  }

  // Wires
  $('#card').addEventListener('click', ()=>{ state.showAns=!state.showAns; render(); });
  $('#prev').addEventListener('click', ()=>{ if(!state.pool.length) return; state.idx = (state.idx-1+state.pool.length)%state.pool.length; state.showAns=false; render(); });
  $('#next').addEventListener('click', ()=>{ if(!state.pool.length) return; state.idx = (state.idx+1)%state.pool.length; state.showAns=false; render(); });
  $('#shuffle').addEventListener('click', ()=>{ if(!state.pool.length) return; shuffle(state.pool); state.idx=0; state.showAns=false; render(); });
  $('#restart').addEventListener('click', rebuild);
  document.addEventListener('keydown', e=>{
    if (e.key === 'ArrowLeft') $('#prev').click();
    if (e.key === 'ArrowRight') $('#next').click();
    if (e.key === ' ') { e.preventDefault(); $('#card').click(); }
  });

  // First render
  rebuild();
})();

(function(){
  let x0 = null;
  const el = document.querySelector('.flash-card');
  if (!el) return;

  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive:true});
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 40) return; // ignore tiny swipes
    if (dx > 0) window.flashPrev?.(); else window.flashNext?.();
  }, {passive:true});
})();
