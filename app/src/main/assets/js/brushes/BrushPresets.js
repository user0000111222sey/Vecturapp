/**
 * Vectura Brush Presets Library
 * Production-tuned raster brushes driven purely by finger velocity dynamics.
 */

export const BRUSH_CATEGORIES = [
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

export const DEFAULT_BRUSH_PRESETS = [
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
