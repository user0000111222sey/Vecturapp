/**
 * Vectura Velocity Dynamics Engine
 * The brush is driven ONLY by finger velocity.
 * Calculates instantaneous finger speed, applies exponential moving average (EMA) smoothing,
 * per-brush velocity sensitivity and global speed scaling, clamps to [minSpeed, maxSpeed],
 * and modulates brush output via draggable cubic Bezier response curves or linear response.
 */
export class PressureEngine {
  constructor(config = {}) {
    this.sensitivity = config.sensitivity ?? 1.0;
    this.smoothing = config.smoothing ?? 0.35;
    this.minOutput = config.minPressure ?? 0.1;
    this.maxOutput = config.maxPressure ?? 1.0;
    this.inverse = config.inverse ?? false;
    this.powerCurve = config.powerCurve ?? 1.0;

    this.prevPoint = null;
    this.filteredSpeed = 0;
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

  /**
   * Resolves velocity dynamics for a pointer event and world coordinate.
   * Driven ONLY by finger velocity. No hardware pressure, pen, or tilt inputs.
   *
   * @param {PointerEvent|Object} event - Pointer event (pressure is ignored)
   * @param {{x: number, y: number}} currentPoint - Current touch world coordinates
   * @param {Brush|Object} [brush] - Active brush containing velocityDynamics
   * @param {number} [globalSpeedFactor=1.0] - Global speed multiplier from quick settings
   * @returns {number} Normalized dynamic output (0.01 to 1.0)
   */
  resolvePressure(event, currentPoint, brush = null, globalSpeedFactor = 1.0) {
    return this.resolveVelocity(event, currentPoint, brush, globalSpeedFactor);
  }

  /**
   * Computes finger speed and maps it through per-brush Velocity Dynamics.
   */
  resolveVelocity(event, currentPoint, brush = null, globalSpeedFactor = 1.0) {
    const now = (event && event.timeStamp) || performance.now();
    let rawSpeed = 0;

    if (this.prevPoint) {
      const dt = Math.max(1, now - this.prevPoint.time);
      const dx = currentPoint.x - this.prevPoint.x;
      const dy = currentPoint.y - this.prevPoint.y;
      const dist = Math.hypot(dx, dy);
      rawSpeed = dist / dt; // pixels per millisecond
    } else {
      rawSpeed = 0.6; // initial touch baseline speed
    }

    this.prevPoint = { x: currentPoint.x, y: currentPoint.y, time: now };

    // Retrieve per-brush velocity dynamics parameters
    const vd = brush?.velocityDynamics || {
      factor: this.sensitivity || 1.0,
      minSpeed: 0.0,
      maxSpeed: 3.0,
      curve: [0.25, 0.1, 0.25, 1.0],
      invert: this.inverse || false,
      smoothing: this.smoothing || 0.35,
      minOutput: this.minOutput || 0.1,
      maxOutput: this.maxOutput || 1.0
    };

    const factor = Math.max(0.01, vd.factor ?? 1.0);
    const globalScale = Math.max(0.01, globalSpeedFactor || 1.0);
    const effectiveSpeed = rawSpeed * globalScale * factor;

    // EMA smoothing
    const smoothing = Math.max(0.01, Math.min(0.99, vd.smoothing ?? 0.35));
    if (this.filteredSpeed === 0) {
      this.filteredSpeed = effectiveSpeed;
    } else {
      this.filteredSpeed = this.filteredSpeed * (1 - smoothing) + effectiveSpeed * smoothing;
    }

    // Clamp and normalize speed between [minSpeed, maxSpeed]
    const minSpd = Math.max(0, vd.minSpeed ?? 0.0);
    const maxSpd = Math.max(minSpd + 0.05, vd.maxSpeed ?? 3.0);
    let normSpeed = Math.max(0, Math.min(1.0, (this.filteredSpeed - minSpd) / (maxSpd - minSpd)));

    // Invert: if true, faster speed produces smaller output (e.g. fountain pen bleed)
    if (vd.invert) {
      normSpeed = 1.0 - normSpeed;
    }

    // Evaluate response curve (draggable Bezier)
    const curve = Array.isArray(vd.curve) && vd.curve.length === 4 ? vd.curve : [0.25, 0.1, 0.25, 1.0];
    const curveOutput = PressureEngine.evaluateCubicBezier(normSpeed, curve[0], curve[1], curve[2], curve[3]);
    const linearOutput = normSpeed;

    const minOut = Math.max(0.0, Math.min(1.0, vd.minOutput ?? 0.1));
    const maxOut = Math.max(minOut, Math.min(1.0, vd.maxOutput ?? 1.0));

    // Primary output uses response curve
    const output = Math.max(0.01, Math.min(1.0, minOut + curveOutput * (maxOut - minOut)));

    this.lastMetrics = {
      rawSpeed,
      filteredSpeed: this.filteredSpeed,
      normSpeed,
      linearOutput,
      curveOutput,
      output,
      minOutput: minOut,
      maxOutput: maxOut
    };

    return output;
  }

  /**
   * Evaluates a specific velocity target modulation (size, opacity, flow, etc.)
   * @param {Object} targetConfig - { enabled: boolean, factor: number, useCurve: boolean }
   * @param {Object} metrics - metrics produced by resolveVelocity
   * @returns {number} modulation multiplier
   */
  static evaluateTarget(targetConfig, metrics) {
    if (!targetConfig || targetConfig.enabled === false) {
      return 1.0;
    }
    const val = targetConfig.useCurve ? metrics.curveOutput : metrics.linearOutput;
    const mapped = metrics.minOutput + val * (metrics.maxOutput - metrics.minOutput);
    const factor = targetConfig.factor ?? 1.0;
    // factor scales the influence around 1.0 or directly
    return Math.max(0.0, 1.0 + (mapped - 1.0) * factor);
  }

  /**
   * Evaluates custom draggable cubic bezier curve.
   * bezier: [p1x, p1y, p2x, p2y]
   * B(t) from (0,0) to (1,1) with control points P1(p1x, p1y) and P2(p2x, p2y).
   */
  static evaluateCubicBezier(t, p1x = 0.25, p1y = 0.1, p2x = 0.25, p2y = 1.0) {
    t = Math.max(0, Math.min(1, t));

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
    for (let i = 0; i < 8; i++) {
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
