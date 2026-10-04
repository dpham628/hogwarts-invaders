(function () {
  'use strict';

  const W = 800;
  const H = 640;
  const HUD_H = 40;
  const PLAYER_Y = H - 30;
  const PLAYER_HALF_W = 16;
  const PLAYER_H = 58;
  const PLAYER_SPEED = 340;
  const SHOT_COOLDOWN = 0.42;
  const MAX_PLAYER_BOLTS = 2;
  const BOLT_SPEED = 600;
  const BOLT_LEN = 18;
  const ROWS = 5;
  const COLS = 11;
  const CELL_W = 50;
  const CELL_H = 42;
  const ENEMY_W = 34;
  const ENEMY_H = 30;
  const ENEMY_PAD = (CELL_W - ENEMY_W) / 2;
  const DROP = 20;
  const SIDE_MARGIN = 14;
  const SHIELD_COUNT = 4;
  const SHIELD_CELL = 4;
  const SHIELD_COLS = 20;
  const SHIELD_ROWS = 12;
  const SHIELD_Y = H - 170;
  const START_LIVES = 3;
  const DYING_S = 1.4;
  const LEVEL_CLEAR_S = 2.6;
  const INVULN_S = 2;
  const SNITCH_SPEED = 190;
  const ROW_TYPES = ['captain', 'eater', 'eater', 'dementor', 'dementor'];
  const POINTS = { captain: 40, eater: 20, dementor: 10 };
  const BEST_KEY = 'hogwarts-invaders-best';
  const SOUND_KEY = 'hogwarts-invaders-sound';
  const HERO_KEY = 'hogwarts-invaders-hero';
  const STUPEFY_EVERY = 10;
  const BIG_BOLT_LEN = 30;
  const BLAST_R = 44;
  const STUPEFY_BANNER_S = 1.1;
  const HEROES = {
    hermione: { name: 'Hermione', src: 'img/hermione.png?v=2' },
    harry: { name: 'Harry', src: 'img/harry.png?v=2' },
  };

  const $ = (sel) => document.querySelector(sel);
  const rand = (a, b) => a + Math.random() * (b - a);
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const els = {
    canvas: $('#game'),
    start: $('#start-screen'),
    startBtn: $('#start'),
    pause: $('#pause-screen'),
    resumeBtn: $('#resume'),
    gameover: $('#gameover-screen'),
    gameoverTitle: $('#gameover-title'),
    gameoverText: $('#gameover-text'),
    finalScore: $('#final-score'),
    finalLevel: $('#final-level'),
    newBest: $('#new-best'),
    restartBtn: $('#restart'),
    best: $('#best'),
    soundToggle: $('#sound-toggle'),
    pauseToggle: $('#pause-toggle'),
    heroToggle: $('#hero-toggle'),
    heroButtons: document.querySelectorAll('.hero-btn'),
  };
  const ctx = els.canvas.getContext('2d');

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  // ---------- Sound (Web Audio, synthesized) ----------
  const audio = { ctx: null, on: load(SOUND_KEY, 'on') !== 'off', noiseBuf: null };
  function ac() {
    if (!audio.on) return null;
    if (!audio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio.ctx = new Ctx();
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  }
  function tone(type, from, to, dur, gain = 0.06, delay = 0) {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function noise(dur, gain = 0.1, delay = 0) {
    const c = ac();
    if (!c) return;
    if (!audio.noiseBuf) {
      audio.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = audio.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = audio.noiseBuf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t0);
    filter.frequency.exponentialRampToValueAtTime(200, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
  const MARCH = [98, 92, 87, 82];
  const sfx = {
    cast() { tone('triangle', 900, 1900, 0.12, 0.05); tone('sine', 1800, 2800, 0.08, 0.025, 0.03); },
    enemyCast() { tone('sawtooth', 320, 150, 0.16, 0.02); },
    kill() { noise(0.2, 0.1); tone('square', 440, 90, 0.18, 0.03); },
    shield() { tone('sine', 560, 280, 0.08, 0.025); },
    clash() { tone('triangle', 1400, 700, 0.1, 0.04); },
    hurt() { noise(0.6, 0.18); tone('sawtooth', 320, 40, 0.7, 0.07); },
    snitch() { [0, 0.07, 0.14, 0.21].forEach((d, i) => tone('triangle', 1200 + i * 300, 1700 + i * 300, 0.09, 0.05, d)); },
    march(i) { const f = MARCH[i % 4]; tone('square', f, f * 0.92, 0.09, 0.04); },
    stupefy() { noise(0.35, 0.12); tone('sawtooth', 180, 900, 0.3, 0.06); tone('square', 900, 300, 0.4, 0.04, 0.1); },
    clear() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.24, 0.06, i * 0.13)); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.38, 0.045, i * 0.26)); },
  };

  // ---------- Sprites (canvas-drawn) ----------
  function drawWizard(g, x, y, t, wandReady, hero) {
    g.save();
    g.translate(x, y);
    const robe = g.createLinearGradient(0, -30, 0, 0);
    robe.addColorStop(0, '#2e2538');
    robe.addColorStop(1, '#120d18');
    g.fillStyle = robe;
    g.beginPath();
    g.moveTo(-18, 0);
    g.quadraticCurveTo(-15, -18, -8, -27);
    g.lineTo(8, -27);
    g.quadraticCurveTo(15, -18, 18, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = '#ae0001';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -25); g.lineTo(0, 0); g.stroke();
    // Scarf: red with gold stripes
    g.fillStyle = '#ae0001';
    g.fillRect(-8, -30, 16, 5);
    g.fillRect(2, -27, 5, 13);
    g.fillStyle = '#e8b923';
    g.fillRect(-4, -30, 2, 5);
    g.fillRect(3, -30, 2, 5);
    g.fillRect(2, -22, 5, 2);
    g.fillRect(2, -17, 5, 2);
    drawHead(g, hero);
    // Wand
    g.strokeStyle = '#7a4a22';
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(12, -18); g.lineTo(20, -40); g.stroke();
    if (wandReady) {
      g.shadowColor = '#ffd84a';
      g.shadowBlur = 10;
      g.fillStyle = '#fff3b0';
      g.beginPath(); g.arc(20, -41, 2.4, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawHead(g, heroKey) {
    const hero = HEROES[heroKey] || HEROES.hermione;
    const hy = -42;
    const hr = 15;
    if (heroKey === 'hermione') {
      g.fillStyle = '#5a3415';
      for (const [dx, dy, r] of [[-13, -2, 8], [13, -2, 8], [-11, 8, 7], [11, 8, 7], [0, -12, 10], [-9, -10, 8], [9, -10, 8], [-14, 6, 6], [14, 6, 6]]) {
        g.beginPath(); g.arc(dx, hy + dy, r, 0, Math.PI * 2); g.fill();
      }
    }
    if (hero.img && hero.img.complete && hero.img.naturalWidth) {
      g.drawImage(hero.img, -hr, hy - hr, hr * 2, hr * 2);
    } else {
      g.fillStyle = '#f1c9a5';
      g.beginPath(); g.arc(0, hy, hr, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#d4af37';
    g.lineWidth = 1.2;
    g.beginPath(); g.arc(0, hy, hr, 0, Math.PI * 2); g.stroke();
    if (heroKey === 'harry') {
      g.strokeStyle = 'rgba(15,15,15,0.85)';
      g.lineWidth = 1.3;
      g.beginPath(); g.arc(-5, hy + 1, 3.8, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(4, hy + 1, 3.8, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-1.2, hy + 0.5); g.lineTo(0.2, hy + 0.5); g.stroke();
      g.strokeStyle = '#ffd84a';
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-2, hy - 12); g.lineTo(-5, hy - 9); g.lineTo(-2, hy - 8); g.lineTo(-5, hy - 5); g.stroke();
    }
  }

  function aura(g, color, r) {
    const a = g.createRadialGradient(0, 0, 2, 0, 0, r);
    a.addColorStop(0, color);
    a.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = a;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  }

  function drawDementor(g, x, y, frame) {
    g.save();
    g.translate(x + ENEMY_W / 2, y + ENEMY_H / 2);
    aura(g, 'rgba(150,180,230,0.22)', 21);
    const cloak = g.createLinearGradient(0, -15, 0, 16);
    cloak.addColorStop(0, '#5a5f6e');
    cloak.addColorStop(1, '#1a1c24');
    g.fillStyle = cloak;
    g.beginPath();
    g.moveTo(0, -15);
    g.bezierCurveTo(10, -15, 13, -6, 13, 2);
    g.lineTo(16, 8);
    const tips = frame
      ? [[14, 15], [9, 10], [5, 16], [0, 11], [-5, 16], [-9, 10], [-14, 15]]
      : [[15, 12], [10, 16], [6, 10], [0, 16], [-6, 10], [-10, 16], [-15, 12]];
    tips.forEach(([px, py]) => g.lineTo(px, py));
    g.lineTo(-16, 8);
    g.lineTo(-13, 2);
    g.bezierCurveTo(-13, -6, -10, -15, 0, -15);
    g.fill();
    g.fillStyle = '#030305';
    g.beginPath(); g.ellipse(0, -5, 6, 7, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9aa0ad';
    g.lineWidth = 1.4;
    g.lineCap = 'round';
    const reach = frame ? -3 : 3;
    g.beginPath(); g.moveTo(12, 1); g.lineTo(18, reach); g.stroke();
    g.beginPath(); g.moveTo(-12, 1); g.lineTo(-18, reach); g.stroke();
    g.restore();
  }

  function drawDeathEater(g, x, y, frame, captain) {
    g.save();
    g.translate(x + ENEMY_W / 2, y + ENEMY_H / 2);
    aura(g, captain ? 'rgba(60,200,110,0.22)' : 'rgba(200,40,40,0.2)', 21);
    g.fillStyle = '#16161d';
    g.beginPath();
    g.moveTo(0, -16);
    g.quadraticCurveTo(12, -13, 12, -2);
    g.lineTo(15, 15);
    g.lineTo(-15, 15);
    g.lineTo(-12, -2);
    g.quadraticCurveTo(-12, -13, 0, -16);
    g.fill();
    g.strokeStyle = captain ? '#2fa35a' : '#4a4a5c';
    g.lineWidth = 1.5;
    g.stroke();
    const mask = g.createLinearGradient(0, -12, 0, 4);
    mask.addColorStop(0, '#f4f4f8');
    mask.addColorStop(1, '#8e94a0');
    g.fillStyle = mask;
    g.beginPath(); g.ellipse(0, -4, 6.5, 8, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b707c';
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(0, -6); g.moveTo(-4, 1); g.quadraticCurveTo(0, 3, 4, 1); g.stroke();
    if (captain) {
      g.shadowColor = '#ff2020';
      g.shadowBlur = frame ? 8 : 3;
      g.fillStyle = '#ff3030';
    } else {
      g.fillStyle = '#111';
    }
    g.fillRect(-4.5, -6, 3, 1.8);
    g.fillRect(1.5, -6, 3, 1.8);
    g.shadowBlur = 0;
    g.strokeStyle = '#8a5a2b';
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(11, 5); g.lineTo(18, frame ? -6 : 2); g.stroke();
    if (frame) {
      g.fillStyle = captain ? '#5dff8a' : '#ff6060';
      g.beginPath(); g.arc(18, -7, 1.6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawEnemy(g, type, x, y, frame) {
    if (type === 'dementor') drawDementor(g, x, y, frame);
    else drawDeathEater(g, x, y, frame, type === 'captain');
  }

  function drawSnitch(g, x, y, t) {
    const flap = Math.abs(Math.sin(t * 28));
    for (const side of [-1, 1]) {
      g.save();
      g.translate(x + side * 5, y - 1);
      g.scale(side, 1);
      g.rotate(-0.25 - flap * 0.55);
      g.fillStyle = 'rgba(245,245,255,0.88)';
      g.strokeStyle = '#d4af37';
      g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(11, 0, 12, 3.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(1, 0); g.lineTo(20, 0); g.stroke();
      g.restore();
    }
    g.save();
    g.shadowColor = '#ffd84a';
    g.shadowBlur = 14;
    const body = g.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
    body.addColorStop(0, '#fff6c2');
    body.addColorStop(0.5, '#e9b52a');
    body.addColorStop(1, '#8c630a');
    g.fillStyle = body;
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = '#8c630a';
    g.lineWidth = 0.7;
    g.beginPath(); g.arc(x, y, 4.5, 0.3, Math.PI - 0.3); g.stroke();
  }

  function drawHeart(g, x, y, s, filled) {
    g.save();
    g.translate(x, y);
    g.scale(s / 16, s / 16);
    g.beginPath();
    g.moveTo(0, 5);
    g.bezierCurveTo(-8, -1, -6, -9, 0, -5);
    g.bezierCurveTo(6, -9, 8, -1, 0, 5);
    g.closePath();
    g.fillStyle = filled ? '#c8141a' : 'rgba(255,255,255,0.08)';
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = '#d4af37';
    g.stroke();
    g.restore();
  }

  for (const h of Object.values(HEROES)) {
    h.img = new Image();
    h.img.onload = paintHeroPreviews;
    h.img.src = h.src;
  }

  // ---------- Background ----------
  const bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  (function paintBackground() {
    const g = bg.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04030a');
    sky.addColorStop(0.55, '#110b24');
    sky.addColorStop(1, '#1d1236');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const moon = g.createRadialGradient(690, 110, 4, 690, 110, 70);
    moon.addColorStop(0, 'rgba(255,248,220,0.95)');
    moon.addColorStop(0.35, 'rgba(255,240,200,0.55)');
    moon.addColorStop(0.4, 'rgba(255,240,200,0.12)');
    moon.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = moon;
    g.fillRect(600, 20, 180, 180);
    // Castle silhouette
    const base = H - 8;
    g.fillStyle = '#0b0815';
    const towers = [
      [30, 70, 22], [90, 120, 26], [160, 85, 20], [230, 150, 30], [300, 95, 22], [360, 175, 34],
      [430, 110, 24], [500, 140, 28], [570, 90, 22], [630, 125, 26], [700, 80, 22], [765, 105, 24],
    ];
    g.fillRect(0, base - 50, W, 58);
    for (const [cx, h, w] of towers) {
      g.fillRect(cx - w / 2, base - h, w, h);
      g.beginPath();
      g.moveTo(cx - w / 2 - 4, base - h);
      g.lineTo(cx, base - h - w * 1.3);
      g.lineTo(cx + w / 2 + 4, base - h);
      g.fill();
    }
    g.fillStyle = 'rgba(245,200,106,0.55)';
    for (const [cx, h, w] of towers) {
      for (let wy = base - h + 12; wy < base - 20; wy += 22) {
        if (Math.random() < 0.6) g.fillRect(cx - 2, wy, 4, 7);
      }
      if (w > 25 && Math.random() < 0.7) g.fillRect(cx - w / 4 - 1, base - h + 20, 3, 6);
    }
  })();

  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random() * W,
    y: HUD_H + Math.random() * (H - 200),
    r: Math.random() < 0.85 ? 1 : 2,
    phase: Math.random() * Math.PI * 2,
    speed: rand(0.6, 2.4),
  }));

  // ---------- Game state ----------
  const game = {
    state: 'start',
    resumeState: null,
    time: 0,
    timer: 0,
    level: 1,
    score: 0,
    best: Number(load(BEST_KEY, '0')) || 0,
    lives: START_LIVES,
    endReason: null,
    hero: HEROES[load(HERO_KEY, 'hermione')] ? load(HERO_KEY, 'hermione') : 'hermione',
    shots: 0,
    stupefy: 0,
    player: { x: W / 2, cooldown: 0, invuln: 0 },
    playerBolts: [],
    enemyBolts: [],
    enemies: [],
    alive: 0,
    fx: 0,
    fy: 0,
    dir: 1,
    frame: 0,
    beatTimer: 0,
    beat: 0,
    fireTimer: 0,
    shields: [],
    snitch: null,
    snitchTimer: 0,
    particles: [],
    texts: [],
    banner: 0,
  };
  const keys = { left: false, right: false, fire: false };

  function levelParams(level) {
    const l = level - 1;
    return {
      baseSpeed: Math.min(30 + l * 7, 75),
      fireInterval: Math.max(0.35, 1.1 - l * 0.1),
      boltSpeed: Math.min(230 + l * 25, 420),
      maxEnemyBolts: Math.min(3 + Math.floor(l / 2), 7),
      startY: HUD_H + 50 + Math.min(l, 6) * 12,
    };
  }

  function buildShields() {
    const shields = [];
    const width = SHIELD_COLS * SHIELD_CELL;
    for (let i = 0; i < SHIELD_COUNT; i++) {
      const cx = (W * (i + 1)) / (SHIELD_COUNT + 1);
      const cells = new Uint8Array(SHIELD_COLS * SHIELD_ROWS);
      for (let r = 0; r < SHIELD_ROWS; r++) {
        for (let c = 0; c < SHIELD_COLS; c++) {
          const cut = 3 - r;
          const corner = r < 3 && (c < cut || c > SHIELD_COLS - 1 - cut);
          const arch = r >= SHIELD_ROWS - 4 && c >= 6 && c <= SHIELD_COLS - 7 && !(r === SHIELD_ROWS - 4 && (c === 6 || c === SHIELD_COLS - 7));
          cells[r * SHIELD_COLS + c] = corner || arch ? 0 : 1;
        }
      }
      shields.push({ x: Math.round(cx - width / 2), y: SHIELD_Y, w: width, h: SHIELD_ROWS * SHIELD_CELL, cells });
    }
    return shields;
  }

  function enemyRect(e) {
    return { x: game.fx + e.c * CELL_W + ENEMY_PAD, y: game.fy + e.r * CELL_H, w: ENEMY_W, h: ENEMY_H };
  }

  function startLevel(level) {
    const p = levelParams(level);
    game.level = level;
    game.enemies = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) game.enemies.push({ r, c, type: ROW_TYPES[r], alive: true });
    }
    game.alive = game.enemies.length;
    game.fx = (W - COLS * CELL_W) / 2;
    game.fy = p.startY;
    game.dir = 1;
    game.playerBolts = [];
    game.enemyBolts = [];
    game.shields = buildShields();
    game.snitch = null;
    game.snitchTimer = rand(10, 18);
    game.fireTimer = 1.5;
    game.beatTimer = 0;
    game.player.x = W / 2;
    game.player.cooldown = 0.3;
    game.player.invuln = 0;
    game.banner = 1.8;
    game.state = 'playing';
  }

  function newGame() {
    game.score = 0;
    game.lives = START_LIVES;
    game.endReason = null;
    game.shots = 0;
    game.stupefy = 0;
    game.particles = [];
    game.texts = [];
    els.start.classList.add('hidden');
    els.gameover.classList.add('hidden');
    els.pause.classList.add('hidden');
    els.pauseToggle.disabled = false;
    startLevel(1);
  }

  function setPaused(paused) {
    if (paused && ['playing', 'dying', 'levelclear'].includes(game.state)) {
      game.resumeState = game.state;
      game.state = 'paused';
      els.pause.classList.remove('hidden');
      els.pauseToggle.textContent = 'Resume';
    } else if (!paused && game.state === 'paused') {
      game.state = game.resumeState;
      els.pause.classList.add('hidden');
      els.pauseToggle.textContent = 'Pause';
    }
  }

  function endGame() {
    game.state = 'gameover';
    const isBest = game.score > game.best;
    if (isBest) {
      game.best = game.score;
      save(BEST_KEY, String(game.best));
    }
    updateBest();
    const invaded = game.endReason === 'invasion';
    els.gameoverTitle.textContent = invaded ? 'Hogwarts Has Fallen' : 'The Dementors Prevail';
    els.gameoverText.textContent = invaded
      ? 'The Dark forces reached the castle walls.'
      : 'Your last life slipped away into the cold.';
    els.finalScore.textContent = game.score;
    els.finalLevel.textContent = game.level;
    els.newBest.classList.toggle('hidden', !isBest || game.score === 0);
    els.gameover.classList.remove('hidden');
    els.pauseToggle.disabled = true;
    sfx.over();
  }

  function updateBest() {
    els.best.textContent = game.best;
  }

  // ---------- Effects ----------
  function burst(x, y, colors, count, speed = 160) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(speed * 0.3, speed);
      game.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rand(0.35, 0.8), max: 0.8, size: rand(1.5, 3.2),
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }
  function floatText(x, y, text, color = '#f3d77a') {
    game.texts.push({ x, y, text, color, life: 1.1 });
  }

  // ---------- Shields ----------
  function hitShield(rect, chip) {
    for (const s of game.shields) {
      if (!overlap(rect, s)) continue;
      const c0 = Math.max(0, Math.floor((rect.x - s.x) / SHIELD_CELL));
      const c1 = Math.min(SHIELD_COLS - 1, Math.floor((rect.x + rect.w - 0.01 - s.x) / SHIELD_CELL));
      const r0 = Math.max(0, Math.floor((rect.y - s.y) / SHIELD_CELL));
      const r1 = Math.min(SHIELD_ROWS - 1, Math.floor((rect.y + rect.h - 0.01 - s.y) / SHIELD_CELL));
      const rows = [];
      for (let r = r0; r <= r1; r++) rows.push(r);
      if (chip === 'up') rows.reverse();
      for (const r of rows) {
        for (let c = c0; c <= c1; c++) {
          if (s.cells[r * SHIELD_COLS + c]) {
            damageShield(s, c, r);
            return { x: s.x + c * SHIELD_CELL + 2, y: s.y + r * SHIELD_CELL + 2 };
          }
        }
      }
    }
    return null;
  }
  function damageShield(s, c, r) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cc = c + dx;
        const rr = r + dy;
        if (cc < 0 || rr < 0 || cc >= SHIELD_COLS || rr >= SHIELD_ROWS) continue;
        const d = dx * dx + dy * dy;
        if (d === 0 || (d <= 2 && Math.random() < 0.8) || (d <= 5 && Math.random() < 0.35)) {
          s.cells[rr * SHIELD_COLS + cc] = 0;
        }
      }
    }
  }
  function erodeShields(rect) {
    for (const s of game.shields) {
      if (!overlap(rect, s)) continue;
      const c0 = Math.max(0, Math.floor((rect.x - s.x) / SHIELD_CELL));
      const c1 = Math.min(SHIELD_COLS - 1, Math.floor((rect.x + rect.w - s.x) / SHIELD_CELL));
      const r0 = Math.max(0, Math.floor((rect.y - s.y) / SHIELD_CELL));
      const r1 = Math.min(SHIELD_ROWS - 1, Math.floor((rect.y + rect.h - s.y) / SHIELD_CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) s.cells[r * SHIELD_COLS + c] = 0;
    }
  }

  // ---------- Update ----------
  function update(dt) {
    game.time += dt;
    for (const p of game.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy = p.vy * 0.97 + 40 * dt;
      p.life -= dt;
    }
    game.particles = game.particles.filter((p) => p.life > 0);
    for (const t of game.texts) { t.y -= 30 * dt; t.life -= dt; }
    game.texts = game.texts.filter((t) => t.life > 0);

    if (game.state === 'playing') updatePlaying(dt);
    else if (game.state === 'dying') {
      game.timer -= dt;
      if (game.timer <= 0) {
        if (game.lives <= 0) endGame();
        else {
          game.state = 'playing';
          game.player.x = W / 2;
          game.player.invuln = INVULN_S;
          game.player.cooldown = 0.3;
        }
      }
    } else if (game.state === 'levelclear') {
      game.timer -= dt;
      if (game.timer <= 0) startLevel(game.level + 1);
    }
  }

  function aliveSpeed() {
    const p = levelParams(game.level);
    const killed = 1 - game.alive / game.enemies.length;
    return p.baseSpeed * (1 + 5 * Math.pow(killed, 1.6));
  }

  function updatePlaying(dt) {
    const pl = game.player;
    const p = levelParams(game.level);
    game.banner = Math.max(0, game.banner - dt);
    game.stupefy = Math.max(0, game.stupefy - dt);

    // Player
    const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    pl.x = Math.max(24, Math.min(W - 24, pl.x + move * PLAYER_SPEED * dt));
    pl.cooldown -= dt;
    pl.invuln = Math.max(0, pl.invuln - dt);
    if (keys.fire && pl.cooldown <= 0 && game.playerBolts.length < MAX_PLAYER_BOLTS) {
      game.shots++;
      const big = game.shots % STUPEFY_EVERY === 0;
      const len = big ? BIG_BOLT_LEN : BOLT_LEN;
      game.playerBolts.push({ x: pl.x + 20, y: PLAYER_Y - 42 - len, len, big });
      pl.cooldown = SHOT_COOLDOWN;
      if (big) {
        game.stupefy = STUPEFY_BANNER_S;
        sfx.stupefy();
      } else {
        sfx.cast();
      }
    }

    // Formation
    const speed = aliveSpeed();
    game.fx += game.dir * speed * dt;
    let minC = COLS;
    let maxC = -1;
    let maxR = -1;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (e.c < minC) minC = e.c;
      if (e.c > maxC) maxC = e.c;
      if (e.r > maxR) maxR = e.r;
    }
    const left = game.fx + minC * CELL_W + ENEMY_PAD;
    const right = game.fx + maxC * CELL_W + ENEMY_PAD + ENEMY_W;
    if (game.dir > 0 && right > W - SIDE_MARGIN) {
      game.fx -= right - (W - SIDE_MARGIN);
      game.dir = -1;
      game.fy += DROP;
    } else if (game.dir < 0 && left < SIDE_MARGIN) {
      game.fx += SIDE_MARGIN - left;
      game.dir = 1;
      game.fy += DROP;
    }
    game.beatTimer -= dt;
    if (game.beatTimer <= 0) {
      game.beatTimer = Math.max(0.11, 26 / speed);
      game.frame ^= 1;
      sfx.march(game.beat++);
    }

    // Player bolts
    for (const b of game.playerBolts) b.y -= BOLT_SPEED * dt;
    game.playerBolts = game.playerBolts.filter((b) => {
      const half = b.big ? 10 : 4;
      const rect = { x: b.x - half, y: b.y, w: half * 2, h: b.len };
      if (b.y + b.len < HUD_H) return false;
      const hit = hitShield(rect, 'up');
      if (hit) { burst(hit.x, hit.y, ['#7fd6ff', '#cfefff'], 6, 90); sfx.shield(); return false; }
      for (let i = 0; i < game.enemyBolts.length; i++) {
        const eb = game.enemyBolts[i];
        if (overlap(rect, { x: eb.x - 5, y: eb.y - 8, w: 10, h: 16 })) {
          game.enemyBolts.splice(i, 1);
          burst(b.x, b.y, ['#ffe66b', '#fff', '#5dff8a'], 10, 110);
          game.score += 5;
          sfx.clash();
          if (b.big) { i--; continue; }
          return false;
        }
      }
      if (game.snitch && overlap(rect, { x: game.snitch.x - 16, y: game.snitch.y - 9, w: 32, h: 18 })) {
        const pts = [150, 200, 300][(Math.random() * 3) | 0] + 50 * (game.level - 1);
        game.score += pts;
        floatText(game.snitch.x, game.snitch.y, `+${pts} Snitch!`);
        burst(game.snitch.x, game.snitch.y, ['#ffd84a', '#fff3b0', '#e9b52a'], 26, 200);
        game.snitch = null;
        sfx.snitch();
        return false;
      }
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const er = enemyRect(e);
        if (overlap(rect, er)) {
          const cx = er.x + ENEMY_W / 2;
          const cy = er.y + ENEMY_H / 2;
          killEnemy(e);
          if (b.big) {
            for (const o of game.enemies) {
              if (!o.alive) continue;
              const or = enemyRect(o);
              if (Math.hypot(or.x + ENEMY_W / 2 - cx, or.y + ENEMY_H / 2 - cy) <= BLAST_R) killEnemy(o);
            }
            burst(cx, cy, ['#ff3b3b', '#ffd84a', '#ffffff'], 40, 260);
          }
          return false;
        }
      }
      return true;
    });

    // Enemy fire
    game.fireTimer -= dt;
    if (game.fireTimer <= 0 && game.alive > 0) {
      game.fireTimer = p.fireInterval * rand(0.5, 1.5);
      if (game.enemyBolts.length < p.maxEnemyBolts) {
        const shooters = new Map();
        for (const e of game.enemies) {
          if (e.alive && (!shooters.has(e.c) || shooters.get(e.c).r < e.r)) shooters.set(e.c, e);
        }
        const list = [...shooters.values()];
        let shooter = list[(Math.random() * list.length) | 0];
        if (Math.random() < 0.4) {
          shooter = list.reduce((best, e) => {
            const d = Math.abs(enemyRect(e).x + ENEMY_W / 2 - pl.x);
            return d < Math.abs(enemyRect(best).x + ENEMY_W / 2 - pl.x) ? e : best;
          }, list[0]);
        }
        const r = enemyRect(shooter);
        game.enemyBolts.push({ x: r.x + ENEMY_W / 2, y: r.y + ENEMY_H + 6, kind: shooter.type === 'dementor' ? 'chill' : 'curse', t: Math.random() * 10 });
        sfx.enemyCast();
      }
    }

    // Enemy bolts
    const playerRect = { x: pl.x - PLAYER_HALF_W, y: PLAYER_Y - 44, w: PLAYER_HALF_W * 2, h: 44 };
    for (const b of game.enemyBolts) { b.y += p.boltSpeed * dt; b.t += dt; }
    game.enemyBolts = game.enemyBolts.filter((b) => {
      const rect = { x: b.x - 4, y: b.y - 8, w: 8, h: 14 };
      if (b.y - 10 > H) return false;
      const hit = hitShield(rect, 'down');
      if (hit) { burst(hit.x, hit.y, ['#7fd6ff', '#cfefff'], 6, 90); sfx.shield(); return false; }
      if (game.state === 'playing' && pl.invuln <= 0 && overlap(rect, playerRect)) {
        playerHit();
        return false;
      }
      return true;
    });

    // Enemies touching shields / reaching the castle
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const er = enemyRect(e);
      if (er.y + er.h >= SHIELD_Y) erodeShields(er);
      if (er.y + er.h >= PLAYER_Y - PLAYER_H + 8 && game.state === 'playing') {
        game.endReason = 'invasion';
        game.lives = 0;
        playerHit();
        break;
      }
    }

    // Snitch
    if (game.snitch) {
      const s = game.snitch;
      s.t += dt;
      s.x += s.dir * SNITCH_SPEED * dt;
      s.y = HUD_H + 26 + Math.sin(s.t * 5) * 10 + Math.sin(s.t * 1.7) * 6;
      if (s.x < -40 || s.x > W + 40) game.snitch = null;
    } else {
      game.snitchTimer -= dt;
      if (game.snitchTimer <= 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        game.snitch = { x: dir > 0 ? -30 : W + 30, y: HUD_H + 26, dir, t: 0 };
        game.snitchTimer = rand(14, 26);
        sfx.snitch();
      }
    }

    if (game.state === 'playing' && game.alive === 0) {
      game.state = 'levelclear';
      game.timer = LEVEL_CLEAR_S;
      game.enemyBolts = [];
      game.playerBolts = [];
      game.snitch = null;
      sfx.clear();
    }
  }

  function killEnemy(e) {
    const er = enemyRect(e);
    e.alive = false;
    game.alive--;
    game.score += POINTS[e.type];
    const colors = e.type === 'dementor' ? ['#9fb4d8', '#e4ecff', '#5a5f6e'] : ['#ff5a36', '#f3d77a', '#ffffff'];
    burst(er.x + ENEMY_W / 2, er.y + ENEMY_H / 2, colors, 18);
    floatText(er.x + ENEMY_W / 2, er.y, `+${POINTS[e.type]}`);
    sfx.kill();
  }

  function playerHit() {
    if (game.state !== 'playing') return;
    if (game.lives > 0) game.lives--;
    burst(game.player.x, PLAYER_Y - 24, ['#ffd84a', '#ff5a36', '#ffffff', '#ae0001'], 40, 220);
    game.state = 'dying';
    game.timer = DYING_S;
    game.stupefy = 0;
    game.enemyBolts = [];
    game.playerBolts = [];
    sfx.hurt();
  }

  // ---------- Render ----------
  function render() {
    const g = ctx;
    const t = game.time;
    g.drawImage(bg, 0, 0, W, H);

    g.fillStyle = '#fff8e1';
    for (const s of stars) {
      g.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(t * s.speed + s.phase));
      g.fillRect(s.x, s.y, s.r, s.r);
    }
    g.globalAlpha = 1;

    // Shields
    const shimmer = 0.75 + 0.2 * Math.sin(t * 3);
    g.save();
    g.shadowColor = '#5fc8ff';
    g.shadowBlur = 8;
    for (const s of game.shields) {
      for (let r = 0; r < SHIELD_ROWS; r++) {
        g.fillStyle = `rgba(${110 + r * 6}, ${200 + r * 3}, 255, ${shimmer})`;
        for (let c = 0; c < SHIELD_COLS; c++) {
          if (s.cells[r * SHIELD_COLS + c]) g.fillRect(s.x + c * SHIELD_CELL, s.y + r * SHIELD_CELL, SHIELD_CELL, SHIELD_CELL);
        }
      }
    }
    g.restore();

    for (const e of game.enemies) {
      if (!e.alive) continue;
      const r = enemyRect(e);
      drawEnemy(g, e.type, r.x, r.y, game.frame);
    }

    if (game.snitch) drawSnitch(g, game.snitch.x, game.snitch.y, t);

    const pl = game.player;
    const showPlayer = game.state !== 'dying' && game.state !== 'gameover' && !(pl.invuln > 0 && Math.floor(t * 12) % 2);
    if (showPlayer) drawWizard(g, pl.x, PLAYER_Y, t, pl.cooldown <= 0, game.hero);

    // Player spells: lightning bolts
    g.save();
    g.lineJoin = 'round';
    g.shadowColor = '#ffcc33';
    g.shadowBlur = 12;
    for (const b of game.playerBolts) {
      const k = b.len / BOLT_LEN;
      const path = [[b.x + 1 * k, b.y], [b.x + 4 * k, b.y + 6 * k], [b.x - 3 * k, b.y + 9 * k], [b.x + 2 * k, b.y + b.len]];
      if (b.big) {
        g.shadowColor = '#ff2a2a';
        g.shadowBlur = 22;
        g.fillStyle = 'rgba(255,60,60,0.35)';
        g.beginPath(); g.arc(b.x, b.y + 4, 13, 0, Math.PI * 2); g.fill();
      } else {
        g.shadowColor = '#ffcc33';
        g.shadowBlur = 12;
      }
      g.strokeStyle = b.big ? '#ff3b3b' : '#ffd84a';
      g.lineWidth = b.big ? 7 : 3.5;
      g.beginPath(); path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = b.big ? 2.5 : 1.2;
      g.stroke();
    }
    g.restore();

    // Enemy spells
    g.save();
    for (const b of game.enemyBolts) {
      const color = b.kind === 'chill' ? '#a9dcff' : '#39ff6a';
      g.shadowColor = color;
      g.shadowBlur = 12;
      g.strokeStyle = color;
      g.globalAlpha = 0.6;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const yy = b.y - 6 - i * 2.5;
        const xx = b.x + Math.sin(b.t * 20 + i) * 2.5;
        i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
      }
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = color;
      g.beginPath(); g.arc(b.x, b.y, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(b.x, b.y, 1.6, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    for (const p of game.particles) {
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;

    g.textAlign = 'center';
    g.font = 'bold 15px "Palatino Linotype", Palatino, Georgia, serif';
    for (const tx of game.texts) {
      g.globalAlpha = Math.min(1, tx.life * 2);
      g.fillStyle = tx.color;
      g.fillText(tx.text, tx.x, tx.y);
    }
    g.globalAlpha = 1;

    renderHud(g);

    if (game.stupefy > 0 && game.state === 'playing') {
      const age = STUPEFY_BANNER_S - game.stupefy;
      const pop = 1 + 0.5 * Math.max(0, 1 - age / 0.18);
      g.save();
      g.globalAlpha = Math.min(1, game.stupefy / 0.3);
      g.translate(W / 2, H * 0.42);
      g.scale(pop, pop);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'bold 68px "Palatino Linotype", Palatino, Georgia, serif';
      g.shadowColor = '#ff2a2a';
      g.shadowBlur = 24;
      g.lineWidth = 6;
      g.strokeStyle = '#d4af37';
      g.strokeText('STUPEFY!!!', 0, 0);
      g.fillStyle = '#e8141c';
      g.fillText('STUPEFY!!!', 0, 0);
      g.restore();
    }

    if (game.state === 'levelclear') {
      banner(g, 'Mischief Managed!', `Level ${game.level} cleared \u2014 brace yourself for level ${game.level + 1}`);
    } else if (game.state === 'playing' && game.banner > 0) {
      g.globalAlpha = Math.min(1, game.banner * 1.5);
      banner(g, `Level ${game.level}`, game.level === 1 ? 'Defend Hogwarts!' : 'They are faster now\u2026');
      g.globalAlpha = 1;
    }
  }

  function banner(g, title, sub) {
    g.save();
    g.textAlign = 'center';
    g.fillStyle = 'rgba(5,3,12,0.55)';
    g.fillRect(0, H / 2 - 60, W, 100);
    g.shadowColor = '#d4af37';
    g.shadowBlur = 16;
    g.fillStyle = '#f3d77a';
    g.font = 'bold 40px "Palatino Linotype", Palatino, Georgia, serif';
    g.fillText(title, W / 2, H / 2 - 8);
    g.shadowBlur = 0;
    g.fillStyle = '#f1e9d6';
    g.font = 'italic 18px "Palatino Linotype", Palatino, Georgia, serif';
    g.fillText(sub, W / 2, H / 2 + 24);
    g.restore();
  }

  function renderHud(g) {
    g.fillStyle = 'rgba(5,3,12,0.7)';
    g.fillRect(0, 0, W, HUD_H);
    g.fillStyle = '#ae0001';
    g.fillRect(0, HUD_H - 3, W, 1);
    g.fillStyle = '#d4af37';
    g.fillRect(0, HUD_H - 2, W, 2);
    g.font = 'bold 17px "Palatino Linotype", Palatino, Georgia, serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = '#a99d84';
    g.fillText('SCORE', 16, HUD_H / 2);
    g.fillStyle = '#f3d77a';
    g.fillText(String(game.score).padStart(5, '0'), 82, HUD_H / 2);
    g.textAlign = 'center';
    g.fillStyle = '#a99d84';
    g.fillText('LEVEL', W / 2 - 18, HUD_H / 2);
    g.fillStyle = '#f3d77a';
    g.fillText(String(game.level), W / 2 + 30, HUD_H / 2);
    const toGo = STUPEFY_EVERY - (game.shots % STUPEFY_EVERY);
    g.textAlign = 'left';
    g.font = 'bold 14px "Palatino Linotype", Palatino, Georgia, serif';
    if (toGo === 1) {
      g.fillStyle = Math.floor(game.time * 4) % 2 ? '#ff3b3b' : '#f3d77a';
      g.fillText('STUPEFY READY', 478, HUD_H / 2);
    } else {
      g.fillStyle = '#a99d84';
      g.fillText(`STUPEFY IN ${toGo}`, 478, HUD_H / 2);
    }
    g.font = 'bold 17px "Palatino Linotype", Palatino, Georgia, serif';
    g.textAlign = 'right';
    g.fillStyle = '#a99d84';
    g.fillText('LIVES', W - 106, HUD_H / 2);
    for (let i = 0; i < START_LIVES; i++) drawHeart(g, W - 84 + i * 28, HUD_H / 2 + 1, 22, i < game.lives);
    g.textBaseline = 'alphabetic';
  }

  // ---------- Canvas sizing ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = els.canvas.getBoundingClientRect();
    const scale = Math.max(1, (rect.width / W) * dpr);
    els.canvas.width = Math.round(W * scale);
    els.canvas.height = Math.round(H * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function paintLegend() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    document.querySelectorAll('canvas.sprite').forEach((cv) => {
      const g = cv.getContext('2d');
      cv.width = 48 * dpr;
      cv.height = 40 * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const type = cv.dataset.sprite;
      if (type === 'snitch') drawSnitch(g, 24, 20, 0.05);
      else drawEnemy(g, type, 7, 5, 1);
    });
  }

  // ---------- Input ----------
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire' };
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) e.preventDefault();
    const k = KEYMAP[e.code];
    if (k) {
      keys[k] = true;
      e.preventDefault();
    }
    if (e.code === 'Enter' || (e.code === 'Space' && !e.repeat)) {
      if (game.state === 'start' || game.state === 'gameover') { e.preventDefault(); newGame(); return; }
    }
    if (e.code === 'KeyP' || e.code === 'Escape') setPaused(game.state !== 'paused');
    if (e.code === 'KeyM') toggleSound();
    if (game.state === 'start' || game.state === 'gameover') {
      if (e.code === 'Digit1') setHero('hermione');
      if (e.code === 'Digit2') setHero('harry');
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.fire = false;
    setPaused(true);
  });
  document.querySelectorAll('.touch-controls [data-key]').forEach((btn) => {
    const k = btn.dataset.key;
    const down = (e) => {
      e.preventDefault();
      if (game.state === 'start' || game.state === 'gameover') newGame();
      keys[k] = true;
    };
    const up = (e) => { e.preventDefault(); keys[k] = false; };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  function paintHeroPreviews() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    document.querySelectorAll('canvas.hero-preview').forEach((cv) => {
      const g = cv.getContext('2d');
      cv.width = 64 * dpr;
      cv.height = 72 * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, 64, 72);
      drawWizard(g, 28, 70, 0, true, cv.dataset.hero);
    });
  }
  function setHero(key) {
    if (!HEROES[key]) return;
    game.hero = key;
    save(HERO_KEY, key);
    els.heroButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.hero === key)));
    els.heroToggle.textContent = `Wizard: ${HEROES[key].name}`;
  }

  function toggleSound() {
    audio.on = !audio.on;
    save(SOUND_KEY, audio.on ? 'on' : 'off');
    renderSoundToggle();
  }
  function renderSoundToggle() {
    els.soundToggle.textContent = `Sound: ${audio.on ? 'on' : 'off'}`;
    els.soundToggle.setAttribute('aria-pressed', String(audio.on));
  }

  els.startBtn.addEventListener('click', newGame);
  els.restartBtn.addEventListener('click', newGame);
  els.resumeBtn.addEventListener('click', () => setPaused(false));
  els.pauseToggle.addEventListener('click', () => setPaused(game.state !== 'paused'));
  els.soundToggle.addEventListener('click', toggleSound);
  els.heroToggle.addEventListener('click', () => setHero(game.hero === 'hermione' ? 'harry' : 'hermione'));
  els.heroButtons.forEach((b) => b.addEventListener('click', () => setHero(b.dataset.hero)));
  window.addEventListener('resize', resize);

  // ---------- Boot ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.state !== 'paused') update(dt);
    render();
    requestAnimationFrame(loop);
  }

  startLevel(1);
  game.state = 'start';
  game.banner = 0;
  updateBest();
  renderSoundToggle();
  paintLegend();
  paintHeroPreviews();
  setHero(game.hero);
  resize();
  requestAnimationFrame(loop);

  window.HogwartsInvaders = { game, keys, newGame, startLevel };
})();
