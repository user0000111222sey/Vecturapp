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
export class PressureEngine {
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
