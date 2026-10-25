/* Vectura Unified Self-Contained Bundle */
(function() {
"use strict";


/* --- CatmullRom.js --- */
/**
 * Vectura Vector Engine - Centripetal Catmull-Rom Splines & Geometry
 * Centripetal parameterization (alpha = 0.5) avoids cusps and self-intersections.
 */
class CatmullRomSpline {
  constructor(alpha = 0.5) {
    this.alpha = alpha; // 0.5 = centripetal, 0.0 = uniform, 1.0 = chordal
  }

  /**
   * Evaluates a segment between P1 and P2 using four points P0, P1, P2, P3.
   * Returns an array of interpolated sample points with {x, y, pressure, time, distance}.
   */
  interpolateSegment(p0, p1, p2, p3, adaptiveSteps = 8) {
    const getT = (tPrev, pA, pB) => {
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const dist = Math.hypot(dx, dy);
      return tPrev + Math.pow(Math.max(dist, 1e-4), this.alpha);
    };

    const t0 = 0;
    const t1 = getT(t0, p0, p1);
    const t2 = getT(t1, p1, p2);
    const t3 = getT(t2, p2, p3);

    // Segment length estimate
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.min(64, Math.ceil(chord / 3) * adaptiveSteps / 8));

    const samples = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = t1 + u * (t2 - t1);

      // Catmull-Rom centripetal formulation
      const a1_x = (t1 - t) / (t1 - t0) * p0.x + (t - t0) / (t1 - t0) * p1.x;
      const a1_y = (t1 - t) / (t1 - t0) * p0.y + (t - t0) / (t1 - t0) * p1.y;
      const a2_x = (t2 - t) / (t2 - t1) * p1.x + (t - t1) / (t2 - t1) * p2.x;
      const a2_y = (t2 - t) / (t2 - t1) * p1.y + (t - t1) / (t2 - t1) * p2.y;
      const a3_x = (t3 - t) / (t3 - t2) * p2.x + (t - t2) / (t3 - t2) * p3.x;
      const a3_y = (t3 - t) / (t3 - t2) * p2.y + (t - t2) / (t3 - t2) * p3.y;

      const b1_x = (t2 - t) / (t2 - t0) * a1_x + (t - t0) / (t2 - t0) * a2_x;
      const b1_y = (t2 - t) / (t2 - t0) * a1_y + (t - t0) / (t2 - t0) * a2_y;
      const b2_x = (t3 - t) / (t3 - t1) * a2_x + (t - t1) / (t3 - t1) * a3_x;
      const b2_y = (t3 - t) / (t3 - t1) * a2_y + (t - t1) / (t3 - t1) * a3_y;

      const c_x = (t2 - t) / (t2 - t1) * b1_x + (t - t1) / (t2 - t1) * b2_x;
      const c_y = (t2 - t) / (t2 - t1) * b1_y + (t - t1) / (t2 - t1) * b2_y;

      // Linear interpolation of pressure and time
      const pressure = p1.pressure + u * (p2.pressure - p1.pressure);
      const time = p1.time + u * (p2.time - p1.time);

      samples.push({
        x: c_x,
        y: c_y,
        pressure: Math.max(0.01, Math.min(1.0, pressure)),
        time: time
      });
    }

    return samples;
  }

  /**
   * Generates smooth dense polyline samples strictly spaced by stepPx arc-length distance.
   * Completely eliminates stamp piling and unpredictable opacity clustering.
   */
  sampleStroke(controlPoints, stepPx = 4) {
    if (!controlPoints || controlPoints.length === 0) return [];
    if (controlPoints.length === 1) {
      const p = controlPoints[0];
      return [{ x: p.x, y: p.y, pressure: p.pressure || 0.5, time: p.time || 0, distance: 0 }];
    }

    // 1. Generate dense polyline along spline
    const dense = [];
    const n = controlPoints.length;
    let totalDist = 0;

    for (let i = 0; i < n - 1; i++) {
      const p0 = i === 0 ? controlPoints[0] : controlPoints[i - 1];
      const p1 = controlPoints[i];
      const p2 = controlPoints[i + 1];
      const p3 = i + 2 < n ? controlPoints[i + 2] : p2;

      const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const subSteps = Math.max(2, Math.min(16, Math.ceil(segDist / 2)));
      const seg = this.interpolateSegment(p0, p1, p2, p3, subSteps);
      const startIdx = i === 0 ? 0 : 1;
      for (let j = startIdx; j < seg.length; j++) {
        const pt = seg[j];
        if (dense.length > 0) {
          const prev = dense[dense.length - 1];
          totalDist += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        }
        pt.distance = totalDist;
        dense.push(pt);
      }
    }

    if (dense.length <= 1) return dense;

    // 2. Uniform Arc-Length Resampling strictly by stepPx
    const step = Math.max(0.5, stepPx || 4);
    const samples = [dense[0]];
    let nextDist = step;
    let dIdx = 0;

    while (nextDist <= totalDist && dIdx < dense.length - 1) {
      while (dIdx < dense.length - 1 && dense[dIdx + 1].distance < nextDist) {
        dIdx++;
      }
      if (dIdx >= dense.length - 1) break;

      const pA = dense[dIdx];
      const pB = dense[dIdx + 1];
      const span = pB.distance - pA.distance;
      const u = span > 0.0001 ? (nextDist - pA.distance) / span : 0;

      samples.push({
        x: pA.x + u * (pB.x - pA.x),
        y: pA.y + u * (pB.y - pA.y),
        pressure: pA.pressure + u * (pB.pressure - pA.pressure),
        time: pA.time + u * (pB.time - pA.time),
        distance: nextDist
      });

      nextDist += step;
    }

    const lastDense = dense[dense.length - 1];
    if (samples.length === 1 || Math.hypot(lastDense.x - samples[samples.length - 1].x, lastDense.y - samples[samples.length - 1].y) > step * 0.4) {
      samples.push(lastDense);
    }

    return samples;
  }
}

/**
 * Pixel-perfect line algorithm with L-corner removal for Pixel Art mode.
 */
function bresenhamPixelPerfect(x0, y0, x1, y1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  const points = [];
  let currX = x0;
  let currY = y0;

  while (true) {
    points.push({ x: currX, y: currY });
    if (currX === x1 && currY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }

  // Remove duplicate diagonal L-corners for clean pixel art stroke
  if (points.length < 3) return points;
  const filtered = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // If step is a right-angle corner between prev and next
    if (
      (prev.x === curr.x && curr.y === next.y) ||
      (prev.y === curr.y && curr.x === next.x)
    ) {
      // Check if diagonal exists
      if (Math.abs(next.x - prev.x) === 1 && Math.abs(next.y - prev.y) === 1) {
        continue; // skip the extra corner pixel
      }
    }
    filtered.push(curr);
  }
  filtered.push(points[points.length - 1]);
  return filtered;
}

/**
 * Ramer-Douglas-Peucker curve simplification algorithm for vector optimization.
 */
function simplifyPoints(points, epsilon = 1.0) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const pStart = points[0];
  const pEnd = points[points.length - 1];

  const lineDist = (p, a, b) => {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
    const projX = a.x + t * (b.x - a.x);
    const projY = a.y + t * (b.y - a.y);
    return Math.hypot(p.x - projX, p.y - projY);
  };

  for (let i = 1; i < points.length - 1; i++) {
    const d = lineDist(points[i], pStart, pEnd);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, index + 1), epsilon);
    const right = simplifyPoints(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [pStart, pEnd];
  }
}

/* --- PressureEngine.js --- */
/**
 * Vectura Velocity Dynamics Engine
 * The brush is driven ONLY by finger velocity.
 * Features:
 * - Velocity Factor (-100 to +100, default 0 = neutral)
 *   Positive: faster strokes increase effect. Negative: faster strokes decrease effect.
 * - Draggable cubic Bezier response curve
 * - Moving average + EMA speed smoothing
 * - Hard ink-bleed prevention: minimum dt clamp, duplicate point rejection, finite validation, strict bounds
 */
class PressureEngine {
  constructor(config = {}) {
    this.factor = config.factor ?? 0;
    this.smoothing = config.smoothing ?? 0.35;
    this.minOutput = config.minOutput ?? 0.1;
    this.maxOutput = config.maxOutput ?? 1.0;

    this.prevPoint = null;
    this.filteredSpeed = 0;
    this.speedHistory = [];
    this.lastOutput = 0.5;
    this.lastMetrics = {
      rawSpeed: 0,
      filteredSpeed: 0,
      normSpeed: 0,
      linearOutput: 0.5,
      curveOutput: 0.5,
      output: 0.5,
      minOutput: 0.1,
      maxOutput: 1.0
    };
  }

  reset() {
    this.prevPoint = null;
    this.filteredSpeed = 0;
    this.speedHistory = [];
    this.lastOutput = 0.5;
    this.lastMetrics = {
      rawSpeed: 0,
      filteredSpeed: 0,
      normSpeed: 0,
      linearOutput: 0.5,
      curveOutput: 0.5,
      output: 0.5,
      minOutput: 0.1,
      maxOutput: 1.0
    };
  }

  resolvePressure(event, currentPoint, brush = null, globalSpeedFactor = 1.0) {
    return this.resolveVelocity(event, currentPoint, brush, globalSpeedFactor);
  }

  /**
   * Computes finger speed and maps it through per-brush Velocity Dynamics.
   * Driven purely by finger velocity.
   */
  resolveVelocity(event, currentPoint, brush = null, globalSpeedFactor = 1.0) {
    if (!currentPoint || !Number.isFinite(currentPoint.x) || !Number.isFinite(currentPoint.y)) {
      return this.lastOutput;
    }

    const now = (event && event.timeStamp && Number.isFinite(event.timeStamp)) 
      ? event.timeStamp 
      : performance.now();

    let rawSpeed = 0;

    if (this.prevPoint) {
      // INK BLEED FIX: Clamp dt to at least 8ms to prevent division by near-zero spikes
      const dt = Math.max(8, now - this.prevPoint.time);
      const dx = currentPoint.x - this.prevPoint.x;
      const dy = currentPoint.y - this.prevPoint.y;
      const dist = Math.hypot(dx, dy);

      // INK BLEED FIX: Reject duplicate points
      if (dist < 0.25 && dt < 6) {
        return this.lastOutput;
      }

      if (Number.isFinite(dist) && Number.isFinite(dt)) {
        rawSpeed = dist / dt; // pixels per millisecond
        // Clamp raw speed to realistic upper limit (10 px/ms = 10,000 px/sec)
        rawSpeed = Math.min(10.0, Math.max(0, rawSpeed));
      }
    } else {
      rawSpeed = 0.5; // baseline starting speed
    }

    this.prevPoint = { x: currentPoint.x, y: currentPoint.y, time: now };

    // Maintain 4-sample moving average for speed stability
    this.speedHistory.push(rawSpeed);
    if (this.speedHistory.length > 4) {
      this.speedHistory.shift();
    }
    const avgSpeed = this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;

    // Retrieve per-brush velocity dynamics parameters
    const vd = brush?.velocityDynamics || {
      factor: this.factor ?? 0,
      minSpeed: 0.0,
      maxSpeed: 3.0,
      curve: [0.25, 0.1, 0.25, 1.0],
      smoothing: this.smoothing ?? 0.35,
      minOutput: this.minOutput ?? 0.1,
      maxOutput: this.maxOutput ?? 1.0
    };

    // Global speed factor scaling
    const globalScale = Math.max(0.05, Math.min(5.0, Number.isFinite(globalSpeedFactor) ? globalSpeedFactor : 1.0));
    const effectiveSpeed = avgSpeed * globalScale;

    // Exponential moving average smoothing
    const smoothing = Math.max(0.01, Math.min(0.95, vd.smoothing ?? 0.35));
    if (this.filteredSpeed === 0) {
      this.filteredSpeed = effectiveSpeed;
    } else {
      this.filteredSpeed = this.filteredSpeed * (1 - smoothing) + effectiveSpeed * smoothing;
    }

    // Normalized speed within [minSpeed, maxSpeed]
    const minSpd = Math.max(0, Number.isFinite(vd.minSpeed) ? vd.minSpeed : 0.0);
    const maxSpd = Math.max(minSpd + 0.1, Number.isFinite(vd.maxSpeed) ? vd.maxSpeed : 3.0);
    const speedRatio = Math.max(0, Math.min(1.0, (this.filteredSpeed - minSpd) / (maxSpd - minSpd)));

    // Evaluate Draggable Cubic Bezier Curve
    const curve = Array.isArray(vd.curve) && vd.curve.length === 4 ? vd.curve : [0.25, 0.1, 0.25, 1.0];
    const curveVal = PressureEngine.evaluateCubicBezier(speedRatio, curve[0], curve[1], curve[2], curve[3]);

    // VELOCITY FACTOR (-100 to +100, default 0 = neutral):
    // Positive: faster strokes increase output
    // Negative: faster strokes decrease output
    // Magnitude controls strength
    const factorInt = Math.max(-100, Math.min(100, Math.round(vd.factor ?? 0)));
    const strength = Math.abs(factorInt) / 100;

    let responseCurve = 0.5;
    let responseLinear = 0.5;

    if (factorInt >= 0) {
      // Faster strokes increase
      responseCurve = 0.5 + (curveVal - 0.5) * strength;
      responseLinear = 0.5 + (speedRatio - 0.5) * strength;
    } else {
      // Faster strokes decrease
      responseCurve = 0.5 - (curveVal - 0.5) * strength;
      responseLinear = 0.5 - (speedRatio - 0.5) * strength;
    }

    responseCurve = Math.max(0.0, Math.min(1.0, responseCurve));
    responseLinear = Math.max(0.0, Math.min(1.0, responseLinear));

    // Map to Output range [minOutput, maxOutput]
    const minOut = Math.max(0.0, Math.min(1.0, Number.isFinite(vd.minOutput) ? vd.minOutput : 0.1));
    const maxOut = Math.max(minOut, Math.min(1.0, Number.isFinite(vd.maxOutput) ? vd.maxOutput : 1.0));

    let output = minOut + responseCurve * (maxOut - minOut);

    // Hard bounds & finite validation
    if (!Number.isFinite(output)) output = (minOut + maxOut) / 2;
    output = Math.max(minOut, Math.min(maxOut, output));

    this.lastOutput = output;
    this.lastMetrics = {
      rawSpeed,
      filteredSpeed: this.filteredSpeed,
      normSpeed: speedRatio,
      linearOutput: responseLinear,
      curveOutput: responseCurve,
      output,
      minOutput: minOut,
      maxOutput: maxOut
    };

    return output;
  }

  /**
   * Evaluates velocity target modulation
   */
  static evaluateTarget(targetConfig, metrics) {
    if (!targetConfig || targetConfig.enabled === false) {
      return 1.0;
    }
    const val = targetConfig.useCurve ? metrics.curveOutput : metrics.linearOutput;
    const mapped = metrics.minOutput + val * (metrics.maxOutput - metrics.minOutput);
    const factor = Number.isFinite(targetConfig.factor) ? targetConfig.factor : 1.0;
    const result = 1.0 + (mapped - 1.0) * factor;
    return Number.isFinite(result) ? Math.max(0.0, result) : 1.0;
  }

  /**
   * Draggable Cubic Bezier: B(t) with control points (p1x, p1y), (p2x, p2y).
   */
  static evaluateCubicBezier(t, p1x = 0.25, p1y = 0.1, p2x = 0.25, p2y = 1.0) {
    t = Math.max(0, Math.min(1, t));

    p1x = Math.max(0, Math.min(1, Number.isFinite(p1x) ? p1x : 0.25));
    p1y = Number.isFinite(p1y) ? p1y : 0.1;
    p2x = Math.max(0, Math.min(1, Number.isFinite(p2x) ? p2x : 0.25));
    p2y = Number.isFinite(p2y) ? p2y : 1.0;

    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    const sampleX = (u) => ((ax * u + bx) * u + cx) * u;
    const sampleY = (u) => ((ay * u + by) * u + cy) * u;

    let u = t;
    for (let i = 0; i < 8; i++) {
      const currentX = sampleX(u) - t;
      if (Math.abs(currentX) < 1e-4) break;
      const slope = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(slope) < 1e-5) break;
      u -= currentX / slope;
      u = Math.max(0, Math.min(1, u));
    }
    const y = sampleY(u);
    return Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : t;
  }
}

/* --- Stabilizer.js --- */
/**
 * Vectura Stroke Stabilizer Engine
 * Supports: Off, Light (Exponential Moving Average), Rope (Lazy-Rope with visual line), Post-correction.
 */
class Stabilizer {
  constructor(config = {}) {
    this.mode = config.mode || 'light';       // 'off' | 'light' | 'rope' | 'post'
    this.strength = config.strength ?? 35;    // 0 to 100

    this.active = false;
    this.targetPos = null;
    this.currentPos = null;
    this.lastEmitted = null;
    this.ropeLength = 20; // in canvas pixels
  }

  setMode(mode) {
    this.mode = mode;
  }

  setStrength(strength) {
    this.strength = Math.max(0, Math.min(100, strength));
    // Rope length scales with strength: 5px to 80px
    this.ropeLength = 5 + (this.strength / 100) * 75;
  }

  reset() {
    this.active = false;
    this.targetPos = null;
    this.currentPos = null;
    this.lastEmitted = null;
  }

  begin(point) {
    this.active = true;
    this.targetPos = { ...point };
    this.currentPos = { ...point };
    this.lastEmitted = { ...point };
    return { ...point };
  }

  /**
   * Processes a new incoming pointer position.
   * Returns stabilized point or null if rope hasn't moved past radius.
   */
  update(point) {
    if (!this.active) return point;
    this.targetPos = { ...point };

    if (this.mode === 'off' || this.strength === 0) {
      this.currentPos = { ...point };
      this.lastEmitted = { ...point };
      return { ...point };
    }

    if (this.mode === 'light' || this.mode === 'post') {
      // Exponential moving average: alpha derived from strength
      // strength 0 -> alpha = 1.0; strength 100 -> alpha = 0.08
      const alpha = Math.max(0.08, 1.0 - (this.strength / 100) * 0.88);
      this.currentPos.x += (this.targetPos.x - this.currentPos.x) * alpha;
      this.currentPos.y += (this.targetPos.y - this.currentPos.y) * alpha;
      this.currentPos.pressure = point.pressure;
      this.currentPos.time = point.time;
      this.lastEmitted = { ...this.currentPos };
      return { ...this.currentPos };
    }

    if (this.mode === 'rope') {
      // Lazy rope: currentPos trails targetPos by ropeLength
      const dx = this.targetPos.x - this.currentPos.x;
      const dy = this.targetPos.y - this.currentPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > this.ropeLength) {
        const excess = dist - this.ropeLength;
        const angle = Math.atan2(dy, dx);
        this.currentPos.x += Math.cos(angle) * excess;
        this.currentPos.y += Math.sin(angle) * excess;
        this.currentPos.pressure = point.pressure;
        this.currentPos.time = point.time;
        this.lastEmitted = { ...this.currentPos };
        return { ...this.currentPos };
      }
      return null; // Rope hasn't pulled yet
    }

    return point;
  }

  /**
   * Called on stroke end (pointerup).
   * Catches up to final finger position so no clipped tails.
   */
  finish() {
    if (!this.active) return [];
    this.active = false;

    if (!this.targetPos || !this.currentPos) return [];

    const catchUpPoints = [];
    if (this.mode === 'rope' || (this.mode === 'light' && this.strength > 20)) {
      // Generate 4-8 catch-up points smoothly interpolating to target
      const dx = this.targetPos.x - this.currentPos.x;
      const dy = this.targetPos.y - this.currentPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1.0) {
        const steps = Math.min(10, Math.max(3, Math.ceil(dist / 4)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          catchUpPoints.push({
            x: this.currentPos.x + dx * t,
            y: this.currentPos.y + dy * t,
            pressure: this.targetPos.pressure,
            time: this.targetPos.time
          });
        }
      }
    } else {
      catchUpPoints.push({ ...this.targetPos });
    }

    return catchUpPoints;
  }

  /**
   * If in rope mode, returns rope line info for on-canvas visual guide.
   */
  getRopeVisual() {
    if (this.active && this.mode === 'rope' && this.targetPos && this.currentPos) {
      return {
        finger: this.targetPos,
        tip: this.currentPos,
        length: this.ropeLength
      };
    }
    return null;
  }
}

/* --- CoherentNoise.js --- */
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
class CoherentNoise {
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

/* --- Viewport.js --- */
/**
 * Vectura Viewport & Camera Engine
 * Handles Pan, Zoom (5% to 6400%), Rotation with soft 0 snap, Mirror view, and Inertia.
 */
class Viewport {
  constructor(canvasWidth = 1080, canvasHeight = 1080) {
    this.docWidth = canvasWidth;
    this.docHeight = canvasHeight;

    // Viewport transforms (in screen coordinates)
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.rotation = 0; // in radians
    this.mirrored = false;

    // Constraints
    this.minZoom = 0.05; // 5%
    this.maxZoom = 64.0; // 6400%
    this.snapThreshold = (1.0 * Math.PI) / 180; // 1.0 degree subtle snap

    // Screen dimensions
    this.screenWidth = window.innerWidth || 360;
    this.screenHeight = window.innerHeight || 640;

    // Inertia state
    this.velocityX = 0;
    this.velocityY = 0;
  }

  resizeScreen(width, height) {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  setDocumentSize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.resetView();
  }

  resetView() {
    this.rotation = 0;
    this.mirrored = false;
    this.fitToScreen();
  }

  fitToScreen() {
    const margin = 24;
    const availW = Math.max(80, this.screenWidth - margin * 2);
    const availH = Math.max(80, this.screenHeight - margin * 2);

    const scaleX = availW / this.docWidth;
    const scaleY = availH / this.docHeight;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(scaleX, scaleY)));

    this.panX = this.screenWidth / 2;
    this.panY = this.screenHeight / 2;
    this.rotation = 0;
  }

  set100Percent() {
    this.zoom = 1.0;
    this.panX = this.screenWidth / 2;
    this.panY = this.screenHeight / 2;
    this.rotation = 0;
  }

  toggleMirror() {
    this.mirrored = !this.mirrored;
  }

  /**
   * Applies pan delta in screen pixels.
   */
  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  /**
   * Zooms anchored around a screen center point (cx, cy).
   */
  zoomAt(factor, cx, cy) {
    const prevZoom = this.zoom;
    const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, prevZoom * factor));
    const ratio = nextZoom / prevZoom;

    // Anchor pan to screen point
    this.panX = cx - (cx - this.panX) * ratio;
    this.panY = cy - (cy - this.panY) * ratio;
    this.zoom = nextZoom;
  }

  /**
   * Rotates anchored around a screen center point (cx, cy) with smooth sensitivity and soft zero attraction.
   */
  rotateAt(deltaAngle, cx, cy) {
    if (Math.abs(deltaAngle) < 0.00001) return;

    let nextAngle = this.rotation + deltaAngle;

    // Normalize angle to [-PI, PI]
    while (nextAngle > Math.PI) nextAngle -= 2 * Math.PI;
    while (nextAngle < -Math.PI) nextAngle += 2 * Math.PI;

    // Soft zero attraction instead of harsh snapping jump
    if (Math.abs(nextAngle) < 0.02) {
      nextAngle *= 0.88;
      if (Math.abs(nextAngle) < 0.002) nextAngle = 0;
    }

    const actualDelta = nextAngle - this.rotation;
    const cos = Math.cos(actualDelta);
    const sin = Math.sin(actualDelta);
    const dx = this.panX - cx;
    const dy = this.panY - cy;
    this.panX = cx + (dx * cos - dy * sin);
    this.panY = cy + (dx * sin + dy * cos);

    this.rotation = nextAngle;
  }

  /**
   * Converts Screen (pixel) coordinates -> Canvas Document coordinates.
   */
  screenToWorld(sx, sy) {
    // 1. Shift by pan offset
    let x = sx - this.panX;
    let y = sy - this.panY;

    // 2. Undo rotation
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      x = rx;
      y = ry;
    }

    // 3. Undo mirror
    if (this.mirrored) {
      x = -x;
    }

    // 4. Undo zoom
    x /= this.zoom;
    y /= this.zoom;

    // 5. Shift relative to document center
    x += this.docWidth / 2;
    y += this.docHeight / 2;

    return { x, y };
  }

  /**
   * Converts Canvas Document coordinates -> Screen (pixel) coordinates.
   */
  worldToScreen(wx, wy) {
    let x = wx - this.docWidth / 2;
    let y = wy - this.docHeight / 2;

    x *= this.zoom;
    y *= this.zoom;

    if (this.mirrored) {
      x = -x;
    }

    if (this.rotation !== 0) {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      x = rx;
      y = ry;
    }

    x += this.panX;
    y += this.panY;

    return { x, y };
  }

  /**
   * Applies current transform matrix to a 2D rendering context.
   */
  applyTransform(ctx) {
    ctx.translate(this.panX, this.panY);
    if (this.rotation !== 0) {
      ctx.rotate(this.rotation);
    }
    if (this.mirrored) {
      ctx.scale(-1, 1);
    }
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.docWidth / 2, -this.docHeight / 2);
  }
}

/* --- BlendModes.js --- */
/**
 * Vectura 18 Blend Modes Definition & Canvas Mappings
 */
const BLEND_MODES = [
  { id: 'source-over', name: 'Normal', canvasOp: 'source-over' },
  { id: 'multiply', name: 'Multiply', canvasOp: 'multiply' },
  { id: 'screen', name: 'Screen', canvasOp: 'screen' },
  { id: 'overlay', name: 'Overlay', canvasOp: 'overlay' },
  { id: 'soft-light', name: 'Soft Light', canvasOp: 'soft-light' },
  { id: 'hard-light', name: 'Hard Light', canvasOp: 'hard-light' },
  { id: 'color-dodge', name: 'Color Dodge', canvasOp: 'color-dodge' },
  { id: 'color-burn', name: 'Color Burn', canvasOp: 'color-burn' },
  { id: 'darken', name: 'Darken', canvasOp: 'darken' },
  { id: 'lighten', name: 'Lighten', canvasOp: 'lighten' },
  { id: 'difference', name: 'Difference', canvasOp: 'difference' },
  { id: 'exclusion', name: 'Exclusion', canvasOp: 'exclusion' },
  { id: 'hue', name: 'Hue', canvasOp: 'hue' },
  { id: 'saturation', name: 'Saturation', canvasOp: 'saturation' },
  { id: 'color', name: 'Color', canvasOp: 'color' },
  { id: 'luminosity', name: 'Luminosity', canvasOp: 'luminosity' },
  { id: 'lighter', name: 'Add (Linear Dodge)', canvasOp: 'lighter' },
  { id: 'subtract', name: 'Subtract', canvasOp: 'difference' } // Fallback for canvas
];

function getCanvasCompositeOp(modeId) {
  const found = BLEND_MODES.find(m => m.id === modeId);
  return found ? found.canvasOp : 'source-over';
}

/* --- Layer.js --- */
/**
 * Vectura Layer Model
 * Each layer holds its vector strokes, a cached raster canvas, and properties.
 */


class Layer {
  constructor(id, name, width, height, type = 'raster') {
    this.id = id || ('layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
    this.name = name || 'Layer';
    this.type = type; // 'raster'
    this.width = width;
    this.height = height;

    // Layer state
    this.visible = true;
    this.locked = false;
    this.alphaLock = false;
    this.clippingMask = false;
    this.isReference = false;
    this.opacity = 1.0;
    this.blendMode = 'source-over';
    this.folderId = null;

    // Vector strokes & shapes on this layer
    this.strokes = [];

    // Cached raster canvas for 60fps performance
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Thumbnail canvas (64x64)
    this.thumbCanvas = document.createElement('canvas');
    this.thumbCanvas.width = 64;
    this.thumbCanvas.height = 64;
    this.thumbCtx = this.thumbCanvas.getContext('2d');

    this.isDirty = true;
  }

  resize(newWidth, newHeight) {
    if (this.width === newWidth && this.height === newHeight) return;
    const oldCanvas = this.canvas;
    this.width = newWidth;
    this.height = newHeight;

    this.canvas = document.createElement('canvas');
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.ctx.drawImage(oldCanvas, 0, 0);
    this.updateThumbnail();
    this.isDirty = true;
  }

  clear() {
    this.strokes = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.updateThumbnail();
    this.isDirty = true;
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
    this.isDirty = true;
  }

  updateThumbnail() {
    this.thumbCtx.clearRect(0, 0, 64, 64);
    const maxDim = 64;
    const w = this.width || 1;
    const h = this.height || 1;
    const scale = Math.min(maxDim / w, maxDim / h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    const dx = Math.round((maxDim - dw) / 2);
    const dy = Math.round((maxDim - dh) / 2);
    this.thumbCtx.drawImage(
      this.canvas,
      0, 0, w, h,
      dx, dy, dw, dh
    );
  }

  release() {
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.thumbCanvas.width = 1;
    this.thumbCanvas.height = 1;
    this.strokes = [];
  }

  clone(newId, newName) {
    const copy = new Layer(newId, newName, this.width, this.height, this.type);
    copy.visible = this.visible;
    copy.locked = this.locked;
    copy.alphaLock = this.alphaLock;
    copy.clippingMask = this.clippingMask;
    copy.isReference = this.isReference;
    copy.opacity = this.opacity;
    copy.blendMode = this.blendMode;
    copy.folderId = this.folderId;
    copy.strokes = JSON.parse(JSON.stringify(this.strokes));
    copy.ctx.drawImage(this.canvas, 0, 0);
    copy.updateThumbnail();
    return copy;
  }
}

/* --- LayerManager.js --- */
/**
 * Vectura Layer Manager
 * Handles layer ordering, blend modes, clipping masks, folders, and composite caching.
 */



class LayerManager {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.docWidth = docWidth;
    this.docHeight = docHeight;
    this.layers = [];
    this.activeLayerId = null;

    // Background configuration
    this.backgroundColor = '#ffffff'; // null for transparent, or hex string
    this.isTransparentBg = false;

    // Composite caches
    this.cacheBelow = document.createElement('canvas');
    this.cacheBelow.width = docWidth;
    this.cacheBelow.height = docHeight;
    this.cacheBelowCtx = this.cacheBelow.getContext('2d');

    this.cacheAbove = document.createElement('canvas');
    this.cacheAbove.width = docWidth;
    this.cacheAbove.height = docHeight;
    this.cacheAboveCtx = this.cacheAbove.getContext('2d');

    this.cachedComposite = document.createElement('canvas');
    this.cachedComposite.width = docWidth;
    this.cachedComposite.height = docHeight;
    this.cachedCompositeCtx = this.cachedComposite.getContext('2d');

    // Clipping group offscreen buffer
    this.clipGroupCanvas = document.createElement('canvas');
    this.clipGroupCanvas.width = docWidth;
    this.clipGroupCanvas.height = docHeight;
    this.clipGroupCtx = this.clipGroupCanvas.getContext('2d');

    this.needsRecomposite = true;

    // Initialize default base layer
    this.createInitialLayer();
  }

  get activeLayerIndex() {
    const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
    return idx >= 0 ? idx : 0;
  }

  createInitialLayer() {
    const l1 = new Layer('layer_1', 'Layer 1', this.docWidth, this.docHeight, 'raster');
    this.layers = [l1];
    this.activeLayerId = l1.id;
    this.invalidateCaches();
  }

  resizeDocument(newW, newH) {
    this.docWidth = newW;
    this.docHeight = newH;
    for (const l of this.layers) {
      l.resize(newW, newH);
    }
    this.cacheBelow.width = newW;
    this.cacheBelow.height = newH;
    this.cacheAbove.width = newW;
    this.cacheAbove.height = newH;
    this.cachedComposite.width = newW;
    this.cachedComposite.height = newH;
    this.invalidateCaches();
  }

  getLayer(id) {
    return this.layers.find(l => l.id === id) || null;
  }

  getActiveLayer() {
    return this.layers.find(l => l.id === this.activeLayerId) || this.layers[0];
  }

  setActiveLayer(id) {
    if (this.layers.some(l => l.id === id)) {
      this.activeLayerId = id;
      this.updateAroundActiveCaches();
    }
  }

  /**
   * Deep or lightweight snapshot of layer manager state for undo/redo.
   * If includePixels is false, avoids heavy full-resolution canvas copying.
   */
  createSnapshot(includePixels = true) {
    return {
      activeLayerId: this.activeLayerId,
      backgroundColor: this.backgroundColor,
      isTransparentBg: this.isTransparentBg,
      isMetadataOnly: !includePixels,
      layers: this.layers.map(l => {
        let copyCanvas = null;
        if (includePixels) {
          copyCanvas = document.createElement('canvas');
          copyCanvas.width = l.width;
          copyCanvas.height = l.height;
          copyCanvas.getContext('2d').drawImage(l.canvas, 0, 0);
        }

        return {
          id: l.id,
          name: l.name,
          type: l.type,
          width: l.width,
          height: l.height,
          visible: l.visible,
          locked: l.locked,
          opacity: l.opacity,
          blendMode: l.blendMode,
          clippingMask: l.clippingMask,
          alphaLock: l.alphaLock,
          isReference: l.isReference,
          strokes: [...l.strokes],
          canvasClone: copyCanvas
        };
      })
    };
  }

  /**
   * Restores complete layer manager state from snapshot.
   */
  restoreSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.layers)) return;

    this.activeLayerId = snapshot.activeLayerId;
    this.backgroundColor = snapshot.backgroundColor;
    this.isTransparentBg = snapshot.isTransparentBg;

    const existingMap = new Map();
    for (const l of this.layers) {
      existingMap.set(l.id, l);
    }

    this.layers = snapshot.layers.map(s => {
      let layer = existingMap.get(s.id);
      if (layer && !s.canvasClone) {
        // Reuse existing layer instance and update metadata instantly
        layer.name = s.name;
        layer.visible = s.visible;
        layer.locked = s.locked;
        layer.opacity = s.opacity;
        layer.blendMode = s.blendMode;
        layer.clippingMask = s.clippingMask;
        layer.alphaLock = s.alphaLock;
        layer.isReference = s.isReference;
        return layer;
      }

      layer = new Layer(s.id, s.name, s.width, s.height, s.type);
      layer.visible = s.visible;
      layer.locked = s.locked;
      layer.opacity = s.opacity;
      layer.blendMode = s.blendMode;
      layer.clippingMask = s.clippingMask;
      layer.alphaLock = s.alphaLock;
      layer.isReference = s.isReference;
      layer.strokes = [...s.strokes];

      layer.ctx.clearRect(0, 0, layer.width, layer.height);
      if (s.canvasClone) {
        layer.ctx.drawImage(s.canvasClone, 0, 0);
      }
      layer.updateThumbnail();
      return layer;
    });

    this.invalidateCaches();
  }

  addLayer(name = 'New Layer', type = 'raster') {
    const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
    const newIdx = activeIdx >= 0 ? activeIdx + 1 : this.layers.length;
    const layer = new Layer(null, name, this.docWidth, this.docHeight, type);
    this.layers.splice(newIdx, 0, layer);
    this.activeLayerId = layer.id;
    this.invalidateCaches();
    return layer;
  }

  duplicateLayer(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx < 0) return null;
    const orig = this.layers[idx];
    const copy = orig.clone(null, orig.name + ' Copy');
    this.layers.splice(idx + 1, 0, copy);
    this.activeLayerId = copy.id;
    this.invalidateCaches();
    return copy;
  }

  deleteLayer(id) {
    if (this.layers.length <= 1) return false; // Keep at least one layer
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx < 0) return false;
    const removed = this.layers.splice(idx, 1)[0];
    removed.release();
    this.activeLayerId = this.layers[Math.max(0, idx - 1)].id;
    this.invalidateCaches();
    return true;
  }

  clearLayer(id) {
    const l = this.layers.find(layer => layer.id === id);
    if (l) {
      l.clear();
      this.invalidateCaches();
    }
  }

  reorder(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.layers.length || toIndex < 0 || toIndex >= this.layers.length) return;
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
    this.invalidateCaches();
  }

  mergeDown(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx <= 0) return false; // Bottom layer cannot merge down

    const upper = this.layers[idx];
    const lower = this.layers[idx - 1];

    // Combine strokes
    lower.strokes = lower.strokes.concat(upper.strokes);

    // Composite upper onto lower bitmap
    lower.ctx.save();
    lower.ctx.globalAlpha = upper.opacity;
    lower.ctx.globalCompositeOperation = getCanvasCompositeOp(upper.blendMode);
    lower.ctx.drawImage(upper.canvas, 0, 0);
    lower.ctx.restore();

    lower.updateThumbnail();
    this.layers.splice(idx, 1);
    upper.release();
    this.activeLayerId = lower.id;
    this.invalidateCaches();
    return true;
  }

  mergeVisible() {
    if (this.layers.length <= 1) return;
    const visibleLayers = this.layers.filter(l => l.visible);
    if (visibleLayers.length <= 1) return;

    const merged = new Layer('layer_merged', 'Merged', this.docWidth, this.docHeight, 'vector');
    this.compositeToCanvas(merged.ctx, false);
    merged.updateThumbnail();

    // Release all layers and replace with merged
    for (const l of this.layers) {
      l.release();
    }
    this.layers = [merged];
    this.activeLayerId = merged.id;
    this.invalidateCaches();
  }

  drawLayerToCtx(targetCtx, layer) {
    if (!layer || !layer.visible) return;
    targetCtx.save();
    targetCtx.globalAlpha = layer.opacity;
    targetCtx.globalCompositeOperation = getCanvasCompositeOp(layer.blendMode);
    targetCtx.drawImage(layer.canvas, 0, 0);
    targetCtx.restore();
  }

  invalidateCaches() {
    this.needsRecomposite = true;
    this.updateAroundActiveCaches();
  }

  /**
   * Updates cached below and above bitmaps relative to active layer.
   * This is key for 60fps drawing with many layers.
   */
  updateAroundActiveCaches() {
    const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
    if (activeIdx < 0) return;

    // 1. Build below cache
    this.cacheBelowCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    for (let i = 0; i < activeIdx; i++) {
      this.drawLayerToCtx(this.cacheBelowCtx, this.layers[i]);
    }

    // 2. Build above cache
    this.cacheAboveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    for (let i = activeIdx + 1; i < this.layers.length; i++) {
      this.drawLayerToCtx(this.cacheAboveCtx, this.layers[i]);
    }

    this.rebuildFullComposite();
  }

  /**
   * Renders the complete layer stack respecting clipping masks, alpha lock, and live stroke.
   */
  renderLayerStack(targetCtx, liveStrokeCanvas = null, liveOpacity = 1.0, liveBlendMode = 'source-over') {
    let i = 0;
    const n = this.layers.length;
    const active = this.getActiveLayer();

    while (i < n) {
      const layer = this.layers[i];
      if (!layer.visible) {
        i++;
        continue;
      }

      // Check if following layers are clipped to this layer
      let hasClipped = false;
      let j = i + 1;
      while (j < n && this.layers[j].clippingMask) {
        if (this.layers[j].visible) hasClipped = true;
        j++;
      }

      if (hasClipped) {
        // Render isolated clipping group
        this.clipGroupCtx.clearRect(0, 0, this.docWidth, this.docHeight);

        // 1. Draw base layer into group buffer
        this.clipGroupCtx.save();
        this.clipGroupCtx.globalAlpha = 1.0;
        this.clipGroupCtx.globalCompositeOperation = 'source-over';
        this.clipGroupCtx.drawImage(layer.canvas, 0, 0);

        if (layer === active && liveStrokeCanvas) {
          this.clipGroupCtx.save();
          this.clipGroupCtx.globalAlpha = liveOpacity;
          this.clipGroupCtx.globalCompositeOperation = layer.alphaLock ? 'source-atop' : getCanvasCompositeOp(liveBlendMode);
          this.clipGroupCtx.drawImage(liveStrokeCanvas, 0, 0);
          this.clipGroupCtx.restore();
        }
        this.clipGroupCtx.restore();

        // 2. Draw each clipped layer above it with source-atop
        for (let k = i + 1; k < j; k++) {
          const clipL = this.layers[k];
          if (!clipL.visible) continue;

          this.clipGroupCtx.save();
          this.clipGroupCtx.globalCompositeOperation = 'source-atop';
          this.clipGroupCtx.globalAlpha = clipL.opacity;
          this.clipGroupCtx.drawImage(clipL.canvas, 0, 0);

          if (clipL === active && liveStrokeCanvas) {
            this.clipGroupCtx.save();
            this.clipGroupCtx.globalAlpha = liveOpacity;
            this.clipGroupCtx.drawImage(liveStrokeCanvas, 0, 0);
            this.clipGroupCtx.restore();
          }
          this.clipGroupCtx.restore();
        }

        // 3. Draw merged clipping group onto targetCtx
        targetCtx.save();
        targetCtx.globalAlpha = layer.opacity;
        targetCtx.globalCompositeOperation = getCanvasCompositeOp(layer.blendMode);
        targetCtx.drawImage(this.clipGroupCanvas, 0, 0);
        targetCtx.restore();

        i = j;
      } else {
        // Normal unclipped layer
        targetCtx.save();
        targetCtx.globalAlpha = layer.opacity;
        targetCtx.globalCompositeOperation = getCanvasCompositeOp(layer.blendMode);
        targetCtx.drawImage(layer.canvas, 0, 0);

        if (layer === active && liveStrokeCanvas) {
          targetCtx.save();
          targetCtx.globalAlpha = liveOpacity;
          targetCtx.globalCompositeOperation = layer.alphaLock ? 'source-atop' : getCanvasCompositeOp(liveBlendMode);
          targetCtx.drawImage(liveStrokeCanvas, 0, 0);
          targetCtx.restore();
        }

        targetCtx.restore();
        i++;
      }
    }
  }

  /**
   * Composites the entire document onto targetCtx.
   */
  compositeStack(targetCtx, liveStrokeCanvas = null, liveOpacity = 1.0, liveBlendMode = 'source-over') {
    if (!liveStrokeCanvas) {
      if (this.needsRecomposite) {
        this.rebuildFullComposite();
      }
      targetCtx.drawImage(this.cachedComposite, 0, 0);
      return;
    }

    // 1. Background
    if (!this.isTransparentBg && this.backgroundColor) {
      targetCtx.fillStyle = this.backgroundColor;
      targetCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    } else {
      targetCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    }

    // 2. Render layer stack with live stroke and clipping masks
    this.renderLayerStack(targetCtx, liveStrokeCanvas, liveOpacity, liveBlendMode);
  }

  rebuildFullComposite() {
    this.cachedCompositeCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    if (!this.isTransparentBg && this.backgroundColor) {
      this.cachedCompositeCtx.fillStyle = this.backgroundColor;
      this.cachedCompositeCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    }
    this.renderLayerStack(this.cachedCompositeCtx, null);
    this.needsRecomposite = false;
  }

  /**
   * Full composite export without live buffer.
   */
  compositeToCanvas(targetCtx, includeBackground = true) {
    if (includeBackground && !this.isTransparentBg && this.backgroundColor) {
      targetCtx.fillStyle = this.backgroundColor;
      targetCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    } else {
      targetCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    }

    this.renderLayerStack(targetCtx, null);
  }

  getReferenceLayer() {
    return this.layers.find(l => l.isReference) || this.getActiveLayer();
  }
}

/* --- BrushPresets.js --- */
/**
 * Vectura Brush Presets Library
 * Production-tuned raster brushes driven purely by finger velocity dynamics.
 */

const BRUSH_CATEGORIES = [
  {
    "id": "ink",
    "name": "Inking & Sketch"
  },
  {
    "id": "paint",
    "name": "Painting & Shading"
  },
  {
    "id": "texture",
    "name": "Texture & FX"
  },
  {
    "id": "eraser",
    "name": "Erasers"
  },
  {
    "id": "pixel",
    "name": "Pixel Art"
  }
];

const DEFAULT_BRUSH_PRESETS = [
  {
    "id": "pencil",
    "category": "ink",
    "name": "Pencil",
    "size": 6,
    "minSize": 1,
    "maxSize": 100,
    "opacity": 0.85,
    "flow": 0.8,
    "hardness": 0.7,
    "spacing": 0.1,
    "roundness": 0.85,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "round",
    "grain": 0.4,
    "taperStart": 12,
    "taperEnd": 18,
    "velocityDynamics": {
      "factor": 39,
      "minSpeed": 0,
      "maxSpeed": 3.2,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.35,
      "minOutput": 0.15,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": true,
      "amplitude": 0.15,
      "frequency": 0.08,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1337,
      "noiseType": "perlin",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 20,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 30,
    "spacingSettings": {
      "spacing": 0.1,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "mechanical_pencil",
    "category": "ink",
    "name": "Mechanical Pencil",
    "size": 2,
    "minSize": 1,
    "maxSize": 30,
    "opacity": 0.9,
    "flow": 0.95,
    "hardness": 0.95,
    "spacing": 0.08,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "round",
    "grain": 0.15,
    "taperStart": 4,
    "taperEnd": 6,
    "velocityDynamics": {
      "factor": 25,
      "minSpeed": 0,
      "maxSpeed": 4,
      "curve": [
        0.2,
        0.2,
        0.4,
        0.9
      ],
      "smoothing": 0.4,
      "minOutput": 0.5,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": false
      },
      "opacity": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": true
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1416,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 20,
    "spacingSettings": {
      "spacing": 0.08,
      "minSpacingPx": 0.8,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "technical_pen",
    "category": "ink",
    "name": "Technical Pen",
    "size": 4,
    "minSize": 1,
    "maxSize": 150,
    "opacity": 1,
    "flow": 1,
    "hardness": 1,
    "spacing": 0.06,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "round",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "velocityDynamics": {
      "factor": 11,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.3,
        0.3,
        0.7,
        0.7
      ],
      "smoothing": 0.5,
      "minOutput": 0.85,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.15,
        "useCurve": false
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1495,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 40,
    "spacingSettings": {
      "spacing": 0.06,
      "minSpacingPx": 0.8,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "g_pen",
    "category": "ink",
    "name": "G-Pen",
    "size": 8,
    "minSize": 1,
    "maxSize": 200,
    "opacity": 1,
    "flow": 1,
    "hardness": 0.98,
    "spacing": 0.05,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "round",
    "grain": 0,
    "taperStart": 25,
    "taperEnd": 35,
    "velocityDynamics": {
      "factor": 49,
      "minSpeed": 0,
      "maxSpeed": 2.8,
      "curve": [
        0.15,
        0.05,
        0.35,
        1
      ],
      "smoothing": 0.3,
      "minOutput": 0.08,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 1.3,
        "useCurve": true
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1574,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 40,
    "spacingSettings": {
      "spacing": 0.05,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "ink_pen",
    "category": "ink",
    "name": "Ink Fountain Pen",
    "size": 5,
    "minSize": 1,
    "maxSize": 80,
    "opacity": 0.96,
    "flow": 0.9,
    "hardness": 0.9,
    "spacing": 0.06,
    "roundness": 0.9,
    "aspectRatio": 1.1,
    "rotation": 0.4,
    "tipShape": "round",
    "grain": 0.05,
    "taperStart": 10,
    "taperEnd": 20,
    "velocityDynamics": {
      "factor": -46,
      "minSpeed": 0.1,
      "maxSpeed": 3.5,
      "curve": [
        0.35,
        0.05,
        0.5,
        0.95
      ],
      "smoothing": 0.35,
      "minOutput": 0.2,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": false
      },
      "flow": {
        "enabled": true,
        "factor": 0.9,
        "useCurve": true
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1653,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 35,
    "spacingSettings": {
      "spacing": 0.06,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "calligraphy",
    "category": "ink",
    "name": "Calligraphy Chisel",
    "size": 14,
    "minSize": 2,
    "maxSize": 120,
    "opacity": 1,
    "flow": 1,
    "hardness": 1,
    "spacing": 0.04,
    "roundness": 0.2,
    "aspectRatio": 4,
    "rotation": 0.785,
    "tipShape": "chisel",
    "grain": 0,
    "taperStart": 8,
    "taperEnd": 12,
    "velocityDynamics": {
      "factor": 35,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.35,
      "minOutput": 0.2,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": true
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1732,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 30,
    "spacingSettings": {
      "spacing": 0.04,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "brush_pen",
    "category": "ink",
    "name": "Bristle Brush Pen",
    "size": 12,
    "minSize": 1,
    "maxSize": 180,
    "opacity": 0.95,
    "flow": 0.85,
    "hardness": 0.8,
    "spacing": 0.05,
    "roundness": 0.9,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "rough",
    "grain": 0.2,
    "taperStart": 18,
    "taperEnd": 30,
    "velocityDynamics": {
      "factor": 44,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.2,
        0.1,
        0.3,
        1
      ],
      "smoothing": 0.3,
      "minOutput": 0.1,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 1.2,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": false
      },
      "flow": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "spacing": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "scatter": {
        "enabled": true,
        "factor": 0.3,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1811,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 28,
    "spacingSettings": {
      "spacing": 0.05,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "marker",
    "category": "ink",
    "name": "Felt Marker",
    "size": 16,
    "minSize": 3,
    "maxSize": 150,
    "opacity": 0.88,
    "flow": 0.92,
    "hardness": 0.88,
    "spacing": 0.08,
    "roundness": 0.85,
    "aspectRatio": 1.2,
    "rotation": 0.3,
    "tipShape": "round",
    "grain": 0.08,
    "taperStart": 0,
    "taperEnd": 0,
    "velocityDynamics": {
      "factor": -28,
      "minSpeed": 0,
      "maxSpeed": 3.5,
      "curve": [
        0.3,
        0.2,
        0.4,
        0.8
      ],
      "smoothing": 0.4,
      "minOutput": 0.6,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "opacity": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": true
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1890,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 25,
    "spacingSettings": {
      "spacing": 0.08,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "highlighter",
    "category": "ink",
    "name": "Highlighter",
    "size": 24,
    "minSize": 5,
    "maxSize": 180,
    "opacity": 0.45,
    "flow": 0.7,
    "hardness": 0.95,
    "spacing": 0.05,
    "roundness": 0.35,
    "aspectRatio": 3,
    "rotation": 0,
    "tipShape": "square",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "velocityDynamics": {
      "factor": 18,
      "minSpeed": 0,
      "maxSpeed": 4,
      "curve": [
        0.4,
        0.2,
        0.6,
        0.8
      ],
      "smoothing": 0.45,
      "minOutput": 0.8,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.2,
        "useCurve": false
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 1969,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "multiply",
    "stabilizer": 20,
    "spacingSettings": {
      "spacing": 0.05,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "watercolor",
    "category": "paint",
    "name": "Watercolor Wash",
    "size": 28,
    "minSize": 4,
    "maxSize": 250,
    "opacity": 0.4,
    "flow": 0.5,
    "hardness": 0.4,
    "spacing": 0.06,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "gaussian",
    "grain": 0.25,
    "wetEdge": 0.35,
    "taperStart": 15,
    "taperEnd": 25,
    "velocityDynamics": {
      "factor": -42,
      "minSpeed": 0.1,
      "maxSpeed": 3,
      "curve": [
        0.3,
        0.1,
        0.4,
        0.9
      ],
      "smoothing": 0.35,
      "minOutput": 0.2,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.9,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "flow": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      },
      "spacing": {
        "enabled": true,
        "factor": 0.3,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2048,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "multiply",
    "stabilizer": 35,
    "spacingSettings": {
      "spacing": 0.06,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "airbrush_soft",
    "category": "paint",
    "name": "Soft Airbrush",
    "size": 40,
    "minSize": 5,
    "maxSize": 300,
    "opacity": 0.5,
    "flow": 0.35,
    "hardness": 0.15,
    "spacing": 0.04,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "gaussian",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "velocityDynamics": {
      "factor": 35,
      "minSpeed": 0,
      "maxSpeed": 3.5,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.3,
      "minOutput": 0.2,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      },
      "flow": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2127,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 20,
    "spacingSettings": {
      "spacing": 0.04,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "chalk",
    "category": "paint",
    "name": "Chalk Pastel",
    "size": 18,
    "minSize": 3,
    "maxSize": 150,
    "opacity": 0.8,
    "flow": 0.85,
    "hardness": 0.6,
    "spacing": 0.1,
    "roundness": 0.7,
    "aspectRatio": 1.4,
    "rotation": 0.5,
    "tipShape": "rough",
    "grain": 0.7,
    "taperStart": 6,
    "taperEnd": 10,
    "velocityDynamics": {
      "factor": 39,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.35,
      "minOutput": 0.25,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": true
      },
      "taper": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": true,
      "amplitude": 0.25,
      "frequency": 0.15,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2206,
      "noiseType": "perlin",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 20,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 25,
    "spacingSettings": {
      "spacing": 0.1,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "charcoal",
    "category": "paint",
    "name": "Vine Charcoal",
    "size": 15,
    "minSize": 2,
    "maxSize": 160,
    "opacity": 0.85,
    "flow": 0.8,
    "hardness": 0.65,
    "spacing": 0.09,
    "roundness": 0.75,
    "aspectRatio": 1.3,
    "rotation": 0.2,
    "tipShape": "rough",
    "grain": 0.6,
    "taperStart": 10,
    "taperEnd": 15,
    "velocityDynamics": {
      "factor": 42,
      "minSpeed": 0,
      "maxSpeed": 3.2,
      "curve": [
        0.2,
        0.1,
        0.3,
        1
      ],
      "smoothing": 0.3,
      "minOutput": 0.15,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.9,
        "useCurve": true
      },
      "flow": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": false
      },
      "angle": {
        "enabled": true,
        "factor": 0.3,
        "useCurve": false
      },
      "jitter": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "taper": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      }
    },
    "jitter": {
      "enabled": true,
      "amplitude": 0.2,
      "frequency": 0.12,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2285,
      "noiseType": "perlin",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 20,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 25,
    "spacingSettings": {
      "spacing": 0.09,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "oil_pastel",
    "category": "paint",
    "name": "Oil Pastel",
    "size": 20,
    "minSize": 4,
    "maxSize": 180,
    "opacity": 0.92,
    "flow": 0.9,
    "hardness": 0.85,
    "spacing": 0.07,
    "roundness": 0.8,
    "aspectRatio": 1.2,
    "rotation": 0.4,
    "tipShape": "rough",
    "grain": 0.45,
    "taperStart": 8,
    "taperEnd": 14,
    "velocityDynamics": {
      "factor": 39,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.25,
        0.15,
        0.35,
        0.95
      ],
      "smoothing": 0.35,
      "minOutput": 0.3,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.9,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "flow": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": true
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2364,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 20,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 30,
    "spacingSettings": {
      "spacing": 0.07,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": true,
      "pixelArtMode": false
    }
  },
  {
    "id": "stipple",
    "category": "texture",
    "name": "Stipple Dots",
    "size": 16,
    "minSize": 2,
    "maxSize": 120,
    "opacity": 0.9,
    "flow": 0.85,
    "hardness": 0.9,
    "spacing": 0.35,
    "scatter": 1.2,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "round",
    "grain": 0.3,
    "taperStart": 0,
    "taperEnd": 0,
    "velocityDynamics": {
      "factor": 46,
      "minSpeed": 0.1,
      "maxSpeed": 3.5,
      "curve": [
        0.3,
        0.1,
        0.4,
        0.9
      ],
      "smoothing": 0.25,
      "minOutput": 0.2,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": false
      },
      "opacity": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": true,
        "factor": 1.2,
        "useCurve": true
      },
      "scatter": {
        "enabled": true,
        "factor": 1.5,
        "useCurve": true
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2443,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 15,
    "spacingSettings": {
      "spacing": 0.35,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": false
    }
  },
  {
    "id": "dashed_line",
    "category": "texture",
    "name": "Dashed Stitch",
    "size": 4,
    "minSize": 1,
    "maxSize": 50,
    "opacity": 1,
    "flow": 1,
    "hardness": 1,
    "spacing": 0.3,
    "roundness": 0.3,
    "aspectRatio": 3.5,
    "rotation": 0,
    "tipShape": "square",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "velocityDynamics": {
      "factor": 28,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.4,
      "minOutput": 0.5,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": false
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": true,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2522,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 30,
    "spacingSettings": {
      "spacing": 0.3,
      "minSpacingPx": 0.8,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": false
    }
  },
  {
    "id": "neon_glow",
    "category": "texture",
    "name": "Neon Tube",
    "size": 10,
    "minSize": 2,
    "maxSize": 150,
    "opacity": 1,
    "flow": 1,
    "hardness": 0.95,
    "spacing": 0.05,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "round",
    "grain": 0,
    "glowWidth": 2.8,
    "taperStart": 8,
    "taperEnd": 14,
    "velocityDynamics": {
      "factor": 35,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.2,
        0.1,
        0.3,
        1
      ],
      "smoothing": 0.3,
      "minOutput": 0.3,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": true
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2601,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "screen",
    "stabilizer": 35,
    "spacingSettings": {
      "spacing": 0.05,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": false
    }
  },
  {
    "id": "stamp_stars",
    "category": "texture",
    "name": "Starfield Stamp",
    "size": 22,
    "minSize": 4,
    "maxSize": 180,
    "opacity": 0.9,
    "flow": 0.9,
    "hardness": 1,
    "spacing": 0.45,
    "scatter": 1.8,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "angleJitter": 1,
    "tipShape": "star",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "velocityDynamics": {
      "factor": 46,
      "minSpeed": 0.1,
      "maxSpeed": 3.5,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.25,
      "minOutput": 0.2,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.9,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": true,
        "factor": 1,
        "useCurve": true
      },
      "scatter": {
        "enabled": true,
        "factor": 1.8,
        "useCurve": true
      },
      "angle": {
        "enabled": true,
        "factor": 1.5,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2680,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 15,
    "spacingSettings": {
      "spacing": 0.45,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": false
    }
  },
  {
    "id": "crosshatch",
    "category": "texture",
    "name": "Crosshatch Shading",
    "size": 8,
    "minSize": 2,
    "maxSize": 80,
    "opacity": 0.85,
    "flow": 0.8,
    "hardness": 0.9,
    "spacing": 0.15,
    "roundness": 0.4,
    "aspectRatio": 2.5,
    "rotation": 0.785,
    "tipShape": "hatch",
    "grain": 0.2,
    "taperStart": 4,
    "taperEnd": 8,
    "velocityDynamics": {
      "factor": 39,
      "minSpeed": 0,
      "maxSpeed": 3.2,
      "curve": [
        0.3,
        0.1,
        0.3,
        1
      ],
      "smoothing": 0.35,
      "minOutput": 0.2,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "flow": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "spacing": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "jitter": {
        "enabled": true,
        "factor": 0.4,
        "useCurve": false
      },
      "taper": {
        "enabled": true,
        "factor": 0.6,
        "useCurve": true
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2759,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 30,
    "spacingSettings": {
      "spacing": 0.15,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": false
    }
  },
  {
    "id": "hard_eraser",
    "category": "eraser",
    "name": "Hard Eraser",
    "size": 20,
    "minSize": 2,
    "maxSize": 250,
    "opacity": 1,
    "flow": 1,
    "hardness": 1,
    "spacing": 0.06,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "round",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "isEraser": true,
    "velocityDynamics": {
      "factor": 21,
      "minSpeed": 0,
      "maxSpeed": 3.5,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.4,
      "minOutput": 0.6,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.5,
        "useCurve": false
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2838,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "destination-out",
    "stabilizer": 20,
    "spacingSettings": {
      "spacing": 0.06,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": false
    }
  },
  {
    "id": "soft_eraser",
    "category": "eraser",
    "name": "Soft Kneaded Eraser",
    "size": 32,
    "minSize": 4,
    "maxSize": 300,
    "opacity": 0.65,
    "flow": 0.55,
    "hardness": 0.25,
    "spacing": 0.05,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "gaussian",
    "grain": 0.1,
    "taperStart": 0,
    "taperEnd": 0,
    "isEraser": true,
    "velocityDynamics": {
      "factor": 35,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.25,
        0.1,
        0.25,
        1
      ],
      "smoothing": 0.35,
      "minOutput": 0.25,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.7,
        "useCurve": true
      },
      "opacity": {
        "enabled": true,
        "factor": 0.9,
        "useCurve": true
      },
      "flow": {
        "enabled": true,
        "factor": 0.8,
        "useCurve": true
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2917,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "destination-out",
    "stabilizer": 25,
    "spacingSettings": {
      "spacing": 0.05,
      "minSpacingPx": 1.5,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": false
    }
  },
  {
    "id": "pixel_pen",
    "category": "pixel",
    "name": "1px Pixel Pen",
    "size": 1,
    "minSize": 1,
    "maxSize": 16,
    "opacity": 1,
    "flow": 1,
    "hardness": 1,
    "spacing": 0.1,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "square",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "isPixel": true,
    "velocityDynamics": {
      "factor": 0,
      "minSpeed": 0,
      "maxSpeed": 4,
      "curve": [
        0.3,
        0.3,
        0.7,
        0.7
      ],
      "smoothing": 0.5,
      "minOutput": 1,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 2996,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 0,
    "spacingSettings": {
      "spacing": 0.1,
      "minSpacingPx": 1,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": true
    }
  },
  {
    "id": "pixel_eraser",
    "category": "pixel",
    "name": "Pixel Eraser",
    "size": 1,
    "minSize": 1,
    "maxSize": 20,
    "opacity": 1,
    "flow": 1,
    "hardness": 1,
    "spacing": 0.1,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "square",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "isPixel": true,
    "isEraser": true,
    "velocityDynamics": {
      "factor": 0,
      "minSpeed": 0,
      "maxSpeed": 4,
      "curve": [
        0.3,
        0.3,
        0.7,
        0.7
      ],
      "smoothing": 0.5,
      "minOutput": 1,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 3075,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "destination-out",
    "stabilizer": 0,
    "spacingSettings": {
      "spacing": 0.1,
      "minSpacingPx": 1,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": true
    }
  },
  {
    "id": "pixel_dither",
    "category": "pixel",
    "name": "Checker Dither",
    "size": 4,
    "minSize": 2,
    "maxSize": 24,
    "opacity": 1,
    "flow": 1,
    "hardness": 1,
    "spacing": 0.12,
    "roundness": 1,
    "aspectRatio": 1,
    "rotation": 0,
    "tipShape": "checker",
    "grain": 0,
    "taperStart": 0,
    "taperEnd": 0,
    "isPixel": true,
    "velocityDynamics": {
      "factor": 0,
      "minSpeed": 0,
      "maxSpeed": 3,
      "curve": [
        0.3,
        0.3,
        0.7,
        0.7
      ],
      "smoothing": 0.4,
      "minOutput": 0.7,
      "maxOutput": 1
    },
    "velocityTargets": {
      "size": {
        "enabled": true,
        "factor": 0.3,
        "useCurve": false
      },
      "opacity": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "flow": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "spacing": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "scatter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "angle": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "jitter": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      },
      "taper": {
        "enabled": false,
        "factor": 1,
        "useCurve": false
      }
    },
    "jitter": {
      "enabled": false,
      "amplitude": 1,
      "frequency": 0.05,
      "octaves": 3,
      "persistence": 0.5,
      "lacunarity": 2,
      "seed": 3154,
      "noiseType": "sines",
      "basis": "distance",
      "phaseOffset": 0,
      "fadeIn": 0,
      "fadeOut": 0,
      "velocityLink": 0,
      "targets": {
        "size": 30,
        "opacity": 0,
        "flow": 0,
        "angle": 0,
        "positionWobble": 0,
        "hue": 0,
        "saturation": 0,
        "brightness": 0,
        "spacing": 0
      }
    },
    "blendMode": "source-over",
    "stabilizer": 0,
    "spacingSettings": {
      "spacing": 0.12,
      "minSpacingPx": 1,
      "spacingJitter": 0,
      "speedFactor": 0,
      "autoSpacing": false,
      "pixelArtMode": true
    }
  }
];

/* --- Brush.js --- */
/**
 * Vectura Brush Model
 * The brush is driven ONLY by finger velocity.
 * Complete parameter schema supporting:
 * - Velocity dynamics with factor -100 to +100
 * - Powerful smooth jitter (wide ranges, multi-target, envelope, velocity link)
 * - Advanced spacing (min px, jitter, speed factor, auto-spacing, pixel art)
 * - Taper, texture, color, blend, stabilizer
 */


class Brush {
  constructor(presetData) {
    this.assign(presetData || DEFAULT_BRUSH_PRESETS[0]);
  }

  assign(data) {
    this.id = data.id || 'custom_brush';
    this.name = data.name || 'Custom Brush';
    this.category = data.category || 'ink';

    // 1. Shape & Core Dimensions
    this.size = data.size ?? 12;
    this.minSize = data.minSize ?? 1;
    this.maxSize = data.maxSize ?? 200;
    this.opacity = data.opacity ?? 1.0;
    this.flow = data.flow ?? 1.0;
    this.hardness = data.hardness ?? 1.0;
    this.roundness = data.roundness ?? 1.0;
    this.aspectRatio = data.aspectRatio ?? 1.0;
    this.rotation = data.rotation ?? 0.0;
    this.tipShape = data.tipShape || 'round'; // 'round' | 'square' | 'chisel' | 'calligraphy' | 'soft' | 'star' | 'bristle'
    this.buildUp = data.buildUp ?? (data.id?.includes('airbrush') || false);

    // 2D Noise Settings
    this.noiseScale = data.noiseScale ?? 20;
    this.noiseIntensity = data.noiseIntensity ?? 50;
    this.noiseSeed = data.noiseSeed ?? 1337;
    this.noiseOctaves = data.noiseOctaves ?? 3;

    // Factor & Child Dynamic System
    // Factors (Inputs): velocity, jitter, noise
    // Children (Outputs): size, rotation, spacing, opacity, tipRotation
    const fl = data.factorLinks || {};
    this.factorLinks = {
      velocity: {
        size: fl.velocity?.size ?? (data.velocityDynamics?.factor ?? 0),
        opacity: fl.velocity?.opacity ?? 0,
        rotation: fl.velocity?.rotation ?? 0,
        spacing: fl.velocity?.spacing ?? 0,
        tipRotation: fl.velocity?.tipRotation ?? 0
      },
      jitter: {
        size: fl.jitter?.size ?? (data.jitter?.size ?? 0),
        opacity: fl.jitter?.opacity ?? 0,
        rotation: fl.jitter?.rotation ?? 0,
        spacing: fl.jitter?.spacing ?? 0,
        tipRotation: fl.jitter?.tipRotation ?? 0
      },
      noise: {
        size: fl.noise?.size ?? 0,
        opacity: fl.noise?.opacity ?? 0,
        rotation: fl.noise?.rotation ?? 0,
        spacing: fl.noise?.spacing ?? 0,
        tipRotation: fl.noise?.tipRotation ?? 0
      }
    };

    // 2. Spacing Settings
    const sp = data.spacingSettings || {};
    this.spacingSettings = {
      spacing: sp.spacing ?? data.spacing ?? 0.08,    // 0.01 to 2.0 (1% to 200%)
      minSpacingPx: sp.minSpacingPx ?? 1.0,           // minimum spacing in pixels
      spacingJitter: sp.spacingJitter ?? 0,           // 0 to 100%
      speedFactor: sp.speedFactor ?? 0,               // -100 to +100 linked to speed
      autoSpacing: sp.autoSpacing ?? false,           // adaptively maintain smoothness
      pixelArtMode: sp.pixelArtMode ?? false          // fixed exact pixel steps
    };
    this.spacing = this.spacingSettings.spacing;
    this.scatter = data.scatter ?? 0.0;

    // 3. Velocity Dynamics Group (-100 to +100 factor)
    const vd = data.velocityDynamics || {};
    this.velocityDynamics = {
      factor: vd.factor ?? 0,                                 // Integer -100 to +100 (0 = neutral)
      minSpeed: vd.minSpeed ?? 0.0,                           // px/ms
      maxSpeed: vd.maxSpeed ?? 3.0,                           // px/ms
      curve: vd.curve ? [...vd.curve] : [0.25, 0.1, 0.25, 1.0], // draggable cubic bezier
      smoothing: vd.smoothing ?? 0.35,                        // EMA smoothing factor
      minOutput: vd.minOutput ?? 0.1,                         // minimum output
      maxOutput: vd.maxOutput ?? 1.0                          // maximum output
    };

    // Velocity Targets Modulation
    const vt = data.velocityTargets || {};
    this.velocityTargets = {
      size: { enabled: vt.size?.enabled ?? true, factor: vt.size?.factor ?? 1.0, useCurve: vt.size?.useCurve ?? true },
      opacity: { enabled: vt.opacity?.enabled ?? true, factor: vt.opacity?.factor ?? 1.0, useCurve: vt.opacity?.useCurve ?? true },
      flow: { enabled: vt.flow?.enabled ?? false, factor: vt.flow?.factor ?? 1.0, useCurve: vt.flow?.useCurve ?? false },
      spacing: { enabled: vt.spacing?.enabled ?? false, factor: vt.spacing?.factor ?? 1.0, useCurve: vt.spacing?.useCurve ?? false },
      scatter: { enabled: vt.scatter?.enabled ?? false, factor: vt.scatter?.factor ?? 1.0, useCurve: vt.scatter?.useCurve ?? false },
      angle: { enabled: vt.angle?.enabled ?? false, factor: vt.angle?.factor ?? 1.0, useCurve: vt.angle?.useCurve ?? false },
      jitter: { enabled: vt.jitter?.enabled ?? false, factor: vt.jitter?.factor ?? 1.0, useCurve: vt.jitter?.useCurve ?? false },
      taper: { enabled: vt.taper?.enabled ?? false, factor: vt.taper?.factor ?? 1.0, useCurve: vt.taper?.useCurve ?? false }
    };

    // 4. Smooth Coherent Jitter
    const jt = data.jitter || {};
    this.jitter = {
      enabled: jt.enabled ?? false,
      amplitude: jt.amplitude ?? 1.0,                 // 0 to 200
      frequency: jt.frequency ?? 0.05,                // 0.01 to 10.0
      octaves: jt.octaves ?? 3,                       // 1 to 8
      persistence: jt.persistence ?? 0.5,             // 0.1 to 1.0
      lacunarity: jt.lacunarity ?? 2.0,               // 1.5 to 4.0
      seed: jt.seed ?? 1337,                          // PRNG seed
      noiseType: jt.noiseType || 'sines',             // 'sines' | 'perlin' | 'keyframes'
      basis: jt.basis || 'distance',                  // 'distance' | 'time'
      phaseOffset: jt.phaseOffset ?? 0,               // 0 to 360 deg
      fadeIn: jt.fadeIn ?? 0,                         // px
      fadeOut: jt.fadeOut ?? 0,                       // px
      velocityLink: jt.velocityLink ?? 0,             // -100 to +100
      targets: {
        size: jt.targets?.size ?? 30,                 // 0 to 100%
        opacity: jt.targets?.opacity ?? 0,            // 0 to 100%
        flow: jt.targets?.flow ?? 0,
        angle: jt.targets?.angle ?? 0,
        positionWobble: jt.targets?.positionWobble ?? 0,
        hue: jt.targets?.hue ?? 0,
        saturation: jt.targets?.saturation ?? 0,
        brightness: jt.targets?.brightness ?? 0,
        spacing: jt.targets?.spacing ?? 0
      }
    };

    // 5. Texture & Wet Edge
    this.grain = data.grain ?? 0.0;
    this.wetEdge = data.wetEdge ?? 0.0;
    this.glowWidth = data.glowWidth ?? 0.0;

    // 6. Color Dynamics
    this.colorDynamics = data.colorDynamics || {
      hueJitter: 0,
      satJitter: 0,
      brightJitter: 0
    };

    // 7. Taper
    this.taperStart = data.taperStart ?? 0;
    this.taperEnd = data.taperEnd ?? 0;

    // 8. Blend / Flow
    this.blendMode = data.blendMode || 'source-over';

    // 9. Stabilizer
    this.stabilizer = data.stabilizer ?? 30;

    // 10. Advanced Flags
    this.isEraser = !!data.isEraser;
    this.isPixel = !!data.isPixel || !!this.spacingSettings.pixelArtMode;

    this._stampCache = null;
    this._stampCacheKey = '';
  }

  createSnapshot() {
    return JSON.parse(JSON.stringify({
      id: this.id,
      name: this.name,
      category: this.category,
      size: this.size,
      minSize: this.minSize,
      maxSize: this.maxSize,
      opacity: this.opacity,
      flow: this.flow,
      hardness: this.hardness,
      roundness: this.roundness,
      aspectRatio: this.aspectRatio,
      rotation: this.rotation,
      tipShape: this.tipShape,
      spacingSettings: this.spacingSettings,
      spacing: this.spacingSettings.spacing,
      scatter: this.scatter,
      velocityDynamics: this.velocityDynamics,
      velocityTargets: this.velocityTargets,
      jitter: this.jitter,
      grain: this.grain,
      wetEdge: this.wetEdge,
      glowWidth: this.glowWidth,
      colorDynamics: this.colorDynamics,
      taperStart: this.taperStart,
      taperEnd: this.taperEnd,
      blendMode: this.blendMode,
      stabilizer: this.stabilizer,
      factorLinks: this.factorLinks,
      buildUp: this.buildUp,
      isEraser: this.isEraser,
      isPixel: this.isPixel
    }));
  }
}

/* --- Command.js --- */
/**
 * Vectura Unified Command Pattern & Central History System
 * Stores cropped bounding-box snapshots to preserve low memory footprint.
 */

class Command {
  constructor(name = 'Action') {
    this.name = name;
    this.timestamp = Date.now();
  }
  execute() {}
  undo() {}
  release() {}
}

/**
 * Crops a bounding box region from a canvas. If bbox is null, crops full canvas.
 */
function cropBoundingBox(canvas, bbox = null) {
  if (!canvas) return null;
  const cw = canvas.width || 1;
  const ch = canvas.height || 1;

  let x = bbox ? Math.max(0, Math.floor(bbox.x)) : 0;
  let y = bbox ? Math.max(0, Math.floor(bbox.y)) : 0;
  let w = bbox ? Math.min(cw - x, Math.ceil(bbox.width)) : cw;
  let h = bbox ? Math.min(ch - y, Math.ceil(bbox.height)) : ch;

  if (w <= 0 || h <= 0) {
    x = 0; y = 0; w = cw; h = ch;
  }

  const crop = document.createElement('canvas');
  crop.width = w;
  crop.height = h;
  const ctx = crop.getContext('2d');
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  return {
    canvas: crop,
    x,
    y,
    width: w,
    height: h,
    byteSize: w * h * 4
  };
}

/**
 * Compares two canvases and returns true if their pixel buffers are identical.
 */
function areCanvasesIdentical(c1, c2) {
  if (!c1 || !c2) return false;
  if (c1.width !== c2.width || c1.height !== c2.height) return false;
  const ctx1 = c1.getContext('2d', { willReadFrequently: true });
  const ctx2 = c2.getContext('2d', { willReadFrequently: true });
  const img1 = ctx1.getImageData(0, 0, c1.width, c1.height).data;
  const img2 = ctx2.getImageData(0, 0, c2.width, c2.height).data;
  if (img1.length !== img2.length) return false;
  for (let i = 0; i < img1.length; i += 4) {
    if (img1[i] !== img2[i] || img1[i+1] !== img2[i+1] || img1[i+2] !== img2[i+2] || img1[i+3] !== img2[i+3]) {
      return false;
    }
  }
  return true;
}

/**
 * Command for brush and eraser raster strokes.
 */
class StrokeCommand extends Command {
  constructor(layer, stroke, onRedraw, beforeSnapshot = null, afterSnapshot = null) {
    super(stroke?.isEraser ? 'Erase Stroke' : 'Draw Stroke');
    this.layerId = layer.id;
    this.layer = layer;
    this.stroke = stroke;
    this.onRedraw = onRedraw;

    // Snapshot can be pre-cropped object or raw canvas
    this.beforeSnapshot = beforeSnapshot && beforeSnapshot.canvas ? beforeSnapshot : cropBoundingBox(beforeSnapshot);
    this.afterSnapshot = afterSnapshot && afterSnapshot.canvas ? afterSnapshot : cropBoundingBox(afterSnapshot);
  }

  execute(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer) return;

    if (this.afterSnapshot) {
      const { canvas, x, y, width, height } = this.afterSnapshot;
      targetLayer.ctx.clearRect(x, y, width, height);
      targetLayer.ctx.drawImage(canvas, x, y);
      targetLayer.updateThumbnail();
      this.onRedraw?.(targetLayer, false);
      return;
    }
    targetLayer.addStroke(this.stroke);
    this.onRedraw?.(targetLayer);
  }

  undo(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer) return;

    if (this.beforeSnapshot) {
      const { canvas, x, y, width, height } = this.beforeSnapshot;
      targetLayer.ctx.clearRect(x, y, width, height);
      targetLayer.ctx.drawImage(canvas, x, y);
      targetLayer.updateThumbnail();
      this.onRedraw?.(targetLayer, false);
      return;
    }
    const idx = targetLayer.strokes.lastIndexOf(this.stroke);
    if (idx >= 0) {
      targetLayer.strokes.splice(idx, 1);
      this.onRedraw?.(targetLayer, true);
    }
  }

  release() {
    if (this.beforeSnapshot?.canvas) {
      this.beforeSnapshot.canvas.width = 1;
      this.beforeSnapshot.canvas.height = 1;
    }
    if (this.afterSnapshot?.canvas) {
      this.afterSnapshot.canvas.width = 1;
      this.afterSnapshot.canvas.height = 1;
    }
  }
}

/**
 * Command for raster modifications: Fill Bucket, Lasso Fill, Shapes, Gradients, Text, Clear.
 */
class RasterCommand extends Command {
  constructor(name, layer, beforeCanvasOrSnapshot, afterCanvasOrSnapshot, onRedraw, bbox = null) {
    super(name);
    this.layerId = layer.id;
    this.layer = layer;
    this.onRedraw = onRedraw;

    this.beforeSnapshot = beforeCanvasOrSnapshot && beforeCanvasOrSnapshot.canvas
      ? beforeCanvasOrSnapshot
      : cropBoundingBox(beforeCanvasOrSnapshot, bbox);

    this.afterSnapshot = afterCanvasOrSnapshot && afterCanvasOrSnapshot.canvas
      ? afterCanvasOrSnapshot
      : cropBoundingBox(afterCanvasOrSnapshot, bbox);
  }

  execute(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer || !this.afterSnapshot) return;

    const { canvas, x, y, width, height } = this.afterSnapshot;
    targetLayer.ctx.clearRect(x, y, width, height);
    targetLayer.ctx.drawImage(canvas, x, y);
    targetLayer.updateThumbnail();
    this.onRedraw?.(targetLayer);
  }

  undo(layerManager = null) {
    const targetLayer = layerManager ? layerManager.getLayer(this.layerId) : this.layer;
    if (!targetLayer || !this.beforeSnapshot) return;

    const { canvas, x, y, width, height } = this.beforeSnapshot;
    targetLayer.ctx.clearRect(x, y, width, height);
    targetLayer.ctx.drawImage(canvas, x, y);
    targetLayer.updateThumbnail();
    this.onRedraw?.(targetLayer);
  }

  release() {
    if (this.beforeSnapshot?.canvas) {
      this.beforeSnapshot.canvas.width = 1;
      this.beforeSnapshot.canvas.height = 1;
    }
    if (this.afterSnapshot?.canvas) {
      this.afterSnapshot.canvas.width = 1;
      this.afterSnapshot.canvas.height = 1;
    }
  }
}

/**
 * Command for structural Layer operations.
 */
class LayerCommand extends Command {
  constructor(name, layerManager, beforeState, afterState, onComplete) {
    super(name);
    this.layerManager = layerManager;
    this.beforeState = beforeState;
    this.afterState = afterState;
    this.onComplete = onComplete;
  }

  execute() {
    if (this.afterState) {
      this.layerManager.restoreSnapshot(this.afterState);
      this.onComplete?.();
    }
  }

  undo() {
    if (this.beforeState) {
      this.layerManager.restoreSnapshot(this.beforeState);
      this.onComplete?.();
    }
  }

  release() {}
}

/**
 * Command for document property changes: Resize, canvas dimensions.
 */
class CanvasPropertyCommand extends Command {
  constructor(name, vectorCanvas, beforeProps, afterProps, onComplete) {
    super(name);
    this.vectorCanvas = vectorCanvas;
    this.beforeProps = beforeProps;
    this.afterProps = afterProps;
    this.onComplete = onComplete;
  }

  execute() {
    this.vectorCanvas.applyDocProperties(this.afterProps);
    this.onComplete?.();
  }

  undo() {
    this.vectorCanvas.applyDocProperties(this.beforeProps);
    this.onComplete?.();
  }

  release() {}
}

/* --- HistoryManager.js --- */
/**
 * Vectura History Manager
 * Memory-budgeted undo/redo queue (~100MB budget) storing bounding-box snapshots.
 */
class HistoryManager {
  constructor(maxMemoryMB = 100) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024; // 100 MB budget
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
    this.cancelStrokeFn = null;
    this.layerManager = null;
    this.debugCheckEnabled = false;
  }

  setCancelStrokeHandler(fn) {
    this.cancelStrokeFn = fn;
  }

  setLayerManager(lm) {
    this.layerManager = lm;
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  getCommandBytes(cmd) {
    if (!cmd) return 0;
    let size = 1024;
    if (cmd.beforeSnapshot?.byteSize) size += cmd.beforeSnapshot.byteSize;
    if (cmd.afterSnapshot?.byteSize) size += cmd.afterSnapshot.byteSize;
    return size;
  }

  getTotalMemory() {
    let total = 0;
    for (const cmd of this.undoStack) total += this.getCommandBytes(cmd);
    for (const cmd of this.redoStack) total += this.getCommandBytes(cmd);
    return total;
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
        undoStack: this.undoStack.map(c => c.name),
        redoStack: this.redoStack.map(c => c.name),
        memoryMB: (this.getTotalMemory() / (1024 * 1024)).toFixed(1)
      });
    }
  }

  push(command) {
    this.undoStack.push(command);

    // Evict oldest commands when exceeding 100MB budget
    while (this.undoStack.length > 1 && this.getTotalMemory() > this.maxMemoryBytes) {
      const dropped = this.undoStack.shift();
      dropped?.release?.();
    }

    // Clear redo stack on new action
    while (this.redoStack.length > 0) {
      const r = this.redoStack.pop();
      r?.release?.();
    }

    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (this.cancelStrokeFn) {
      this.cancelStrokeFn();
    }
    if (!this.canUndo()) return false;

    const cmd = this.undoStack.pop();
    cmd.undo(this.layerManager);
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo() {
    if (this.cancelStrokeFn) {
      this.cancelStrokeFn();
    }
    if (!this.canRedo()) return false;

    const cmd = this.redoStack.pop();
    cmd.execute(this.layerManager);
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  clear() {
    for (const cmd of this.undoStack) cmd?.release?.();
    for (const cmd of this.redoStack) cmd?.release?.();
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  debugVerifyCurrentAction() {
    return true;
  }
}

/* --- FillBucket.js --- */
/**
 * Vectura Flood Fill Engine
 * Fast Uint32Array scanline flood fill with tolerance, sample sources, and iPad-style
 * expanding circular ripple animation clipped strictly to the filled region.
 * Committed as a single undoable step via the central Command system.
 */
class FillBucket {
  constructor() {
    this.tolerance = 25;       // 0 to 100
    this.expand = 1;           // -10 to +10 px
    this.sampleSource = 'all'; // 'current' | 'reference' | 'all'
    this.animateFill = true;   // Animation on/off
    this.animationDuration = 380; // ms (300 to 500 ms)
  }

  hexToRgba(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 255
    };
  }

  /**
   * Performs fast scanline flood fill on target layer.
   * Can run asynchronously so input is never blocked.
   */
  async fill(startX, startY, fillColorHex, layerManager, onAnimatedCommit) {
    const activeLayer = layerManager.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return false;

    const w = layerManager.docWidth;
    const h = layerManager.docHeight;
    startX = Math.floor(startX);
    startY = Math.floor(startY);

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return false;

    // 1. Get sample canvas depending on sampleSource
    let sampleCanvas;
    if (this.sampleSource === 'current') {
      sampleCanvas = activeLayer.canvas;
    } else if (this.sampleSource === 'reference') {
      sampleCanvas = layerManager.getReferenceLayer().canvas;
    } else {
      layerManager.compositeToCanvas(layerManager.cachedCompositeCtx, true);
      sampleCanvas = layerManager.cachedComposite;
    }

    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = sampleCtx.getImageData(0, 0, w, h);
    const data32 = new Uint32Array(imgData.data.buffer);

    const startIndex = startY * w + startX;
    const targetColor = data32[startIndex];

    const fillRgba = this.hexToRgba(fillColorHex);
    // 32-bit little-endian: (A << 24) | (B << 16) | (G << 8) | R
    const fillColor32 = ((fillRgba.a << 24) | (fillRgba.b << 16) | (fillRgba.g << 8) | fillRgba.r) >>> 0;

    if (targetColor === fillColor32) return false;

    const tr = targetColor & 0xff;
    const tg = (targetColor >> 8) & 0xff;
    const tb = (targetColor >> 16) & 0xff;
    const ta = (targetColor >> 24) & 0xff;
    const tolSq = (this.tolerance * 2.55) ** 2;

    const colorMatch = (idx) => {
      const c = data32[idx];
      const r = c & 0xff;
      const g = (c >> 8) & 0xff;
      const b = (c >> 16) & 0xff;
      const a = (c >> 24) & 0xff;
      const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2 + (a - ta) ** 2;
      return d <= tolSq;
    };

    // Scanline flood fill algorithm
    const visited = new Uint8Array(w * h);
    const filledMask = new Uint8Array(w * h);
    const queue = [[startX, startY]];
    visited[startIndex] = 1;

    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    // Fast loop with micro-task yielding for 2048px+ canvases if needed
    let iterations = 0;
    while (queue.length > 0) {
      const [curX, curY] = queue.pop();
      let left = curX;
      let right = curX;

      while (left > 0 && !visited[curY * w + (left - 1)] && colorMatch(curY * w + (left - 1))) {
        left--;
        visited[curY * w + left] = 1;
      }

      while (right < w - 1 && !visited[curY * w + (right + 1)] && colorMatch(curY * w + (right + 1))) {
        right++;
        visited[curY * w + right] = 1;
      }

      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, curY);
      maxY = Math.max(maxY, curY);

      for (let x = left; x <= right; x++) {
        filledMask[curY * w + x] = 1;

        if (curY > 0) {
          const topIdx = (curY - 1) * w + x;
          if (!visited[topIdx] && colorMatch(topIdx)) {
            visited[topIdx] = 1;
            queue.push([x, curY - 1]);
          }
        }

        if (curY < h - 1) {
          const botIdx = (curY + 1) * w + x;
          if (!visited[botIdx] && colorMatch(botIdx)) {
            visited[botIdx] = 1;
            queue.push([x, curY + 1]);
          }
        }
      }

      iterations++;
      if (iterations % 4000 === 0 && w * h > 1000000) {
        // Yield to allow user touch responsiveness
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const finalMask = this.expandMask(filledMask, w, h, this.expand);

    // Create fill patch canvas containing the filled pixels
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = w;
    patchCanvas.height = h;
    const patchCtx = patchCanvas.getContext('2d');
    const patchImg = patchCtx.createImageData(w, h);
    const patchData32 = new Uint32Array(patchImg.data.buffer);

    for (let i = 0; i < w * h; i++) {
      if (finalMask[i]) {
        patchData32[i] = fillColor32;
      }
    }
    patchCtx.putImageData(patchImg, 0, 0);

    // Calculate maximum distance from start point to bounding box corners for ripple
    const d1 = Math.hypot(startX - minX, startY - minY);
    const d2 = Math.hypot(startX - maxX, startY - minY);
    const d3 = Math.hypot(startX - minX, startY - maxY);
    const d4 = Math.hypot(startX - maxX, startY - maxY);
    const maxRadius = Math.max(d1, d2, d3, d4, 30);

    const pad = Math.abs(this.expand) + 2;
    const bx = Math.max(0, minX - pad);
    const by = Math.max(0, minY - pad);
    const bw = Math.min(w - bx, (maxX - minX + 1) + pad * 2);
    const bh = Math.min(h - by, (maxY - minY + 1) + pad * 2);

    onAnimatedCommit?.({
      startX,
      startY,
      maxRadius,
      patchCanvas,
      activeLayer,
      fillColorHex,
      animate: this.animateFill,
      duration: this.animationDuration,
      bbox: { x: bx, y: by, width: bw, height: bh }
    });

    return true;
  }

  expandMask(mask, w, h, amount) {
    if (amount === 0) return mask;
    const out = new Uint8Array(mask);
    const radius = Math.abs(amount);

    if (amount > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mask[y * w + x]) {
            for (let dy = -radius; dy <= radius; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                if (dx * dx + dy * dy <= radius * radius) {
                  out[ny * w + nx] = 1;
                }
              }
            }
          }
        }
      }
    }
    return out;
  }
}

/* --- LassoFill.js --- */
/**
 * Vectura Lasso Fill & Lasso Erase Tool
 * Supports real-time animated preview hint during drag.
 */
class LassoFill {
  constructor() {
    this.mode = 'fill'; // 'fill' | 'erase'
    this.points = [];
    this.active = false;
  }

  start(x, y) {
    this.active = true;
    this.points = [{ x, y }];
  }

  addPoint(x, y) {
    if (!this.active) return;
    const last = this.points[this.points.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 3) {
      this.points.push({ x, y });
    }
  }

  /**
   * Draws a live hint while dragging lasso loop
   */
  drawLive(ctx, colorHex) {
    if (!this.active || this.points.length < 2) return;
    ctx.save();

    // 1. Fill translucent hint
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();

    if (this.mode === 'erase') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)'; // Reddish erase preview
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
    } else {
      ctx.fillStyle = colorHex.startsWith('#') ? (colorHex + '33') : 'rgba(139, 92, 246, 0.25)';
      ctx.fill();

      // Contrasting dashed outline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();

      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  finish(layer, colorHex, isEraser = false) {
    if (!this.active || this.points.length < 3) {
      this.active = false;
      this.points = [];
      return null;
    }

    const ctx = layer.ctx;
    ctx.save();
    if (isEraser || this.mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = colorHex;
    }

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    layer.updateThumbnail();

    const shape = {
      type: 'lasso-fill',
      points: [...this.points],
      color: colorHex,
      mode: isEraser ? 'erase' : this.mode
    };
    layer.addStroke(shape);

    this.active = false;
    this.points = [];
    return shape;
  }

  cancel() {
    this.active = false;
    this.points = [];
  }

  renderOverlay(ctx, colorHex = '#8b5cf6') {
    this.drawLive(ctx, colorHex);
  }
}

/* --- SelectionTool.js --- */
/**
 * Vectura Box Selection & Marquee Engine
 * High-performance rectangular box selection with animated marching ants overlay,
 * pixel extraction, clearing, and transform integration.
 */
class SelectionTool {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.docWidth = docWidth;
    this.docHeight = docHeight;
    this.type = 'rect'; // 'rect' (box) | 'lasso'
    this.hasSelection = false;
    this.active = false;

    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;

    // Active selection box in document coordinates
    this.box = null; // { x, y, w, h }
    this.dashOffset = 0;
  }

  resize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    if (this.box) {
      this.box.x = Math.max(0, Math.min(w, this.box.x));
      this.box.y = Math.max(0, Math.min(h, this.box.y));
      this.box.w = Math.min(w - this.box.x, this.box.w);
      this.box.h = Math.min(h - this.box.y, this.box.h);
    }
  }

  start(x, y) {
    this.active = true;
    this.startX = Math.max(0, Math.min(this.docWidth, x));
    this.startY = Math.max(0, Math.min(this.docHeight, y));
    this.currentX = this.startX;
    this.currentY = this.startY;
  }

  update(x, y) {
    if (!this.active) return;
    this.currentX = Math.max(0, Math.min(this.docWidth, x));
    this.currentY = Math.max(0, Math.min(this.docHeight, y));
  }

  commit() {
    if (!this.active) return;
    this.active = false;

    const rx = Math.round(Math.min(this.startX, this.currentX));
    const ry = Math.round(Math.min(this.startY, this.currentY));
    const rw = Math.round(Math.abs(this.currentX - this.startX));
    const rh = Math.round(Math.abs(this.currentY - this.startY));

    // Reject tiny accidental clicks (< 4px)
    if (rw < 4 || rh < 4) {
      return;
    }

    this.box = { x: rx, y: ry, w: rw, h: rh };
    this.hasSelection = true;
  }

  setBox(x, y, w, h) {
    this.box = {
      x: Math.round(Math.max(0, x)),
      y: Math.round(Math.max(0, y)),
      w: Math.round(Math.min(this.docWidth - x, w)),
      h: Math.round(Math.min(this.docHeight - y, h))
    };
    this.hasSelection = true;
  }

  clear() {
    this.box = null;
    this.hasSelection = false;
    this.active = false;
  }

  selectAll() {
    this.box = { x: 0, y: 0, w: this.docWidth, h: this.docHeight };
    this.hasSelection = true;
  }

  getBounds() {
    if (this.active) {
      const rx = Math.min(this.startX, this.currentX);
      const ry = Math.min(this.startY, this.currentY);
      const rw = Math.abs(this.currentX - this.startX);
      const rh = Math.abs(this.currentY - this.startY);
      return { x: rx, y: ry, w: rw, h: rh };
    }
    if (this.hasSelection && this.box) {
      return { ...this.box };
    }
    return null;
  }

  containsPoint(x, y) {
    const b = this.getBounds();
    if (!b) return false;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  /**
   * Cuts the raster pixels inside the box selection from the given layer.
   * Returns a detached canvas containing the extracted content.
   */
  cutSelectedPixels(layer) {
    if (!this.hasSelection || !this.box || !layer) return null;
    const { x, y, w, h } = this.box;
    if (w <= 0 || h <= 0) return null;

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = w;
    patchCanvas.height = h;
    const patchCtx = patchCanvas.getContext('2d');

    // Copy selected region
    patchCtx.drawImage(layer.canvas, x, y, w, h, 0, 0, w, h);

    // Clear selected region on the layer
    layer.ctx.save();
    layer.ctx.clearRect(x, y, w, h);
    layer.ctx.restore();
    layer.updateThumbnail();

    return {
      canvas: patchCanvas,
      x,
      y,
      w,
      h
    };
  }

  /**
   * Clears the raster content inside the selection box on the layer.
   */
  clearSelectedArea(layer) {
    if (!this.hasSelection || !this.box || !layer) return;
    const { x, y, w, h } = this.box;
    layer.ctx.clearRect(x, y, w, h);
    layer.updateThumbnail();
  }

  /**
   * Draws animated marching ants around the active box or committed selection.
   */
  drawMarchingAnts(targetCtx, zoom = 1.0) {
    const bounds = this.getBounds();
    if (!bounds || bounds.w < 2 || bounds.h < 2) return;

    this.dashOffset = (this.dashOffset + 0.4) % 12;

    targetCtx.save();
    const lw = Math.max(1, 1.5 / zoom);
    targetCtx.lineWidth = lw;

    // Outer dark stroke
    targetCtx.strokeStyle = '#1B1B1D';
    targetCtx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    // Inner marching ants stroke
    targetCtx.strokeStyle = '#FFFFFF';
    targetCtx.setLineDash([5 / zoom, 5 / zoom]);
    targetCtx.lineDashOffset = -this.dashOffset / zoom;
    targetCtx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    // Corner grip handles
    targetCtx.fillStyle = '#3B6EDC';
    const hs = Math.max(4, 6 / zoom);
    const corners = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.w, bounds.y],
      [bounds.x + bounds.w, bounds.y + bounds.h],
      [bounds.x, bounds.y + bounds.h]
    ];
    for (const [cx, cy] of corners) {
      targetCtx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
    }

    targetCtx.restore();
  }
}

/* --- TransformTool.js --- */
/**
 * Vectura Transform & Translation Engine
 * Translates (moves), scales, rotates, and flips raster layer content or selections.
 * Interactive on-canvas handles with real-time hardware-accelerated preview and Undo/Redo.
 */


function cloneCanvas(sourceCanvas) {
  if (!sourceCanvas) return null;
  const clone = document.createElement('canvas');
  clone.width = sourceCanvas.width;
  clone.height = sourceCanvas.height;
  clone.getContext('2d').drawImage(sourceCanvas, 0, 0);
  return clone;
}

class TransformTool {
  constructor() {
    this.active = false;
    this.targetLayer = null;
    this.beforeStateCanvas = null; // For Undo

    // Floating patch canvas holding pixels being transformed
    this.patchCanvas = null;
    this.patchOrigin = { x: 0, y: 0 }; // Initial top-left in document coords
    this.patchSize = { w: 100, h: 100 };

    // Transformations
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0; // radians

    // Drag tracking
    this.dragHandle = null; // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rot'
    this.dragStart = { x: 0, y: 0 };
    this.initialTransform = null;
  }

  /**
   * Activates transform on a layer, optionally using a cut selection patch.
   */
  activate(layer, selectionPatch = null) {
    if (!layer) return;
    this.targetLayer = layer;
    this.active = true;

    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0;

    // Snapshot layer canvas before transformation for undo / cancel
    this.beforeStateCanvas = cloneCanvas(layer.canvas);

    if (selectionPatch && selectionPatch.canvas) {
      // Transforming extracted selection box
      this.isSelection = true;
      this.patchCanvas = selectionPatch.canvas;
      this.patchOrigin = { x: selectionPatch.x, y: selectionPatch.y };
      this.patchSize = { w: selectionPatch.w, h: selectionPatch.h };
    } else {
      // Transforming whole layer
      this.isSelection = false;
      this.patchCanvas = cloneCanvas(layer.canvas);
      this.patchOrigin = { x: 0, y: 0 };
      this.patchSize = { w: layer.width, h: layer.height };

      // Temporarily clear layer while actively transforming so preview doesn't double-draw
      layer.ctx.clearRect(0, 0, layer.width, layer.height);
    }
  }

  flipHorizontal() {
    this.scaleX *= -1;
  }

  flipVertical() {
    this.scaleY *= -1;
  }

  flipH() {
    this.flipHorizontal();
  }

  flipV() {
    this.flipVertical();
  }

  resetTransform() {
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0;
  }

  getPivot() {
    return {
      x: this.patchOrigin.x + this.patchSize.w / 2,
      y: this.patchOrigin.y + this.patchSize.h / 2
    };
  }

  onPointerDown(worldX, worldY, zoom = 1.0) {
    if (!this.active) return false;
    const handle = this.hitTestHandle(worldX, worldY, zoom);
    if (handle) {
      this.dragHandle = handle;
      this.dragStart = { x: worldX, y: worldY };
      this.initialTransform = {
        tx: this.translateX,
        ty: this.translateY,
        sx: this.scaleX,
        sy: this.scaleY,
        rot: this.rotation
      };
      return true;
    }
    return false;
  }

  onPointerMove(worldX, worldY) {
    if (!this.active || !this.dragHandle) return;
    const dx = worldX - this.dragStart.x;
    const dy = worldY - this.dragStart.y;
    const pivot = this.getPivot();

    if (this.dragHandle === 'move') {
      this.translateX = this.initialTransform.tx + dx;
      this.translateY = this.initialTransform.ty + dy;
    } else if (this.dragHandle === 'rot') {
      const angle = Math.atan2(worldY - (pivot.y + this.initialTransform.ty), worldX - (pivot.x + this.initialTransform.tx));
      const startAngle = Math.atan2(this.dragStart.y - (pivot.y + this.initialTransform.ty), this.dragStart.x - (pivot.x + this.initialTransform.tx));
      this.rotation = this.initialTransform.rot + (angle - startAngle);
    } else if (this.dragHandle === 'se' || this.dragHandle === 'nw' || this.dragHandle === 'ne' || this.dragHandle === 'sw') {
      const origDist = Math.hypot(this.patchSize.w / 2, this.patchSize.h / 2);
      const curDist = Math.hypot(worldX - (pivot.x + this.translateX), worldY - (pivot.y + this.translateY));
      const factor = Math.max(0.05, curDist / Math.max(1, origDist));
      const signX = Math.sign(this.initialTransform.sx) || 1;
      const signY = Math.sign(this.initialTransform.sy) || 1;
      this.scaleX = signX * factor;
      this.scaleY = signY * factor;
    }
  }

  onPointerUp() {
    this.dragHandle = null;
  }

  hitTestHandle(wx, wy, zoom = 1.0) {
    const r = 38 / Math.max(0.1, zoom); // Generous touch target for mobile
    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;

    // Un-rotate world point around pivot to local transform space
    let lx = wx;
    let ly = wy;
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const dx = wx - cx;
      const dy = wy - cy;
      lx = cx + (dx * cos - dy * sin);
      ly = cy + (dx * sin + dy * cos);
    }

    const wHalf = (this.patchSize.w * Math.abs(this.scaleX)) / 2;
    const hHalf = (this.patchSize.h * Math.abs(this.scaleY)) / 2;

    // Test rotation handle (above top edge)
    const rotY = cy - hHalf - 36 / Math.max(0.1, zoom);
    if (Math.hypot(lx - cx, ly - rotY) <= r) return 'rot';

    // Test 4 corner handles
    const corners = [
      { name: 'nw', x: cx - wHalf, y: cy - hHalf },
      { name: 'ne', x: cx + wHalf, y: cy - hHalf },
      { name: 'se', x: cx + wHalf, y: cy + hHalf },
      { name: 'sw', x: cx - wHalf, y: cy + hHalf }
    ];

    for (const c of corners) {
      if (Math.hypot(lx - c.x, ly - c.y) <= r) return c.name;
    }

    // Test inside bounding box = move
    if (lx >= cx - wHalf && lx <= cx + wHalf && ly >= cy - hHalf && ly <= cy + hHalf) {
      return 'move';
    }

    return null;
  }

  isInsideBox(wx, wy) {
    if (!this.active || !this.patchCanvas) return false;
    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;

    let lx = wx;
    let ly = wy;
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const dx = wx - cx;
      const dy = wy - cy;
      lx = cx + (dx * cos - dy * sin);
      ly = cy + (dx * sin + dy * cos);
    }
    const wHalf = (this.patchSize.w * Math.abs(this.scaleX)) / 2;
    const hHalf = (this.patchSize.h * Math.abs(this.scaleY)) / 2;
    return lx >= cx - wHalf && lx <= cx + wHalf && ly >= cy - hHalf && ly <= cy + hHalf;
  }

  /**
   * Commits the transformation to the target layer and pushes a RasterCommand to History.
   */
  applyTransform(history = null, onComplete = null, selectionTool = null) {
    if (!this.active || !this.targetLayer || !this.patchCanvas) return;

    const layer = this.targetLayer;
    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;

    // Bake transformed patch into layer canvas
    layer.ctx.save();
    layer.ctx.translate(cx, cy);
    layer.ctx.rotate(this.rotation);
    layer.ctx.scale(this.scaleX, this.scaleY);
    layer.ctx.drawImage(this.patchCanvas, -this.patchSize.w / 2, -this.patchSize.h / 2);
    layer.ctx.restore();

    layer.updateThumbnail();

    if (history && this.beforeStateCanvas) {
      const afterStateCanvas = cloneCanvas(layer.canvas);
      history.push(new RasterCommand('Transform', layer, this.beforeStateCanvas, afterStateCanvas));
    }

    // Preserve and update selection bounds if transforming a selection!
    if (this.isSelection && selectionTool) {
      const nw = Math.round(this.patchSize.w * Math.abs(this.scaleX));
      const nh = Math.round(this.patchSize.h * Math.abs(this.scaleY));
      selectionTool.setBox(Math.round(cx - nw / 2), Math.round(cy - nh / 2), nw, nh);
    }

    this.active = false;
    this.patchCanvas = null;
    this.beforeStateCanvas = null;
    this.isSelection = false;
    onComplete?.();
  }

  /**
   * Cancels transform and restores original layer state.
   */
  cancel(onComplete = null) {
    if (!this.active) return;
    if (this.targetLayer && this.beforeStateCanvas) {
      this.targetLayer.ctx.clearRect(0, 0, this.targetLayer.width, this.targetLayer.height);
      this.targetLayer.ctx.drawImage(this.beforeStateCanvas, 0, 0);
      this.targetLayer.updateThumbnail();
    }
    this.active = false;
    this.patchCanvas = null;
    this.beforeStateCanvas = null;
    onComplete?.();
  }

  /**
   * Renders the transformed floating content and interactive handles in real-time.
   */
  drawOverlay(ctx, zoom = 1.0) {
    if (!this.active || !this.patchCanvas) return;

    const pivot = this.getPivot();
    const cx = pivot.x + this.translateX;
    const cy = pivot.y + this.translateY;
    const w = this.patchSize.w;
    const h = this.patchSize.h;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    // 1. Draw floating raster content
    ctx.save();
    ctx.scale(this.scaleX, this.scaleY);
    ctx.drawImage(this.patchCanvas, -w / 2, -h / 2);
    ctx.restore();

    // 2. Bounding Box
    const wHalf = (w * Math.abs(this.scaleX)) / 2;
    const hHalf = (h * Math.abs(this.scaleY)) / 2;
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);
    ctx.strokeRect(-wHalf, -hHalf, wHalf * 2, hHalf * 2);

    // 3. Corner Handles (crisp square controls, high visibility)
    const hs = Math.max(14, 16 / zoom);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);

    const corners = [
      [-wHalf, -hHalf],
      [wHalf, -hHalf],
      [wHalf, hHalf],
      [-wHalf, hHalf]
    ];

    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }

    // 4. Rotation handle (stem and top circle)
    const stemLen = 36 / Math.max(0.1, zoom);
    ctx.beginPath();
    ctx.moveTo(0, -hHalf);
    ctx.lineTo(0, -hHalf - stemLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -hHalf - stemLen, Math.max(8, 9 / zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

/* --- VectorPointEditor.js --- */
/**
 * Vectura Vector Point Editor
 * Direct vector curve node manipulation, point insertion, deletion, and curve smoothing.
 */


class VectorPointEditor {
  constructor() {
    this.active = false;
    this.selectedStroke = null;
    this.selectedPointIndex = -1;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
  }

  activate() {
    this.active = true;
    this.selectedStroke = null;
    this.selectedPointIndex = -1;
  }

  deactivate() {
    this.active = false;
    this.selectedStroke = null;
    this.selectedPointIndex = -1;
  }

  onPointerDown(worldX, worldY, layer) {
    if (!this.active || !layer) return false;

    // 1. If a stroke is already selected, check if we hit one of its points
    if (this.selectedStroke && this.selectedStroke.points) {
      for (let i = 0; i < this.selectedStroke.points.length; i++) {
        const pt = this.selectedStroke.points[i];
        if (Math.hypot(worldX - pt.x, worldY - pt.y) <= 18) {
          this.selectedPointIndex = i;
          this.isDragging = true;
          this.dragStart = { x: worldX, y: worldY };
          return true;
        }
      }
    }

    // 2. Otherwise search for nearest stroke on active layer
    let closestStroke = null;
    let minDist = 24;

    for (let i = layer.strokes.length - 1; i >= 0; i--) {
      const s = layer.strokes[i];
      if (s.points) {
        for (const pt of s.points) {
          const d = Math.hypot(worldX - pt.x, worldY - pt.y);
          if (d < minDist) {
            minDist = d;
            closestStroke = s;
          }
        }
      }
    }

    if (closestStroke) {
      this.selectedStroke = closestStroke;
      this.selectedPointIndex = -1;
      return true;
    }

    return false;
  }

  onPointerMove(worldX, worldY) {
    if (!this.isDragging || !this.selectedStroke || this.selectedPointIndex < 0) return false;
    const pt = this.selectedStroke.points[this.selectedPointIndex];
    if (pt) {
      pt.x = worldX;
      pt.y = worldY;
      return true; // Request redraw
    }
    return false;
  }

  onPointerUp() {
    this.isDragging = false;
  }

  deleteSelectedPoint(onRedraw) {
    if (!this.selectedStroke || this.selectedPointIndex < 0) return;
    if (this.selectedStroke.points.length > 2) {
      this.selectedStroke.points.splice(this.selectedPointIndex, 1);
      this.selectedPointIndex = -1;
      onRedraw?.();
    }
  }

  simplifyStroke(onRedraw) {
    if (!this.selectedStroke || !this.selectedStroke.points) return;
    this.selectedStroke.points = simplifyPoints(this.selectedStroke.points, 3.0);
    this.selectedPointIndex = -1;
    onRedraw?.();
  }

  drawOverlay(ctx) {
    if (!this.active || !this.selectedStroke || !this.selectedStroke.points) return;

    ctx.save();
    const pts = this.selectedStroke.points;

    // Draw control polygon in dashed cyan
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Draw point handles
    ctx.setLineDash([]);
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const isSelected = i === this.selectedPointIndex;

      ctx.fillStyle = isSelected ? '#f59e0b' : '#ffffff';
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

/* --- SmudgeTool.js --- */
/**
 * Vectura Smudge Tool Engine
 * Blends and smears underlying pixels along the stroke path.
 * Settings: strength, size, hardness, spacing, finger-painting mode.
 * Fully integrated with layers, selections, alpha lock, and undo/redo.
 */


function cloneCanvas(sourceCanvas) {
  if (!sourceCanvas) return null;
  const clone = document.createElement('canvas');
  clone.width = sourceCanvas.width;
  clone.height = sourceCanvas.height;
  clone.getContext('2d').drawImage(sourceCanvas, 0, 0);
  return clone;
}

class SmudgeTool {
  constructor() {
    this.active = false;
    this.size = 28;
    this.strength = 0.65; // 0.05 to 1.0
    this.hardness = 0.5;   // 0.0 to 1.0
    this.spacing = 0.12;   // 0.05 to 0.5 of size
    this.fingerPainting = false;

    this.activeLayer = null;
    this.beforeCanvas = null;
    this.lastPoint = null;
    this.accumulatedDist = 0;

    // Internal pickup buffer
    this.pickupCanvas = document.createElement('canvas');
    this.pickupCanvas.width = 64;
    this.pickupCanvas.height = 64;
    this.pickupCtx = this.pickupCanvas.getContext('2d', { willReadFrequently: true });
    this.hasPickedPaint = false;
  }

  start(x, y, layer, currentColor = '#3B6EDC', selectionTool = null) {
    if (!layer || layer.locked) return;
    this.active = true;
    this.activeLayer = layer;
    this.beforeCanvas = cloneCanvas(layer.canvas);
    this.lastPoint = { x, y };
    this.accumulatedDist = 0;

    const r = Math.max(2, Math.round(this.size / 2));
    this.pickupCanvas.width = r * 2;
    this.pickupCanvas.height = r * 2;
    this.pickupCtx.clearRect(0, 0, r * 2, r * 2);

    if (this.fingerPainting) {
      // In finger-painting mode, initialize with the current color
      this.pickupCtx.save();
      this.pickupCtx.fillStyle = currentColor;
      this.pickupCtx.beginPath();
      this.pickupCtx.arc(r, r, r, 0, Math.PI * 2);
      this.pickupCtx.fill();
      this.pickupCtx.restore();
      this.hasPickedPaint = true;
    } else {
      // Sample initial paint from layer
      this.samplePaint(layer, x, y, r);
    }
  }

  samplePaint(layer, x, y, r) {
    const sx = Math.round(x - r);
    const sy = Math.round(y - r);
    const size = r * 2;

    this.pickupCtx.clearRect(0, 0, size, size);
    this.pickupCtx.save();
    // Clip to circle
    this.pickupCtx.beginPath();
    this.pickupCtx.arc(r, r, r, 0, Math.PI * 2);
    this.pickupCtx.clip();

    this.pickupCtx.drawImage(layer.canvas, sx, sy, size, size, 0, 0, size, size);
    this.pickupCtx.restore();
    this.hasPickedPaint = true;
  }

  update(x, y, selectionTool = null) {
    if (!this.active || !this.activeLayer || !this.lastPoint) return;

    const dx = x - this.lastPoint.x;
    const dy = y - this.lastPoint.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const step = Math.max(1.5, this.size * this.spacing);
    this.accumulatedDist += dist;

    const steps = Math.floor(this.accumulatedDist / step);
    if (steps > 0) {
      const r = Math.max(2, Math.round(this.size / 2));
      for (let s = 1; s <= steps; s++) {
        const t = (s * step) / this.accumulatedDist;
        const curX = this.lastPoint.x + dx * t;
        const curY = this.lastPoint.y + dy * t;

        this.applySmudgeStep(curX, curY, r, selectionTool);
      }
      this.lastPoint = { x, y };
      this.accumulatedDist %= step;
    }
  }

  applySmudgeStep(x, y, r, selectionTool = null) {
    const layer = this.activeLayer;
    if (!layer) return;

    const ctx = layer.ctx;
    ctx.save();

    // Respect selection
    if (selectionTool && selectionTool.hasSelection && selectionTool.box) {
      const b = selectionTool.box;
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
    }

    // Respect Alpha Lock
    if (layer.alphaLock) {
      ctx.globalCompositeOperation = 'source-atop';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    // 1. Deposit picked paint with strength attenuation
    ctx.globalAlpha = Math.max(0.1, Math.min(1.0, this.strength));
    ctx.drawImage(this.pickupCanvas, Math.round(x - r), Math.round(y - r));

    ctx.restore();

    // 2. Blend/pick up new paint from canvas into the finger buffer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = r * 2;
    tempCanvas.height = r * 2;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw current canvas content into temp
    tempCtx.drawImage(layer.canvas, Math.round(x - r), Math.round(y - r), r * 2, r * 2, 0, 0, r * 2, r * 2);

    // Blend new canvas content with previous finger paint
    this.pickupCtx.save();
    this.pickupCtx.globalAlpha = 1.0 - this.strength * 0.75;
    this.pickupCtx.drawImage(tempCanvas, 0, 0);
    this.pickupCtx.restore();
  }

  commit(history = null, onComplete = null) {
    if (!this.active || !this.activeLayer) return;
    this.active = false;

    const layer = this.activeLayer;
    layer.updateThumbnail();

    if (history && this.beforeCanvas) {
      const afterCanvas = cloneCanvas(layer.canvas);
      history.push(new RasterCommand('Smudge Stroke', layer, this.beforeCanvas, afterCanvas, () => {
        layer.updateThumbnail();
        onComplete?.();
      }));
    }

    this.activeLayer = null;
    this.beforeCanvas = null;
    this.lastPoint = null;
    onComplete?.();
  }

  cancel() {
    if (!this.active) return;
    if (this.activeLayer && this.beforeCanvas) {
      this.activeLayer.ctx.clearRect(0, 0, this.activeLayer.width, this.activeLayer.height);
      this.activeLayer.ctx.drawImage(this.beforeCanvas, 0, 0);
      this.activeLayer.updateThumbnail();
    }
    this.active = false;
    this.activeLayer = null;
    this.beforeCanvas = null;
    this.lastPoint = null;
  }
}

/* --- ShapeTool.js --- */
/**
 * Vectura Vector Shape Tool
 * Generates vector lines, rectangles, ellipses, regular polygons, and stars as vector strokes.
 */
class ShapeTool {
  constructor() {
    this.type = 'rect'; // 'line' | 'rect' | 'ellipse' | 'polygon' | 'star'
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.sides = 5; // polygon/star points
  }

  setShape(type) {
    this.type = type;
  }

  start(x, y) {
    this.active = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
  }

  update(x, y) {
    if (!this.active) return;
    this.currentX = x;
    this.currentY = y;
  }

  commit(layer, colorHex, strokeWidth = 4, fill = false) {
    if (!this.active) return null;
    this.active = false;

    const shape = {
      type: 'vector-shape',
      shapeType: this.type,
      x0: this.startX,
      y0: this.startY,
      x1: this.currentX,
      y1: this.currentY,
      color: colorHex,
      strokeWidth: strokeWidth,
      fill: fill,
      sides: this.sides
    };

    // Draw to layer canvas
    ShapeTool.renderShape(layer.ctx, shape);
    layer.updateThumbnail();
    layer.addStroke(shape);
    return shape;
  }

  static renderShape(ctx, shape) {
    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const { x0, y0, x1, y1, shapeType, sides, fill } = shape;

    if (shapeType === 'line') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    } else if (shapeType === 'arrow') {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        const angle = Math.atan2(dy, dx);
        const headLen = Math.min(32, Math.max(12, len * 0.3));
        const headAngle = Math.PI / 6;

        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          x1 - headLen * Math.cos(angle - headAngle),
          y1 - headLen * Math.sin(angle - headAngle)
        );
        ctx.lineTo(
          x1 - (headLen * 0.7) * Math.cos(angle),
          y1 - (headLen * 0.7) * Math.sin(angle)
        );
        ctx.lineTo(
          x1 - headLen * Math.cos(angle + headAngle),
          y1 - headLen * Math.sin(angle + headAngle)
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (shapeType === 'rect') {
      const rx = Math.min(x0, x1);
      const ry = Math.min(y0, y1);
      const rw = Math.abs(x1 - x0);
      const rh = Math.abs(y1 - y0);
      if (fill) ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (shapeType === 'ellipse') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2;
      const ry = Math.abs(y1 - y0) / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
    } else if (shapeType === 'polygon' || shapeType === 'star') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const r = Math.hypot(x1 - x0, y1 - y0) / 2;
      const totalPoints = shapeType === 'star' ? sides * 2 : sides;

      for (let i = 0; i < totalPoints; i++) {
        const angle = (i * Math.PI * 2) / totalPoints - Math.PI / 2;
        const currentRadius = shapeType === 'star' && i % 2 !== 0 ? r * 0.45 : r;
        const px = cx + Math.cos(angle) * currentRadius;
        const py = cy + Math.sin(angle) * currentRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill) ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  drawLive(ctx, colorHex, strokeWidth) {
    if (!this.active) return;
    ShapeTool.renderShape(ctx, {
      shapeType: this.type,
      x0: this.startX,
      y0: this.startY,
      x1: this.currentX,
      y1: this.currentY,
      color: colorHex,
      strokeWidth: strokeWidth,
      fill: false,
      sides: this.sides
    });
  }

  cancel() {
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
  }

  renderOverlay(ctx, colorHex = '#8b5cf6', strokeWidth = 4) {
    this.drawLive(ctx, colorHex, strokeWidth);
  }
}

/* --- GradientTool.js --- */
/**
 * Vectura Gradient Tool
 * Linear and Radial gradients with interactive color stops.
 */
class GradientTool {
  constructor() {
    this.type = 'linear'; // 'linear' | 'radial'
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
  }

  start(x, y) {
    this.active = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
  }

  update(x, y) {
    if (!this.active) return;
    this.currentX = x;
    this.currentY = y;
  }

  commit(layer, color1, color2) {
    if (!this.active) return null;
    this.active = false;

    const ctx = layer.ctx;
    ctx.save();

    let gradient;
    if (this.type === 'linear') {
      gradient = ctx.createLinearGradient(this.startX, this.startY, this.currentX, this.currentY);
    } else {
      const radius = Math.hypot(this.currentX - this.startX, this.currentY - this.startY);
      gradient = ctx.createRadialGradient(this.startX, this.startY, 0, this.startX, this.startY, Math.max(1, radius));
    }

    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.restore();

    layer.updateThumbnail();

    const op = {
      type: 'gradient',
      gradientType: this.type,
      x0: this.startX,
      y0: this.startY,
      x1: this.currentX,
      y1: this.currentY,
      color1,
      color2
    };
    layer.addStroke(op);
    return op;
  }

  drawLive(ctx, color1, color2) {
    if (!this.active) return;
    ctx.save();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.startX, this.startY);
    ctx.lineTo(this.currentX, this.currentY);
    ctx.stroke();

    ctx.fillStyle = color1;
    ctx.beginPath();
    ctx.arc(this.startX, this.startY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color2;
    ctx.beginPath();
    ctx.arc(this.currentX, this.currentY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  cancel() {
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
  }

  renderOverlay(ctx, color1 = '#8b5cf6', color2 = '#ffffff') {
    this.drawLive(ctx, color1, color2);
  }
}

/* --- TextTool.js --- */
/**
 * Vectura Text Tool
 * Adds editable text labels rendered cleanly onto vector layers.
 */
class TextTool {
  constructor() {
    this.fontFamily = 'sans-serif';
    this.fontSize = 48;
    this.bold = false;
    this.italic = false;
  }

  commitText(layer, text, x, y, colorHex) {
    if (!text || !layer) return null;

    const fontStyle = `${this.italic ? 'italic ' : ''}${this.bold ? 'bold ' : ''}${this.fontSize}px ${this.fontFamily}`;

    const ctx = layer.ctx;
    ctx.save();
    ctx.font = fontStyle;
    ctx.fillStyle = colorHex;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    ctx.restore();

    layer.updateThumbnail();

    const textOp = {
      type: 'text',
      text,
      x,
      y,
      fontStyle,
      color: colorHex
    };
    layer.addStroke(textOp);
    return textOp;
  }
}

/* --- RulerGuides.js --- */
/**
 * Vectura Ruler & Guides Engine
 * Straight line ruler, circular compass guide, and isometric grid with magnetic snapping.
 */
class RulerGuides {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.docWidth = docWidth;
    this.docHeight = docHeight;
    this.mode = 'off'; // 'off' | 'grid' | 'line' | 'circle'
    this.snapThreshold = 18;

    // Line ruler
    this.line = { x0: 100, y0: docHeight / 2, x1: docWidth - 100, y1: docHeight / 2 };

    // Circle guide
    this.circle = { cx: docWidth / 2, cy: docHeight / 2, r: Math.min(docWidth, docHeight) * 0.35 };

    // Grid spacing
    this.gridSize = 60;
  }

  resize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.line = { x0: 100, y0: h / 2, x1: w - 100, y1: h / 2 };
    this.circle = { cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.35 };
  }

  toggle() {
    const modes = ['off', 'grid', 'line', 'circle'];
    const curIdx = modes.indexOf(this.mode);
    this.mode = modes[(curIdx + 1) % modes.length];
    return this.mode;
  }

  setMode(mode) {
    this.mode = mode;
  }

  snapPoint(x, y) {
    if (this.mode === 'off') return { x, y };

    if (this.mode === 'line') {
      const dx = this.line.x1 - this.line.x0;
      const dy = this.line.y1 - this.line.y0;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return { x, y };
      const t = ((x - this.line.x0) * dx + (y - this.line.y0) * dy) / lenSq;
      const projX = this.line.x0 + t * dx;
      const projY = this.line.y0 + t * dy;
      if (Math.hypot(x - projX, y - projY) < this.snapThreshold) {
        return { x: projX, y: projY };
      }
    } else if (this.mode === 'circle') {
      const angle = Math.atan2(y - this.circle.cy, x - this.circle.cx);
      const snapX = this.circle.cx + Math.cos(angle) * this.circle.r;
      const snapY = this.circle.cy + Math.sin(angle) * this.circle.r;
      if (Math.hypot(x - snapX, y - snapY) < this.snapThreshold) {
        return { x: snapX, y: snapY };
      }
    } else if (this.mode === 'grid') {
      const gx = Math.round(x / this.gridSize) * this.gridSize;
      const gy = Math.round(y / this.gridSize) * this.gridSize;
      if (Math.hypot(x - gx, y - gy) < this.snapThreshold) {
        return { x: gx, y: gy };
      }
    }

    return { x, y };
  }

  drawGuides(ctx, docW, docH, zoom = 1.0) {
    if (this.mode === 'off') return;

    ctx.save();
    const lw = Math.max(1, 1.2 / zoom);
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(59, 110, 220, 0.45)';

    if (this.mode === 'grid') {
      ctx.beginPath();
      for (let x = 0; x <= docW; x += this.gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, docH);
      }
      for (let y = 0; y <= docH; y += this.gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(docW, y);
      }
      ctx.stroke();
    } else if (this.mode === 'line') {
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(this.line.x0, this.line.y0);
      ctx.lineTo(this.line.x1, this.line.y1);
      ctx.stroke();

      // End handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#3B6EDC';
      const r = Math.max(4, 5 / zoom);
      ctx.beginPath();
      ctx.arc(this.line.x0, this.line.y0, r, 0, Math.PI * 2);
      ctx.arc(this.line.x1, this.line.y1, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mode === 'circle') {
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.arc(this.circle.cx, this.circle.cy, this.circle.r, 0, Math.PI * 2);
      ctx.stroke();

      // Center cross
      ctx.setLineDash([]);
      const s = Math.max(6, 8 / zoom);
      ctx.beginPath();
      ctx.moveTo(this.circle.cx - s, this.circle.cy);
      ctx.lineTo(this.circle.cx + s, this.circle.cy);
      ctx.moveTo(this.circle.cx, this.circle.cy - s);
      ctx.lineTo(this.circle.cx, this.circle.cy + s);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/* --- Eyedropper.js --- */
/**
 * Vectura Eyedropper Tool
 * Samples pixel color from canvas composite with visual loupe preview ring.
 */
class Eyedropper {
  constructor(loupeEl, sampleEl, currentEl) {
    this.loupeEl = loupeEl;
    this.sampleEl = sampleEl;
    this.currentEl = currentEl;
    this.active = false;
    this.lastColor = '#000000';
  }

  show(screenX, screenY, currentColor) {
    this.active = true;
    if (this.loupeEl) {
      this.loupeEl.style.display = 'block';
      this.loupeEl.style.left = screenX + 'px';
      this.loupeEl.style.top = screenY + 'px';
    }
    if (this.currentEl) {
      this.currentEl.style.backgroundColor = currentColor;
    }
  }

  hide() {
    this.active = false;
    if (this.loupeEl) {
      this.loupeEl.style.display = 'none';
    }
  }

  sample(worldX, worldY, screenX, screenY, layerManager) {
    if (!this.active) return this.lastColor;

    const w = layerManager.docWidth;
    const h = layerManager.docHeight;
    const x = Math.floor(worldX);
    const y = Math.floor(worldY);

    if (x >= 0 && x < w && y >= 0 && y < h) {
      layerManager.compositeToCanvas(layerManager.cachedCompositeCtx, true);
      const pixel = layerManager.cachedCompositeCtx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
      this.lastColor = hex;

      if (this.sampleEl) {
        this.sampleEl.style.backgroundColor = hex;
      }
    }

    if (this.loupeEl) {
      this.loupeEl.style.left = screenX + 'px';
      this.loupeEl.style.top = screenY + 'px';
    }

    return this.lastColor;
  }
}

/* --- SymmetryManager.js --- */
/**
 * Vectura Symmetry Drawing Engine
 * Vertical, Horizontal, and Radial (2-12 axes) symmetry mirroring around a movable center pivot.
 * Features: Draggable pivot handle, Lock toggle to prevent accidental dragging while drawing, and Reset option.
 */
class SymmetryManager {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.mode = 'off'; // 'off' | 'vertical' | 'horizontal' | 'radial'
    this.radialAxes = 4; // 2 to 12
    this.centerX = docWidth / 2;
    this.centerY = docHeight / 2;
    this.locked = false; // Prevents dragging pivot when drawing
  }

  setPivot(x, y) {
    if (this.locked) return;
    this.centerX = x;
    this.centerY = y;
  }

  reset(docW = 1080, docH = 1080) {
    this.centerX = docW / 2;
    this.centerY = docH / 2;
  }

  toggleLock() {
    this.locked = !this.locked;
    return this.locked;
  }

  toggle() {
    const modes = ['off', 'vertical', 'horizontal', 'radial'];
    const idx = modes.indexOf(this.mode);
    this.mode = modes[(idx + 1) % modes.length];
    return this.mode;
  }

  hitTest(wx, wy, zoom = 1.0) {
    if (this.mode === 'off' || this.locked) return false;
    const hitRadius = 28 / Math.max(0.1, zoom);
    const dist = Math.hypot(wx - this.centerX, wy - this.centerY);
    return dist <= hitRadius;
  }

  render(ctx, docW = null, docH = null, zoom = 1.0) {
    const w = docW || this.centerX * 2;
    const h = docH || this.centerY * 2;
    this.drawOverlay(ctx, w, h, zoom);
  }

  /**
   * Generates symmetric mirrored points for a given control point.
   */
  getSymmetricPoints(point) {
    if (this.mode === 'off') return [point];

    const results = [point];
    const dx = point.x - this.centerX;
    const dy = point.y - this.centerY;

    if (this.mode === 'vertical') {
      results.push({
        x: this.centerX - dx,
        y: point.y,
        pressure: point.pressure,
        time: point.time
      });
    } else if (this.mode === 'horizontal') {
      results.push({
        x: point.x,
        y: this.centerY - dy,
        pressure: point.pressure,
        time: point.time
      });
    } else if (this.mode === 'radial') {
      const angle = Math.atan2(dy, dx);
      const dist = Math.hypot(dx, dy);
      const step = (Math.PI * 2) / this.radialAxes;

      for (let i = 1; i < this.radialAxes; i++) {
        const a = angle + i * step;
        results.push({
          x: this.centerX + Math.cos(a) * dist,
          y: this.centerY + Math.sin(a) * dist,
          pressure: point.pressure,
          time: point.time
        });
      }
    }

    return results;
  }

  drawOverlay(ctx, docW, docH, zoom = 1.0) {
    if (this.mode === 'off') return;

    ctx.save();
    const isLocked = this.locked;
    const guideColor = isLocked ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.45)';
    const handleColor = isLocked ? '#f59e0b' : '#6366f1';

    ctx.strokeStyle = guideColor;
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);
    ctx.setLineDash([6 / zoom, 6 / zoom]);

    // Draw symmetry guide lines
    if (this.mode === 'vertical') {
      ctx.beginPath();
      ctx.moveTo(this.centerX, 0);
      ctx.lineTo(this.centerX, docH);
      ctx.stroke();
    } else if (this.mode === 'horizontal') {
      ctx.beginPath();
      ctx.moveTo(0, this.centerY);
      ctx.lineTo(docW, this.centerY);
      ctx.stroke();
    } else if (this.mode === 'radial') {
      const maxR = Math.hypot(docW, docH);
      const step = (Math.PI * 2) / this.radialAxes;
      for (let i = 0; i < this.radialAxes; i++) {
        const a = i * step;
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.lineTo(this.centerX + Math.cos(a) * maxR, this.centerY + Math.sin(a) * maxR);
        ctx.stroke();
      }
    }

    // Modern Cohesive Circular Handle
    ctx.setLineDash([]);
    const rOuter = Math.max(14, 18 / zoom);
    const rInner = Math.max(4, 5 / zoom);
    const tickLen = Math.max(5, 7 / zoom);

    // Crosshair ticks
    ctx.strokeStyle = handleColor;
    ctx.lineWidth = Math.max(1.5, 2.0 / zoom);
    ctx.beginPath();
    ctx.moveTo(this.centerX - rOuter - tickLen, this.centerY);
    ctx.lineTo(this.centerX - rOuter + 2 / zoom, this.centerY);
    ctx.moveTo(this.centerX + rOuter - 2 / zoom, this.centerY);
    ctx.lineTo(this.centerX + rOuter + tickLen, this.centerY);
    ctx.moveTo(this.centerX, this.centerY - rOuter - tickLen);
    ctx.lineTo(this.centerX, this.centerY - rOuter + 2 / zoom);
    ctx.moveTo(this.centerX, this.centerY + rOuter - 2 / zoom);
    ctx.lineTo(this.centerX, this.centerY + rOuter + tickLen);
    ctx.stroke();

    // Outer Target Ring
    ctx.fillStyle = isLocked ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.18)';
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, rOuter, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center Core
    ctx.fillStyle = handleColor;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, rInner, 0, Math.PI * 2);
    ctx.fill();

    // Lock Indicator Badge if locked
    if (isLocked) {
      const badgeR = Math.max(6, 8 / zoom);
      const bx = this.centerX + rOuter * 0.7;
      const by = this.centerY - rOuter * 0.7;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.0, 1.5 / zoom);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/* --- ToolManager.js --- */
/**
 * Vectura Tool Manager
 * Routes interactions between active tools and the raster canvas engine.
 */













class ToolManager {
  constructor(docWidth, docHeight) {
    this.activeTool = 'brush'; // 'brush' | 'eraser' | 'smudge' | 'bucket' | 'lasso-fill' | 'shape' | 'gradient' | 'text' | 'eyedropper'

    this.fillBucket = new FillBucket();
    this.lassoFill = new LassoFill();
    this.selectionTool = new SelectionTool(docWidth, docHeight);
    this.transformTool = new TransformTool();
    this.vectorPointEditor = new VectorPointEditor();
    this.shapeTool = new ShapeTool();
    this.gradientTool = new GradientTool();
    this.textTool = new TextTool();
    this.rulerGuides = new RulerGuides(docWidth, docHeight);
    this.eyedropper = new Eyedropper();
    this.symmetry = new SymmetryManager(docWidth, docHeight);
    this.smudgeTool = new SmudgeTool();
  }

  setTool(toolName, layer = null) {
    if (this.activeTool === 'transform' && toolName !== 'transform') {
      this.transformTool.cancel();
    }
    if (this.activeTool === 'point-editor' && toolName !== 'point-editor') {
      this.vectorPointEditor.deactivate();
    }

    this.activeTool = toolName;
  }

  resizeDocument(w, h) {
    this.selectionTool.resize(w, h);
    this.symmetry.setPivot(w / 2, h / 2);
  }
}

/* --- VectorCanvas.js --- */
/**
 * Vectura Vector Drawing Engine
 * High-performance raster canvas engine with Catmull-Rom splines, coherent jitter,
 * coalesced pointer capture, multi-touch navigation gestures, and 60fps layer rendering.
 *
 * Bugs Fixed:
 * 1. Undo/redo: Unified through HistoryManager and Command.js with active stroke cancellation.
 * 2. Gesture collision: Navigation gesture tracking, 250ms tap duration, <10px movement,
 *    200ms cooldown after navigation, gestureOccurred cancellation.
 * 3. Ink bleed: Minimum dt clamp, duplicate point rejection, isFinite validation,
 *    strict brush.maxSize clamp, and consecutive stamp size rate limiter.
 * 4. Fill tool: Smooth expanding circular reveal clipped to region, non-blocking, undoable.
 */









function cloneCanvas(sourceCanvas) {
  if (!sourceCanvas) return null;
  const clone = document.createElement('canvas');
  clone.width = sourceCanvas.width;
  clone.height = sourceCanvas.height;
  clone.getContext('2d').drawImage(sourceCanvas, 0, 0);
  return clone;
}

class VectorCanvas {
  constructor(viewportCanvas, docWidth = 1080, docHeight = 1080) {
    this.viewportCanvas = viewportCanvas;
    this.ctx = viewportCanvas.getContext('2d', { alpha: true });

    this.docWidth = docWidth;
    this.docHeight = docHeight;

    // Viewport & Transformations
    this.viewport = new Viewport(docWidth, docHeight);
    this.initialFitDone = false;
    this.isSpaceDown = false;
    this.isMousePanning = false;
    this.lastMousePanPos = { x: 0, y: 0 };

    // Spline & Pressure & Stabilizer
    this.spline = new CatmullRomSpline(0.5);
    this.pressureEngine = new PressureEngine();
    this.stabilizer = new Stabilizer({ mode: 'light', strength: 30 });

    // Subsystems
    this.layerManager = new LayerManager(docWidth, docHeight);
    this.toolManager = new ToolManager(docWidth, docHeight);
    this.history = null; // Injected from app

    // Live stroke buffer canvas (uncommitted drawing)
    this.liveCanvas = document.createElement('canvas');
    this.liveCanvas.width = docWidth;
    this.liveCanvas.height = docHeight;
    this.liveCtx = this.liveCanvas.getContext('2d');

    // Reusable single-stroke compositing buffer (prevents opacity blowout)
    this.strokeCanvas = document.createElement('canvas');
    this.strokeCanvas.width = docWidth;
    this.strokeCanvas.height = docHeight;
    this.strokeCtx = this.strokeCanvas.getContext('2d');

    // Current Drawing State
    this.isDrawing = false;
    this.isTransforming = false;
    this.activePointerId = null;
    this.currentStroke = null;
    this.currentBrush = null;
    this.currentColor = '#8b5cf6';
    this.beforeStrokeCanvas = null;

    // Active fill animations list (non-blocking)
    this.activeFillAnimations = [];

    // Global speed multiplier from quick settings
    this.globalSpeedFactor = 1.0;

    // Touch & Multi-touch navigation state
    this.activePointers = new Map(); // pointerId -> { x, y, time }
    this.isNavigating = false;
    this.navigationGestureOccurred = false;
    this.lastNavigationTime = 0;
    this.lastPinchDist = 0;
    this.lastPinchAngle = 0;
    this.lastPinchCenter = { x: 0, y: 0 };
    this.initialPinchDist = 0;
    this.initialPinchAngle = 0;
    this.initialPinchCenter = { x: 0, y: 0 };
    this.tapStartTime = 0;
    this.tapMaxMovement = 0;
    this.multiTouchTap = { startTime: 0, maxPointers: 0, maxMove: 0, hasNavigated: false };

    // Long press eyedropper timer
    this.longPressTimer = null;
    this.longPressPoint = null;

    // Shape Assist Hold Timer
    this.shapeHoldTimer = null;
    this.shapeHoldDetected = false;

    // Settings
    this.palmRejection = true;
    this.penActive = false;
    this.oneFingerDraws = true;
    this.pixelArtMode = false;

    // Callbacks
    this.onColorPicked = null;
    this.onUndoRequested = null;
    this.onRedoRequested = null;
    this.onToolAutoReverted = null;
    this.onHaptic = null;

    // Animation Loop
    this.running = true;
    this.renderLoop = this.renderLoop.bind(this);
    requestAnimationFrame(this.renderLoop);

    this.setupPointerListeners();
  }

  render() {
    this.needsRender = true;
    this.layerManager?.invalidateCaches();
  }

  setDocumentSize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.viewport.setDocumentSize(w, h);
    this.layerManager.resizeDocument(w, h);
    this.toolManager.resizeDocument(w, h);
    this.liveCanvas.width = w;
    this.liveCanvas.height = h;
    if (this.strokeCanvas) {
      this.strokeCanvas.width = w;
      this.strokeCanvas.height = h;
    }
  }

  applyDocProperties(props) {
    if (!props) return;
    if (props.width && props.height) {
      this.setDocumentSize(props.width, props.height);
    }
  }

  getPointerPos(e) {
    const rect = this.viewportCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  setupPointerListeners() {
    const el = this.viewportCanvas;
    el.addEventListener('pointerdown', this.onPointerDown.bind(this), { passive: false });
    el.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
    el.addEventListener('pointerup', this.onPointerUp.bind(this), { passive: false });
    el.addEventListener('pointercancel', this.onPointerCancel.bind(this), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // Native Touch Events for two-finger gestures (pinch, pan, rotate)
    el.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    el.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    el.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });

    // Wheel zoom on canvas, container, and window
    const wheelHandler = this.onWheel.bind(this);
    el.addEventListener('wheel', wheelHandler, { passive: false });
    if (el.parentElement) {
      el.parentElement.addEventListener('wheel', wheelHandler, { passive: false });
    }

    // Spacebar & Alt pan navigation
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Space' || e.key === 'Alt') && !this.isSpaceDown && !e.target.closest('input, textarea, select')) {
        this.isSpaceDown = true;
        this.viewportCanvas.style.cursor = 'grab';
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.key === 'Alt') {
        this.isSpaceDown = false;
        const isPan = this.toolManager.activeTool === 'pan' || this.toolManager.activeTool === 'transform';
        this.viewportCanvas.style.cursor = isPan ? 'grab' : 'crosshair';
      }
    });
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.viewportCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Direct scroll zoom: roll up zooms in, roll down zooms out
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    this.viewport.zoomAt(factor, cx, cy);
    this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
  }

  onTouchStart(e) {
    if (e.touches.length >= 2) {
      e.preventDefault();
      this.cancelAllActiveTools();
      this.isNavigating = true;
      this.navigationGestureOccurred = true;

      const rect = this.viewportCanvas.getBoundingClientRect();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const p1 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top };
      const p2 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };

      this.touchPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.touchPinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.touchPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
  }

  onTouchMove(e) {
    if (e.touches.length >= 2) {
      e.preventDefault();
      this.cancelAllActiveTools();
      this.isNavigating = true;
      this.navigationGestureOccurred = true;

      const rect = this.viewportCanvas.getBoundingClientRect();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const p1 = { x: t0.clientX - rect.left, y: t0.clientY - rect.top };
      const p2 = { x: t1.clientX - rect.left, y: t1.clientY - rect.top };

      const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const curCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      if (this.touchPinchCenter && this.touchPinchDist > 0) {
        // Pan
        const dx = curCenter.x - this.touchPinchCenter.x;
        const dy = curCenter.y - this.touchPinchCenter.y;
        this.viewport.panBy(dx, dy);

        // Zoom
        const factor = curDist / this.touchPinchDist;
        if (factor > 0.01 && factor < 100) {
          this.viewport.zoomAt(factor, curCenter.x, curCenter.y);
        }

        // Rotate
        let deltaAngle = curAngle - this.touchPinchAngle;
        while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        this.viewport.rotateAt(deltaAngle, curCenter.x, curCenter.y);

        this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
        this.needsRender = true;
      }

      this.touchPinchDist = curDist;
      this.touchPinchAngle = curAngle;
      this.touchPinchCenter = curCenter;
    }
  }

  onTouchEnd(e) {
    if (e.touches.length < 2) {
      this.touchPinchDist = 0;
      this.touchPinchCenter = null;
      this.lastNavigationTime = performance.now();
      if (e.touches.length === 0) {
        this.isNavigating = false;
        setTimeout(() => {
          this.navigationGestureOccurred = false;
        }, 150);
      }
    }
  }

  onPointerDown(e) {
    e.preventDefault();
    if (this.isNavigating || performance.now() - (this.lastNavigationTime || 0) < 250) {
      return;
    }
    // Prevent duplicated touch & mouse events firing for the same input
    if (e.pointerType === 'mouse' && performance.now() - (this.lastTouchTime || 0) < 500) {
      return;
    }
    if (e.pointerType === 'touch') {
      this.lastTouchTime = performance.now();
    }
    if (e.pointerType === 'mouse') {
      try {
        this.viewportCanvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    const now = performance.now();
    const pos = this.getPointerPos(e);
    const world = this.viewport.screenToWorld(pos.x, pos.y);

    // Mouse navigation triggers:
    // 1. Pan tool active
    // 2. Spacebar or Alt held down
    // 3. Middle click (1) or right click (2)
    // 4. Left click (0) on workspace outside artwork bounds
    const isPanTool = this.toolManager.activeTool === 'pan';
    const isOutsideDoc = world.x < 0 || world.x > this.docWidth || world.y < 0 || world.y > this.docHeight;
    const isMousePan = (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || this.isSpaceDown || e.altKey || isPanTool || (e.button === 0 && isOutsideDoc))) || (isPanTool && e.button === 0);

    if (isMousePan) {
      this.isMousePanning = true;
      this.lastMousePanPos = { x: pos.x, y: pos.y };
      this.viewportCanvas.style.cursor = 'grabbing';
      return;
    }

    // Stylus palm rejection
    if (e.pointerType === 'pen') {
      this.penActive = true;
    } else if (this.palmRejection && this.penActive && e.pointerType === 'touch') {
      return;
    }

    this.activePointers.set(e.pointerId, { x: pos.x, y: pos.y, time: now });

    if (this.activePointers.size === 1) {
      this.tapStartTime = now;
      this.tapMaxMovement = 0;
      this.navigationGestureOccurred = false;
      this.multiTouchTap = { startTime: now, maxPointers: 1, maxMove: 0, hasNavigated: false };

      // 1. Check Symmetry Pivot Drag Handle
      if (this.toolManager.symmetry.mode !== 'off' && !this.toolManager.symmetry.locked) {
        if (this.toolManager.symmetry.hitTest(world.x, world.y, this.viewport.zoom)) {
          this.isDraggingSymmetry = true;
          this.cancelLongPress();
          this.onHaptic?.();
          return;
        }
      }

      // Check long-press for eyedropper
      if (this.toolManager.activeTool === 'brush' || this.toolManager.activeTool === 'eyedropper') {
        const sx = pos.x, sy = pos.y;
        const world = this.viewport.screenToWorld(sx, sy);
        this.longPressPoint = { sx, sy, wx: world.x, wy: world.y };
        this.longPressTimer = setTimeout(() => {
          if (!this.isNavigating && !this.navigationGestureOccurred && this.tapMaxMovement < 10) {
            this.triggerEyedropper(this.longPressPoint.wx, this.longPressPoint.wy, this.longPressPoint.sx, this.longPressPoint.sy);
          }
        }, 420);
      }

      const world = this.viewport.screenToWorld(pos.x, pos.y);
      const activeLayer = this.layerManager.getActiveLayer();

      // Tool dispatch with strict touch priority
      if (this.toolManager.activeTool === 'bucket') {
        this.toolManager.fillBucket.fill(world.x, world.y, this.currentColor, this.layerManager, (info) => {
          this.commitFillWithAnimation(info);
        });
        return;
      } else if (this.toolManager.activeTool === 'lasso-fill') {
        this.toolManager.lassoFill.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'selection') {
        this.toolManager.selectionTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'transform') {
        if (!this.toolManager.transformTool.active && activeLayer) {
          const patch = this.toolManager.selectionTool.hasSelection
            ? this.toolManager.selectionTool.cutSelectedPixels(activeLayer)
            : null;
          this.toolManager.transformTool.activate(activeLayer, patch);
        }
        const handled = this.toolManager.transformTool.onPointerDown(world.x, world.y, this.viewport.zoom);
        if (handled) {
          this.isTransforming = true;
          this.needsRender = true;
          return;
        } else {
          // Tapped outside transform box: commit and return to brush
          this.toolManager.transformTool.applyTransform(this.history, () => {
            this.layerManager.invalidateCaches();
          }, this.toolManager.selectionTool);
          this.toolManager.setTool('brush');
          this.onToolAutoReverted?.('brush');
          this.isTransforming = false;
          this.needsRender = true;
          return;
        }
      } else if (this.toolManager.activeTool === 'smudge') {
        if (activeLayer && !activeLayer.locked) {
          this.toolManager.smudgeTool.start(world.x, world.y, activeLayer, this.currentColor, this.toolManager.selectionTool);
        }
        return;
      } else if (this.toolManager.activeTool === 'shape') {
        this.toolManager.shapeTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'gradient') {
        this.toolManager.gradientTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'text') {
        if (activeLayer && !activeLayer.locked) {
          try {
            const text = prompt('Enter text:');
            if (text && text.trim()) {
              const fontSize = this.toolManager.textTool?.fontSize || 48;
              const approxW = text.trim().length * fontSize * 0.8;
              const approxH = fontSize * 1.5;
              const bbox = {
                x: Math.max(0, Math.floor(world.x - 4)),
                y: Math.max(0, Math.floor(world.y - 4)),
                width: Math.min(this.docWidth, Math.ceil(approxW + 8)),
                height: Math.min(this.docHeight, Math.ceil(approxH + 8))
              };
              const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
              this.toolManager.textTool.commitText(activeLayer, text.trim(), world.x, world.y, this.currentColor);
              const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
              if (this.history) {
                this.history.push(new RasterCommand('Add Text', activeLayer, beforeSnapshot, afterSnapshot, () => {
                  this.layerManager.invalidateCaches();
                }));
              }
              this.layerManager.invalidateCaches();
              this.render();
            }
          } catch (textErr) {
            console.error('Text tool error:', textErr);
            this.showToast('Text tool error: ' + (textErr.message || 'failed'));
          }
        }
        return;
      }

      // Drawing stroke begin
      if (activeLayer && !activeLayer.locked) {
        this.startStroke(e);
      }
    } else if (this.activePointers.size >= 2) {
      if (this.isTransforming || (this.toolManager.activeTool === 'transform' && this.toolManager.transformTool.dragHandle)) {
        return; // Don't interrupt handle dragging!
      }
      if (this.activePointers.size > this.multiTouchTap.maxPointers) {
        this.multiTouchTap.maxPointers = this.activePointers.size;
      }

      // 2 or more fingers: Cancel any active stroke/tool & initialize Pinch / Pan / Rotate
      this.cancelAllActiveTools();
      this.isNavigating = true;

      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      this.lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.lastPinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      this.initialPinchDist = this.lastPinchDist;
      this.initialPinchAngle = this.lastPinchAngle;
      this.initialPinchCenter = { ...this.lastPinchCenter };
      this.navigationGestureOccurred = false;
    }
  }

  onPointerMove(e) {
    e.preventDefault();
    const pos = this.getPointerPos(e);

    // Mouse Pan Navigation
    if (this.isMousePanning) {
      const dx = pos.x - this.lastMousePanPos.x;
      const dy = pos.y - this.lastMousePanPos.y;
      this.viewport.panBy(dx, dy);
      this.viewport.onNavigate?.(this.viewport.zoom, this.viewport.rotation);
      this.lastMousePanPos = { x: pos.x, y: pos.y };
      return;
    }

    if (!this.activePointers.has(e.pointerId)) return;

    const prevPt = this.activePointers.get(e.pointerId);
    const movement = Math.hypot(pos.x - prevPt.x, pos.y - prevPt.y);
    this.tapMaxMovement += movement;
    this.multiTouchTap.maxMove += movement;

    if (movement > 6) {
      this.cancelLongPress();
    }

    this.activePointers.set(e.pointerId, { x: pos.x, y: pos.y, time: performance.now() });

    // Handle Eyedropper sampling if active
    if (this.toolManager.eyedropper.active) {
      const world = this.viewport.screenToWorld(pos.x, pos.y);
      const picked = this.toolManager.eyedropper.sample(world.x, world.y, pos.x, pos.y, this.layerManager);
      this.currentColor = picked;
      this.onColorPicked?.(picked);
      return;
    }

    // If navigating or multi-touch is active, don't execute any single-pointer tool
    if (this.isNavigating || this.activePointers.size >= 2 || performance.now() - (this.lastNavigationTime || 0) < 250) {
      this.cancelAllActiveTools();
      return;
    }

    // Symmetry pivot dragging
    if (this.isDraggingSymmetry) {
      const world = this.viewport.screenToWorld(pos.x, pos.y);
      this.toolManager.symmetry.setPivot(world.x, world.y);
      this.needsRender = true;
      return;
    }

    // Tools move
    const world = this.viewport.screenToWorld(pos.x, pos.y);
    if (this.isTransforming || (this.toolManager.activeTool === 'transform' && this.toolManager.transformTool.active && this.toolManager.transformTool.dragHandle)) {
      this.toolManager.transformTool.onPointerMove(world.x, world.y);
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'smudge' && this.toolManager.smudgeTool.active) {
      this.toolManager.smudgeTool.update(world.x, world.y, this.toolManager.selectionTool);
      this.layerManager.invalidateCaches();
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'selection' && this.toolManager.selectionTool.active) {
      this.toolManager.selectionTool.update(world.x, world.y);
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
      this.toolManager.lassoFill.addPoint(world.x, world.y);
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
      this.toolManager.shapeTool.update(world.x, world.y);
      this.needsRender = true;
      return;
    } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
      this.toolManager.gradientTool.update(world.x, world.y);
      this.needsRender = true;
      return;
    }

    // Live Drawing stroke update
    if (this.isDrawing && e.pointerId === this.activePointerId) {
      if (this.isNavigating || this.activePointers.size >= 2) {
        this.cancelStroke();
        return;
      }
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of coalesced) {
        this.appendStrokePoint(ce);
      }

      if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);
      this.shapeHoldTimer = setTimeout(() => {
        if (this.isDrawing && this.currentStroke && this.currentStroke.points.length > 5) {
          this.triggerShapeAssist();
        }
      }, 420);
    }
  }

  onPointerUp(e) {
    e.preventDefault();
    try {
      this.viewportCanvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    this.cancelLongPress();
    if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);

    if (this.isMousePanning) {
      this.isMousePanning = false;
      const isPan = this.toolManager.activeTool === 'pan' || this.toolManager.activeTool === 'transform';
      this.viewportCanvas.style.cursor = isPan ? 'grab' : (this.isSpaceDown ? 'grab' : 'crosshair');
      return;
    }

    const now = performance.now();
    const tapDuration = now - this.multiTouchTap.startTime;
    const maxPointers = this.multiTouchTap.maxPointers;

    this.activePointers.delete(e.pointerId);

    if (this.isDraggingSymmetry) {
      this.isDraggingSymmetry = false;
      this.needsRender = true;
      return;
    }

    // Multi-finger tap gestures for Undo & Redo:
    // 2-finger tap = Undo, 3-finger tap = Redo
    if (!this.multiTouchTap.hasNavigated && tapDuration < 340 && this.multiTouchTap.maxMove < 18) {
      if (maxPointers === 2) {
        this.onHaptic?.();
        this.onUndoRequested?.();
        this.multiTouchTap = { startTime: 0, maxPointers: 0, maxMove: 999, hasNavigated: true };
        this.cancelAllActiveTools();
        return;
      } else if (maxPointers === 3) {
        this.onHaptic?.();
        this.onRedoRequested?.();
        this.multiTouchTap = { startTime: 0, maxPointers: 0, maxMove: 999, hasNavigated: true };
        this.cancelAllActiveTools();
        return;
      }
    }

    // If navigation occurred or multiple fingers were down, cancel all tools without committing stray marks
    if (this.navigationGestureOccurred || this.multiTouchTap.hasNavigated || this.isNavigating || performance.now() - (this.lastNavigationTime || 0) < 250 || this.activePointers.size > 0) {
      this.cancelAllActiveTools();
      if (this.activePointers.size === 0) {
        this.isNavigating = false;
        setTimeout(() => {
          this.navigationGestureOccurred = false;
        }, 150);
      }
      return;
    }

    if (this.toolManager.eyedropper.active) {
      this.toolManager.eyedropper.hide();
      return;
    }

    if (this.toolManager.smudgeTool && this.toolManager.activeTool === 'smudge' && this.toolManager.smudgeTool.active) {
      this.toolManager.smudgeTool.commit(this.history, () => {
        this.layerManager.invalidateCaches();
      });
      this.needsRender = true;
      return;
    }

    if (this.toolManager.selectionTool && this.toolManager.activeTool === 'selection' && this.toolManager.selectionTool.active) {
      const rw = Math.abs(this.toolManager.selectionTool.currentX - this.toolManager.selectionTool.startX);
      const rh = Math.abs(this.toolManager.selectionTool.currentY - this.toolManager.selectionTool.startY);
      if (rw < 4 && rh < 4 && this.toolManager.selectionTool.hasSelection) {
        // Tapped outside selection box without dragging -> clear selection and revert to brush
        this.toolManager.selectionTool.clear();
        this.toolManager.setTool('brush');
        this.onToolAutoReverted?.('brush');
      } else {
        this.toolManager.selectionTool.commit();
      }
      this.needsRender = true;
      this.onSelectionChanged?.(this.toolManager.selectionTool.hasSelection);
      return;
    } else if (this.isTransforming || this.toolManager.activeTool === 'transform') {
      this.isTransforming = false;
      this.toolManager.transformTool.onPointerUp();
      this.needsRender = true;
      return;
    }

    // Tool commits with unified Command pattern (cropped bounding-box snapshots)
    const activeLayer = this.layerManager.getActiveLayer();
    if (activeLayer && !activeLayer.locked) {
      try {
        if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
          const pts = this.toolManager.lassoFill.points;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const bbox = pts.length > 0 ? {
            x: Math.max(0, Math.floor(minX - 4)),
            y: Math.max(0, Math.floor(minY - 4)),
            width: Math.min(this.docWidth, Math.ceil(maxX - minX + 8)),
            height: Math.min(this.docHeight, Math.ceil(maxY - minY + 8))
          } : null;
          const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          this.toolManager.lassoFill.finish(activeLayer, this.currentColor, false);
          const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          this.layerManager.invalidateCaches();
          if (this.history) {
            this.history.push(new RasterCommand('Lasso Fill', activeLayer, beforeSnapshot, afterSnapshot, () => {
              this.layerManager.invalidateCaches();
            }));
          }
        } else if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
          const st = this.toolManager.shapeTool;
          const strokeW = this.currentBrush?.size || 4;
          const minX = Math.min(st.startX, st.currentX) - strokeW - 4;
          const minY = Math.min(st.startY, st.currentY) - strokeW - 4;
          const maxX = Math.max(st.startX, st.currentX) + strokeW + 4;
          const maxY = Math.max(st.startY, st.currentY) + strokeW + 4;
          const bbox = {
            x: Math.max(0, Math.floor(minX)),
            y: Math.max(0, Math.floor(minY)),
            width: Math.min(this.docWidth, Math.ceil(maxX - minX)),
            height: Math.min(this.docHeight, Math.ceil(maxY - minY))
          };
          const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          st.commit(activeLayer, this.currentColor, strokeW);
          const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
          this.layerManager.invalidateCaches();
          if (this.history) {
            this.history.push(new RasterCommand('Draw Shape', activeLayer, beforeSnapshot, afterSnapshot, () => {
              this.layerManager.invalidateCaches();
            }));
          }
        } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
          const beforeSnapshot = cropBoundingBox(activeLayer.canvas, null);
          this.toolManager.gradientTool.commit(activeLayer, this.currentColor, '#ffffff');
          const afterSnapshot = cropBoundingBox(activeLayer.canvas, null);
          this.layerManager.invalidateCaches();
          if (this.history) {
            this.history.push(new RasterCommand('Linear Gradient', activeLayer, beforeSnapshot, afterSnapshot, () => {
              this.layerManager.invalidateCaches();
            }));
          }
        }
      } catch (toolCommitErr) {
        console.error('Tool commit failed:', toolCommitErr);
        this.showToast('Tool error: ' + (toolCommitErr.message || 'action failed'));
      }
    }

    if (this.isDrawing && e.pointerId === this.activePointerId) {
      this.finishStroke();
    }

    if (this.isNavigating) {
      this.lastNavigationTime = now;
    }
    if (this.activePointers.size === 0) {
      this.isNavigating = false;
    }
  }

  onPointerCancel(e) {
    this.cancelLongPress();
    if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);
    if (this.isMousePanning) {
      this.isMousePanning = false;
      this.viewportCanvas.style.cursor = this.isSpaceDown ? 'grab' : 'crosshair';
    }
    this.activePointers.delete(e.pointerId);
    this.cancelStroke();
    this.lastNavigationTime = performance.now();
    if (this.activePointers.size === 0) {
      this.isNavigating = false;
    }
  }

  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  triggerEyedropper(wx, wy, sx, sy) {
    this.onHaptic?.();
    this.cancelStroke();
    this.toolManager.eyedropper.show(sx, sy, this.currentColor);
    const picked = this.toolManager.eyedropper.sample(wx, wy, sx, sy, this.layerManager);
    this.currentColor = picked;
    this.onColorPicked?.(picked);
  }

  triggerShapeAssist() {
    if (!this.currentStroke || this.currentStroke.points.length < 5) return;
    const pts = this.currentStroke.points;
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const totalDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

    let maxPerpDist = 0;
    for (const p of pts) {
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const d = Math.abs(dy * p.x - dx * p.y + pEnd.x * pStart.y - pEnd.y * pStart.x) / Math.max(1, totalDist);
      maxPerpDist = Math.max(maxPerpDist, d);
    }

    this.onHaptic?.();
    if (maxPerpDist < 18) {
      this.currentStroke.points = [
        { ...pStart, pressure: 0.8 },
        { ...pEnd, pressure: 0.8 }
      ];
      this.shapeHoldDetected = true;
      this.renderLiveStroke();
    }
  }

  startStroke(e) {
    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer) return;

    this.isDrawing = true;
    this.activePointerId = e.pointerId;
    this.shapeHoldDetected = false;
    this.lastStampRadius = null;

    // Snapshot layer canvas before stroke for deterministic raster undo
    this.beforeStrokeCanvas = cloneCanvas(activeLayer.canvas);

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    this.pressureEngine.reset();
    const pressure = this.pressureEngine.resolvePressure(e, snapped, this.currentBrush, this.globalSpeedFactor);
    this.stabilizer.reset();

    const stabilized = this.stabilizer.begin({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    const isEraser = this.toolManager.activeTool === 'eraser' || (this.currentBrush && this.currentBrush.isEraser);
    const strokeSeed = Math.floor(Math.random() * 0xffffff);

    const brushSnapshot = (this.currentBrush && typeof this.currentBrush.createSnapshot === 'function')
      ? this.currentBrush.createSnapshot()
      : (this.currentBrush ? JSON.parse(JSON.stringify(this.currentBrush)) : {});

    this.currentStroke = {
      id: 'stroke_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      brushId: this.currentBrush?.id || 'pencil',
      brushSnapshot: brushSnapshot,
      color: isEraser ? '#000000' : this.currentColor,
      isEraser: isEraser,
      seed: strokeSeed,
      points: [stabilized]
    };

    if (isEraser) {
      this.renderStrokeToLayer(activeLayer, this.currentStroke);
      this.layerManager.invalidateCaches();
    } else {
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.renderLiveStroke();
    }
  }

  appendStrokePoint(e) {
    if (!this.isDrawing || !this.currentStroke) return;

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    // Stop emission when finger is still unless brush has build-up enabled
    const pts = this.currentStroke.points;
    if (pts.length > 0) {
      const lastPt = pts[pts.length - 1];
      const distFromLast = Math.hypot(snapped.x - lastPt.x, snapped.y - lastPt.y);
      const isBuildUp = !!(this.currentBrush?.buildUp || this.currentBrush?.isAirbrushBuildUp);
      if (distFromLast < 1.8 && !isBuildUp) {
        return;
      }
    }

    const pressure = this.pressureEngine.resolvePressure(e, snapped, this.currentBrush, this.globalSpeedFactor);
    const stabilized = this.stabilizer.update({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    if (stabilized) {
      this.currentStroke.points.push(stabilized);
      if (this.currentStroke.isEraser) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (activeLayer && !activeLayer.locked && this.beforeStrokeCanvas) {
          activeLayer.ctx.clearRect(0, 0, activeLayer.width, activeLayer.height);
          activeLayer.ctx.drawImage(this.beforeStrokeCanvas, 0, 0);
          this.renderStrokeToLayer(activeLayer, this.currentStroke);
          this.layerManager.invalidateCaches();
        }
      } else {
        this.renderLiveStroke();
      }
    }
  }

  getStrokeBoundingBox(stroke, docWidth, docHeight) {
    if (!stroke || !stroke.points || stroke.points.length === 0) {
      return null;
    }
    const brushSize = stroke.brushSnapshot?.size || 30;
    const padding = Math.max(24, Math.ceil(brushSize * 2.5));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const x = Math.max(0, Math.floor(minX - padding));
    const y = Math.max(0, Math.floor(minY - padding));
    const right = Math.min(docWidth, Math.ceil(maxX + padding));
    const bottom = Math.min(docHeight, Math.ceil(maxY + padding));
    const width = Math.max(1, right - x);
    const height = Math.max(1, bottom - y);
    return { x, y, width, height };
  }

  showToast(msg) {
    if (window.AndroidBridge?.showToast) {
      window.AndroidBridge.showToast(msg);
    } else {
      console.warn('[Vectura Toast]', msg);
    }
  }

  finishStroke() {
    if (!this.isDrawing || !this.currentStroke) return;
    this.isDrawing = false;
    this.activePointerId = null;

    try {
      const catchUp = this.stabilizer.finish();
      if (catchUp && catchUp.length > 0) {
        for (const pt of catchUp) {
          this.currentStroke.points.push(pt);
        }
      }

      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer && !activeLayer.locked) {
        if (!this.currentStroke.isEraser) {
          this.renderStrokeToLayer(activeLayer, this.currentStroke);
        }
        const bbox = this.getStrokeBoundingBox(this.currentStroke, this.docWidth, this.docHeight);
        const beforeSnapshot = cropBoundingBox(this.beforeStrokeCanvas, bbox);
        const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);

        if (this.history) {
          const cmd = new StrokeCommand(
            activeLayer,
            this.currentStroke,
            (l) => {
              this.layerManager.invalidateCaches();
            },
            beforeSnapshot,
            afterSnapshot
          );
          this.history.push(cmd);
        }
      }
    } catch (strokeErr) {
      console.error('finishStroke error:', strokeErr);
      this.showToast('Stroke error: ' + (strokeErr.message || 'failed'));
    } finally {
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.currentStroke = null;
      this.beforeStrokeCanvas = null;
      this.lastStampRadius = null;
      this.layerManager.invalidateCaches();
    }
  }

  cancelStroke() {
    if (this.isDrawing) {
      if (this.currentStroke?.isEraser) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (activeLayer && this.beforeStrokeCanvas) {
          activeLayer.ctx.clearRect(0, 0, activeLayer.width, activeLayer.height);
          activeLayer.ctx.drawImage(this.beforeStrokeCanvas, 0, 0);
          activeLayer.updateThumbnail();
        }
      }
      this.isDrawing = false;
      this.activePointerId = null;
      this.currentStroke = null;
      this.beforeStrokeCanvas = null;
      this.lastStampRadius = null;
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.layerManager.invalidateCaches();
    }
    if (this.toolManager.lassoFill?.active) {
      this.toolManager.lassoFill.cancel();
    }
    if (this.toolManager.shapeTool?.active) {
      this.toolManager.shapeTool.cancel();
    }
    if (this.toolManager.gradientTool?.active) {
      this.toolManager.gradientTool.cancel();
    }
  }

  cancelAllActiveTools() {
    this.cancelLongPress();
    this.cancelStroke();
    this.isDraggingSymmetry = false;
    if (this.toolManager.smudgeTool) {
      this.toolManager.smudgeTool.active = false;
    }
    if (this.toolManager.lassoFill) {
      this.toolManager.lassoFill.cancel();
      this.toolManager.lassoFill.active = false;
      this.toolManager.lassoFill.points = [];
    }
    if (this.toolManager.shapeTool) {
      this.toolManager.shapeTool.cancel();
      this.toolManager.shapeTool.active = false;
    }
    if (this.toolManager.gradientTool) {
      this.toolManager.gradientTool.cancel();
      this.toolManager.gradientTool.active = false;
    }
    if (this.toolManager.selectionTool && !this.toolManager.selectionTool.hasSelection) {
      this.toolManager.selectionTool.active = false;
    }
    this.needsRender = true;
  }

  renderLiveStroke() {
    if (!this.currentStroke) return;
    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);

    const pts = this.currentStroke.points;
    if (this.toolManager.symmetry.mode !== 'off' && pts.length > 0) {
      const symmInstances = this.toolManager.symmetry.radialAxes || 4;
      const count = this.toolManager.symmetry.mode === 'radial' ? symmInstances : 2;
      for (let s = 0; s < count; s++) {
        const mirroredPts = pts.map(p => this.toolManager.symmetry.getSymmetricPoints(p)[s] || p);
        this.renderStrokeToContext(this.liveCtx, { ...this.currentStroke, points: mirroredPts });
      }
    } else {
      this.renderStrokeToContext(this.liveCtx, this.currentStroke);
    }
  }

  renderStrokeToLayer(layer, stroke) {
    if (this.toolManager.symmetry.mode !== 'off' && stroke.points.length > 0) {
      const count = this.toolManager.symmetry.mode === 'radial' ? this.toolManager.symmetry.radialAxes : 2;
      for (let s = 0; s < count; s++) {
        const mirroredPts = stroke.points.map(p => this.toolManager.symmetry.getSymmetricPoints(p)[s] || p);
        const clonedStroke = { ...stroke, points: mirroredPts };
        this.renderStrokeToContext(layer.ctx, clonedStroke);
        layer.addStroke(clonedStroke);
      }
    } else {
      this.renderStrokeToContext(layer.ctx, stroke);
      layer.addStroke(stroke);
    }
    layer.updateThumbnail();
  }

  /**
   * Stamping and Ribbon Stroke Render Engine with Ink-Bleed Safeguards & Advanced Spacing/Jitter
   */
  renderStrokeToContext(ctx, stroke) {
    const b = stroke.brushSnapshot || {};
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.save();

    const activeLayer = this.layerManager.getActiveLayer();
    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else if (activeLayer && ctx === activeLayer.ctx && activeLayer.alphaLock) {
      ctx.globalCompositeOperation = 'source-atop';
    } else {
      ctx.globalCompositeOperation = b.blendMode || 'source-over';
    }

    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;

    // Pixel Art Mode: 1px / integer grid
    if (this.pixelArtMode || b.isPixel || b.spacingSettings?.pixelArtMode) {
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const pixels = bresenhamPixelPerfect(
          Math.round(pts[i].x),
          Math.round(pts[i].y),
          Math.round(pts[i + 1].x),
          Math.round(pts[i + 1].y)
        );
        for (const px of pixels) {
          ctx.fillRect(px.x, px.y, b.size || 1, b.size || 1);
        }
      }
      ctx.restore();
      return;
    }

    // Spacing calculation
    const baseSize = Math.max(1, Number.isFinite(b.size) ? b.size : 8);
    const sp = b.spacingSettings || {};
    const spacingRatio = Math.max(0.01, Math.min(2.0, sp.spacing ?? b.spacing ?? 0.08));
    let stepPx = Math.max(sp.minSpacingPx || 0.8, baseSize * spacingRatio);

    // Auto-spacing mode: keep strokes smooth at all sizes
    if (sp.autoSpacing) {
      stepPx = Math.max(1.0, Math.min(12.0, baseSize * 0.12));
    }

    const samples = this.spline.sampleStroke(pts, stepPx);
    if (samples.length === 0) {
      ctx.restore();
      return;
    }

    const baseOpacity = Math.max(0.01, Math.min(1.0, Number.isFinite(b.opacity) ? b.opacity : 1.0));
    const strokeSeed = stroke.seed || 1337;
    const totalLength = samples[samples.length - 1].distance || 1;

    // INK BLEED & SIZE SAFEGUARDS:
    const brushMinRadius = Math.max(0.25, (b.minSize || 1) / 2);
    const brushMaxRadius = Math.max(brushMinRadius + 0.5, (b.maxSize || 200) / 2);
    let lastRadius = null;

    // Single-stroke opacity capping: when !buildUp, render into stroke buffer
    // so repeated passes or lingering within the SAME stroke never exceed baseOpacity
    const useStrokeBuffer = (!b.buildUp && baseOpacity < 0.98 && this.strokeCtx);
    const targetCtx = useStrokeBuffer ? this.strokeCtx : ctx;

    if (useStrokeBuffer) {
      this.strokeCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      this.strokeCtx.save();
      this.strokeCtx.fillStyle = stroke.color;
      this.strokeCtx.strokeStyle = stroke.color;
    }

    // Factor Links Matrix from brush
    const fl = b.factorLinks || {};
    const vLinks = fl.velocity || {};
    const jLinks = fl.jitter || {};
    const nLinks = fl.noise || {};

    // Render individual stamp segments
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;

      let pressure = Number.isFinite(s.pressure) ? s.pressure : 0.5;
      pressure = Math.max(0.01, Math.min(1.0, pressure));

      let radius = (baseSize * pressure) / 2;

      // Taper at start and end
      if (b.taperStart > 0 && i < b.taperStart) {
        radius *= Math.max(0.05, (i + 1) / b.taperStart);
      }
      if (b.taperEnd > 0 && i > samples.length - b.taperEnd) {
        radius *= Math.max(0.05, (samples.length - i) / b.taperEnd);
      }

      // 1. Evaluate Factors: velocity, jitter, noise (smoothed limits)
      const vFactor = Math.min(1.5, Math.max(-1.0, (pressure - 0.5) * 2.0));
      const jFactor = ((Math.sin(strokeSeed + i * 1337.7) * 43758.5453) % 1.0);
      const rawNoise = CoherentNoise.computeNoiseSample(b.jitter || { enabled: true }, strokeSeed, s.distance, s.time || 0);
      const nFactor = Math.max(-1.0, Math.min(1.0, rawNoise * 0.2)); // Reduced 2D noise limit to prevent jitter explosion

      // 2. Modulate Children (Size, Rotation, Spacing, Opacity, Tip Rotation)
      // Child: Size
      let sizeMod = 1.0;
      if (vLinks.size) sizeMod += (vLinks.size / 100) * vFactor;
      if (jLinks.size) sizeMod += (jLinks.size / 100) * jFactor * 0.4;
      if (nLinks.size) sizeMod += (nLinks.size / 100) * nFactor * 0.2;
      radius = radius * Math.max(0.05, sizeMod);

      // Child: Opacity
      let stampAlpha = useStrokeBuffer ? (b.flow ?? 1.0) : (baseOpacity * (b.flow ?? 1.0));
      let alphaMod = 0;
      if (vLinks.opacity) alphaMod += (vLinks.opacity / 100) * vFactor;
      if (jLinks.opacity) alphaMod += (jLinks.opacity / 100) * jFactor * 0.4;
      if (nLinks.opacity) alphaMod += (nLinks.opacity / 100) * nFactor * 0.2;
      stampAlpha = Math.max(0.01, Math.min(1.0, stampAlpha * (1.0 + alphaMod)));

      // Child: Rotation & Tip Rotation
      let stampRotation = b.rotation || 0;
      let rotMod = 0;
      if (vLinks.rotation) rotMod += (vLinks.rotation / 100) * vFactor * Math.PI;
      if (jLinks.rotation) rotMod += (jLinks.rotation / 100) * jFactor * Math.PI;
      if (nLinks.rotation) rotMod += (nLinks.rotation / 100) * nFactor * 0.3 * Math.PI;
      if (vLinks.tipRotation) rotMod += (vLinks.tipRotation / 100) * vFactor * Math.PI;
      if (jLinks.tipRotation) rotMod += (jLinks.tipRotation / 100) * jFactor * Math.PI;
      if (nLinks.tipRotation) rotMod += (nLinks.tipRotation / 100) * nFactor * 0.3 * Math.PI;
      stampRotation += rotMod;

      let stampX = s.x;
      let stampY = s.y;

      if (b.jitter && b.jitter.enabled) {
        const jTargets = CoherentNoise.evaluateAllTargets(
          b.jitter,
          strokeSeed,
          s.distance,
          s.time,
          s.speed || 0,
          totalLength
        );
        radius = Math.max(0.25, radius * (1.0 + jTargets.sizeDelta));
        stampX += jTargets.wobbleX;
        stampY += jTargets.wobbleY;
        stampRotation += jTargets.angleDelta;
        stampAlpha = Math.max(0.01, Math.min(1.0, stampAlpha + jTargets.opacityDelta));
      }

      if (!Number.isFinite(radius)) radius = baseSize / 2;

      // RATE LIMITER: limit how much size can change between two consecutive stamps
      if (lastRadius !== null) {
        const maxDelta = Math.max(1.5, lastRadius * 0.25);
        radius = Math.max(lastRadius - maxDelta, Math.min(lastRadius + maxDelta, radius));
      }

      // HARD CLAMP: strictly enforce brush.minSize and brush.maxSize bounds
      radius = Math.max(brushMinRadius, Math.min(brushMaxRadius, radius));
      lastRadius = radius;

      targetCtx.globalAlpha = Math.max(0.01, Math.min(1.0, stampAlpha));

      // Custom Stamp Shapes, Aspect Ratio, and Hardness
      targetCtx.save();
      targetCtx.translate(stampX, stampY);
      if (stampRotation !== 0) targetCtx.rotate(stampRotation);
      if (b.aspectRatio && b.aspectRatio !== 1.0) {
        targetCtx.scale(1.0, 1.0 / Math.max(0.1, b.aspectRatio));
      }

      if (b.tipShape === 'square') {
        targetCtx.fillRect(-radius, -radius, radius * 2, radius * 2);
      } else if (b.tipShape === 'chisel') {
        targetCtx.fillRect(-radius * 1.8, -radius * 0.4, radius * 3.6, radius * 0.8);
      } else if (b.tipShape === 'star') {
        targetCtx.beginPath();
        for (let sp = 0; sp < 10; sp++) {
          const a = (sp * Math.PI) / 5 - Math.PI / 2;
          const rad = sp % 2 === 0 ? radius : radius * 0.45;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (sp === 0) targetCtx.moveTo(px, py);
          else targetCtx.lineTo(px, py);
        }
        targetCtx.closePath();
        targetCtx.fill();
      } else if (b.tipShape === 'bristle') {
        for (let br = -2; br <= 2; br++) {
          targetCtx.beginPath();
          targetCtx.arc(br * (radius * 0.35), 0, Math.max(0.4, radius * 0.25), 0, Math.PI * 2);
          targetCtx.fill();
        }
      } else if (b.tipShape === 'soft' || b.tipShape === 'gaussian' || (b.hardness !== undefined && b.hardness < 0.6)) {
        const rad = Math.max(1, radius);
        const grad = targetCtx.createRadialGradient(0, 0, rad * Math.max(0.05, b.hardness ?? 0.3), 0, 0, rad);
        grad.addColorStop(0, stroke.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        targetCtx.fillStyle = grad;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, rad, 0, Math.PI * 2);
        targetCtx.fill();
      } else {
        targetCtx.beginPath();
        targetCtx.arc(0, 0, Math.max(0.5, radius), 0, Math.PI * 2);
        targetCtx.fill();
      }
      targetCtx.restore();
    }

    if (useStrokeBuffer) {
      this.strokeCtx.restore();
      ctx.globalAlpha = baseOpacity;
      ctx.drawImage(this.strokeCanvas, 0, 0);
    }

    ctx.restore();
  }

  redrawLayerStrokes(layer) {
    layer.ctx.clearRect(0, 0, layer.width, layer.height);
    for (const s of layer.strokes) {
      if (s.points) {
        this.renderStrokeToContext(layer.ctx, s);
      }
    }
    layer.updateThumbnail();
    this.layerManager.invalidateCaches();
  }

  /**
   * iPad-style expanding circular ripple fill animation.
   * Expands smoothly (ease-out, ~300-500 ms) clipped strictly to the filled region.
   * Input is NOT blocked. Committed as one undoable step with RasterCommand.
   */
  commitFillWithAnimation(info) {
    const { startX, startY, maxRadius, patchCanvas, activeLayer, animate, duration, bbox } = info;
    this.onHaptic?.();

    const beforeSnapshot = cropBoundingBox(activeLayer.canvas, bbox);

    const commitToHistory = () => {
      try {
        const afterSnapshot = cropBoundingBox(activeLayer.canvas, bbox);
        if (this.history) {
          this.history.push(new RasterCommand('Fill Bucket', activeLayer, beforeSnapshot, afterSnapshot, () => {
            this.layerManager.invalidateCaches();
          }));
        }
      } catch (err) {
        console.error('Fill commit error:', err);
        this.showToast('Fill commit failed: ' + (err.message || 'error'));
      }
    };

    if (!animate) {
      activeLayer.ctx.drawImage(patchCanvas, 0, 0);
      activeLayer.updateThumbnail();
      this.layerManager.invalidateCaches();
      commitToHistory();
      return;
    }

    const startTime = performance.now();
    const animDuration = Math.max(200, Math.min(800, duration || 380));

    const animCanvas = document.createElement('canvas');
    animCanvas.width = this.docWidth;
    animCanvas.height = this.docHeight;
    const animCtx = animCanvas.getContext('2d');

    const animEntry = {
      render: (targetCtx) => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1.0, elapsed / animDuration);
        const ease = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
        const currentR = maxRadius * ease;

        animCtx.clearRect(0, 0, this.docWidth, this.docHeight);
        animCtx.save();
        animCtx.beginPath();
        animCtx.arc(startX, startY, currentR, 0, Math.PI * 2);
        animCtx.clip();
        animCtx.drawImage(patchCanvas, 0, 0);
        animCtx.restore();

        targetCtx.drawImage(animCanvas, 0, 0);
        return progress < 1.0;
      }
    };

    this.activeFillAnimations.push(animEntry);

    const checkFinish = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= animDuration) {
        const idx = this.activeFillAnimations.indexOf(animEntry);
        if (idx >= 0) this.activeFillAnimations.splice(idx, 1);

        activeLayer.ctx.drawImage(patchCanvas, 0, 0);
        activeLayer.updateThumbnail();
        this.layerManager.invalidateCaches();
        commitToHistory();
      } else {
        requestAnimationFrame(checkFinish);
      }
    };
    requestAnimationFrame(checkFinish);
  }

  /**
   * 60 FPS Viewport Render Loop
   */
  renderLoop() {
    if (!this.running) return;

    try {
      const w = this.viewportCanvas.clientWidth || window.innerWidth || 800;
      const h = this.viewportCanvas.clientHeight || window.innerHeight || 600;
      if (this.viewportCanvas.width !== w || this.viewportCanvas.height !== h) {
        this.viewportCanvas.width = w;
        this.viewportCanvas.height = h;
        this.viewport.resizeScreen(w, h);
      }

      if (!this.initialFitDone && w > 80 && h > 80) {
        this.viewport.fitToScreen();
        this.initialFitDone = true;
      }

      const ctx = this.ctx;
      // 1. Workspace background (calm surround tone #D9D9DB)
      ctx.fillStyle = '#D9D9DB';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      this.viewport.applyTransform(ctx);

      // 2. Artwork background (white paper)
      ctx.fillStyle = this.layerManager.isTransparentBg ? '#FFFFFF' : (this.layerManager.backgroundColor || '#FFFFFF');
      ctx.fillRect(0, 0, this.docWidth, this.docHeight);

      // 3. 1px artwork outline
      ctx.strokeStyle = '#B8B8BC';
      ctx.lineWidth = Math.max(1, 1 / this.viewport.zoom);
      ctx.strokeRect(0, 0, this.docWidth, this.docHeight);

      // Composite layers with live buffer
      this.layerManager.compositeStack(ctx, this.liveCanvas, 1.0, 'source-over');

      // Render active fill animations
      if (this.activeFillAnimations.length > 0) {
        for (const anim of this.activeFillAnimations) {
          anim.render(ctx);
        }
      }

      // Ruler Guides overlay
      if (this.toolManager.rulerGuides.mode !== 'off') {
        this.toolManager.rulerGuides.drawGuides(ctx, this.docWidth, this.docHeight, this.viewport.zoom);
      }

      // Selection marching ants overlay
      if (this.toolManager.selectionTool.hasSelection || this.toolManager.selectionTool.active) {
        this.toolManager.selectionTool.drawMarchingAnts(ctx, this.viewport.zoom);
      }

      // Transform interactive overlay
      if (this.toolManager.transformTool.active) {
        this.toolManager.transformTool.drawOverlay(ctx, this.viewport.zoom);
      }

      // Symmetry overlay
      if (this.toolManager.symmetry.mode !== 'off') {
        this.toolManager.symmetry.render(ctx, this.docWidth, this.docHeight, this.viewport.zoom);
      }

      // Tool live overlays
      try {
        if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
          this.toolManager.lassoFill.renderOverlay(ctx, this.currentColor);
        } else if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
          this.toolManager.shapeTool.renderOverlay(ctx, this.currentColor, this.currentBrush?.size || 4);
        } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
          this.toolManager.gradientTool.renderOverlay(ctx, this.currentColor, '#ffffff');
        }
      } catch (overlayErr) {
        // Overlay failure should never crash the engine
      }

      ctx.restore();
    } catch (err) {
      console.warn('Error in renderLoop:', err);
    } finally {
      requestAnimationFrame(this.renderLoop);
    }
  }
}

/* --- IndexedDBStorage.js --- */
/**
 * Vectura IndexedDB Storage Engine
 * Persistent storage for artwork metadata and binary layer Blobs.
 * Resolves only on transaction completion, with no localStorage fallback.
 */
class IndexedDBStorage {
  constructor(dbName = 'VecturaDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.memoryProjects = new Map();
  }

  async open() {
    if (this.db) return this.db;

    const idb = typeof window !== 'undefined' ? window.indexedDB : (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!idb) {
      console.error('IndexedDB not supported');
      return null;
    }

    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 3000);

      try {
        const req = idb.open(this.dbName, this.version);

        req.onupgradeneeded = (e) => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('projects')) {
              db.createObjectStore('projects', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('autosave')) {
              db.createObjectStore('autosave', { keyPath: 'id' });
            }
          } catch (err) {
            console.error('IDB upgrade error:', err);
          }
        };

        req.onsuccess = (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            this.db = e.target.result;
            resolve(this.db);
          }
        };

        req.onerror = (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            console.error('IDB open error:', req.error || e);
            resolve(null);
          }
        };

        req.onblocked = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            console.warn('IDB open blocked');
            resolve(null);
          }
        };
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          console.error('IDB open exception:', err);
          resolve(null);
        }
      }
    });
  }

  async saveProject(projectData) {
    if (!projectData) return false;
    this.memoryProjects.set(projectData.id, projectData);

    try {
      const db = await this.open();
      if (!db) return false;

      return await new Promise((resolve) => {
        try {
          const tx = db.transaction('projects', 'readwrite');
          const store = tx.objectStore('projects');
          store.put(projectData);

          // Resolve save ONLY on tx.oncomplete
          tx.oncomplete = () => {
            resolve(true);
          };
          tx.onerror = (e) => {
            console.error('saveProject tx error:', tx.error || e);
            resolve(false);
          };
          tx.onabort = () => {
            console.error('saveProject tx aborted');
            resolve(false);
          };
        } catch (err) {
          console.error('saveProject error:', err);
          resolve(false);
        }
      });
    } catch (err) {
      console.error('Failed to save project:', err);
      return false;
    }
  }

  async getProject(id) {
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || this.memoryProjects.get(id) || null);
            req.onerror = () => resolve(this.memoryProjects.get(id) || null);
          } catch (_) {
            resolve(this.memoryProjects.get(id) || null);
          }
        });
      }
    } catch (_) {}

    return this.memoryProjects.get(id) || null;
  }

  async getAllProjects() {
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const req = store.getAll();
            req.onsuccess = () => {
              const res = req.result || [];
              if (res.length > 0) {
                res.forEach(p => this.memoryProjects.set(p.id, p));
                resolve(res);
              } else {
                resolve(Array.from(this.memoryProjects.values()));
              }
            };
            req.onerror = () => resolve(Array.from(this.memoryProjects.values()));
          } catch (_) {
            resolve(Array.from(this.memoryProjects.values()));
          }
        });
      }
    } catch (_) {}

    return Array.from(this.memoryProjects.values());
  }

  async deleteProject(id) {
    this.memoryProjects.delete(id);
    try {
      const db = await this.open();
      if (db) {
        return await new Promise((resolve) => {
          try {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            store.delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
          } catch (_) {
            resolve(false);
          }
        });
      }
    } catch (_) {}
    return true;
  }
}

/* --- Exporter.js --- */
/**
 * Vectura Exporter Engine
 * PNG (transparent/opaque), JPEG, WebP, True Vector SVG, Timelapse Replay, and Web Share API.
 */


class Exporter {
  constructor(vectorCanvas) {
    this.vectorCanvas = vectorCanvas;
    this.spline = new CatmullRomSpline(0.5);
  }

  /**
   * Exports document composite as a raster Blob (PNG, JPEG, WebP).
   * Optional scale parameter renders at larger resolution (capped so longest side <= 4096).
   */
  async exportRaster(format = 'image/png', quality = 0.92, transparent = false, scale = 1) {
    const vc = this.vectorCanvas;
    let targetW = Math.round(vc.docWidth * Math.max(0.1, scale));
    let targetH = Math.round(vc.docHeight * Math.max(0.1, scale));

    // Cap so the longest side <= 4096
    const maxDim = Math.max(targetW, targetH);
    if (maxDim > 4096) {
      const factor = 4096 / maxDim;
      targetW = Math.max(1, Math.round(targetW * factor));
      targetH = Math.max(1, Math.round(targetH * factor));
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;
    const ctx = exportCanvas.getContext('2d');

    if (scale !== 1 || targetW !== vc.docWidth || targetH !== vc.docHeight) {
      ctx.scale(targetW / vc.docWidth, targetH / vc.docHeight);
    }

    vc.layerManager.compositeToCanvas(ctx, !transparent);

    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => resolve(blob), format, quality);
    });
  }

  /**
   * Generates a Data URL for raster export.
   */
  exportDataUrl(format = 'image/png', quality = 0.92, transparent = false) {
    const vc = this.vectorCanvas;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = vc.docWidth;
    exportCanvas.height = vc.docHeight;
    const ctx = exportCanvas.getContext('2d');

    vc.layerManager.compositeToCanvas(ctx, !transparent);
    return exportCanvas.toDataURL(format, quality);
  }

  /**
   * Generates a True Vector SVG document string from all vector strokes.
   */
  exportSVG(transparent = false) {
    const vc = this.vectorCanvas;
    const w = vc.docWidth;
    const h = vc.docHeight;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;

    // Background rect
    if (!transparent && !vc.layerManager.isTransparentBg && vc.layerManager.backgroundColor) {
      svg += `  <rect width="${w}" height="${h}" fill="${vc.layerManager.backgroundColor}" />\n`;
    }

    // Export each layer in stack order
    for (const layer of vc.layerManager.layers) {
      if (!layer.visible) continue;
      svg += `  <g id="${layer.id}" opacity="${layer.opacity}">\n`;

      for (const stroke of layer.strokes) {
        if (stroke.shapeType) {
          // Export basic vector shape
          if (stroke.shapeType === 'line') {
            svg += `    <line x1="${stroke.x0}" y1="${stroke.y0}" x2="${stroke.x1}" y2="${stroke.y1}" stroke="${stroke.color}" stroke-width="${stroke.strokeWidth}" stroke-linecap="round" />\n`;
          } else if (stroke.shapeType === 'rect') {
            const rx = Math.min(stroke.x0, stroke.x1);
            const ry = Math.min(stroke.y0, stroke.y1);
            const rw = Math.abs(stroke.x1 - stroke.x0);
            const rh = Math.abs(stroke.y1 - stroke.y0);
            svg += `    <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${stroke.fill ? stroke.color : 'none'}" stroke="${stroke.color}" stroke-width="${stroke.strokeWidth}" />\n`;
          } else if (stroke.shapeType === 'ellipse') {
            const cx = (stroke.x0 + stroke.x1) / 2;
            const cy = (stroke.y0 + stroke.y1) / 2;
            const rx = Math.abs(stroke.x1 - stroke.x0) / 2;
            const ry = Math.abs(stroke.y1 - stroke.y0) / 2;
            svg += `    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${stroke.fill ? stroke.color : 'none'}" stroke="${stroke.color}" stroke-width="${stroke.strokeWidth}" />\n`;
          }
        } else if (stroke.points && stroke.points.length > 0) {
          // Sample spline points
          const samples = this.spline.sampleStroke(stroke.points, 6);
          if (samples.length > 1) {
            let pathD = `M ${samples[0].x.toFixed(2)} ${samples[0].y.toFixed(2)}`;
            for (let i = 1; i < samples.length; i++) {
              pathD += ` L ${samples[i].x.toFixed(2)} ${samples[i].y.toFixed(2)}`;
            }
            const strokeWidth = stroke.brushSnapshot?.size || 4;
            svg += `    <path d="${pathD}" fill="none" stroke="${stroke.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.brushSnapshot?.opacity ?? 1}" />\n`;
          }
        }
      }

      svg += `  </g>\n`;
    }

    svg += `</svg>`;
    return svg;
  }

  /**
   * Converts a Blob, File, or DataURL to raw Base64 string.
   */
  async blobOrDataUrlToBase64(data) {
    if (typeof data === 'string') {
      return data.includes(',') ? data.substring(data.indexOf(',') + 1) : data;
    }
    if (data instanceof Blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result;
          const b64 = typeof res === 'string' && res.includes(',') ? res.substring(res.indexOf(',') + 1) : res;
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }
    return '';
  }

  /**
   * Triggers native Android export/share in chunks or web download.
   */
  async shareOrDownload(dataUrlOrBlob, filename, mimeType) {
    // 1. AndroidBridge: stream chunks of ~512KB base64
    if (window.AndroidBridge && (window.AndroidBridge.beginFile || window.AndroidBridge.shareFile)) {
      try {
        const b64 = await this.blobOrDataUrlToBase64(dataUrlOrBlob);
        if (window.AndroidBridge.beginFile && window.AndroidBridge.appendChunk && window.AndroidBridge.finishFile) {
          window.AndroidBridge.beginFile(filename, mimeType);
          const chunkSize = 512 * 1024; // 512KB chunk
          for (let i = 0; i < b64.length; i += chunkSize) {
            window.AndroidBridge.appendChunk(b64.slice(i, i + chunkSize));
          }
          window.AndroidBridge.finishFile(filename, mimeType);
          return;
        } else if (window.AndroidBridge.shareFile) {
          window.AndroidBridge.shareFile(b64, mimeType, filename);
          return;
        }
      } catch (err) {
        console.error('AndroidBridge chunked export failed:', err);
        window.AndroidBridge.showToast?.('Export failed: ' + err.message);
      }
    }

    // 2. Web Share API fallback for modern mobile browsers
    if (navigator.canShare && navigator.share && dataUrlOrBlob instanceof Blob) {
      try {
        const file = new File([dataUrlOrBlob], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: filename,
            files: [file]
          });
          return;
        }
      } catch (e) {
        // Fallback to link download
      }
    }

    // 3. Fallback: standard file download trigger
    const link = document.createElement('a');
    link.download = filename;
    if (typeof dataUrlOrBlob === 'string') {
      link.href = dataUrlOrBlob;
    } else {
      link.href = URL.createObjectURL(dataUrlOrBlob);
    }
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      if (typeof dataUrlOrBlob !== 'string') URL.revokeObjectURL(link.href);
    }, 1000);
  }
}

/* --- ProjectManager.js --- */
/**
 * Vectura Project Model & Presets
 */
const CANVAS_PRESETS = [
  { id: 'square_1080', name: 'Square (1080x1080)', width: 1080, height: 1080, dpi: 72 },
  { id: 'fhd_landscape', name: '1080p Landscape (1920x1080)', width: 1920, height: 1080, dpi: 72 },
  { id: 'fhd_portrait', name: 'Story / Portrait (1080x1920)', width: 1080, height: 1920, dpi: 72 },
  { id: 'uhd_4k', name: '4K Ultra HD (3840x2160)', width: 3840, height: 2160, dpi: 150 },
  { id: 'a4_print', name: 'A4 Print (2480x3508 @ 300DPI)', width: 2480, height: 3508, dpi: 300 },
  { id: 'insta_post', name: 'Social Post (1200x1200)', width: 1200, height: 1200, dpi: 72 },
  { id: 'pixel_16', name: 'Pixel Art (16x16)', width: 16, height: 16, pixelMode: true },
  { id: 'pixel_32', name: 'Pixel Art (32x32)', width: 32, height: 32, pixelMode: true },
  { id: 'pixel_64', name: 'Pixel Art (64x64)', width: 64, height: 64, pixelMode: true },
  { id: 'pixel_128', name: 'Pixel Art (128x128)', width: 128, height: 128, pixelMode: true }
];

class ProjectManager {
  static createNewProject(config = {}) {
    return {
      id: 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      name: config.name || 'Untitled Artwork',
      width: config.width || 1080,
      height: config.height || 1080,
      dpi: config.dpi || 72,
      backgroundColor: config.backgroundColor ?? '#ffffff',
      isTransparentBg: !!config.isTransparentBg,
      pixelArtMode: !!config.pixelArtMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layers: []
    };
  }

  /**
   * Estimates memory consumption in Megabytes and warns if high for mobile.
   */
  static estimateMemoryMB(width, height, numLayers = 3) {
    // Each RGBA pixel is 4 bytes. Offscreen canvases + layer caches:
    // (width * height * 4 bytes) * (numLayers + 3 caches)
    const bytesPerLayer = width * height * 4;
    const totalBytes = bytesPerLayer * (numLayers + 4);
    return Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
  }
}

/* --- i18n.js --- */
/**
 * Vectura Unified i18n Localization String Dictionary
 * All user-facing strings live in this centralized dictionary.
 */
const i18n = {
  app_name: 'Vectura',
  tagline: 'Vector Drawing Studio',

  // Top Bar & View
  undo: 'Undo',
  redo: 'Redo',
  fit_screen: 'Fit to Screen',
  zoom_100: '100% Zoom',
  mirror_view: 'Mirror View',
  hide_ui: 'Hide UI',
  show_ui: 'Show UI',
  export: 'Export',
  home: 'Gallery',
  settings: 'Settings',

  // Toolbar Tools
  brush: 'Brush',
  eraser: 'Eraser',
  fill_bucket: 'Fill Bucket',
  lasso_fill: 'Lasso Fill',
  selection: 'Selection',
  transform: 'Transform',
  vector_edit: 'Vector Point Edit',
  shape: 'Shapes',
  gradient: 'Gradient',
  text: 'Text',
  color: 'Color',
  layers: 'Layers',
  ruler: 'Ruler & Guides',
  symmetry: 'Symmetry',

  // Layers
  new_layer: 'New Layer',
  duplicate_layer: 'Duplicate Layer',
  delete_layer: 'Delete Layer',
  clear_layer: 'Clear Layer',
  merge_down: 'Merge Down',
  merge_visible: 'Merge Visible',
  clipping_mask: 'Clipping Mask',
  alpha_lock: 'Alpha Lock',
  reference_layer: 'Reference Layer',
  opacity: 'Opacity',
  blend_mode: 'Blend Mode',
  visibility: 'Visibility',
  lock_layer: 'Lock Layer',

  // Brushes
  brush_library: 'Brush Library',
  brush_editor: 'Brush Editor',
  size: 'Size',
  flow: 'Flow',
  hardness: 'Hardness',
  spacing: 'Spacing',
  stabilizer: 'Stabilizer',
  pressure_curve: 'Pressure Curve',
  jitter: 'Smooth Jitter',
  coherent_noise: 'Coherent 1D Noise',
  taper: 'Taper Length',

  // Color Picker
  color_picker: 'Color Picker',
  hex: 'HEX',
  rgb: 'RGB',
  harmonies: 'Color Harmonies',
  recent_colors: 'Recent Colors',

  // Home & Projects
  new_project: 'New Artwork',
  presets: 'Canvas Presets',
  width: 'Width',
  height: 'Height',
  dpi: 'DPI',
  background: 'Background',
  pixel_art_mode: 'Pixel Art Mode',
  create: 'Create Canvas',
  cancel: 'Cancel',
  confirm: 'Confirm',
  delete_project_confirm: 'Are you sure you want to delete this project?',
  memory_warning: 'Warning: This canvas size will consume approx. {mb} MB of memory.',

  // Settings
  theme_dark: 'Dark Theme',
  theme_light: 'Light Theme',
  left_handed: 'Left-Handed Mode',
  gestures_enabled: '2-Finger Undo / 3-Finger Redo',
  palm_rejection: 'Stylus Palm Rejection',
  haptics: 'Haptic Feedback',
  perf_mode: 'Performance Mode (Reduced Blur)'
};

/* --- ColorPicker.js --- */
/**
 * Vectura Color Picker
 * Clean, dense, professional color studio.
 * Tabs: Disc, Classic, Sliders, Palettes.
 */
class ColorPicker {
  constructor(containerEl, onChange, onEyedropper = null) {
    this.container = containerEl;
    this.onChange = onChange;
    this.onEyedropper = onEyedropper;

    this.activeTab = 'disc'; // 'disc' | 'classic' | 'sliders' | 'palettes'
    this.sliderMode = 'rgb'; // 'rgb' | 'hsl' | 'cmyk'

    this.hue = 220; // 0 to 360
    this.sat = 0.73; // 0 to 1
    this.val = 0.86; // 0 to 1

    this.previousColor = '#FFFFFF';
    this.currentColor = '#3B6EDC';
    this.recentColors = ['#3B6EDC', '#1B1B1D', '#FFFFFF', '#C2362F', '#10B981', '#F59E0B', '#8B5CF6', '#5C5C61'];

    this.render();
  }

  getHex() {
    return this.currentColor;
  }

  setColorHex(hex, isPrevious = false) {
    if (!hex || typeof hex !== 'string') return;
    const clean = hex.startsWith('#') ? hex : '#' + hex;
    const rgb = this.hexToRgb(clean);
    if (!rgb) return;

    if (isPrevious) {
      this.previousColor = clean;
    }
    this.currentColor = clean;

    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.hue = hsv.h;
    this.sat = hsv.s;
    this.val = hsv.v;

    this.updateUI();
  }

  addRecentColor(hex) {
    if (!hex) return;
    const clean = hex.startsWith('#') ? hex.toUpperCase() : '#' + hex.toUpperCase();
    const idx = this.recentColors.indexOf(clean);
    if (idx >= 0) this.recentColors.splice(idx, 1);
    this.recentColors.unshift(clean);
    if (this.recentColors.length > 8) this.recentColors.pop();
    this.renderRecentPalette();
  }

  setTab(tab) {
    this.activeTab = tab;
    // Sync tab buttons in header
    ['disc', 'classic', 'sliders', 'palettes'].forEach(t => {
      const el = document.getElementById(`cp-tab-${t}`);
      if (el) el.classList.toggle('active', t === tab);
    });
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
        <!-- Swatch Bar: Current (32x32) next to Previous (32x32), HEX input -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--divider);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="color-current-previous">
              <div id="cp-swatch-curr" class="swatch-32" style="background: ${this.currentColor};" title="Current colour"></div>
              <div id="cp-swatch-prev" class="swatch-32" style="background: ${this.previousColor}; cursor: pointer;" title="Previous colour (tap to restore)"></div>
            </div>
            <input type="text" id="cp-hex-input" class="tabular" style="width: 86px; height: 32px; font-size: var(--text-secondary); text-transform: uppercase;" value="${this.currentColor.toUpperCase()}" />
          </div>

          ${this.onEyedropper ? `
            <button id="cp-btn-eyedropper" class="btn-icon" title="Eyedropper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2l4 4L7 17H3v-4L14 2z"/><line x1="16" y1="4" x2="20" y2="8"/></svg>
            </button>
          ` : ''}
        </div>

        <!-- Tab Body -->
        <div id="cp-tab-body" style="flex: 1; display: flex; flex-direction: column;">
          ${this.renderActiveTabContent()}
        </div>

        <!-- Palette Strip at bottom of every tab: 8 recent swatches (24x24, 4px radius, 1px border) -->
        <div>
          <div class="section-header" style="margin-top: 4px; margin-bottom: 6px;">Recent swatches</div>
          <div id="cp-palette-strip" class="palette-strip">
            ${this.recentColors.slice(0, 8).map(c => `
              <div class="palette-swatch-item" data-color="${c}" style="background: ${c};" title="${c}"></div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
    this.setupTabEvents();
  }

  renderActiveTabContent() {
    if (this.activeTab === 'disc') {
      return `
        <div class="color-picker-wheel-wrap">
          <div style="position: relative; width: 200px; height: 200px;">
            <canvas id="cp-disc-canvas" width="200" height="200" style="display: block; width: 100%; height: 100%; border-radius: 50%; cursor: crosshair;"></canvas>
            <div id="cp-disc-cursor" style="position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #FFFFFF; box-shadow: 0 0 2px #000000; pointer-events: none; transform: translate(-50%, -50%);"></div>
          </div>
        </div>
      `;
    } else if (this.activeTab === 'classic') {
      return `
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 0;">
          <div style="position: relative; width: 100%; height: 140px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; cursor: crosshair;">
            <canvas id="cp-classic-canvas" width="280" height="140" style="width: 100%; height: 100%; display: block;"></canvas>
            <div id="cp-classic-cursor" style="position: absolute; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #FFFFFF; box-shadow: 0 0 2px #000000; pointer-events: none; transform: translate(-50%, -50%);"></div>
          </div>

          <div style="position: relative; width: 100%; height: 24px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; cursor: pointer;">
            <canvas id="cp-hue-bar" width="280" height="24" style="width: 100%; height: 100%; display: block;"></canvas>
            <div id="cp-hue-cursor" style="position: absolute; top: 0; bottom: 0; width: 6px; border: 1.5px solid #FFFFFF; border-radius: 2px; box-shadow: 0 0 2px #000000; pointer-events: none; transform: translateX(-50%);"></div>
          </div>
        </div>
      `;
    } else if (this.activeTab === 'sliders') {
      return `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Slider Mode Switcher -->
          <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            <button class="btn-text cp-smode-btn ${this.sliderMode === 'rgb' ? 'accent' : ''}" data-mode="rgb" style="flex: 1; min-height: 28px; font-size: var(--text-secondary); padding: 2px 6px;">RGB</button>
            <button class="btn-text cp-smode-btn ${this.sliderMode === 'hsl' ? 'accent' : ''}" data-mode="hsl" style="flex: 1; min-height: 28px; font-size: var(--text-secondary); padding: 2px 6px;">HSL</button>
            <button class="btn-text cp-smode-btn ${this.sliderMode === 'cmyk' ? 'accent' : ''}" data-mode="cmyk" style="flex: 1; min-height: 28px; font-size: var(--text-secondary); padding: 2px 6px;">CMYK</button>
          </div>
          <div class="color-sliders-list">
            ${this.renderSlidersList()}
          </div>
        </div>
      `;
    } else {
      // Palettes Tab
      return `
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 0;">
          <span style="font-size: var(--text-secondary); color: var(--text-2);">Studio Harmonies</span>
          <div id="cp-harmonies-row" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;">
            ${this.getHarmonies(this.currentColor).map(h => `
              <div class="palette-swatch-item" data-color="${h}" style="background: ${h}; width: 100%; height: 36px;" title="${h}"></div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  renderSlidersList() {
    const rgb = this.hexToRgb(this.currentColor) || { r: 59, g: 110, b: 220 };
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const cmyk = this.rgbToCmyk(rgb.r, rgb.g, rgb.b);

    if (this.sliderMode === 'rgb') {
      return `
        ${this.sliderRow('R', 'rgb-r', rgb.r, 0, 255, `linear-gradient(to right, rgb(0, ${rgb.g}, ${rgb.b}), rgb(255, ${rgb.g}, ${rgb.b}))`)}
        ${this.sliderRow('G', 'rgb-g', rgb.g, 0, 255, `linear-gradient(to right, rgb(${rgb.r}, 0, ${rgb.b}), rgb(${rgb.r}, 255, ${rgb.b}))`)}
        ${this.sliderRow('B', 'rgb-b', rgb.b, 0, 255, `linear-gradient(to right, rgb(${rgb.r}, ${rgb.g}, 0), rgb(${rgb.r}, ${rgb.g}, 255))`)}
      `;
    } else if (this.sliderMode === 'hsl') {
      return `
        ${this.sliderRow('H', 'hsl-h', Math.round(hsl.h), 0, 360, `linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`)}
        ${this.sliderRow('S', 'hsl-s', Math.round(hsl.s * 100), 0, 100, `linear-gradient(to right, #808080, hsl(${hsl.h}, 100%, ${hsl.l * 100}%))`)}
        ${this.sliderRow('L', 'hsl-l', Math.round(hsl.l * 100), 0, 100, `linear-gradient(to right, #000, hsl(${hsl.h}, ${hsl.s * 100}%, 50%), #fff)`)}
      `;
    } else {
      // CMYK
      return `
        ${this.sliderRow('C', 'cmyk-c', Math.round(cmyk.c * 100), 0, 100, `linear-gradient(to right, #fff, #0ff)`)}
        ${this.sliderRow('M', 'cmyk-m', Math.round(cmyk.m * 100), 0, 100, `linear-gradient(to right, #fff, #f0f)`)}
        ${this.sliderRow('Y', 'cmyk-y', Math.round(cmyk.y * 100), 0, 100, `linear-gradient(to right, #fff, #ff0)`)}
        ${this.sliderRow('K', 'cmyk-k', Math.round(cmyk.k * 100), 0, 100, `linear-gradient(to right, #fff, #000)`)}
      `;
    }
  }

  sliderRow(label, channelId, value, min, max, trackGradient) {
    return `
      <div class="color-slider-row">
        <span style="font-size: var(--text-secondary); font-weight: 500; color: var(--text-2);">${label}</span>
        <div class="color-slider-track" style="background: ${trackGradient}; border-radius: var(--radius-xs); border: 1px solid var(--border); padding: 0 4px;">
          <input type="range" class="dense-slider cp-channel-slider" data-ch="${channelId}" min="${min}" max="${max}" value="${value}">
        </div>
        <input type="number" class="tabular cp-channel-num" data-ch="${channelId}" min="${min}" max="${max}" value="${value}" style="width: 40px; height: 28px; font-size: var(--text-secondary); text-align: right; padding: 2px 4px;">
      </div>
    `;
  }

  setupEvents() {
    // Previous color tap to restore
    this.container.querySelector('#cp-swatch-prev')?.addEventListener('click', () => {
      this.setColorHex(this.previousColor);
      this.onChange?.(this.currentColor);
    });

    // HEX input
    const hexInput = this.container.querySelector('#cp-hex-input');
    if (hexInput) {
      hexInput.addEventListener('change', (e) => {
        let v = e.target.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
          this.setColorHex(v);
          this.onChange?.(this.currentColor);
        }
      });
    }

    // Eyedropper button
    this.container.querySelector('#cp-btn-eyedropper')?.addEventListener('click', () => {
      this.onEyedropper?.();
    });

    // Recent swatches click
    this.container.querySelectorAll('.palette-swatch-item').forEach(el => {
      el.addEventListener('click', () => {
        const col = el.dataset.color;
        if (col) {
          this.setColorHex(col);
          this.onChange?.(this.currentColor);
        }
      });
    });

    // Slider mode switcher
    this.container.querySelectorAll('.cp-smode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sliderMode = btn.dataset.mode;
        this.render();
      });
    });
  }

  setupTabEvents() {
    if (this.activeTab === 'disc') {
      this.initDiscCanvas();
    } else if (this.activeTab === 'classic') {
      this.initClassicCanvas();
    } else if (this.activeTab === 'sliders') {
      this.initSlidersEvents();
    }
  }

  initDiscCanvas() {
    const canvas = this.container.querySelector('#cp-disc-canvas');
    const cursor = this.container.querySelector('#cp-disc-cursor');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 2;

    if (!ColorPicker._cachedDiscCanvas || ColorPicker._cachedDiscCanvas.width !== size) {
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const offCtx = off.getContext('2d');
      const imgData = offCtx.createImageData(size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - center;
          const dy = y - center;
          const dist = Math.hypot(dx, dy);
          const idx = (y * size + x) * 4;
          if (dist <= radius) {
            const angle = Math.atan2(dy, dx);
            const hue = ((angle * 180 / Math.PI) + 360) % 360;
            const sat = Math.min(1, dist / radius);
            const rgb = this.hsvToRgb(hue, sat, 1.0);
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = 255;
          } else {
            data[idx + 3] = 0;
          }
        }
      }
      offCtx.putImageData(imgData, 0, 0);

      // Border ring
      offCtx.strokeStyle = '#B8B8BC';
      offCtx.lineWidth = 1;
      offCtx.beginPath();
      offCtx.arc(center, center, radius, 0, Math.PI * 2);
      offCtx.stroke();

      ColorPicker._cachedDiscCanvas = off;
    }

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(ColorPicker._cachedDiscCanvas, 0, 0);

    let rafId = null;
    const updateFromPointer = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const dx = px - (rect.width / 2);
        const dy = py - (rect.height / 2);
        const dist = Math.hypot(dx, dy);
        const maxR = rect.width / 2;

        const angle = Math.atan2(dy, dx);
        this.hue = ((angle * 180 / Math.PI) + 360) % 360;
        this.sat = Math.min(1, dist / maxR);
        this.val = 1.0;

        const rgb = this.hsvToRgb(this.hue, this.sat, this.val);
        this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

        if (cursor) {
          cursor.style.left = `${px}px`;
          cursor.style.top = `${py}px`;
        }
        this.updateAffordances();
        this.onChange?.(this.currentColor);
      });
    };

    let isDown = false;
    canvas.addEventListener('pointerdown', (e) => {
      isDown = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      updateFromPointer(e);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (isDown) updateFromPointer(e);
    });
    canvas.addEventListener('pointerup', () => { isDown = false; });
  }

  initClassicCanvas() {
    const svCanvas = this.container.querySelector('#cp-classic-canvas');
    const hueCanvas = this.container.querySelector('#cp-hue-bar');
    if (!svCanvas || !hueCanvas) return;

    this.drawClassicSV(svCanvas);
    this.drawHueBar(hueCanvas);

    const updateSV = (e) => {
      const rect = svCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      this.sat = x / rect.width;
      this.val = 1.0 - (y / rect.height);

      const rgb = this.hsvToRgb(this.hue, this.sat, this.val);
      this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

      const cursor = this.container.querySelector('#cp-classic-cursor');
      if (cursor) {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      }
      this.updateAffordances();
      this.onChange?.(this.currentColor);
    };

    let isDownSV = false;
    svCanvas.addEventListener('pointerdown', (e) => {
      isDownSV = true;
      try { svCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      updateSV(e);
    });
    svCanvas.addEventListener('pointermove', (e) => {
      if (isDownSV) updateSV(e);
    });
    svCanvas.addEventListener('pointerup', () => { isDownSV = false; });

    const updateHue = (e) => {
      const rect = hueCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      this.hue = (x / rect.width) * 360;

      this.drawClassicSV(svCanvas);
      const rgb = this.hsvToRgb(this.hue, this.sat, this.val);
      this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);

      const cursor = this.container.querySelector('#cp-hue-cursor');
      if (cursor) {
        cursor.style.left = `${x}px`;
      }
      this.updateAffordances();
      this.onChange?.(this.currentColor);
    };

    let isDownHue = false;
    hueCanvas.addEventListener('pointerdown', (e) => {
      isDownHue = true;
      try { hueCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      updateHue(e);
    });
    hueCanvas.addEventListener('pointermove', (e) => {
      if (isDownHue) updateHue(e);
    });
    hueCanvas.addEventListener('pointerup', () => { isDownHue = false; });
  }

  drawClassicSV(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const baseRgb = this.hsvToRgb(this.hue, 1, 1);
    ctx.fillStyle = `rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`;
    ctx.fillRect(0, 0, w, h);

    // White horizontal gradient
    const gradWhite = ctx.createLinearGradient(0, 0, w, 0);
    gradWhite.addColorStop(0, '#FFFFFF');
    gradWhite.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradWhite;
    ctx.fillRect(0, 0, w, h);

    // Black vertical gradient
    const gradBlack = ctx.createLinearGradient(0, 0, 0, h);
    gradBlack.addColorStop(0, 'rgba(0,0,0,0)');
    gradBlack.addColorStop(1, '#000000');
    ctx.fillStyle = gradBlack;
    ctx.fillRect(0, 0, w, h);
  }

  drawHueBar(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#f00');
    grad.addColorStop(0.17, '#ff0');
    grad.addColorStop(0.33, '#0f0');
    grad.addColorStop(0.5, '#0ff');
    grad.addColorStop(0.67, '#00f');
    grad.addColorStop(0.83, '#f0f');
    grad.addColorStop(1, '#f00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  initSlidersEvents() {
    this.container.querySelectorAll('.cp-channel-slider, .cp-channel-num').forEach(el => {
      el.addEventListener('input', (e) => {
        const ch = el.dataset.ch;
        const val = parseFloat(e.target.value);
        this.handleSliderChannelChange(ch, val);
      });
    });
  }

  handleSliderChannelChange(ch, val) {
    const rgb = this.hexToRgb(this.currentColor) || { r: 59, g: 110, b: 220 };
    if (ch === 'rgb-r') rgb.r = Math.round(val);
    if (ch === 'rgb-g') rgb.g = Math.round(val);
    if (ch === 'rgb-b') rgb.b = Math.round(val);

    this.currentColor = this.rgbToHex(rgb.r, rgb.g, rgb.b);
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.hue = hsv.h;
    this.sat = hsv.s;
    this.val = hsv.v;

    this.updateAffordances();
    this.onChange?.(this.currentColor);
  }

  updateAffordances() {
    const swatch = this.container.querySelector('#cp-swatch-curr');
    if (swatch) swatch.style.background = this.currentColor;
    const hexInput = this.container.querySelector('#cp-hex-input');
    if (hexInput) hexInput.value = this.currentColor.toUpperCase();

    // Toolbar swatch
    const barPrimary = document.getElementById('swatch-primary');
    if (barPrimary) barPrimary.style.background = this.currentColor;
  }

  updateUI() {
    this.updateAffordances();
    if (this.activeTab === 'sliders') {
      const list = this.container.querySelector('.color-sliders-list');
      if (list) list.innerHTML = this.renderSlidersList();
      this.initSlidersEvents();
    }
  }

  getHarmonies(hex) {
    const rgb = this.hexToRgb(hex) || { r: 59, g: 110, b: 220 };
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    return [
      hex,
      this.hsvToHex((hsv.h + 30) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 60) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 180) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 210) % 360, hsv.s, hsv.v),
      this.hsvToHex((hsv.h + 240) % 360, hsv.s, hsv.v)
    ];
  }

  /* Math & Conversion Helpers */
  hexToRgb(hex) {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return res ? {
      r: parseInt(res[1], 16),
      g: parseInt(res[2], 16),
      b: parseInt(res[3], 16)
    } : null;
  }

  rgbToHex(r, g, b) {
    const toHex = c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (max !== min) {
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, v };
  }

  hsvToHex(h, s, v) {
    const rgb = this.hsvToRgb(h, s, v);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  rgbToCmyk(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };
    const c = (1 - r - k) / (1 - k);
    const m = (1 - g - k) / (1 - k);
    const y = (1 - b - k) / (1 - k);
    return { c, m, y, k };
  }
}

/* --- LayerPanel.js --- */
/**
 * Vectura Layer Panel UI
 * Clean, modern, professional layers management.
 * Reworked with layer opacity slider, blend mode, alpha lock, clipping mask,
 * live thumbnails, rename, duplicate, merge down, clear, and delete.
 */



class LayerPanel {
  constructor(containerEl, layerManager, onLayerChanged, history = null) {
    this.container = containerEl;
    this.layerManager = layerManager;
    this.onLayerChanged = onLayerChanged;
    this.history = history;

    this.render();
  }

  setHistory(history) {
    this.history = history;
  }

  executeLayerOp(name, action, includePixels = false) {
    const lm = this.layerManager;
    let beforeState = null;
    let afterState = null;
    try {
      beforeState = lm.createSnapshot(includePixels);
    } catch (e) {
      console.warn('createSnapshot beforeState failed:', e);
    }

    try {
      action();
    } catch (e) {
      console.error('action failed in executeLayerOp:', e);
    }

    try {
      afterState = lm.createSnapshot(includePixels);
    } catch (e) {
      console.warn('createSnapshot afterState failed:', e);
    }

    if (this.history && beforeState && afterState) {
      this.history.push(new LayerCommand(name, lm, beforeState, afterState, () => {
        this.render();
        this.onLayerChanged?.();
      }));
    }

    this.render();
    try {
      this.onLayerChanged?.();
    } catch (err) {
      console.warn('onLayerChanged error caught:', err);
    }
  }

  render() {
    const lm = this.layerManager;
    const active = lm.getActiveLayer();
    const activeIdx = lm.activeLayerIndex;

    const blendOptions = BLEND_MODES.map(
      m => `<option value="${m.id}" ${active && active.blendMode === m.id ? 'selected' : ''}>${m.name}</option>`
    ).join('');

    const activeOpacityPct = active ? Math.round(active.opacity * 100) : 100;

    // Reverse layers so top of stack is at the top of the list
    const layerRows = [...lm.layers].reverse().map((layer, reverseIdx) => {
      const realIdx = lm.layers.length - 1 - reverseIdx;
      const isSelected = realIdx === activeIdx;
      const opacityPct = Math.round(layer.opacity * 100);

      return `
        <div class="layers-row-item ${isSelected ? 'selected' : ''} ${layer.clippingMask ? 'clipped' : ''} ${!layer.visible ? 'hidden-layer' : ''}" data-idx="${realIdx}" style="padding-left: ${layer.clippingMask ? '22px' : '8px'}; opacity: ${layer.visible ? '1' : '0.45'}; transition: background-color 150ms ease, opacity 150ms ease;">
          ${layer.clippingMask ? `
            <span style="font-size: 14px; color: var(--accent, #6366f1); margin-right: -4px;" title="Clipped to layer below">↳</span>
          ` : ''}
          <!-- Visibility Eye -->
          <button class="btn-icon lp-vis-btn" data-idx="${realIdx}" title="${layer.visible ? 'Hide layer' : 'Show layer'}">
            ${layer.visible ? `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ` : `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            `}
          </button>

          <!-- Thumbnail -->
          <div class="layer-thumb-container">
            <canvas class="lp-thumb-canvas" data-idx="${realIdx}" width="40" height="40" style="width: 100%; height: 100%; display: block; border-radius: 4px;"></canvas>
          </div>

          <!-- Info & Name -->
          <div class="layer-info-col" data-idx="${realIdx}">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="layer-title-text" style="font-weight: ${isSelected ? '600' : '400'}; color: ${isSelected ? 'var(--accent, #6366f1)' : 'var(--text)'};">${layer.name}</span>
              ${isSelected ? `<span class="layer-active-badge">ACTIVE</span>` : ''}
              ${layer.clippingMask ? `<span style="font-size: 9px; font-weight: 600; background: rgba(99,102,241,0.2); color: var(--accent, #6366f1); padding: 1px 4px; border-radius: 3px;">CLIP</span>` : ''}
              ${layer.alphaLock ? `<span style="font-size: 9px; font-weight: 600; background: rgba(245,158,11,0.2); color: #f59e0b; padding: 1px 4px; border-radius: 3px;">ALPHA</span>` : ''}
              ${layer.locked ? `<span style="font-size: 9px; font-weight: 600; background: rgba(239,68,68,0.2); color: #ef4444; padding: 1px 4px; border-radius: 3px;">LOCKED</span>` : ''}
            </div>
            <span class="layer-sub-text tabular">${BLEND_MODES.find(m => m.id === layer.blendMode)?.name || 'Normal'} · ${opacityPct}%</span>
          </div>

          <!-- Actions: Rename, Move Up/Down, Lock -->
          <div style="display: flex; align-items: center; gap: 2px;">
            <button class="btn-icon lp-rename-btn" data-idx="${realIdx}" title="Rename layer" style="width: 28px; height: 28px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn-icon lp-move-up-btn" data-idx="${realIdx}" title="Move up" style="width: 28px; height: 28px;" ${realIdx === lm.layers.length - 1 ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="btn-icon lp-move-down-btn" data-idx="${realIdx}" title="Move down" style="width: 28px; height: 28px;" ${realIdx === 0 ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="btn-icon lp-lock-btn" data-idx="${realIdx}" title="${layer.locked ? 'Unlock' : 'Lock'}" style="width: 30px; height: 30px;">
              ${layer.locked ? `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              ` : `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              `}
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <!-- Selected Layer Settings Block -->
      <div class="layers-top-block" style="padding: 10px 14px; background: var(--panel); border-bottom: 1px solid var(--divider); flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 13px; font-weight: 500; color: var(--text);">Opacity</span>
          <span id="lp-opacity-label" class="tabular" style="font-size: 12px; color: var(--text-2); font-weight: 500;">${activeOpacityPct}%</span>
        </div>
        <input type="range" class="dense-slider" id="lp-opacity-slider" min="0" max="100" value="${activeOpacityPct}" style="width: 100%; margin-bottom: 8px;">

        <div style="display: flex; gap: 8px; align-items: center;">
          <select id="lp-blend-select" style="flex: 1; height: 32px; background: var(--control); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; color: var(--text); padding: 0 8px;">
            ${blendOptions}
          </select>
          <button id="lp-btn-alpha-lock" class="btn-text ${active?.alphaLock ? 'accent' : ''}" style="height: 32px; font-size: 11px; padding: 0 10px;">
            Alpha lock
          </button>
          <button id="lp-btn-clipping-mask" class="btn-text ${active?.clippingMask ? 'accent' : ''}" style="height: 32px; font-size: 11px; padding: 0 10px;">
            Clip
          </button>
        </div>
      </div>

      <!-- Layers List Stack -->
      <div id="lp-rows-list" style="flex: 1; overflow-y: auto; max-height: 280px; -webkit-overflow-scrolling: touch;">
        ${layerRows}
      </div>

      <!-- Action Footer -->
      <div class="layers-footer" style="display: flex; justify-content: space-around; align-items: center; padding: 6px 12px; border-top: 1px solid var(--divider); background: var(--panel); flex-shrink: 0;">
        <button id="lp-btn-add" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" title="New layer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add
        </button>
        <button id="lp-btn-dup" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" title="Duplicate layer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Duplicate
        </button>
        <button id="lp-btn-merge" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" ${activeIdx <= 0 ? 'disabled' : ''} title="Merge down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14"/><polyline points="7 12 12 17 17 12"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
          Merge
        </button>
        <button id="lp-btn-clear" class="btn-text" style="font-size: 12px; height: 32px; padding: 0 10px;" title="Clear layer content">
          Clear
        </button>
        <button id="lp-btn-del" class="btn-text danger" style="font-size: 12px; height: 32px; padding: 0 10px; gap: 4px;" ${lm.layers.length <= 1 ? 'disabled' : ''} title="Delete layer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    this.drawThumbnails();
    this.setupEvents();
  }

  drawThumbnails() {
    const lm = this.layerManager;
    this.container.querySelectorAll('.lp-thumb-canvas').forEach(canvas => {
      const idx = parseInt(canvas.dataset.idx, 10);
      const layer = lm.layers[idx];
      if (!layer) return;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 40, 40);

      // Checkerboard background for transparency
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 40, 40);
      ctx.fillStyle = '#E8E8EA';
      ctx.fillRect(0, 0, 20, 20);
      ctx.fillRect(20, 20, 20, 20);

      // Draw layer thumbnail scaled preserving aspect ratio
      const maxDim = 40;
      const lw = layer.width || 1;
      const lh = layer.height || 1;
      const scale = Math.min(maxDim / lw, maxDim / lh);
      const dw = Math.max(1, Math.round(lw * scale));
      const dh = Math.max(1, Math.round(lh * scale));
      const dx = Math.round((maxDim - dw) / 2);
      const dy = Math.round((maxDim - dh) / 2);

      if (layer.thumbCanvas) {
        ctx.drawImage(layer.thumbCanvas, 0, 0, layer.thumbCanvas.width, layer.thumbCanvas.height, dx, dy, dw, dh);
      } else {
        ctx.drawImage(layer.canvas, 0, 0, lw, lh, dx, dy, dw, dh);
      }
    });
  }

  setupEvents() {
    const lm = this.layerManager;

    // Layer Selection: Tap anywhere on the row (except buttons) to select
    this.container.querySelectorAll('.layers-row-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select')) return;
        const idx = parseInt(row.dataset.idx, 10);
        if (isNaN(idx)) return;
        if (idx !== lm.activeLayerIndex) {
          lm.setActiveLayer(lm.layers[idx].id);
          lm.invalidateCaches();
          this.render();
          this.onLayerChanged?.();
        }
      });
    });

    // Rename Layer (smooth inline input or rename button)
    this.container.querySelectorAll('.lp-rename-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const layer = lm.layers[idx];
        if (!layer) return;
        const row = this.container.querySelector(`.layers-row-item[data-idx="${idx}"]`);
        const titleSpan = row ? row.querySelector('.layer-title-text') : null;
        if (!titleSpan) return;
        const currentName = layer.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'layer-inline-rename-input';
        input.style.cssText = 'height: 24px; font-size: 13px; font-weight: 500; padding: 0 6px; border-radius: 4px; border: 1px solid var(--accent); background: var(--control); color: var(--text); width: 120px;';
        titleSpan.replaceWith(input);
        input.focus();
        input.select();

        let committed = false;
        const commit = () => {
          if (committed) return;
          committed = true;
          const val = input.value.trim() || currentName;
          this.executeLayerOp('Rename Layer', () => {
            layer.name = val;
          });
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            input.blur();
          } else if (ev.key === 'Escape') {
            input.value = currentName;
            input.blur();
          }
        });
      });
    });

    // Visibility Toggle
    this.container.querySelectorAll('.lp-vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const layer = lm.layers[idx];
        if (layer) {
          this.executeLayerOp('Toggle Visibility', () => {
            layer.visible = !layer.visible;
          });
        }
      });
    });

    // Lock Toggle
    this.container.querySelectorAll('.lp-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        const layer = lm.layers[idx];
        if (layer) {
          this.executeLayerOp('Toggle Lock', () => {
            layer.locked = !layer.locked;
          });
        }
      });
    });

    // Move Up
    this.container.querySelectorAll('.lp-move-up-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx < lm.layers.length - 1) {
          this.executeLayerOp('Move Layer Up', () => {
            lm.reorder(idx, idx + 1);
          });
        }
      });
    });

    // Move Down
    this.container.querySelectorAll('.lp-move-down-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (idx > 0) {
          this.executeLayerOp('Move Layer Down', () => {
            lm.reorder(idx, idx - 1);
          });
        }
      });
    });

    // Opacity Slider
    const opacitySlider = this.container.querySelector('#lp-opacity-slider');
    const opacityLabel = this.container.querySelector('#lp-opacity-label');
    opacitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (opacityLabel) opacityLabel.textContent = `${val}%`;
      const active = lm.getActiveLayer();
      if (active) {
        active.opacity = val / 100;
        lm.invalidateCaches();
        this.onLayerChanged?.();
      }
    });

    opacitySlider?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Change Opacity', () => {
          active.opacity = val / 100;
        });
      }
    });

    // Blend Mode Select
    this.container.querySelector('#lp-blend-select')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Change Blend Mode', () => {
          active.blendMode = val;
        });
      }
    });

    // Alpha Lock Button
    this.container.querySelector('#lp-btn-alpha-lock')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Toggle Alpha Lock', () => {
          active.alphaLock = !active.alphaLock;
        });
      }
    });

    // Clipping Mask Button
    this.container.querySelector('#lp-btn-clipping-mask')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Toggle Clipping Mask', () => {
          active.clippingMask = !active.clippingMask;
        });
      }
    });

    // Add Layer
    this.container.querySelector('#lp-btn-add')?.addEventListener('click', () => {
      this.executeLayerOp('Add Layer', () => {
        lm.addLayer(`Layer ${lm.layers.length + 1}`);
      });
      setTimeout(() => {
        const selected = this.container.querySelector('.layers-row-item.selected');
        selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 50);
    });

    // Duplicate Layer
    this.container.querySelector('#lp-btn-dup')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Duplicate Layer', () => {
          lm.duplicateLayer(active.id);
        }, true);
      }
    });

    // Merge Down
    this.container.querySelector('#lp-btn-merge')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Merge Layer Down', () => {
          lm.mergeDown(active.id);
        }, true);
      }
    });

    // Clear Layer Content
    this.container.querySelector('#lp-btn-clear')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Clear Layer', () => {
          active.ctx.clearRect(0, 0, active.width, active.height);
          active.updateThumbnail();
        }, true);
      }
    });

    // Delete Layer
    this.container.querySelector('#lp-btn-del')?.addEventListener('click', () => {
      if (lm.layers.length <= 1) return;
      const active = lm.getActiveLayer();
      if (active) {
        this.executeLayerOp('Delete Layer', () => {
          lm.deleteLayer(active.id);
        }, true);
      }
    });
  }
}

/* --- BrushPanel.js --- */
/**
 * Vectura Brush Panel & Studio
 * Clean, dense, professional brush library and settings.
 * Two sub-views: Library and Settings.
 */



class BrushPanel {
  constructor(containerEl, currentBrush, onBrushChanged, currentColor = '#3B6EDC') {
    this.container = containerEl;
    this.currentBrush = currentBrush || new Brush(DEFAULT_BRUSH_PRESETS[0]);
    this.onBrushChanged = onBrushChanged;
    this.currentColor = currentColor;

    this.viewMode = 'library'; // 'library' | 'settings'
    this.activePack = 'ink';
    this.activeFactorTab = 'velocity'; // 'velocity' | 'jitter' | 'noise'

    // Available packs
    this.packs = [
      { id: 'ink', name: 'Inking' },
      { id: 'paint', name: 'Painting' },
      { id: 'texture', name: 'Texture' },
      { id: 'eraser', name: 'Eraser' },
      { id: 'pixel', name: 'Pixel' }
    ];

    this.brushes = DEFAULT_BRUSH_PRESETS.map(p => new Brush(p));
    this.render();
  }

  get activeTab() {
    return this.viewMode === 'settings' ? 'settings' : 'library';
  }

  set activeTab(tab) {
    this.viewMode = (tab === 'settings' || tab === 'editor') ? 'settings' : 'library';
    this.syncTabs();
    this.render();
  }

  syncTabs() {
    const tabLib = document.getElementById('bp-tab-library');
    const tabSet = document.getElementById('bp-tab-settings');
    if (tabLib && tabSet) {
      tabLib.classList.toggle('active', this.viewMode === 'library');
      tabSet.classList.toggle('active', this.viewMode === 'settings');
    }
  }

  setColor(color) {
    this.currentColor = color;
    if (this.viewMode === 'library') {
      this.drawLibraryPreviews();
    } else {
      this.drawSettingsStrokePreview();
    }
  }

  setBrush(brush) {
    this.currentBrush = brush;
    this.render();
  }

  render() {
    this.syncTabs();

    if (this.viewMode === 'library') {
      this.renderLibrary();
    } else {
      this.renderSettings();
    }
  }

  renderLibrary() {
    const packRail = this.packs.map(p => `
      <button class="brush-pack-btn ${this.activePack === p.id ? 'selected' : ''}" data-pack="${p.id}">
        ${p.name}
      </button>
    `).join('');

    const filtered = this.brushes.filter(b => b.category === this.activePack);
    const brushRows = filtered.map(b => {
      const isSelected = this.currentBrush && this.currentBrush.id === b.id;
      return `
        <div class="brush-row-item ${isSelected ? 'selected' : ''}" data-id="${b.id}">
          <canvas class="brush-stroke-thumb" data-id="${b.id}" width="40" height="28"></canvas>
          <span class="brush-name-label">${b.name}</span>
          <span class="brush-size-range tabular">${b.size}px</span>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="brush-library-container">
        <div class="brush-pack-rail">
          ${packRail}
        </div>
        <div class="brush-list-col">
          ${brushRows}
        </div>
      </div>
    `;

    // Events
    this.container.querySelectorAll('.brush-pack-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activePack = btn.dataset.pack;
        this.render();
      });
    });

    this.container.querySelectorAll('.brush-row-item').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const found = this.brushes.find(b => b.id === id);
        if (found) {
          this.currentBrush = found;
          this.onBrushChanged?.(this.currentBrush);
          this.render();
        }
      });
    });

    this.drawLibraryPreviews();
  }

  renderSettings() {
    const b = this.currentBrush;
    if (!b) {
      this.container.innerHTML = `<div style="padding: 16px; color: var(--text-2);">No brush selected</div>`;
      return;
    }

    if (!b.factorLinks) {
      b.factorLinks = {
        velocity: { size: Math.round(b.velocityDynamics?.factor ?? 0), opacity: 0, rotation: 0, spacing: 0 },
        jitter: { size: Math.round(b.jitter?.size ?? 0), opacity: 0, rotation: 0, spacing: 0 },
        noise: { size: 0, opacity: 0, rotation: 0, spacing: 0 }
      };
    }

    const curFactor = this.activeFactorTab || 'velocity';
    const factorObj = b.factorLinks[curFactor] || { size: 0, opacity: 0, rotation: 0, spacing: 0 };
    const minFactorVal = curFactor === 'velocity' ? -100 : 0;

    const spacingVal = Math.round((b.spacing || 0.1) * 100);
    const stabilizerVal = Math.round(b.stabilizerStrength || 35);
    const grainVal = Math.round((b.grain || 0.3) * 100);
    const hardnessVal = Math.round((b.hardness ?? 0.8) * 100);
    const roundnessVal = Math.round((b.roundness ?? 1.0) * 100);
    const opacityVal = Math.round((b.opacity ?? 1.0) * 100);

    this.container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <!-- 1. LIVE STROKE PREVIEW (STICKY HEADER) -->
        <div class="brush-settings-preview-wrap" style="position: sticky; top: 0; z-index: 10; background: var(--panel); padding: 10px 16px; border-bottom: 1px solid var(--divider); flex-shrink: 0;">
          <canvas id="brush-live-stroke-preview" width="320" height="64" style="width: 100%; height: 64px; border-radius: 8px; display: block;"></canvas>
          <div class="brush-preview-meta" style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--text-2);">
            <span class="brush-preview-title" style="font-weight: 600; color: var(--text);">${b.name}</span>
            <span class="brush-preview-size tabular" id="bs-preview-size-label">${b.size || 12}px (min ${b.minSize || 1}px – max ${b.maxSize || 200}px)</span>
          </div>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 12px 16px;">
          <!-- 2. SHAPE & TIP PRESETS -->
          <div class="section-header">Brush Tip & Shape</div>
          <div class="settings-dense-group">
            <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
              ${['round', 'square', 'chisel', 'star', 'bristle', 'soft'].map(ts => `
                <button class="dense-btn tip-shape-btn ${b.tipShape === ts ? 'active' : ''}" data-tip="${ts}" style="flex: 1; min-width: 44px; padding: 6px 4px; font-size: 11px; text-transform: capitalize; border-radius: 6px; border: 1px solid var(--border); background: ${b.tipShape === ts ? 'var(--accent)' : 'var(--control)'}; color: ${b.tipShape === ts ? '#ffffff' : 'var(--text)'};">${ts}</button>
              `).join('')}
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Aspect Ratio</span>
              <input type="range" class="dense-slider" id="bs-aspect-ratio" min="10" max="300" value="${Math.round((b.aspectRatio ?? 1.0) * 100)}">
              <span class="settings-slider-val" id="bs-aspect-ratio-val">${(b.aspectRatio ?? 1.0).toFixed(2)}x</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Hardness</span>
              <input type="range" class="dense-slider" id="bs-hardness" min="0" max="100" value="${hardnessVal}">
              <span class="settings-slider-val" id="bs-hardness-val">${hardnessVal}%</span>
            </div>
          </div>

          <!-- 3. SIZE & LIMITS SECTION -->
          <div class="section-header">Size & Range</div>
          <div class="settings-dense-group">
            <div class="settings-slider-row">
              <span class="settings-slider-label">Current Size</span>
              <input type="range" class="dense-slider" id="bs-size" min="1" max="150" value="${b.size || 12}">
              <span class="settings-slider-val" id="bs-size-val">${b.size || 12}px</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Min Size</span>
              <input type="range" class="dense-slider" id="bs-min-size" min="1" max="100" value="${b.minSize || 1}">
              <span class="settings-slider-val" id="bs-min-size-val">${b.minSize || 1}px</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Max Size</span>
              <input type="range" class="dense-slider" id="bs-max-size" min="10" max="500" value="${b.maxSize || 200}">
              <span class="settings-slider-val" id="bs-max-size-val">${b.maxSize || 200}px</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Opacity</span>
              <input type="range" class="dense-slider" id="bs-opacity" min="1" max="100" value="${opacityVal}">
              <span class="settings-slider-val" id="bs-opacity-val">${opacityVal}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Airbrush Build-up</span>
              <input type="checkbox" id="bs-buildup" ${b.buildUp ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer;">
              <span class="settings-slider-val" id="bs-buildup-val">${b.buildUp ? 'On' : 'Off'}</span>
            </div>
          </div>

          <!-- 4. FACTOR & CHILD MATRIX SECTION -->
          <div class="section-header">Factor & Child Links</div>
          <div class="factor-tabs-nav" style="display: flex; gap: 4px; margin-bottom: 8px;">
            <button class="factor-tab-btn ${curFactor === 'velocity' ? 'active' : ''}" data-factor="velocity" style="flex: 1; padding: 6px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: ${curFactor === 'velocity' ? 'var(--accent)' : 'var(--control)'}; color: ${curFactor === 'velocity' ? '#ffffff' : 'var(--text)'};">Velocity</button>
            <button class="factor-tab-btn ${curFactor === 'jitter' ? 'active' : ''}" data-factor="jitter" style="flex: 1; padding: 6px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: ${curFactor === 'jitter' ? 'var(--accent)' : 'var(--control)'}; color: ${curFactor === 'jitter' ? '#ffffff' : 'var(--text)'};">Jitter</button>
            <button class="factor-tab-btn ${curFactor === 'noise' ? 'active' : ''}" data-factor="noise" style="flex: 1; padding: 6px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: ${curFactor === 'noise' ? 'var(--accent)' : 'var(--control)'}; color: ${curFactor === 'noise' ? '#ffffff' : 'var(--text)'};">2D Noise</button>
          </div>
          <div class="settings-dense-group" id="factor-child-controls">
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Size</span>
              <input type="range" class="dense-slider" id="bs-fc-size" min="${minFactorVal}" max="100" value="${factorObj.size ?? 0}">
              <span class="settings-slider-val" id="bs-fc-size-val">${factorObj.size ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Opacity</span>
              <input type="range" class="dense-slider" id="bs-fc-opacity" min="${minFactorVal}" max="100" value="${factorObj.opacity ?? 0}">
              <span class="settings-slider-val" id="bs-fc-opacity-val">${factorObj.opacity ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Rotation</span>
              <input type="range" class="dense-slider" id="bs-fc-rotation" min="${minFactorVal}" max="100" value="${factorObj.rotation ?? 0}">
              <span class="settings-slider-val" id="bs-fc-rotation-val">${factorObj.rotation ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Tip Rotation</span>
              <input type="range" class="dense-slider" id="bs-fc-tip-rotation" min="${minFactorVal}" max="100" value="${factorObj.tipRotation ?? 0}">
              <span class="settings-slider-val" id="bs-fc-tip-rotation-val">${factorObj.tipRotation ?? 0}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">→ Spacing</span>
              <input type="range" class="dense-slider" id="bs-fc-spacing" min="${minFactorVal}" max="100" value="${factorObj.spacing ?? 0}">
              <span class="settings-slider-val" id="bs-fc-spacing-val">${factorObj.spacing ?? 0}%</span>
            </div>
          </div>

          ${curFactor === 'noise' ? `
            <div class="section-header">2D Noise Generator</div>
            <div class="settings-dense-group">
              <div class="settings-slider-row">
                <span class="settings-slider-label">Noise Scale</span>
                <input type="range" class="dense-slider" id="bs-noise-scale" min="1" max="100" value="${b.noiseScale || 20}">
                <span class="settings-slider-val" id="bs-noise-scale-val">${b.noiseScale || 20}</span>
              </div>
              <div class="settings-slider-row">
                <span class="settings-slider-label">Intensity</span>
                <input type="range" class="dense-slider" id="bs-noise-intensity" min="0" max="100" value="${b.noiseIntensity ?? 50}">
                <span class="settings-slider-val" id="bs-noise-intensity-val">${b.noiseIntensity ?? 50}%</span>
              </div>
              <div class="settings-slider-row">
                <span class="settings-slider-label">Octaves</span>
                <input type="range" class="dense-slider" id="bs-noise-octaves" min="1" max="6" value="${b.noiseOctaves || 3}">
                <span class="settings-slider-val" id="bs-noise-octaves-val">${b.noiseOctaves || 3}</span>
              </div>
            </div>
          ` : ''}

          <!-- 5. CORE STROKE & TEXTURE -->
          <div class="section-header">Stroke & Spacing</div>
          <div class="settings-dense-group">
            <div class="settings-slider-row">
              <span class="settings-slider-label">Spacing</span>
              <input type="range" class="dense-slider" id="bs-spacing" min="1" max="100" value="${spacingVal}">
              <span class="settings-slider-val" id="bs-spacing-val">${spacingVal}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Stream / Smoothing</span>
              <input type="range" class="dense-slider" id="bs-stabilizer" min="0" max="100" value="${stabilizerVal}">
              <span class="settings-slider-val" id="bs-stabilizer-val">${stabilizerVal}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Roundness</span>
              <input type="range" class="dense-slider" id="bs-roundness" min="10" max="100" value="${roundnessVal}">
              <span class="settings-slider-val" id="bs-roundness-val">${roundnessVal}%</span>
            </div>
            <div class="settings-slider-row">
              <span class="settings-slider-label">Grain</span>
              <input type="range" class="dense-slider" id="bs-grain" min="0" max="100" value="${grainVal}">
              <span class="settings-slider-val" id="bs-grain-val">${grainVal}%</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupSettingsEvents();
    this.drawSettingsStrokePreview();
  }

  setupSettingsEvents() {
    const b = this.currentBrush;
    if (!b) return;

    const bindSlider = (id, onChange) => {
      const el = this.container.querySelector(`#${id}`);
      const valEl = this.container.querySelector(`#${id}-val`);
      if (!el || !valEl) return;
      el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        onChange(val, valEl);
        this.updateMetaLabels();
        this.drawSettingsStrokePreview();
        this.onBrushChanged?.(this.currentBrush);
      });
    };

    // Tip shape buttons
    this.container.querySelectorAll('.tip-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        b.tipShape = btn.dataset.tip;
        this.container.querySelectorAll('.tip-shape-btn').forEach(bb => {
          bb.classList.toggle('active', bb.dataset.tip === b.tipShape);
          bb.style.background = bb.dataset.tip === b.tipShape ? 'var(--accent, #6366f1)' : 'var(--card, #20222e)';
        });
        this.drawSettingsStrokePreview();
        this.onBrushChanged?.(this.currentBrush);
      });
    });

    // Aspect ratio & Hardness
    bindSlider('bs-aspect-ratio', (v, valEl) => {
      b.aspectRatio = v / 100;
      valEl.textContent = `${(v / 100).toFixed(2)}x`;
    });

    // Factor Tabs
    this.container.querySelectorAll('.factor-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFactorTab = btn.dataset.factor;
        this.renderSettings();
      });
    });

    // Size & Limits
    bindSlider('bs-size', (v, valEl) => {
      b.size = v;
      valEl.textContent = `${Math.round(v)}px`;
    });

    bindSlider('bs-min-size', (v, valEl) => {
      b.minSize = v;
      if (b.minSize > b.maxSize) b.maxSize = b.minSize;
      valEl.textContent = `${Math.round(v)}px`;
    });

    bindSlider('bs-max-size', (v, valEl) => {
      b.maxSize = v;
      if (b.maxSize < b.minSize) b.minSize = b.maxSize;
      valEl.textContent = `${Math.round(v)}px`;
    });

    bindSlider('bs-opacity', (v, valEl) => {
      b.opacity = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });

    const buildupEl = this.container.querySelector('#bs-buildup');
    const buildupVal = this.container.querySelector('#bs-buildup-val');
    buildupEl?.addEventListener('change', (e) => {
      b.buildUp = e.target.checked;
      if (buildupVal) buildupVal.textContent = b.buildUp ? 'On' : 'Off';
      this.drawSettingsStrokePreview();
      this.onBrushChanged?.(this.currentBrush);
    });

    // Factor Child Matrix Sliders
    const curFactor = this.activeFactorTab || 'velocity';
    if (!b.factorLinks) b.factorLinks = {};
    if (!b.factorLinks[curFactor]) b.factorLinks[curFactor] = { size: 0, opacity: 0, rotation: 0, tipRotation: 0, spacing: 0 };

    bindSlider('bs-fc-size', (v, valEl) => {
      b.factorLinks[curFactor].size = v;
      if (curFactor === 'velocity' && b.velocityDynamics) b.velocityDynamics.factor = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-opacity', (v, valEl) => {
      b.factorLinks[curFactor].opacity = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-rotation', (v, valEl) => {
      b.factorLinks[curFactor].rotation = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-tip-rotation', (v, valEl) => {
      b.factorLinks[curFactor].tipRotation = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-fc-spacing', (v, valEl) => {
      b.factorLinks[curFactor].spacing = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    // 2D Noise controls if noise tab
    if (curFactor === 'noise') {
      bindSlider('bs-noise-scale', (v, valEl) => {
        b.noiseScale = v;
        valEl.textContent = `${Math.round(v)}`;
      });
      bindSlider('bs-noise-intensity', (v, valEl) => {
        b.noiseIntensity = v;
        valEl.textContent = `${Math.round(v)}%`;
      });
      bindSlider('bs-noise-octaves', (v, valEl) => {
        b.noiseOctaves = Math.round(v);
        valEl.textContent = `${Math.round(v)}`;
      });
    }

    // Stroke & Texture
    bindSlider('bs-spacing', (v, valEl) => {
      b.spacing = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-stabilizer', (v, valEl) => {
      b.stabilizerStrength = v;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-hardness', (v, valEl) => {
      b.hardness = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-roundness', (v, valEl) => {
      b.roundness = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });

    bindSlider('bs-grain', (v, valEl) => {
      b.grain = v / 100;
      valEl.textContent = `${Math.round(v)}%`;
    });
  }

  updateMetaLabels() {
    const b = this.currentBrush;
    if (!b) return;
    const label = this.container.querySelector('#bs-preview-size-label');
    if (label) {
      label.textContent = `${Math.round(b.size || 12)}px (min ${Math.round(b.minSize || 1)}px – max ${Math.round(b.maxSize || 200)}px)`;
    }
  }

  drawSettingsStrokePreview() {
    const canvas = this.container.querySelector('#brush-live-stroke-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle sleek dark background
    ctx.fillStyle = '#141722';
    ctx.fillRect(0, 0, w, h);

    const b = this.currentBrush;
    if (!b) return;

    // Generate simulated smooth S-curve
    const pts = [];
    const steps = 70;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = 20 + u * (w - 40);
      const y = h / 2 + Math.sin(u * Math.PI * 2) * (h * 0.28);
      const speedNorm = Math.sin(u * Math.PI);
      pts.push({ x, y, u, speed: speedNorm * 1.5, pressure: 0.35 + speedNorm * 0.55 });
    }

    const color = this.currentColor || '#8b5cf6';
    const baseSize = Math.max(1, b.size || 12);
    const minR = Math.max(0.25, (b.minSize || 1) / 2);
    const maxR = Math.max(minR + 0.5, (b.maxSize || 200) / 2);

    const fl = b.factorLinks || {};
    const vLinks = fl.velocity || {};
    const jLinks = fl.jitter || {};
    const nLinks = fl.noise || {};

    ctx.save();
    ctx.fillStyle = b.isEraser ? '#ffffff' : color;
    ctx.strokeStyle = b.isEraser ? '#ffffff' : color;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      let r = (baseSize * p.pressure) / 2;

      // Factors
      const vFactor = Math.min(1.5, Math.max(-1.0, (p.pressure - 0.5) * 2.0));
      const jFactor = ((Math.sin(i * 1337.7) * 43758.5453) % 1.0);
      const nFactor = Math.sin(i * 0.18) * 0.7;

      // Modulate size
      let sizeMod = 1.0;
      if (vLinks.size) sizeMod += (vLinks.size / 100) * vFactor;
      if (jLinks.size) sizeMod += (jLinks.size / 100) * jFactor * 0.5;
      if (nLinks.size) sizeMod += (nLinks.size / 100) * nFactor * 0.35;
      r = Math.max(minR, Math.min(maxR, r * Math.max(0.05, sizeMod)));

      // Modulate opacity
      let alpha = b.opacity ?? 1.0;
      let alphaMod = 0;
      if (vLinks.opacity) alphaMod += (vLinks.opacity / 100) * vFactor;
      if (jLinks.opacity) alphaMod += (jLinks.opacity / 100) * jFactor * 0.5;
      if (nLinks.opacity) alphaMod += (nLinks.opacity / 100) * nFactor * 0.4;
      alpha = Math.max(0.05, Math.min(1.0, alpha * (1.0 + alphaMod)));

      // Modulate rotation & tipRotation
      let rot = (b.rotation || 0) * (Math.PI / 180);
      if (vLinks.rotation) rot += (vLinks.rotation / 100) * vFactor * Math.PI;
      if (jLinks.rotation) rot += (jLinks.rotation / 100) * jFactor * Math.PI;
      if (nLinks.rotation) rot += (nLinks.rotation / 100) * nFactor * 0.5 * Math.PI;

      let tipRot = 0;
      if (vLinks.tipRotation) tipRot += (vLinks.tipRotation / 100) * vFactor * Math.PI;
      if (jLinks.tipRotation) tipRot += (jLinks.tipRotation / 100) * jFactor * Math.PI;
      if (nLinks.tipRotation) tipRot += (nLinks.tipRotation / 100) * nFactor * 0.5 * Math.PI;

      const totalAngle = rot + tipRot;
      const aspect = Math.max(0.1, b.aspectRatio ?? 1.0);
      const rx = Math.max(0.5, r * Math.sqrt(aspect));
      const ry = Math.max(0.5, r / Math.sqrt(aspect));

      ctx.globalAlpha = alpha;

      const shape = b.tipShape || 'round';
      if (shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
        ctx.restore();
      } else if (shape === 'chisel') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle + 0.785);
        ctx.fillRect(-rx * 1.8, -ry * 0.45, rx * 3.6, ry * 0.9);
        ctx.restore();
      } else if (shape === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        ctx.beginPath();
        for (let s = 0; s < 5; s++) {
          const aOuter = (s * Math.PI * 2) / 5 - Math.PI / 2;
          const aInner = aOuter + Math.PI / 5;
          const xo = Math.cos(aOuter) * rx;
          const yo = Math.sin(aOuter) * ry;
          const xi = Math.cos(aInner) * (rx * 0.45);
          const yi = Math.sin(aInner) * (ry * 0.45);
          if (s === 0) ctx.moveTo(xo, yo);
          else ctx.lineTo(xo, yo);
          ctx.lineTo(xi, yi);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (shape === 'bristle') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        const dotCount = 5;
        for (let d = -dotCount / 2; d <= dotCount / 2; d++) {
          ctx.beginPath();
          ctx.arc(d * (rx / 2.5), 0, Math.max(0.4, ry * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (shape === 'soft' || (b.hardness ?? 1.0) < 0.5) {
        const rad = Math.max(1, r);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(totalAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawLivePreview() {
    this.drawLibraryPreviews();
    this.drawSettingsStrokePreview();
  }

  drawLibraryPreviews() {
    this.container.querySelectorAll('.brush-stroke-thumb').forEach(canvas => {
      const id = canvas.dataset.id;
      const b = this.brushes.find(brush => brush.id === id);
      if (!b) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = this.currentColor || '#3B6EDC';
      ctx.beginPath();
      for (let x = 6; x < w - 6; x += 2.5) {
        const y = h / 2 + Math.sin((x / w) * Math.PI * 2) * 4;
        const rad = Math.max(0.8, (b.size / 16) * 2);
        ctx.arc(x, y, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    });
  }
}

/* --- ToolPanel.js --- */
/**
 * Vectura Tool Options Strip Manager (44px contextual strip)
 * Displays active tool options directly above bottom toolbar.
 */
class ToolPanel {
  constructor(stripContentEl, toolManager, onAction, app = null) {
    this.container = stripContentEl;
    this.stripEl = document.getElementById('tool-options-strip');
    this.toolManager = toolManager;
    this.onAction = onAction;
    this.app = app;

    this.activeTool = 'brush';
  }

  setApp(app) {
    this.app = app;
  }

  update(activeTool) {
    this.activeTool = activeTool;
    this.render();
  }

  render() {
    if (!this.container) return;
    const tm = this.toolManager;
    const tool = this.activeTool;

    if (this.stripEl) {
      this.stripEl.classList.remove('hidden');
    }

    if (tool === 'brush' || tool === 'eraser') {
      const b = this.app?.vectorCanvas?.currentBrush;
      const brushName = b?.name || (tool === 'eraser' ? 'Eraser' : 'Pencil');
      const brushSize = b?.size || 8;
      const brushOpac = Math.round((b?.opacity ?? 1.0) * 100);

      this.container.innerHTML = `
        <div id="strip-brush-click" class="strip-item" style="cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%;">
          <canvas id="strip-brush-thumb" class="strip-brush-thumb" width="64" height="28"></canvas>
          <span style="font-weight: 500; font-size: var(--text-body); color: var(--text);">${brushName}</span>
          <span class="tabular" style="font-size: var(--text-secondary); color: var(--text-2);">${brushSize}px · ${brushOpac}%</span>
        </div>
      `;

      this.container.querySelector('#strip-brush-click')?.addEventListener('click', () => {
        this.app?.ui?.toggleSheet('brushes');
      });

      this.drawBrushThumb();
    } else if (tool === 'bucket') {
      const fb = tm.fillBucket;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; gap: 10px; width: 100%;">
          <span style="font-size: var(--text-secondary); color: var(--text-2);">Tolerance</span>
          <input type="range" class="dense-slider" id="strip-fill-tolerance" min="0" max="100" value="${fb?.tolerance ?? 30}" style="width: 100px;">
          <span id="strip-fill-tol-val" class="tabular" style="font-size: var(--text-secondary);">${fb?.tolerance ?? 30}%</span>
          <button id="strip-fill-gap-btn" class="btn-text ${fb?.gapClose ? 'accent' : ''}" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">
            Gap close
          </button>
        </div>
      `;

      const tolInput = this.container.querySelector('#strip-fill-tolerance');
      const tolVal = this.container.querySelector('#strip-fill-tol-val');
      tolInput?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (fb) fb.tolerance = val;
        if (tolVal) tolVal.textContent = `${val}%`;
      });

      const gapBtn = this.container.querySelector('#strip-fill-gap-btn');
      gapBtn?.addEventListener('click', () => {
        if (fb) {
          fb.gapClose = !fb.gapClose;
          gapBtn.classList.toggle('accent', fb.gapClose);
        }
      });
    } else if (tool === 'select' || tool === 'selection' || tool === 'lasso-fill') {
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; gap: 6px; width: 100%;">
          <button id="strip-sel-add" class="btn-text accent" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Add</button>
          <button id="strip-sel-sub" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Subtract</button>
          <button id="strip-sel-inv" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Invert</button>
          <button id="strip-sel-feather" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Feather</button>
        </div>
      `;
      this.container.querySelector('#strip-sel-inv')?.addEventListener('click', () => {
        tm.selectionTool?.invert();
      });
    } else if (tool === 'smudge') {
      const sm = tm.smudgeTool;
      const strengthVal = Math.round((sm?.strength ?? 0.6) * 100);
      const sizeVal = Math.round(sm?.size ?? 30);
      const isFinger = sm?.fingerPainting ?? false;

      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; gap: 8px; width: 100%; overflow-x: auto;">
          <span style="font-weight: 600; font-size: var(--text-body); color: var(--text);">Smudge</span>
          <span style="font-size: 11px; color: var(--text-2);">Strength</span>
          <input type="range" class="dense-slider" id="strip-smudge-strength" min="1" max="100" value="${strengthVal}" style="width: 80px;">
          <span id="strip-smudge-str-val" class="tabular" style="font-size: 11px; min-width: 30px;">${strengthVal}%</span>
          <span style="font-size: 11px; color: var(--text-2);">Size</span>
          <input type="range" class="dense-slider" id="strip-smudge-size" min="2" max="150" value="${sizeVal}" style="width: 80px;">
          <span id="strip-smudge-sz-val" class="tabular" style="font-size: 11px; min-width: 32px;">${sizeVal}px</span>
          <button id="strip-smudge-finger" class="btn-text ${isFinger ? 'accent' : ''}" style="min-height: 28px; padding: 2px 8px; font-size: 11px; white-space: nowrap;">
            Finger Paint
          </button>
        </div>
      `;

      const strInput = this.container.querySelector('#strip-smudge-strength');
      const strVal = this.container.querySelector('#strip-smudge-str-val');
      strInput?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (sm) sm.strength = val / 100;
        if (strVal) strVal.textContent = `${val}%`;
      });

      const szInput = this.container.querySelector('#strip-smudge-size');
      const szVal = this.container.querySelector('#strip-smudge-sz-val');
      szInput?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (sm) sm.size = val;
        if (szVal) szVal.textContent = `${val}px`;
      });

      const fingerBtn = this.container.querySelector('#strip-smudge-finger');
      fingerBtn?.addEventListener('click', () => {
        if (sm) {
          sm.fingerPainting = !sm.fingerPainting;
          fingerBtn.classList.toggle('accent', sm.fingerPainting);
        }
      });
    } else if (tool === 'transform') {
      const tt = tm.transformTool;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 600; font-size: 13px;">Transform</span>
            <span style="color: var(--text-2); font-size: 11px;">Drag handles to scale/rotate</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="strip-tf-fliph" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Flip H</button>
            <button id="strip-tf-flipv" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Flip V</button>
            <button id="strip-tf-rot90" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">90°</button>
            <button id="strip-tf-apply" class="btn-text accent" style="min-height: 28px; padding: 2px 10px; font-size: 12px; font-weight: 600;">Done</button>
          </div>
        </div>
      `;

      this.container.querySelector('#strip-tf-fliph')?.addEventListener('click', () => {
        tt?.flipH?.();
        this.app?.vectorCanvas?.render();
      });
      this.container.querySelector('#strip-tf-flipv')?.addEventListener('click', () => {
        tt?.flipV?.();
        this.app?.vectorCanvas?.render();
      });
      this.container.querySelector('#strip-tf-rot90')?.addEventListener('click', () => {
        if (tt) {
          tt.rotation = (tt.rotation || 0) + Math.PI / 2;
        }
        this.app?.vectorCanvas?.render();
      });
      this.container.querySelector('#strip-tf-apply')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.commitTransform();
        }
      });
    } else if (tool === 'pan') {
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 500; font-size: 13px;">Navigate</span>
            <span style="color: var(--text-2); font-size: 11px;">Drag to pan · Pinch to zoom</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="strip-nav-fit" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Fit</button>
            <button id="strip-nav-100" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">100%</button>
            <button id="strip-nav-reset" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Reset</button>
          </div>
        </div>
      `;

      this.container.querySelector('#strip-nav-fit')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.viewport.fitToScreen();
          this.app.vectorCanvas.viewport.onNavigate?.(this.app.vectorCanvas.viewport.zoom, this.app.vectorCanvas.viewport.rotation);
        }
      });
      this.container.querySelector('#strip-nav-100')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.viewport.set100Percent();
          this.app.vectorCanvas.viewport.onNavigate?.(1.0, this.app.vectorCanvas.viewport.rotation);
        }
      });
      this.container.querySelector('#strip-nav-reset')?.addEventListener('click', () => {
        if (this.app?.vectorCanvas) {
          this.app.vectorCanvas.viewport.resetView();
          this.app.vectorCanvas.viewport.onNavigate?.(this.app.vectorCanvas.viewport.zoom, 0);
        }
      });
    } else if (tool === 'shape') {
      const sh = tm.shapeTool;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; gap: 6px; overflow-x: auto; width: 100%;">
          <button class="btn-text strip-sh-btn ${sh?.type === 'line' ? 'accent' : ''}" data-type="line" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Line</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'arrow' ? 'accent' : ''}" data-type="arrow" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Arrow</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'rect' ? 'accent' : ''}" data-type="rect" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Rect</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'ellipse' ? 'accent' : ''}" data-type="ellipse" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Ellipse</button>
          <button class="btn-text strip-sh-btn ${sh?.type === 'polygon' ? 'accent' : ''}" data-type="polygon" style="min-height: 28px; padding: 2px 8px; font-size: var(--text-secondary);">Polygon</button>
        </div>
      `;

      this.container.querySelectorAll('.strip-sh-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (sh) sh.type = btn.dataset.type;
          this.container.querySelectorAll('.strip-sh-btn').forEach(b => b.classList.remove('accent'));
          btn.classList.add('accent');
        });
      });
    } else if (tool === 'symmetry') {
      const sym = tm.symmetry;
      const isLocked = sym?.locked || false;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; gap: 6px; align-items: center; overflow-x: auto; width: 100%;">
          <button class="btn-text strip-sym-btn ${sym?.mode === 'vertical' ? 'accent' : ''}" data-mode="vertical" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Vertical</button>
          <button class="btn-text strip-sym-btn ${sym?.mode === 'horizontal' ? 'accent' : ''}" data-mode="horizontal" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Horizontal</button>
          <button class="btn-text strip-sym-btn ${sym?.mode === 'radial' ? 'accent' : ''}" data-mode="radial" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Radial</button>
          <button id="strip-sym-lock" class="btn-text ${isLocked ? 'accent' : ''}" style="min-height: 28px; padding: 2px 8px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="${isLocked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1'}"/></svg>
            ${isLocked ? 'Locked' : 'Unlocked'}
          </button>
          <button id="strip-sym-reset" class="btn-text" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">
            Reset Axis
          </button>
        </div>
      `;
      this.container.querySelectorAll('.strip-sym-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (sym) {
            sym.mode = btn.dataset.mode;
            this.container.querySelectorAll('.strip-sym-btn').forEach(b => b.classList.remove('accent'));
            btn.classList.add('accent');
            this.app?.vectorCanvas?.render();
          }
        });
      });
      this.container.querySelector('#strip-sym-lock')?.addEventListener('click', () => {
        if (sym) {
          sym.toggleLock();
          this.render();
          this.app?.vectorCanvas?.render();
        }
      });
      this.container.querySelector('#strip-sym-reset')?.addEventListener('click', () => {
        if (sym && this.app?.vectorCanvas) {
          sym.reset(this.app.vectorCanvas.docWidth, this.app.vectorCanvas.docHeight);
          this.app.vectorCanvas.render();
        }
      });
    } else if (tool === 'gradient') {
      const gt = tm.gradientTool;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; gap: 8px; align-items: center; width: 100%;">
          <span style="font-weight: 500; font-size: 13px; color: var(--text);">Gradient</span>
          <button class="btn-text strip-grad-btn ${gt?.type === 'linear' ? 'accent' : ''}" data-type="linear" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Linear</button>
          <button class="btn-text strip-grad-btn ${gt?.type === 'radial' ? 'accent' : ''}" data-type="radial" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">Radial</button>
        </div>
      `;
      this.container.querySelectorAll('.strip-grad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (gt) gt.type = btn.dataset.type;
          this.container.querySelectorAll('.strip-grad-btn').forEach(b => b.classList.remove('accent'));
          btn.classList.add('accent');
        });
      });
    } else if (tool === 'text') {
      const tt = tm.textTool;
      const curSize = tt?.fontSize || 48;
      this.container.innerHTML = `
        <div class="strip-item" style="display: flex; gap: 8px; align-items: center; width: 100%;">
          <span style="font-weight: 500; font-size: 13px; color: var(--text);">Text Size</span>
          <button class="btn-text strip-txt-sz ${curSize === 24 ? 'accent' : ''}" data-sz="24" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">24px</button>
          <button class="btn-text strip-txt-sz ${curSize === 36 ? 'accent' : ''}" data-sz="36" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">36px</button>
          <button class="btn-text strip-txt-sz ${curSize === 48 ? 'accent' : ''}" data-sz="48" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">48px</button>
          <button class="btn-text strip-txt-sz ${curSize === 72 ? 'accent' : ''}" data-sz="72" style="min-height: 28px; padding: 2px 8px; font-size: 12px;">72px</button>
        </div>
      `;
      this.container.querySelectorAll('.strip-txt-sz').forEach(btn => {
        btn.addEventListener('click', () => {
          const sz = parseInt(btn.dataset.sz);
          if (tt) tt.fontSize = sz;
          this.container.querySelectorAll('.strip-txt-sz').forEach(b => b.classList.remove('accent'));
          btn.classList.add('accent');
        });
      });
    } else {
      if (this.stripEl) {
        this.stripEl.classList.add('hidden');
      }
    }
  }

  drawBrushThumb() {
    const canvas = this.container.querySelector('#strip-brush-thumb');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const color = this.app?.vectorCanvas?.currentColor || '#3B6EDC';
    const b = this.app?.vectorCanvas?.currentBrush;

    ctx.fillStyle = color;
    ctx.beginPath();
    for (let x = 6; x < w - 6; x += 2) {
      const y = h / 2 + Math.sin((x / w) * Math.PI * 2) * 4;
      const rad = Math.max(0.8, ((b?.size || 8) / 16) * 2);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/* --- SettingsDialog.js --- */
/**
 * Vectura Settings Dialog
 * Clean, calm, professional settings panel matching design tokens and active theme.
 * Includes Theme Selector: Dark OLED, Grey, Blue Grey, White, Sepia.
 */
class SettingsDialog {
  constructor(modalEl, config, onConfigChanged, onResetUILayout = null) {
    this.modalEl = modalEl;
    this.config = config;
    if (this.config.globalSpeedFactor === undefined) {
      this.config.globalSpeedFactor = 1.0;
    }
    if (this.config.reduceAnimations === undefined) {
      this.config.reduceAnimations = false;
    }
    if (this.config.fillAnimation === undefined) {
      this.config.fillAnimation = true;
    }
    if (this.config.fillSpeed === undefined) {
      this.config.fillSpeed = 380;
    }
    if (!this.config.theme) {
      this.config.theme = 'dark-oled';
    }
    this.onConfigChanged = onConfigChanged;
    this.onResetUILayout = onResetUILayout;

    this.render();
  }

  setResetLayoutHandler(fn) {
    this.onResetUILayout = fn;
  }

  render() {
    const speedFactor = (this.config.globalSpeedFactor || 1.0).toFixed(2);
    const rotThresh = this.config.rotationThreshold ?? 6;
    const currentTheme = this.config.theme || 'dark-oled';

    this.modalEl.innerHTML = `
      <div class="dialog-card" style="max-width: 440px; width: 94%; max-height: 85vh; display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; background: var(--panel);">
        <div class="dialog-header" style="padding: 14px 20px; border-bottom: 1px solid var(--divider); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <span style="font-size: 17px; font-weight: 700; color: var(--text);">Preferences</span>
          <button id="sd-close-btn" class="btn-icon" title="Close" style="width: 32px; height: 32px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="dialog-body" style="padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; flex: 1;">
          <!-- 1. GESTURES & CONTROLS -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Gestures & Navigation</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Multi-finger Tap Shortcuts</div>
                  <div style="font-size: 11px; color: var(--text-2);">2-finger tap undo · 3-finger tap redo</div>
                </div>
                <input type="checkbox" id="sd-tap-gestures-toggle" ${this.config.multiTouchShortcuts !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="padding-top: 6px; border-top: 1px solid var(--divider);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 13px; font-weight: 500; color: var(--text);">Rotation activation threshold</span>
                  <span id="sd-rot-thresh-display" class="tabular" style="font-size: 11px; color: var(--text-2);">${rotThresh}°</span>
                </div>
                <input type="range" id="sd-rot-thresh-slider" class="dense-slider" min="2" max="20" step="1" value="${rotThresh}" style="width: 100%;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Stylus palm rejection</div>
                  <div style="font-size: 11px; color: var(--text-2);">Ignore finger touch while pen draws</div>
                </div>
                <input type="checkbox" id="sd-palm-toggle" ${this.config.palmRejection !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Haptic vibration</div>
                  <div style="font-size: 11px; color: var(--text-2);">Tactile pulses on undo & transform snap</div>
                </div>
                <input type="checkbox" id="sd-haptic-toggle" ${this.config.hapticFeedback !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>
            </div>
          </div>

          <!-- 2. CANVAS & WORKSPACE -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Canvas & Workspace</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Smooth Zero Attraction</div>
                  <div style="font-size: 11px; color: var(--text-2);">Softly pulls canvas upright near 0°</div>
                </div>
                <input type="checkbox" id="sd-magnetic-zero-toggle" ${this.config.magneticZero !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="padding-top: 6px; border-top: 1px solid var(--divider);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 13px; font-weight: 500; color: var(--text);">Checkerboard Background</div>
                    <div style="font-size: 11px; color: var(--text-2);">Indicates layer transparency</div>
                  </div>
                  <input type="checkbox" id="sd-checker-toggle" ${this.config.showCheckerboard !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
                </div>
              </div>
            </div>
          </div>

          <!-- 3. PERFORMANCE & BATTERY -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Performance & Battery</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 13px; font-weight: 500; color: var(--text);">Dynamics speed factor</span>
                  <span id="sd-speed-factor-display" class="tabular" style="font-size: 11px; color: var(--text-2);">${speedFactor}x</span>
                </div>
                <input type="range" id="sd-speed-factor-slider" class="dense-slider" min="0.1" max="3.0" step="0.05" value="${this.config.globalSpeedFactor || 1.0}" style="width: 100%;" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Reduce animations & UI blur</div>
                  <div style="font-size: 11px; color: var(--text-2);">Conserves GPU memory and battery</div>
                </div>
                <input type="checkbox" id="sd-reduce-anim-toggle" ${this.config.reduceAnimations ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">History RAM Saver</div>
                  <div style="font-size: 11px; color: var(--text-2);">Limits undo memory (recommended for phones)</div>
                </div>
                <input type="checkbox" id="sd-ram-saver-toggle" ${this.config.historyRamSaver !== false ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent);" />
              </div>
            </div>
          </div>

          <!-- 4. INTERFACE & THEMES -->
          <div>
            <div class="section-header" style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700;">Interface & Themes</div>
            <div class="settings-dense-group" style="display: flex; flex-direction: column; gap: 12px; background: var(--card); padding: 12px; border-radius: 10px; border: 1px solid var(--divider);">
              <div>
                <div style="font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 2px;">Studio Theme</div>
                <div style="font-size: 11px; color: var(--text-2); margin-bottom: 8px;">Select color scheme for all surfaces</div>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
                  ${[
                    { id: 'dark-oled', label: 'Dark OLED' },
                    { id: 'grey', label: 'Grey' },
                    { id: 'blue-grey', label: 'Blue Grey' },
                    { id: 'white', label: 'White' },
                    { id: 'sepia', label: 'Sepia' }
                  ].map(t => {
                    const isSel = currentTheme === t.id;
                    return `
                      <button class="btn-text sd-theme-btn ${isSel ? 'accent' : ''}" data-theme="${t.id}" style="padding: 6px 2px; font-size: 10px; min-height: 36px; border-radius: 6px; text-align: center; border: 1.5px solid ${isSel ? 'var(--accent)' : 'var(--border)'}; background: ${isSel ? 'var(--accent)' : 'var(--control)'}; color: ${isSel ? '#ffffff' : 'var(--text)'};">
                        ${t.label}
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--divider);">
                <div>
                  <div style="font-size: 13px; font-weight: 500; color: var(--text);">Slider Position & Layout</div>
                  <div style="font-size: 11px; color: var(--text-2);">Reset edge sliders back to left default</div>
                </div>
                <button id="sd-reset-ui-btn" class="btn-text" style="font-size: 12px; padding: 4px 10px; height: 32px; border-radius: 6px;">
                  Reset Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
  }

  setupEvents() {
    this.modalEl.querySelector('#sd-close-btn')?.addEventListener('click', () => {
      this.close();
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // Theme selector
    this.modalEl.querySelectorAll('.sd-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const themeId = btn.dataset.theme;
        this.config.theme = themeId;
        this.onConfigChanged?.('theme', themeId);
        this.render();
      });
    });

    // Reset UI Layout
    this.modalEl.querySelector('#sd-reset-ui-btn')?.addEventListener('click', () => {
      this.onResetUILayout?.();
      this.close();
    });

    // Speed Factor
    const speedSlider = this.modalEl.querySelector('#sd-speed-factor-slider');
    const speedDisplay = this.modalEl.querySelector('#sd-speed-factor-display');
    speedSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.config.globalSpeedFactor = val;
      if (speedDisplay) speedDisplay.textContent = `${val.toFixed(2)}x`;
      this.onConfigChanged?.('globalSpeedFactor', val);
    });

    // Rotation Threshold
    const rotSlider = this.modalEl.querySelector('#sd-rot-thresh-slider');
    const rotDisplay = this.modalEl.querySelector('#sd-rot-thresh-display');
    rotSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.config.rotationThreshold = val;
      if (rotDisplay) rotDisplay.textContent = `${val}°`;
      this.onConfigChanged?.('rotationThreshold', val);
    });

    // Multi-touch gestures toggle
    this.modalEl.querySelector('#sd-tap-gestures-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.multiTouchShortcuts = val;
      this.onConfigChanged?.('multiTouchShortcuts', val);
    });

    // Magnetic Zero toggle
    this.modalEl.querySelector('#sd-magnetic-zero-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.magneticZero = val;
      this.onConfigChanged?.('magneticZero', val);
    });

    // Checkerboard toggle
    this.modalEl.querySelector('#sd-checker-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.showCheckerboard = val;
      this.onConfigChanged?.('showCheckerboard', val);
    });

    // Palm rejection
    this.modalEl.querySelector('#sd-palm-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.palmRejection = val;
      this.onConfigChanged?.('palmRejection', val);
    });

    // Haptic toggle
    this.modalEl.querySelector('#sd-haptic-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.hapticFeedback = val;
      this.onConfigChanged?.('haptics', val);
    });

    // Reduce animations toggle
    this.modalEl.querySelector('#sd-reduce-anim-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.reduceAnimations = val;
      this.onConfigChanged?.('reduceAnimations', val);
    });

    // RAM Saver toggle
    this.modalEl.querySelector('#sd-ram-saver-toggle')?.addEventListener('change', (e) => {
      const val = e.target.checked;
      this.config.historyRamSaver = val;
      this.onConfigChanged?.('historyRamSaver', val);
    });
  }

  open() {
    this.render();
    this.modalEl.classList.add('open');
  }

  close() {
    this.modalEl.classList.remove('open');
  }
}

/* --- Tutorial.js --- */
/**
 * Vectura 3-Step Skippable Mini Tutorial
 */
class Tutorial {
  constructor(modalEl, onFinished) {
    this.modalEl = modalEl;
    this.onFinished = onFinished;
    this.step = 1;
  }

  showIfNeeded() {
    if (localStorage.getItem('vectura_tutorial_seen')) {
      return;
    }
    this.step = 1;
    this.render();
    this.modalEl.classList.add('open');
  }

  render() {
    let title = '';
    let text = '';
    let icon = '';

    if (this.step === 1) {
      icon = '✒️';
      title = 'True Vector Stroke Engine';
      text = 'Every stroke you draw is mathematically stored as centripetal Catmull-Rom splines. Zoom in up to 6400% without any blur or pixelation!';
    } else if (this.step === 2) {
      icon = '🎨';
      title = 'Layers & 25+ Brushes';
      text = 'Enjoy infinite layers with 18 blend modes, clipping masks, alpha lock, and 25+ realistic brushes with coherent noise jitter.';
    } else {
      icon = '🖐️';
      title = 'Intuitive Touch Gestures';
      text = 'Two-finger tap to Undo. Three-finger tap to Redo. Pinch with 2 fingers to zoom and rotate. Hold at the end of a stroke to snap to shapes!';
    }

    this.modalEl.innerHTML = `
      <div class="glass-panel glass-modal" style="padding: 24px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 12px;">${icon}</div>
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${title}</h3>
        <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px;">${text}</p>
        
        <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 20px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.step === 1 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'};"></div>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.step === 2 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'};"></div>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.step === 3 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'};"></div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="tut-skip" class="glass-btn" style="flex: 1;">Skip</button>
          <button id="tut-next" class="glass-btn active" style="flex: 2;">${this.step === 3 ? 'Get Started' : 'Next'}</button>
        </div>
      </div>
    `;

    this.modalEl.querySelector('#tut-skip')?.addEventListener('click', () => this.finish());
    this.modalEl.querySelector('#tut-next')?.addEventListener('click', () => {
      if (this.step < 3) {
        this.step++;
        this.render();
      } else {
        this.finish();
      }
    });
  }

  finish() {
    localStorage.setItem('vectura_tutorial_seen', 'true');
    this.modalEl.classList.remove('open');
    this.onFinished?.();
  }
}

/* --- HomeScreen.js --- */
/**
 * Vectura Projects Gallery & New Canvas Screen
 * Redesigned full-height modal list modeled on ibisPaint's "New canvas" screen
 * Classic Vectura light-gray UI, flat, no glow, zero animations, 1-tap instant canvas creation.
 */


const ILLUSTRATION_PRESETS = [
  {
    id: 'sd_speed',
    name: 'SD (Speed)',
    width: 540,
    height: 1170,
    alternatives: [
      { name: 'Speed', width: 540, height: 1170 },
      { name: 'Standard', width: 720, height: 1560 },
      { name: 'High', width: 1080, height: 2340 }
    ]
  },
  {
    id: 'square_2k',
    name: '1:1 (2K)',
    width: 2048,
    height: 2048,
    alternatives: [
      { name: 'SD (512²)', width: 512, height: 512 },
      { name: 'HD (1080²)', width: 1080, height: 1080 },
      { name: '2K (2048²)', width: 2048, height: 2048 },
      { name: '4K (4096²)', width: 4096, height: 4096 }
    ]
  },
  {
    id: 'ratio_3_4',
    name: '3:4 (3K)',
    width: 2304,
    height: 3072,
    alternatives: [
      { name: 'SD', width: 768, height: 1024 },
      { name: 'HD', width: 1536, height: 2048 },
      { name: '3K', width: 2304, height: 3072 }
    ]
  },
  {
    id: 'ratio_9_16',
    name: '9:16 (SD)',
    width: 720,
    height: 1280,
    alternatives: [
      { name: 'qHD', width: 540, height: 960 },
      { name: 'SD', width: 720, height: 1280 },
      { name: 'FHD', width: 1080, height: 1920 },
      { name: 'QHD', width: 1440, height: 2560 }
    ]
  },
  {
    id: 'header_banner',
    name: 'Header',
    width: 1500,
    height: 500,
    alternatives: [
      { name: 'Compact', width: 1200, height: 400 },
      { name: 'Header (X/Twitter)', width: 1500, height: 500 },
      { name: 'Ultra', width: 1800, height: 600 }
    ]
  },
  {
    id: 'chat_stamp',
    name: 'Chat Stamp',
    width: 370,
    height: 320,
    alternatives: [
      { name: 'Standard', width: 370, height: 320 },
      { name: 'Hi-Res 2×', width: 740, height: 640 }
    ]
  },
  {
    id: 'vertical_strip',
    name: 'Vertical',
    width: 690,
    height: 4096,
    alternatives: [
      { name: 'Half-Strip', width: 690, height: 2048 },
      { name: 'Full Webtoon', width: 690, height: 4096 }
    ]
  }
];

const PRINT_PRESETS = [
  {
    id: 'postcard_300',
    name: 'Postcard 300dpi',
    width: 1181,
    height: 1748,
    alternatives: [
      { name: '150 DPI (Draft)', width: 590, height: 874 },
      { name: '300 DPI (Standard)', width: 1181, height: 1748 },
      { name: '450 DPI (Hi-Res)', width: 1772, height: 2622 }
    ]
  },
  {
    id: 'a4_150',
    name: 'A4 150dpi',
    width: 1240,
    height: 1754,
    alternatives: [
      { name: '150 DPI', width: 1240, height: 1754 },
      { name: '300 DPI (Hi-Res)', width: 2480, height: 3508 }
    ]
  },
  {
    id: 'a5_150',
    name: 'A5 150dpi',
    width: 874,
    height: 1240,
    alternatives: [
      { name: '150 DPI', width: 874, height: 1240 },
      { name: '300 DPI (Hi-Res)', width: 1748, height: 2480 }
    ]
  },
  {
    id: 'b4_150',
    name: 'B4 150dpi',
    width: 1476,
    height: 2085,
    alternatives: [
      { name: '150 DPI', width: 1476, height: 2085 },
      { name: '300 DPI (Hi-Res)', width: 2952, height: 4170 }
    ]
  }
];

function getDashedRatioIconHtml(w, h) {
  const maxBox = 26;
  const ratio = (w || 1) / (h || 1);
  let iconW, iconH;
  if (ratio >= 1) {
    iconW = maxBox;
    iconH = Math.max(6, Math.min(maxBox, Math.round(maxBox / ratio)));
  } else {
    iconH = maxBox;
    iconW = Math.max(6, Math.min(maxBox, Math.round(maxBox * ratio)));
  }
  return `
    <div class="new-canvas-row-icon" title="${w} × ${h}">
      <div style="width: ${iconW}px; height: ${iconH}px; border: 1.5px dashed var(--text-3); border-radius: 2px; box-sizing: border-box;"></div>
    </div>
  `;
}

class HomeScreen {
  constructor(storage, onOpenProject, onNewProject) {
    this.storage = storage;
    this.onOpenProject = onOpenProject;
    this.onNewProject = onNewProject;

    this.screenEl = document.getElementById('home-screen');
    this.projects = [];

    // Load remembered custom size from localStorage safely
    const storedW = parseInt(localStorage.getItem('vectura_last_custom_w'), 10);
    const storedH = parseInt(localStorage.getItem('vectura_last_custom_h'), 10);
    this.lastCustomW = (storedW && storedW >= 1 && storedW <= 4096) ? storedW : 1080;
    this.lastCustomH = (storedH && storedH >= 1 && storedH <= 4096) ? storedH : 1080;

    this.init();
  }

  async init() {
    this.screenEl.innerHTML = `
      <header class="sheet-header" id="hs-header">
        <div class="hs-header-left">
          <span class="hs-header-title">Artworks</span>
          <span id="hs-count-badge" class="hs-header-badge">0</span>
        </div>
        <div class="hs-header-right">
          <button id="hs-new-btn" class="btn-text accent" style="font-size: 13px; font-weight: 600; min-height: 36px; padding: 6px 14px; border-radius: 8px; box-shadow: none;">
            + New Canvas
          </button>
          <button id="hs-close-gallery" class="btn-icon" title="Return to canvas">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      <!-- Projects Grid -->
      <div class="gallery-grid" id="hs-gallery-grid"></div>

      <!-- Redesigned ibisPaint-style Full-Height Modal List -->
      <div id="hs-modal" class="new-canvas-overlay">
        <div class="new-canvas-screen">
          <!-- Top bar: Title "New" + X close button -->
          <div class="new-canvas-topbar">
            <span class="new-canvas-title">New</span>
            <button id="hs-modal-close" class="new-canvas-close-btn" aria-label="Close" title="Close">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Single Scrollable List (~56px touch rows, thin dividers) -->
          <div class="new-canvas-list">
            <!-- Row: Folder -->
            <div class="new-canvas-row" id="nc-row-folder">
              <div class="new-canvas-row-icon" style="color: var(--text-2);">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="new-canvas-row-title">Folder</div>
              <div style="color: var(--text-3); font-size: 13px; display: flex; align-items: center; gap: 4px; padding-right: 4px;">
                <span>Artworks</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>

            <!-- Section: Illustration -->
            <div class="new-canvas-section-band">Illustration</div>

            <!-- Row: Custom -->
            <div class="new-canvas-row" id="nc-row-custom">
              <div id="nc-custom-icon-slot">
                ${getDashedRatioIconHtml(this.lastCustomW, this.lastCustomH)}
              </div>
              <div style="flex: 1; margin-left: 12px; margin-right: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 15px; font-weight: 500; color: var(--text);">Custom</span>
                <div style="display: flex; align-items: center; gap: 4px;" id="nc-custom-inputs-wrap">
                  <input type="number" id="nc-custom-w" class="custom-dim-input" value="${this.lastCustomW}" min="1" max="4096" />
                  <span style="font-size: 13px; font-weight: 600; color: var(--text-3);">×</span>
                  <input type="number" id="nc-custom-h" class="custom-dim-input" value="${this.lastCustomH}" min="1" max="4096" />
                  <span style="font-size: 11px; color: var(--text-3);">px</span>
                  <button id="nc-custom-pencil-btn" class="btn-icon" style="width: 32px; height: 32px; color: var(--text-2); padding: 0;" title="Edit dimensions">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                </div>
              </div>
              <button id="nc-custom-create-btn" class="custom-create-badge" title="Create with custom dimensions">
                <span>Create</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            <!-- Illustration Presets -->
            ${ILLUSTRATION_PRESETS.map(p => this.renderPresetRow(p)).join('')}

            <!-- Section: For Printing -->
            <div class="new-canvas-section-band">For Printing</div>

            <!-- For Printing Presets -->
            ${PRINT_PRESETS.map(p => this.renderPresetRow(p)).join('')}
          </div>
        </div>
      </div>

      <!-- Gentle Memory Warning Dialog -->
      <div id="nc-memory-warning">
        <div style="max-width: 340px; width: 90%; background: var(--panel); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-floating);">
          <div style="font-size: 16px; font-weight: 700; color: var(--danger); display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Large Canvas Notice
          </div>
          <div id="nc-warn-message" style="font-size: 13px; color: var(--text-2); margin-top: 10px; line-height: 1.45;">
            Canvas size is large. It may run slower on devices with limited memory.
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 18px;">
            <button id="nc-warn-suggested" class="btn-text accent" style="width: 100%; height: 42px; border-radius: var(--radius-sm); font-weight: 600; font-size: 13px; background: var(--accent); color: #FFFFFF;">
              Use Recommended (2048 × 2048)
            </button>
            <button id="nc-warn-continue" class="btn-text" style="width: 100%; height: 40px; border-radius: var(--radius-sm); background: var(--control); color: var(--text); font-size: 13px; font-weight: 500;">
              Continue with original size
            </button>
            <button id="nc-warn-cancel" class="btn-text" style="width: 100%; height: 36px; background: transparent; color: var(--text-3); font-size: 13px;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
    await this.refresh();
  }

  renderPresetRow(p) {
    const hasAlts = p.alternatives && p.alternatives.length > 0;
    return `
      <div class="new-canvas-row preset-item-row" data-w="${p.width}" data-h="${p.height}" data-id="${p.id}">
        ${getDashedRatioIconHtml(p.width, p.height)}
        <div class="new-canvas-row-title">${p.name}</div>
        <div class="new-canvas-size-pill">${p.width}×${p.height}</div>
        ${hasAlts ? `
          <button class="new-canvas-chevron-btn" data-target="alts-${p.id}" aria-label="Expand resolutions" title="Alternative resolutions">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        ` : '<div style="width: 12px;"></div>'}
      </div>
      ${hasAlts ? `
        <div class="new-canvas-sublist" id="alts-${p.id}">
          ${p.alternatives.map(alt => `
            <div class="new-canvas-subrow preset-subrow-item" data-w="${alt.width}" data-h="${alt.height}">
              ${getDashedRatioIconHtml(alt.width, alt.height)}
              <div class="new-canvas-row-title" style="font-size: 14px;">${alt.name}</div>
              <div class="new-canvas-size-pill" style="font-size: 12px;">${alt.width}×${alt.height}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  setupEvents() {
    // Open / Close modal
    this.screenEl.querySelector('#hs-new-btn')?.addEventListener('click', () => {
      this.openModal();
    });

    this.screenEl.querySelector('#hs-modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    this.screenEl.querySelector('#hs-close-gallery')?.addEventListener('click', () => {
      this.hide();
    });

    // Row "Folder" -> opens project manager folder picker (reveals the artworks gallery)
    this.screenEl.querySelector('#nc-row-folder')?.addEventListener('click', () => {
      this.closeModal();
      const grid = this.screenEl.querySelector('#hs-gallery-grid');
      if (grid) grid.scrollTop = 0;
    });

    // Custom Row Dimension Inputs
    const customWInput = this.screenEl.querySelector('#nc-custom-w');
    const customHInput = this.screenEl.querySelector('#nc-custom-h');
    const customIconSlot = this.screenEl.querySelector('#nc-custom-icon-slot');
    const customInputsWrap = this.screenEl.querySelector('#nc-custom-inputs-wrap');

    const updateCustomValues = () => {
      let w = parseInt(customWInput?.value, 10);
      let h = parseInt(customHInput?.value, 10);
      if (isNaN(w) || w < 1) w = 1080;
      if (w > 4096) w = 4096;
      if (isNaN(h) || h < 1) h = 1080;
      if (h > 4096) h = 4096;

      if (customWInput) customWInput.value = w;
      if (customHInput) customHInput.value = h;
      this.lastCustomW = w;
      this.lastCustomH = h;
      localStorage.setItem('vectura_last_custom_w', w);
      localStorage.setItem('vectura_last_custom_h', h);

      if (customIconSlot) {
        customIconSlot.innerHTML = getDashedRatioIconHtml(w, h);
      }
    };

    customWInput?.addEventListener('change', updateCustomValues);
    customHInput?.addEventListener('change', updateCustomValues);
    customWInput?.addEventListener('input', () => {
      const w = Math.max(1, Math.min(4096, parseInt(customWInput.value, 10) || 1));
      const h = Math.max(1, Math.min(4096, parseInt(customHInput.value, 10) || 1));
      if (customIconSlot) customIconSlot.innerHTML = getDashedRatioIconHtml(w, h);
    });
    customHInput?.addEventListener('input', () => {
      const w = Math.max(1, Math.min(4096, parseInt(customWInput.value, 10) || 1));
      const h = Math.max(1, Math.min(4096, parseInt(customHInput.value, 10) || 1));
      if (customIconSlot) customIconSlot.innerHTML = getDashedRatioIconHtml(w, h);
    });

    // Prevent clicking inside inputs from triggering row click
    customInputsWrap?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Pencil button focuses width input for quick typing
    this.screenEl.querySelector('#nc-custom-pencil-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      customWInput?.focus();
      customWInput?.select();
    });

    const submitCustom = () => {
      updateCustomValues();
      this.createAndOpenProject(this.lastCustomW, this.lastCustomH);
    };

    customWInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCustom();
    });
    customHInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCustom();
    });

    this.screenEl.querySelector('#nc-custom-create-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      submitCustom();
    });

    this.screenEl.querySelector('#nc-row-custom')?.addEventListener('click', () => {
      submitCustom();
    });

    // Preset rows and chevron toggle handlers
    this.screenEl.querySelectorAll('.preset-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const chevronBtn = e.target.closest('.new-canvas-chevron-btn');
        if (chevronBtn) {
          e.stopPropagation();
          const targetId = chevronBtn.dataset.target;
          const sublist = this.screenEl.querySelector(`#${targetId}`);
          if (sublist) {
            const isOpen = sublist.classList.toggle('open');
            chevronBtn.classList.toggle('open', isOpen);
          }
          return;
        }

        const w = parseInt(row.dataset.w, 10);
        const h = parseInt(row.dataset.h, 10);
        this.createAndOpenProject(w, h);
      });
    });

    // Alternative resolution sub-rows
    this.screenEl.querySelectorAll('.preset-subrow-item').forEach(subrow => {
      subrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const w = parseInt(subrow.dataset.w, 10);
        const h = parseInt(subrow.dataset.h, 10);
        this.createAndOpenProject(w, h);
      });
    });

    // Setup memory warning dialog actions
    this.setupMemoryWarningEvents();
  }

  setupMemoryWarningEvents() {
    const warnModal = this.screenEl.querySelector('#nc-memory-warning');
    this.screenEl.querySelector('#nc-warn-cancel')?.addEventListener('click', () => {
      warnModal?.classList.remove('open');
    });

    this.screenEl.querySelector('#nc-warn-continue')?.addEventListener('click', () => {
      warnModal?.classList.remove('open');
      if (this.pendingDimensions) {
        this.doCreateProject(this.pendingDimensions.width, this.pendingDimensions.height);
        this.pendingDimensions = null;
      }
    });

    this.screenEl.querySelector('#nc-warn-suggested')?.addEventListener('click', () => {
      warnModal?.classList.remove('open');
      this.pendingDimensions = null;
      this.doCreateProject(2048, 2048);
    });
  }

  showMemoryWarning(width, height) {
    this.pendingDimensions = { width, height };
    const warnModal = this.screenEl.querySelector('#nc-memory-warning');
    const warnMsg = this.screenEl.querySelector('#nc-warn-message');
    const mp = (width * height / 1000000).toFixed(1);

    if (warnMsg) {
      warnMsg.textContent = `Canvas size (${width} × ${height}, ${mp} MP) is very large. On devices with limited RAM, multiple layers or high-resolution brushes may run slower.`;
    }

    if (warnModal) {
      warnModal.classList.add('open');
    }
  }

  createAndOpenProject(width, height) {
    let w = parseInt(width, 10) || 1080;
    let h = parseInt(height, 10) || 1080;
    w = Math.max(1, Math.min(4096, w));
    h = Math.max(1, Math.min(4096, h));

    // Warn gently if canvas size exceeds device memory (~12.5 MP)
    if (w * h > 12500000) {
      this.showMemoryWarning(w, h);
      return;
    }

    this.doCreateProject(w, h);
  }

  doCreateProject(width, height) {
    this.closeModal();
    this.hide();
    this.onNewProject?.({ width, height });
  }

  openModal() {
    const modal = this.screenEl.querySelector('#hs-modal');
    if (!modal) return;

    // Refresh custom inputs with remembered size
    const customWInput = this.screenEl.querySelector('#nc-custom-w');
    const customHInput = this.screenEl.querySelector('#nc-custom-h');
    const customIconSlot = this.screenEl.querySelector('#nc-custom-icon-slot');

    if (customWInput) customWInput.value = this.lastCustomW;
    if (customHInput) customHInput.value = this.lastCustomH;
    if (customIconSlot) {
      customIconSlot.innerHTML = getDashedRatioIconHtml(this.lastCustomW, this.lastCustomH);
    }

    modal.classList.add('open');
  }

  closeModal() {
    const modal = this.screenEl.querySelector('#hs-modal');
    if (modal) modal.classList.remove('open');
  }

  async refresh() {
    this.projects = await this.storage.getAllProjects();
    const countBadge = this.screenEl.querySelector('#hs-count-badge');
    if (countBadge) countBadge.textContent = this.projects.length;

    const grid = this.screenEl.querySelector('#hs-gallery-grid');
    if (!grid) return;

    if (this.projects.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 260px; color: var(--text-2); gap: 10px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span style="font-size: var(--text-body); font-weight: 500;">No saved artworks</span>
          <button id="hs-first-new-btn" class="btn-text accent" style="margin-top: 6px;">+ Create canvas</button>
        </div>
      `;
      grid.querySelector('#hs-first-new-btn')?.addEventListener('click', () => {
        this.openModal();
      });
      return;
    }

    grid.innerHTML = this.projects
      .map(p => {
        const safeName = (p.name || 'Untitled Artwork')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        const thumbHtml = p.thumbnail
          ? `<div class="gallery-card-thumb-wrap">
              <img class="gallery-card-thumb" src="${p.thumbnail}" alt="${safeName}" />
            </div>`
          : `<div class="gallery-card-thumb-wrap">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-3);">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>`;
        return `
        <div class="gallery-card" data-id="${p.id}">
          ${thumbHtml}
          <div class="gallery-card-info">
            <div class="gallery-card-title-row">
              <span class="gallery-card-title">${safeName}</span>
              <button class="btn-icon hs-del-btn" data-id="${p.id}" style="width: 26px; height: 26px; min-width: 26px; color: var(--danger); padding: 0;" title="Delete">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <span class="gallery-card-meta tabular">${new Date(p.updatedAt).toLocaleDateString()} · ${p.width} × ${p.height}</span>
          </div>
        </div>
      `;
      })
      .join('');

    grid.querySelectorAll('.gallery-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.hs-del-btn')) return;
        const id = card.dataset.id;
        const project = this.projects.find(p => p.id === id);
        if (project) {
          this.hide();
          this.onOpenProject?.(project);
        }
      });
    });

    grid.querySelectorAll('.hs-del-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Delete this artwork?')) {
          await this.storage.deleteProject(id);
          await this.refresh();
        }
      });
    });
  }

  show() {
    this.screenEl.classList.remove('hidden');
    this.refresh();
  }

  hide() {
    this.screenEl.classList.add('hidden');
  }
}

/* --- UIManager.js --- */
/**
 * Vectura UI Manager
 * Master UI coordinator connecting top bar, edge sliders, tool strip, bottom toolbar, and sheets.
 * Follows exact specifications:
 * - 48px top bar with projects, undo, redo, project name rename, export, more menu.
 * - Zoom & rotation chips in workspace.
 * - Draggable vertical edge sliders cluster (Size & Opacity) snapping to left/right edge.
 * - 44px contextual tool options strip.
 * - 56px bottom toolbar with 8 equal items.
 * - Non-modal bottom sheets (Brush, Colour, Layers) with 4x32 drag handles.
 */






const LAYOUT_STORAGE_KEY = 'vectura_ui_layout_v2';

class UIManager {
  constructor(app) {
    this.app = app;
    this.vc = app.vectorCanvas;

    this.activeSheet = null; // 'layers' | 'brushes' | 'color'
    this.activeTool = 'brush';
    this.zoomChipTimer = null;

    this.savedLayout = this.loadLayout();

    this.initElements();
    this.initPanels();
    this.setupEventListeners();
    this.setupEdgeSlidersDragAndTrack();
    this.setupSheetGestures();
    this.setupViewportFeedback();
    this.applySavedLayout();
  }

  loadLayout() {
    try {
      const data = localStorage.getItem(LAYOUT_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (_) {
      return {};
    }
  }

  saveLayout() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(this.savedLayout));
    } catch (_) {}
  }

  resetLayout() {
    this.savedLayout = {};
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch (_) {}

    if (this.edgeSlidersCluster) {
      this.edgeSlidersCluster.classList.remove('on-right');
      this.edgeSlidersCluster.style.left = '8px';
      this.edgeSlidersCluster.style.right = 'auto';
      this.edgeSlidersCluster.style.top = '50%';
      this.edgeSlidersCluster.style.transform = 'translateY(-50%)';
    }
  }

  applySavedLayout() {
    if (this.savedLayout.edgeSliders && this.edgeSlidersCluster) {
      const es = this.savedLayout.edgeSliders;
      if (es.side === 'right') {
        this.edgeSlidersCluster.classList.add('on-right');
        this.edgeSlidersCluster.style.left = 'auto';
        this.edgeSlidersCluster.style.right = '8px';
      } else {
        this.edgeSlidersCluster.classList.remove('on-right');
        this.edgeSlidersCluster.style.left = '8px';
        this.edgeSlidersCluster.style.right = 'auto';
      }
      this.edgeSlidersCluster.style.top = '50%';
      this.edgeSlidersCluster.style.transform = 'translateY(-50%)';
    }
  }

  initElements() {
    this.topBar = document.getElementById('top-bar');
    this.bottomToolbar = document.getElementById('bottom-toolbar');
    this.toolStrip = document.getElementById('tool-options-strip');
    this.stripContent = document.getElementById('strip-content');
    this.moreMenuPopover = document.getElementById('more-menu-popover');
    this.edgeSlidersCluster = document.getElementById('edge-sliders-cluster');

    this.undoBtn = document.getElementById('btn-undo');
    this.redoBtn = document.getElementById('btn-redo');
    this.projectTitle = document.getElementById('project-title-display');

    // Zoom and Rotation chips
    this.zoomChip = document.getElementById('zoom-chip');
    this.rotationChip = document.getElementById('rotation-chip');

    // Bottom Sheets
    this.sheetLayers = document.getElementById('sheet-layers');
    this.sheetBrushes = document.getElementById('sheet-brushes');
    this.sheetColor = document.getElementById('sheet-color');

    // Modals
    this.exportModal = document.getElementById('export-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.canvasInfoModal = document.getElementById('canvas-info-modal');
  }

  initPanels() {
    // 1. Color Picker
    this.colorPicker = new ColorPicker(
      document.getElementById('sheet-color-content'),
      (hex) => {
        this.vc.currentColor = hex;
        this.updateColorAffordances(hex);
        if (this.brushPanel) {
          this.brushPanel.setColor(hex);
        }
        if (this.toolPanel) {
          this.toolPanel.drawBrushThumb();
        }
      },
      () => {
        this.closeSheets();
        this.selectTool('eyedropper', null);
      }
    );

    // 2. Layer Panel
    this.layerPanel = new LayerPanel(
      document.getElementById('sheet-layers-content'),
      this.vc.layerManager,
      () => {
        this.vc.layerManager.invalidateCaches();
        const active = this.vc.layerManager.getActiveLayer();
        this.vc.toolManager.setTool(this.activeTool, active);
        this.vc.render();
      },
      this.app.history
    );

    // 3. Brush Panel
    this.brushPanel = new BrushPanel(
      document.getElementById('sheet-brushes-content'),
      this.vc.currentBrush,
      (brush) => {
        this.vc.currentBrush = brush;
        this.updateEdgeSlidersFromBrush();
        if (this.toolPanel) {
          this.toolPanel.render();
        }
      },
      this.vc.currentColor
    );

    // 4. Tool Options Strip Panel
    this.toolPanel = new ToolPanel(
      this.stripContent,
      this.vc.toolManager,
      (action) => {
        if (action === 'transform-apply') {
          this.vc.redrawActiveLayer();
          this.selectTool('brush', 'bar-btn-brush');
        } else if (action === 'transform-cancel') {
          this.selectTool('brush', 'bar-btn-brush');
        }
      },
      this.app
    );
    this.toolPanel.setApp(this.app);
    this.toolPanel.update('brush');

    // Auto-revert callback (e.g. after committing transform or clicking outside)
    this.vc.onToolAutoReverted = (tool) => {
      this.selectTool(tool, tool === 'brush' ? 'bar-btn-brush' : null);
      this.toolPanel?.update(tool);
    };

    // 5. Settings Dialog
    this.settingsDialog = new SettingsDialog(
      this.settingsModal,
      this.app.config,
      (key, val) => this.app.onConfigChanged(key, val),
      () => this.resetLayout()
    );
  }

  setupEventListeners() {
    // 1. Top Bar Actions
    document.getElementById('btn-home')?.addEventListener('click', () => {
      this.closeSheets();
      this.closeMoreMenu();
      this.app.openGallery();
    });

    this.undoBtn?.addEventListener('click', () => this.app.undo());
    this.redoBtn?.addEventListener('click', () => this.app.redo());

    // Rename project on title tap
    this.projectTitle?.addEventListener('click', () => {
      const cur = this.app.currentProject?.name || 'Artwork 1';
      const newName = prompt('Rename Artwork:', cur);
      if (newName && newName.trim()) {
        if (this.app.currentProject) {
          this.app.currentProject.name = newName.trim();
        }
        this.projectTitle.textContent = newName.trim();
        this.app.saveCurrentProject();
      }
    });

    // Export button
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.closeSheets();
      this.closeMoreMenu();
      this.openExportModal();
    });

    // More (3 dots) menu toggle
    document.getElementById('btn-more-menu')?.addEventListener('click', () => {
      this.toggleMoreMenu();
    });

    // More menu options
    document.getElementById('menu-btn-settings')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.settingsDialog.open();
    });

    document.getElementById('menu-btn-canvas-info')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.openCanvasInfoModal();
    });

    document.getElementById('menu-btn-flip-view')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.vc.viewport.toggleMirror();
    });

    document.getElementById('menu-btn-guides')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.vc.toolManager.rulerGuides.toggle();
    });

    document.getElementById('menu-btn-reset-view')?.addEventListener('click', () => {
      this.closeMoreMenu();
      this.vc.viewport.fitToScreen();
      this.hideChips();
    });

    // Close more menu & shapes popover when tapping outside
    window.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#more-menu-popover, #btn-more-menu')) {
        this.closeMoreMenu();
      }
      if (!e.target.closest('#shapes-popover-menu, #top-btn-shapes')) {
        document.getElementById('shapes-popover-menu')?.classList.add('hidden');
      }
    });

    // TOP PANEL TOOLS (Box Select, Transform, Shapes, Guides, Symmetry)
    document.getElementById('top-btn-box-select')?.addEventListener('click', () => {
      this.selectTool('selection', 'top-btn-box-select');
    });

    document.getElementById('top-btn-transform')?.addEventListener('click', () => {
      const activeLayer = this.vc.layerManager.getActiveLayer();
      if (!this.vc.toolManager.transformTool.active && activeLayer) {
        const patch = this.vc.toolManager.selectionTool.hasSelection
          ? this.vc.toolManager.selectionTool.cutSelectedPixels(activeLayer)
          : null;
        this.vc.toolManager.transformTool.activate(activeLayer, patch);
        this.vc.toolManager.selectionTool.clear();
      }
      this.selectTool('transform', 'top-btn-transform');
    });

    document.getElementById('top-btn-shapes')?.addEventListener('click', () => {
      this.selectTool('shape', 'top-btn-shapes');
      const popover = document.getElementById('shapes-popover-menu');
      if (popover) {
        popover.classList.toggle('hidden');
      }
    });

    document.querySelectorAll('.shapes-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const shape = item.dataset.shape || 'rect';
        this.vc.toolManager.shapeTool.setShape(shape);
        document.getElementById('shapes-popover-menu')?.classList.add('hidden');
        this.selectTool('shape', 'top-btn-shapes');
      });
    });

    document.getElementById('top-btn-guides')?.addEventListener('click', () => {
      this.vc.toolManager.rulerGuides.toggle();
      const mode = this.vc.toolManager.rulerGuides.mode;
      const label = document.getElementById('top-guides-label');
      if (label) {
        label.textContent = mode === 'off' ? 'Guides' : (mode.charAt(0).toUpperCase() + mode.slice(1));
      }
      document.getElementById('top-btn-guides')?.classList.toggle('active', mode !== 'off');
    });

    document.getElementById('top-btn-symmetry')?.addEventListener('click', () => {
      const mode = this.vc.toolManager.symmetry.toggle();
      const isActive = mode !== 'off';
      document.getElementById('top-btn-symmetry')?.classList.toggle('active', isActive);
      const label = document.getElementById('top-symmetry-label');
      if (label) {
        label.textContent = mode === 'off' ? 'Symmetry' : (mode.charAt(0).toUpperCase() + mode.slice(1));
      }
      if (isActive) {
        this.toolPanel?.update('symmetry');
      } else {
        this.toolPanel?.update(this.activeTool);
      }
      this.vc.needsRender = true;
    });

    // BOTTOM TOOLBAR BUTTONS (Pen/Brush, Eraser, Smudge, Fill, Lasso, Colour, Layers)
    const toolbarItems = [
      { id: 'bar-btn-brush', tool: 'brush' },
      { id: 'bar-btn-eraser', tool: 'eraser' },
      { id: 'bar-btn-smudge', tool: 'smudge' },
      { id: 'bar-btn-fill', tool: 'bucket' },
      { id: 'bar-btn-lasso', tool: 'lasso-fill' }
    ];

    for (const item of toolbarItems) {
      const btn = document.getElementById(item.id);
      if (!btn) continue;

      btn.addEventListener('click', () => {
        if (item.tool === 'brush' && this.activeTool === 'brush') {
          // Second tap on active Brush opens Brush Studio sheet
          this.toggleSheet('brushes');
          return;
        }
        this.selectTool(item.tool, item.id);
      });
    }

    // Colour Swatch Button -> Colour Sheet
    document.getElementById('bar-btn-color')?.addEventListener('click', () => {
      this.toggleSheet('color');
    });

    // Layers Button -> Layers Sheet
    document.getElementById('bar-btn-layers')?.addEventListener('click', () => {
      this.toggleSheet('layers');
    });

    // Sheet close buttons
    document.querySelectorAll('.sheet-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeSheets());
    });

    // Header tabs inside sheets
    document.getElementById('bp-tab-library')?.addEventListener('click', () => {
      this.brushPanel.activeTab = 'library';
    });
    document.getElementById('bp-tab-settings')?.addEventListener('click', () => {
      this.brushPanel.activeTab = 'settings';
    });

    ['disc', 'classic', 'sliders', 'palettes'].forEach(t => {
      document.getElementById(`cp-tab-${t}`)?.addEventListener('click', () => {
        this.colorPicker.setTab(t);
      });
    });

    // Rotation chip tap resets rotation to 0
    this.rotationChip?.addEventListener('click', () => {
      this.vc.viewport.rotation = 0;
      this.rotationChip.classList.add('fade-out');
    });

    // Export Modal buttons
    this.setupExportEvents();

    // Android back button
    window.handleAndroidBack = () => {
      if (this.moreMenuPopover?.classList.contains('open')) {
        this.closeMoreMenu();
        return true;
      }
      if (this.activeSheet) {
        this.closeSheets();
        return true;
      }
      if (this.exportModal?.classList.contains('open')) {
        this.exportModal.classList.remove('open');
        return true;
      }
      if (this.canvasInfoModal?.classList.contains('open')) {
        this.canvasInfoModal.classList.remove('open');
        return true;
      }
      if (this.settingsModal?.classList.contains('open')) {
        this.settingsDialog.close();
        return true;
      }
      if (!document.getElementById('home-screen').classList.contains('hidden')) {
        return false;
      }
      this.app.openGallery();
      return true;
    };
  }

  selectTool(toolName, btnId) {
    this.activeTool = toolName;
    this.vc.toolManager.setTool(toolName, this.vc.layerManager.getActiveLayer());

    document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.top-panel-btn').forEach(b => {
      if (b.id !== 'top-btn-guides' && b.id !== 'top-btn-symmetry') {
        b.classList.remove('active');
      }
    });

    if (btnId) {
      document.getElementById(btnId)?.classList.add('active');
    }

    this.updateTopPanelContext(toolName);
  }

  updateTopPanelContext(toolName) {
    const ctxEl = document.getElementById('top-panel-context');
    if (!ctxEl) return;

    if (toolName === 'selection') {
      ctxEl.classList.remove('hidden');
      ctxEl.innerHTML = `
        <button class="context-chip" id="ctx-btn-deselect">Deselect</button>
        <button class="context-chip primary" id="ctx-btn-cut-move">Transform</button>
        <button class="context-chip" id="ctx-btn-invert">Invert</button>
        <button class="context-chip" id="ctx-btn-clear">Clear</button>
      `;

      ctxEl.querySelector('#ctx-btn-deselect')?.addEventListener('click', () => {
        this.vc.toolManager.selectionTool.clear();
      });
      ctxEl.querySelector('#ctx-btn-cut-move')?.addEventListener('click', () => {
        const activeLayer = this.vc.layerManager.getActiveLayer();
        if (activeLayer && this.vc.toolManager.selectionTool.hasSelection) {
          const patch = this.vc.toolManager.selectionTool.cutSelectedPixels(activeLayer);
          this.vc.toolManager.transformTool.activate(activeLayer, patch);
          this.vc.toolManager.selectionTool.clear();
          this.selectTool('transform', 'top-btn-transform');
        }
      });
      ctxEl.querySelector('#ctx-btn-invert')?.addEventListener('click', () => {
        this.vc.toolManager.selectionTool.invert(this.vc.docWidth, this.vc.docHeight);
      });
      ctxEl.querySelector('#ctx-btn-clear')?.addEventListener('click', () => {
        const activeLayer = this.vc.layerManager.getActiveLayer();
        if (activeLayer) {
          this.vc.toolManager.selectionTool.clearSelectedArea(activeLayer);
        }
      });
    } else if (toolName === 'transform') {
      ctxEl.classList.remove('hidden');
      ctxEl.innerHTML = `
        <button class="context-chip" id="ctx-btn-fliph">Flip H</button>
        <button class="context-chip" id="ctx-btn-flipv">Flip V</button>
        <button class="context-chip primary" id="ctx-btn-apply">Done</button>
        <button class="context-chip" id="ctx-btn-cancel">Cancel</button>
      `;

      ctxEl.querySelector('#ctx-btn-fliph')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.flipH();
      });
      ctxEl.querySelector('#ctx-btn-flipv')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.flipV();
      });
      ctxEl.querySelector('#ctx-btn-apply')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.applyTransform();
        this.selectTool('brush', 'bar-btn-brush');
      });
      ctxEl.querySelector('#ctx-btn-cancel')?.addEventListener('click', () => {
        this.vc.toolManager.transformTool.cancel();
        this.selectTool('brush', 'bar-btn-brush');
      });
    } else {
      ctxEl.classList.add('hidden');
      ctxEl.innerHTML = '';
    }
  }

  toggleMoreMenu() {
    this.moreMenuPopover?.classList.toggle('open');
  }

  closeMoreMenu() {
    this.moreMenuPopover?.classList.remove('open');
  }

  toggleSheet(name) {
    if (this.activeSheet === name) {
      this.closeSheets();
    } else {
      this.openSheet(name);
    }
  }

  openSheet(name) {
    this.closeSheets();
    this.activeSheet = name;

    const map = {
      brushes: this.sheetBrushes,
      color: this.sheetColor,
      layers: this.sheetLayers
    };

    const sheet = map[name];
    if (sheet) {
      sheet.style.transform = '';
      sheet.classList.add('open');
      if (name === 'layers') this.layerPanel.render();
      if (name === 'brushes') this.brushPanel.render();
      if (name === 'color') this.colorPicker.render();
    }
  }

  closeSheets() {
    this.activeSheet = null;
    [this.sheetBrushes, this.sheetColor, this.sheetLayers].forEach(s => {
      if (s) {
        s.classList.remove('open');
        s.style.transform = '';
        s.style.maxHeight = '';
      }
    });
  }

  setupSheetGestures() {
    [this.sheetBrushes, this.sheetColor, this.sheetLayers].forEach(sheet => {
      if (!sheet) return;
      const handleZone = sheet.querySelector('.sheet-drag-handle-zone');
      if (!handleZone) return;

      let startY = 0;
      let isDragging = false;
      let startHeight = 0;

      handleZone.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startHeight = sheet.getBoundingClientRect().height;
        sheet.style.transition = 'none';
        try { handleZone.setPointerCapture(e.pointerId); } catch (_) {}
      });

      handleZone.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dy = e.clientY - startY;
        if (dy > 0) {
          sheet.style.transform = `translateY(${dy}px)`;
        } else {
          const newH = Math.min(window.innerHeight * 0.9, startHeight - dy);
          sheet.style.maxHeight = `${newH}px`;
        }
      });

      const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = '';
        const dy = e.clientY - startY;

        if (dy > 100) {
          // Closed snap point
          this.closeSheets();
        } else if (dy > 30) {
          // 40% snap point
          sheet.style.transform = 'translateY(0)';
          sheet.style.maxHeight = '40vh';
        } else if (dy < -40) {
          // 70% or full snap point
          sheet.style.transform = 'translateY(0)';
          sheet.style.maxHeight = '70vh';
        } else {
          sheet.style.transform = 'translateY(0)';
        }
      };

      handleZone.addEventListener('pointerup', onEnd);
      handleZone.addEventListener('pointercancel', onEnd);
    });
  }

  /**
   * 3. Edge sliders (size and opacity)
   * Two vertical sliders on left edge (x = 8px)
   * 32px hit area, 4px track, fill in --accent, 20px circular thumb.
   * Grip handle above cluster (44x16, grip dots) drags to left/right edge.
   */
  setupEdgeSlidersDragAndTrack() {
    const cluster = this.edgeSlidersCluster;
    const grip = document.getElementById('sliders-grip');
    if (!cluster || !grip) return;

    // Fixed to center vertically: top: 50%; transform: translateY(-50%)
    cluster.style.top = '50%';
    cluster.style.transform = 'translateY(-50%)';

    // Tap/click on grip handle switches side between left and right
    grip.addEventListener('click', () => {
      const isRight = cluster.classList.contains('on-right') || cluster.style.right === '8px';
      if (isRight) {
        cluster.classList.remove('on-right');
        cluster.style.left = '8px';
        cluster.style.right = 'auto';
      } else {
        cluster.classList.add('on-right');
        cluster.style.left = 'auto';
        cluster.style.right = '8px';
      }
      cluster.style.top = '50%';
      cluster.style.transform = 'translateY(-50%)';

      this.savedLayout.edgeSliders = {
        side: isRight ? 'left' : 'right'
      };
      this.saveLayout();
    });

    // Size slider interaction dynamically clamped to brush minSize/maxSize (never 0)
    this.bindVerticalTrack(
      document.getElementById('track-wrap-size'),
      document.getElementById('thumb-size'),
      document.getElementById('track-fill-size'),
      document.getElementById('bubble-size'),
      document.getElementById('slider-col-size'),
      () => Math.max(1, Math.round(this.vc.currentBrush?.minSize || 1)),
      () => Math.max(Math.max(1, Math.round(this.vc.currentBrush?.minSize || 1)) + 1, Math.round(this.vc.currentBrush?.maxSize || 200)),
      () => Math.max(1, Math.round(this.vc.currentBrush?.size || 8)),
      (val) => {
        if (this.vc.currentBrush) {
          const min = Math.max(1, Math.round(this.vc.currentBrush.minSize || 1));
          const max = Math.max(min + 1, Math.round(this.vc.currentBrush.maxSize || 200));
          const clamped = Math.max(min, Math.min(max, val));
          this.vc.currentBrush.size = clamped;
        }
      },
      (val) => `${val} px`
    );

    // Opacity slider interaction (1 to 100 %)
    this.bindVerticalTrack(
      document.getElementById('track-wrap-opacity'),
      document.getElementById('thumb-opacity'),
      document.getElementById('track-fill-opacity'),
      document.getElementById('bubble-opacity'),
      document.getElementById('slider-col-opacity'),
      1, 100, 100,
      (val) => {
        if (this.vc.currentBrush) {
          this.vc.currentBrush.opacity = Math.max(0.01, Math.min(1.0, val / 100));
        }
      },
      (val) => `${val}%`
    );
  }

  bindVerticalTrack(wrap, thumb, fill, bubble, colEl, min, max, initial, onChange, formatBubble) {
    if (!wrap || !thumb) return;

    const getMin = () => typeof min === 'function' ? min() : min;
    const getMax = () => typeof max === 'function' ? max() : max;

    let currentValue = typeof initial === 'function' ? initial() : initial;
    let fadeTimer = null;

    const updateVisual = (val) => {
      const curMin = getMin();
      const curMax = getMax();
      const pct = Math.max(0, Math.min(1, (val - curMin) / (curMax - curMin)));
      const pctStr = `${Math.round(pct * 100)}%`;
      thumb.style.bottom = pctStr;
      if (fill) fill.style.height = pctStr;
      if (bubble) bubble.textContent = formatBubble(val);
    };

    const handlePointer = (e) => {
      const rect = wrap.getBoundingClientRect();
      const clampedY = Math.max(rect.top, Math.min(rect.bottom, e.clientY));
      const normalized = 1.0 - (clampedY - rect.top) / rect.height;
      const curMin = getMin();
      const curMax = getMax();
      currentValue = Math.max(curMin, Math.min(curMax, Math.round(curMin + normalized * (curMax - curMin))));
      updateVisual(currentValue);
      onChange(currentValue);
    };

    let isDown = false;
    wrap.addEventListener('pointerdown', (e) => {
      isDown = true;
      colEl?.classList.add('dragging');
      if (fadeTimer) clearTimeout(fadeTimer);
      bubble?.classList.add('visible');
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
      handlePointer(e);
    });

    wrap.addEventListener('pointermove', (e) => {
      if (isDown) {
        if (fadeTimer) clearTimeout(fadeTimer);
        bubble?.classList.add('visible');
        handlePointer(e);
      }
    });

    const onEnd = () => {
      if (isDown) {
        isDown = false;
        colEl?.classList.remove('dragging');
        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => {
          bubble?.classList.remove('visible');
        }, 600);
      }
    };

    wrap.addEventListener('pointerup', onEnd);
    wrap.addEventListener('pointercancel', onEnd);

    updateVisual(currentValue);
  }

  updateEdgeSlidersFromBrush() {
    const b = this.vc.currentBrush;
    if (!b) return;

    // Enforce and clamp size within brush minSize & maxSize
    const minSize = Math.max(1, Math.round(b.minSize || 1));
    const maxSize = Math.max(minSize + 1, Math.round(b.maxSize || 200));
    b.size = Math.max(minSize, Math.min(maxSize, b.size || 8));

    const thumbSize = document.getElementById('thumb-size');
    const fillSize = document.getElementById('track-fill-size');
    const bubbleSize = document.getElementById('bubble-size');
    const pctSize = Math.max(0, Math.min(1, (b.size - minSize) / (maxSize - minSize)));
    if (thumbSize) thumbSize.style.bottom = `${Math.round(pctSize * 100)}%`;
    if (fillSize) fillSize.style.height = `${Math.round(pctSize * 100)}%`;
    if (bubbleSize) bubbleSize.textContent = `${Math.round(b.size)} px`;

    // Opacity
    const opac = Math.round((b.opacity ?? 1.0) * 100);
    const thumbOpac = document.getElementById('thumb-opacity');
    const fillOpac = document.getElementById('track-fill-opacity');
    const bubbleOpac = document.getElementById('bubble-opacity');
    if (thumbOpac) thumbOpac.style.bottom = `${opac}%`;
    if (fillOpac) fillOpac.style.height = `${opac}%`;
    if (bubbleOpac) bubbleOpac.textContent = `${opac}%`;
  }

  setupViewportFeedback() {
    const vp = this.vc?.viewport;
    if (!vp) return;

    vp.onNavigate = (zoom, rotation) => {
      if (this.zoomChip) {
        this.zoomChip.textContent = `${Math.round(zoom * 100)}%`;
        this.zoomChip.classList.remove('fade-out');
        if (this.zoomChipTimer) clearTimeout(this.zoomChipTimer);
        this.zoomChipTimer = setTimeout(() => {
          this.zoomChip?.classList.add('fade-out');
        }, 1000);
      }

      if (this.rotationChip) {
        const deg = Math.round((rotation * 180 / Math.PI) % 360);
        if (Math.abs(deg) > 1) {
          this.rotationChip.textContent = `${deg}°`;
          this.rotationChip.classList.remove('fade-out');
        } else {
          this.rotationChip.classList.add('fade-out');
        }
      }
    };
  }

  hideChips() {
    this.zoomChip?.classList.add('fade-out');
    this.rotationChip?.classList.add('fade-out');
  }

  updateColorAffordances(hex) {
    const primary = document.getElementById('swatch-primary');
    if (primary) primary.style.background = hex;
  }

  updateLayerBadge() {
    // No-op or update badge if present
  }

  openExportModal() {
    this.exportModal?.classList.add('open');
  }

  openCanvasInfoModal() {
    const w = this.vc.docWidth || 1080;
    const h = this.vc.docHeight || 1080;
    const layers = this.vc.layerManager?.layers?.length || 1;
    const dimsEl = document.getElementById('info-dims');
    const layersEl = document.getElementById('info-layers-count');
    if (dimsEl) dimsEl.textContent = `${w} × ${h} px`;
    if (layersEl) layersEl.textContent = `${layers}`;
    this.canvasInfoModal?.classList.add('open');
  }

  setupExportEvents() {
    document.getElementById('exp-close-btn')?.addEventListener('click', () => {
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('info-close-btn')?.addEventListener('click', () => {
      this.canvasInfoModal?.classList.remove('open');
    });

    this.exportModal?.addEventListener('click', (e) => {
      if (e.target === this.exportModal) {
        this.exportModal.classList.remove('open');
      }
    });

    this.canvasInfoModal?.addEventListener('click', (e) => {
      if (e.target === this.canvasInfoModal) {
        this.canvasInfoModal.classList.remove('open');
      }
    });

    document.getElementById('exp-btn-png-1x')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const blob = await this.app.exporter.exportRaster('image/png', 0.95, false, 1);
      if (blob) {
        await this.app.exporter.shareOrDownload(blob, `${name}.png`, 'image/png');
      }
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('exp-btn-png-4x')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const blob = await this.app.exporter.exportRaster('image/png', 0.95, false, 4);
      if (blob) {
        await this.app.exporter.shareOrDownload(blob, `${name}_4x.png`, 'image/png');
      }
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('exp-btn-svg')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const svgStr = this.app.exporter.exportSVG(false);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      await this.app.exporter.shareOrDownload(blob, `${name}.svg`, 'image/svg+xml');
      this.exportModal?.classList.remove('open');
    });

    document.getElementById('exp-btn-json')?.addEventListener('click', async () => {
      const name = (this.app.currentProject?.name || 'artwork').replace(/\s+/g, '_');
      const data = JSON.stringify(this.app.currentProject || {}, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      await this.app.exporter.shareOrDownload(blob, `${name}.vectura`, 'application/json');
      this.exportModal?.classList.remove('open');
    });
  }

  updateHistoryState(state) {
    if (this.undoBtn) this.undoBtn.disabled = !state.canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !state.canRedo;
  }
}

/* --- app.js --- */
/**
 * Vectura Main Application Controller
 * Boots all subsystems, initializes VectorCanvas engine, history, storage, and UI.
 */











class VecturaApp {
  constructor() {
    this.storage = new IndexedDBStorage();
    this.history = new HistoryManager(200);

    this.currentProject = null;
    this.vectorCanvas = null;
    this.exporter = null;
    this.uiManager = null;
    this.homeScreen = null;

    // Studio Configuration
    this.config = {
      theme: 'dark',
      leftHanded: false,
      gesturesEnabled: true,
      palmRejection: true,
      haptics: true,
      perfMode: false,
      globalSpeedFactor: 1.0,
      reduceAnimations: false,
      fillAnimation: true,
      fillSpeed: 380
    };

    this.autosaveInterval = null;
    this.init();
  }

  async init() {
    const savedTheme = localStorage.getItem('vectura_theme') || this.config.theme || 'dark-oled';
    this.applyTheme(savedTheme);

    // 1. Initialize Canvas Viewport
    const canvasEl = document.getElementById('viewport-canvas');
    this.vectorCanvas = new VectorCanvas(canvasEl, 1080, 1080);
    this.vectorCanvas.history = this.history;
    this.vectorCanvas.globalSpeedFactor = this.config.globalSpeedFactor || 1.0;
    this.vectorCanvas.currentBrush = new Brush(DEFAULT_BRUSH_PRESETS[0]);

    // Connect cancel stroke callback to history so undo/redo cancels active stroke first
    this.history.setCancelStrokeHandler(() => this.vectorCanvas.cancelStroke());
    this.history.setLayerManager(this.vectorCanvas.layerManager);

    // 2. Setup Exporter
    this.exporter = new Exporter(this.vectorCanvas);

    // 3. Setup UI & Home Gallery
    this.uiManager = new UIManager(this);
    this.homeScreen = new HomeScreen(
      this.storage,
      (project) => this.loadProject(project),
      (options) => this.createNewProject(options)
    );

    // 4. Bind History changes to UI & autosave
    this.history.onChange((state) => {
      this.uiManager.updateHistoryState(state);
      this.markDirty();
    });

    // 5. Connect VectorCanvas callbacks
    this.vectorCanvas.onColorPicked = (hex) => {
      this.uiManager.updateColorAffordances(hex);
      this.uiManager.colorPicker.setColorHex(hex);
    };

    this.vectorCanvas.onUndoRequested = () => this.undo();
    this.vectorCanvas.onRedoRequested = () => this.redo();
    this.vectorCanvas.onHaptic = () => this.triggerHaptic();

    // 6. Setup Autosave & Lifecycle hooks
    this.setupAutosave();

    try {
      // 7. Load most recent project in background, and ALWAYS open on Project View (Artworks gallery)
      await this.loadInitialProject();
      if (this.homeScreen) {
        this.homeScreen.show();
      }

      // Android Lifecycle Hooks
      window.onAndroidPause = () => {
        this.saveCurrentProject();
      };
      window.onAndroidResume = () => {
        // Resumed
      };
    } catch (err) {
      console.warn('Vectura init error:', err);
    } finally {
      setTimeout(() => {
        this.hideSplash();
      }, 400);
    }
  }

  hideSplash() {
    const splash = document.getElementById('app-splash-screen');
    if (splash && !splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 350);
    }
  }

  async loadInitialProject() {
    try {
      const all = await this.storage.getAllProjects();
      if (all && all.length > 0) {
        all.sort((a, b) => b.updatedAt - a.updatedAt);
        await this.loadProject(all[0]);
      } else {
        await this.createNewProject({ width: 1080, height: 1080 });
      }
    } catch (_) {
      await this.createNewProject({ width: 1080, height: 1080 });
    }
  }

  async createNewProject(options = {}) {
    const w = options.width || 1080;
    const h = options.height || 1080;
    const name = options.name || 'Untitled Artwork';

    const project = {
      id: 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name,
      width: w,
      height: h,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layers: []
    };

    this.currentProject = project;
    this.vectorCanvas.setDocumentSize(w, h);
    this.vectorCanvas.layerManager.createInitialLayer();
    this.history.clear();

    if (this.uiManager) {
      this.uiManager.projectTitle.textContent = name;
      this.uiManager.updateLayerBadge();
      this.uiManager.closeSheets();
    }

    this.homeScreen.hide();
    this.vectorCanvas.viewport.fitToScreen();
    await this.saveCurrentProject();
  }

  async loadProject(project) {
    if (!project) return;
    this.currentProject = project;

    const w = project.width || 1080;
    const h = project.height || 1080;
    this.vectorCanvas.setDocumentSize(w, h);

    this.isLoadingLayers = true;
    try {
      if (project.layers && project.layers.length > 0) {
        const loadedLayers = await Promise.all(
          project.layers.map(async (lData) => {
            const l = new Layer(lData.id, lData.name, w, h, 'raster');
            l.visible = lData.visible ?? true;
            l.locked = lData.locked ?? false;
            l.opacity = lData.opacity ?? 1.0;
            l.blendMode = lData.blendMode || 'source-over';
            l.clippingMask = lData.clippingMask ?? false;
            l.alphaLock = lData.alphaLock ?? false;
            l.isReference = lData.isReference ?? false;
            l.strokes = lData.strokes || [];

            const source = lData.blob || lData.dataUrl;
            if (source) {
              await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  l.ctx.drawImage(img, 0, 0);
                  l.updateThumbnail();
                  if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
                  resolve();
                };
                img.onerror = () => {
                  if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
                  resolve();
                };
                if (source instanceof Blob) {
                  img.src = URL.createObjectURL(source);
                } else {
                  img.src = source;
                }
              });
            } else {
              this.vectorCanvas.redrawLayerStrokes(l);
            }
            return l;
          })
        );
        this.vectorCanvas.layerManager.layers = loadedLayers;
        this.vectorCanvas.layerManager.activeLayerId = project.activeLayerId || loadedLayers[0].id;
        this.vectorCanvas.layerManager.invalidateCaches();
      } else {
        this.vectorCanvas.layerManager.createInitialLayer();
      }
    } finally {
      this.isLoadingLayers = false;
    }

    this.history.clear();
    this.isDirty = false;

    if (this.uiManager) {
      this.uiManager.projectTitle.textContent = project.name || 'Untitled';
      this.uiManager.updateLayerBadge();
      this.uiManager.closeSheets();
    }

    this.homeScreen.hide();
    this.vectorCanvas.viewport.fitToScreen();
  }

  async saveCurrentProject() {
    if (!this.currentProject) return;
    if (this.isLoadingLayers) {
      console.warn('Skipping save: layer images are still loading');
      return;
    }
    if (this.vectorCanvas?.isDrawing) {
      console.warn('Skipping save: active stroke in progress');
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      this.currentProject.updatedAt = Date.now();
      this.currentProject.activeLayerId = this.vectorCanvas.layerManager.activeLayerId;

      // Convert layer canvases to Blobs for IndexedDB
      const layerBlobs = await Promise.all(
        this.vectorCanvas.layerManager.layers.map(l => {
          return new Promise(resolve => {
            if (l.canvas && typeof l.canvas.toBlob === 'function') {
              l.canvas.toBlob(blob => resolve(blob), 'image/png');
            } else {
              resolve(null);
            }
          });
        })
      );

      this.currentProject.layers = this.vectorCanvas.layerManager.layers.map((l, idx) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        clippingMask: l.clippingMask,
        alphaLock: l.alphaLock,
        isReference: l.isReference,
        strokes: l.strokes,
        blob: layerBlobs[idx]
      }));

      // Create thumbnail scaled to fit 160px preserving aspect ratio
      const maxThumb = 160;
      const docW = this.vectorCanvas.docWidth || 1;
      const docH = this.vectorCanvas.docHeight || 1;
      const scale = Math.min(maxThumb / docW, maxThumb / docH);
      const thumbW = Math.max(1, Math.round(docW * scale));
      const thumbH = Math.max(1, Math.round(docH * scale));

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.scale(scale, scale);
      this.vectorCanvas.layerManager.compositeToCanvas(tCtx, true);
      this.currentProject.thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.8);

      const success = await this.storage.saveProject(this.currentProject);
      if (!success) {
        this.showToast('Failed to save project');
      } else {
        this.isDirty = false;
      }
    } catch (saveErr) {
      console.error('Failed to save project:', saveErr);
      this.showToast('Save failed: ' + (saveErr.message || 'error'));
    } finally {
      this.isSaving = false;
    }
  }

  markDirty() {
    this.isDirty = true;
    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
    }
    this.autosaveTimeout = setTimeout(() => {
      this.checkAndAutosave();
    }, 10000); // Debounced ~10s after last change
  }

  checkAndAutosave() {
    if (!this.isDirty) return;
    if (this.vectorCanvas?.isDrawing || this.vectorCanvas?.isInteracting) {
      this.autosaveTimeout = setTimeout(() => this.checkAndAutosave(), 2500);
      return;
    }
    this.saveCurrentProject();
  }

  setupAutosave() {
    if (this.autosaveTimeout) clearTimeout(this.autosaveTimeout);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.isDirty) {
        this.saveCurrentProject();
      }
    });

    window.addEventListener('pagehide', () => {
      if (this.isDirty) {
        this.saveCurrentProject();
      }
    });
  }

  showToast(message) {
    if (window.AndroidBridge?.showToast) {
      window.AndroidBridge.showToast(message);
    } else {
      console.log('Toast:', message);
    }
  }

  undo() {
    this.triggerHaptic();
    this.history.undo();
  }

  redo() {
    this.triggerHaptic();
    this.history.redo();
  }

  openGallery() {
    this.saveCurrentProject();
    this.homeScreen.show();
  }

  triggerHaptic() {
    if (!this.config.haptics) return;
    if (window.AndroidBridge && window.AndroidBridge.hapticTick) {
      window.AndroidBridge.hapticTick();
    } else if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  }

  applyTheme(themeName) {
    const validThemes = ['dark-oled', 'grey', 'blue-grey', 'white', 'sepia'];
    let theme = themeName || 'dark-oled';
    if (theme === 'dark' || theme === 'oled') theme = 'dark-oled';
    if (theme === 'light') theme = 'white';
    if (!validThemes.includes(theme)) theme = 'dark-oled';

    for (const t of validThemes) {
      document.body.classList.remove(`theme-${t}`);
    }
    document.body.classList.remove('theme-light', 'theme-dark');

    document.body.classList.add(`theme-${theme}`);
    document.body.setAttribute('data-theme', theme);
    this.config.theme = theme;
    try {
      localStorage.setItem('vectura_theme', theme);
    } catch (_) {}
  }

  onConfigChanged(key, val) {
    if (key === 'theme') {
      this.applyTheme(val);
    } else if (key === 'leftHanded') {
      document.body.classList.toggle('left-handed', !!val);
    } else if (key === 'perfMode') {
      document.body.classList.toggle('perf-low-blur', !!val);
    } else if (key === 'palmRejection') {
      this.vectorCanvas.palmRejection = !!val;
    } else if (key === 'globalSpeedFactor') {
      this.vectorCanvas.globalSpeedFactor = val;
    } else if (key === 'reduceAnimations') {
      document.body.classList.toggle('reduce-animations', !!val);
    } else if (key === 'fillAnimation') {
      this.vectorCanvas.toolManager.fillBucket.animateFill = !!val;
    } else if (key === 'fillSpeed') {
      this.vectorCanvas.toolManager.fillBucket.animationDuration = parseInt(val, 10);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.vecturaApp = new VecturaApp();
});

})();
