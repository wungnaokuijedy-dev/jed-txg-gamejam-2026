// Map — hand-drawn explorer-journal style renderer. Draws to an offscreen
// canvas element the React MapScreen mounts and blits to the DOM. Renders
// programmatic ink-style regions and re-draws on state changes.

import { AREAS } from './Terrain.js';

// Fixed world→canvas transform. We use ONE canvas resolution and the
// consumer scales it in CSS.
const CAN_W = 1080;
const CAN_H = 720;

// World coordinate window that comfortably contains all 5 areas:
// x in [-70..70], z in [-80..40]. We use manual projection.
function worldToCanvas(x, z) {
  // x -70..70 → 60..1020;  z -80..40 → 640..80  (invert z for map-north)
  const cx = 60 + ((x + 70) / 140) * (CAN_W - 120);
  const cy = 80 + ((40 - z) / 120) * (CAN_H - 160);
  return [cx, cy];
}

// Deterministic parchment noise texture — draw once, reuse.
function drawParchment(ctx) {
  const w = CAN_W, h = CAN_H;
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#f2e6c8');
  grd.addColorStop(1, '#e0cea0');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  // Grain speckles
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(80,60,30,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
  }
  // Vignette corners
  const rg = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
  rg.addColorStop(0, 'rgba(60,40,20,0)');
  rg.addColorStop(1, 'rgba(60,40,20,0.35)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  // Frame
  ctx.strokeStyle = '#5a3a20';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);
  // Inner double-line
  ctx.strokeStyle = 'rgba(90,60,30,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, w - 56, h - 56);
}

// Inky organic blob for an area's illustrated region.
function inkyBlob(ctx, cx, cy, rx, ry, seed, fill, stroke) {
  ctx.save();
  ctx.beginPath();
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wobble = 0.85 + 0.28 * Math.sin(a * 3 + seed) + 0.14 * Math.cos(a * 5 + seed * 1.7);
    const x = cx + Math.cos(a) * rx * wobble;
    const y = cy + Math.sin(a) * ry * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

function drawTree(ctx, x, y, s = 1, seed = 0) {
  ctx.save();
  ctx.translate(x, y);
  // Trunk
  ctx.strokeStyle = 'rgba(70,40,20,0.85)';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(0, 6 * s);
  ctx.lineTo(0, -6 * s);
  ctx.stroke();
  // Canopy (few overlapping arcs)
  ctx.fillStyle = 'rgba(70,110,60,0.75)';
  ctx.strokeStyle = 'rgba(40,60,30,0.85)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const ox = (i - 1) * 4 * s;
    const oy = -10 * s + (i % 2) * 2 * s;
    ctx.arc(ox, oy, 6 * s + (seed + i) % 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawStones(ctx, x, y, awakened) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sx = Math.cos(a) * 12;
    const sy = Math.sin(a) * 10;
    ctx.fillStyle = awakened ? 'rgba(120,180,140,0.9)' : 'rgba(90,80,80,0.85)';
    ctx.strokeStyle = 'rgba(40,40,40,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawBridge(ctx, x, y, grown) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = grown ? 'rgba(70,120,55,0.9)' : 'rgba(90,60,30,0.65)';
  ctx.lineWidth = grown ? 2.4 : 1.6;
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.quadraticCurveTo(0, -6, 8, 4);
  ctx.stroke();
  if (grown) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(120,170,80,0.9)';
      ctx.beginPath();
      ctx.arc(-6 + i * 4, -2 - i * 0.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStream(ctx, flowing) {
  ctx.save();
  // Stream path: roughly z = -18 + sin(x*0.08)*3.5 for x in [-60..60]
  ctx.beginPath();
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = -60 + t * 120;
    const z = -18 + Math.sin(x * 0.08) * 3.5;
    const [cx, cy] = worldToCanvas(x, z);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.strokeStyle = flowing ? 'rgba(60,120,150,0.9)' : 'rgba(90,80,60,0.55)';
  ctx.lineWidth = flowing ? 4 : 2;
  if (!flowing) ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Extra shimmer strokes if flowing
  if (flowing) {
    ctx.strokeStyle = 'rgba(150,200,220,0.8)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 6;
      const x = -60 + t * 120;
      const z = -18 + Math.sin(x * 0.08) * 3.5 - 1.5;
      const [cx, cy] = worldToCanvas(x, z);
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy);
      ctx.lineTo(cx + 6, cy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFlourish(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(90,140,80,0.95)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.quadraticCurveTo(0, -6, 8, 0);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(120,170,80,0.9)';
    ctx.beginPath();
    ctx.arc(-6 + i * 6, -3 + (i % 2) * 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawUnknownArea(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(90,60,30,0.4)';
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(90,60,30,0.6)';
  ctx.font = 'italic 30px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0);
  ctx.restore();
}

function drawHeroineMarker(ctx, cx, cy, facingY) {
  ctx.save();
  ctx.translate(cx, cy);
  // Simple compass rose + directional wedge
  ctx.fillStyle = '#7a3a20';
  ctx.strokeStyle = '#2a1a12';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Wedge — canvas y is inverted from world z
  const dirCanvas = -facingY;   // facingY is atan2(sinY, cosY) w/ z-forward; convert to screen
  const fx = Math.sin(dirCanvas) * 12;
  const fy = -Math.cos(dirCanvas) * 12;   // -cos so it goes "up" on screen for facing +Z
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(fx, fy);
  ctx.strokeStyle = '#5a2a10';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// Simplify visited detection: we consider an area "visited" if the player's
// current or historical position was within 1.6 * area.radius of the center.
export function isAreaVisited(area, visitedSet) {
  return visitedSet.has(area.id);
}

// Offscreen static-layer cache. Everything except the moving player marker
// gets drawn once per (flags, visited) combination — much cheaper on redraw.
let _staticCache = null;   // { hash, canvas }
function staticHash(flags, visited) {
  const vk = Array.from(visited).sort().join(',');
  const fk = [
    flags.grow_done ? 1 : 0,
    flags.restore_done ? 1 : 0,
    flags.stones_awoken ? 1 : 0,
    flags.heart_reached ? 1 : 0,
  ].join('');
  return `v:${vk}|f:${fk}`;
}

function drawCompassRose(ctx) {
  ctx.save();
  ctx.translate(CAN_W - 80, CAN_H - 80);
  ctx.strokeStyle = 'rgba(80,50,25,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -22); ctx.lineTo(4, 0); ctx.lineTo(0, 22); ctx.lineTo(-4, 0); ctx.closePath();
  ctx.fillStyle = 'rgba(90,60,30,0.9)';
  ctx.fill();
  ctx.fillStyle = '#3a2410';
  ctx.font = 'italic bold 14px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -32);
  ctx.restore();
}

// Renders the entire static layer (title, parchment, regions, glyphs, compass).
function drawStaticLayer(ctx, flags, visited) {
  drawParchment(ctx);
  ctx.save();
  ctx.fillStyle = '#3a2410';
  ctx.font = 'italic 32px "Cormorant Garamond", "Iowan Old Style", serif';
  ctx.textAlign = 'center';
  ctx.fillText('The Explorer\'s Journal', CAN_W / 2, 62);
  ctx.font = 'italic 15px "Cormorant Garamond", serif';
  ctx.fillStyle = 'rgba(80,50,25,0.75)';
  ctx.fillText('Where nature leads', CAN_W / 2, 84);
  ctx.restore();

  if (visited.has(3) || flags.restore_done) drawStream(ctx, !!flags.restore_done);

  const styles = [
    { fill: 'rgba(150,180,120,0.55)', stroke: 'rgba(60,80,40,0.85)' },
    { fill: 'rgba(100,140,90,0.55)',  stroke: 'rgba(30,60,20,0.9)' },
    { fill: 'rgba(120,150,140,0.55)', stroke: 'rgba(30,60,60,0.9)' },
    { fill: 'rgba(160,150,170,0.55)', stroke: 'rgba(60,40,90,0.9)' },
    { fill: 'rgba(200,170,110,0.55)', stroke: 'rgba(120,80,20,0.9)' },
  ];

  for (let i = 0; i < AREAS.length; i++) {
    const a = AREAS[i];
    const [cx, cy] = worldToCanvas(a.center[0], a.center[1]);
    if (!visited.has(a.id)) { drawUnknownArea(ctx, cx, cy); continue; }
    const s = styles[i] || styles[0];
    inkyBlob(ctx, cx, cy, 68, 46, i * 1.7, s.fill, s.stroke);

    if (i === 0) {
      drawTree(ctx, cx - 22, cy + 6, 1.3, 1);
      drawTree(ctx, cx + 20, cy - 6, 1.4, 2);
      drawTree(ctx, cx + 4, cy + 14, 1.0, 3);
    } else if (i === 1) {
      drawTree(ctx, cx - 24, cy - 6, 1.1, 4);
      drawTree(ctx, cx - 8, cy + 6, 1.0, 5);
      drawTree(ctx, cx + 20, cy + 4, 1.2, 6);
      drawTree(ctx, cx + 8, cy - 8, 0.9, 7);
      drawBridge(ctx, cx - 4, cy + 20, !!flags.grow_done);
    } else if (i === 2) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(60,80,50,0.9)';
      ctx.lineWidth = 1.2;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 16, 12);
        ctx.quadraticCurveTo(k * 16 + 3, 3, k * 16 + 1, -6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (i === 3) {
      drawTree(ctx, cx - 14, cy - 8, 1.6, 8);
      drawStones(ctx, cx + 12, cy + 4, !!flags.stones_awoken);
    } else if (i === 4) {
      drawTree(ctx, cx, cy - 4, 2.2, 9);
      if (flags.heart_reached) drawFlourish(ctx, cx, cy + 20);
    }

    ctx.save();
    ctx.fillStyle = '#2a1a10';
    ctx.font = 'italic 15px "Cormorant Garamond", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(a.name, cx, cy + 34);
    ctx.restore();

    if (i === 1 && flags.grow_done) drawFlourish(ctx, cx + 34, cy - 22);
    if (i === 2 && flags.restore_done) drawFlourish(ctx, cx - 34, cy - 22);
    if (i === 3 && flags.stones_awoken) drawFlourish(ctx, cx - 34, cy + 22);
  }
  drawCompassRose(ctx);
}

export function renderMap(canvas, opts) {
  const ctx = canvas.getContext('2d');
  if (canvas.width !== CAN_W) { canvas.width = CAN_W; canvas.height = CAN_H; }
  const flags = opts.flags || {};
  const visited = opts.visited || new Set();
  const hash = staticHash(flags, visited);
  if (!_staticCache || _staticCache.hash !== hash) {
    const off = document.createElement('canvas');
    off.width = CAN_W; off.height = CAN_H;
    drawStaticLayer(off.getContext('2d'), flags, visited);
    _staticCache = { hash, canvas: off };
  }
  ctx.clearRect(0, 0, CAN_W, CAN_H);
  ctx.drawImage(_staticCache.canvas, 0, 0);
  if (opts.player) {
    const [px, py] = worldToCanvas(opts.player.x, opts.player.z);
    drawHeroineMarker(ctx, px, py, opts.player.facingY || 0);
  }
}

// Called on ending "return to woods" to reset the cache so a fresh run rebuilds it.
export function resetMapCache() { _staticCache = null; }
