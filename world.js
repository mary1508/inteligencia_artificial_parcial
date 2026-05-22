/**
 * world.js — Canvas renderer for the GA Walker world.
 * Draws: sky, stars, floor, obstacles, avatar (stick figure with animations).
 */

const WORLD_W   = 1200;
const FLOOR_Y_W = 340;
const AV_W      = 28;
const AV_H      = 48;

let canvas, ctx, scaleFactor = 1;
let obstacles   = [];
let trajectory  = [];
let frameIdx    = 0;
let animHandle  = null;
let stars       = [];
let cameraX     = 0;
let frameDelayMs = 60; // milliseconds per simulation step (lower -> faster)

// ── Init ────────────────────────────────────────────────────────────────────
function initWorld() {
  canvas = document.getElementById('worldCanvas');
  ctx    = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  generateStars();
  drawStaticWorld([]);
}

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  canvas.width  = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  scaleFactor   = canvas.width / WORLD_W;
}

function generateStars() {
  stars = Array.from({length: 80}, () => ({
    x: Math.random() * WORLD_W,
    y: Math.random() * (FLOOR_Y_W * 0.55),
    r: Math.random() * 1.5 + 0.3,
    a: Math.random() * 0.8 + 0.2,
  }));
}

function s(v) { return v * scaleFactor; }   // scale helper

// ── Background ──────────────────────────────────────────────────────────────
function drawBackground(camX) {
  const W = canvas.width, H = canvas.height;
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   '#0d1526');
  grad.addColorStop(0.7, '#0a1a3a');
  grad.addColorStop(1,   '#0d1c38');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars (parallax 0.2)
  stars.forEach(st => {
    const sx = (st.x - camX * 0.2) % WORLD_W;
    ctx.beginPath();
    ctx.arc(s(sx < 0 ? sx + WORLD_W : sx), s(st.y), st.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${st.a})`;
    ctx.fill();
  });

  // Moon
  ctx.beginPath();
  ctx.arc(s(950 - camX * 0.1), s(55), s(28), 0, Math.PI * 2);
  ctx.fillStyle = '#e8e4d0';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s(960 - camX * 0.1), s(50), s(22), 0, Math.PI * 2);
  ctx.fillStyle = '#0d1526';
  ctx.fill();
}

function drawFloor(camX) {
  const W = canvas.width, H = canvas.height;
  const fy = s(FLOOR_Y_W);
  // Ground fill
  ctx.fillStyle = '#0f1d36';
  ctx.fillRect(0, fy, W, H - fy);
  // Top line with glow
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = '#1a3a6e';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, fy); ctx.lineTo(W, fy);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Grid lines on floor
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth   = 1;
  const gridSize  = s(60);
  const offset    = (s(camX) * 0.5) % gridSize;
  for (let x = -offset; x < W + gridSize; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, H); ctx.stroke();
  }
}

function drawObstacles(camX) {
  obstacles.forEach(obs => {
    const ox = s(obs.x - camX);
    const oy = s(obs.y);
    const ow = s(obs.w);
    const oh = s(obs.h);

    // Body
    const g = ctx.createLinearGradient(ox, oy, ox, oy + oh);
    g.addColorStop(0, '#ff5722');
    g.addColorStop(1, '#bf360c');
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, ow, oh);

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(ox, oy, ow, s(4));

    // Warning stripes
    ctx.save();
    ctx.rect(ox, oy, ow, oh);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,200,0,0.25)';
    ctx.lineWidth   = s(8);
    for (let i = -oh; i < oh + ow; i += s(20)) {
      ctx.beginPath();
      ctx.moveTo(ox + i, oy);
      ctx.lineTo(ox + i + oh, oy + oh);
      ctx.stroke();
    }
    ctx.restore();

    // Glow
    ctx.shadowColor = '#ff5722';
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = '#ff7043';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(ox, oy, ow, oh);
    ctx.shadowBlur  = 0;
  });
}

// ── Avatar ──────────────────────────────────────────────────────────────────
let _legPhase = 0;
function drawAvatar(wx, wy, action, hit, t, colorOverride) {
  const cx  = s(wx - cameraX + AV_W / 2);
  const bot = s(wy);
  const sc  = scaleFactor;

  const isWalk  = action === 'move_right' || action === 'move_left';
  const isJump  = action === 'jump' || action === 'jump_right' || action === 'jump_left';
  const isLeft  = action === 'move_left' || action === 'jump_left';
  const defaultColor = hit ? '#ff4757' : '#00e5ff';
  const color   = colorOverride || defaultColor;
  const glow    = hit ? '#ff4757' : '#00e5ff';

  if (isWalk) _legPhase = (_legPhase + 0.35) % (Math.PI * 2);

  ctx.save();
  // allow per-avatar color alpha
  if (colorOverride) ctx.globalAlpha = 0.9;
  ctx.shadowColor = glow;
  ctx.shadowBlur  = hit ? 18 : 10;

  const headY  = bot - sc * 44;
  const bodyT  = bot - sc * 32;
  const bodyB  = bot - sc * 16;
  const dir    = isLeft ? -1 : 1;

  // Body (torso)
  ctx.strokeStyle = color;
  ctx.lineWidth   = sc * 3.5;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, bodyT);
  ctx.lineTo(cx, bodyB);
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(cx, headY, sc * 9, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth   = sc * 2.5;
  ctx.stroke();
  ctx.fillStyle   = 'rgba(0,229,255,0.08)';
  ctx.fill();

  // Eyes
  const eyeOff = isLeft ? -3 : 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx + sc * eyeOff, headY - sc * 1, sc * 2, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  const armSwing = isWalk ? Math.sin(_legPhase) * sc * 10 : (isJump ? -sc * 14 : sc * 2);
  ctx.strokeStyle = color; ctx.lineWidth = sc * 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, bodyT + sc * 4);
  ctx.lineTo(cx - sc * 12 * dir, bodyT + sc * 4 + armSwing * dir);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, bodyT + sc * 4);
  ctx.lineTo(cx + sc * 12 * dir, bodyT + sc * 4 - armSwing * dir);
  ctx.stroke();

  // Legs
  if (isJump) {
    // Tucked jump
    ctx.beginPath();
    ctx.moveTo(cx, bodyB);
    ctx.lineTo(cx - sc * 9,  bodyB + sc * 10);
    ctx.lineTo(cx - sc * 5,  bot);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, bodyB);
    ctx.lineTo(cx + sc * 9,  bodyB + sc * 10);
    ctx.lineTo(cx + sc * 5,  bot);
    ctx.stroke();
  } else {
    const lSwing = Math.sin(_legPhase) * sc * 10;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx, bodyB);
    ctx.lineTo(cx - sc * 7 + lSwing, bodyB + sc * 9);
    ctx.lineTo(cx - sc * 8 + lSwing, bot);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx, bodyB);
    ctx.lineTo(cx + sc * 7 - lSwing, bodyB + sc * 9);
    ctx.lineTo(cx + sc * 8 - lSwing, bot);
    ctx.stroke();
  }

  // Jump trail
  if (isJump) {
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, bot + sc * i * 5, sc * (5 - i), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,255,${0.15 - i * 0.03})`;
      ctx.fill();
    }
  }

  ctx.restore();
  if (colorOverride) ctx.globalAlpha = 1.0;
}

// ── Play population trajectories in parallel ───────────────────────────────
let popAnimHandle = null;
function playPopulation(popArray, generation) {
  if (popAnimHandle) clearTimeout(popAnimHandle);
  if (!Array.isArray(popArray) || popArray.length === 0) return;

  const maxLen = Math.max(...popArray.map(p => p.trajectory.length));
  let idx = 0;

  // assign colors per individual
  const colors = popArray.map((p, i) => `hsl(${(i*137.5) % 360} 80% 55%)`);

  function step() {
    if (idx >= maxLen) {
      // stop after one playback
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(cameraX);
    drawFloor(cameraX);
    drawObstacles(cameraX);

    // draw each individual's frame if available
    for (let i = 0; i < popArray.length; i++) {
      const traj = popArray[i].trajectory;
      if (!traj || traj.length === 0) continue;
      const f = traj[Math.min(idx, traj.length-1)];
      // draw with color and lower alpha
      drawAvatar(f.x, f.y, f.action, f.hit, idx, colors[i]);
    }

    // progress bar: show average frame progress
    const avgProgress = (idx / maxLen) * 100;
    document.getElementById('progressBar').style.width = avgProgress + '%';

    idx++;
    popAnimHandle = setTimeout(step, frameDelayMs);
  }

  // set generation label
  document.getElementById('genLabel').textContent = generation !== undefined ? generation : '—';
  step();
}

// ── Render loop ──────────────────────────────────────────────────────────────
function drawStaticWorld(obs) {
  obstacles = obs;
  cameraX   = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(0);
  drawFloor(0);
  drawObstacles(0);
  // Draw idle avatar
  drawAvatar(60, FLOOR_Y_W, 'idle', false, 0);
}

let _totalGens = 150;
function setTotalGenerations(n) { _totalGens = n; }

function setFrameDelay(ms) { frameDelayMs = Math.max(8, Number(ms) || 60); }

function playTrajectory(traj, generation, totalGens) {
  if (animHandle) cancelAnimationFrame(animHandle);
  trajectory = traj;
  frameIdx   = 0;
  _totalGens = totalGens || _totalGens;

  document.getElementById('genLabel').textContent = generation !== undefined ? generation : '—';

  function step() {
      if (frameIdx >= trajectory.length) {
        // Loop: short pause then restart
        animHandle = setTimeout(() => { frameIdx = 0; animHandle = setTimeout(step, frameDelayMs); }, 800);
        return;
      }
    const frame = trajectory[frameIdx];

    // Camera: follow avatar with look-ahead
    const targetCam = Math.max(0, frame.x - canvas.width / scaleFactor * 0.35);
    cameraX += (targetCam - cameraX) * 0.08;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(cameraX);
    drawFloor(cameraX);
    drawObstacles(cameraX);
    drawAvatar(frame.x, frame.y, frame.action, frame.hit, frameIdx);

    // Progress bar
    document.getElementById('progressBar').style.width =
      (frameIdx / trajectory.length * 100) + '%';

    frameIdx++;
    animHandle = setTimeout(step, frameDelayMs);
  }
  if (animHandle) clearTimeout(animHandle);
  animHandle = setTimeout(step, frameDelayMs);
}

window.addEventListener('DOMContentLoaded', initWorld);