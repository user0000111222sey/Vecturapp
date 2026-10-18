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
   * Generates smooth dense polyline samples from control points.
   */
  sampleStroke(controlPoints, adaptiveSteps = 8) {
    if (!controlPoints || controlPoints.length === 0) return [];
    if (controlPoints.length === 1) {
      const p = controlPoints[0];
      return [{ x: p.x, y: p.y, pressure: p.pressure || 0.5, time: p.time || 0, distance: 0 }];
    }
    if (controlPoints.length === 2) {
      const p0 = controlPoints[0];
      const p1 = controlPoints[1];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const steps = Math.max(4, Math.ceil(dist / 2));
      const samples = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        samples.push({
          x: p0.x + u * (p1.x - p0.x),
          y: p0.y + u * (p1.y - p0.y),
          pressure: p0.pressure + u * (p1.pressure - p0.pressure),
          time: p0.time + u * (p1.time - p0.time),
          distance: u * dist
        });
      }
      return samples;
    }

    const n = controlPoints.length;
    const samples = [];
    let accumulatedDist = 0;

    for (let i = 0; i < n - 1; i++) {
      const p0 = i === 0 ? controlPoints[0] : controlPoints[i - 1];
      const p1 = controlPoints[i];
      const p2 = controlPoints[i + 1];
      const p3 = i + 2 < n ? controlPoints[i + 2] : p2;

      const seg = this.interpolateSegment(p0, p1, p2, p3, adaptiveSteps);
      // Avoid duplicate boundary point between segments
      const startIdx = i === 0 ? 0 : 1;
      for (let j = startIdx; j < seg.length; j++) {
        const pt = seg[j];
        if (samples.length > 0) {
          const prev = samples[samples.length - 1];
          accumulatedDist += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        }
        pt.distance = accumulatedDist;
        samples.push(pt);
      }
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
 * Vectura Pressure Simulation & Handling Engine
 * Blends real stylus hardware pressure with velocity-calculated pressure.
 */
class PressureEngine {
  constructor(config = {}) {
    this.sensitivity = config.sensitivity ?? 1.2;     // Speed sensitivity
    this.smoothing = config.smoothing ?? 0.35;        // EMA filter factor (0 to 1)
    this.minPressure = config.minPressure ?? 0.15;    // Minimum pressure output
    this.maxPressure = config.maxPressure ?? 1.0;     // Maximum pressure output
    this.inverse = config.inverse ?? false;           // If true, faster = lighter; false = faster = heavier
    this.powerCurve = config.powerCurve ?? 1.0;       // Exponent curve (>1.0 for ease-in, <1.0 for ease-out)

    this.prevPoint = null;
    this.filteredSpeed = 0;
  }

  reset() {
    this.prevPoint = null;
    this.filteredSpeed = 0;
  }

  /**
   * Resolves final pressure (0.01 to 1.0) for a pointer event and world coordinate.
   */
  resolvePressure(event, currentPoint) {
    const isPen = event.pointerType === 'pen';
    const rawHardwarePressure = event.pressure;
    const hasHardware = isPen && rawHardwarePressure > 0 && rawHardwarePressure <= 1.0;

    // Calculate instantaneous velocity
    let velocityPressure = 0.5;
    const now = performance.now();

    if (this.prevPoint) {
      const dt = Math.max(1, now - this.prevPoint.time);
      const dx = currentPoint.x - this.prevPoint.x;
      const dy = currentPoint.y - this.prevPoint.y;
      const dist = Math.hypot(dx, dy);
      const speed = dist / dt; // pixels per millisecond

      // Exponential moving average for smooth velocity
      this.filteredSpeed = this.filteredSpeed * (1 - this.smoothing) + speed * this.smoothing;

      // Map filtered speed to pressure range
      // Standard drawing feel: medium stroke speed (~0.5 - 2 px/ms)
      const normalizedSpeed = Math.min(3.0, this.filteredSpeed * this.sensitivity) / 3.0;

      let mapped;
      if (this.inverse) {
        // Fast = thin, slow = thick (like fountain ink bleed)
        mapped = 1.0 - normalizedSpeed;
      } else {
        // Fast = thick, slow = thin
        mapped = normalizedSpeed;
      }

      // Apply power curve
      mapped = Math.pow(Math.max(0, Math.min(1, mapped)), this.powerCurve);

      velocityPressure = this.minPressure + mapped * (this.maxPressure - this.minPressure);
    } else {
      velocityPressure = (this.minPressure + this.maxPressure) / 2;
    }

    this.prevPoint = { x: currentPoint.x, y: currentPoint.y, time: now };

    if (hasHardware) {
      // If hardware pressure is available, apply custom curve and optionally blend
      return Math.max(0.02, Math.min(1.0, rawHardwarePressure));
    }

    return Math.max(0.02, Math.min(1.0, velocityPressure));
  }

  /**
   * Evaluates custom draggable bezier curve for pressure if configured on brush.
   * bezier: [p1x, p1y, p2x, p2y]
   */
  static evaluateCubicBezier(t, p1x = 0.25, p1y = 0.1, p2x = 0.25, p2y = 1.0) {
    // Standard cubic bezier lookup: B(t) from t=0 to 1
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    const sampleX = (u) => ((ax * u + bx) * u + cx) * u;
    const sampleY = (u) => ((ay * u + by) * u + cy) * u;

    // Solve for u given t using Newton-Raphson
    let u = t;
    for (let i = 0; i < 5; i++) {
      const currentX = sampleX(u) - t;
      if (Math.abs(currentX) < 1e-4) break;
      const slope = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(slope) < 1e-5) break;
      u -= currentX / slope;
      u = Math.max(0, Math.min(1, u));
    }
    return Math.max(0, Math.min(1, sampleY(u)));
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
 * Blender-style smooth 1D noise, non-random, deterministic from stroke seed.
 */
class CoherentNoise {
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
    this.snapThreshold = (3.5 * Math.PI) / 180; // 3.5 degrees snap

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
   * Rotates anchored around a screen center point (cx, cy).
   */
  rotateAt(deltaAngle, cx, cy) {
    if (Math.abs(deltaAngle) < 0.0001) return;

    let nextAngle = this.rotation + deltaAngle;

    // Normalize angle to [-PI, PI]
    while (nextAngle > Math.PI) nextAngle -= 2 * Math.PI;
    while (nextAngle < -Math.PI) nextAngle += 2 * Math.PI;

    // Soft snapping near 0 degrees (within threshold)
    let actualDelta = deltaAngle;
    if (Math.abs(nextAngle) < this.snapThreshold) {
      actualDelta = -this.rotation;
      nextAngle = 0;
    }

    // Anchor the rotation around the pinch center (cx, cy)
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
  constructor(id, name, width, height, type = 'vector') {
    this.id = id || ('layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
    this.name = name || 'Layer';
    this.type = type; // 'vector' | 'raster'
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
    // Draw scaled down
    this.thumbCtx.drawImage(
      this.canvas,
      0, 0, this.width, this.height,
      0, 0, 64, 64
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

    this.needsRecomposite = true;

    // Initialize default base layer
    this.createInitialLayer();
  }

  createInitialLayer() {
    const l1 = new Layer('layer_1', 'Layer 1', this.docWidth, this.docHeight, 'vector');
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

  getActiveLayer() {
    return this.layers.find(l => l.id === this.activeLayerId) || this.layers[0];
  }

  setActiveLayer(id) {
    if (this.layers.some(l => l.id === id)) {
      this.activeLayerId = id;
      this.updateAroundActiveCaches();
    }
  }

  addLayer(name = 'New Layer', type = 'vector') {
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
      this.drawLayerToCtx(this.cacheBelowCtx, this.layers[i], this.layers);
    }

    // 2. Build above cache
    this.cacheAboveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    for (let i = activeIdx + 1; i < this.layers.length; i++) {
      this.drawLayerToCtx(this.cacheAboveCtx, this.layers[i], this.layers);
    }

    this.needsRecomposite = false;
  }

  /**
   * Draws a single layer taking into account clipping masks and blend modes.
   */
  drawLayerToCtx(targetCtx, layer, layerStack) {
    if (!layer.visible) return;

    targetCtx.save();
    targetCtx.globalAlpha = layer.opacity;
    targetCtx.globalCompositeOperation = getCanvasCompositeOp(layer.blendMode);

    if (layer.clippingMask) {
      // Find the base layer for this clip
      targetCtx.globalCompositeOperation = 'source-atop';
    }

    targetCtx.drawImage(layer.canvas, 0, 0);
    targetCtx.restore();
  }

  /**
   * Composites the entire document onto targetCtx.
   * If liveStrokeCanvas is provided, renders the active layer with live stroke in real-time!
   */
  compositeStack(targetCtx, liveStrokeCanvas = null, liveOpacity = 1.0, liveBlendMode = 'source-over') {
    // 1. Background
    if (!this.isTransparentBg && this.backgroundColor) {
      targetCtx.fillStyle = this.backgroundColor;
      targetCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    } else {
      targetCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    }

    // 2. Layers below active
    targetCtx.drawImage(this.cacheBelow, 0, 0);

    // 3. Active Layer
    const active = this.getActiveLayer();
    if (active && active.visible) {
      targetCtx.save();
      targetCtx.globalAlpha = active.opacity;
      targetCtx.globalCompositeOperation = getCanvasCompositeOp(active.blendMode);

      targetCtx.drawImage(active.canvas, 0, 0);

      // Draw live stroke on active layer
      if (liveStrokeCanvas) {
        targetCtx.save();
        targetCtx.globalAlpha = liveOpacity;
        targetCtx.globalCompositeOperation = getCanvasCompositeOp(liveBlendMode);
        if (active.alphaLock) {
          targetCtx.globalCompositeOperation = 'source-atop';
        }
        targetCtx.drawImage(liveStrokeCanvas, 0, 0);
        targetCtx.restore();
      }

      targetCtx.restore();
    }

    // 4. Layers above active
    targetCtx.drawImage(this.cacheAbove, 0, 0);
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

    for (let i = 0; i < this.layers.length; i++) {
      this.drawLayerToCtx(targetCtx, this.layers[i], this.layers);
    }
  }

  getReferenceLayer() {
    return this.layers.find(l => l.isReference) || this.getActiveLayer();
  }
}

/* --- BrushPresets.js --- */
/**
 * Vectura Brush Presets Library
 * 25+ distinct, production-tuned vector brushes categorized for digital artists.
 */

const BRUSH_CATEGORIES = [
  { id: 'ink', name: 'Inking & Sketch' },
  { id: 'paint', name: 'Painting & Shading' },
  { id: 'texture', name: 'Texture & FX' },
  { id: 'eraser', name: 'Erasers' },
  { id: 'pixel', name: 'Pixel Art' }
];

const DEFAULT_BRUSH_PRESETS = [
  // --- INKING & SKETCH ---
  {
    id: 'pencil',
    category: 'ink',
    name: 'Pencil',
    size: 6,
    minSize: 1,
    maxSize: 100,
    opacity: 0.85,
    flow: 0.8,
    hardness: 0.7,
    spacing: 0.1,
    roundness: 0.85,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0.4,
    taperStart: 12,
    taperEnd: 18,
    pressureSensitivity: 1.0,
    bezierPressure: [0.25, 0.1, 0.25, 1.0],
    jitter: { enabled: true, type: 'perlin', frequency: 0.08, amplitude: 0.15, basis: 'distance' },
    blendMode: 'source-over',
    stabilizer: 30
  },
  {
    id: 'mechanical_pencil',
    category: 'ink',
    name: 'Mechanical Pencil',
    size: 2,
    minSize: 1,
    maxSize: 30,
    opacity: 0.9,
    flow: 0.95,
    hardness: 0.95,
    spacing: 0.08,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0.15,
    taperStart: 4,
    taperEnd: 6,
    pressureSensitivity: 0.6,
    jitter: { enabled: false },
    blendMode: 'source-over',
    stabilizer: 20
  },
  {
    id: 'technical_pen',
    category: 'ink',
    name: 'Technical Pen',
    size: 4,
    minSize: 1,
    maxSize: 150,
    opacity: 1.0,
    flow: 1.0,
    hardness: 1.0,
    spacing: 0.06,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.2, // very stable width
    jitter: { enabled: false },
    blendMode: 'source-over',
    stabilizer: 45
  },
  {
    id: 'g_pen',
    category: 'ink',
    name: 'G-Pen',
    size: 8,
    minSize: 1,
    maxSize: 200,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.98,
    spacing: 0.05,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0,
    taperStart: 25,
    taperEnd: 35,
    pressureSensitivity: 1.4, // wide dynamic line weight
    bezierPressure: [0.15, 0.05, 0.35, 1.0],
    jitter: { enabled: false },
    blendMode: 'source-over',
    stabilizer: 40
  },
  {
    id: 'ink_pen',
    category: 'ink',
    name: 'Ink Fountain Pen',
    size: 5,
    minSize: 1,
    maxSize: 80,
    opacity: 0.96,
    flow: 0.9,
    hardness: 0.9,
    spacing: 0.06,
    roundness: 0.9,
    aspectRatio: 1.2,
    rotation: -0.6,
    tipShape: 'oval',
    grain: 0.1,
    taperStart: 10,
    taperEnd: 20,
    pressureSensitivity: 1.1,
    velocitySettings: { enabled: true, inverse: true, sensitivity: 1.3 },
    jitter: { enabled: true, type: 'sines', frequency: 0.05, amplitude: 0.08, basis: 'distance' },
    blendMode: 'source-over',
    stabilizer: 35
  },
  {
    id: 'calligraphy',
    category: 'ink',
    name: 'Calligraphy Chisel',
    size: 16,
    minSize: 2,
    maxSize: 160,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.95,
    spacing: 0.05,
    roundness: 0.2,
    aspectRatio: 4.5,
    rotation: 0.785, // 45 degrees
    tipShape: 'chisel',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.7,
    jitter: { enabled: false },
    blendMode: 'source-over',
    stabilizer: 50
  },
  {
    id: 'brush_pen',
    category: 'ink',
    name: 'Brush Pen (Fude)',
    size: 12,
    minSize: 1,
    maxSize: 220,
    opacity: 0.98,
    flow: 0.95,
    hardness: 0.85,
    spacing: 0.07,
    roundness: 0.7,
    aspectRatio: 1.5,
    rotation: 0,
    tipShape: 'round',
    grain: 0.2,
    taperStart: 35,
    taperEnd: 50,
    pressureSensitivity: 1.6,
    jitter: { enabled: true, type: 'perlin', frequency: 0.04, amplitude: 0.12, basis: 'distance' },
    blendMode: 'source-over',
    stabilizer: 42
  },

  // --- PAINTING & SHADING ---
  {
    id: 'marker',
    category: 'paint',
    name: 'Marker',
    size: 24,
    minSize: 4,
    maxSize: 250,
    opacity: 0.65,
    flow: 0.7,
    hardness: 0.85,
    spacing: 0.08,
    roundness: 0.4,
    aspectRatio: 2.5,
    rotation: 0.5,
    tipShape: 'chisel',
    grain: 0,
    taperStart: 5,
    taperEnd: 8,
    pressureSensitivity: 0.5,
    blendMode: 'multiply',
    stabilizer: 25
  },
  {
    id: 'highlighter',
    category: 'paint',
    name: 'Highlighter',
    size: 32,
    minSize: 10,
    maxSize: 300,
    opacity: 0.45,
    flow: 0.6,
    hardness: 0.9,
    spacing: 0.05,
    roundness: 0.3,
    aspectRatio: 3.0,
    rotation: 0.4,
    tipShape: 'chisel',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.1,
    blendMode: 'multiply',
    stabilizer: 30
  },
  {
    id: 'watercolor',
    category: 'paint',
    name: 'Watercolor Wet-Edge',
    size: 28,
    minSize: 5,
    maxSize: 300,
    opacity: 0.4,
    flow: 0.5,
    hardness: 0.4,
    spacing: 0.06,
    roundness: 0.9,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0.3,
    wetEdge: 0.8, // Darker fringe on stroke contours
    taperStart: 15,
    taperEnd: 25,
    pressureSensitivity: 1.2,
    jitter: { enabled: true, type: 'perlin', frequency: 0.03, amplitude: 0.25, basis: 'distance' },
    blendMode: 'multiply',
    stabilizer: 35
  },
  {
    id: 'airbrush_soft',
    category: 'paint',
    name: 'Airbrush Soft',
    size: 60,
    minSize: 10,
    maxSize: 500,
    opacity: 0.3,
    flow: 0.25,
    hardness: 0.0,
    spacing: 0.04,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'gaussian',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.9,
    jitter: { enabled: false },
    blendMode: 'source-over',
    stabilizer: 20
  },
  {
    id: 'chalk',
    category: 'paint',
    name: 'Chalk',
    size: 18,
    minSize: 3,
    maxSize: 200,
    opacity: 0.85,
    flow: 0.75,
    hardness: 0.6,
    spacing: 0.15,
    roundness: 0.7,
    aspectRatio: 1.4,
    rotation: 0.3,
    tipShape: 'rough',
    grain: 0.7,
    taperStart: 6,
    taperEnd: 10,
    pressureSensitivity: 1.1,
    jitter: { enabled: true, type: 'keyframes', frequency: 0.1, amplitude: 0.35, basis: 'distance' },
    blendMode: 'source-over',
    stabilizer: 25
  },
  {
    id: 'charcoal',
    category: 'paint',
    name: 'Charcoal Rough',
    size: 22,
    minSize: 4,
    maxSize: 240,
    opacity: 0.9,
    flow: 0.85,
    hardness: 0.7,
    spacing: 0.12,
    roundness: 0.6,
    aspectRatio: 1.8,
    rotation: 0.8,
    tipShape: 'rough',
    grain: 0.85,
    taperStart: 8,
    taperEnd: 14,
    pressureSensitivity: 1.3,
    jitter: { enabled: true, type: 'perlin', frequency: 0.09, amplitude: 0.4, basis: 'distance' },
    blendMode: 'source-over',
    stabilizer: 28
  },
  {
    id: 'oil_pastel',
    category: 'paint',
    name: 'Oil Pastel',
    size: 20,
    minSize: 4,
    maxSize: 220,
    opacity: 0.95,
    flow: 0.9,
    hardness: 0.75,
    spacing: 0.1,
    roundness: 0.8,
    aspectRatio: 1.2,
    rotation: 0.2,
    tipShape: 'rough',
    grain: 0.6,
    taperStart: 8,
    taperEnd: 12,
    pressureSensitivity: 1.2,
    blendMode: 'source-over',
    stabilizer: 30
  },

  // --- TEXTURE & FX ---
  {
    id: 'stipple',
    category: 'texture',
    name: 'Stipple Dots',
    size: 14,
    minSize: 4,
    maxSize: 150,
    opacity: 0.95,
    flow: 0.9,
    hardness: 1.0,
    spacing: 0.7, // spaced out
    scatter: 1.2, // randomized offset from stroke centerline
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.8,
    jitter: { enabled: true, type: 'perlin', frequency: 0.15, amplitude: 0.6, basis: 'distance' },
    blendMode: 'source-over',
    stabilizer: 15
  },
  {
    id: 'dashed_line',
    category: 'texture',
    name: 'Dashed Stitch',
    size: 4,
    minSize: 1,
    maxSize: 50,
    opacity: 1.0,
    flow: 1.0,
    hardness: 1.0,
    spacing: 0.5,
    dashLength: 12,
    dashGap: 8,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.3,
    jitter: { enabled: false },
    blendMode: 'source-over',
    stabilizer: 40
  },
  {
    id: 'neon_glow',
    category: 'texture',
    name: 'Neon Glow',
    size: 14,
    minSize: 4,
    maxSize: 180,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.8,
    spacing: 0.05,
    glowWidth: 2.8, // outer luminescent aura
    glowColor: null, // derived from primary color
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0,
    taperStart: 15,
    taperEnd: 25,
    pressureSensitivity: 1.1,
    jitter: { enabled: false },
    blendMode: 'screen',
    stabilizer: 45
  },
  {
    id: 'stamp_stars',
    category: 'texture',
    name: 'Sparkle Stamp',
    size: 30,
    minSize: 10,
    maxSize: 260,
    opacity: 0.9,
    flow: 0.85,
    hardness: 1.0,
    spacing: 0.9,
    scatter: 0.8,
    angleJitter: 3.14,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'star',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 1.2,
    jitter: { enabled: true, type: 'perlin', frequency: 0.1, amplitude: 0.4, basis: 'distance' },
    blendMode: 'source-over',
    stabilizer: 20
  },
  {
    id: 'crosshatch',
    category: 'texture',
    name: 'Pattern Hatch',
    size: 18,
    minSize: 4,
    maxSize: 150,
    opacity: 0.8,
    flow: 0.8,
    hardness: 0.9,
    spacing: 0.25,
    roundness: 0.5,
    aspectRatio: 2.0,
    rotation: 0.785,
    tipShape: 'hatch',
    grain: 0.5,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.7,
    jitter: { enabled: false },
    blendMode: 'source-over',
    stabilizer: 30
  },

  // --- ERASERS ---
  {
    id: 'hard_eraser',
    category: 'eraser',
    name: 'Hard Eraser',
    size: 20,
    minSize: 2,
    maxSize: 300,
    opacity: 1.0,
    flow: 1.0,
    hardness: 1.0,
    spacing: 0.05,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.8,
    jitter: { enabled: false },
    blendMode: 'destination-out', // Vector erase
    isEraser: true,
    stabilizer: 20
  },
  {
    id: 'soft_eraser',
    category: 'eraser',
    name: 'Soft Eraser',
    size: 40,
    minSize: 5,
    maxSize: 400,
    opacity: 0.7,
    flow: 0.6,
    hardness: 0.2,
    spacing: 0.05,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'gaussian',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 1.0,
    jitter: { enabled: false },
    blendMode: 'destination-out',
    isEraser: true,
    stabilizer: 20
  },

  // --- PIXEL ART ---
  {
    id: 'pixel_pen',
    category: 'pixel',
    name: 'Pixel Pen (1px)',
    size: 1,
    minSize: 1,
    maxSize: 16,
    opacity: 1.0,
    flow: 1.0,
    hardness: 1.0,
    spacing: 1.0,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'square',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.0,
    jitter: { enabled: false },
    isPixel: true,
    blendMode: 'source-over',
    stabilizer: 0
  },
  {
    id: 'pixel_eraser',
    category: 'pixel',
    name: 'Pixel Eraser',
    size: 1,
    minSize: 1,
    maxSize: 16,
    opacity: 1.0,
    flow: 1.0,
    hardness: 1.0,
    spacing: 1.0,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'square',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.0,
    jitter: { enabled: false },
    isPixel: true,
    isEraser: true,
    blendMode: 'destination-out',
    stabilizer: 0
  },
  {
    id: 'pixel_dither',
    category: 'pixel',
    name: 'Pixel 50% Dither',
    size: 2,
    minSize: 1,
    maxSize: 16,
    opacity: 1.0,
    flow: 1.0,
    hardness: 1.0,
    spacing: 1.0,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'checker',
    grain: 0,
    taperStart: 0,
    taperEnd: 0,
    pressureSensitivity: 0.0,
    isPixel: true,
    blendMode: 'source-over',
    stabilizer: 0
  }
];

/* --- Brush.js --- */
/**
 * Vectura Brush Model & Tip Renderer
 * Manages brush parameters, snapshotting for immutable vector strokes, and tip synthesis.
 */


class Brush {
  constructor(presetData) {
    this.assign(presetData || DEFAULT_BRUSH_PRESETS[0]);
  }

  assign(data) {
    this.id = data.id || 'custom_brush';
    this.name = data.name || 'Custom Brush';
    this.category = data.category || 'ink';

    // Core dimensions & dynamics
    this.size = data.size ?? 8;
    this.minSize = data.minSize ?? 1;
    this.maxSize = data.maxSize ?? 200;
    this.opacity = data.opacity ?? 1.0;
    this.flow = data.flow ?? 1.0;
    this.hardness = data.hardness ?? 1.0;
    this.spacing = data.spacing ?? 0.08;
    this.scatter = data.scatter ?? 0.0;
    this.rotation = data.rotation ?? 0.0;
    this.angleJitter = data.angleJitter ?? 0.0;
    this.roundness = data.roundness ?? 1.0;
    this.aspectRatio = data.aspectRatio ?? 1.0;

    // Tip shape & grain
    this.tipShape = data.tipShape || 'round'; // 'round' | 'square' | 'chisel' | 'gaussian' | 'rough' | 'star' | 'hatch' | 'checker'
    this.grain = data.grain ?? 0.0;
    this.wetEdge = data.wetEdge ?? 0.0;
    this.glowWidth = data.glowWidth ?? 0.0;

    // Taper
    this.taperStart = data.taperStart ?? 0;
    this.taperEnd = data.taperEnd ?? 0;

    // Pressure & Velocity Curves
    this.pressureSensitivity = data.pressureSensitivity ?? 1.0;
    this.bezierPressure = data.bezierPressure ? [...data.bezierPressure] : [0.25, 0.1, 0.25, 1.0];
    this.velocitySettings = data.velocitySettings ? { ...data.velocitySettings } : { enabled: false };

    // Jitter (Coherent Noise)
    this.jitter = data.jitter ? { ...data.jitter } : { enabled: false };

    // Special Flags
    this.isEraser = !!data.isEraser;
    this.isPixel = !!data.isPixel;
    this.blendMode = data.blendMode || 'source-over';
    this.stabilizer = data.stabilizer ?? 30;

    // Cached tip pattern/stamp
    this._stampCache = null;
    this._stampCacheKey = '';
  }

  /**
   * Creates an immutable snapshot of all settings to store with a vector stroke.
   */
  createSnapshot() {
    return {
      id: this.id,
      name: this.name,
      size: this.size,
      opacity: this.opacity,
      flow: this.flow,
      hardness: this.hardness,
      spacing: this.spacing,
      scatter: this.scatter,
      rotation: this.rotation,
      angleJitter: this.angleJitter,
      roundness: this.roundness,
      aspectRatio: this.aspectRatio,
      tipShape: this.tipShape,
      grain: this.grain,
      wetEdge: this.wetEdge,
      glowWidth: this.glowWidth,
      taperStart: this.taperStart,
      taperEnd: this.taperEnd,
      pressureSensitivity: this.pressureSensitivity,
      bezierPressure: [...this.bezierPressure],
      velocitySettings: { ...this.velocitySettings },
      jitter: { ...this.jitter },
      isEraser: this.isEraser,
      isPixel: this.isPixel,
      blendMode: this.blendMode
    };
  }

  toJSON() {
    return this.createSnapshot();
  }

  static fromJSON(json) {
    return new Brush(json);
  }
}

/* --- Command.js --- */
/**
 * Vectura History Command Pattern
 * Vector deltas and operations for memory-efficient 200+ step undo/redo.
 */
class Command {
  constructor(name = 'Action') {
    this.name = name;
  }
  execute() {}
  undo() {}
}

class StrokeCommand extends Command {
  constructor(layer, stroke, onRedraw) {
    super('Draw Stroke');
    this.layer = layer;
    this.stroke = stroke;
    this.onRedraw = onRedraw;
  }

  execute() {
    this.layer.addStroke(this.stroke);
    this.onRedraw?.(this.layer);
  }

  undo() {
    const idx = this.layer.strokes.lastIndexOf(this.stroke);
    if (idx >= 0) {
      this.layer.strokes.splice(idx, 1);
      this.onRedraw?.(this.layer, true); // true = full layer redraw from strokes
    }
  }
}

class LayerOpCommand extends Command {
  constructor(name, applyFn, revertFn, onComplete) {
    super(name);
    this.applyFn = applyFn;
    this.revertFn = revertFn;
    this.onComplete = onComplete;
  }

  execute() {
    this.applyFn();
    this.onComplete?.();
  }

  undo() {
    this.revertFn();
    this.onComplete?.();
  }
}

/* --- HistoryManager.js --- */
/**
 * Vectura History Manager
 * Command-based undo/redo queue supporting 200+ steps with low memory footprint.
 */
class HistoryManager {
  constructor(maxSteps = 200) {
    this.maxSteps = maxSteps;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
        undoStack: this.undoStack.map(c => c.name),
        redoStack: this.redoStack.map(c => c.name)
      });
    }
  }

  push(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return false;
    const cmd = this.undoStack.pop();
    cmd.undo();
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const cmd = this.redoStack.pop();
    cmd.execute();
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

/* --- FillBucket.js --- */
/**
 * Vectura Flood Fill Engine
 * Fast scanline fill on Uint32Array with tolerance, gap closing, sample sources,
 * and satisfying 300ms expanding ripple animation.
 */
class FillBucket {
  constructor() {
    this.tolerance = 25;       // 0 to 100
    this.expand = 1;           // -10 to +10 px
    this.sampleSource = 'all'; // 'current' | 'reference' | 'all'
    this.animating = false;
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
   * Performs scanline flood fill on target layer.
   */
  fill(startX, startY, fillColorHex, layerManager, onAnimatedCommit) {
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
      // 'all': render composite
      layerManager.compositeToCanvas(layerManager.cachedCompositeCtx, true);
      sampleCanvas = layerManager.cachedComposite;
    }

    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = sampleCtx.getImageData(0, 0, w, h);
    const data32 = new Uint32Array(imgData.data.buffer);

    const startIndex = startY * w + startX;
    const targetColor = data32[startIndex];

    const fillRgba = this.hexToRgba(fillColorHex);
    // Little-endian RGBA in 32-bit: (A << 24) | (B << 16) | (G << 8) | R
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

    while (queue.length > 0) {
      const [curX, curY] = queue.pop();
      let left = curX;
      let right = curX;

      // Scan left
      while (left > 0 && !visited[curY * w + (left - 1)] && colorMatch(curY * w + (left - 1))) {
        left--;
        visited[curY * w + left] = 1;
      }

      // Scan right
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

        // Check top neighbor
        if (curY > 0) {
          const topIdx = (curY - 1) * w + x;
          if (!visited[topIdx] && colorMatch(topIdx)) {
            visited[topIdx] = 1;
            queue.push([x, curY - 1]);
          }
        }

        // Check bottom neighbor
        if (curY < h - 1) {
          const botIdx = (curY + 1) * w + x;
          if (!visited[botIdx] && colorMatch(botIdx)) {
            visited[botIdx] = 1;
            queue.push([x, curY + 1]);
          }
        }
      }
    }

    // Apply expand/contract if requested
    const finalMask = this.expandMask(filledMask, w, h, this.expand);

    // Create fill patch canvas
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

    // Trigger expanding ripple animation on screen, then commit
    onAnimatedCommit?.({
      startX,
      startY,
      patchCanvas,
      activeLayer,
      fillColorHex
    });

    return true;
  }

  expandMask(mask, w, h, amount) {
    if (amount === 0) return mask;
    const out = new Uint8Array(mask);
    const radius = Math.abs(amount);

    if (amount > 0) {
      // Dilate
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
}

/* --- SelectionTool.js --- */
/**
 * Vectura Selection Engine
 * Rect, Ellipse, Lasso, Magic Wand selection with marching ants overlay and drawing masking.
 */
class SelectionTool {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.type = 'rect'; // 'rect' | 'ellipse' | 'lasso' | 'wand'
    this.opMode = 'new'; // 'new' | 'add' | 'subtract' | 'intersect'
    this.hasSelection = false;

    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = docWidth;
    this.maskCanvas.height = docHeight;
    this.maskCtx = this.maskCanvas.getContext('2d');

    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.lassoPoints = [];
    this.dashOffset = 0;
  }

  resize(w, h) {
    this.maskCanvas.width = w;
    this.maskCanvas.height = h;
    this.clear();
  }

  clear() {
    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    this.hasSelection = false;
  }

  start(x, y) {
    this.active = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
    this.lassoPoints = [{ x, y }];
  }

  update(x, y) {
    if (!this.active) return;
    this.currentX = x;
    this.currentY = y;
    if (this.type === 'lasso') {
      this.lassoPoints.push({ x, y });
    }
  }

  commit() {
    if (!this.active) return;
    this.active = false;

    // Apply selection geometry to mask canvas
    const ctx = this.maskCtx;
    ctx.save();

    if (this.opMode === 'new') {
      ctx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
      ctx.globalCompositeOperation = 'source-over';
    } else if (this.opMode === 'add') {
      ctx.globalCompositeOperation = 'source-over';
    } else if (this.opMode === 'subtract') {
      ctx.globalCompositeOperation = 'destination-out';
    } else if (this.opMode === 'intersect') {
      ctx.globalCompositeOperation = 'destination-in';
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();

    if (this.type === 'rect') {
      const rx = Math.min(this.startX, this.currentX);
      const ry = Math.min(this.startY, this.currentY);
      const rw = Math.abs(this.currentX - this.startX);
      const rh = Math.abs(this.currentY - this.startY);
      ctx.rect(rx, ry, rw, rh);
    } else if (this.type === 'ellipse') {
      const cx = (this.startX + this.currentX) / 2;
      const cy = (this.startY + this.currentY) / 2;
      const rx = Math.abs(this.currentX - this.startX) / 2;
      const ry = Math.abs(this.currentY - this.startY) / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    } else if (this.type === 'lasso' && this.lassoPoints.length > 2) {
      ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
      for (let i = 1; i < this.lassoPoints.length; i++) {
        ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
      }
      ctx.closePath();
    }

    ctx.fill();
    ctx.restore();
    this.hasSelection = true;
    this.lassoPoints = [];
  }

  invert() {
    if (!this.hasSelection) return;
    const ctx = this.maskCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    ctx.restore();
  }

  drawMarchingAnts(targetCtx) {
    if (!this.hasSelection && !this.active) return;
    this.dashOffset = (this.dashOffset + 0.5) % 12;

    targetCtx.save();
    targetCtx.strokeStyle = '#ffffff';
    targetCtx.lineWidth = 1.5;
    targetCtx.setLineDash([4, 4]);
    targetCtx.lineDashOffset = -this.dashOffset;

    if (this.active) {
      // Live dragging shape
      targetCtx.beginPath();
      if (this.type === 'rect') {
        const rx = Math.min(this.startX, this.currentX);
        const ry = Math.min(this.startY, this.currentY);
        const rw = Math.abs(this.currentX - this.startX);
        const rh = Math.abs(this.currentY - this.startY);
        targetCtx.strokeRect(rx, ry, rw, rh);
      } else if (this.type === 'ellipse') {
        const cx = (this.startX + this.currentX) / 2;
        const cy = (this.startY + this.currentY) / 2;
        const rx = Math.abs(this.currentX - this.startX) / 2;
        const ry = Math.abs(this.currentY - this.startY) / 2;
        targetCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        targetCtx.stroke();
      } else if (this.type === 'lasso' && this.lassoPoints.length > 1) {
        targetCtx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
          targetCtx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
        }
        targetCtx.stroke();
      }
    }

    targetCtx.restore();
  }
}

/* --- TransformTool.js --- */
/**
 * Vectura Transform Engine
 * Move, uniform/free scale, rotate, flip H/V with interactive on-canvas handles.
 */
class TransformTool {
  constructor() {
    this.active = false;
    this.targetLayer = null;

    // Bounding box of content being transformed
    this.bounds = { x: 0, y: 0, w: 100, h: 100 };
    this.pivot = { x: 50, y: 50 };

    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0; // radians

    this.dragHandle = null; // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rot' | 'pivot'
    this.dragStart = { x: 0, y: 0 };
    this.initialTransform = null;
  }

  activate(layer) {
    this.active = true;
    this.targetLayer = layer;
    this.calculateBounds();
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.rotation = 0;
  }

  calculateBounds() {
    if (!this.targetLayer || this.targetLayer.strokes.length === 0) {
      this.bounds = { x: 100, y: 100, w: this.targetLayer.width - 200, h: this.targetLayer.height - 200 };
      this.pivot = { x: this.bounds.x + this.bounds.w / 2, y: this.bounds.y + this.bounds.h / 2 };
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.targetLayer.strokes) {
      if (s.points) {
        for (const p of s.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
    }

    if (minX === Infinity) {
      this.bounds = { x: 50, y: 50, w: 200, h: 200 };
    } else {
      const pad = 10;
      this.bounds = {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.max(20, (maxX - minX) + pad * 2),
        h: Math.max(20, (maxY - minY) + pad * 2)
      };
    }
    this.pivot = { x: this.bounds.x + this.bounds.w / 2, y: this.bounds.y + this.bounds.h / 2 };
  }

  flipHorizontal() {
    this.scaleX *= -1;
  }

  flipVertical() {
    this.scaleY *= -1;
  }

  onPointerDown(worldX, worldY) {
    if (!this.active) return false;
    // Hit test handles
    const handle = this.hitTestHandle(worldX, worldY);
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

    if (this.dragHandle === 'move') {
      this.translateX = this.initialTransform.tx + dx;
      this.translateY = this.initialTransform.ty + dy;
    } else if (this.dragHandle === 'rot') {
      const angle = Math.atan2(worldY - this.pivot.y, worldX - this.pivot.x);
      const startAngle = Math.atan2(this.dragStart.y - this.pivot.y, this.dragStart.x - this.pivot.x);
      this.rotation = this.initialTransform.rot + (angle - startAngle);
    } else if (this.dragHandle === 'se') {
      const origW = this.bounds.w;
      const newW = origW + dx;
      const factor = Math.max(0.1, newW / origW);
      this.scaleX = this.initialTransform.sx * factor;
      this.scaleY = this.initialTransform.sy * factor;
    }
  }

  onPointerUp() {
    this.dragHandle = null;
  }

  hitTestHandle(wx, wy) {
    const handleRadius = 24;
    const cx = this.pivot.x + this.translateX;
    const cy = this.pivot.y + this.translateY;

    // Rotation lever: 40px above top edge
    const rotY = (this.bounds.y + this.translateY) - 35;
    if (Math.hypot(wx - cx, wy - rotY) <= handleRadius) return 'rot';

    // SE handle
    const seX = this.bounds.x + this.bounds.w + this.translateX;
    const seY = this.bounds.y + this.bounds.h + this.translateY;
    if (Math.hypot(wx - seX, wy - seY) <= handleRadius) return 'se';

    // Inside box = move
    const bx = this.bounds.x + this.translateX;
    const by = this.bounds.y + this.translateY;
    if (wx >= bx && wx <= bx + this.bounds.w && wy >= by && wy <= by + this.bounds.h) {
      return 'move';
    }

    return null;
  }

  applyTransform(onComplete) {
    if (!this.active || !this.targetLayer) return;

    // Apply matrix to all vector strokes losslessly
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const cx = this.pivot.x;
    const cy = this.pivot.y;

    for (const stroke of this.targetLayer.strokes) {
      if (stroke.points) {
        for (const p of stroke.points) {
          // 1. Shift to pivot
          let x = (p.x - cx) * this.scaleX;
          let y = (p.y - cy) * this.scaleY;

          // 2. Rotate
          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;

          // 3. Translate + Pivot
          p.x = rx + cx + this.translateX;
          p.y = ry + cy + this.translateY;
        }
      }
    }

    this.active = false;
    onComplete?.();
  }

  cancel() {
    this.active = false;
  }

  drawOverlay(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.translateX, this.translateY);
    ctx.translate(this.pivot.x, this.pivot.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-this.pivot.x, -this.pivot.y);

    // Bounding Box
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);

    // Handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;

    const corners = [
      [this.bounds.x, this.bounds.y],
      [this.bounds.x + this.bounds.w, this.bounds.y],
      [this.bounds.x + this.bounds.w, this.bounds.y + this.bounds.h],
      [this.bounds.x, this.bounds.y + this.bounds.h]
    ];

    for (const [hx, hy] of corners) {
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Rotation lever
    const midTopX = this.bounds.x + this.bounds.w / 2;
    const midTopY = this.bounds.y;
    ctx.beginPath();
    ctx.moveTo(midTopX, midTopY);
    ctx.lineTo(midTopX, midTopY - 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midTopX, midTopY - 30, 8, 0, Math.PI * 2);
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
 * Straight line ruler, circle compass guide, and 1-point & 2-point perspective grids with magnetic snapping.
 */
class RulerGuides {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.mode = 'off'; // 'off' | 'line' | 'circle' | 'perspective1' | 'perspective2'
    this.snapThreshold = 20; // Distance in pixels to snap

    // Line ruler
    this.line = { x0: 200, y0: 540, x1: 880, y1: 540 };

    // Circle guide
    this.circle = { cx: docWidth / 2, cy: docHeight / 2, r: 250 };

    // Perspective vanishing points
    this.vp1 = { x: docWidth / 2, y: docHeight / 3 };
    this.vp2_a = { x: -200, y: docHeight / 3 };
    this.vp2_b = { x: docWidth + 200, y: docHeight / 3 };
  }

  snapPoint(x, y) {
    if (this.mode === 'off') return { x, y };

    if (this.mode === 'line') {
      // Project (x, y) onto infinite line (x0,y0)-(x1,y1)
      const dx = this.line.x1 - this.line.x0;
      const dy = this.line.y1 - this.line.y0;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return { x, y };
      const t = ((x - this.line.x0) * dx + (y - this.line.y0) * dy) / lenSq;
      return {
        x: this.line.x0 + t * dx,
        y: this.line.y0 + t * dy
      };
    }

    if (this.mode === 'circle') {
      // Snap to circle perimeter
      const angle = Math.atan2(y - this.circle.cy, x - this.circle.cx);
      return {
        x: this.circle.cx + Math.cos(angle) * this.circle.r,
        y: this.circle.cy + Math.sin(angle) * this.circle.r
      };
    }

    if (this.mode === 'perspective1') {
      // Snap along ray from vanishing point vp1
      const angle = Math.atan2(y - this.vp1.y, x - this.vp1.x);
      const dist = Math.hypot(x - this.vp1.x, y - this.vp1.y);
      return {
        x: this.vp1.x + Math.cos(angle) * dist,
        y: this.vp1.y + Math.sin(angle) * dist
      };
    }

    return { x, y };
  }

  drawGuides(ctx, docW, docH) {
    if (this.mode === 'off') return;

    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);

    if (this.mode === 'line') {
      ctx.beginPath();
      // Draw extended line across canvas
      const dx = this.line.x1 - this.line.x0;
      const dy = this.line.y1 - this.line.y0;
      ctx.moveTo(this.line.x0 - dx * 4, this.line.y0 - dy * 4);
      ctx.lineTo(this.line.x1 + dx * 4, this.line.y1 + dy * 4);
      ctx.stroke();

      // Handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(this.line.x0, this.line.y0, 6, 0, Math.PI * 2);
      ctx.arc(this.line.x1, this.line.y1, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mode === 'circle') {
      ctx.beginPath();
      ctx.arc(this.circle.cx, this.circle.cy, this.circle.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.mode === 'perspective1') {
      // Horizon line
      ctx.beginPath();
      ctx.moveTo(0, this.vp1.y);
      ctx.lineTo(docW, this.vp1.y);
      ctx.stroke();

      // Rays from VP1
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        ctx.beginPath();
        ctx.moveTo(this.vp1.x, this.vp1.y);
        ctx.lineTo(this.vp1.x + Math.cos(a) * docW * 2, this.vp1.y + Math.sin(a) * docW * 2);
        ctx.stroke();
      }
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
 */
class SymmetryManager {
  constructor(docWidth = 1080, docHeight = 1080) {
    this.mode = 'off'; // 'off' | 'vertical' | 'horizontal' | 'radial'
    this.radialAxes = 4; // 2 to 12
    this.centerX = docWidth / 2;
    this.centerY = docHeight / 2;
  }

  setPivot(x, y) {
    this.centerX = x;
    this.centerY = y;
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

  drawOverlay(ctx, docW, docH) {
    if (this.mode === 'off') return;

    ctx.save();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);

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

    // Pivot center dot
    ctx.setLineDash([]);
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/* --- ToolManager.js --- */
/**
 * Vectura Tool Manager
 * Routes interactions between active tools and the vector canvas engine.
 */












class ToolManager {
  constructor(docWidth, docHeight) {
    this.activeTool = 'brush'; // 'brush' | 'eraser' | 'bucket' | 'lasso-fill' | 'selection' | 'transform' | 'point-editor' | 'shape' | 'gradient' | 'text' | 'eyedropper'

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
  }

  setTool(toolName, layer = null) {
    if (this.activeTool === 'transform' && toolName !== 'transform') {
      this.transformTool.cancel();
    }
    if (this.activeTool === 'point-editor' && toolName !== 'point-editor') {
      this.vectorPointEditor.deactivate();
    }

    this.activeTool = toolName;

    if (toolName === 'transform' && layer) {
      this.transformTool.activate(layer);
    } else if (toolName === 'point-editor') {
      this.vectorPointEditor.activate();
    }
  }

  resizeDocument(w, h) {
    this.selectionTool.resize(w, h);
    this.symmetry.setPivot(w / 2, h / 2);
  }
}

/* --- VectorCanvas.js --- */
/**
 * Vectura Vector Drawing Engine
 * High-performance vector stroke engine with Catmull-Rom splines, coherent jitter,
 * coalesced pointer capture, multi-touch gestures, and 60fps layer rendering.
 */









class VectorCanvas {
  constructor(viewportCanvas, docWidth = 1080, docHeight = 1080) {
    this.viewportCanvas = viewportCanvas;
    this.ctx = viewportCanvas.getContext('2d', { alpha: false, desynchronized: true });

    this.docWidth = docWidth;
    this.docHeight = docHeight;

    // Viewport & Transformations
    this.viewport = new Viewport(docWidth, docHeight);

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

    // Current Drawing State
    this.isDrawing = false;
    this.activePointerId = null;
    this.currentStroke = null;
    this.currentBrush = null;
    this.currentColor = '#8b5cf6';

    // Touch & Multi-touch navigation state
    this.activePointers = new Map(); // pointerId -> { x, y, time }
    this.isNavigating = false;
    this.lastPinchDist = 0;
    this.lastPinchAngle = 0;
    this.lastPinchCenter = { x: 0, y: 0 };
    this.tapStartTime = 0;
    this.tapMaxMovement = 0;

    // Long press eyedropper timer
    this.longPressTimer = null;
    this.longPressPoint = null;

    // Shape Assist Hold Timer
    this.shapeHoldTimer = null;
    this.shapeHoldDetected = false;

    // Settings
    this.palmRejection = true; // Reject touch if pen is active
    this.penActive = false;
    this.oneFingerDraws = true;
    this.pixelArtMode = false;

    // Callbacks
    this.onColorPicked = null;
    this.onUndoRequested = null;
    this.onRedoRequested = null;
    this.onHaptic = null;

    // Animation Loop
    this.running = true;
    this.renderLoop = this.renderLoop.bind(this);
    requestAnimationFrame(this.renderLoop);

    this.setupPointerListeners();
  }

  setDocumentSize(w, h) {
    this.docWidth = w;
    this.docHeight = h;
    this.viewport.setDocumentSize(w, h);
    this.layerManager.resizeDocument(w, h);
    this.toolManager.resizeDocument(w, h);
    this.liveCanvas.width = w;
    this.liveCanvas.height = h;
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

    // Prevent Chrome gesture defaults
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onPointerDown(e) {
    e.preventDefault();
    try {
      this.viewportCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const now = performance.now();
    const pos = this.getPointerPos(e);

    // Stylus palm rejection
    if (e.pointerType === 'pen') {
      this.penActive = true;
    } else if (this.palmRejection && this.penActive && e.pointerType === 'touch') {
      return; // Ignore touch while stylus active
    }

    this.activePointers.set(e.pointerId, { x: pos.x, y: pos.y, time: now });

    // Multi-finger gesture detection
    if (this.activePointers.size === 1) {
      this.tapStartTime = now;
      this.tapMaxMovement = 0;

      // Check long-press for eyedropper
      if (this.toolManager.activeTool === 'brush' || this.toolManager.activeTool === 'eyedropper') {
        const sx = pos.x, sy = pos.y;
        const world = this.viewport.screenToWorld(sx, sy);
        this.longPressPoint = { sx, sy, wx: world.x, wy: world.y };
        this.longPressTimer = setTimeout(() => {
          if (!this.isNavigating && this.tapMaxMovement < 10) {
            this.triggerEyedropper(this.longPressPoint.wx, this.longPressPoint.wy, this.longPressPoint.sx, this.longPressPoint.sy);
          }
        }, 420);
      }

      // Check tool interactions (Transform, Point editor, Fill, etc.)
      const world = this.viewport.screenToWorld(pos.x, pos.y);
      const activeLayer = this.layerManager.getActiveLayer();

      if (this.toolManager.activeTool === 'transform') {
        if (this.toolManager.transformTool.onPointerDown(world.x, world.y)) {
          return;
        }
      } else if (this.toolManager.activeTool === 'point-editor') {
        if (this.toolManager.vectorPointEditor.onPointerDown(world.x, world.y, activeLayer)) {
          return;
        }
      } else if (this.toolManager.activeTool === 'bucket') {
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
      } else if (this.toolManager.activeTool === 'shape') {
        this.toolManager.shapeTool.start(world.x, world.y);
        return;
      } else if (this.toolManager.activeTool === 'gradient') {
        this.toolManager.gradientTool.start(world.x, world.y);
        return;
      }

      // Standard Vector Stroke drawing begin
      if (activeLayer && !activeLayer.locked) {
        this.startStroke(e);
      }
    } else if (this.activePointers.size >= 2) {
      // 2 or more fingers: Cancel stroke & start Pinch / Pan / Rotate
      this.cancelLongPress();
      this.cancelStroke();
      this.isNavigating = true;

      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      this.lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.lastPinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
  }

  onPointerMove(e) {
    e.preventDefault();
    if (!this.activePointers.has(e.pointerId)) return;

    const pos = this.getPointerPos(e);
    const prevPt = this.activePointers.get(e.pointerId);
    const movement = Math.hypot(pos.x - prevPt.x, pos.y - prevPt.y);
    this.tapMaxMovement += movement;

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

    // Two-finger Pinch Zoom / Pan / Rotate
    if (this.activePointers.size >= 2 && this.isNavigating) {
      const pts = Array.from(this.activePointers.values());
      const p1 = pts[0], p2 = pts[1];
      const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const curCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      // Pan
      this.viewport.panBy(curCenter.x - this.lastPinchCenter.x, curCenter.y - this.lastPinchCenter.y);

      // Zoom anchored to pinch center
      if (this.lastPinchDist > 0) {
        const factor = curDist / this.lastPinchDist;
        this.viewport.zoomAt(factor, curCenter.x, curCenter.y);
      }

      // Rotate with normalized delta angle
      let deltaAngle = curAngle - this.lastPinchAngle;
      while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
      while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      this.viewport.rotateAt(deltaAngle, curCenter.x, curCenter.y);

      this.lastPinchDist = curDist;
      this.lastPinchAngle = curAngle;
      this.lastPinchCenter = curCenter;
      return;
    }

    // Active tools move
    const world = this.viewport.screenToWorld(pos.x, pos.y);
    if (this.toolManager.activeTool === 'transform') {
      this.toolManager.transformTool.onPointerMove(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'point-editor') {
      if (this.toolManager.vectorPointEditor.onPointerMove(world.x, world.y)) {
        this.redrawActiveLayer();
      }
      return;
    } else if (this.toolManager.activeTool === 'lasso-fill') {
      this.toolManager.lassoFill.addPoint(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'selection') {
      this.toolManager.selectionTool.update(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'shape') {
      this.toolManager.shapeTool.update(world.x, world.y);
      return;
    } else if (this.toolManager.activeTool === 'gradient') {
      this.toolManager.gradientTool.update(world.x, world.y);
      return;
    }

    // Live Drawing stroke update with Coalesced events
    if (this.isDrawing && e.pointerId === this.activePointerId) {
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of coalesced) {
        this.appendStrokePoint(ce);
      }

      // Reset shape hold timer on movement
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

    const now = performance.now();
    const tapDuration = now - this.tapStartTime;
    const pointerCountBeforeRelease = this.activePointers.size;

    this.activePointers.delete(e.pointerId);

    // Multi-finger tap gestures for Undo & Redo (short time, minimal movement)
    if (tapDuration < 240 && this.tapMaxMovement < 14) {
      if (pointerCountBeforeRelease === 2) {
        this.onHaptic?.();
        this.onUndoRequested?.();
        this.isNavigating = false;
        return;
      } else if (pointerCountBeforeRelease === 3) {
        this.onHaptic?.();
        this.onRedoRequested?.();
        this.isNavigating = false;
        return;
      }
    }

    if (this.toolManager.eyedropper.active) {
      this.toolManager.eyedropper.hide();
      return;
    }

    // Tool commits
    const activeLayer = this.layerManager.getActiveLayer();
    if (this.toolManager.activeTool === 'transform') {
      this.toolManager.transformTool.onPointerUp();
    } else if (this.toolManager.activeTool === 'point-editor') {
      this.toolManager.vectorPointEditor.onPointerUp();
    } else if (this.toolManager.activeTool === 'lasso-fill' && activeLayer) {
      this.toolManager.lassoFill.finish(activeLayer, this.currentColor, false);
      this.layerManager.invalidateCaches();
    } else if (this.toolManager.activeTool === 'selection') {
      this.toolManager.selectionTool.commit();
    } else if (this.toolManager.activeTool === 'shape' && activeLayer) {
      this.toolManager.shapeTool.commit(activeLayer, this.currentColor, this.currentBrush?.size || 4);
      this.layerManager.invalidateCaches();
    } else if (this.toolManager.activeTool === 'gradient' && activeLayer) {
      this.toolManager.gradientTool.commit(activeLayer, this.currentColor, '#ffffff');
      this.layerManager.invalidateCaches();
    }

    if (this.isDrawing && e.pointerId === this.activePointerId) {
      this.finishStroke();
    }

    if (this.activePointers.size === 0) {
      this.isNavigating = false;
    }
  }

  onPointerCancel(e) {
    this.cancelLongPress();
    if (this.shapeHoldTimer) clearTimeout(this.shapeHoldTimer);
    this.activePointers.delete(e.pointerId);
    this.cancelStroke();
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
      // Distance from line
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const d = Math.abs(dy * p.x - dx * p.y + pEnd.x * pStart.y - pEnd.y * pStart.x) / Math.max(1, totalDist);
      maxPerpDist = Math.max(maxPerpDist, d);
    }

    this.onHaptic?.();
    if (maxPerpDist < 18) {
      // Snap to perfect line
      this.currentStroke.points = [
        { ...pStart, pressure: 0.8 },
        { ...pEnd, pressure: 0.8 }
      ];
      this.shapeHoldDetected = true;
      this.renderLiveStroke();
    }
  }

  startStroke(e) {
    this.isDrawing = true;
    this.activePointerId = e.pointerId;
    this.shapeHoldDetected = false;

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    this.pressureEngine.reset();
    const pressure = this.pressureEngine.resolvePressure(e, snapped);

    this.stabilizer.setStrength(this.currentBrush?.stabilizer ?? 30);
    const stabilized = this.stabilizer.begin({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    const isEraser = this.toolManager.activeTool === 'eraser' || (this.currentBrush && this.currentBrush.isEraser);

    // Create deterministic random seed for stroke
    const strokeSeed = Math.floor(Math.random() * 0xffffff);

    this.currentStroke = {
      id: 'stroke_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      brushId: this.currentBrush?.id || 'pencil',
      brushSnapshot: this.currentBrush ? this.currentBrush.createSnapshot() : {},
      color: isEraser ? '#000000' : this.currentColor,
      isEraser: isEraser,
      seed: strokeSeed,
      points: [stabilized]
    };

    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    this.renderLiveStroke();
  }

  appendStrokePoint(e) {
    if (!this.isDrawing || !this.currentStroke) return;

    const pos = this.getPointerPos(e);
    const rawWorld = this.viewport.screenToWorld(pos.x, pos.y);
    const snapped = this.toolManager.rulerGuides.snapPoint(rawWorld.x, rawWorld.y);

    const pressure = this.pressureEngine.resolvePressure(e, snapped);
    const stabilized = this.stabilizer.update({
      x: snapped.x,
      y: snapped.y,
      pressure: pressure,
      time: performance.now()
    });

    if (stabilized) {
      this.currentStroke.points.push(stabilized);
      this.renderLiveStroke();
    }
  }

  finishStroke() {
    if (!this.isDrawing || !this.currentStroke) return;
    this.isDrawing = false;
    this.activePointerId = null;

    // Catch up points from stabilizer on finger release
    const catchUp = this.stabilizer.finish();
    if (catchUp && catchUp.length > 0) {
      for (const pt of catchUp) {
        this.currentStroke.points.push(pt);
      }
    }

    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer || activeLayer.locked) {
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
      return;
    }

    // Handle single tap dot
    if (this.currentStroke.points.length === 1) {
      const p = this.currentStroke.points[0];
      this.currentStroke.points.push({ ...p, x: p.x + 0.1, y: p.y + 0.1 });
    }

    // Render stroke permanently onto layer canvas
    this.renderStrokeToLayer(activeLayer, this.currentStroke);

    // Create history command
    if (this.history) {
      const cmd = new StrokeCommand(activeLayer, this.currentStroke, (l, fullRedraw) => {
        if (fullRedraw) {
          this.redrawLayerStrokes(l);
        } else {
          this.layerManager.invalidateCaches();
        }
      });
      this.history.push(cmd);
    }

    // Clear live buffer and invalidate layer composite cache
    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    this.currentStroke = null;
    this.layerManager.invalidateCaches();
  }

  cancelStroke() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.activePointerId = null;
      this.currentStroke = null;
      this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);
    }
  }

  renderLiveStroke() {
    if (!this.currentStroke) return;
    this.liveCtx.clearRect(0, 0, this.docWidth, this.docHeight);

    // If symmetry is active, render symmetry instances
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

  renderStrokeToContext(ctx, stroke) {
    const b = stroke.brushSnapshot || {};
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.save();

    // Clip to selection mask if present
    if (this.toolManager.selectionTool.hasSelection) {
      // Selection restricts drawing
    }

    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = b.blendMode || 'source-over';
    }

    ctx.fillStyle = stroke.color;
    ctx.strokeStyle = stroke.color;

    // Pixel Art Mode check
    if (this.pixelArtMode || b.isPixel) {
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const pixels = bresenhamPixelPerfect(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        for (const px of pixels) {
          ctx.fillRect(px.x, px.y, b.size || 1, b.size || 1);
        }
      }
      ctx.restore();
      return;
    }

    // Catmull-Rom Dense Sampling
    const samples = this.spline.sampleStroke(pts, 6);
    if (samples.length === 0) {
      ctx.restore();
      return;
    }

    const baseSize = b.size || 8;
    const baseOpacity = b.opacity ?? 1.0;
    const strokeSeed = stroke.seed || 1337;

    // Neon Glow multi-pass check
    if (b.glowWidth && b.glowWidth > 1.0 && !stroke.isEraser) {
      ctx.save();
      ctx.globalAlpha = baseOpacity * 0.35;
      ctx.lineWidth = baseSize * b.glowWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(samples[0].x, samples[0].y);
      for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(samples[i].x, samples[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Render individual stamp / ribbon segments
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let radius = (baseSize * s.pressure) / 2;

      // Taper at start and end
      if (b.taperStart > 0 && i < b.taperStart) {
        radius *= (i + 1) / b.taperStart;
      }
      if (b.taperEnd > 0 && i > samples.length - b.taperEnd) {
        radius *= (samples.length - i) / b.taperEnd;
      }

      // Coherent Noise Jitter modulation
      if (b.jitter && b.jitter.enabled) {
        const jitterVal = CoherentNoise.evaluateJitter(b.jitter, strokeSeed, s.distance, s.time);
        radius = Math.max(0.5, radius * (1.0 + jitterVal));
      }

      ctx.globalAlpha = Math.max(0.01, Math.min(1.0, baseOpacity * (b.flow ?? 1.0)));

      // Calligraphy Chisel Tip
      if (b.tipShape === 'chisel') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(b.rotation || 0.785);
        ctx.fillRect(-radius * 2, -radius * 0.5, radius * 4, radius);
        ctx.restore();
      } else if (b.tipShape === 'gaussian' || b.hardness < 0.5) {
        // Soft airbrush radial gradient
        const rad = Math.max(1, radius);
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
        grad.addColorStop(0, stroke.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard round stamp
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  redrawLayerStrokes(layer) {
    layer.ctx.clearRect(0, 0, layer.width, layer.height);
    for (const s of layer.strokes) {
      if (s.shapeType) {
        // Vector shape
        this.toolManager.shapeTool.constructor.renderShape(layer.ctx, s);
      } else if (s.points) {
        this.renderStrokeToContext(layer.ctx, s);
      }
    }
    layer.updateThumbnail();
    this.layerManager.invalidateCaches();
  }

  commitFillWithAnimation(info) {
    const { startX, startY, patchCanvas, activeLayer, fillColorHex } = info;
    this.onHaptic?.();

    // Trigger visual ripple expansion effect
    const rippleEl = document.createElement('div');
    rippleEl.className = 'fill-ripple-effect';
    rippleEl.style.backgroundColor = fillColorHex;

    const screenPos = this.viewport.worldToScreen(startX, startY);
    const size = Math.max(this.viewportCanvas.width, this.viewportCanvas.height) * 1.5;
    rippleEl.style.width = size + 'px';
    rippleEl.style.height = size + 'px';
    rippleEl.style.left = (screenPos.x - size / 2) + 'px';
    rippleEl.style.top = (screenPos.y - size / 2) + 'px';

    document.getElementById('ui-overlay')?.appendChild(rippleEl);
    setTimeout(() => rippleEl.remove(), 350);

    // Commit to layer canvas
    activeLayer.ctx.drawImage(patchCanvas, 0, 0);
    activeLayer.updateThumbnail();
    this.layerManager.invalidateCaches();
  }

  redrawActiveLayer() {
    const active = this.layerManager.getActiveLayer();
    if (active) {
      this.redrawLayerStrokes(active);
    }
  }

  /**
   * Main 60 FPS Viewport Render Loop
   */
  renderLoop() {
    if (!this.running) return;

    // Resize canvas if container size changed
    const w = this.viewportCanvas.clientWidth;
    const h = this.viewportCanvas.clientHeight;
    if (this.viewportCanvas.width !== w || this.viewportCanvas.height !== h) {
      this.viewportCanvas.width = w;
      this.viewportCanvas.height = h;
      this.viewport.resizeScreen(w, h);
    }

    const ctx = this.ctx;
    ctx.save();

    // 1. Clear screen viewport
    ctx.clearRect(0, 0, w, h);

    // 2. Apply pan, zoom, rotation, mirror transforms
    this.viewport.applyTransform(ctx);

    // 3. Render document layers & live stroke buffer
    const activeLayer = this.layerManager.getActiveLayer();
    const liveOpacity = this.currentBrush?.opacity ?? 1.0;
    const liveBlend = this.currentBrush?.blendMode || 'source-over';

    this.layerManager.compositeStack(
      ctx,
      this.isDrawing ? this.liveCanvas : null,
      liveOpacity,
      liveBlend
    );

    // 4. Overlays: Shapes and Lasso live preview
    if (this.toolManager.activeTool === 'shape' && this.toolManager.shapeTool.active) {
      this.toolManager.shapeTool.drawLive(ctx, this.currentColor, this.currentBrush?.size || 4);
    } else if (this.toolManager.activeTool === 'lasso-fill' && this.toolManager.lassoFill.active) {
      this.toolManager.lassoFill.drawLive(ctx, this.currentColor);
    } else if (this.toolManager.activeTool === 'gradient' && this.toolManager.gradientTool.active) {
      this.toolManager.gradientTool.drawLive(ctx, this.currentColor, '#ffffff');
    }

    // 5. Overlays: Transform handles, Point editor, Marching ants, Symmetry, Guides
    if (this.toolManager.activeTool === 'transform') {
      this.toolManager.transformTool.drawOverlay(ctx);
    }
    if (this.toolManager.activeTool === 'point-editor') {
      this.toolManager.vectorPointEditor.drawOverlay(ctx);
    }
    this.toolManager.selectionTool.drawMarchingAnts(ctx);
    this.toolManager.symmetry.drawOverlay(ctx, this.docWidth, this.docHeight);
    this.toolManager.rulerGuides.drawGuides(ctx, this.docWidth, this.docHeight);

    // 6. Stabilizer Lazy Rope visual string
    const rope = this.stabilizer.getRopeVisual();
    if (rope) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rope.finger.x, rope.finger.y);
      ctx.lineTo(rope.tip.x, rope.tip.y);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rope.finger.x, rope.finger.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    requestAnimationFrame(this.renderLoop);
  }
}

/* --- IndexedDBStorage.js --- */
/**
 * Vectura IndexedDB Storage & Autosave Engine
 * Robust offline persistence for vector artwork, layers, metadata, and crash recovery.
 */
class IndexedDBStorage {
  constructor(dbName = 'VecturaDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('autosave')) {
          db.createObjectStore('autosave', { keyPath: 'id' });
        }
      };

      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  async saveProject(projectData) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.put(projectData);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getProject(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllProjects() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteProject(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async saveAutosave(data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('autosave', 'readwrite');
      const store = tx.objectStore('autosave');
      const req = store.put({ id: 'current_autosave', ...data, timestamp: Date.now() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getAutosave() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('autosave', 'readonly');
      const store = tx.objectStore('autosave');
      const req = store.get('current_autosave');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
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
   */
  async exportRaster(format = 'image/png', quality = 0.92, transparent = false) {
    const vc = this.vectorCanvas;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = vc.docWidth;
    exportCanvas.height = vc.docHeight;
    const ctx = exportCanvas.getContext('2d');

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
   * Triggers download or native Android sharing sheet.
   */
  async shareOrDownload(dataUrlOrBlob, filename, mimeType) {
    // If AndroidBridge is available in native app, use it for Android share intent
    if (window.AndroidBridge && typeof dataUrlOrBlob === 'string') {
      window.AndroidBridge.shareFile(dataUrlOrBlob, mimeType, filename);
      return;
    }

    // Web Share API fallback for modern mobile browsers
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

    // Fallback: standard file download trigger
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
 * Vectura Modern Glass Color Picker
 * HSV Square, Hue Slider, Hex Input, Harmonies, and Color History (last 20).
 */
class ColorPicker {
  constructor(containerEl, onChange) {
    this.container = containerEl;
    this.onChange = onChange;

    this.hue = 260; // 0 to 360
    this.sat = 0.7; // 0 to 1
    this.val = 0.9; // 0 to 1
    this.recentColors = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ffffff', '#000000'];

    this.render();
  }

  getHex() {
    return this.hsvToHex(this.hue, this.sat, this.val);
  }

  setColorHex(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return;
    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.hue = hsv.h;
    this.sat = hsv.s;
    this.val = hsv.v;
    this.updateCanvas();
  }

  addRecentColor(hex) {
    if (!this.recentColors.includes(hex)) {
      this.recentColors.unshift(hex);
      if (this.recentColors.length > 20) this.recentColors.pop();
      this.renderRecentPalette();
    }
  }

  render() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="position: relative; width: 100%; aspect-ratio: 1.4; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--glass-border);">
          <canvas id="cp-hsv-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
          <div id="cp-hsv-cursor" style="position: absolute; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 4px #000; pointer-events: none; transform: translate(-50%, -50%);"></div>
        </div>

        <div style="position: relative; width: 100%; height: 24px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--glass-border);">
          <canvas id="cp-hue-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
          <div id="cp-hue-cursor" style="position: absolute; top: 0; bottom: 0; width: 8px; border: 2px solid #fff; border-radius: 4px; box-shadow: 0 0 4px #000; pointer-events: none; transform: translateX(-50%);"></div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div id="cp-preview-box" style="width: 40px; height: 40px; border-radius: var(--radius-sm); border: 1px solid var(--glass-border);"></div>
            <input type="text" id="cp-hex-input" class="glass-input" style="width: 90px; text-transform: uppercase;" value="#8B5CF6" />
          </div>
          <button id="cp-add-swatch-btn" class="glass-btn" style="padding: 6px 12px; font-size: 11px;">+ Save</button>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Harmonies</div>
          <div id="cp-harmonies-row" style="display: flex; gap: 6px;"></div>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Palette History (20)</div>
          <div id="cp-recent-palette" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px;"></div>
        </div>
      </div>
    `;

    this.hsvCanvas = this.container.querySelector('#cp-hsv-canvas');
    this.hueCanvas = this.container.querySelector('#cp-hue-canvas');
    this.hsvCursor = this.container.querySelector('#cp-hsv-cursor');
    this.hueCursor = this.container.querySelector('#cp-hue-cursor');
    this.previewBox = this.container.querySelector('#cp-preview-box');
    this.hexInput = this.container.querySelector('#cp-hex-input');
    this.harmoniesRow = this.container.querySelector('#cp-harmonies-row');
    this.recentGrid = this.container.querySelector('#cp-recent-palette');

    this.setupEvents();
    this.updateCanvas();
    this.renderRecentPalette();
  }

  setupEvents() {
    let draggingHsv = false;
    let draggingHue = false;

    const handleHsv = (e) => {
      const rect = this.hsvCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this.sat = x;
      this.val = 1 - y;
      this.updateCursor();
      this.notify();
    };

    this.hsvCanvas.addEventListener('pointerdown', (e) => {
      draggingHsv = true;
      this.hsvCanvas.setPointerCapture(e.pointerId);
      handleHsv(e);
    });
    this.hsvCanvas.addEventListener('pointermove', (e) => {
      if (draggingHsv) handleHsv(e);
    });
    this.hsvCanvas.addEventListener('pointerup', (e) => {
      draggingHsv = false;
      this.addRecentColor(this.getHex());
    });

    const handleHue = (e) => {
      const rect = this.hueCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.hue = x * 360;
      this.updateHueCanvas();
      this.updateHsvCanvas();
      this.updateCursor();
      this.notify();
    };

    this.hueCanvas.addEventListener('pointerdown', (e) => {
      draggingHue = true;
      this.hueCanvas.setPointerCapture(e.pointerId);
      handleHue(e);
    });
    this.hueCanvas.addEventListener('pointermove', (e) => {
      if (draggingHue) handleHue(e);
    });
    this.hueCanvas.addEventListener('pointerup', () => {
      draggingHue = false;
      this.addRecentColor(this.getHex());
    });

    this.hexInput.addEventListener('change', () => {
      this.setColorHex(this.hexInput.value);
      this.notify();
    });

    this.container.querySelector('#cp-add-swatch-btn').addEventListener('click', () => {
      this.addRecentColor(this.getHex());
    });
  }

  updateCanvas() {
    this.updateHueCanvas();
    this.updateHsvCanvas();
    this.updateCursor();
  }

  updateHueCanvas() {
    const ctx = this.hueCanvas.getContext('2d');
    const w = (this.hueCanvas.width = this.hueCanvas.clientWidth || 280);
    const h = (this.hueCanvas.height = 24);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 360; i += 30) {
      grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  updateHsvCanvas() {
    const ctx = this.hsvCanvas.getContext('2d');
    const w = (this.hsvCanvas.width = this.hsvCanvas.clientWidth || 280);
    const h = (this.hsvCanvas.height = this.hsvCanvas.clientHeight || 180);

    // Saturation horizontal gradient
    const gradSat = ctx.createLinearGradient(0, 0, w, 0);
    gradSat.addColorStop(0, '#ffffff');
    gradSat.addColorStop(1, `hsl(${this.hue}, 100%, 50%)`);
    ctx.fillStyle = gradSat;
    ctx.fillRect(0, 0, w, h);

    // Value vertical gradient
    const gradVal = ctx.createLinearGradient(0, 0, 0, h);
    gradVal.addColorStop(0, 'rgba(0,0,0,0)');
    gradVal.addColorStop(1, '#000000');
    ctx.fillStyle = gradVal;
    ctx.fillRect(0, 0, w, h);
  }

  updateCursor() {
    const rectHsv = this.hsvCanvas.getBoundingClientRect();
    if (rectHsv.width > 0) {
      this.hsvCursor.style.left = this.sat * rectHsv.width + 'px';
      this.hsvCursor.style.top = (1 - this.val) * rectHsv.height + 'px';
    }

    const rectHue = this.hueCanvas.getBoundingClientRect();
    if (rectHue.width > 0) {
      this.hueCursor.style.left = (this.hue / 360) * rectHue.width + 'px';
    }

    const hex = this.getHex();
    this.previewBox.style.backgroundColor = hex;
    this.hexInput.value = hex.toUpperCase();

    this.renderHarmonies();
  }

  notify() {
    const hex = this.getHex();
    this.onChange?.(hex);
  }

  renderHarmonies() {
    const compHue = (this.hue + 180) % 360;
    const compHex = this.hsvToHex(compHue, this.sat, this.val);

    const ana1Hue = (this.hue + 30) % 360;
    const ana1Hex = this.hsvToHex(ana1Hue, this.sat, this.val);

    const tri1Hue = (this.hue + 120) % 360;
    const tri1Hex = this.hsvToHex(tri1Hue, this.sat, this.val);

    const colors = [compHex, ana1Hex, tri1Hex];
    this.harmoniesRow.innerHTML = colors
      .map(
        c => `<div style="flex: 1; height: 26px; border-radius: var(--radius-sm); background: ${c}; cursor: pointer; border: 1px solid var(--glass-border);" data-color="${c}"></div>`
      )
      .join('');

    this.harmoniesRow.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        this.setColorHex(el.dataset.color);
        this.notify();
      });
    });
  }

  renderRecentPalette() {
    this.recentGrid.innerHTML = this.recentColors
      .map(
        c => `<div style="aspect-ratio: 1; border-radius: var(--radius-sm); background: ${c}; cursor: pointer; border: 1px solid var(--glass-border);" data-color="${c}"></div>`
      )
      .join('');

    this.recentGrid.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        this.setColorHex(el.dataset.color);
        this.notify();
      });
    });
  }

  hsvToHex(h, s, v) {
    const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    const r = Math.round(f(5) * 255);
    const g = Math.round(f(3) * 255);
    const b = Math.round(f(1) * 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return isNaN(num) ? null : { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, v };
  }
}

/* --- LayerPanel.js --- */
/**
 * Vectura Glass Layer Panel UI
 * Layer thumbnails, 18 blend modes, clipping mask indicator, alpha lock, and reordering.
 */


class LayerPanel {
  constructor(containerEl, layerManager, onLayerChanged) {
    this.container = containerEl;
    this.layerManager = layerManager;
    this.onLayerChanged = onLayerChanged;

    this.render();
  }

  render() {
    const lm = this.layerManager;
    const active = lm.getActiveLayer();

    const blendOptions = BLEND_MODES.map(
      m => `<option value="${m.id}" ${active && active.blendMode === m.id ? 'selected' : ''}>${m.name}</option>`
    ).join('');

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <!-- Quick Layer Controls -->
        <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--glass-border);">
          <div style="display: flex; gap: 6px;">
            <button id="lp-add-btn" class="glass-btn glass-btn-icon" title="New Layer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button id="lp-dup-btn" class="glass-btn glass-btn-icon" title="Duplicate Layer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button id="lp-merge-btn" class="glass-btn glass-btn-icon" title="Merge Down">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"></path></svg>
            </button>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="lp-clear-btn" class="glass-btn glass-btn-icon" title="Clear Layer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <button id="lp-del-btn" class="glass-btn glass-btn-icon" title="Delete Layer" style="color: var(--danger);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <!-- Selected Layer Detail Bar -->
        ${
          active
            ? `
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px; background: rgba(0,0,0,0.18); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 600;">Opacity</span>
              <span id="lp-opacity-val" style="font-size: 12px; color: var(--text-muted);">${Math.round(active.opacity * 100)}%</span>
            </div>
            <input type="range" id="lp-opacity-slider" class="glass-slider" min="0" max="100" value="${Math.round(active.opacity * 100)}" />
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span style="font-size: 12px; font-weight: 600;">Blend Mode</span>
              <select id="lp-blend-select" class="glass-input" style="padding: 4px 8px; font-size: 12px;">
                ${blendOptions}
              </select>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <button id="lp-clip-btn" class="glass-btn ${active.clippingMask ? 'active' : ''}" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                ↳ Clip
              </button>
              <button id="lp-alpha-btn" class="glass-btn ${active.alphaLock ? 'active' : ''}" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                🔒 Alpha
              </button>
              <button id="lp-ref-btn" class="glass-btn ${active.isReference ? 'active' : ''}" style="flex: 1; padding: 6px 8px; font-size: 11px;">
                ★ Ref
              </button>
            </div>
          </div>
        `
            : ''
        }

        <!-- Layers Stack (Top to Bottom visually: top layer first) -->
        <div id="lp-layers-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 48vh; padding-right: 4px;"></div>
      </div>
    `;

    this.renderLayerItems();
    this.setupEvents();
  }

  renderLayerItems() {
    const listEl = this.container.querySelector('#lp-layers-list');
    if (!listEl) return;
    const lm = this.layerManager;
    const activeId = lm.activeLayerId;

    // Display top layer at top of UI list (reverse stack order)
    const reversed = [...lm.layers].reverse();

    listEl.innerHTML = reversed
      .map(layer => {
        const isActive = layer.id === activeId;
        const indent = layer.clippingMask ? 'margin-left: 20px;' : '';
        return `
        <div class="glass-panel" data-id="${layer.id}" style="${indent} display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; cursor: pointer; border-color: ${isActive ? 'var(--accent-primary)' : 'var(--glass-border)'}; background: ${isActive ? 'var(--glass-bg-active)' : 'var(--glass-bg)'};">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            ${layer.clippingMask ? `<span style="color: var(--accent-secondary); font-size: 14px;">↳</span>` : ''}
            <div style="width: 44px; height: 44px; border-radius: var(--radius-sm); background: #1a202c; border: 1px solid var(--glass-border); overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <canvas class="lp-thumb-canvas" width="64" height="64" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600; color: ${isActive ? 'var(--text-main)' : 'var(--text-muted)'};">${layer.name}</span>
              <span style="font-size: 11px; color: var(--text-dim);">${layer.blendMode} • ${Math.round(layer.opacity * 100)}%</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="glass-btn glass-btn-icon lp-vis-btn" data-id="${layer.id}" style="width: 34px; height: 34px;">
              ${layer.visible ? '👁' : '🚫'}
            </button>
            <button class="glass-btn glass-btn-icon lp-lock-btn" data-id="${layer.id}" style="width: 34px; height: 34px;">
              ${layer.locked ? '🔒' : '🔓'}
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    // Draw thumbnails
    listEl.querySelectorAll('.glass-panel').forEach(itemEl => {
      const id = itemEl.dataset.id;
      const layer = lm.layers.find(l => l.id === id);
      if (layer) {
        const thumbCanvas = itemEl.querySelector('.lp-thumb-canvas');
        if (thumbCanvas) {
          const tCtx = thumbCanvas.getContext('2d');
          tCtx.drawImage(layer.thumbCanvas, 0, 0);
        }
      }
    });
  }

  setupEvents() {
    const lm = this.layerManager;

    this.container.querySelector('#lp-add-btn')?.addEventListener('click', () => {
      lm.addLayer('Layer ' + (lm.layers.length + 1));
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-dup-btn')?.addEventListener('click', () => {
      lm.duplicateLayer(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-merge-btn')?.addEventListener('click', () => {
      lm.mergeDown(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-clear-btn')?.addEventListener('click', () => {
      lm.clearLayer(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    this.container.querySelector('#lp-del-btn')?.addEventListener('click', () => {
      lm.deleteLayer(lm.activeLayerId);
      this.render();
      this.onLayerChanged?.();
    });

    // Layer card click
    this.container.querySelectorAll('#lp-layers-list .glass-panel').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.lp-vis-btn') || e.target.closest('.lp-lock-btn')) return;
        const id = card.dataset.id;
        lm.setActiveLayer(id);
        this.render();
        this.onLayerChanged?.();
      });
    });

    // Visibility & Lock buttons
    this.container.querySelectorAll('.lp-vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const l = lm.layers.find(layer => layer.id === id);
        if (l) {
          l.visible = !l.visible;
          lm.invalidateCaches();
          this.render();
          this.onLayerChanged?.();
        }
      });
    });

    this.container.querySelectorAll('.lp-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const l = lm.layers.find(layer => layer.id === id);
        if (l) {
          l.locked = !l.locked;
          this.render();
        }
      });
    });

    // Opacity slider
    const opSlider = this.container.querySelector('#lp-opacity-slider');
    opSlider?.addEventListener('input', (e) => {
      const active = lm.getActiveLayer();
      if (active) {
        active.opacity = e.target.value / 100;
        const label = this.container.querySelector('#lp-opacity-val');
        if (label) label.textContent = `${e.target.value}%`;
        lm.invalidateCaches();
        this.onLayerChanged?.();
      }
    });

    // Blend mode selector
    const blendSelect = this.container.querySelector('#lp-blend-select');
    blendSelect?.addEventListener('change', (e) => {
      const active = lm.getActiveLayer();
      if (active) {
        active.blendMode = e.target.value;
        lm.invalidateCaches();
        this.render();
        this.onLayerChanged?.();
      }
    });

    // Clipping Mask toggle
    this.container.querySelector('#lp-clip-btn')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        active.clippingMask = !active.clippingMask;
        lm.invalidateCaches();
        this.render();
        this.onLayerChanged?.();
      }
    });

    // Alpha Lock toggle
    this.container.querySelector('#lp-alpha-btn')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        active.alphaLock = !active.alphaLock;
        this.render();
      }
    });

    // Reference Layer toggle
    this.container.querySelector('#lp-ref-btn')?.addEventListener('click', () => {
      const active = lm.getActiveLayer();
      if (active) {
        active.isReference = !active.isReference;
        this.render();
      }
    });
  }
}

/* --- BrushPanel.js --- */
/**
 * Vectura Brush Panel & Comprehensive Brush Editor
 * 25+ brush library with category tabs, live previews, and coherent noise graph.
 */




class BrushPanel {
  constructor(containerEl, currentBrush, onBrushChanged) {
    this.container = containerEl;
    this.currentBrush = currentBrush;
    this.onBrushChanged = onBrushChanged;

    this.activeTab = 'library'; // 'library' | 'editor'
    this.activeCategory = 'ink';
    this.brushes = DEFAULT_BRUSH_PRESETS.map(p => new Brush(p));

    this.render();
  }

  setBrush(brush) {
    this.currentBrush = brush;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <!-- Mode Tabs -->
        <div style="display: flex; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; gap: 8px;">
          <button id="bp-tab-lib" class="glass-btn ${this.activeTab === 'library' ? 'active' : ''}" style="flex: 1;">
            Library (${this.brushes.length})
          </button>
          <button id="bp-tab-edit" class="glass-btn ${this.activeTab === 'editor' ? 'active' : ''}" style="flex: 1;">
            Editor & Noise
          </button>
        </div>

        ${this.activeTab === 'library' ? this.renderLibraryHTML() : this.renderEditorHTML()}
      </div>
    `;

    this.setupEvents();
    if (this.activeTab === 'library') {
      this.drawLibraryPreviews();
    } else {
      this.drawEditorPreviews();
    }
  }

  renderLibraryHTML() {
    const categoryTabs = BRUSH_CATEGORIES.map(
      cat => `
      <button class="glass-btn bp-cat-btn ${this.activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}" style="padding: 4px 10px; font-size: 11px; min-height: 32px;">
        ${cat.name}
      </button>
    `
    ).join('');

    const filtered = this.brushes.filter(b => b.category === this.activeCategory);

    const cards = filtered.map(b => {
      const isSelected = this.currentBrush && this.currentBrush.id === b.id;
      return `
        <div class="glass-panel bp-brush-card" data-id="${b.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; cursor: pointer; border-color: ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}; background: ${isSelected ? 'var(--glass-bg-active)' : 'var(--glass-bg)'};">
          <div style="display: flex; flex-direction: column; flex: 1;">
            <span style="font-size: 13px; font-weight: 600; color: ${isSelected ? 'var(--text-main)' : 'var(--text-muted)'};">${b.name}</span>
            <span style="font-size: 11px; color: var(--text-dim);">${b.size}px • Stab ${b.stabilizer}%</span>
          </div>
          <div style="width: 100px; height: 32px; border-radius: var(--radius-sm); background: rgba(0,0,0,0.25); overflow: hidden;">
            <canvas class="bp-preview-canvas" data-id="${b.id}" width="100" height="32" style="width: 100%; height: 100%;"></canvas>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!-- Category Tabs -->
      <div style="display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px;">
        ${categoryTabs}
      </div>

      <!-- Brush Cards Grid -->
      <div id="bp-cards-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 52vh; padding-right: 4px;">
        ${cards}
      </div>
    `;
  }

  renderEditorHTML() {
    const b = this.currentBrush;
    if (!b) return `<div>No brush selected</div>`;

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: 60vh; padding-right: 6px;">
        <!-- Live Stroke Test Canvas -->
        <div style="width: 100%; height: 50px; border-radius: var(--radius-md); background: #1a202c; border: 1px solid var(--glass-border); overflow: hidden;">
          <canvas id="bp-editor-stroke-preview" width="300" height="50" style="width: 100%; height: 100%;"></canvas>
        </div>

        <!-- Slider Controls -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Base Size</span>
              <span>${b.size} px</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="size" min="1" max="150" value="${b.size}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Opacity</span>
              <span>${Math.round(b.opacity * 100)}%</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="opacity" min="5" max="100" value="${Math.round(b.opacity * 100)}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Hardness</span>
              <span>${Math.round(b.hardness * 100)}%</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="hardness" min="0" max="100" value="${Math.round(b.hardness * 100)}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Stabilizer Strength</span>
              <span>${b.stabilizer}%</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="stabilizer" min="0" max="100" value="${b.stabilizer}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Taper Length</span>
              <span>${b.taperEnd || 0}</span>
            </div>
            <input type="range" class="glass-slider bp-param-input" data-param="taperEnd" min="0" max="60" value="${b.taperEnd || 0}" />
          </div>
        </div>

        <!-- Coherent Noise Jitter Section -->
        <div style="padding: 10px; background: rgba(0,0,0,0.22); border-radius: var(--radius-md); border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 600;">Coherent 1D Noise Jitter</span>
            <input type="checkbox" id="bp-jitter-toggle" ${b.jitter && b.jitter.enabled ? 'checked' : ''} />
          </div>
          <div style="width: 100%; height: 36px; background: #0c0f17; border-radius: var(--radius-sm); overflow: hidden;">
            <canvas id="bp-noise-graph" width="280" height="36" style="width: 100%; height: 100%;"></canvas>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
            <span>Smooth undulating wave (non-random)</span>
          </div>
        </div>
      </div>
    `;
  }

  setupEvents() {
    this.container.querySelector('#bp-tab-lib')?.addEventListener('click', () => {
      this.activeTab = 'library';
      this.render();
    });

    this.container.querySelector('#bp-tab-edit')?.addEventListener('click', () => {
      this.activeTab = 'editor';
      this.render();
    });

    // Category buttons
    this.container.querySelectorAll('.bp-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeCategory = btn.dataset.cat;
        this.render();
      });
    });

    // Brush card selection
    this.container.querySelectorAll('.bp-brush-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const found = this.brushes.find(b => b.id === id);
        if (found) {
          this.currentBrush = found;
          this.onBrushChanged?.(found);
          this.render();
        }
      });
    });

    // Parameter sliders in Editor
    this.container.querySelectorAll('.bp-param-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const param = e.target.dataset.param;
        let val = parseFloat(e.target.value);
        if (param === 'opacity' || param === 'hardness') val /= 100;
        this.currentBrush[param] = val;
        this.drawEditorPreviews();
        this.onBrushChanged?.(this.currentBrush);
      });
    });

    // Jitter toggle
    this.container.querySelector('#bp-jitter-toggle')?.addEventListener('change', (e) => {
      if (!this.currentBrush.jitter) this.currentBrush.jitter = { enabled: false };
      this.currentBrush.jitter.enabled = e.target.checked;
      this.drawEditorPreviews();
      this.onBrushChanged?.(this.currentBrush);
    });
  }

  drawLibraryPreviews() {
    this.container.querySelectorAll('.bp-preview-canvas').forEach(cvs => {
      const id = cvs.dataset.id;
      const brush = this.brushes.find(b => b.id === id);
      if (!brush) return;

      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, 100, 32);

      // Draw horizontal S-curve preview stroke
      ctx.strokeStyle = brush.isEraser ? '#64748b' : '#8b5cf6';
      ctx.lineWidth = Math.min(18, brush.size);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, 16);
      ctx.bezierCurveTo(35, 6, 65, 26, 90, 16);
      ctx.stroke();
    });
  }

  drawEditorPreviews() {
    const strokeCvs = this.container.querySelector('#bp-editor-stroke-preview');
    if (strokeCvs) {
      const ctx = strokeCvs.getContext('2d');
      ctx.clearRect(0, 0, 300, 50);

      const b = this.currentBrush;
      ctx.strokeStyle = b.isEraser ? '#64748b' : '#8b5cf6';
      ctx.lineWidth = Math.min(26, b.size);
      ctx.lineCap = 'round';
      ctx.globalAlpha = b.opacity;

      ctx.beginPath();
      ctx.moveTo(20, 25);
      ctx.bezierCurveTo(90, 8, 180, 42, 280, 25);
      ctx.stroke();
    }

    const noiseCvs = this.container.querySelector('#bp-noise-graph');
    if (noiseCvs) {
      const ctx = noiseCvs.getContext('2d');
      ctx.clearRect(0, 0, 280, 36);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let x = 0; x < 280; x += 2) {
        const val = CoherentNoise.layeredSines(x * 0.05, 42, 3);
        const y = 18 + val * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}

/* --- ToolPanel.js --- */
/**
 * Vectura Tool Options Panel
 * Context-sensitive controls for Fill Bucket, Selection, Shapes, Transform, Guides and Symmetry.
 */
class ToolPanel {
  constructor(containerEl, toolManager, onOptionChanged) {
    this.container = containerEl;
    this.toolManager = toolManager;
    this.onOptionChanged = onOptionChanged;

    this.render();
  }

  update(activeTool) {
    this.render();
  }

  render() {
    const tm = this.toolManager;
    const tool = tm.activeTool;

    let content = '';

    if (tool === 'bucket') {
      const fb = tm.fillBucket;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Color Tolerance</span>
              <span>${fb.tolerance}%</span>
            </div>
            <input type="range" class="glass-slider tp-input" data-tool="bucket" data-prop="tolerance" min="0" max="100" value="${fb.tolerance}" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Expand / Contract</span>
              <span>${fb.expand > 0 ? '+' : ''}${fb.expand} px</span>
            </div>
            <input type="range" class="glass-slider tp-input" data-tool="bucket" data-prop="expand" min="-5" max="10" value="${fb.expand}" />
          </div>

          <div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Sampling Source</div>
            <div style="display: flex; gap: 6px;">
              <button class="glass-btn tp-sample-src ${fb.sampleSource === 'all' ? 'active' : ''}" data-src="all" style="flex: 1; padding: 6px; font-size: 11px;">All Layers</button>
              <button class="glass-btn tp-sample-src ${fb.sampleSource === 'current' ? 'active' : ''}" data-src="current" style="flex: 1; padding: 6px; font-size: 11px;">Current</button>
              <button class="glass-btn tp-sample-src ${fb.sampleSource === 'reference' ? 'active' : ''}" data-src="reference" style="flex: 1; padding: 6px; font-size: 11px;">Reference</button>
            </div>
          </div>
        </div>
      `;
    } else if (tool === 'selection') {
      const st = tm.selectionTool;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Selection Shape</div>
            <div style="display: flex; gap: 6px;">
              <button class="glass-btn tp-sel-shape ${st.type === 'rect' ? 'active' : ''}" data-shape="rect" style="flex: 1; padding: 6px; font-size: 11px;">Rect</button>
              <button class="glass-btn tp-sel-shape ${st.type === 'ellipse' ? 'active' : ''}" data-shape="ellipse" style="flex: 1; padding: 6px; font-size: 11px;">Ellipse</button>
              <button class="glass-btn tp-sel-shape ${st.type === 'lasso' ? 'active' : ''}" data-shape="lasso" style="flex: 1; padding: 6px; font-size: 11px;">Lasso</button>
            </div>
          </div>

          <div style="display: flex; gap: 6px;">
            <button id="tp-sel-invert" class="glass-btn" style="flex: 1; font-size: 11px;">Invert</button>
            <button id="tp-sel-clear" class="glass-btn" style="flex: 1; font-size: 11px; color: var(--danger);">Deselect</button>
          </div>
        </div>
      `;
    } else if (tool === 'transform') {
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; gap: 6px;">
            <button id="tp-tr-fliph" class="glass-btn" style="flex: 1; font-size: 12px;">Flip H</button>
            <button id="tp-tr-flipv" class="glass-btn" style="flex: 1; font-size: 12px;">Flip V</button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="tp-tr-apply" class="glass-btn active" style="flex: 1; font-size: 13px;">✓ Apply</button>
            <button id="tp-tr-cancel" class="glass-btn" style="flex: 1; font-size: 13px; color: var(--danger);">✕ Cancel</button>
          </div>
        </div>
      `;
    } else if (tool === 'shape') {
      const sh = tm.shapeTool;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="glass-btn tp-shape-type ${sh.type === 'line' ? 'active' : ''}" data-type="line" style="flex: 1; min-width: 60px; font-size: 11px;">Line</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'rect' ? 'active' : ''}" data-type="rect" style="flex: 1; min-width: 60px; font-size: 11px;">Rect</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'ellipse' ? 'active' : ''}" data-type="ellipse" style="flex: 1; min-width: 60px; font-size: 11px;">Ellipse</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'polygon' ? 'active' : ''}" data-type="polygon" style="flex: 1; min-width: 60px; font-size: 11px;">Polygon</button>
            <button class="glass-btn tp-shape-type ${sh.type === 'star' ? 'active' : ''}" data-type="star" style="flex: 1; min-width: 60px; font-size: 11px;">Star</button>
          </div>
        </div>
      `;
    } else if (tool === 'symmetry') {
      const sym = tm.symmetry;
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; gap: 6px;">
            <button class="glass-btn tp-sym-btn ${sym.mode === 'off' ? 'active' : ''}" data-mode="off" style="flex: 1; font-size: 11px;">Off</button>
            <button class="glass-btn tp-sym-btn ${sym.mode === 'vertical' ? 'active' : ''}" data-mode="vertical" style="flex: 1; font-size: 11px;">Vertical</button>
            <button class="glass-btn tp-sym-btn ${sym.mode === 'horizontal' ? 'active' : ''}" data-mode="horizontal" style="flex: 1; font-size: 11px;">Horizontal</button>
            <button class="glass-btn tp-sym-btn ${sym.mode === 'radial' ? 'active' : ''}" data-mode="radial" style="flex: 1; font-size: 11px;">Radial</button>
          </div>

          ${
            sym.mode === 'radial'
              ? `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>Radial Axes</span>
                <span>${sym.radialAxes}</span>
              </div>
              <input type="range" id="tp-radial-axes" class="glass-slider" min="2" max="12" value="${sym.radialAxes}" />
            </div>
          `
              : ''
          }
        </div>
      `;
    } else if (tool === 'point-editor') {
      content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <span style="font-size: 12px; color: var(--text-muted);">Tap a vector stroke to edit its Catmull-Rom nodes.</span>
          <div style="display: flex; gap: 6px;">
            <button id="tp-pe-simplify" class="glass-btn" style="flex: 1; font-size: 12px;">Simplify Path</button>
            <button id="tp-pe-delete" class="glass-btn" style="flex: 1; font-size: 12px; color: var(--danger);">Delete Node</button>
          </div>
        </div>
      `;
    } else {
      content = `<div style="font-size: 12px; color: var(--text-muted);">Options for ${tool}</div>`;
    }

    this.container.innerHTML = content;
    this.setupEvents();
  }

  setupEvents() {
    const tm = this.toolManager;

    // Fill Bucket inputs
    this.container.querySelectorAll('.tp-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const prop = e.target.dataset.prop;
        tm.fillBucket[prop] = parseInt(e.target.value);
        this.render();
      });
    });

    this.container.querySelectorAll('.tp-sample-src').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.fillBucket.sampleSource = btn.dataset.src;
        this.render();
      });
    });

    // Selection buttons
    this.container.querySelectorAll('.tp-sel-shape').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.selectionTool.type = btn.dataset.shape;
        this.render();
      });
    });
    this.container.querySelector('#tp-sel-invert')?.addEventListener('click', () => {
      tm.selectionTool.invert();
    });
    this.container.querySelector('#tp-sel-clear')?.addEventListener('click', () => {
      tm.selectionTool.clear();
    });

    // Transform buttons
    this.container.querySelector('#tp-tr-fliph')?.addEventListener('click', () => tm.transformTool.flipHorizontal());
    this.container.querySelector('#tp-tr-flipv')?.addEventListener('click', () => tm.transformTool.flipVertical());
    this.container.querySelector('#tp-tr-apply')?.addEventListener('click', () => {
      tm.transformTool.applyTransform(() => this.onOptionChanged?.('transform-apply'));
      this.render();
    });
    this.container.querySelector('#tp-tr-cancel')?.addEventListener('click', () => {
      tm.transformTool.cancel();
      this.render();
    });

    // Shape buttons
    this.container.querySelectorAll('.tp-shape-type').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.shapeTool.type = btn.dataset.type;
        this.render();
      });
    });

    // Symmetry buttons
    this.container.querySelectorAll('.tp-sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tm.symmetry.mode = btn.dataset.mode;
        this.render();
      });
    });
    this.container.querySelector('#tp-radial-axes')?.addEventListener('input', (e) => {
      tm.symmetry.radialAxes = parseInt(e.target.value);
      this.render();
    });

    // Point editor
    this.container.querySelector('#tp-pe-simplify')?.addEventListener('click', () => {
      this.onOptionChanged?.('point-editor-simplify');
    });
    this.container.querySelector('#tp-pe-delete')?.addEventListener('click', () => {
      this.onOptionChanged?.('point-editor-delete');
    });
  }
}

/* --- SettingsDialog.js --- */
/**
 * Vectura Settings Dialog
 * Theme toggle, left-handed mode, gestures, palm rejection, haptics and performance mode.
 */
class SettingsDialog {
  constructor(modalEl, config, onConfigChanged) {
    this.modalEl = modalEl;
    this.config = config;
    this.onConfigChanged = onConfigChanged;

    this.render();
  }

  render() {
    this.modalEl.innerHTML = `
      <div class="glass-panel glass-modal" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 16px; font-weight: 700;">Studio Settings</span>
          <button id="sd-close-btn" class="glass-btn glass-btn-icon" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: 65vh;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Theme</span>
              <span style="font-size: 11px; color: var(--text-muted);">Dark glass or light glass</span>
            </div>
            <button id="sd-theme-btn" class="glass-btn" style="padding: 6px 14px; font-size: 12px;">
              ${this.config.theme === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Left-Handed Mode</span>
              <span style="font-size: 11px; color: var(--text-muted);">Swaps toolbar to the right edge</span>
            </div>
            <input type="checkbox" id="sd-lefthand-toggle" ${this.config.leftHanded ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Multi-Finger Gestures</span>
              <span style="font-size: 11px; color: var(--text-muted);">2-finger tap = Undo, 3-finger = Redo</span>
            </div>
            <input type="checkbox" id="sd-gestures-toggle" ${this.config.gesturesEnabled ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Stylus Palm Rejection</span>
              <span style="font-size: 11px; color: var(--text-muted);">Ignore touch when stylus active</span>
            </div>
            <input type="checkbox" id="sd-palm-toggle" ${this.config.palmRejection ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Haptic Feedback</span>
              <span style="font-size: 11px; color: var(--text-muted);">Vibrate on undo/redo/snapping</span>
            </div>
            <input type="checkbox" id="sd-haptics-toggle" ${this.config.haptics ? 'checked' : ''} />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600;">Performance Mode</span>
              <span style="font-size: 11px; color: var(--text-muted);">Reduces backdrop blur for battery</span>
            </div>
            <input type="checkbox" id="sd-perf-toggle" ${this.config.perfMode ? 'checked' : ''} />
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

    this.modalEl.querySelector('#sd-theme-btn')?.addEventListener('click', () => {
      this.config.theme = this.config.theme === 'light' ? 'dark' : 'light';
      this.render();
      this.onConfigChanged?.('theme', this.config.theme);
    });

    this.modalEl.querySelector('#sd-lefthand-toggle')?.addEventListener('change', (e) => {
      this.config.leftHanded = e.target.checked;
      this.onConfigChanged?.('leftHanded', this.config.leftHanded);
    });

    this.modalEl.querySelector('#sd-gestures-toggle')?.addEventListener('change', (e) => {
      this.config.gesturesEnabled = e.target.checked;
      this.onConfigChanged?.('gesturesEnabled', this.config.gesturesEnabled);
    });

    this.modalEl.querySelector('#sd-palm-toggle')?.addEventListener('change', (e) => {
      this.config.palmRejection = e.target.checked;
      this.onConfigChanged?.('palmRejection', this.config.palmRejection);
    });

    this.modalEl.querySelector('#sd-haptics-toggle')?.addEventListener('change', (e) => {
      this.config.haptics = e.target.checked;
      this.onConfigChanged?.('haptics', this.config.haptics);
    });

    this.modalEl.querySelector('#sd-perf-toggle')?.addEventListener('change', (e) => {
      this.config.perfMode = e.target.checked;
      this.onConfigChanged?.('perfMode', this.config.perfMode);
    });
  }

  open() {
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
 */


class HomeScreen {
  constructor(storage, onOpenProject, onNewProject) {
    this.storage = storage;
    this.onOpenProject = onOpenProject;
    this.onNewProject = onNewProject;

    this.screenEl = document.getElementById('home-screen');
    this.projects = [];
    this.init();
  }

  async init() {
    this.screenEl.innerHTML = `
      <div class="home-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; border: 1.5px solid var(--accent-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: var(--accent-primary);">V</div>
          <span style="font-size: 16px; font-weight: 700; color: var(--text-main);">My Artworks</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="hs-new-btn" class="glass-btn glass-btn-cta" style="font-size: 12px; padding: 6px 12px; height: 32px;">
            + New Canvas
          </button>
          <button id="hs-close-gallery" class="glass-btn glass-btn-icon" style="width: 32px; height: 32px;" title="Back to Drawing">
            ✕
          </button>
        </div>
      </div>

      <!-- Quick 1-Tap Presets Carousel -->
      <div class="home-presets-row">
        <div class="preset-chip" data-id="square_1080">1080×1080 Square</div>
        <div class="preset-chip" data-id="fhd_landscape">1920×1080 Landscape</div>
        <div class="preset-chip" data-id="fhd_portrait">1080×1920 Portrait</div>
        <div class="preset-chip" data-id="uhd_4k">4K Ultra HD</div>
        <div class="preset-chip" data-id="a4_print">A4 Print (300DPI)</div>
        <div class="preset-chip" data-id="pixel_32">Pixel Art (32×32)</div>
      </div>

      <!-- Projects Grid -->
      <div class="home-gallery" id="hs-gallery-grid"></div>

      <!-- New Project Dialog Modal -->
      <div id="hs-modal" class="glass-modal-backdrop">
        <div class="glass-panel glass-modal" style="padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 15px; font-weight: 700;">Create Custom Canvas</span>
            <button id="hs-modal-close" class="glass-btn glass-btn-icon" style="width: 28px; height: 28px;">✕</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Preset</label>
              <select id="hs-preset-select" class="glass-input" style="width: 100%;">
                ${CANVAS_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; gap: 10px;">
              <div style="flex: 1;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Width (px)</label>
                <input type="number" id="hs-input-w" class="glass-input" style="width: 100%;" value="1080" />
              </div>
              <div style="flex: 1;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Height (px)</label>
                <input type="number" id="hs-input-h" class="glass-input" style="width: 100%;" value="1080" />
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
              <span style="font-size: 12px;">Pixel Art Mode</span>
              <input type="checkbox" id="hs-input-pixel" />
            </div>

            <button id="hs-create-submit" class="glass-btn glass-btn-cta" style="margin-top: 4px; width: 100%; height: 38px;">
              Create Artwork
            </button>
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
    await this.refresh();
  }

  setupEvents() {
    const modal = this.screenEl.querySelector('#hs-modal');
    this.screenEl.querySelector('#hs-new-btn')?.addEventListener('click', () => {
      modal.classList.add('open');
    });
    this.screenEl.querySelector('#hs-modal-close')?.addEventListener('click', () => {
      modal.classList.remove('open');
    });
    this.screenEl.querySelector('#hs-close-gallery')?.addEventListener('click', () => {
      this.hide();
    });

    // 1-Tap Preset Chips
    this.screenEl.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.id;
        const p = CANVAS_PRESETS.find(item => item.id === id);
        if (p) {
          this.hide();
          this.onNewProject?.({ width: p.width, height: p.height, pixelArtMode: !!p.pixelMode });
        }
      });
    });

    // Custom Modal form
    const presetSelect = this.screenEl.querySelector('#hs-preset-select');
    const widthInput = this.screenEl.querySelector('#hs-input-w');
    const heightInput = this.screenEl.querySelector('#hs-input-h');
    const pixelInput = this.screenEl.querySelector('#hs-input-pixel');

    presetSelect?.addEventListener('change', () => {
      const p = CANVAS_PRESETS.find(item => item.id === presetSelect.value);
      if (p) {
        widthInput.value = p.width;
        heightInput.value = p.height;
        pixelInput.checked = !!p.pixelMode;
      }
    });

    this.screenEl.querySelector('#hs-create-submit')?.addEventListener('click', () => {
      const w = parseInt(widthInput.value) || 1080;
      const h = parseInt(heightInput.value) || 1080;
      const pixel = pixelInput.checked;
      modal.classList.remove('open');
      this.hide();
      this.onNewProject?.({ width: w, height: h, pixelArtMode: pixel });
    });
  }

  async refresh() {
    this.projects = await this.storage.getAllProjects();
    const grid = this.screenEl.querySelector('#hs-gallery-grid');
    if (!grid) return;

    if (this.projects.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 260px; color: var(--text-muted); gap: 10px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <span style="font-size: 14px; font-weight: 600;">No saved artworks</span>
          <button id="hs-first-new-btn" class="glass-btn glass-btn-cta" style="margin-top: 6px; font-size: 12px;">+ Create Canvas</button>
        </div>
      `;
      grid.querySelector('#hs-first-new-btn')?.addEventListener('click', () => {
        this.hide();
        this.onNewProject?.({ width: 1080, height: 1080 });
      });
      return;
    }

    grid.innerHTML = this.projects
      .map(p => `
      <div class="project-card" data-id="${p.id}">
        <img class="project-thumbnail" src="${p.thumbnail || ''}" alt="${p.name}" />
        <div class="project-info">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="project-name">${p.name}</span>
            <button class="glass-btn hs-del-btn" data-id="${p.id}" style="width: 24px; height: 24px; padding: 0; min-width: 24px; color: var(--danger);" title="Delete">✕</button>
          </div>
          <span class="project-date">${new Date(p.updatedAt).toLocaleDateString()} • ${p.width}×${p.height}</span>
        </div>
      </div>
    `)
      .join('');

    grid.querySelectorAll('.project-card').forEach(card => {
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
 * Master UI coordinator connecting user gestures, panels, sliders, dialogs and drawing engine.
 */







class UIManager {
  constructor(app) {
    this.app = app;
    this.vc = app.vectorCanvas;

    this.activeSheet = null; // 'layers' | 'brushes' | 'color' | 'tools'
    this.uiHidden = false;

    this.initElements();
    this.initPanels();
    this.setupEventListeners();
  }

  initElements() {
    this.topBar = document.getElementById('top-bar');
    this.toolbar = document.getElementById('toolbar');
    this.toolsPopover = document.getElementById('tools-popover');
    this.edgeSliders = document.getElementById('edge-sliders');
    this.uiOverlay = document.getElementById('ui-overlay');

    this.undoBtn = document.getElementById('btn-undo');
    this.redoBtn = document.getElementById('btn-redo');
    this.projectTitle = document.getElementById('project-title-display');

    // Edge sliders
    this.sizeSlider = document.getElementById('edge-size-slider');
    this.sizeDot = document.getElementById('edge-size-dot');
    this.sizeLabel = document.getElementById('edge-size-label');

    this.opacitySlider = document.getElementById('edge-opacity-slider');
    this.opacityDot = document.getElementById('edge-opacity-dot');
    this.opacityLabel = document.getElementById('edge-opacity-label');

    // Bottom Sheets
    this.sheetLayers = document.getElementById('sheet-layers');
    this.sheetBrushes = document.getElementById('sheet-brushes');
    this.sheetColor = document.getElementById('sheet-color');
    this.sheetTools = document.getElementById('sheet-tools');

    // Modals
    this.exportModal = document.getElementById('export-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.tutorialModal = document.getElementById('tutorial-modal');
  }

  initPanels() {
    // 1. Color Picker
    this.colorPicker = new ColorPicker(
      document.getElementById('sheet-color-content'),
      (hex) => {
        this.vc.currentColor = hex;
        this.updateColorAffordances(hex);
      }
    );

    // 2. Layer Panel
    this.layerPanel = new LayerPanel(
      document.getElementById('sheet-layers-content'),
      this.vc.layerManager,
      () => {
        this.updateLayerBadge();
      }
    );

    // 3. Brush Panel
    this.brushPanel = new BrushPanel(
      document.getElementById('sheet-brushes-content'),
      this.vc.currentBrush,
      (brush) => {
        this.vc.currentBrush = brush;
        this.updateEdgeSlidersFromBrush();
      }
    );

    // 4. Tool Panel
    this.toolPanel = new ToolPanel(
      document.getElementById('sheet-tools-content'),
      this.vc.toolManager,
      (action) => {
        if (action === 'transform-apply') {
          this.vc.redrawActiveLayer();
          this.closeSheets();
        } else if (action === 'point-editor-delete') {
          this.vc.toolManager.vectorPointEditor.deleteSelectedPoint(() => this.vc.redrawActiveLayer());
        } else if (action === 'point-editor-simplify') {
          this.vc.toolManager.vectorPointEditor.simplifyStroke(() => this.vc.redrawActiveLayer());
        }
      }
    );

    // 5. Settings
    this.settingsDialog = new SettingsDialog(
      this.settingsModal,
      this.app.config,
      (key, val) => this.app.onConfigChanged(key, val)
    );

    // 6. Tutorial
    this.tutorial = new Tutorial(this.tutorialModal);
  }

  setupEventListeners() {
    // Top Bar Actions
    this.undoBtn?.addEventListener('click', () => this.app.undo());
    this.redoBtn?.addEventListener('click', () => this.app.redo());
    document.getElementById('btn-home')?.addEventListener('click', () => this.app.openGallery());
    document.getElementById('btn-fit-view')?.addEventListener('click', () => this.vc.viewport.fitToScreen());
    document.getElementById('btn-mirror-view')?.addEventListener('click', () => this.vc.viewport.toggleMirror());
    document.getElementById('btn-export')?.addEventListener('click', () => this.openExportModal());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.settingsDialog.open());

    // Project Name edit
    this.projectTitle?.addEventListener('click', () => {
      const newName = prompt('Rename Artwork:', this.app.currentProject.name);
      if (newName && newName.trim()) {
        this.app.currentProject.name = newName.trim();
        this.projectTitle.textContent = newName.trim();
        this.app.saveCurrentProject();
      }
    });

    // Hide UI toggle
    document.getElementById('btn-toggle-ui')?.addEventListener('click', () => this.toggleHideUI());
    document.getElementById('btn-show-ui-floating')?.addEventListener('click', () => this.toggleHideUI());

    // Primary Toolbar Buttons
    const toolBtns = {
      'tool-btn-brush': 'brush',
      'tool-btn-eraser': 'eraser',
      'tool-btn-bucket': 'bucket',
      'tool-btn-lasso': 'lasso-fill',
      'tool-btn-select': 'selection',
      'tool-btn-transform': 'transform'
    };

    for (const [btnId, toolName] of Object.entries(toolBtns)) {
      document.getElementById(btnId)?.addEventListener('click', () => {
        // If brush is already active and user taps brush again, open brush studio sheet!
        if (toolName === 'brush' && this.vc.toolManager.activeTool === 'brush') {
          this.toggleSheet('brushes');
          return;
        }
        this.closePopover();
        this.selectTool(toolName, btnId);
      });
    }

    // "More Tools" popover toggle
    document.getElementById('tool-btn-more-tools')?.addEventListener('click', () => {
      this.toolsPopover?.classList.toggle('open');
    });

    // Popover Sub-tools
    const popoverTools = {
      'tool-btn-shape': 'shape',
      'tool-btn-point-edit': 'point-editor',
      'tool-btn-gradient': 'gradient',
      'tool-btn-text': 'text',
      'tool-btn-symmetry': 'symmetry'
    };

    for (const [btnId, toolName] of Object.entries(popoverTools)) {
      document.getElementById(btnId)?.addEventListener('click', () => {
        this.closePopover();
        this.selectTool(toolName, btnId);
      });
    }

    // Color button -> Color Sheet
    document.getElementById('tool-btn-color')?.addEventListener('click', () => {
      this.closePopover();
      this.toggleSheet('color');
    });

    // Layers button -> Layers Sheet
    document.getElementById('tool-btn-layers')?.addEventListener('click', () => {
      this.closePopover();
      this.toggleSheet('layers');
    });

    // Sheet close buttons & handle bars
    document.querySelectorAll('.sheet-close-btn, .sheet-handle-bar').forEach(el => {
      el.addEventListener('click', () => this.closeSheets());
    });

    // Edge Size Slider
    this.sizeSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (this.vc.currentBrush) {
        this.vc.currentBrush.size = val;
      }
      this.updateSizeSliderPreview(val);
    });

    // Edge Opacity Slider
    this.opacitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 100;
      if (this.vc.currentBrush) {
        this.vc.currentBrush.opacity = val;
      }
      this.updateOpacitySliderPreview(val);
    });

    // Export Modal Controls
    this.setupExportEvents();

    // Android Hardware Back Button Hook
    window.handleAndroidBack = () => {
      if (this.toolsPopover?.classList.contains('open')) {
        this.closePopover();
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
      if (this.settingsModal?.classList.contains('open')) {
        this.settingsDialog.close();
        return true;
      }
      if (this.tutorialModal?.classList.contains('open')) {
        this.tutorial.finish();
        return true;
      }
      if (this.uiHidden) {
        this.toggleHideUI();
        return true;
      }
      if (!document.getElementById('home-screen').classList.contains('hidden')) {
        return false; // Exit app
      }
      // Return to gallery
      this.app.openGallery();
      return true;
    };
  }

  closePopover() {
    this.toolsPopover?.classList.remove('open');
  }

  selectTool(toolName, btnId) {
    if (toolName === 'text') {
      const text = prompt('Enter text:');
      if (text && text.trim()) {
        const center = this.vc.viewport.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        this.vc.toolManager.textTool.commitText(
          this.vc.layerManager.getActiveLayer(),
          text.trim(),
          center.x,
          center.y,
          this.vc.currentColor
        );
        this.vc.layerManager.invalidateCaches();
      }
      return;
    }

    this.vc.toolManager.setTool(toolName, this.vc.layerManager.getActiveLayer());

    // Highlight active button
    document.querySelectorAll('#toolbar .glass-btn, #tools-popover .glass-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(btnId)?.classList.add('active');

    // Update tool panel options
    this.toolPanel.update(toolName);

    // Auto open options sheet for complex tools
    if (toolName === 'bucket' || toolName === 'transform' || toolName === 'symmetry' || toolName === 'shape') {
      this.openSheet('tools');
    }
  }

  toggleSheet(sheetName) {
    if (this.activeSheet === sheetName) {
      this.closeSheets();
    } else {
      this.openSheet(sheetName);
    }
  }

  openSheet(sheetName) {
    this.closeSheets();
    this.activeSheet = sheetName;
    const sheetMap = {
      layers: this.sheetLayers,
      brushes: this.sheetBrushes,
      color: this.sheetColor,
      tools: this.sheetTools
    };
    const target = sheetMap[sheetName];
    if (target) {
      target.classList.add('open');
      if (sheetName === 'layers') this.layerPanel.render();
      if (sheetName === 'brushes') this.brushPanel.render();
      if (sheetName === 'tools') this.toolPanel.render();
      if (sheetName === 'color') this.colorPicker.updateCanvas();
    }
  }

  closeSheets() {
    this.sheetLayers?.classList.remove('open');
    this.sheetBrushes?.classList.remove('open');
    this.sheetColor?.classList.remove('open');
    this.sheetTools?.classList.remove('open');
    this.activeSheet = null;
  }

  toggleHideUI() {
    this.uiHidden = !this.uiHidden;
    const overlay = document.getElementById('ui-overlay');
    const showBtn = document.getElementById('btn-show-ui-floating');

    if (this.uiHidden) {
      overlay.classList.add('hidden-ui');
      if (showBtn) showBtn.style.display = 'flex';
      this.closeSheets();
      this.closePopover();
    } else {
      overlay.classList.remove('hidden-ui');
      if (showBtn) showBtn.style.display = 'none';
    }
  }

  updateEdgeSlidersFromBrush() {
    if (!this.vc.currentBrush) return;
    const b = this.vc.currentBrush;
    if (this.sizeSlider) this.sizeSlider.value = b.size;
    this.updateSizeSliderPreview(b.size);

    if (this.opacitySlider) this.opacitySlider.value = Math.round(b.opacity * 100);
    this.updateOpacitySliderPreview(b.opacity);
  }

  updateSizeSliderPreview(size) {
    if (this.sizeLabel) this.sizeLabel.textContent = `${size}px`;
    if (this.sizeDot) {
      const dotInner = this.sizeDot.querySelector('.slider-preview-dot-inner');
      if (dotInner) {
        const visual = Math.max(3, Math.min(16, size * 0.35));
        dotInner.style.width = visual + 'px';
        dotInner.style.height = visual + 'px';
      }
    }
  }

  updateOpacitySliderPreview(opacity) {
    if (this.opacityLabel) this.opacityLabel.textContent = `${Math.round(opacity * 100)}%`;
    if (this.opacityDot) {
      const dotInner = this.opacityDot.querySelector('.slider-preview-dot-inner');
      if (dotInner) {
        dotInner.style.opacity = opacity;
      }
    }
  }

  updateColorAffordances(hex) {
    const colorDot = document.getElementById('tool-btn-color-dot');
    if (colorDot) colorDot.style.backgroundColor = hex;
    document.querySelectorAll('.slider-preview-dot-inner').forEach(el => {
      el.style.backgroundColor = hex;
    });
  }

  updateLayerBadge() {
    const badge = document.getElementById('tool-layers-badge');
    if (badge) {
      badge.style.display = this.vc.layerManager.layers.length > 1 ? 'block' : 'none';
    }
  }

  updateHistoryUI(state) {
    if (this.undoBtn) {
      this.undoBtn.classList.toggle('disabled', !state.canUndo);
    }
    if (this.redoBtn) {
      this.redoBtn.classList.toggle('disabled', !state.canRedo);
    }
  }

  openExportModal() {
    this.closeSheets();
    this.closePopover();
    this.exportModal?.classList.add('open');
  }

  setupExportEvents() {
    const modal = this.exportModal;
    modal?.querySelector('#exp-close-btn')?.addEventListener('click', () => modal.classList.remove('open'));

    // PNG Export
    modal?.querySelector('#exp-btn-png')?.addEventListener('click', async () => {
      const trans = modal.querySelector('#exp-png-trans')?.checked;
      const blob = await this.app.exporter.exportRaster('image/png', 1.0, trans);
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.png`, 'image/png');
      modal.classList.remove('open');
    });

    // JPEG Export
    modal?.querySelector('#exp-btn-jpg')?.addEventListener('click', async () => {
      const blob = await this.app.exporter.exportRaster('image/jpeg', 0.92, false);
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.jpg`, 'image/jpeg');
      modal.classList.remove('open');
    });

    // True SVG Export
    modal?.querySelector('#exp-btn-svg')?.addEventListener('click', async () => {
      const svgStr = this.app.exporter.exportSVG();
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.svg`, 'image/svg+xml');
      modal.classList.remove('open');
    });

    // Project JSON Export
    modal?.querySelector('#exp-btn-json')?.addEventListener('click', async () => {
      const jsonStr = JSON.stringify(this.app.currentProject, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      await this.app.exporter.shareOrDownload(blob, `${this.app.currentProject.name || 'artwork'}.vectura`, 'application/json');
      modal.classList.remove('open');
    });
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
      perfMode: false
    };

    this.autosaveInterval = null;
    this.init();
  }

  async init() {
    // 1. Initialize Canvas Viewport
    const canvasEl = document.getElementById('viewport-canvas');
    this.vectorCanvas = new VectorCanvas(canvasEl, 1080, 1080);
    this.vectorCanvas.history = this.history;
    this.vectorCanvas.currentBrush = new Brush(DEFAULT_BRUSH_PRESETS[0]);

    // 2. Setup Exporter
    this.exporter = new Exporter(this.vectorCanvas);

    // 3. Setup UI & Home Gallery
    this.uiManager = new UIManager(this);
    this.homeScreen = new HomeScreen(
      this.storage,
      (project) => this.loadProject(project),
      (options) => this.createNewProject(options)
    );

    // 4. Bind History changes to UI
    this.history.onChange((state) => {
      this.uiManager.updateHistoryUI(state);
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

    // 7. Load most recent project or create default
    await this.loadInitialProject();

    // Android Lifecycle Hooks
    window.onAndroidPause = () => {
      this.saveCurrentProject();
    };
    window.onAndroidResume = () => {
      // Resumed
    };
  }

  async loadInitialProject() {
    try {
      const all = await this.storage.getAllProjects();
      if (all && all.length > 0) {
        // Open most recently updated project
        all.sort((a, b) => b.updatedAt - a.updatedAt);
        await this.loadProject(all[0]);
      } else {
        // Create initial default 1080x1080 canvas
        await this.createNewProject({ width: 1080, height: 1080 });
      }
    } catch (e) {
      await this.createNewProject({ width: 1080, height: 1080 });
    }
  }

  async createNewProject(options = {}) {
    this.currentProject = ProjectManager.createNewProject(options);
    this.vectorCanvas.setDocumentSize(this.currentProject.width, this.currentProject.height);
    this.vectorCanvas.pixelArtMode = !!this.currentProject.pixelArtMode;

    // Reset layers and history
    this.vectorCanvas.layerManager.layers = [];
    this.vectorCanvas.layerManager.createInitialLayer();
    this.history.clear();

    // Reset Viewport to fit screen
    this.vectorCanvas.viewport.fitToScreen();

    // Update UI title
    const titleEl = document.getElementById('project-title-display');
    if (titleEl) titleEl.textContent = this.currentProject.name;

    this.uiManager.updateEdgeSlidersFromBrush();
    this.uiManager.layerPanel.render();

    await this.saveCurrentProject();
  }

  async loadProject(project) {
    this.currentProject = project;
    this.vectorCanvas.setDocumentSize(project.width, project.height);
    this.vectorCanvas.pixelArtMode = !!project.pixelArtMode;

    const lm = this.vectorCanvas.layerManager;
    lm.layers = [];

    // Reconstruct layers & vector strokes
    if (project.layers && project.layers.length > 0) {
      for (const lData of project.layers) {
        const layer = lm.addLayer(lData.name, lData.type || 'vector');
        layer.id = lData.id;
        layer.opacity = lData.opacity ?? 1.0;
        layer.blendMode = lData.blendMode || 'source-over';
        layer.visible = lData.visible !== false;
        layer.locked = !!lData.locked;
        layer.alphaLock = !!lData.alphaLock;
        layer.clippingMask = !!lData.clippingMask;
        layer.isReference = !!lData.isReference;
        layer.strokes = lData.strokes || [];
        this.vectorCanvas.redrawLayerStrokes(layer);
      }
      if (project.activeLayerId) {
        lm.setActiveLayer(project.activeLayerId);
      }
    } else {
      lm.createInitialLayer();
    }

    this.history.clear();
    this.vectorCanvas.viewport.fitToScreen();

    const titleEl = document.getElementById('project-title-display');
    if (titleEl) titleEl.textContent = this.currentProject.name;

    this.uiManager.updateEdgeSlidersFromBrush();
    this.uiManager.layerPanel.render();
  }

  async saveCurrentProject() {
    if (!this.currentProject) return;

    // Generate thumbnail
    const thumbDataUrl = this.exporter.exportDataUrl('image/png', 0.8, false);
    this.currentProject.thumbnail = thumbDataUrl;
    this.currentProject.updatedAt = Date.now();

    // Snapshot layer vector strokes
    this.currentProject.activeLayerId = this.vectorCanvas.layerManager.activeLayerId;
    this.currentProject.layers = this.vectorCanvas.layerManager.layers.map(l => ({
      id: l.id,
      name: l.name,
      type: l.type,
      opacity: l.opacity,
      blendMode: l.blendMode,
      visible: l.visible,
      locked: l.locked,
      alphaLock: l.alphaLock,
      clippingMask: l.clippingMask,
      isReference: l.isReference,
      strokes: JSON.parse(JSON.stringify(l.strokes))
    }));

    await this.storage.saveProject(this.currentProject);
  }

  setupAutosave() {
    // Autosave every 5 seconds
    this.autosaveInterval = setInterval(() => {
      this.saveCurrentProject();
    }, 5000);

    // Save on visibility change or page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.saveCurrentProject();
      }
    });

    window.addEventListener('pagehide', () => {
      this.saveCurrentProject();
    });
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

  onConfigChanged(key, val) {
    if (key === 'theme') {
      document.body.classList.toggle('theme-light', val === 'light');
    } else if (key === 'leftHanded') {
      document.body.classList.toggle('left-handed', !!val);
    } else if (key === 'perfMode') {
      document.body.classList.toggle('perf-low-blur', !!val);
    } else if (key === 'palmRejection') {
      this.vectorCanvas.palmRejection = !!val;
    }
  }
}

// Bootstrap application on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.vecturaApp = new VecturaApp();
});

})();
