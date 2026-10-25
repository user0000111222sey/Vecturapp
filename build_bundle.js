const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'app/src/main/assets/js');

const MODULE_FILES = [
  'engine/CatmullRom.js',
  'engine/PressureEngine.js',
  'engine/Stabilizer.js',
  'engine/CoherentNoise.js',
  'engine/Viewport.js',
  'layers/BlendModes.js',
  'layers/Layer.js',
  'layers/LayerManager.js',
  'brushes/BrushPresets.js',
  'brushes/Brush.js',
  'history/Command.js',
  'history/HistoryManager.js',
  'tools/FillBucket.js',
  'tools/LassoFill.js',
  'tools/SelectionTool.js',
  'tools/TransformTool.js',
  'tools/VectorPointEditor.js',
  'tools/SmudgeTool.js',
  'tools/ShapeTool.js',
  'tools/GradientTool.js',
  'tools/TextTool.js',
  'tools/RulerGuides.js',
  'tools/Eyedropper.js',
  'tools/SymmetryManager.js',
  'tools/ToolManager.js',
  'engine/VectorCanvas.js',
  'storage/IndexedDBStorage.js',
  'storage/Exporter.js',
  'storage/ProjectManager.js',
  'ui/i18n.js',
  'ui/ColorPicker.js',
  'ui/LayerPanel.js',
  'ui/BrushPanel.js',
  'ui/ToolPanel.js',
  'ui/SettingsDialog.js',
  'ui/Tutorial.js',
  'ui/HomeScreen.js',
  'ui/UIManager.js',
  'app.js'
];

let bundleContent = '/* Vectura Unified Self-Contained Bundle */\n(function() {\n"use strict";\n\n';

for (const relPath of MODULE_FILES) {
  const fullPath = path.join(BASE_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File missing: ${fullPath}`);
    process.exit(1);
  }

  let code = fs.readFileSync(fullPath, 'utf8');

  // Strip multi-line and single-line import statements
  code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  code = code.replace(/import\s+['"][^'"]+['"];?/g, '');

  // Strip export statements
  code = code.replace(/export\s+default\s+/g, '');
  code = code.replace(/export\s+(class|const|function|let|var)\s+/g, '$1 ');
  code = code.replace(/export\s*\{[\s\S]*?\};?/g, '');

  bundleContent += `\n/* --- ${path.basename(relPath)} --- */\n` + code.trim() + '\n';
}

bundleContent += '\n})();\n';

const outPath = path.join(BASE_DIR, 'bundle.js');
fs.writeFileSync(outPath, bundleContent, 'utf8');
console.log(`Successfully generated bundle.js (${bundleContent.length} bytes)`);
