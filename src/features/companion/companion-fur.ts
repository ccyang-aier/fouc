/** User-supplied Feather renderer. Keep the strand distribution and drawing parameters intact. */
const BUCKETS = [
  { c: '#050505', w: 1.5, a: 1 },
  { c: '#0c0c0c', w: 1.15, a: 1 },
  { c: '#171717', w: .85, a: .95 },
  { c: '#2c2c2c', w: .55, a: .75 },
  { c: '#4a4a4a', w: .4, a: .5 },
  { c: '#262626', w: .7, a: .55 },
];

interface Strand { a: number; r0: number; L: number; o: number; dev: number; bend: number; ph: number }

function makeFur(n: number, R: number) {
  const b: Strand[][] = BUCKETS.map(() => []);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, t = Math.pow(Math.random(), .5);
    const r0 = R * (.2 + .78 * t);
    let L = R * (.1 + .3 * t + Math.random() * .16);
    let bi = t < .45 ? 0 : t < .75 ? 1 : t < .92 ? 2 : 3;
    if (t > .94 && Math.random() < .4) { bi = 4; L *= 1.4; }
    if (t > .5 && t < .9 && Math.cos(a + 2.3) > .55 && Math.random() < .35) bi = 5;
    b[bi].push({ a, r0, L, o: t, dev: (Math.random() - .5) * .85, bend: (Math.random() - .5) * .55, ph: Math.random() * 6.28 });
  }
  return b;
}

function drawFur(ctx: CanvasRenderingContext2D, b: Strand[][], cx: number, cy: number, R: number, fluff: number, t: number, wind: number, ws = 1) {
  const coreR = R * .8 * (1 + (fluff - 1) * .2);
  const g = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .05, cx, cy, coreR);
  g.addColorStop(0, '#161616'); g.addColorStop(.6, '#080808'); g.addColorStop(1, '#030303');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < b.length; i++) {
    const B = BUCKETS[i]; ctx.strokeStyle = B.c; ctx.globalAlpha = B.a; ctx.lineWidth = B.w * ws; ctx.beginPath();
    for (const s of b[i]) {
      const sw = Math.sin(t * 1.7 + s.ph) * .07 * wind * s.o;
      const push = 1 + (fluff - 1) * .25 * s.o;
      const x0 = cx + Math.cos(s.a) * s.r0 * push, y0 = cy + Math.sin(s.a) * s.r0 * push;
      const d = s.a + s.dev + sw, len = s.L * (1 + (fluff - 1) * (.6 + s.o));
      const dx = Math.cos(d), dy = Math.sin(d);
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + dx * len * .5 - dy * s.bend * len, y0 + dy * len * .5 + dx * s.bend * len, x0 + dx * len, y0 + dy * len);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function createCompanionFur(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const FS = 300, DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = FS * DPR; canvas.height = FS * DPR; ctx.scale(DPR, DPR);
  const mainFur = makeFur(4200, 62);
  let fluff = 1, fluffT = 1, wind = 1;
  const mini = document.createElement('canvas'); mini.width = mini.height = 128;
  const miniCtx = mini.getContext('2d')!; miniCtx.scale(2, 2);
  drawFur(miniCtx, makeFur(700, 15), 32, 32, 15, 1, 0, 0, .6);
  return {
    miniURL: mini.toDataURL(),
    setFur(o: number) { fluffT = 1 + (o / 30 - 1) * .6; if (o > 40) wind = 3.5; },
    ruffle() { wind = Math.min(3.5, wind + .12); },
    draw(now: number) {
      fluff += (fluffT - fluff) * .14; wind += (1 - wind) * .03;
      ctx.clearRect(0, 0, FS, FS);
      drawFur(ctx, mainFur, FS / 2, FS / 2, 62, fluff, now / 1000, wind);
    },
  };
}
