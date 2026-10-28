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

  getFontStyle() {
    return `${this.italic ? 'italic ' : ''}${this.bold ? 'bold ' : ''}${this.fontSize}px ${this.fontFamily}`;
  }

  measureTextBounds(ctx, text, x, y) {
    if (!text) return { x, y, width: 0, height: 0, lines: [], lineHeight: 0 };

    ctx.save();
    ctx.font = this.getFontStyle();
    ctx.textBaseline = 'top';

    const lines = text.split('\n');
    const lineHeight = Math.round(this.fontSize * 1.25);
    let maxLineWidth = 0;

    for (const line of lines) {
      const metrics = ctx.measureText(line);
      const w = metrics.width || (line.length * this.fontSize * 0.6);
      if (w > maxLineWidth) {
        maxLineWidth = w;
      }
    }

    const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
    ctx.restore();

    return {
      x,
      y,
      width: Math.ceil(maxLineWidth),
      height: Math.ceil(totalHeight),
      lineHeight,
      lines
    };
  }

  commitText(layer, text, x, y, colorHex) {
    if (!text || !layer) return null;

    const ctx = layer.ctx;
    const bounds = this.measureTextBounds(ctx, text, x, y);
    const fontStyle = this.getFontStyle();

    ctx.save();
    ctx.font = fontStyle;
    ctx.fillStyle = colorHex;
    ctx.textBaseline = 'top';

    let curY = y;
    for (const line of bounds.lines) {
      ctx.fillText(line, x, curY);
      curY += bounds.lineHeight;
    }
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
    return bounds;
  }
}
