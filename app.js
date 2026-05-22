/**
 * app.js — GA control, SSE streaming, charts.
 */

let chartFitness = null;
let chartAvg     = null;
let bestChromosome = null;
let totalGenerations = 150;
let eventSource = null;

const fitData  = { labels: [], best: [], avg: [] };

// ── Chart setup ──────────────────────────────────────────────────────────────
function initCharts() {
  const base = {
    type: 'line',
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { labels: { color: '#64748b', font: { family: 'Space Mono', size: 10 } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: '#1f2d45' } },
        y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: '#1f2d45' } },
      },
    },
  };

  chartFitness = new Chart(document.getElementById('chartFitness'), {
    ...base,
    data: {
      labels: [],
      datasets: [{
        label: 'Mejor Fitness',
        data: [],
        borderColor: '#39ff6e',
        backgroundColor: 'rgba(57,255,110,0.06)',
        borderWidth: 2, tension: 0.35, fill: true, pointRadius: 2,
      }],
    },
  });

  chartAvg = new Chart(document.getElementById('chartAvg'), {
    ...base,
    data: {
      labels: [],
      datasets: [
        {
          label: 'Mejor',
          data: [],
          borderColor: '#00e5ff',
          borderWidth: 2, tension: 0.35, pointRadius: 1.5,
        },
        {
          label: 'Promedio',
          data: [],
          borderColor: '#a855f7',
          borderDash: [4, 3],
          borderWidth: 1.5, tension: 0.35, pointRadius: 0,
        },
      ],
    },
  });
}

function pushToCharts(gen, best, avg) {
  const lbl = String(gen);
  chartFitness.data.labels.push(lbl);
  chartFitness.data.datasets[0].data.push(best);
  chartFitness.update('none');

  chartAvg.data.labels.push(lbl);
  chartAvg.data.datasets[0].data.push(best);
  chartAvg.data.datasets[1].data.push(avg);
  chartAvg.update('none');
}

function resetCharts() {
  chartFitness.data.labels = [];
  chartFitness.data.datasets[0].data = [];
  chartFitness.update('none');
  chartAvg.data.labels = [];
  chartAvg.data.datasets[0].data = [];
  chartAvg.data.datasets[1].data = [];
  chartAvg.update('none');
}

// ── Log helper ───────────────────────────────────────────────────────────────
function appendLog(html) {
  const box = document.getElementById('logBox');
  box.innerHTML += html + '<br>';
  box.scrollTop  = box.scrollHeight;
}

function clearLog() { document.getElementById('logBox').innerHTML = ''; }

// ── Status dot ───────────────────────────────────────────────────────────────
function setStatus(state) {   // idle | running | done
  const dot  = document.getElementById('statusDot');
  const txt  = document.getElementById('statusText');
  const map  = {
    idle:    { bg: 'var(--muted)',   text: 'IDLE'     },
    running: { bg: 'var(--accent)',  text: 'EVOLUCIONANDO' },
    done:    { bg: 'var(--green)',   text: 'COMPLETADO'    },
  };
  dot.style.background = map[state].bg;
  txt.textContent      = map[state].text;
  txt.style.color      = map[state].bg;
  if (state === 'running') dot.style.animation = 'pulse 1s infinite';
  else                     dot.style.animation = '';
}

// Add pulse keyframe dynamically
const style = document.createElement('style');
style.textContent = '@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }';
document.head.appendChild(style);

// ── Start GA ─────────────────────────────────────────────────────────────────
async function startGA() {
  const params = {
    generations:   parseInt(document.getElementById('generations').value),
    pop_size:      parseInt(document.getElementById('pop_size').value),
    mutation_rate: parseFloat(document.getElementById('mutation_rate').value),
    elite_size:    parseFloat(document.getElementById('elite_size').value),
  };
  totalGenerations = params.generations;

  document.getElementById('btnRun').disabled    = true;
  document.getElementById('btnReplay').disabled = true;
  clearLog();
  resetCharts();
  setStatus('running');

  // Start the GA on backend
  const resp = await fetch('/run', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    const err = await resp.json();
    appendLog(`<span style="color:var(--red)">Error: ${err.error}</span>`);
    document.getElementById('btnRun').disabled = false;
    return;
  }

  appendLog(`<span class="gen">▶ Iniciando — gen:${params.generations} pop:${params.pop_size} mut:${params.mutation_rate}</span>`);

  // Open SSE stream
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/stream');

  eventSource.onmessage = async (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'progress') {
      const d = msg.data;
      document.getElementById('mGen').textContent  = d.generation;
      document.getElementById('mFit').textContent  = d.best_fitness.toFixed(2);
      document.getElementById('mDist').textContent = d.best_max_x + 'px';
      document.getElementById('mColl').textContent = d.best_collisions;
      if (typeof d.best_jumps !== 'undefined') document.getElementById('mJumps').textContent = d.best_jumps;
      if (typeof d.best_cleared !== 'undefined') document.getElementById('mClear').textContent = d.best_cleared;
      document.getElementById('genLabel').textContent = d.generation;

      pushToCharts(d.generation, d.best_fitness, d.avg_fitness);
      appendLog(`<span class="gen">Gen ${d.generation}</span> fit=<span class="fit">${d.best_fitness}</span> avg=${d.avg_fitness} std=${d.std_fitness || '—'} dist=${d.best_max_x}px jumps=${d.best_jumps || 0} cleared=${d.best_cleared || 0}`);

      // If server provided a population summary, render it (downsampled)
      if (msg.pop && window.playPopulation) {
        // Play population for this generation (non-blocking)
        try { playPopulation(msg.pop, d.generation); } catch(e){ console.warn('playPopulation failed', e); }
      }

      // Every 10 gens, fetch and replay best
      if (d.generation % 30 === 0) {
        setTimeout(fetchAndReplay, 500);
      }
    }

    if (msg.type === 'done') {
      eventSource.close();
      appendLog(`<span class="done">✓ FINALIZADO — fitness=${msg.fitness.toFixed(3)}</span>`);
      setStatus('done');
      document.getElementById('btnRun').disabled    = false;
      document.getElementById('btnReplay').disabled = false;
      await fetchAndReplay();
      showToast('✓ Evolución completada — fitness: ' + msg.fitness.toFixed(3));
    }
  };

  eventSource.onerror = () => {
    setStatus('idle');
    document.getElementById('btnRun').disabled = false;
  };
}

// ── Fetch best and replay ────────────────────────────────────────────────────
async function fetchAndReplay() {
  const resp = await fetch('/best');
  if (!resp.ok) return;
  const data = await resp.json();
  bestChromosome = data.chromosome;
  if (data.result && data.result.trajectory) {
    const gen = data.history?.length ? data.history[data.history.length - 1].generation : '?';
    playTrajectory(data.result.trajectory, gen, totalGenerations);
  }
}

async function replayBest() {
  if (!bestChromosome) return;
  await fetchAndReplay();
}

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  initCharts();
  const resp = await fetch('/obstacles');
  const data = await resp.json();
  drawStaticWorld(data.obstacles);

  // Check if a solution already exists (e.g. page reload)
  const s = await fetch('/status');
  const st = await s.json();
  if (st.has_best) {
    document.getElementById('btnReplay').disabled = false;
    setStatus('done');
    await fetchAndReplay();
  }
}

document.addEventListener('DOMContentLoaded', boot);