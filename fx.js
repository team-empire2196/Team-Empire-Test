/* Team Empire FX: page backgrounds, glow page-transition, auditor scene, welcome sequence. No dependencies. */
(() => {
  if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h) };
  const $ = s => document.querySelector(s), RM = matchMedia('(prefers-reduced-motion:reduce)').matches, rnd = (a, b) => a + Math.random() * (b - a), small = () => innerWidth < 700, TAU = Math.PI * 2;
  const cv = $('#bg'), ctx = cv.getContext('2d'); let W = 0, H = 0, mode = null, raf = 0, last = 0, S = {};
  function size() { const d = Math.min(devicePixelRatio || 1, small() ? 1.25 : 1.6); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0); if (mode && M[mode]) M[mode].init() }
  const glow = (x, y, r, c0, c1) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill() };
  const stars = n => Array.from({ length: Math.round(n * (small() ? .55 : 1)) }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(.3, 1.4), p: rnd(0, 6.3), s: rnd(.6, 2.2) }));
  const drawStars = (t, a = 1) => { S.stars.forEach(s => { ctx.globalAlpha = a * (.35 + .65 * Math.abs(Math.sin(t / 1000 * s.s + s.p))); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill() }); ctx.globalAlpha = 1 };
  const M = {};

  // ---- SPACE (dashboard): small planets, a meteor every 5 s, a tiny distant black hole ----
  M.space = {
    init() { S = { stars: stars(190), met: [], next: performance.now() + 1800, planets: [], bh: { x: W * (small() ? .8 : .86), y: H * (small() ? .16 : .2), r: small() ? 8 : 11 } };
      const hs = [24, 205, 285, 340, 160, 45, 225]; S.planets = hs.slice(0, small() ? 5 : 7).map((h, i) => ({ x: rnd(.05, .95) * W, y: rnd(.12, .92) * H, r: rnd(5, small() ? 11 : 17), h, vx: rnd(-4, 4), vy: rnd(-2, 2), ring: i % 3 == 1, band: i % 2 == 0, moon: i % 3 == 0, a: rnd(0, 6.3) })) },
    draw(t, dt) {
      drawStars(t);
      S.planets.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.a += dt * .8; if (p.x < -40) p.x = W + 40; if (p.x > W + 40) p.x = -40; if (p.y < -40) p.y = H + 40; if (p.y > H + 40) p.y = -40;
        if (p.ring) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-.4); ctx.strokeStyle = `hsla(${p.h},60%,75%,.55)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 2.1, p.r * .55, 0, Math.PI, TAU); ctx.stroke(); ctx.restore() }
        const g = ctx.createRadialGradient(p.x - p.r * .4, p.y - p.r * .4, p.r * .1, p.x, p.y, p.r); g.addColorStop(0, `hsl(${p.h},75%,72%)`); g.addColorStop(.6, `hsl(${p.h},60%,38%)`); g.addColorStop(1, `hsl(${p.h},55%,14%)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        if (p.band) { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.clip(); ctx.strokeStyle = `hsla(${p.h + 20},70%,80%,.22)`; ctx.lineWidth = p.r * .16; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(p.x - p.r, p.y + k * p.r * .4); ctx.lineTo(p.x + p.r, p.y + k * p.r * .4 + 2); ctx.stroke() } ctx.restore() }
        if (p.ring) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-.4); ctx.strokeStyle = `hsla(${p.h},60%,80%,.7)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 2.1, p.r * .55, 0, 0, Math.PI); ctx.stroke(); ctx.restore() }
        if (p.moon) { ctx.fillStyle = '#d7dcef'; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.a) * p.r * 1.9, p.y + Math.sin(p.a) * p.r * .8, p.r * .22, 0, TAU); ctx.fill() } });
      // meteor every 5 seconds
      if (t > S.next) { S.next = t + 5000; const sp = rnd(650, 850); S.met.push({ x: rnd(W * .35, W * 1.05), y: -30, vx: -sp * .62, vy: sp * .78, life: 0 }) }
      S.met = S.met.filter(m => { m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt; const L = 190, k = Math.hypot(m.vx, m.vy), tx = m.x - m.vx / k * L, ty = m.y - m.vy / k * L, g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.25, 'rgba(255,190,110,.6)'); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke(); glow(m.x, m.y, 9, 'rgba(255,240,200,.9)', 'rgba(255,160,60,0)'); return m.y < H + 60 && m.x > -80 });
      // far-away black hole with a spinning accretion disk and a lensed halo
      const b = S.bh; glow(b.x, b.y, b.r * 5, 'rgba(120,70,200,.28)', 'rgba(120,70,200,0)'); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-.35);
      for (let i = 0; i < 3; i++) { const g = ctx.createLinearGradient(-b.r * 3.4, 0, b.r * 3.4, 0); g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(.35, `rgba(255,${150 + i * 30},60,${.65 - i * .15})`); g.addColorStop(.5, 'rgba(255,245,220,.95)'); g.addColorStop(.65, `rgba(255,${150 + i * 30},60,${.65 - i * .15})`); g.addColorStop(1, 'rgba(255,120,30,0)'); ctx.strokeStyle = g; ctx.lineWidth = 2.4 - i * .6; ctx.beginPath(); ctx.ellipse(0, 0, b.r * (3.1 - i * .35), b.r * (.8 - i * .12), 0, 0, TAU); ctx.stroke() }
      for (let i = 0; i < 16; i++) { const a = t / 700 + i * .39, rr = b.r * (1.5 + (i % 4) * .4); ctx.fillStyle = `rgba(255,230,190,${.35 + .4 * Math.abs(Math.sin(a))})`; ctx.fillRect(Math.cos(a) * rr * 2, Math.sin(a) * rr * .5, 1.6, 1.6) } ctx.restore();
      ctx.strokeStyle = 'rgba(255,230,190,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.35, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.35, Math.PI * .1, Math.PI * .9); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.stroke();
    } };

  // ---- MONEY (salary): banknotes and coins ----
  const mk = init => { const c = Math.random() < .45; return { x: rnd(0, W), y: init ? rnd(-H * .2, H) : rnd(-90, -20), vy: rnd(55, 140), sw: rnd(.6, 1.6), ph: rnd(0, 6.3), rot: rnd(0, 6.3), vr: rnd(-1.4, 1.4), c, s: c ? rnd(11, 19) : rnd(24, 38) } };
  M.money = { init() { S = { it: Array.from({ length: small() ? 20 : 40 }, () => mk(true)), sp: [] } },
    draw(t, dt) { S.it.forEach((o, i) => { o.y += o.vy * dt; o.ph += dt * 2.2; o.rot += o.vr * dt; o.x += Math.sin(o.ph * o.sw) * 22 * dt; if (o.y > H + 60) S.it[i] = mk(false);
      ctx.save(); ctx.translate(o.x, o.y);
      if (o.c) { ctx.scale(Math.abs(Math.cos(o.ph * 1.6)) * .9 + .1, 1); glow(0, 0, o.s, '#ffe58a', '#c98a06'); ctx.strokeStyle = 'rgba(120,70,0,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, o.s * .72, 0, TAU); ctx.stroke(); ctx.fillStyle = '#7a4a00'; ctx.font = `bold ${o.s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('৳', 0, 1) }
      else { ctx.rotate(o.rot * .35); const w = o.s * 1.9, h = o.s, g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#5be08f'); g.addColorStop(1, '#128a47'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 4); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(0, 0, h * .3, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b5a2d'; ctx.font = `bold ${h * .42}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('৳', 0, 1) }
      ctx.restore() });
      if (Math.random() < .08) S.sp.push({ x: rnd(0, W), y: rnd(0, H), l: 1 }); S.sp = S.sp.filter(s => { s.l -= dt * 1.4; ctx.fillStyle = `rgba(255,235,150,${Math.max(s.l, 0)})`; const r = 6 * s.l; ctx.fillRect(s.x - r, s.y - .6, r * 2, 1.2); ctx.fillRect(s.x - .6, s.y - r, 1.2, r * 2); return s.l > 0 }) } };

  // ---- RADAR (punch): sweep, rings, blips ----
  M.radar = { init() { S = { a: 0, blips: [], nb: 0 } },
    draw(t, dt) { const cx = W / 2, cy = H * .52, R = Math.min(W, H) * .46; S.a += dt * 1.1; ctx.strokeStyle = 'rgba(60,255,200,.16)'; ctx.lineWidth = 1; for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 5, 0, TAU); ctx.stroke() }
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(i * TAU / 12) * R, cy + Math.sin(i * TAU / 12) * R); ctx.stroke() }
      for (let k = 0; k < 34; k++) { ctx.fillStyle = `rgba(60,255,190,${.22 * (1 - k / 34)})`; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, S.a - k * .035 - .035, S.a - k * .035); ctx.closePath(); ctx.fill() }
      if (t > S.nb) { S.nb = t + 500; const a = S.a + rnd(.1, .5), r = rnd(.2, .95) * R; S.blips.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, l: 1 }) }
      S.blips = S.blips.filter(b => { b.l -= dt * .45; glow(b.x, b.y, 9, `rgba(120,255,210,${b.l})`, 'rgba(60,255,190,0)'); return b.l > 0 });
      const y = (t / 18) % (H + 80) - 40; const g = ctx.createLinearGradient(0, y - 30, 0, y + 30); g.addColorStop(0, 'rgba(60,255,210,0)'); g.addColorStop(.5, 'rgba(60,255,210,.16)'); g.addColorStop(1, 'rgba(60,255,210,0)'); ctx.fillStyle = g; ctx.fillRect(0, y - 30, W, 60) } };

  // ---- AURORA (audit): flowing ribbons + call waveform ----
  M.aurora = { init() { S = { stars: stars(110) } },
    draw(t) { drawStars(t, .6); ctx.globalCompositeOperation = 'lighter'; const cols = [[60, 255, 170], [90, 140, 255], [190, 90, 255], [60, 220, 255]];
      cols.forEach((c, i) => { const base = H * (.28 + i * .13); ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W + 14; x += 14) ctx.lineTo(x, base + Math.sin(x / (170 + i * 40) + t / (1400 + i * 300) + i) * 55 + Math.sin(x / 70 + t / 900) * 14); ctx.lineTo(W, H); const g = ctx.createLinearGradient(0, base - 70, 0, base + 260); g.addColorStop(0, `rgba(${c},.34)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fill() });
      ctx.lineWidth = 1.6; for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(160,255,230,${.35 - k * .09})`; ctx.beginPath(); for (let x = 0; x <= W; x += 5) { const e = Math.sin(x / W * Math.PI), y = H * .9 + Math.sin(x / 14 + t / 220 + k) * 12 * e * (.4 + .6 * Math.abs(Math.sin(x / 90 + t / 600))); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y) } ctx.stroke() }
      ctx.globalCompositeOperation = 'source-over' } };

  // ---- MATRIX (attendance / time): falling digits ----
  M.matrix = { init() { const fs = small() ? 14 : 16; S = { fs, cols: Array.from({ length: Math.ceil(W / fs) }, () => ({ y: rnd(-H, 0), v: rnd(60, 190), ch: Array.from({ length: 16 }, () => '') })) }; const set = '0123456789:০১২৩৪৫৬৭৮৯'; S.set = set },
    draw(t, dt) { ctx.font = `${S.fs}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; S.cols.forEach((c, i) => { c.y += c.v * dt; if (c.y > H + 16 * S.fs) { c.y = rnd(-200, 0); c.v = rnd(60, 190) } if (Math.random() < .08) c.ch.unshift(S.set[Math.floor(Math.random() * S.set.length)]), c.ch.pop();
      for (let k = 0; k < 16; k++) { if (!c.ch[k]) c.ch[k] = S.set[Math.floor(Math.random() * S.set.length)]; ctx.fillStyle = k ? `rgba(60,240,170,${.5 * (1 - k / 16)})` : 'rgba(210,255,235,.9)'; ctx.fillText(c.ch[k], i * S.fs, c.y - k * S.fs) } }) } };

  // ---- WAVES (CFS / AHT / FCR): neon waves + bubbles ----
  M.waves = { init() { S = { b: Array.from({ length: small() ? 14 : 26 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(2, 8), v: rnd(10, 40), p: rnd(0, 6) })) } },
    draw(t, dt) { for (let i = 0; i < 6; i++) { const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,200,255,.55)'); g.addColorStop(.5, 'rgba(120,90,255,.5)'); g.addColorStop(1, 'rgba(255,80,190,.55)'); ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.globalAlpha = .75 - i * .1; ctx.beginPath(); for (let x = 0; x <= W; x += 8) { const y = H * (.35 + i * .09) + Math.sin(x / (120 + i * 30) + t / (900 + i * 120) + i) * (22 + i * 6); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y) } ctx.stroke() } ctx.globalAlpha = 1;
      S.b.forEach(b => { b.y -= b.v * dt; b.x += Math.sin(t / 700 + b.p) * 10 * dt; if (b.y < -10) { b.y = H + 10; b.x = rnd(0, W) } ctx.strokeStyle = 'rgba(160,230,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(b.x - b.r * .4, b.y - b.r * .5, 1.5, 1.5) }) } };

  // ---- HEX (escalation / service / KPI): honeycomb with light pulses ----
  M.hex = { init() { const r = small() ? 22 : 30, w = r * 1.732, off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d'); o.strokeStyle = 'rgba(120,170,255,.14)'; o.lineWidth = 1; o.beginPath(); const cells = [];
      for (let row = -1; row * r * 1.5 < H + r; row++) for (let col = -1; col * w < W + w; col++) { const x = col * w + (row & 1 ? w / 2 : 0), y = row * r * 1.5; cells.push({ x, y }); for (let k = 0; k < 6; k++) { const a = TAU / 6 * k + Math.PI / 6; k ? o.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : o.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r) } o.closePath() } o.stroke(); S = { off, cells, r, pulses: [] } },
    draw(t, dt) { ctx.drawImage(S.off, 0, 0, W, H); if (Math.random() < .25) { const c = S.cells[Math.floor(Math.random() * S.cells.length)]; S.pulses.push({ ...c, l: 1, h: Math.random() < .5 ? 190 : 280 }) }
      S.pulses = S.pulses.filter(p => { p.l -= dt * .7; ctx.fillStyle = `hsla(${p.h},90%,65%,${p.l * .32})`; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = TAU / 6 * k + Math.PI / 6; ctx.lineTo(p.x + Math.cos(a) * S.r, p.y + Math.sin(a) * S.r) } ctx.closePath(); ctx.fill(); return p.l > 0 }) } };

  // ---- RIPPLE (callbacks): phone-call ripples and floating handsets ----
  M.ripple = { init() { S = { r: [], n: 0, ph: Array.from({ length: small() ? 8 : 14 }, () => ({ x: rnd(0, W), y: rnd(0, H), v: rnd(12, 30), p: rnd(0, 6) })) } },
    draw(t, dt) { if (t > S.n) { S.n = t + 900; S.r.push({ x: rnd(.1, .9) * W, y: rnd(.15, .85) * H, r: 0, h: Math.random() < .5 ? 175 : 300 }) }
      S.r = S.r.filter(o => { o.r += dt * 140; const a = Math.max(0, 1 - o.r / 260); ctx.strokeStyle = `hsla(${o.h},90%,65%,${a * .55})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .62, 0, TAU); ctx.stroke(); glow(o.x, o.y, 10, `hsla(${o.h},90%,70%,${a})`, 'rgba(0,0,0,0)'); return a > 0 });
      ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#9fd8ff'; S.ph.forEach(p => { p.y -= p.v * dt; if (p.y < -20) { p.y = H + 20; p.x = rnd(0, W) } ctx.globalAlpha = .22 + .2 * Math.sin(t / 600 + p.p); ctx.fillText('☎', p.x + Math.sin(t / 900 + p.p) * 8, p.y) }); ctx.globalAlpha = 1 } };
  // ---- SCAN (observation): document lines, a scanning light and drifting magnifiers ----
  M.scan = { init() { S = { lens: Array.from({ length: small() ? 5 : 9 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(14, 34), vx: rnd(-14, 14), vy: rnd(-10, 10) })) } },
    draw(t, dt) { ctx.strokeStyle = 'rgba(150,190,255,.09)'; ctx.lineWidth = 1; for (let y = 40; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(W * .08, y); ctx.lineTo(W * (.3 + .55 * Math.abs(Math.sin(y * .37))), y); ctx.stroke() }
      const y = (t / 9) % (H + 120) - 60, g = ctx.createLinearGradient(0, y - 60, 0, y + 60); g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(.5, 'rgba(120,180,255,.18)'); g.addColorStop(1, 'rgba(120,180,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, y - 60, W, 120);
      S.lens.forEach(l => { l.x += l.vx * dt; l.y += l.vy * dt; if (l.x < -50) l.x = W + 50; if (l.x > W + 50) l.x = -50; if (l.y < -50) l.y = H + 50; if (l.y > H + 50) l.y = -50; ctx.strokeStyle = 'rgba(170,210,255,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(l.x + l.r * .7, l.y + l.r * .7); ctx.lineTo(l.x + l.r * 1.5, l.y + l.r * 1.5); ctx.stroke(); glow(l.x - l.r * .3, l.y - l.r * .3, l.r * .5, 'rgba(255,255,255,.12)', 'rgba(255,255,255,0)') }) } };

  function loop(t) { raf = requestAnimationFrame(loop); const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; ctx.clearRect(0, 0, W, H); M[mode].draw(t, dt) }
  function bg(m) {
    if (m === mode) return; mode = m; document.body.dataset.bg = m; document.body.classList.toggle('dk', m !== 'classic');
    if (m === 'classic' || !M[m]) { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, W, H); cv.style.display = 'none'; return }
    cv.style.display = 'block'; M[m].init(); if (RM) { ctx.clearRect(0, 0, W, H); M[m].draw(1000, .016) } else if (!raf) raf = requestAnimationFrame(loop);
  }
  addEventListener('resize', () => { clearTimeout(size.t); size.t = setTimeout(size, 150) }); size();

  // ---- glow page transition: Team Empire logo glows ~1 s, content swaps behind it ----
  let busy = false, pend = null;
  function go(fn, audit) {
    if (RM) { fn(); if (audit) auditScene(); return } pend = fn; if (busy) return; busy = true; const o = $('#ptr'); o.classList.remove('run'); void o.offsetWidth; o.classList.add('on', 'run');
    setTimeout(() => { const f = pend; pend = null; f && f() }, 620);
    setTimeout(() => { o.classList.remove('on'); busy = false; if (audit) auditScene() }, 1050);
  }
  // ---- audit scene: a quality auditor sits on the Team Empire logo and audits a call (2 s) ----
  function auditScene() { const a = $('#aud'); a.classList.remove('on'); void a.offsetWidth; a.classList.add('on'); clearTimeout(auditScene.t); auditScene.t = setTimeout(() => a.classList.remove('on'), 2000) }

  // ---- login ----
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const OK = '081b00c4d35380204a23901b624035eb9e3d949b6917427a9fae57760ecc9e05';
  const AGENT_PW = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  const isAdmin = async (u, p) => (await sha(u + ':' + p)) === OK, isAgentPw = async p => (await sha(p)) === AGENT_PW;
  function login(check, onOk) {
    bg('space'); const L = $('#login'); L.hidden = false;
    $('#lgf').onsubmit = async e => { e.preventDefault(); const u = $('#lgu').value.trim().toLowerCase(), p = $('#lgp').value; let role = null; $('#lge').textContent = ''; try { role = await check(u, p) } catch (_) { }
      if (role) { sessionStorage.setItem('te-auth', role); L.classList.add('out'); setTimeout(() => { L.hidden = true; L.classList.remove('out'); onOk(role) }, 450) }
      else { const c = $('#lgc'); $('#lge').textContent = 'Wrong User ID or Password'; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); $('#lgp').value = '' } };
    $('#lgs').onclick = () => { const i = $('#lgp'); i.type = i.type === 'password' ? 'text' : 'password' };
  }

  // ---- welcome: hyperspace jump -> logo -> greeting -> motivation ----
  const QUOTES = [['Every call is a chance to build trust.', 'প্রতিটি কলই বিশ্বাস গড়ার সুযোগ।'], ['Small wins every day build a great Empire.', 'প্রতিদিনের ছোট জয়ই গড়ে তোলে মহান সাম্রাজ্য।'], ['Quality is not an act, it is a habit.', 'গুণমান কোনো কাজ নয়, এটা একটা অভ্যাস।'], ['Great teams rise together. Lead with a smile.', 'সেরা টিম একসাথে ওঠে। হাসি দিয়ে নেতৃত্ব দাও।'], ['Your best score is still ahead of you.', 'তোমার সেরা স্কোরটি এখনও সামনে অপেক্ষা করছে।'], ['Rise. Serve. Conquer.', 'জাগো। সেবা দাও। জয় করো।']];
  function welcome(stats, done, who) {
    const w = $('#wel'), c = $('#wcv'), x = c.getContext('2d'); w.hidden = false; w.classList.remove('out'); w.classList.toggle('agent', !!who); { const ph = $('#wphoto'); ph.hidden = !who; if (who) { const im = $('#wpimg'), ini = $('#wpini'); ini.textContent = who.name[0] || '?'; if (who.photo) { im.src = who.photo; im.style.display = 'block'; ini.style.display = 'none' } else { im.style.display = 'none'; ini.style.display = 'grid' } } } c.width = innerWidth; c.height = innerHeight; const cx = c.width / 2, cy = c.height / 2, N = small() ? 160 : 280, st = Array.from({ length: N }, () => ({ a: rnd(0, TAU), r: rnd(2, Math.hypot(cx, cy)), z: rnd(.3, 1) })); let t0 = performance.now(), run = true, fin = false;
    const hr = new Date().getHours(), g = hr < 5 ? ['Good night', 'শুভ রাত্রি'] : hr < 12 ? ['Good morning', 'শুভ সকাল'] : hr < 17 ? ['Good afternoon', 'শুভ অপরাহ্ন'] : hr < 20 ? ['Good evening', 'শুভ সন্ধ্যা'] : ['Good night', 'শুভ রাত্রি'];
    $('#wg').innerHTML = who ? `${g[0]}, ${who.name.split(' ')[0]} <span>· ${g[1]}</span>` : `${g[0]}, Champions <span>· ${g[1]}</span>`; const head = who ? 'Welcome, ' + who.name : 'Welcome to Team Empire'; const h1 = $('#wh'); h1.textContent = ''; let i = 0; setTimeout(function ty() { if (!run) return; h1.textContent = head.slice(0, ++i); if (i < head.length) setTimeout(ty, 55) }, 1500);
    let qi = 0; const q = $('#wq'), showQ = () => { if (!run) return; const [e, b] = QUOTES[qi++ % QUOTES.length]; q.innerHTML = `<b>${e}</b><i>${b}</i>`; q.classList.remove('in'); void q.offsetWidth; q.classList.add('in') }; setTimeout(showQ, 2300); const qt = setInterval(showQ, 2600);
    $('#ws').innerHTML = (stats || []).map(s => `<div><b>${s[0]}</b><span>${s[1]}</span></div>`).join(''); const bar = $('#wp'); bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = 'width 6.2s cubic-bezier(.3,.7,.2,1)'; bar.style.width = '100%';
    w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
    function frame(now) { if (!run) return; const el = (now - t0) / 1000, sp = el < 1.8 ? .4 + el * el * 5 : Math.max(.5, 11 - (el - 1.8) * 9); x.fillStyle = 'rgba(2,4,14,.28)'; x.fillRect(0, 0, c.width, c.height);
      st.forEach(s => { const pr = s.r; s.r += sp * 9 * s.z + 1; if (s.r > Math.hypot(cx, cy) + 20) { s.r = rnd(2, 40); s.a = rnd(0, TAU) } x.strokeStyle = `rgba(190,215,255,${Math.min(1, .25 + s.z * .75)})`; x.lineWidth = s.z * 1.8; x.beginPath(); x.moveTo(cx + Math.cos(s.a) * pr, cy + Math.sin(s.a) * pr); x.lineTo(cx + Math.cos(s.a) * s.r, cy + Math.sin(s.a) * s.r); x.stroke() }); requestAnimationFrame(frame) }
    requestAnimationFrame(frame); const end = () => { if (fin) return; fin = true; run = false; clearInterval(qt); w.classList.add('out'); setTimeout(() => { w.hidden = true; done() }, 500) };
    $('#wgo').onclick = end; $('#wsk').onclick = end; setTimeout(end, 8200);
  }
  window.FX = { bg, go, audit: auditScene, login, welcome, QUOTES, isAdmin, isAgentPw };
})();
