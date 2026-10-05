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
  const BLAST_R = 50;
  const STUPEFY_BANNER_S = 1.1;
  const DRAGON_EVERY = 20;
  const DRAGON_HEAD_HP = 3;
  const DRAGON_SPEED = 85;
  const DRAGON_DESCENT = 18;
  const DRAGON_HEAD_X = 104;
  const DRAGON_HEAD_Y = -22;
  const DRAGON_HEAD_R = 27;
  const DRAGON_SCALE = 1.3;
  const DRAGON_LAND_Y = PLAYER_Y - 6 - 47 * DRAGON_SCALE;
  const DRAGON_BANNER_S = 2.2;
  const SPIDER_EVERY = 30;
  const SPIDER_COUNT = 3;
  const SPIDER_R = 20;
  const SPIDER_LAND_Y = PLAYER_Y - 18 - SPIDER_R;
  const ROCK_SPEED = 400;
  const DIFF_KEY = 'hogwarts-invaders-difficulty';
  const DIFFICULTY = {
    easy: { name: 'Kids', lives: 5, enemySpeed: 0.6, speedup: 3, fireInterval: 1.9, boltSpeed: 0.65, enemyBolts: 0.5, shotCooldown: 0.3, playerBolts: 3, drop: 12, dragonDescent: 0.6, dragonHp: 2, spiderSpeed: 0.6 },
    normal: { name: 'Normal', lives: 3, enemySpeed: 1, speedup: 5, fireInterval: 1, boltSpeed: 1, enemyBolts: 1, shotCooldown: SHOT_COOLDOWN, playerBolts: MAX_PLAYER_BOLTS, drop: DROP, dragonDescent: 1, dragonHp: DRAGON_HEAD_HP, spiderSpeed: 1 },
  };
  const HEROES = {
    hermione: { name: 'Hermione', src: 'img/hermione.png?v=2' },
    harry: { name: 'Harry', src: 'img/harry.png?v=2' },
  };

  const DRAGON_FACE = new Image();
  DRAGON_FACE.src = 'img/dragon-face.png?v=1';
  const SPIDER_FACE = new Image();
  SPIDER_FACE.src = 'img/spider-face.png?v=2';

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
    modeToggle: $('#mode-toggle'),
    modeButtons: document.querySelectorAll('.mode-btn'),
    livesCount: $('#lives-count'),
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
    march(i) { const f = MARCH[i % 4]; tone('square', f, f * 0.92, 0.09, 0.025); },
    roar() { noise(1.4, 0.22); tone('sawtooth', 130, 45, 1.4, 0.09); tone('square', 70, 38, 1.2, 0.05, 0.1); },
    dragonHit() { noise(0.25, 0.14); tone('sawtooth', 220, 90, 0.3, 0.07); },
    dragonArmor() { tone('square', 1500, 900, 0.05, 0.02); },
    fart() {
      const c = ac();
      if (!c) return;
      const t0 = c.currentTime;
      const dur = 1.7;
      const o = c.createOscillator();
      const wobble = c.createOscillator();
      const wobbleAmt = c.createGain();
      const filter = c.createBiquadFilter();
      const amp = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t0);
      o.frequency.linearRampToValueAtTime(70, t0 + dur * 0.6);
      o.frequency.linearRampToValueAtTime(48, t0 + dur);
      wobble.type = 'sine';
      wobble.frequency.setValueAtTime(24, t0);
      wobble.frequency.linearRampToValueAtTime(9, t0 + dur);
      wobbleAmt.gain.value = 32;
      wobble.connect(wobbleAmt).connect(o.frequency);
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      filter.Q.value = 6;
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.linearRampToValueAtTime(0.32, t0 + 0.04);
      amp.gain.setValueAtTime(0.3, t0 + dur * 0.7);
      amp.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(filter).connect(amp).connect(c.destination);
      o.start(t0); wobble.start(t0);
      o.stop(t0 + dur + 0.05); wobble.stop(t0 + dur + 0.05);
      noise(1.3, 0.07);
      tone('square', 170, 300, 0.16, 0.04, dur - 0.05);
    },
    spiders() { [0, 0.12, 0.24].forEach((d, i) => tone('sawtooth', 660 - i * 90, 300 - i * 60, 0.22, 0.03, d)); },
    spiderDie() { noise(0.18, 0.1); tone('square', 900, 200, 0.16, 0.04); },
    rockRain() { noise(0.9, 0.14); tone('sawtooth', 90, 60, 0.8, 0.05); },
    rock() { noise(0.25, 0.14); tone('square', 140, 60, 0.18, 0.04); },
    stupefy() { noise(0.35, 0.12); tone('sawtooth', 180, 900, 0.3, 0.06); tone('square', 900, 300, 0.4, 0.04, 0.1); },
    clear() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.24, 0.06, i * 0.13)); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.38, 0.045, i * 0.26)); },
  };

  // ---------- Music: original upbeat waltz (synthesized) ----------
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MELODY = [
    [[71, 2], [76, 1], [79, 1], [78, 2]],
    [[76, 3], [72, 1], [74, 1], [76, 1]],
    [[72, 2], [69, 1], [72, 1], [76, 2]],
    [[75, 4], [71, 2]],
    [[71, 2], [76, 1], [79, 1], [83, 2]],
    [[81, 2], [79, 1], [78, 1], [79, 2]],
    [[76, 2], [72, 1], [75, 1], [78, 2]],
    [[76, 4], [0, 2]],
  ];
  const CHORDS = { Em: [40, [55, 59, 64]], C: [36, [55, 60, 64]], Am: [45, [57, 60, 64]], B7: [35, [54, 59, 63]], G: [43, [55, 59, 62]] };
  const PROGRESSION = ['Em', 'C', 'Am', 'B7', 'Em', 'G', 'Am', 'Em'];
  const STEP_S = 60 / 168 / 2;
  const music = { next: 0, step: 0, notes: null };
  music.notes = (() => {
    const out = [];
    MELODY.forEach((bar) => bar.forEach(([n, len]) => {
      out.push([n, len]);
      for (let i = 1; i < len; i++) out.push(null);
    }));
    return out;
  })();
  music.tick = function () {
    const active = ['playing', 'dying', 'levelclear'].includes(game.state);
    if (!active || !audio.on) { music.next = 0; return; }
    const c = ac();
    if (!c) return;
    if (music.next < c.currentTime) music.next = c.currentTime + 0.05;
    while (music.next < c.currentTime + 0.15) {
      const d = music.next - c.currentTime;
      const i = music.step % music.notes.length;
      const bar = Math.floor(i / 6);
      const beatStep = i % 6;
      const [root, triad] = CHORDS[PROGRESSION[bar]];
      if (beatStep === 0) tone('triangle', midi(root), midi(root), 0.32, 0.055, d);
      if (beatStep === 2 || beatStep === 4) triad.forEach((n) => tone('sine', midi(n), midi(n), 0.14, 0.012, d));
      if (beatStep % 2 === 1) tone('square', 6000, 5000, 0.02, 0.004, d);
      const note = music.notes[i];
      if (note && note[0]) {
        const f = midi(note[0]);
        const len = note[1] * STEP_S;
        tone('triangle', f, f, len * 1.2, 0.03, d);
        tone('sine', f * 2, f * 2, len * 0.7, 0.012, d);
      }
      music.step++;
      music.next += STEP_S;
    }
  };

  // ---------- Sprites (canvas-drawn) ----------
  function drawBats(g, t) {
    g.save();
    g.fillStyle = '#07040c';
    g.strokeStyle = 'rgba(170,150,210,0.45)';
    g.lineWidth = 1;
    for (const b of bats) {
      const span = W + 120;
      let x = ((b.phase + t * b.speed) % 1 + 1) % 1 * span - 60;
      if (b.speed < 0) x = span - x - 120;
      const y = b.y + Math.sin(t * 1.3 + b.phase) * b.amp;
      const flap = Math.sin(t * 14 + b.phase * 3);
      const k = b.size;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x - 7 * k, y - 10 * k * flap, x - 16 * k, y - 4 * k * flap);
      g.quadraticCurveTo(x - 10 * k, y + 1 * k, x - 4 * k, y + 2 * k);
      g.lineTo(x, y + 4 * k);
      g.lineTo(x + 4 * k, y + 2 * k);
      g.quadraticCurveTo(x + 10 * k, y + 1 * k, x + 16 * k, y - 4 * k * flap);
      g.quadraticCurveTo(x + 7 * k, y - 10 * k * flap, x, y);
      g.fill();
      g.stroke();
      g.beginPath(); g.arc(x, y + 1 * k, 2.6 * k, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff3b1a';
      g.fillRect(x - 1.4 * k, y, 0.9 * k, 0.9 * k);
      g.fillRect(x + 0.5 * k, y, 0.9 * k, 0.9 * k);
      g.fillStyle = '#07040c';
    }
    g.restore();
  }

  function drawSpider(g, sp) {
    const R = SPIDER_R;
    const t = sp.t;
    g.save();
    g.strokeStyle = 'rgba(230,230,240,0.55)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(sp.ax, HUD_H); g.quadraticCurveTo(sp.ax, (HUD_H + sp.y) / 2, sp.x, sp.y - R - 22); g.stroke();
    g.translate(sp.x, sp.y);
    g.strokeStyle = '#120d18';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const wig = Math.sin(t * 6 + i * 1.3 + (side > 0 ? 1 : 0)) * 3;
        const by = -R * 0.55 + i * 7;
        g.beginPath();
        g.moveTo(side * R * 0.6, by);
        g.lineTo(side * (R + 14), by - 14 + i * 5 + wig);
        g.lineTo(side * (R + 22), by + 6 + i * 6 - wig);
        g.stroke();
      }
    }
    g.fillStyle = '#17121e';
    g.beginPath(); g.ellipse(0, -R - 8, 15, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c4141c';
    g.beginPath(); g.moveTo(-4, -R - 14); g.lineTo(4, -R - 14); g.lineTo(-4, -R - 4); g.lineTo(4, -R - 4); g.closePath(); g.fill();
    g.fillStyle = '#17121e';
    g.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const rr = i % 2 ? R + 2 : R + 6;
      i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(rr, 0);
    }
    g.closePath();
    g.fill();
    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
    if (SPIDER_FACE.complete && SPIDER_FACE.naturalWidth) g.drawImage(SPIDER_FACE, -R, -R, R * 2, R * 2);
    else { g.fillStyle = '#c99a80'; g.fillRect(-R, -R, R * 2, R * 2); }
    const vig = g.createRadialGradient(0, 0, R * 0.6, 0, 0, R);
    vig.addColorStop(0, 'rgba(6,4,12,0.45)');
    vig.addColorStop(1, 'rgba(4,6,0,0.9)');
    g.fillStyle = vig;
    g.fillRect(-R, -R, R * 2, R * 2);
    g.restore();
    g.fillStyle = '#ff2a1a';
    for (const [ex, ey] of [[-6, -15], [-2, -17], [2, -17], [6, -15]]) { g.beginPath(); g.arc(ex, ey, 1.4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#f4efe2';
    for (const fx of [-4, 4]) { g.beginPath(); g.moveTo(fx - 2, R * 0.55); g.lineTo(fx, R * 0.55 + 9); g.lineTo(fx + 2, R * 0.55); g.closePath(); g.fill(); }
    g.restore();
  }

  function drawRock(g, r) {
    g.save();
    g.translate(r.x, r.y);
    g.rotate(r.rot);
    g.fillStyle = r.target ? '#6e6255' : '#5a5048';
    g.strokeStyle = '#2a2420';
    g.lineWidth = 1.5;
    g.beginPath();
    r.shape.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,240,220,0.18)';
    g.beginPath(); g.arc(-r.size * 0.3, -r.size * 0.3, r.size * 0.3, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawDragonWing(g, flap, fill, edge) {
    const sy = -14;
    const tips = [[-18, sy - 100 * flap], [-70, sy - 82 * flap], [-112, sy - 46 * flap], [-128, sy - 6 * flap + 4]];
    g.fillStyle = fill;
    g.strokeStyle = edge;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(22, sy);
    g.lineTo(tips[0][0], tips[0][1]);
    let prev = tips[0];
    for (let i = 1; i < tips.length; i++) {
      const tp = tips[i];
      g.quadraticCurveTo((prev[0] + tp[0]) / 2 + 6, (prev[1] + tp[1]) / 2 + 16 * Math.sign(flap || 1), tp[0], tp[1]);
      prev = tp;
    }
    g.quadraticCurveTo(-90, 4, -40, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#3b3046';
    g.lineWidth = 2.5;
    for (const tp of tips) { g.beginPath(); g.moveTo(14, sy); g.lineTo(tp[0], tp[1]); g.stroke(); }
  }

  function drawDragon(g, d) {
    const t = d.t;
    const beat = Math.sin(t * 3.4);
    g.save();
    g.translate(d.x, d.y + Math.sin(t * 3.4 + 1) * 4);
    g.scale(d.dir * DRAGON_SCALE, DRAGON_SCALE);

    g.save();
    g.shadowColor = '#ff2a00';
    g.shadowBlur = 30;
    drawDragonWing(g, 0.35 + 0.65 * beat * -1, '#0d0a12', '#2a2233');
    g.restore();

    // Tail
    g.strokeStyle = '#120e18';
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-40, 4);
    g.quadraticCurveTo(-95, 30 + Math.sin(t * 2) * 10, -150, 8 + Math.sin(t * 2 + 1) * 14);
    g.stroke();
    g.lineWidth = 6;
    g.beginPath();
    const tx = -150;
    const ty = 8 + Math.sin(t * 2 + 1) * 14;
    g.moveTo(tx, ty);
    g.lineTo(tx - 14, ty - 8);
    g.lineTo(tx - 6, ty + 2);
    g.lineTo(tx - 16, ty + 10);
    g.closePath();
    g.fillStyle = '#120e18';
    g.fill();
    g.stroke();

    // Legs and claws
    g.lineWidth = 7;
    for (const lx of [-22, 22]) {
      g.beginPath();
      g.moveTo(lx, 12);
      g.lineTo(lx + 6, 30);
      g.lineTo(lx + 2, 40);
      g.stroke();
      g.strokeStyle = '#c9c0b0';
      g.lineWidth = 2;
      for (const c of [-5, 0, 5]) { g.beginPath(); g.moveTo(lx + 2, 40); g.lineTo(lx + 2 + c + 3, 47); g.stroke(); }
      g.strokeStyle = '#120e18';
      g.lineWidth = 7;
    }

    // Body
    const body = g.createLinearGradient(0, -24, 0, 24);
    body.addColorStop(0, '#2a2233');
    body.addColorStop(0.6, '#140f1a');
    body.addColorStop(1, '#3a1d18');
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, 2, 60, 24, 0, 0, Math.PI * 2);
    g.fill();
    // Spines
    g.fillStyle = '#3d3248';
    for (let i = 0; i < 6; i++) {
      const sx = -44 + i * 16;
      g.beginPath();
      g.moveTo(sx - 5, -18 + Math.abs(i - 2.5) * 1.5);
      g.lineTo(sx, -32 + Math.abs(i - 2.5) * 2);
      g.lineTo(sx + 5, -18 + Math.abs(i - 2.5) * 1.5);
      g.fill();
    }
    // Belly glow
    g.fillStyle = 'rgba(255,90,30,0.18)';
    g.beginPath();
    g.ellipse(6, 14, 38, 8, 0, 0, Math.PI * 2);
    g.fill();

    // Neck
    g.strokeStyle = '#17121e';
    g.lineWidth = 20;
    g.beginPath();
    g.moveTo(42, -2);
    g.quadraticCurveTo(80, -6, DRAGON_HEAD_X - 12, DRAGON_HEAD_Y + 2);
    g.stroke();

    // Head: her face, framed by horns, a spiked frill and fangs
    const hx = DRAGON_HEAD_X;
    const hy = DRAGON_HEAD_Y;
    const R = DRAGON_HEAD_R;
    g.fillStyle = '#4a3f52';
    g.beginPath(); g.moveTo(hx - 14, hy - 14); g.quadraticCurveTo(hx - 40, hy - 34, hx - 30, hy - 58); g.quadraticCurveTo(hx - 26, hy - 34, hx - 4, hy - 20); g.fill();
    g.beginPath(); g.moveTo(hx + 4, hy - 20); g.quadraticCurveTo(hx + 4, hy - 46, hx + 22, hy - 60); g.quadraticCurveTo(hx + 14, hy - 38, hx + 16, hy - 14); g.fill();
    g.fillStyle = '#17121e';
    g.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rr = i % 2 ? R + 4 : R + 11;
      i ? g.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr) : g.moveTo(hx + rr, hy);
    }
    g.closePath();
    g.fill();
    if (d.flash > 0) { g.shadowColor = '#ffffff'; g.shadowBlur = 24; }
    g.save();
    g.beginPath(); g.arc(hx, hy, R, 0, Math.PI * 2); g.clip();
    if (DRAGON_FACE.complete && DRAGON_FACE.naturalWidth) g.drawImage(DRAGON_FACE, hx - R, hy - R, R * 2, R * 2);
    else { g.fillStyle = '#c99a80'; g.fillRect(hx - R, hy - R, R * 2, R * 2); }
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#e09088';
    g.fillRect(hx - R, hy - R, R * 2, R * 2);
    g.globalCompositeOperation = 'source-over';
    const vig = g.createRadialGradient(hx, hy, R * 0.6, hx, hy, R);
    vig.addColorStop(0, 'rgba(20,0,10,0)');
    vig.addColorStop(1, 'rgba(20,0,10,0.55)');
    g.fillStyle = vig;
    g.fillRect(hx - R, hy - R, R * 2, R * 2);
    if (d.flash > 0) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(hx - R, hy - R, R * 2, R * 2); }
    g.restore();
    g.shadowBlur = 0;
    g.strokeStyle = '#2a2233';
    g.lineWidth = 2;
    g.beginPath(); g.arc(hx, hy, R, 0, Math.PI * 2); g.stroke();
    // Angry brows
    g.strokeStyle = '#120a0e';
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx - R * 0.55, hy - R * 0.62); g.lineTo(hx - R * 0.12, hy - R * 0.42); g.stroke();
    g.beginPath(); g.moveTo(hx + R * 0.58, hy - R * 0.62); g.lineTo(hx + R * 0.15, hy - R * 0.42); g.stroke();
    // Glowing eyes
    g.save();
    g.shadowColor = '#ff1a00';
    g.shadowBlur = 10;
    const glow = 0.75 + 0.25 * Math.sin(t * 8);
    for (const ex of [-0.29, 0.31]) {
      g.fillStyle = `rgba(255,40,20,${glow})`;
      g.beginPath(); g.ellipse(hx + ex * R, hy - 0.37 * R, R * 0.17, R * 0.09, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffe14a';
      g.fillRect(hx + ex * R - 0.5, hy - 0.37 * R - R * 0.08, 1, R * 0.16);
    }
    g.restore();
    // Fangs
    g.fillStyle = '#f4efe2';
    g.strokeStyle = '#5a1010';
    g.lineWidth = 0.8;
    for (const fx of [-0.16, 0.16]) {
      g.beginPath();
      g.moveTo(hx + (fx - 0.07) * R, hy + 0.33 * R);
      g.lineTo(hx + fx * 1.15 * R, hy + 0.95 * R);
      g.lineTo(hx + (fx + 0.07) * R, hy + 0.33 * R);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.fillStyle = 'rgba(160,10,10,0.85)';
    g.beginPath(); g.moveTo(hx + 0.13 * R, hy + 0.9 * R); g.quadraticCurveTo(hx + 0.2 * R, hy + 1.05 * R, hx + 0.17 * R, hy + 1.15 * R); g.lineTo(hx + 0.21 * R, hy + 0.9 * R); g.fill();
    // Smoke
    g.fillStyle = 'rgba(160,150,170,0.25)';
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.8 + i / 3) % 1;
      g.beginPath(); g.arc(hx + R + 6 + k * 18, hy - k * 22, 3 + k * 7, 0, Math.PI * 2); g.fill();
    }

    // Near wing (in front of body)
    drawDragonWing(g, 0.45 + 0.55 * beat * -1, 'rgba(22,16,30,0.94)', '#3b2f48');
    g.restore();
  }

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

  const bats = Array.from({ length: 6 }, (_, i) => ({
    phase: Math.random() * 100,
    speed: rand(0.035, 0.07) * (i % 2 ? 1 : -1),
    y: HUD_H + 40 + Math.random() * (H - 330),
    amp: rand(10, 40),
    size: rand(1.3, 2.1),
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
    difficulty: DIFFICULTY[load(DIFF_KEY, 'easy')] ? load(DIFF_KEY, 'easy') : 'easy',
    endReason: null,
    hero: HEROES[load(HERO_KEY, 'hermione')] ? load(HERO_KEY, 'hermione') : 'hermione',
    shots: 0,
    stupefy: 0,
    dragon: null,
    dragonBanner: 0,
    spiders: [],
    rocks: [],
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
  const touch = { active: false, x: W / 2, id: null };
  const diff = () => DIFFICULTY[game.difficulty];

  function levelParams(level) {
    const l = level - 1;
    const d = diff();
    return {
      baseSpeed: Math.min(30 + l * 7, 75) * d.enemySpeed,
      fireInterval: Math.max(0.35, 1.1 - l * 0.1) * d.fireInterval,
      boltSpeed: Math.min(230 + l * 25, 420) * d.boltSpeed,
      maxEnemyBolts: Math.max(1, Math.round(Math.min(3 + Math.floor(l / 2), 7) * d.enemyBolts)),
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
    game.dragon = null;
    game.dragonBanner = 0;
    game.spiders = [];
    game.rocks = [];
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
    game.lives = diff().lives;
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
    const burned = game.endReason === 'dragon';
    const webbed = game.endReason === 'spider';
    els.gameoverTitle.textContent = webbed ? 'Caught in the Web' : burned ? 'Hogwarts Burns' : invaded ? 'Hogwarts Has Fallen' : 'The Dementors Prevail';
    els.gameoverText.textContent = webbed
      ? 'A spider reached the castle and wrapped you up.'
      : burned
      ? 'The dragon reached the ground and set the castle ablaze.'
      : invaded
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
    return p.baseSpeed * (1 + diff().speedup * Math.pow(killed, 1.6));
  }

  function updatePlaying(dt) {
    const pl = game.player;
    const p = levelParams(game.level);
    game.banner = Math.max(0, game.banner - dt);
    game.stupefy = Math.max(0, game.stupefy - dt);

    // Player
    let move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let moveSpeed = PLAYER_SPEED;
    if (touch.active && !move) {
      const dx = touch.x - pl.x;
      move = Math.abs(dx) < 3 ? 0 : Math.sign(dx);
      moveSpeed = Math.min(PLAYER_SPEED * 1.5, Math.abs(dx) / dt);
    }
    pl.x = Math.max(24, Math.min(W - 24, pl.x + move * moveSpeed * dt));
    pl.cooldown -= dt;
    pl.invuln = Math.max(0, pl.invuln - dt);
    if ((keys.fire || touch.active) && pl.cooldown <= 0 && game.playerBolts.length < diff().playerBolts) {
      game.shots++;
      const big = game.shots % STUPEFY_EVERY === 0;
      const len = big ? BIG_BOLT_LEN : BOLT_LEN;
      game.playerBolts.push({ x: pl.x + 20, y: PLAYER_Y - 42 - len, len, big });
      pl.cooldown = diff().shotCooldown;
      if (big) {
        game.stupefy = STUPEFY_BANNER_S;
        sfx.stupefy();
      } else {
        sfx.cast();
      }
      if (game.shots % DRAGON_EVERY === 0 && !game.dragon) spawnDragon();
      if (game.shots % SPIDER_EVERY === 0) spawnSpiders();
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
      game.fy += diff().drop;
    } else if (game.dir < 0 && left < SIDE_MARGIN) {
      game.fx += SIDE_MARGIN - left;
      game.dir = 1;
      game.fy += diff().drop;
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
        rockRain();
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
      if (hitSpider(rect)) return false;
      if (game.dragon && hitDragon(game.dragon, rect, b)) return false;
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

    if (game.dragon) updateDragon(game.dragon, dt);
    updateSpiders(dt);
    updateRocks(dt);
    game.dragonBanner = Math.max(0, game.dragonBanner - dt);

    if (game.state === 'playing' && game.alive === 0 && !game.dragon && !game.spiders.length) {
      game.state = 'levelclear';
      game.timer = LEVEL_CLEAR_S;
      game.enemyBolts = [];
      game.playerBolts = [];
      game.snitch = null;
      game.rocks = [];
      sfx.clear();
    }
  }

  function spawnDragon() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    game.dragon = { x: dir > 0 ? -220 : W + 220, y: HUD_H + 80, dir, t: 0, hp: diff().dragonHp, flash: 0, entered: false };
    game.dragonBanner = DRAGON_BANNER_S;
    sfx.roar();
  }

  function dragonHead(d) {
    return { x: d.x + d.dir * DRAGON_HEAD_X * DRAGON_SCALE, y: d.y + DRAGON_HEAD_Y * DRAGON_SCALE };
  }

  function dragonBody(d) {
    const S = DRAGON_SCALE;
    return { x: d.x - 78 * S, y: d.y - 26 * S, w: 156 * S, h: 52 * S };
  }

  function hitDragon(d, rect, bolt) {
    const h = dragonHead(d);
    const nx = Math.max(rect.x, Math.min(h.x, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(h.y, rect.y + rect.h));
    if (Math.hypot(nx - h.x, ny - h.y) <= DRAGON_HEAD_R * DRAGON_SCALE) {
      d.hp -= bolt.big ? diff().dragonHp : 1;
      d.flash = 0.15;
      burst(h.x, h.y, ['#ff5a36', '#ffd84a', '#ffffff'], 16, 180);
      if (d.hp <= 0) killDragon(d);
      else { floatText(h.x, h.y - 24, `${d.hp} more!`, '#ff8a5a'); sfx.dragonHit(); }
      return true;
    }
    const body = dragonBody(d);
    if (overlap(rect, body)) {
      burst(rect.x + rect.w / 2, body.y + body.h, ['#7a6f86', '#cfc6d8'], 6, 90);
      sfx.dragonArmor();
      return true;
    }
    return false;
  }

  function killDragon(d) {
    const pts = 500 + 100 * (game.level - 1);
    game.score += pts;
    const h = dragonHead(d);
    burst(h.x, h.y, ['#ff3b3b', '#ffd84a', '#ffffff'], 50, 280);
    burst(d.x, d.y, ['#2a2233', '#5a4b66', '#ff5a36', '#ffd84a'], 70, 240);
    floatText(d.x, d.y - 40, `+${pts} Dragon slain!`);
    game.dragon = null;
    game.dragonBanner = 0;
    sfx.fart();
    floatText(d.x, d.y + 14, 'PFFFRRRT!', '#9be37a');
  }

  function updateDragon(d, dt) {
    const p = levelParams(game.level);
    d.t += dt;
    d.flash = Math.max(0, d.flash - dt);
    d.x += d.dir * DRAGON_SPEED * dt;
    const margin = 140 * DRAGON_SCALE;
    if (!d.entered && d.x > margin && d.x < W - margin) d.entered = true;
    if (d.entered) {
      if (d.dir > 0 && d.x > W - margin) d.dir = -1;
      else if (d.dir < 0 && d.x < margin) d.dir = 1;
    }
    d.y += DRAGON_DESCENT * diff().dragonDescent * (1 + 0.12 * (p.baseSpeed / 30 - 1)) * dt;
    const body = dragonBody(d);
    if (body.y + body.h + 14 >= SHIELD_Y) erodeShields({ ...body, h: body.h + 14 });
    if (d.y >= DRAGON_LAND_Y && game.state === 'playing') {
      burst(d.x, PLAYER_Y - 10, ['#ff5a36', '#ffd84a', '#ae0001', '#2a2233'], 80, 300);
      game.dragon = null;
      floatText(W / 2, H / 2, 'The dragon landed!', '#ff5a36');
      if (game.player.invuln <= 0) {
        if (game.lives <= 1) game.endReason = 'dragon';
        playerHit();
      }
    }
  }

  function spawnSpiders() {
    const xs = [];
    for (let tries = 0; xs.length < SPIDER_COUNT && tries < 200; tries++) {
      const x = rand(60, W - 60);
      if (xs.every((o) => Math.abs(o - x) > 120)) xs.push(x);
    }
    const lvl = 1 + 0.08 * (game.level - 1);
    for (const x of xs) {
      game.spiders.push({ x, ax: x, y: HUD_H + rand(10, 60), vy: rand(24, 36) * lvl * diff().spiderSpeed, t: Math.random() * 10 });
    }
    floatText(W / 2, H * 0.55, 'Spiders!', '#c9ff7a');
    sfx.spiders();
  }

  function spiderRect(sp) {
    return { x: sp.x - SPIDER_R, y: sp.y - SPIDER_R - 18, w: SPIDER_R * 2, h: SPIDER_R * 2 + 18 };
  }

  function hitSpider(rect) {
    for (let i = 0; i < game.spiders.length; i++) {
      const sp = game.spiders[i];
      if (!overlap(rect, spiderRect(sp))) continue;
      const pts = 75 + 25 * (game.level - 1);
      game.score += pts;
      burst(sp.x, sp.y, ['#c9ff7a', '#2a2233', '#ffffff'], 24, 200);
      floatText(sp.x, sp.y - 30, `+${pts}`);
      game.spiders.splice(i, 1);
      sfx.spiderDie();
      return true;
    }
    return false;
  }

  function updateSpiders(dt) {
    for (const sp of game.spiders) {
      sp.t += dt;
      sp.y += sp.vy * dt;
      sp.x = sp.ax + Math.sin(sp.t * 1.6) * 10;
      const r = spiderRect(sp);
      if (r.y + r.h >= SHIELD_Y) erodeShields(r);
    }
    if (game.state !== 'playing') return;
    const landed = game.spiders.filter((sp) => sp.y >= SPIDER_LAND_Y);
    if (!landed.length) return;
    game.spiders = game.spiders.filter((sp) => sp.y < SPIDER_LAND_Y);
    for (const sp of landed) burst(sp.x, PLAYER_Y - 10, ['#c9ff7a', '#ffffff', '#2a2233'], 40, 220);
    floatText(W / 2, H / 2, 'A spider got through!', '#c9ff7a');
    if (game.player.invuln <= 0) {
      if (game.lives <= 1) game.endReason = 'spider';
      playerHit();
    }
  }

  function jaggedShape(size) {
    const n = 7 + ((Math.random() * 3) | 0);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const rr = size * (i % 2 ? rand(0.45, 0.7) : rand(0.85, 1.15));
      return [Math.cos(a) * rr, Math.sin(a) * rr];
    });
  }

  function rockRain() {
    const alive = game.enemies.filter((e) => e.alive);
    const targets = [];
    const want = Math.min(alive.length, Math.random() < 0.5 ? 1 : 2);
    while (targets.length < want) {
      const e = alive[(Math.random() * alive.length) | 0];
      if (!targets.includes(e)) targets.push(e);
    }
    const make = (x, target) => {
      const size = target ? rand(15, 19) : rand(8, 14);
      return { x, y: HUD_H - rand(10, 120), vx: rand(-30, 30), vy: ROCK_SPEED * rand(0.7, 1), rot: Math.random() * 6, vr: rand(-6, 6), size, shape: jaggedShape(size), target };
    };
    for (const e of targets) {
      const er = enemyRect(e);
      game.rocks.push(make(er.x + ENEMY_W / 2 + rand(-40, 40), e));
    }
    for (let i = 0; i < 9; i++) game.rocks.push(make(rand(20, W - 20), null));
    floatText(W / 2, HUD_H + 70, 'Rock rain!', '#d9cbb5');
    sfx.rockRain();
  }

  function updateRocks(dt) {
    game.rocks = game.rocks.filter((r) => {
      r.rot += r.vr * dt;
      if (r.target && r.target.alive) {
        const er = enemyRect(r.target);
        const tx = er.x + ENEMY_W / 2;
        const ty = er.y + ENEMY_H / 2;
        const dx = tx - r.x;
        const dy = ty - r.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 16) {
          killEnemy(r.target);
          burst(r.x, r.y, ['#8a7d6e', '#d9cbb5', '#4a4038'], 20, 180);
          sfx.rock();
          return false;
        }
        r.vx = (dx / dist) * ROCK_SPEED;
        r.vy = (dy / dist) * ROCK_SPEED;
      } else {
        r.target = null;
        r.vy = Math.max(r.vy, ROCK_SPEED * 0.7);
      }
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      if (!r.target && r.y > SHIELD_Y - 30) {
        burst(r.x, r.y, ['#8a7d6e', '#4a4038'], 6, 80);
        return false;
      }
      return true;
    });
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

    drawBats(g, t);

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

    if (game.dragon) drawDragon(g, game.dragon);

    for (const e of game.enemies) {
      if (!e.alive) continue;
      const r = enemyRect(e);
      drawEnemy(g, e.type, r.x, r.y, game.frame);
    }

    if (game.snitch) drawSnitch(g, game.snitch.x, game.snitch.y, t);
    for (const sp of game.spiders) drawSpider(g, sp);
    for (const r of game.rocks) drawRock(g, r);

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

    if (game.dragonBanner > 0 && game.state === 'playing') {
      g.save();
      g.globalAlpha = Math.min(1, game.dragonBanner / 0.4);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'bold 40px "Palatino Linotype", Palatino, Georgia, serif';
      g.shadowColor = '#ff3b1a';
      g.shadowBlur = 20;
      g.lineWidth = 5;
      g.strokeStyle = '#1a0606';
      g.strokeText('A DRAGON APPROACHES!', W / 2, H * 0.6);
      g.fillStyle = '#ff5a1f';
      g.fillText('A DRAGON APPROACHES!', W / 2, H * 0.6);
      g.shadowBlur = 0;
      g.font = 'italic 18px "Palatino Linotype", Palatino, Georgia, serif';
      g.fillStyle = '#f1e9d6';
      g.fillText('Hit its head before it reaches the ground', W / 2, H * 0.6 + 34);
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
    g.font = 'bold 14px "Palatino Linotype", Palatino, Georgia, serif';
    if (game.dragon) {
      g.fillStyle = Math.floor(game.time * 3) % 2 ? '#ff5a1f' : '#f3d77a';
      g.fillText(`DRAGON ${'\u2665'.repeat(game.dragon.hp)}`, 180, HUD_H / 2);
    } else {
      g.fillStyle = '#a99d84';
      g.fillText(`DRAGON IN ${DRAGON_EVERY - (game.shots % DRAGON_EVERY)}`, 180, HUD_H / 2);
    }
    g.font = 'bold 17px "Palatino Linotype", Palatino, Georgia, serif';
    g.textAlign = 'right';
    g.fillStyle = '#a99d84';
    const maxLives = Math.max(diff().lives, game.lives);
    const gap = maxLives > 3 ? 23 : 28;
    const x0 = W - 28 - (maxLives - 1) * gap;
    g.fillText('LIVES', x0 - 22, HUD_H / 2);
    for (let i = 0; i < maxLives; i++) drawHeart(g, x0 + i * gap, HUD_H / 2 + 1, maxLives > 3 ? 19 : 22, i < game.lives);
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
    const onButton = e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter');
    const menu = game.state === 'start' || game.state === 'gameover';
    if (onButton && menu) return;
    if (onButton) e.preventDefault();
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
    touch.active = false;
    setPaused(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.left = keys.right = keys.fire = false;
      touch.active = false;
      setPaused(true);
    }
  });
  const touchX = (e) => {
    const r = els.canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };
  els.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touch.active = true;
    touch.id = e.pointerId;
    touch.x = touchX(e);
    if (els.canvas.setPointerCapture) els.canvas.setPointerCapture(e.pointerId);
  });
  els.canvas.addEventListener('pointermove', (e) => {
    if (touch.active && e.pointerId === touch.id) { e.preventDefault(); touch.x = touchX(e); }
  });
  const endTouch = (e) => { if (e.pointerId === touch.id) { touch.active = false; touch.id = null; } };
  els.canvas.addEventListener('pointerup', endTouch);
  els.canvas.addEventListener('pointercancel', endTouch);
  function unlockAudio() {
    const c = ac();
    if (!c || audio.unlocked) return;
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
    audio.unlocked = true;
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, unlockAudio, { passive: true }));
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

  function setDifficulty(key) {
    if (!DIFFICULTY[key]) return;
    const prev = DIFFICULTY[game.difficulty];
    if (prev && key !== game.difficulty && game.state !== 'start' && game.state !== 'gameover') {
      game.lives = Math.max(1, game.lives + DIFFICULTY[key].lives - prev.lives);
    }
    game.difficulty = key;
    save(DIFF_KEY, key);
    els.modeButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === key)));
    els.modeToggle.textContent = `Mode: ${DIFFICULTY[key].name}`;
    els.livesCount.textContent = DIFFICULTY[key].lives;
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
  els.modeToggle.addEventListener('click', () => setDifficulty(game.difficulty === 'easy' ? 'normal' : 'easy'));
  els.modeButtons.forEach((b) => b.addEventListener('click', () => setDifficulty(b.dataset.mode)));
  window.addEventListener('resize', resize);

  // ---------- Boot ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.state !== 'paused') update(dt);
    music.tick();
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
  setDifficulty(game.difficulty);
  resize();
  requestAnimationFrame(loop);

  window.HogwartsInvaders = { game, keys, music, newGame, startLevel, spawnDragon, killDragon, spawnSpiders, rockRain, setDifficulty, touch };
})();
