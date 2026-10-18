/**
 * Vectura 18 Blend Modes Definition & Canvas Mappings
 */
export const BLEND_MODES = [
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

export function getCanvasCompositeOp(modeId) {
  const found = BLEND_MODES.find(m => m.id === modeId);
  return found ? found.canvasOp : 'source-over';
}
