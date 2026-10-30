/**
 * Vectura Brush Presets Library
 * Streamlined 14 distinct production-grade brushes using unified dynamics.
 */

export const BRUSH_CATEGORIES = [
  { id: 'ink', name: 'Inking & Sketch' },
  { id: 'paint', name: 'Painting & Shading' },
  { id: 'texture', name: 'Texture & FX' },
  { id: 'pixel', name: 'Pixel Art' }
];

export const DEFAULT_BRUSH_PRESETS = [
  // 1. Inking & Sketch
  {
    id: 'pencil',
    category: 'ink',
    name: 'Graphite Pencil',
    size: 8,
    minSize: 1,
    maxSize: 100,
    opacity: 0.88,
    flow: 0.85,
    hardness: 0.7,
    grain: 0.45,
    roundness: 0.85,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    spacing: 0.08,
    taperStart: 8,
    taperEnd: 12,
    dynamics: {
      pressure: { size: 60, opacity: 30, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: -25, opacity: -10, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 10, opacity: 10, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'technical_pen',
    category: 'ink',
    name: 'Technical Pen',
    size: 4,
    minSize: 1,
    maxSize: 60,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.95,
    grain: 0.0,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    spacing: 0.05,
    dynamics: {
      pressure: { size: 20, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'g_pen',
    category: 'ink',
    name: 'G-Pen',
    size: 10,
    minSize: 1,
    maxSize: 120,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.9,
    grain: 0.0,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    spacing: 0.06,
    taperStart: 10,
    taperEnd: 16,
    dynamics: {
      pressure: { size: 85, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: -50, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'brush_pen',
    category: 'ink',
    name: 'Bristle Brush Pen',
    size: 16,
    minSize: 2,
    maxSize: 150,
    opacity: 0.95,
    flow: 0.9,
    hardness: 0.8,
    grain: 0.2,
    roundness: 0.9,
    aspectRatio: 1.2,
    rotation: 0.2,
    tipShape: 'bristle',
    spacing: 0.06,
    dynamics: {
      pressure: { size: 70, opacity: 25, rotation: 10, spacing: 0, scatter: 0 },
      velocity: { size: -35, opacity: -15, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 15, opacity: 0, rotation: 15, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'calligraphy',
    category: 'ink',
    name: 'Calligraphy Chisel',
    size: 22,
    minSize: 4,
    maxSize: 180,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.9,
    grain: 0.0,
    roundness: 0.4,
    aspectRatio: 2.5,
    rotation: 0.785, // 45 degrees
    tipShape: 'chisel',
    spacing: 0.05,
    dynamics: {
      pressure: { size: 40, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: -15, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },

  // 2. Painting & Shading
  {
    id: 'marker',
    category: 'paint',
    name: 'Felt Marker',
    size: 26,
    minSize: 4,
    maxSize: 200,
    opacity: 0.8,
    flow: 0.85,
    hardness: 0.8,
    grain: 0.1,
    roundness: 0.7,
    aspectRatio: 1.8,
    rotation: 0.4,
    tipShape: 'chisel',
    spacing: 0.07,
    dynamics: {
      pressure: { size: 30, opacity: 20, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: -15, opacity: -10, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'highlighter',
    category: 'paint',
    name: 'Highlighter',
    size: 34,
    minSize: 6,
    maxSize: 240,
    opacity: 0.55,
    flow: 0.75,
    hardness: 0.85,
    grain: 0.0,
    roundness: 0.45,
    aspectRatio: 2.2,
    rotation: 0.785,
    tipShape: 'chisel',
    blendMode: 'multiply',
    spacing: 0.06,
    dynamics: {
      pressure: { size: 15, opacity: 10, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'airbrush',
    category: 'paint',
    name: 'Soft Airbrush',
    size: 42,
    minSize: 6,
    maxSize: 320,
    opacity: 0.65,
    flow: 0.5,
    hardness: 0.15,
    grain: 0.0,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'soft',
    spacing: 0.04,
    dynamics: {
      pressure: { size: 35, opacity: 40, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: -25, opacity: -25, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'watercolor',
    category: 'paint',
    name: 'Watercolor Wash',
    size: 36,
    minSize: 6,
    maxSize: 260,
    opacity: 0.55,
    flow: 0.6,
    hardness: 0.4,
    wetEdge: 0.65,
    grain: 0.35,
    roundness: 0.9,
    aspectRatio: 1.1,
    rotation: 0,
    tipShape: 'soft',
    spacing: 0.08,
    dynamics: {
      pressure: { size: 50, opacity: 35, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: -20, opacity: -15, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 10, opacity: 15, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 15, opacity: 10, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'oil_paint',
    category: 'paint',
    name: 'Oil Paint',
    size: 26,
    minSize: 4,
    maxSize: 220,
    opacity: 0.95,
    flow: 0.9,
    hardness: 0.85,
    grain: 0.25,
    roundness: 0.85,
    aspectRatio: 1.3,
    rotation: 0.3,
    tipShape: 'bristle',
    spacing: 0.06,
    dynamics: {
      pressure: { size: 60, opacity: 20, rotation: 10, spacing: 0, scatter: 0 },
      velocity: { size: -30, opacity: -10, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 10, opacity: 0, rotation: 10, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },

  // 3. Texture & FX
  {
    id: 'charcoal',
    category: 'texture',
    name: 'Vine Charcoal',
    size: 22,
    minSize: 2,
    maxSize: 180,
    opacity: 0.85,
    flow: 0.8,
    hardness: 0.7,
    grain: 0.8,
    roundness: 0.85,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    scatter: 0.35,
    spacing: 0.1,
    dynamics: {
      pressure: { size: 50, opacity: 40, rotation: 0, spacing: 0, scatter: 25 },
      velocity: { size: -30, opacity: -20, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 15, opacity: 15, rotation: 20, spacing: 0, scatter: 30 },
      noise: { size: 15, opacity: 10, rotation: 0, spacing: 0, scatter: 20 }
    }
  },
  {
    id: 'stipple',
    category: 'texture',
    name: 'Stipple Dots',
    size: 14,
    minSize: 2,
    maxSize: 120,
    opacity: 0.9,
    flow: 1.0,
    hardness: 0.9,
    grain: 0.1,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    spacing: 0.35,
    scatter: 0.8,
    dynamics: {
      pressure: { size: 40, opacity: 0, rotation: 0, spacing: -35, scatter: 40 },
      velocity: { size: 0, opacity: 0, rotation: 0, spacing: 20, scatter: 20 },
      jitter: { size: 25, opacity: 0, rotation: 0, spacing: 15, scatter: 45 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },
  {
    id: 'neon_glow',
    category: 'texture',
    name: 'Neon Tube',
    size: 16,
    minSize: 2,
    maxSize: 140,
    opacity: 1.0,
    flow: 1.0,
    hardness: 0.9,
    glowWidth: 0.75,
    roundness: 1.0,
    aspectRatio: 1.0,
    rotation: 0,
    tipShape: 'round',
    spacing: 0.05,
    dynamics: {
      pressure: { size: 35, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: -15, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  },

  // 4. Pixel Art
  {
    id: 'pixel_pen',
    category: 'pixel',
    name: '1px Pixel Pen',
    size: 1,
    minSize: 1,
    maxSize: 24,
    opacity: 1.0,
    flow: 1.0,
    hardness: 1.0,
    isPixel: true,
    spacingSettings: {
      pixelArtMode: true,
      spacing: 0.01,
      minSpacingPx: 1.0
    },
    dynamics: {
      pressure: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      velocity: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      jitter: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 },
      noise: { size: 0, opacity: 0, rotation: 0, spacing: 0, scatter: 0 }
    }
  }
];
