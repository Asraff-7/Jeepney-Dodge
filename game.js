const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = cv.width, H = cv.height, LANES = 3, LW = W / LANES, PY = H - 90;
const $ = id => document.getElementById(id);
const scoreEl = $('score'), bestEl = $('best'), livesEl = $('lives'), msg = $('msg');
const landing = $('landing'), game = $('game');

let best = 0;
try { best = +localStorage.getItem('jeepBest') || 0; } catch (e) {}
function showBest() { bestEl.textContent = best; $('landBest').textContent = best; }
showBest();

// Sound
let AC = null;
function beep(f, d, type, vol) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(vol || 0.08, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + d);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + d);
  } catch (e) {}
}

const TYPES = [
  { w: 44, h: 72,  colors: ['#4cc9f0', '#b5179e', '#90be6d', '#f8f9fa'], kind: 'car' },
  { w: 34, h: 52,  colors: ['#ff9f1c', '#2ec4b6'], kind: 'trike' },
  { w: 54, h: 120, colors: ['#e63946', '#457b9d'], kind: 'bus' }
];

let lane, px, obs, pax, score, lives, speed, spawnT, roadY, inv, shake, running = false, paused, last;

function reset() {
  lane = 1; px = laneX(1); obs = []; pax = []; score = 0; lives = 3;
  speed = 3.2; spawnT = 0; roadY = 0; inv = 0; shake = 0; paused = false;
  scoreEl.textContent = 0; showLives();
}
function laneX(l) { return l * LW + LW / 2; }
function showLives() { livesEl.textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives); }

function wheels(x, y, w, h) {
  ctx.fillStyle = '#111';
  [[-w / 2 - 3, -h / 2 + 6], [w / 2, -h / 2 + 6], [-w / 2 - 3, h / 2 - 18], [w / 2, h / 2 - 18]]
    .forEach(p => ctx.fillRect(x + p[0], y + p[1], 3, 12));
}

function drawVehicle(x, y, o) {
  const w = o.w, h = o.h;
  ctx.fillStyle = o.c;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x - w / 2 + 4, y - h / 2 + 8, w - 8, 14);
  if (o.kind === 'bus') {
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2 + 5, y - 20 + i * 18, w - 10, 10);
  }
  if (o.kind === 'trike') {
    ctx.fillStyle = '#222'; ctx.fillRect(x + w / 2, y - 4, 14, 30);
  }
  wheels(x, y, w, h);
}

function drawJeep(x, y) {
  const w = 52, h = 88;
  ctx.fillStyle = '#2a9d8f'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - w / 2 + 4, y - h / 2 + 8, w - 8, 14);
  ctx.fillStyle = '#f2c94c'; ctx.fillRect(x - w / 2, y - 6, w, 6);
  ctx.fillStyle = '#e4572e'; ctx.fillRect(x - w / 2, y + 6, w, 6);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + 6 + i * 14, y + 20, 10, 10);
  wheels(x, y, w, h);
}

function drawPax(x, y) {
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath(); ctx.arc(x, y - 12, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff4dc'; ctx.fillRect(x - 7, y - 3, 14, 20);
  ctx.fillStyle = '#e4572e'; ctx.fillRect(x - 7, y + 6, 14, 4);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('+5', x, y - 26);
}

function spawn() {
  if (Math.random() < 0.22) {
    pax.push({ x: laneX(Math.floor(Math.random() * LANES)), y: -40 });
  } else {
    const t = TYPES[Math.random() < 0.15 ? 2 : Math.random() < 0.4 ? 1 : 0];
    obs.push({ x: laneX(Math.floor(Math.random() * LANES)), y: -80, w: t.w, h: t.h, kind: t.kind,
      c: t.colors[Math.floor(Math.random() * t.colors.length)] });
  }
}

function update(dt) {
  roadY = (roadY + speed * dt) % 40;
  spawnT -= speed * dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(100, 210 - score * 0.4) * (0.7 + Math.random() * 0.6); }
  px += (laneX(lane) - px) * Math.min(1, 0.25 * dt);
  if (inv > 0) inv -= dt;
  if (shake > 0) shake -= dt;

  const vy = (speed * 0.9 + 1.2) * dt;
  obs.forEach(o => o.y += vy);
  pax.forEach(p => p.y += vy);
  obs = obs.filter(o => { if (o.y > H + 80) { score++; return false; } return true; });
  pax = pax.filter(p => p.y < H + 40);

  for (let i = pax.length - 1; i >= 0; i--) {
    const p = pax[i];
    if (Math.abs(p.y - PY) < 50 && Math.abs(p.x - px) < 34) {
      score += 5; pax.splice(i, 1); beep(880, 0.12, 'triangle', 0.1);
    }
  }
  if (inv <= 0) {
    for (const o of obs) {
      if (Math.abs(o.y - PY) < 44 + o.h / 2 - 6 && Math.abs(o.x - px) < (52 + o.w) / 2 - 6) {
        lives--; showLives(); inv = 90; shake = 18; beep(120, 0.3, 'sawtooth', 0.12);
        if (lives <= 0) { gameOver(); return; }
        break;
      }
    }
  }
  speed = Math.min(9, 3.2 + score * 0.04);
  scoreEl.textContent = score;
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (shake > 0) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
  ctx.fillStyle = '#f2c94c';
  for (let i = 1; i < LANES; i++)
    for (let y = -40 + roadY; y < H; y += 40) ctx.fillRect(i * LW - 2, y, 4, 22);
  pax.forEach(p => drawPax(p.x, p.y));
  obs.forEach(o => drawVehicle(o.x, o.y, o));
  if (!(inv > 0 && Math.floor(inv / 6) % 2)) drawJeep(px, PY);
  ctx.restore();
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Naka-pause', W / 2, H / 2);
  }
}

function loop(t) {
  if (!running) return;
  const dt = Math.min(2.5, (t - (last || t)) / 16.67); last = t;
  if (!paused) update(dt);
  if (running) { draw(); requestAnimationFrame(loop); }
}

function gameOver() {
  running = false; draw();
  const isBest = score > best;
  if (isBest) { best = score; try { localStorage.setItem('jeepBest', best); } catch (e) {} }
  showBest();
  msg.innerHTML = '<h1>Bangga!</h1><p>Score: ' + score + '</p>' + (isBest ? '<p>Bagong best score!</p>' : '') +
    '<button id="again">Ulitin</button><button id="toMenu" class="ghost">Menu</button>';
  msg.hidden = false;
  $('again').onclick = start;
  $('toMenu').onclick = toMenu;
}

function start() {
  landing.hidden = true; game.hidden = false; msg.hidden = true;
  reset(); running = true; last = 0;
  beep(440, 0.1); requestAnimationFrame(loop);
}

function toMenu() {
  running = false; msg.hidden = true;
  game.hidden = true; landing.hidden = false;
  showBest();
}

function move(d) { if (running && !paused) lane = Math.min(LANES - 1, Math.max(0, lane + d)); }

$('play').onclick = start;
$('menu').onclick = e => { e.preventDefault(); toMenu(); };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') move(-1);
  if (k === 'arrowright' || k === 'd') move(1);
  if (k === 'p' && running) paused = !paused;
});
let sx = null;
addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', e => {
  if (!running || sx === null || e.target.closest('button,a')) return;
  const x = e.changedTouches[0].clientX, dx = x - sx;
  if (Math.abs(dx) > 25) move(dx > 0 ? 1 : -1);
  else { const r = cv.getBoundingClientRect(); move(x < r.left + r.width / 2 ? -1 : 1); }
});

reset(); draw();