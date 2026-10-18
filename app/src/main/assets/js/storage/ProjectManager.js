/**
 * Vectura Project Model & Presets
 */
export const CANVAS_PRESETS = [
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

export class ProjectManager {
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
