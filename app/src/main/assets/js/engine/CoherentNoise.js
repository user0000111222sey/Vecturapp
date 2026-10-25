/**
 * Vectura Coherent Noise & Jitter Engine
 * Powerful 1D smooth noise generator supporting layered sines, Perlin 1D, and Catmull-Rom keyframes.
 * Features:
 * - Wide amplitude ranges, frequency, octaves (1-8), persistence, lacunarity
 * - Distance vs Time basis, phase offset
 * - Velocity link (amplitude responds to finger velocity)
 * - Fade-in / Fade-out along stroke length
 * - Multi-target modulation: size, opacity, flow, angle, position wobble, hue, sat, bright, spacing
 * - Deterministic PRNG and waveform generation for live UI graphs
 */
export class CoherentNoise {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
  }

  // Mulberry32 32-bit PRNG
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
  static perlin1D(x, seed = 42, octaves = 3, persistence = 0.5, lacunarity = 2.0, phase = 0) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    const smoothstep = (t) => t * t * (3 - 2 * t);
    const grad = (hash) => (hash & 1 ? 1 : -1);

    const adjustedX = x + phase / (Math.PI * 2);

    for (let o = 0; o < Math.min(8, Math.max(1, octaves)); o++) {
      const sample = adjustedX * frequency;
      const x0 = Math.floor(sample);
      const x1 = x0 + 1;
      const frac = sample - x0;

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
   * Layered Sine Waves: 1 to 8 octaves, smooth organic wave.
   */
  static layeredSines(t, seed = 42, octaves = 3, persistence = 0.5, lacunarity = 2.0, phase = 0) {
    const prng = CoherentNoise.createPrng(seed);
    let val = 0;
    let ampTotal = 0;
    let freq = 1.0;
    let amp = 1.0;

    const oct = Math.min(8, Math.max(1, octaves));
    for (let i = 0; i < oct; i++) {
      const p = (prng() * Math.PI * 2) + phase;
      val += Math.sin(t * freq + p) * amp;
      ampTotal += amp;
      freq *= lacunarity;
      amp *= persistence;
    }
    return ampTotal > 0 ? val / ampTotal : 0;
  }

  /**
   * Catmull-Rom interpolated seeded keyframes.
   */
  static catmullRomKeyframes(t, seed = 42, period = 50, phase = 0) {
    const adjustedT = t + (phase * 10);
    const keyIndex = Math.floor(adjustedT / period);
    const frac = ((adjustedT % period) + period) % period / period;

    const getKey = (idx) => {
      const localSeed = Math.imul((seed + idx) ^ 0x5bd1e995, 0x1b873593);
      const r = CoherentNoise.createPrng(localSeed);
      return (r() - 0.5) * 2;
    };

    const k0 = getKey(keyIndex - 1);
    const k1 = getKey(keyIndex);
    const k2 = getKey(keyIndex + 1);
    const k3 = getKey(keyIndex + 2);

    const a = -0.5 * k0 + 1.5 * k1 - 1.5 * k2 + 0.5 * k3;
    const b = k0 - 2.5 * k1 + 2.0 * k2 - 0.5 * k3;
    const c = -0.5 * k0 + 0.5 * k2;
    const d = k1;

    return ((a * frac + b) * frac + c) * frac + d;
  }

  /**
   * Computes the base normalized noise value (-1.0 to +1.0) for given stroke coordinates.
   */
  static computeNoiseSample(jitterConfig, strokeSeed, distance, time) {
    if (!jitterConfig || !jitterConfig.enabled) return 0;

    const basis = jitterConfig.basis === 'time' ? (time || 0) * 0.001 : (distance || 0);
    const freq = Math.max(0.001, (jitterConfig.frequency ?? 0.05) * 0.3);
    const t = basis * freq;
    const octaves = Math.min(8, Math.max(1, jitterConfig.octaves ?? 3));
    const persistence = Math.max(0.05, Math.min(1.0, jitterConfig.persistence ?? 0.5));
    const lacunarity = Math.max(1.1, Math.min(4.0, jitterConfig.lacunarity ?? 2.0));
    const phase = ((jitterConfig.phaseOffset ?? 0) * Math.PI) / 180;
    const seed = (strokeSeed ^ (jitterConfig.seed ?? 1337)) >>> 0;
    const type = jitterConfig.noiseType || jitterConfig.type || 'sines';

    let raw = 0;
    if (type === 'sines') {
      raw = CoherentNoise.layeredSines(t, seed, octaves, persistence, lacunarity, phase);
    } else if (type === 'perlin') {
      raw = CoherentNoise.perlin1D(t, seed, octaves, persistence, lacunarity, phase);
    } else {
      raw = CoherentNoise.catmullRomKeyframes(t * 50, seed, 50, phase);
    }

    if (!Number.isFinite(raw)) raw = 0;
    return Math.max(-1.0, Math.min(1.0, raw));
  }

  /**
   * Computes stroke envelope envelope factor (0.0 to 1.0) for fade-in and fade-out.
   */
  static computeEnvelope(distance, totalEstimatedLength, fadeInPx = 0, fadeOutPx = 0) {
    let env = 1.0;
    if (fadeInPx > 0 && distance < fadeInPx) {
      env = Math.min(env, distance / fadeInPx);
    }
    if (fadeOutPx > 0 && totalEstimatedLength > 0 && distance > (totalEstimatedLength - fadeOutPx)) {
      const remaining = totalEstimatedLength - distance;
      env = Math.min(env, Math.max(0, remaining / fadeOutPx));
    }
    return Math.max(0, Math.min(1.0, env));
  }

  /**
   * Comprehensive Jitter Evaluation at a stroke stamp:
   * Returns modulation offsets for all targets.
   *
   * @param {Object} jitterConfig - Brush jitter configuration
   * @param {number} strokeSeed - Seed of current stroke
   * @param {number} distance - Cumulative stroke distance in px
   * @param {number} time - Stroke time in ms
   * @param {number} speed - Instantaneous finger speed px/ms
   * @param {number} totalLength - Total/expected stroke length for fade
   * @returns {Object} Target modulation deltas
   */
  static evaluateAllTargets(jitterConfig, strokeSeed, distance, time, speed = 0, totalLength = 0) {
    const defaults = {
      sizeDelta: 0,
      opacityDelta: 0,
      flowDelta: 0,
      angleDelta: 0,
      wobbleX: 0,
      wobbleY: 0,
      hueDelta: 0,
      satDelta: 0,
      brightDelta: 0,
      spacingDelta: 0
    };

    if (!jitterConfig || !jitterConfig.enabled) {
      return defaults;
    }

    const rawNoise = CoherentNoise.computeNoiseSample(jitterConfig, strokeSeed, distance, time);
    const env = CoherentNoise.computeEnvelope(distance, totalLength, jitterConfig.fadeIn || 0, jitterConfig.fadeOut || 0);

    // Velocity Link: amplitude can react to speed (-100 to +100)
    let velMod = 1.0;
    const vLink = jitterConfig.velocityLink ?? 0;
    if (vLink !== 0) {
      const clampedSpeed = Math.min(5.0, Math.max(0, speed));
      const speedNorm = clampedSpeed / 2.5; // ~1.0 at normal drawing speed
      if (vLink > 0) {
        velMod = 1.0 + (speedNorm - 1.0) * (vLink / 100);
      } else {
        velMod = 1.0 - (speedNorm - 1.0) * (Math.abs(vLink) / 100);
      }
      velMod = Math.max(0.1, Math.min(3.0, velMod));
    }

    const baseAmp = (jitterConfig.amplitude ?? 1.0) * env * velMod;
    const targets = jitterConfig.targets || {};

    // 2nd decorrelated noise for 2D wobble
    const secondaryNoise = CoherentNoise.computeNoiseSample(jitterConfig, strokeSeed + 4099, distance + 100, time + 200);

    const sizeTarget = (targets.size ?? 30) / 100;
    const opacityTarget = (targets.opacity ?? 0) / 100;
    const flowTarget = (targets.flow ?? 0) / 100;
    const angleTarget = (targets.angle ?? 0) / 100;
    const wobbleTarget = (targets.positionWobble ?? 0) / 100;
    const hueTarget = (targets.hue ?? 0) / 100;
    const satTarget = (targets.saturation ?? 0) / 100;
    const brightTarget = (targets.brightness ?? 0) / 100;
    const spacingTarget = (targets.spacing ?? 0) / 100;

    return {
      sizeDelta: rawNoise * baseAmp * sizeTarget * 0.5,
      opacityDelta: rawNoise * baseAmp * opacityTarget,
      flowDelta: rawNoise * baseAmp * flowTarget,
      angleDelta: rawNoise * baseAmp * angleTarget * 0.5 * Math.PI,
      wobbleX: rawNoise * baseAmp * wobbleTarget * 3.5,
      wobbleY: secondaryNoise * baseAmp * wobbleTarget * 3.5,
      hueDelta: rawNoise * baseAmp * hueTarget * 40, // degrees
      satDelta: rawNoise * baseAmp * satTarget * 0.4,
      brightDelta: rawNoise * baseAmp * brightTarget * 0.4,
      spacingDelta: rawNoise * baseAmp * spacingTarget * 0.5
    };
  }

  /**
   * Generates sample points for rendering the noise waveform onto a UI Canvas.
   */
  static generateWaveformSamples(jitterConfig, count = 120, width = 280, height = 36) {
    const points = [];
    const seed = (jitterConfig.seed || 1337) >>> 0;
    const centerY = height / 2;
    const maxH = height * 0.42;

    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1)) * width;
      const dist = (i / count) * 400;
      const noise = CoherentNoise.computeNoiseSample(jitterConfig, seed, dist, 0);
      const y = centerY - noise * maxH;
      points.push({ x, y });
    }
    return points;
  }
}
