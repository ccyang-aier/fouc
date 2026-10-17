type RGB = readonly [number, number, number];
type Surface = {
  pixels: ImageData;
  pigments: readonly RGB[];
  noise: Float32Array;
  phase: number;
  targets: Map<HTMLCanvasElement, { context: CanvasRenderingContext2D; visible: boolean }>;
};

export const PROJECT_AVATAR_RENDER_SIZE = 48;
const SIZE = PROJECT_AVATAR_RENDER_SIZE;
const NOISE_SIZE = 64;
const FRAME_DURATION = 1000 / 24;
const surfaces = new Map<string, Surface>();
const canvasSurfaces = new Map<HTMLCanvasElement, Surface>();
let observer: IntersectionObserver | null = null;
let animationFrame = 0;
let previousFrame = 0;

export function hashProjectAvatarSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function createNoise(seed: number) {
  const noise = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  let state = seed;
  for (let index = 0; index < noise.length; index++) {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    noise[index] = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return noise;
}

function sampleNoise(noise: Float32Array, x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const x0 = ix & (NOISE_SIZE - 1);
  const y0 = (iy & (NOISE_SIZE - 1)) * NOISE_SIZE;
  const x1 = (ix + 1) & (NOISE_SIZE - 1);
  const y1 = ((iy + 1) & (NOISE_SIZE - 1)) * NOISE_SIZE;
  const upper = noise[y0 + x0] * (1 - sx) + noise[y0 + x1] * sx;
  const lower = noise[y1 + x0] * (1 - sx) + noise[y1 + x1] * sx;
  return upper * (1 - sy) + lower * sy;
}

function parseColor(color: string): RGB {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function paint(surface: Surface, milliseconds: number) {
  const { noise, phase, pigments, pixels } = surface;
  const time = milliseconds * 0.00012;
  const driftX = time * 0.44;
  const driftY = time * 0.31;
  const originX = 9 + phase * 13;
  const originY = 21 + phase * 7;
  // Counter-flowing eddies fold the pools into curved tongues of pigment.
  // Their centers and strengths drift independently; the whole tile never rotates.
  const eddies = [
    { x: .34 + Math.sin(time * .63 + phase * 6) * .15, y: .33 + Math.cos(time * .51 + phase * 4) * .16, turn: 2.8 + Math.sin(time * .57 + phase * 5) * 1.2, falloff: 3.7 },
    { x: .72 + Math.cos(time * .47 + phase * 7) * .14, y: .71 + Math.sin(time * .59 + phase * 3) * .15, turn: -3.2 + Math.cos(time * .49 + phase * 6) * 1.1, falloff: 4.2 },
  ];
  const centers = [
    [.16 + Math.sin(time * .39 + phase) * .12, .12],
    [.86, .19 + Math.sin(time * .43 + phase * 2) * .12],
    [.79 + Math.cos(time * .37) * .12, .87],
    [.1, .76 + Math.cos(time * .41 + phase) * .12],
  ];

  for (let row = 0; row < SIZE; row++) {
    const y = row / (SIZE - 1);
    for (let column = 0; column < SIZE; column++) {
      const x = column / (SIZE - 1);
      let flowX = x;
      let flowY = y;
      for (const eddy of eddies) {
        const dx = flowX - eddy.x;
        const dy = flowY - eddy.y;
        const turn = eddy.turn * Math.exp(-(dx * dx + dy * dy) * eddy.falloff);
        const sine = Math.sin(turn);
        const cosine = Math.cos(turn);
        flowX = eddy.x + dx * cosine - dy * sine;
        flowY = eddy.y + dx * sine + dy * cosine;
      }
      const u = flowX * 2.1 + originX;
      const v = flowY * 2.1 + originY;
      const curlX = sampleNoise(noise, u + driftX, v - driftY) - .5;
      const curlY = sampleNoise(noise, u + 12.7 - driftY, v + 8.3 + driftX) - .5;
      const warpX = sampleNoise(noise, u + curlX * 2.8 - driftY, v + curlY * 2.8 + driftX) - .5;
      const warpY = sampleNoise(noise, u + 32.1 + curlX * 2.8 + driftX, v + 17.4 + curlY * 2.8 - driftY) - .5;
      const fluidX = flowX + warpX * .43 + curlY * .17;
      const fluidY = flowY + warpY * .43 - curlX * .17;
      let red = 0;
      let green = 0;
      let blue = 0;
      let total = 0;
      let strongest = 0;
      let second = 0;

      for (let pigment = 0; pigment < pigments.length; pigment++) {
        const dx = fluidX - centers[pigment][0];
        const dy = fluidY - centers[pigment][1];
        // Narrow mixing zones keep the curling pigment fronts readable at 24px.
        const weight = Math.exp((dx * dx + dy * dy) * -13.5);
        red += pigments[pigment][0] * weight;
        green += pigments[pigment][1] * weight;
        blue += pigments[pigment][2] * weight;
        total += weight;
        if (weight > strongest) { second = strongest; strongest = weight; }
        else if (weight > second) second = weight;
      }

      // A narrow, directional meniscus travels with the folds. Its lit and shaded
      // shoulders give the pigment thickness without an outline or a glass glare.
      const front = Math.pow(2 * second / (strongest + second), 5);
      const shoulder = (strongest - second) / (strongest + second);
      const relief = .96 + (1 - y) * .045 + (warpX - warpY) * .065 - front * shoulder * .1;
      const light = .012 + front * Math.max(0, .035 + (curlX - curlY) * .065);
      const offset = (row * SIZE + column) * 4;
      pixels.data[offset] = (red / total) * relief * (1 - light) + 255 * light;
      pixels.data[offset + 1] = (green / total) * relief * (1 - light) + 255 * light;
      pixels.data[offset + 2] = (blue / total) * relief * (1 - light) + 255 * light;
      pixels.data[offset + 3] = 255;
    }
  }

  for (const target of surface.targets.values()) {
    if (target.visible) target.context.putImageData(pixels, 0, 0);
  }
}

function isVisible(surface: Surface) {
  for (const target of surface.targets.values()) {
    if (target.visible) return true;
  }
  return false;
}

function hasVisibleTargets() {
  for (const surface of surfaces.values()) {
    if (isVisible(surface)) return true;
  }
  return false;
}

function animate(timestamp: number) {
  animationFrame = 0;
  if (!hasVisibleTargets()) return;
  if (timestamp - previousFrame >= FRAME_DURATION) {
    previousFrame = timestamp;
    for (const surface of surfaces.values()) {
      if (isVisible(surface)) paint(surface, timestamp);
    }
  }
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (!animationFrame && hasVisibleTargets()) animationFrame = requestAnimationFrame(animate);
}

export function attachProjectAvatar(canvas: HTMLCanvasElement, seed: string, palette: { id: string; colors: readonly string[] }) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;
  const key = `${palette.id}:${seed}`;
  let surface = surfaces.get(key);
  if (!surface) {
    const hash = hashProjectAvatarSeed(seed);
    surface = {
      pixels: context.createImageData(SIZE, SIZE),
      pigments: palette.colors.map(parseColor),
      noise: createNoise(hash),
      phase: hash / 4294967296,
      targets: new Map(),
    };
    surfaces.set(key, surface);
  }
  surface.targets.set(canvas, { context, visible: true });
  canvasSurfaces.set(canvas, surface);
  paint(surface, performance.now());

  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const target = canvasSurfaces.get(entry.target as HTMLCanvasElement)?.targets.get(entry.target as HTMLCanvasElement);
      if (target) target.visible = entry.isIntersecting;
    }
    startAnimation();
  }, { rootMargin: '48px' });
  observer.observe(canvas);
  startAnimation();

  return () => {
    observer?.unobserve(canvas);
    canvasSurfaces.delete(canvas);
    surface.targets.delete(canvas);
    if (!surface.targets.size) surfaces.delete(key);
    if (!surfaces.size) {
      observer?.disconnect();
      observer = null;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      previousFrame = 0;
    }
  };
}
