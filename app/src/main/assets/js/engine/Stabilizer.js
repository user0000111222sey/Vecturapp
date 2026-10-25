/**
 * Vectura Stroke Stabilizer Engine
 * Supports: Off, Light (Exponential Moving Average), Rope (Lazy-Rope with visual line), Post-correction.
 */
export class Stabilizer {
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
