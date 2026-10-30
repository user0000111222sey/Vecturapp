/**
 * Vectura Projects Gallery & Artwork Manager (HomeScreen.js)
 * Upgraded Pinterest-style Masonry Board with:
 * - Real aspect ratio cards in balanced 2-column masonry layout
 * - Artwork Folders with 2x2 thumbnail previews and breadcrumb navigation
 * - Card long-press action sheet: Open, Rename, Duplicate, Move to folder, Export, Delete
 * - Multiple selection mode: Select all, Move, Delete, Export
 * - Sorting (Newest, Oldest, Name A-Z, Name Z-A, Canvas Size)
 * - Debounced search with empty states
 * - Safe delete with confirmation dialog and 5-second Undo Toast
 * - Lightweight, virtualized/lazy-loaded thumbnails (never loads full layer blobs)
 * - Full-height ibisPaint-style "New canvas" modal integration
 */
import { CANVAS_PRESETS } from '../storage/ProjectManager.js';

const ILLUSTRATION_PRESETS = [
  {
    id: 'sd_speed',
    name: 'SD (Speed)',
    width: 540,
    height: 1170,
    alternatives: [
      { name: 'Speed', width: 540, height: 1170 },
      { name: 'Standard', width: 720, height: 1560 },
      { name: 'High', width: 1080, height: 2340 }
    ]
  },
  {
    id: 'square_2k',
    name: '1:1 (2K)',
    width: 2048,
    height: 2048,
    alternatives: [
      { name: 'SD (512²)', width: 512, height: 512 },
      { name: 'HD (1080²)', width: 1080, height: 1080 },
      { name: '2K (2048²)', width: 2048, height: 2048 },
      { name: '4K (4096²)', width: 4096, height: 4096 }
    ]
  },
  {
    id: 'ratio_3_4',
    name: '3:4 (3K)',
    width: 2304,
    height: 3072,
    alternatives: [
      { name: 'SD', width: 768, height: 1024 },
      { name: 'HD', width: 1536, height: 2048 },
      { name: '3K', width: 2304, height: 3072 }
    ]
  },
  {
    id: 'ratio_9_16',
    name: '9:16 (SD)',
    width: 720,
    height: 1280,
    alternatives: [
      { name: 'qHD', width: 540, height: 960 },
      { name: 'SD', width: 720, height: 1280 },
      { name: 'FHD', width: 1080, height: 1920 },
      { name: 'QHD', width: 1440, height: 2560 }
    ]
  },
  {
    id: 'header_banner',
    name: 'Header',
    width: 1500,
    height: 500,
    alternatives: [
      { name: 'Compact', width: 1200, height: 400 },
      { name: 'Header (X/Twitter)', width: 1500, height: 500 },
      { name: 'Ultra', width: 1800, height: 600 }
    ]
  },
  {
    id: 'chat_stamp',
    name: 'Chat Stamp',
    width: 370,
    height: 320,
    alternatives: [
      { name: 'Standard', width: 370, height: 320 },
      { name: 'Hi-Res 2×', width: 740, height: 640 }
    ]
  },
  {
    id: 'vertical_strip',
    name: 'Vertical',
    width: 690,
    height: 4096,
    alternatives: [
      { name: 'Half-Strip', width: 690, height: 2048 },
      { name: 'Full Webtoon', width: 690, height: 4096 }
    ]
  }
];

const PRINT_PRESETS = [
  {
    id: 'postcard_300',
    name: 'Postcard 300dpi',
    width: 1181,
    height: 1748,
    alternatives: [
      { name: '150 DPI (Draft)', width: 590, height: 874 },
      { name: '300 DPI (Standard)', width: 1181, height: 1748 },
      { name: '450 DPI (Hi-Res)', width: 1772, height: 2622 }
    ]
  },
  {
    id: 'a4_150',
    name: 'A4 150dpi',
    width: 1240,
    height: 1754,
    alternatives: [
      { name: '150 DPI', width: 1240, height: 1754 },
      { name: '300 DPI (Hi-Res)', width: 2480, height: 3508 }
    ]
  },
  {
    id: 'a5_150',
    name: 'A5 150dpi',
    width: 874,
    height: 1240,
    alternatives: [
      { name: '150 DPI', width: 874, height: 1240 },
      { name: '300 DPI (Hi-Res)', width: 1748, height: 2480 }
    ]
  },
  {
    id: 'b4_150',
    name: 'B4 150dpi',
    width: 1476,
    height: 2085,
    alternatives: [
      { name: '150 DPI', width: 1476, height: 2085 },
      { name: '300 DPI (Hi-Res)', width: 2952, height: 4170 }
    ]
  }
];

function getDashedRatioIconHtml(w, h) {
  const maxBox = 26;
  const ratio = (w || 1) / (h || 1);
  let iconW, iconH;
  if (ratio >= 1) {
    iconW = maxBox;
    iconH = Math.max(6, Math.min(maxBox, Math.round(maxBox / ratio)));
  } else {
    iconH = maxBox;
    iconW = Math.max(6, Math.min(maxBox, Math.round(maxBox * ratio)));
  }
  return `
    <div class="new-canvas-row-icon" title="${w} × ${h}">
      <div style="width: ${iconW}px; height: ${iconH}px; border: 1.5px dashed var(--text-3); border-radius: 2px; box-sizing: border-box;"></div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class HomeScreen {
  constructor(storage, onOpenProject, onNewProject, onDeleteProject, app) {
    this.storage = storage;
    this.onOpenProject = onOpenProject;
    this.onNewProject = onNewProject;
    this.onDeleteProject = onDeleteProject;
    this.app = app;

    this.screenEl = document.getElementById('home-screen');
    this.projects = [];
    this.folders = [];
    this.currentFolderId = null; // null = root

    // Selection mode state
    this.isSelectionMode = false;
    this.selectedProjectIds = new Set();

    // Sort & Search state
    this.sortOption = localStorage.getItem('vectura_sort_option') || 'newest';
    this.searchQuery = '';
    this.searchDebounceTimer = null;

    // Undo toast state
    this.undoTimeout = null;
    this.lastDeletedProjects = [];

    // Long press timer
    this.longPressTimer = null;
    this.longPressStartPos = { x: 0, y: 0 };

    // Remembered custom size
    const storedW = parseInt(localStorage.getItem('vectura_last_custom_w'), 10);
    const storedH = parseInt(localStorage.getItem('vectura_last_custom_h'), 10);
    this.lastCustomW = (storedW && storedW >= 1 && storedW <= 4096) ? storedW : 1080;
    this.lastCustomH = (storedH && storedH >= 1 && storedH <= 4096) ? storedH : 1080;

    this.init();
  }

  async init() {
    this.screenEl.innerHTML = `
      <!-- 1. Gallery Header -->
      <header class="sheet-header" id="hs-header">
        <div class="hs-header-left">
          <!-- Back button when in folder -->
          <button id="hs-back-btn" class="btn-icon hidden" title="Back to artworks" style="margin-right: 4px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          
          <!-- Breadcrumb navigation -->
          <div class="hs-breadcrumb-container">
            <span class="hs-breadcrumb-item active" id="hs-crumb-root">Artworks</span>
            <span class="hs-breadcrumb-sep hidden" id="hs-crumb-sep">/</span>
            <span class="hs-breadcrumb-item hidden" id="hs-crumb-folder"></span>
          </div>

          <span id="hs-count-badge" class="hs-header-badge">0</span>
        </div>

        <div class="hs-header-right">
          <!-- Selection toggle button -->
          <button id="hs-select-toggle" class="btn-icon" title="Select multiple" aria-label="Select artworks">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </button>

          <!-- New Folder button -->
          <button id="hs-new-folder-btn" class="btn-icon" title="New Folder">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
          </button>

          <!-- New Canvas CTA button -->
          <button id="hs-new-btn" class="btn-text accent" style="font-size: 13px; font-weight: 600; min-height: 36px; padding: 6px 14px; border-radius: 8px; box-shadow: none;">
            + New Canvas
          </button>

          <!-- Return to current open canvas button -->
          <button id="hs-close-gallery" class="btn-icon" title="Return to canvas">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      <!-- Selection Mode Header Bar (replaces standard header during selection mode) -->
      <div id="hs-selection-header" class="hidden">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="hs-selection-cancel" class="btn-text" style="padding: 6px 12px; font-size: 13px;">Cancel</button>
          <span id="hs-selection-count" style="font-weight: 600; font-size: 14px; color: var(--text);">0 selected</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="hs-selection-all" class="btn-text" style="padding: 6px 12px; font-size: 13px;">Select All</button>
        </div>
      </div>

      <!-- 2. Search & Sort Subheader -->
      <div class="hs-toolbar-row">
        <!-- Search bar -->
        <div class="hs-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-3); flex-shrink: 0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="hs-search-input" placeholder="Search artworks..." autocomplete="off" />
          <button id="hs-search-clear" class="btn-icon hidden" style="width: 24px; height: 24px; padding: 0; color: var(--text-3);" title="Clear search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Sort selector -->
        <div class="hs-sort-wrap">
          <select id="hs-sort-select" class="hs-sort-dropdown" aria-label="Sort artworks">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="size_desc">Canvas Size</option>
          </select>
        </div>
      </div>

      <!-- 3. Pinterest-Style 2-Column Masonry Board -->
      <div class="gallery-scroll-area" id="hs-gallery-scroll">
        <!-- Folders Grid (shown if folders exist at current level) -->
        <div id="hs-folders-grid" class="folders-grid"></div>

        <!-- Balanced 2-Column Masonry for Artworks -->
        <div id="hs-masonry-container" class="masonry-container">
          <div class="masonry-column" id="masonry-col-0"></div>
          <div class="masonry-column" id="masonry-col-1"></div>
        </div>

        <!-- Empty State Container -->
        <div id="hs-empty-state" class="hidden"></div>
      </div>

      <!-- 4. Batch Actions Bar (Multiple Selection Mode) -->
      <div id="hs-batch-bar" class="hs-batch-actions-bar hidden">
        <button id="hs-batch-move" class="btn-text" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>Move</span>
        </button>
        <div class="hs-batch-divider"></div>
        <button id="hs-batch-export" class="btn-text" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span>Export</span>
        </button>
        <div class="hs-batch-divider"></div>
        <button id="hs-batch-delete" class="btn-text" style="flex: 1; color: var(--danger); display: flex; align-items: center; justify-content: center; gap: 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          <span>Delete</span>
        </button>
      </div>

      <!-- 5. Long Press Actions Sheet Modal -->
      <div id="hs-action-sheet-overlay" class="dialog-overlay">
        <div class="hs-action-sheet-card">
          <div class="hs-action-sheet-header">
            <span id="hs-sheet-title" class="hs-sheet-artwork-title">Artwork Actions</span>
            <button id="hs-sheet-close" class="btn-icon" style="width: 32px; height: 32px; padding: 0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="hs-sheet-actions-list">
            <button class="hs-sheet-item" id="hs-action-open">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Open in Canvas</span>
            </button>
            <button class="hs-sheet-item" id="hs-action-rename">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              <span>Rename</span>
            </button>
            <button class="hs-sheet-item" id="hs-action-duplicate">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Duplicate</span>
            </button>
            <button class="hs-sheet-item" id="hs-action-move">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>Move to Folder</span>
            </button>
            <button class="hs-sheet-item" id="hs-action-export">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span>Export Artwork</span>
            </button>
            <button class="hs-sheet-item danger" id="hs-action-delete">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Delete Artwork</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 6. Move to Folder Dialog -->
      <div id="hs-move-modal" class="dialog-overlay">
        <div class="dialog-card" style="max-width: 360px;">
          <div class="dialog-header">
            <span style="font-size: 16px; font-weight: 600;">Move to Folder</span>
            <button id="hs-move-modal-close" class="btn-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="dialog-body" id="hs-move-folder-list" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
      </div>

      <!-- 7. Undo Floating Toast -->
      <div id="hs-undo-toast" class="hs-undo-toast-wrap hidden">
        <span id="hs-undo-message">Artwork deleted</span>
        <button id="hs-undo-btn" class="hs-undo-action-btn">Undo</button>
      </div>

      <!-- 8. Redesigned ibisPaint-style Full-Height Modal List -->
      <div id="hs-modal" class="new-canvas-overlay">
        <div class="new-canvas-screen">
          <div class="new-canvas-topbar">
            <span class="new-canvas-title">New</span>
            <button id="hs-modal-close" class="new-canvas-close-btn" aria-label="Close" title="Close">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="new-canvas-list">
            <!-- Row: Folder -->
            <div class="new-canvas-row" id="nc-row-folder">
              <div class="new-canvas-row-icon" style="color: var(--text-2);">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="new-canvas-row-title">Folder</div>
              <div style="color: var(--text-3); font-size: 13px; display: flex; align-items: center; gap: 4px; padding-right: 4px;">
                <span id="nc-folder-name-preview">Artworks</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>

            <!-- Section: Illustration -->
            <div class="new-canvas-section-band">Illustration</div>

            <!-- Row: Custom -->
            <div class="new-canvas-row" id="nc-row-custom">
              <div id="nc-custom-icon-slot">
                ${getDashedRatioIconHtml(this.lastCustomW, this.lastCustomH)}
              </div>
              <div style="flex: 1; margin-left: 12px; margin-right: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 15px; font-weight: 500; color: var(--text);">Custom</span>
                <div style="display: flex; align-items: center; gap: 4px;" id="nc-custom-inputs-wrap">
                  <input type="number" id="nc-custom-w" class="custom-dim-input" value="${this.lastCustomW}" min="1" max="4096" />
                  <span style="font-size: 13px; font-weight: 600; color: var(--text-3);">×</span>
                  <input type="number" id="nc-custom-h" class="custom-dim-input" value="${this.lastCustomH}" min="1" max="4096" />
                  <span style="font-size: 11px; color: var(--text-3);">px</span>
                  <button id="nc-custom-pencil-btn" class="btn-icon" style="width: 32px; height: 32px; color: var(--text-2); padding: 0;" title="Edit dimensions">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                </div>
              </div>
              <button id="nc-custom-create-btn" class="custom-create-badge" title="Create with custom dimensions">
                <span>Create</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            <!-- Illustration Presets -->
            ${ILLUSTRATION_PRESETS.map(p => this.renderPresetRow(p)).join('')}

            <!-- Section: For Printing -->
            <div class="new-canvas-section-band">For Printing</div>
            ${PRINT_PRESETS.map(p => this.renderPresetRow(p)).join('')}
          </div>
        </div>
      </div>

      <!-- Gentle Memory Warning Dialog -->
      <div id="nc-memory-warning">
        <div style="max-width: 340px; width: 90%; background: var(--panel); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-floating);">
          <div style="font-size: 16px; font-weight: 700; color: var(--danger); display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Large Canvas Notice
          </div>
          <div id="nc-warn-message" style="font-size: 13px; color: var(--text-2); margin-top: 10px; line-height: 1.45;">
            Canvas size is large. It may run slower on devices with limited memory.
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 18px;">
            <button id="nc-warn-suggested" class="btn-text accent" style="width: 100%; height: 42px; border-radius: var(--radius-sm); font-weight: 600; font-size: 13px; background: var(--accent); color: #FFFFFF;">
              Use Recommended (2048 × 2048)
            </button>
            <button id="nc-warn-continue" class="btn-text" style="width: 100%; height: 40px; border-radius: var(--radius-sm); background: var(--control); color: var(--text); font-size: 13px; font-weight: 500;">
              Continue with original size
            </button>
            <button id="nc-warn-cancel" class="btn-text" style="width: 100%; height: 36px; background: transparent; color: var(--text-3); font-size: 13px;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
    await this.refresh();
  }

  renderPresetRow(p) {
    const hasAlts = p.alternatives && p.alternatives.length > 0;
    return `
      <div class="new-canvas-row preset-item-row" data-w="${p.width}" data-h="${p.height}" data-id="${p.id}">
        ${getDashedRatioIconHtml(p.width, p.height)}
        <div class="new-canvas-row-title">${p.name}</div>
        <div class="new-canvas-size-pill">${p.width}×${p.height}</div>
        ${hasAlts ? `
          <button class="new-canvas-chevron-btn" data-target="alts-${p.id}" aria-label="Expand resolutions" title="Alternative resolutions">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        ` : '<div style="width: 12px;"></div>'}
      </div>
      ${hasAlts ? `
        <div class="new-canvas-sublist" id="alts-${p.id}">
          ${p.alternatives.map(alt => `
            <div class="new-canvas-subrow preset-subrow-item" data-w="${alt.width}" data-h="${alt.height}">
              ${getDashedRatioIconHtml(alt.width, alt.height)}
              <div class="new-canvas-row-title" style="font-size: 14px;">${alt.name}</div>
              <div class="new-canvas-size-pill" style="font-size: 12px;">${alt.width}×${alt.height}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  setupEvents() {
    // 1. Header Buttons
    this.screenEl.querySelector('#hs-new-btn')?.addEventListener('click', () => {
      this.openModal();
    });

    this.screenEl.querySelector('#hs-modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    this.screenEl.querySelector('#hs-close-gallery')?.addEventListener('click', () => {
      if (!this.app.currentProject) {
        this.openModal();
      } else {
        this.hide();
      }
    });

    // Back button in folder
    this.screenEl.querySelector('#hs-back-btn')?.addEventListener('click', () => {
      this.navigateToFolder(null);
    });

    this.screenEl.querySelector('#hs-crumb-root')?.addEventListener('click', () => {
      this.navigateToFolder(null);
    });

    // Create New Folder
    this.screenEl.querySelector('#hs-new-folder-btn')?.addEventListener('click', () => {
      this.promptCreateFolder();
    });

    // Toggle Multiple Selection Mode
    this.screenEl.querySelector('#hs-select-toggle')?.addEventListener('click', () => {
      this.toggleSelectionMode();
    });

    this.screenEl.querySelector('#hs-selection-cancel')?.addEventListener('click', () => {
      this.exitSelectionMode();
    });

    this.screenEl.querySelector('#hs-selection-all')?.addEventListener('click', () => {
      this.toggleSelectAll();
    });

    // Search Input with Debounce
    const searchInput = this.screenEl.querySelector('#hs-search-input');
    const searchClear = this.screenEl.querySelector('#hs-search-clear');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      searchClear?.classList.toggle('hidden', !q);
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchQuery = q.toLowerCase();
        this.renderGalleryGrid();
      }, 250);
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchClear.classList.add('hidden');
      this.searchQuery = '';
      this.renderGalleryGrid();
    });

    // Sort Dropdown
    const sortSelect = this.screenEl.querySelector('#hs-sort-select');
    if (sortSelect) {
      sortSelect.value = this.sortOption;
      sortSelect.addEventListener('change', (e) => {
        this.sortOption = e.target.value;
        localStorage.setItem('vectura_sort_option', this.sortOption);
        this.renderGalleryGrid();
      });
    }

    // Batch Actions Bar (Move, Export, Delete)
    this.screenEl.querySelector('#hs-batch-move')?.addEventListener('click', () => {
      this.openBatchMoveDialog();
    });

    this.screenEl.querySelector('#hs-batch-export')?.addEventListener('click', () => {
      this.executeBatchExport();
    });

    this.screenEl.querySelector('#hs-batch-delete')?.addEventListener('click', () => {
      this.executeBatchDelete();
    });

    // Action Sheet Close
    this.screenEl.querySelector('#hs-sheet-close')?.addEventListener('click', () => {
      this.closeActionSheet();
    });

    this.screenEl.querySelector('#hs-action-sheet-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'hs-action-sheet-overlay') {
        this.closeActionSheet();
      }
    });

    // Move to folder dialog close
    this.screenEl.querySelector('#hs-move-modal-close')?.addEventListener('click', () => {
      this.closeMoveModal();
    });

    this.screenEl.querySelector('#hs-move-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'hs-move-modal') {
        this.closeMoveModal();
      }
    });

    // Undo Toast Button
    this.screenEl.querySelector('#hs-undo-btn')?.addEventListener('click', () => {
      this.undoLastDelete();
    });

    // Action Sheet Options
    this.screenEl.querySelector('#hs-action-open')?.addEventListener('click', () => {
      if (this.activeActionProjectId) {
        const id = this.activeActionProjectId;
        this.closeActionSheet();
        this.openProjectById(id);
      }
    });

    this.screenEl.querySelector('#hs-action-rename')?.addEventListener('click', () => {
      if (this.activeActionProjectId) {
        const id = this.activeActionProjectId;
        this.closeActionSheet();
        this.promptRenameProject(id);
      }
    });

    this.screenEl.querySelector('#hs-action-duplicate')?.addEventListener('click', async () => {
      if (this.activeActionProjectId) {
        const id = this.activeActionProjectId;
        this.closeActionSheet();
        await this.duplicateProject(id);
      }
    });

    this.screenEl.querySelector('#hs-action-move')?.addEventListener('click', () => {
      if (this.activeActionProjectId) {
        const id = this.activeActionProjectId;
        this.closeActionSheet();
        this.openMoveDialog([id]);
      }
    });

    this.screenEl.querySelector('#hs-action-export')?.addEventListener('click', async () => {
      if (this.activeActionProjectId) {
        const id = this.activeActionProjectId;
        this.closeActionSheet();
        await this.exportSingleProject(id);
      }
    });

    this.screenEl.querySelector('#hs-action-delete')?.addEventListener('click', () => {
      if (this.activeActionProjectId) {
        const id = this.activeActionProjectId;
        this.closeActionSheet();
        this.confirmDeleteProjects([id]);
      }
    });

    // New Canvas Modal Custom Dimensions Setup
    this.setupNewCanvasModalEvents();
  }

  setupNewCanvasModalEvents() {
    const customWInput = this.screenEl.querySelector('#nc-custom-w');
    const customHInput = this.screenEl.querySelector('#nc-custom-h');
    const customIconSlot = this.screenEl.querySelector('#nc-custom-icon-slot');
    const customInputsWrap = this.screenEl.querySelector('#nc-custom-inputs-wrap');

    const updateCustomValues = () => {
      let w = parseInt(customWInput?.value, 10);
      let h = parseInt(customHInput?.value, 10);
      if (isNaN(w) || w < 1) w = 1080;
      if (w > 4096) w = 4096;
      if (isNaN(h) || h < 1) h = 1080;
      if (h > 4096) h = 4096;

      if (customWInput) customWInput.value = w;
      if (customHInput) customHInput.value = h;
      this.lastCustomW = w;
      this.lastCustomH = h;
      localStorage.setItem('vectura_last_custom_w', w);
      localStorage.setItem('vectura_last_custom_h', h);

      if (customIconSlot) {
        customIconSlot.innerHTML = getDashedRatioIconHtml(w, h);
      }
    };

    customWInput?.addEventListener('change', updateCustomValues);
    customHInput?.addEventListener('change', updateCustomValues);
    customInputsWrap?.addEventListener('click', (e) => e.stopPropagation());

    this.screenEl.querySelector('#nc-custom-pencil-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      customWInput?.focus();
      customWInput?.select();
    });

    const submitCustom = () => {
      let w = parseInt(customWInput?.value, 10) || this.lastCustomW;
      let h = parseInt(customHInput?.value, 10) || this.lastCustomH;
      this.createAndOpenProject(w, h);
    };

    this.screenEl.querySelector('#nc-custom-create-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      submitCustom();
    });

    this.screenEl.querySelector('#nc-row-custom')?.addEventListener('click', () => {
      submitCustom();
    });

    // Preset rows
    this.screenEl.querySelectorAll('.preset-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const chevronBtn = e.target.closest('.new-canvas-chevron-btn');
        if (chevronBtn) {
          e.stopPropagation();
          const targetId = chevronBtn.dataset.target;
          const sublist = this.screenEl.querySelector(`#${targetId}`);
          if (sublist) {
            const isOpen = sublist.classList.toggle('open');
            chevronBtn.classList.toggle('open', isOpen);
          }
          return;
        }

        const w = parseInt(row.dataset.w, 10);
        const h = parseInt(row.dataset.h, 10);
        this.createAndOpenProject(w, h);
      });
    });

    // Alternative resolution sub-rows
    this.screenEl.querySelectorAll('.preset-subrow-item').forEach(subrow => {
      subrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const w = parseInt(subrow.dataset.w, 10);
        const h = parseInt(subrow.dataset.h, 10);
        this.createAndOpenProject(w, h);
      });
    });

    // Row "Folder" in New Canvas modal -> switch folder or reveals gallery
    this.screenEl.querySelector('#nc-row-folder')?.addEventListener('click', () => {
      this.closeModal();
      this.renderGalleryGrid();
    });

    // Memory warning modal
    this.setupMemoryWarningEvents();
  }

  setupMemoryWarningEvents() {
    const warnModal = this.screenEl.querySelector('#nc-memory-warning');
    this.screenEl.querySelector('#nc-warn-cancel')?.addEventListener('click', () => {
      warnModal?.classList.remove('open');
    });

    this.screenEl.querySelector('#nc-warn-continue')?.addEventListener('click', () => {
      warnModal?.classList.remove('open');
      if (this.pendingDimensions) {
        this.doCreateProject(this.pendingDimensions.width, this.pendingDimensions.height);
        this.pendingDimensions = null;
      }
    });

    this.screenEl.querySelector('#nc-warn-suggested')?.addEventListener('click', () => {
      warnModal?.classList.remove('open');
      this.pendingDimensions = null;
      this.doCreateProject(2048, 2048);
    });
  }

  showMemoryWarning(width, height) {
    this.pendingDimensions = { width, height };
    const warnModal = this.screenEl.querySelector('#nc-memory-warning');
    const warnMsg = this.screenEl.querySelector('#nc-warn-message');
    const mp = (width * height / 1000000).toFixed(1);

    if (warnMsg) {
      warnMsg.textContent = `Canvas size (${width} × ${height}, ${mp} MP) is very large. On devices with limited RAM, multiple layers or high-resolution brushes may run slower.`;
    }

    if (warnModal) {
      warnModal.classList.add('open');
    }
  }

  createAndOpenProject(width, height) {
    let w = parseInt(width, 10) || 1080;
    let h = parseInt(height, 10) || 1080;
    w = Math.max(1, Math.min(4096, w));
    h = Math.max(1, Math.min(4096, h));

    if (w * h > 12500000) {
      this.showMemoryWarning(w, h);
      return;
    }

    this.doCreateProject(w, h);
  }

  doCreateProject(width, height) {
    this.closeModal();
    this.hide();
    this.onNewProject?.({
      width,
      height,
      folderId: this.currentFolderId
    });
  }

  openModal() {
    const modal = this.screenEl.querySelector('#hs-modal');
    if (!modal) return;

    const customWInput = this.screenEl.querySelector('#nc-custom-w');
    const customHInput = this.screenEl.querySelector('#nc-custom-h');
    const customIconSlot = this.screenEl.querySelector('#nc-custom-icon-slot');
    const folderPreview = this.screenEl.querySelector('#nc-folder-name-preview');

    if (customWInput) customWInput.value = this.lastCustomW;
    if (customHInput) customHInput.value = this.lastCustomH;
    if (customIconSlot) {
      customIconSlot.innerHTML = getDashedRatioIconHtml(this.lastCustomW, this.lastCustomH);
    }

    if (folderPreview) {
      if (this.currentFolderId) {
        const curFolder = this.folders.find(f => f.id === this.currentFolderId);
        folderPreview.textContent = curFolder ? curFolder.name : 'Folder';
      } else {
        folderPreview.textContent = 'Artworks';
      }
    }

    modal.classList.add('open');
  }

  closeModal() {
    const modal = this.screenEl.querySelector('#hs-modal');
    if (modal) modal.classList.remove('open');
  }

  // --- Folder Management ---

  navigateToFolder(folderId) {
    this.currentFolderId = folderId;
    this.exitSelectionMode();

    const backBtn = this.screenEl.querySelector('#hs-back-btn');
    const sep = this.screenEl.querySelector('#hs-crumb-sep');
    const folderCrumb = this.screenEl.querySelector('#hs-crumb-folder');
    const rootCrumb = this.screenEl.querySelector('#hs-crumb-root');

    if (folderId) {
      const folder = this.folders.find(f => f.id === folderId);
      backBtn?.classList.remove('hidden');
      sep?.classList.remove('hidden');
      if (folderCrumb) {
        folderCrumb.textContent = folder ? folder.name : 'Folder';
        folderCrumb.classList.remove('hidden');
      }
      rootCrumb?.classList.remove('active');
    } else {
      backBtn?.classList.add('hidden');
      sep?.classList.add('hidden');
      folderCrumb?.classList.add('hidden');
      rootCrumb?.classList.add('active');
    }

    this.renderGalleryGrid();
  }

  async promptCreateFolder() {
    const name = prompt('New Folder Name:', 'Untitled Folder');
    if (!name || !name.trim()) return;

    const newFolder = {
      id: 'folder_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.storage.saveFolder(newFolder);
    await this.refresh();
  }

  async promptRenameFolder(folderId) {
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return;

    const newName = prompt('Rename Folder:', folder.name);
    if (!newName || !newName.trim() || newName.trim() === folder.name) return;

    await this.storage.renameFolder(folderId, newName.trim());
    await this.refresh();
  }

  async confirmDeleteFolder(folderId) {
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return;

    const count = this.projects.filter(p => p.folderId === folderId).length;
    const msg = count > 0
      ? `Delete folder "${folder.name}"? The ${count} artwork(s) inside will be kept in Artworks.`
      : `Delete empty folder "${folder.name}"?`;

    if (confirm(msg)) {
      await this.storage.deleteFolder(folderId);
      if (this.currentFolderId === folderId) {
        this.navigateToFolder(null);
      } else {
        await this.refresh();
      }
      this.showToast(`Folder "${folder.name}" deleted`);
    }
  }

  // --- Multiple Selection Mode ---

  toggleSelectionMode() {
    if (this.isSelectionMode) {
      this.exitSelectionMode();
    } else {
      this.enterSelectionMode();
    }
  }

  enterSelectionMode() {
    this.isSelectionMode = true;
    this.selectedProjectIds.clear();

    this.screenEl.querySelector('#hs-header')?.classList.add('hidden');
    this.screenEl.querySelector('#hs-selection-header')?.classList.remove('hidden');
    this.screenEl.querySelector('#hs-batch-bar')?.classList.remove('hidden');

    this.updateSelectionUI();
    this.renderGalleryGrid();
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedProjectIds.clear();

    this.screenEl.querySelector('#hs-header')?.classList.remove('hidden');
    this.screenEl.querySelector('#hs-selection-header')?.classList.add('hidden');
    this.screenEl.querySelector('#hs-batch-bar')?.classList.add('hidden');

    this.renderGalleryGrid();
  }

  toggleSelectProject(id) {
    if (this.selectedProjectIds.has(id)) {
      this.selectedProjectIds.delete(id);
    } else {
      this.selectedProjectIds.add(id);
    }
    this.updateSelectionUI();
  }

  toggleSelectAll() {
    const currentList = this.getFilteredProjects();
    if (this.selectedProjectIds.size === currentList.length) {
      this.selectedProjectIds.clear();
    } else {
      currentList.forEach(p => this.selectedProjectIds.add(p.id));
    }
    this.updateSelectionUI();
    this.renderGalleryGrid();
  }

  updateSelectionUI() {
    const countEl = this.screenEl.querySelector('#hs-selection-count');
    if (countEl) {
      countEl.textContent = `${this.selectedProjectIds.size} selected`;
    }

    const selectAllBtn = this.screenEl.querySelector('#hs-selection-all');
    const currentList = this.getFilteredProjects();
    if (selectAllBtn) {
      selectAllBtn.textContent = (this.selectedProjectIds.size > 0 && this.selectedProjectIds.size === currentList.length)
        ? 'Deselect All'
        : 'Select All';
    }

    // Toggle card selected visual class
    this.screenEl.querySelectorAll('.gallery-card').forEach(card => {
      const id = card.dataset.id;
      const isSel = this.selectedProjectIds.has(id);
      card.classList.toggle('selected', isSel);
      const chk = card.querySelector('.gallery-card-checkbox');
      if (chk) {
        chk.classList.toggle('checked', isSel);
        chk.innerHTML = isSel
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
          : '';
      }
    });
  }

  // --- Project Actions: Duplicate, Rename, Move, Export, Delete ---

  async openProjectById(id) {
    const project = await this.storage.getProject(id);
    if (project) {
      this.hide();
      this.onOpenProject?.(project);
    }
  }

  async promptRenameProject(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;

    const newName = prompt('Rename Artwork:', project.name);
    if (!newName || !newName.trim() || newName.trim() === project.name) return;

    await this.storage.updateProjectMetadata(id, { name: newName.trim(), updatedAt: Date.now() });
    await this.refresh();
  }

  async duplicateProject(id) {
    const copy = await this.storage.duplicateProject(id);
    if (copy) {
      await this.refresh();
      this.showToast('Artwork duplicated');
    }
  }

  openActionSheet(projectId, projectTitle) {
    this.activeActionProjectId = projectId;
    const titleEl = this.screenEl.querySelector('#hs-sheet-title');
    if (titleEl) titleEl.textContent = projectTitle || 'Artwork Actions';
    this.screenEl.querySelector('#hs-action-sheet-overlay')?.classList.add('open');
  }

  closeActionSheet() {
    this.activeActionProjectId = null;
    this.screenEl.querySelector('#hs-action-sheet-overlay')?.classList.remove('open');
  }

  // --- Move to Folder ---

  openMoveDialog(projectIds) {
    this.pendingMoveProjectIds = projectIds;
    const listEl = this.screenEl.querySelector('#hs-move-folder-list');
    if (!listEl) return;

    const items = [
      { id: null, name: 'Root (Artworks)' },
      ...this.folders
    ];

    listEl.innerHTML = items.map(f => `
      <button class="btn-text hs-move-dest-btn" data-folder-id="${f.id || ''}" style="width: 100%; text-align: left; padding: 12px; display: flex; align-items: center; gap: 10px; border-radius: var(--radius-sm); background: var(--control);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span style="flex: 1; font-weight: 500;">${escapeHtml(f.name)}</span>
      </button>
    `).join('');

    listEl.querySelectorAll('.hs-move-dest-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const destFolderId = btn.dataset.folderId || null;
        await this.executeMoveProjects(this.pendingMoveProjectIds, destFolderId);
        this.closeMoveModal();
      });
    });

    this.screenEl.querySelector('#hs-move-modal')?.classList.add('open');
  }

  closeMoveModal() {
    this.pendingMoveProjectIds = null;
    this.screenEl.querySelector('#hs-move-modal')?.classList.remove('open');
  }

  async executeMoveProjects(projectIds, destFolderId) {
    if (!projectIds || projectIds.length === 0) return;
    for (const id of projectIds) {
      await this.storage.updateProjectMetadata(id, { folderId: destFolderId, updatedAt: Date.now() });
    }
    await this.refresh();
    const destName = destFolderId ? (this.folders.find(f => f.id === destFolderId)?.name || 'folder') : 'Artworks';
    this.showToast(`Moved ${projectIds.length} artwork(s) to ${destName}`);
    if (this.isSelectionMode) this.exitSelectionMode();
  }

  openBatchMoveDialog() {
    if (this.selectedProjectIds.size === 0) {
      this.showToast('No artworks selected');
      return;
    }
    this.openMoveDialog(Array.from(this.selectedProjectIds));
  }

  // --- Single & Batch Export ---

  async exportSingleProject(id) {
    const project = await this.storage.getProject(id);
    if (!project) return;

    if (this.app?.exporter && window.AndroidBridge) {
      const filename = `${(project.name || 'artwork').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      if (project.thumbnail) {
        await this.app.exporter.shareOrDownload(project.thumbnail, filename, 'image/png');
        return;
      }
    }
    // Fallback: open project to export
    this.openProjectById(id);
  }

  async executeBatchExport() {
    if (this.selectedProjectIds.size === 0) {
      this.showToast('No artworks selected');
      return;
    }
    const ids = Array.from(this.selectedProjectIds);
    this.showToast(`Exporting ${ids.length} artwork(s)...`);

    for (const id of ids) {
      const p = await this.storage.getProject(id);
      if (p && p.thumbnail && this.app?.exporter) {
        const filename = `${(p.name || 'artwork').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
        await this.app.exporter.shareOrDownload(p.thumbnail, filename, 'image/png');
      }
    }
    this.exitSelectionMode();
  }

  // --- Safe Delete with Confirm and Undo Toast ---

  confirmDeleteProjects(ids) {
    if (!ids || ids.length === 0) return;
    const msg = ids.length === 1
      ? 'Delete this artwork?'
      : `Delete ${ids.length} selected artworks?`;

    if (confirm(msg)) {
      this.deleteProjectsWithUndo(ids);
    }
  }

  executeBatchDelete() {
    if (this.selectedProjectIds.size === 0) {
      this.showToast('No artworks selected');
      return;
    }
    this.confirmDeleteProjects(Array.from(this.selectedProjectIds));
  }

  async deleteProjectsWithUndo(ids) {
    this.lastDeletedProjects = [];

    // Backup projects in memory before deleting so user can Undo
    for (const id of ids) {
      const p = await this.storage.getProject(id);
      if (p) this.lastDeletedProjects.push(p);

      if (this.onDeleteProject) {
        await this.onDeleteProject(id);
      } else {
        await this.storage.deleteProject(id);
      }
    }

    if (this.isSelectionMode) this.exitSelectionMode();
    await this.refresh();

    // Show floating undo toast
    this.showUndoToast(ids.length);
  }

  showUndoToast(count) {
    const toast = this.screenEl.querySelector('#hs-undo-toast');
    const msg = this.screenEl.querySelector('#hs-undo-message');
    if (!toast || !msg) return;

    msg.textContent = count === 1 ? 'Artwork deleted' : `${count} artworks deleted`;
    toast.classList.remove('hidden');

    if (this.undoTimeout) clearTimeout(this.undoTimeout);
    this.undoTimeout = setTimeout(() => {
      toast.classList.add('hidden');
      this.lastDeletedProjects = [];
    }, 5000);
  }

  async undoLastDelete() {
    if (this.undoTimeout) clearTimeout(this.undoTimeout);
    this.screenEl.querySelector('#hs-undo-toast')?.classList.add('hidden');

    if (this.lastDeletedProjects && this.lastDeletedProjects.length > 0) {
      for (const p of this.lastDeletedProjects) {
        await this.storage.saveProject(p);
      }
      this.lastDeletedProjects = [];
      await this.refresh();
      this.showToast('Artwork(s) restored');
    }
  }

  showToast(message) {
    if (this.app?.showToast) {
      this.app.showToast(message);
    } else {
      console.log('Toast:', message);
    }
  }

  // --- Filtering and Sorting ---

  getFilteredProjects() {
    let list = this.projects.filter(p => {
      if (this.currentFolderId) {
        return p.folderId === this.currentFolderId;
      }
      return !p.folderId; // Root artworks only
    });

    if (this.searchQuery) {
      list = list.filter(p => (p.name || '').toLowerCase().includes(this.searchQuery));
    }

    switch (this.sortOption) {
      case 'oldest':
        list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        break;
      case 'name_asc':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name_desc':
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'size_desc':
        list.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        break;
      case 'newest':
      default:
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        break;
    }

    return list;
  }

  getFilteredFolders() {
    if (this.currentFolderId) {
      return []; // Only root supports top-level folders
    }
    let list = [...this.folders];
    if (this.searchQuery) {
      list = list.filter(f => f.name.toLowerCase().includes(this.searchQuery));
    }
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return list;
  }

  // --- Refresh and Render ---

  async refresh() {
    this.projects = await this.storage.getAllProjectHeaders();
    this.folders = await this.storage.getAllFolders();

    const countBadge = this.screenEl.querySelector('#hs-count-badge');
    if (countBadge) {
      const curList = this.getFilteredProjects();
      countBadge.textContent = curList.length;
    }

    this.renderGalleryGrid();
  }

  renderGalleryGrid() {
    const foldersGrid = this.screenEl.querySelector('#hs-folders-grid');
    const col0 = this.screenEl.querySelector('#masonry-col-0');
    const col1 = this.screenEl.querySelector('#masonry-col-1');
    const emptyState = this.screenEl.querySelector('#hs-empty-state');
    if (!col0 || !col1) return;

    col0.innerHTML = '';
    col1.innerHTML = '';
    if (foldersGrid) foldersGrid.innerHTML = '';

    const currentFolders = this.getFilteredFolders();
    const currentProjects = this.getFilteredProjects();

    const countBadge = this.screenEl.querySelector('#hs-count-badge');
    if (countBadge) countBadge.textContent = currentProjects.length;

    // 1. Render Folders (only in root)
    if (foldersGrid) {
      if (currentFolders.length > 0) {
        foldersGrid.classList.remove('hidden');
        foldersGrid.innerHTML = currentFolders.map(folder => {
          // Find up to 4 preview thumbnails of projects in this folder
          const folderProjects = this.projects.filter(p => p.folderId === folder.id);
          const previewThumbs = folderProjects.slice(0, 4).map(p => p.thumbnail).filter(Boolean);

          let previewGridHtml = '';
          if (previewThumbs.length > 0) {
            previewGridHtml = `
              <div class="folder-thumb-preview-grid">
                ${[0, 1, 2, 3].map(idx => {
                  const src = previewThumbs[idx];
                  return src
                    ? `<img class="folder-thumb-mini" src="${src}" alt="" loading="lazy" />`
                    : `<div class="folder-thumb-mini-empty"></div>`;
                }).join('')}
              </div>
            `;
          } else {
            previewGridHtml = `
              <div class="folder-thumb-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
            `;
          }

          return `
            <div class="folder-card" data-folder-id="${folder.id}">
              ${previewGridHtml}
              <div class="folder-card-meta">
                <span class="folder-card-title">${escapeHtml(folder.name)}</span>
                <span class="folder-card-count">${folderProjects.length} artwork${folderProjects.length === 1 ? '' : 's'}</span>
              </div>
              <button class="btn-icon folder-card-menu-btn" data-folder-id="${folder.id}" title="Folder options">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
              </button>
            </div>
          `;
        }).join('');

        // Wire folder click & context menu
        foldersGrid.querySelectorAll('.folder-card').forEach(card => {
          card.addEventListener('click', (e) => {
            if (e.target.closest('.folder-card-menu-btn')) return;
            const folderId = card.dataset.folderId;
            this.navigateToFolder(folderId);
          });
        });

        foldersGrid.querySelectorAll('.folder-card-menu-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const folderId = btn.dataset.folderId;
            const folder = this.folders.find(f => f.id === folderId);
            if (!folder) return;

            const choice = prompt(`Folder "${folder.name}":\n1. Rename\n2. Delete\nEnter 1 or 2:`, '1');
            if (choice === '1') {
              this.promptRenameFolder(folderId);
            } else if (choice === '2') {
              this.confirmDeleteFolder(folderId);
            }
          });
        });
      } else {
        foldersGrid.classList.add('hidden');
      }
    }

    // 2. Empty State Check
    if (currentProjects.length === 0 && currentFolders.length === 0) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
        if (this.searchQuery) {
          emptyState.innerHTML = `
            <div class="hs-empty-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span style="font-weight: 600; font-size: 15px;">No results found</span>
              <span style="font-size: 12px; color: var(--text-2);">No artworks match "${escapeHtml(this.searchQuery)}"</span>
            </div>
          `;
        } else if (this.currentFolderId) {
          emptyState.innerHTML = `
            <div class="hs-empty-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span style="font-weight: 600; font-size: 15px;">This folder is empty</span>
              <button id="hs-empty-folder-new-btn" class="btn-text accent" style="margin-top: 8px;">+ New Canvas in Folder</button>
            </div>
          `;
          emptyState.querySelector('#hs-empty-folder-new-btn')?.addEventListener('click', () => {
            this.openModal();
          });
        } else {
          emptyState.innerHTML = `
            <div class="hs-empty-box">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span style="font-weight: 600; font-size: 16px;">No saved artworks</span>
              <span style="font-size: 13px; color: var(--text-2);">Create your first masterpiece</span>
              <button id="hs-empty-first-new-btn" class="btn-text accent" style="margin-top: 10px; font-weight: 600; min-height: 40px; padding: 8px 18px; border-radius: 8px;">+ Create Canvas</button>
            </div>
          `;
          emptyState.querySelector('#hs-empty-first-new-btn')?.addEventListener('click', () => {
            this.openModal();
          });
        }
      }
      return;
    } else {
      emptyState?.classList.add('hidden');
    }

    // 3. Pinterest-Style Balanced 2-Column Masonry Placement
    let heightCol0 = 0;
    let heightCol1 = 0;

    currentProjects.forEach(p => {
      const w = p.width || 1080;
      const h = p.height || 1080;
      // Clamp aspect ratio to avoid excessively tall/narrow cards
      const rawRatio = w / h;
      const clampedRatio = Math.max(0.45, Math.min(2.2, rawRatio));
      const cardEstimatedHeight = (1 / clampedRatio) + 0.35; // card image aspect height + meta row

      // Target column with smaller cumulative height
      const targetCol = heightCol0 <= heightCol1 ? col0 : col1;
      if (heightCol0 <= heightCol1) {
        heightCol0 += cardEstimatedHeight;
      } else {
        heightCol1 += cardEstimatedHeight;
      }

      const cardEl = this.createArtworkCardElement(p, clampedRatio);
      targetCol.appendChild(cardEl);
    });
  }

  createArtworkCardElement(p, clampedRatio) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.id = p.id;
    if (this.selectedProjectIds.has(p.id)) {
      card.classList.add('selected');
    }

    const safeName = escapeHtml(p.name || 'Untitled Artwork');
    const mp = ((p.width * p.height) / 1000000).toFixed(1);
    const dateStr = new Date(p.updatedAt || p.createdAt || Date.now()).toLocaleDateString();

    const isSelected = this.selectedProjectIds.has(p.id);

    const thumbHtml = p.thumbnail
      ? `<img class="gallery-card-thumb" src="${p.thumbnail}" alt="${safeName}" loading="lazy" />`
      : `<div class="gallery-card-thumb-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>`;

    card.innerHTML = `
      <div class="gallery-card-thumb-wrap" style="aspect-ratio: ${clampedRatio};">
        ${thumbHtml}
        <!-- Selection checkbox circle (shown in selection mode or on hover/touch) -->
        <div class="gallery-card-checkbox ${isSelected ? 'checked' : ''} ${this.isSelectionMode ? 'visible' : ''}">
          ${isSelected ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>
      </div>
      <div class="gallery-card-info">
        <div class="gallery-card-title-row">
          <span class="gallery-card-title" title="${safeName}">${safeName}</span>
          <button class="btn-icon hs-card-menu-btn" data-id="${p.id}" title="Artwork options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
          </button>
        </div>
        <div class="gallery-card-meta">
          <span>${dateStr}</span>
          <span>·</span>
          <span>${p.width}×${p.height}</span>
        </div>
      </div>
    `;

    // Click handler
    card.addEventListener('click', (e) => {
      if (e.target.closest('.hs-card-menu-btn')) return;

      if (this.isSelectionMode) {
        this.toggleSelectProject(p.id);
      } else {
        this.openProjectById(p.id);
      }
    });

    // 3-dots Card Menu Button
    card.querySelector('.hs-card-menu-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openActionSheet(p.id, p.name);
    });

    // Long press support (opens actions sheet, or initiates selection mode)
    const handleTouchStart = (e) => {
      if (this.isSelectionMode) return;
      const t = e.touches ? e.touches[0] : e;
      this.longPressStartPos = { x: t.clientX, y: t.clientY };

      this.longPressTimer = setTimeout(() => {
        if (this.app?.triggerHaptic) this.app.triggerHaptic();
        this.openActionSheet(p.id, p.name);
      }, 500);
    };

    const handleTouchMove = (e) => {
      if (!this.longPressTimer) return;
      const t = e.touches ? e.touches[0] : e;
      const dx = Math.abs(t.clientX - this.longPressStartPos.x);
      const dy = Math.abs(t.clientY - this.longPressStartPos.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    };

    const handleTouchEnd = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    };

    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchmove', handleTouchMove, { passive: true });
    card.addEventListener('touchend', handleTouchEnd);
    card.addEventListener('touchcancel', handleTouchEnd);

    // Mouse long press fallback
    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.isSelectionMode) return;
      this.longPressStartPos = { x: e.clientX, y: e.clientY };
      this.longPressTimer = setTimeout(() => {
        this.openActionSheet(p.id, p.name);
      }, 500);
    });
    card.addEventListener('mousemove', handleTouchMove);
    card.addEventListener('mouseup', handleTouchEnd);
    card.addEventListener('mouseleave', handleTouchEnd);

    return card;
  }

  show() {
    this.screenEl.classList.remove('hidden');
    this.refresh();
  }

  hide() {
    this.screenEl.classList.add('hidden');
    this.closeActionSheet();
    this.closeMoveModal();
    this.exitSelectionMode();
  }

  handleBack() {
    const modal = this.screenEl.querySelector('#hs-modal');
    if (modal && modal.classList.contains('open')) {
      this.closeModal();
      return true;
    }
    const memWarn = this.screenEl.querySelector('#nc-memory-warning');
    if (memWarn && memWarn.classList.contains('open')) {
      memWarn.classList.remove('open');
      return true;
    }
    const actionSheet = this.screenEl.querySelector('#hs-action-sheet-overlay');
    if (actionSheet && actionSheet.classList.contains('open')) {
      this.closeActionSheet();
      return true;
    }
    const moveModal = this.screenEl.querySelector('#hs-move-modal');
    if (moveModal && moveModal.classList.contains('open')) {
      this.closeMoveModal();
      return true;
    }
    if (this.isSelectionMode) {
      this.exitSelectionMode();
      return true;
    }
    if (this.currentFolderId) {
      this.navigateToFolder(null);
      return true;
    }
    return false;
  }
}
