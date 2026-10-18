/**
 * Vectura Brush Model
 * The brush is driven ONLY by finger velocity.
 * Encapsulates the per-brush "Velocity dynamics" group and "Velocity drives" targets.
 */
import { DEFAULT_BRUSH_PRESETS } from './BrushPresets.js';

export class Brush {
  constructor(presetData) {
    this.assign(presetData || DEFAULT_BRUSH_PRESETS[0]);
  }

  assign(data) {
    this.id = data.id || 'custom_brush';
    this.name = data.name || 'Custom Brush';
    this.category = data.category || 'ink';

    // Core dimensions & properties
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
    this.tipShape = data.tipShape || 'round';
    this.grain = data.grain ?? 0.0;
    this.wetEdge = data.wetEdge ?? 0.0;
    this.glowWidth = data.glowWidth ?? 0.0;

    // Taper
    this.taperStart = data.taperStart ?? 0;
    this.taperEnd = data.taperEnd ?? 0;

    // --- VELOCITY DYNAMICS GROUP ---
    // The brush is driven ONLY by finger velocity.
    const vd = data.velocityDynamics || {};
    this.velocityDynamics = {
      factor: vd.factor ?? data.pressureSensitivity ?? 1.0, // sensitivity factor
      minSpeed: vd.minSpeed ?? 0.0,                         // px/ms
      maxSpeed: vd.maxSpeed ?? 3.0,                         // px/ms
      curve: vd.curve ? [...vd.curve] : (data.bezierPressure ? [...data.bezierPressure] : [0.25, 0.1, 0.25, 1.0]), // draggable bezier
      invert: !!(vd.invert ?? data.inverse),                // invert response curve
      smoothing: vd.smoothing ?? 0.35,                      // EMA filter factor
      minOutput: vd.minOutput ?? 0.1,                       // minimum output bound
      maxOutput: vd.maxOutput ?? 1.0                        // maximum output bound
    };

    // --- VELOCITY TARGET MODULATION ---
    // Velocity can drive size, opacity, flow, spacing, scatter, angle, jitter amplitude and taper,
    // each with its own factor and curve toggle.
    const vt = data.velocityTargets || {};
    this.velocityTargets = {
      size: {
        enabled: vt.size?.enabled ?? true,
        factor: vt.size?.factor ?? 1.0,
        useCurve: vt.size?.useCurve ?? true
      },
      opacity: {
        enabled: vt.opacity?.enabled ?? true,
        factor: vt.opacity?.factor ?? 1.0,
        useCurve: vt.opacity?.useCurve ?? true
      },
      flow: {
        enabled: vt.flow?.enabled ?? false,
        factor: vt.flow?.factor ?? 1.0,
        useCurve: vt.flow?.useCurve ?? false
      },
      spacing: {
        enabled: vt.spacing?.enabled ?? false,
        factor: vt.spacing?.factor ?? 1.0,
        useCurve: vt.spacing?.useCurve ?? false
      },
      scatter: {
        enabled: vt.scatter?.enabled ?? false,
        factor: vt.scatter?.factor ?? 1.0,
        useCurve: vt.scatter?.useCurve ?? false
      },
      angle: {
        enabled: vt.angle?.enabled ?? false,
        factor: vt.angle?.factor ?? 1.0,
        useCurve: vt.angle?.useCurve ?? false
      },
      jitter: {
        enabled: vt.jitter?.enabled ?? false,
        factor: vt.jitter?.factor ?? 1.0,
        useCurve: vt.jitter?.useCurve ?? false
      },
      taper: {
        enabled: vt.taper?.enabled ?? false,
        factor: vt.taper?.factor ?? 1.0,
        useCurve: vt.taper?.useCurve ?? false
      }
    };

    // Coherent Noise Jitter definition
    this.jitter = data.jitter ? { ...data.jitter } : { enabled: false };

    // Flags
    this.isEraser = !!data.isEraser;
    this.isPixel = !!data.isPixel;
    this.blendMode = data.blendMode || 'source-over';
    this.stabilizer = data.stabilizer ?? 30;

    this._stampCache = null;
    this._stampCacheKey = '';
  }

  // Compatibility accessors
  get pressureSensitivity() {
    return this.velocityDynamics.factor;
  }
  set pressureSensitivity(val) {
    this.velocityDynamics.factor = val;
  }

  get bezierPressure() {
    return this.velocityDynamics.curve;
  }
  set bezierPressure(val) {
    this.velocityDynamics.curve = val;
  }

  /**
   * Creates an immutable snapshot of all settings to store with a raster stroke.
   */
  createSnapshot() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      size: this.size,
      minSize: this.minSize,
      maxSize: this.maxSize,
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
      velocityDynamics: {
        factor: this.velocityDynamics.factor,
        minSpeed: this.velocityDynamics.minSpeed,
        maxSpeed: this.velocityDynamics.maxSpeed,
        curve: [...this.velocityDynamics.curve],
        invert: this.velocityDynamics.invert,
        smoothing: this.velocityDynamics.smoothing,
        minOutput: this.velocityDynamics.minOutput,
        maxOutput: this.velocityDynamics.maxOutput
      },
      velocityTargets: {
        size: { ...this.velocityTargets.size },
        opacity: { ...this.velocityTargets.opacity },
        flow: { ...this.velocityTargets.flow },
        spacing: { ...this.velocityTargets.spacing },
        scatter: { ...this.velocityTargets.scatter },
        angle: { ...this.velocityTargets.angle },
        jitter: { ...this.velocityTargets.jitter },
        taper: { ...this.velocityTargets.taper }
      },
      jitter: { ...this.jitter },
      isEraser: this.isEraser,
      isPixel: this.isPixel,
      blendMode: this.blendMode,
      stabilizer: this.stabilizer
    };
  }

  toJSON() {
    return this.createSnapshot();
  }

  static fromJSON(json) {
    return new Brush(json);
  }
}
