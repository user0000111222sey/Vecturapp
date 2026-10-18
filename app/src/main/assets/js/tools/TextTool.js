/**
 * Vectura Text Tool
 * Adds editable text labels rendered cleanly onto vector layers.
 */
export class TextTool {
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
