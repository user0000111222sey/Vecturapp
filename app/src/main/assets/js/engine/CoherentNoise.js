/**
 * Vectura Coherent Noise & Jitter Engine
 * Blender-style smooth 1D noise, non-random, deterministic from stroke seed.
 */
export class CoherentNoise {
  constructor(seed = 1337) {
    this.seed = seed;
    this.prngState = seed >>> 0;
  }

  // Fast deterministic Mulberry32 PRNG
  static createPrng(seed) {
    let s = (seed || 1) >>> 0;
    return function() {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Evaluates 1D Perlin-style gradient noise with octaves, persistence, and lacunarity.
   */
  static perlin1D(x, seed = 42, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    const smoothstep = (t) => t * t * (3 - 2 * t);
    const grad = (hash) => (hash & 1 ? 1 : -1);

    for (let o = 0; o < octaves; o++) {
      const sample = x * frequency;
      const x0 = Math.floor(sample);
      const x1 = x0 + 1;
      const frac = sample - x0;

      // Hash integer coordinates with seed
      const h0 = Math.imul(x0 ^ (seed + o * 1013), 0x45d9f3b);
      const h1 = Math.imul(x1 ^ (seed + o * 1013), 0x45d9f3b);

      const g0 = grad(h0);
      const g1 = grad(h1);

      const d0 = frac;
      const d1 = frac - 1.0;

      const v0 = g0 * d0;
      const v1 = g1 * d1;

      const w = smoothstep(frac);
      const n = v0 * (1 - w) + v1 * w;

      total += n * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return maxValue > 0 ? total / maxValue : 0;
  }

  /**
   * Layered Sine Waves: 2 to 4 octaves, smooth undulating organic curves.
   */
  static layeredSines(t, seed = 42, octaves = 3) {
    const prng = CoherentNoise.createPrng(seed);
    let val = 0;
    let ampTotal = 0;
    let freq = 1.0;
    let amp = 1.0;

    for (let i = 0; i < octaves; i++) {
      const phase = prng() * Math.PI * 2;
      val += Math.sin(t * freq + phase) * amp;
      ampTotal += amp;
      freq *= 2.1 + (prng() * 0.4);
      amp *= 0.5;
    }
    return ampTotal > 0 ? val / ampTotal : 0;
  }

  /**
   * Catmull-Rom interpolated seeded random keyframes.
   */
  static catmullRomKeyframes(t, seed = 42, period = 50) {
    const prng = CoherentNoise.createPrng(seed);
    const keyIndex = Math.floor(t / period);
    const frac = (t % period) / period;

    const getKey = (idx) => {
      // Deterministic pseudo-random value for index
      const localSeed = Math.imul((seed + idx) ^ 0x5bd1e995, 0x1b873593);
      const r = CoherentNoise.createPrng(localSeed);
      return (r() - 0.5) * 2;
    };

    const k0 = getKey(keyIndex - 1);
    const k1 = getKey(keyIndex);
    const k2 = getKey(keyIndex + 1);
    const k3 = getKey(keyIndex + 2);

    // Standard uniform Catmull-Rom interpolation
    const a = -0.5 * k0 + 1.5 * k1 - 1.5 * k2 + 0.5 * k3;
    const b = k0 - 2.5 * k1 + 2.0 * k2 - 0.5 * k3;
    const c = -0.5 * k0 + 0.5 * k2;
    const d = k1;

    return ((a * frac + b) * frac + c) * frac + d;
  }

  /**
   * Evaluates jitter noise for a brush setting at stroke point.
   * Returns a normalized offset between -1.0 and 1.0.
   */
  static evaluateJitter(jitterConfig, strokeSeed, distance, time) {
    if (!jitterConfig || !jitterConfig.enabled) return 0;

    const basis = jitterConfig.basis === 'time' ? time * 0.001 : distance;
    const freq = (jitterConfig.frequency || 0.05);
    const t = basis * freq;
    const type = jitterConfig.type || 'sines'; // 'sines' | 'perlin' | 'keyframes'

    let raw = 0;
    if (type === 'sines') {
      raw = CoherentNoise.layeredSines(t, strokeSeed, jitterConfig.octaves || 3);
    } else if (type === 'perlin') {
      raw = CoherentNoise.perlin1D(t, strokeSeed, jitterConfig.octaves || 3, jitterConfig.persistence || 0.5, jitterConfig.lacunarity || 2.0);
    } else {
      raw = CoherentNoise.catmullRomKeyframes(t * 50, strokeSeed, 50);
    }

    const amplitude = jitterConfig.amplitude ?? 0.5;
    return raw * amplitude;
  }
}
