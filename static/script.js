// helper
const el = id => document.getElementById(id);
const fetchMatch = async (text, pattern) => {
  const res = await fetch('/match', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ text, pattern })
  });
  return await res.json();
};

let state = { naiveSteps:[], rkSteps:[], currentStep:0, playing:false, playTimer:null };

function createCell(ch, classes='cell') {
  const d = document.createElement('div');
  d.className = classes;
  d.textContent = ch === ' ' ? '␣' : ch;
  return d;
}

// render text visual with highlighted window indices
function renderTextVisual(containerId, text, highlights = [], type='naive') {
  const container = el(containerId);
  container.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const cell = createCell(ch);
    if (highlights.includes(i)) {
      cell.classList.add(type === 'rk' ? 'rk' : 'match');
    }
    container.appendChild(cell);
  }
}

// render pattern visual (simple)
function renderPattern(containerId, pattern) {
  const cont = el(containerId);
  cont.innerHTML = '';
  for (const c of pattern) cont.appendChild(createCell(c));
}

// fill explanations (compact)
function renderExplain(containerId, steps, stepIdx=null) {
  const cont = el(containerId);
  cont.innerHTML = '';
  if (!steps || steps.length === 0) { cont.textContent = '(no steps)'; return; }
  const maxShow = 200;
  steps.forEach((s, i) => {
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.innerHTML = `<strong>[${i}] Window ${s.window}:</strong> ${formatStep(s)}`;
    if (stepIdx !== null && i === stepIdx) div.style.background = '#f1f8ff';
    cont.appendChild(div);
  });
}

function formatStep(s) {
  if (s.verifications && s.verifications.length && s.verifications[0].note === 'hash_mismatch') {
    return 'hash mismatch → skipped verification';
  }
  if (!s.verifications) return '';
  return s.verifications.map(v => {
    if (v.note) return v.note;
    return `${v.t_char === ' ' ? '␣' : v.t_char}(${v.t_index}) ${v.equal ? '✔' : '✖'}`;
  }).join(', ');
}

// draw chart (Chart.js)
let perfChart = null;
function drawChart(naiveChars, rkChars, naiveTime, rkTime) {
  const ctx = el('perfChart').getContext('2d');
  if (perfChart) perfChart.destroy();
  perfChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Char comparisons','Time (ms)'],
      datasets: [
        { label: 'Naive', data: [naiveChars, naiveTime], backgroundColor: 'rgba(35,102,240,0.75)' },
        { label: 'Rabin–Karp', data: [rkChars, rkTime], backgroundColor: 'rgba(155,92,255,0.75)' }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero:true } }
    }
  });
}

// animation controls: highlight current window for both panels
function highlightStep(stepIndex) {
  const nSteps = state.naiveSteps.length;
  if (stepIndex < 0) stepIndex = 0;
  if (stepIndex >= nSteps) stepIndex = nSteps - 1;
  state.currentStep = stepIndex;

  const nstep = state.naiveSteps[stepIndex];
  const rkstep = state.rkSteps[stepIndex];

  // build indices to highlight
  const nIndices = [];
  const rkIndices = [];
  if (nstep) {
    const start = nstep.window;
    const len = nstep.verifications ? nstep.verifications.length : 0;
    for (let k = 0; k < len; k++) nIndices.push(start + k);
  }
  if (rkstep) {
    const start = rkstep.window;
    const len = (rkstep.verifications && rkstep.verifications[0].note === 'hash_mismatch') ? 0 : (rkstep.verifications ? rkstep.verifications.length : 0);
    for (let k = 0; k < len; k++) rkIndices.push(start + k);
  }

  renderTextVisual('naiveText', el('txt').value, nIndices, 'naive');
  renderTextVisual('rkText', el('txt').value, rkIndices, 'rk');

  // show step details
  el('stepLog').innerHTML = `<strong>Step ${stepIndex}</strong><div style="margin-top:6px"><strong>Naive:</strong> ${formatStep(nstep || {})}</div><div style="margin-top:6px"><strong>RK:</strong> ${formatStep(rkstep || {})}</div>`;

  // mark explained panels
  renderExplain('naiveExplain', state.naiveSteps, stepIndex);
  renderExplain('rkExplain', state.rkSteps, stepIndex);
}

// playback
function playAnimation() {
  if (state.playing) return;
  state.playing = true;
  el('playPause').textContent = 'Pause';
  state.playTimer = setInterval(() => {
    if (state.currentStep >= state.naiveSteps.length - 1) {
      stopAnimation();
      return;
    }
    highlightStep(state.currentStep + 1);
  }, 700);
}
function stopAnimation() {
  state.playing = false;
  el('playPause').textContent = 'Play';
  clearInterval(state.playTimer);
}

// attach UI events
el('run').addEventListener('click', async () => {
  const text = el('txt').value;
  const pattern = el('pat').value;
  if (!text || !pattern) { alert('Enter text and pattern'); return; }

  const data = await fetchMatch(text, pattern);

  // fill metrics
  el('m_naive').textContent = data.naive.matches.length;
  el('m_rk').textContent = data.rabin_karp.matches.length;
  el('c_naive').textContent = data.naive.comparisons;
  el('c_rk').textContent = data.rabin_karp.char_comparisons;
  el('h_rk').textContent = data.rabin_karp.hash_comparisons;
  el('t_naive').textContent = data.naive.time_ms;
  el('t_rk').textContent = data.rabin_karp.time_ms;

  // chart
  drawChart(data.naive.comparisons, data.rabin_karp.char_comparisons, data.naive.time_ms, data.rabin_karp.time_ms);

  // panels
  el('naiveCount').textContent = data.naive.matches.length;
  el('naivePos').textContent = data.naive.matches.join(', ') || 'None';
  el('naiveComp').textContent = data.naive.comparisons;

  el('rkCount').textContent = data.rabin_karp.matches.length;
  el('rkPos').textContent = data.rabin_karp.matches.join(', ') || 'None';
  el('rkHash').textContent = data.rabin_karp.hash_comparisons;
  el('rkChar').textContent = data.rabin_karp.char_comparisons;

  // render pattern visuals
  renderPattern('naivePattern', pattern);
  renderPattern('rkPattern', pattern);

  // initialize steps for animation (use max windows between algorithms)
  const maxSteps = Math.max(data.naive.steps.length, data.rabin_karp.steps.length);
  state.naiveSteps = data.naive.steps;
  state.rkSteps = data.rabin_karp.steps;

  // show initial visuals (no highlight)
  renderTextVisual('naiveText', text, []);
  renderTextVisual('rkText', text, []);
  renderExplain('naiveExplain', state.naiveSteps);
  renderExplain('rkExplain', state.rkSteps);

  // analysis
  const naiveC = data.naive.comparisons;
  const rkC = data.rabin_karp.char_comparisons;
  const diff = naiveC - rkC;
  const red = naiveC ? Math.round((diff / naiveC) * 1000)/10 : 0;
  el('analysis').innerHTML = diff >= 0
    ? `<span style="color:var(--green);font-weight:700">Rabin–Karp performed ${diff} fewer character comparisons</span> (${red}% reduction).`
    : `<span style="color:var(--orange);font-weight:700">Rabin–Karp performed ${Math.abs(diff)} more character comparisons</span> (hash collisions or extra verifications).`;

  // set step to 0 and render
  highlightStep(0);
});

el('prevStep').addEventListener('click', () => {
  stopAnimation();
  highlightStep(Math.max(0, state.currentStep - 1));
});
el('nextStep').addEventListener('click', () => {
  stopAnimation();
  highlightStep(Math.min(state.naiveSteps.length - 1, state.currentStep + 1));
});
el('playPause').addEventListener('click', () => {
  if (state.playing) stopAnimation();
  else playAnimation();
});

// Reset
el('reset').addEventListener('click', () => {
  el('txt').value = 'AABAACAADAABAABA';
  el('pat').value = 'AABA';
  // clear displays
  ['m_naive','m_rk','c_naive','c_rk','h_rk','t_naive','t_rk','naiveCount','naivePos','naiveComp','rkCount','rkPos','rkHash','rkChar'].forEach(id => { if (el(id)) el(id).textContent = '-'; });
  el('analysis').textContent = 'Run the algorithms to see analysis and reduction percentages.';
  el('naiveText').innerHTML = '';
  el('rkText').innerHTML = '';
  el('naivePattern').innerHTML = '';
  el('rkPattern').innerHTML = '';
  el('naiveExplain').innerHTML = '';
  el('rkExplain').innerHTML = '';
  el('stepLog').innerHTML = '';
  if (perfChart) perfChart.destroy();
});

// initial
window.addEventListener('load', ()=> el('run').click());
