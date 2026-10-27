/**
 * Deterministic Seeded PRNG & Procedural Noise Library
 * Ensures every world seed replays the exact same terrain, biomes, and agent choices.
 */

export function hashStringToSeed(str: string): number {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

export class SeededPRNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'string' ? hashStringToSeed(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  public getState(): number {
    return this.state;
  }

  public setState(state: number): void {
    this.state = state >>> 0;
  }

  /** Returns a float in [0, 1) using Mulberry32 */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  public int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns true with probability p (0..1) */
  public chance(p: number): boolean {
    return this.next() < p;
  }

  /** Picks a random element from an array */
  public pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/**
 * Coordinate-deterministic hash for stateless chunk generation
 * Guarantees chunk (cx, cz) generates identically regardless of load order.
 */
export function hashCoords(x: number, z: number, seedNum: number): number {
  let h = (seedNum | 0) + Math.imul(x | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = (h + Math.imul(z | 0, 0xc2b2ae35)) | 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d);
  h = h ^ (h >>> 15);
  return (h >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Smooth 2D Value Noise in [-1, 1] seeded deterministically
 */
export function noise2D(x: number, z: number, seedNum: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;

  const u = fade(xf);
  const v = fade(zf);

  const aa = hashCoords(xi, zi, seedNum) * 2 - 1;
  const ba = hashCoords(xi + 1, zi, seedNum) * 2 - 1;
  const ab = hashCoords(xi, zi + 1, seedNum) * 2 - 1;
  const bb = hashCoords(xi + 1, zi + 1, seedNum) * 2 - 1;

  const x1 = lerp(aa, ba, u);
  const x2 = lerp(ab, bb, u);
  return lerp(x1, x2, v);
}

/**
 * Multi-octave Fractal Brownian Motion (fBm) in [-1, 1]
 * Applies a 36.87-degree Pythagorean rotation between octaves so square grid axes never align.
 */
export function fbm2D(
  x: number,
  z: number,
  seedNum: number,
  octaves = 4,
  lacunarity = 2.0,
  gain = 0.5
): number {
  let total = 0;
  let amplitude = 1.0;
  let maxValue = 0;
  let px = x;
  let pz = z;

  for (let i = 0; i < octaves; i++) {
    total += noise2D(px, pz, seedNum + i * 1013) * amplitude;
    maxValue += amplitude;
    amplitude *= gain;
    // Rotate by ~36.87 deg (cos=0.8, sin=0.6) and scale by lacunarity to break lattice alignment
    const nx = (px * 0.8 - pz * 0.6) * lacunarity + 17.3;
    const nz = (px * 0.6 + pz * 0.8) * lacunarity - 31.7;
    px = nx;
    pz = nz;
  }

  return total / maxValue;
}

