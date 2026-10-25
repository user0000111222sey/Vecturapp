/**
 * Vectura Projects Gallery & New Canvas Screen
 * Redesigned full-height modal list modeled on ibisPaint's "New canvas" screen
 * Classic Vectura light-gray UI, flat, no glow, zero animations, 1-tap instant canvas creation.
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
      <div style="width: ${iconW}px; height: ${iconH}px; border: 1.5px dashed #64748B; border-radius: 2px; box-sizing: border-box;"></div>
    </div>
  `;
}

export class HomeScreen {
  constructor(storage, onOpenProject, onNewProject) {
    this.storage = storage;
    this.onOpenProject = onOpenProject;
    this.onNewProject = onNewProject;

    this.screenEl = document.getElementById('home-screen');
    this.projects = [];

    // Load remembered custom size from localStorage safely
    const storedW = parseInt(localStorage.getItem('vectura_last_custom_w'), 10);
    const storedH = parseInt(localStorage.getItem('vectura_last_custom_h'), 10);
    this.lastCustomW = (storedW && storedW >= 1 && storedW <= 4096) ? storedW : 1080;
    this.lastCustomH = (storedH && storedH >= 1 && storedH <= 4096) ? storedH : 1080;

    this.init();
  }

  async init() {
    this.screenEl.innerHTML = `
      <header class="sheet-header" style="background: var(--chrome, #181920); padding: 12px 18px; border-bottom: 1px solid var(--divider, rgba(255,255,255,0.08));">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.3px; color: var(--text);">Artworks</span>
          <span id="hs-count-badge" style="font-size: 11px; font-weight: 600; background: var(--control, #262835); color: var(--text-2, #94a3b8); padding: 2px 8px; border-radius: 12px;">0</span>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button id="hs-new-btn" class="btn-text accent" style="font-size: 13px; font-weight: 600; min-height: 36px; padding: 6px 14px; border-radius: 8px; box-shadow: 0 2px 8px rgba(99,102,241,0.3);">
            + New Canvas
          </button>
          <button id="hs-close-gallery" class="btn-icon" title="Return to canvas">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      <!-- Projects Grid -->
      <div class="gallery-grid" id="hs-gallery-grid" style="padding: 16px;"></div>

      <!-- Redesigned ibisPaint-style Full-Height Modal List -->
      <div id="hs-modal" class="new-canvas-overlay">
        <div class="new-canvas-screen">
          <!-- Top bar: Title "New" + X close button -->
          <div class="new-canvas-topbar">
            <span class="new-canvas-title">New</span>
            <button id="hs-modal-close" class="new-canvas-close-btn" aria-label="Close" title="Close">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Single Scrollable List (~56px touch rows, thin dividers) -->
          <div class="new-canvas-list">
            <!-- Row: Folder -->
            <div class="new-canvas-row" id="nc-row-folder">
              <div class="new-canvas-row-icon" style="color: #4B5563;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="new-canvas-row-title">Folder</div>
              <div style="color: #6B7280; font-size: 13px; display: flex; align-items: center; gap: 4px; padding-right: 4px;">
                <span>Artworks</span>
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
                <span style="font-size: 15px; font-weight: 500; color: #191C21;">Custom</span>
                <div style="display: flex; align-items: center; gap: 4px;" id="nc-custom-inputs-wrap">
                  <input type="number" id="nc-custom-w" class="custom-dim-input" value="${this.lastCustomW}" min="1" max="4096" />
                  <span style="font-size: 13px; font-weight: 600; color: #64748B;">×</span>
                  <input type="number" id="nc-custom-h" class="custom-dim-input" value="${this.lastCustomH}" min="1" max="4096" />
                  <span style="font-size: 11px; color: #64748B;">px</span>
                  <button id="nc-custom-pencil-btn" class="btn-icon" style="width: 32px; height: 32px; color: #4B5563; padding: 0;" title="Edit dimensions">
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

            <!-- For Printing Presets -->
            ${PRINT_PRESETS.map(p => this.renderPresetRow(p)).join('')}
          </div>
        </div>
      </div>

      <!-- Gentle Memory Warning Dialog -->
      <div id="nc-memory-warning">
        <div style="max-width: 340px; width: 90%; background: #FFFFFF; color: #191C21; border: 1px solid #D1D5DB; border-radius: 12px; padding: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.25);">
          <div style="font-size: 16px; font-weight: 700; color: #B45309; display: flex; align-items: center; gap: 8px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Large Canvas Notice
          </div>
          <div id="nc-warn-message" style="font-size: 13px; color: #4B5563; margin-top: 10px; line-height: 1.45;">
            Canvas size is large. It may run slower on devices with limited memory.
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 18px;">
            <button id="nc-warn-suggested" class="btn-text accent" style="width: 100%; height: 42px; border-radius: 8px; font-weight: 600; font-size: 13px;">
              Use Recommended (2048 × 2048)
            </button>
            <button id="nc-warn-continue" class="btn-text" style="width: 100%; height: 40px; border-radius: 8px; background: #E5E7EB; color: #1F2937; font-size: 13px; font-weight: 500;">
              Continue with original size
            </button>
            <button id="nc-warn-cancel" class="btn-text" style="width: 100%; height: 36px; background: transparent; color: #6B7280; font-size: 13px;">
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
    // Open / Close modal
    this.screenEl.querySelector('#hs-new-btn')?.addEventListener('click', () => {
      this.openModal();
    });

    this.screenEl.querySelector('#hs-modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    this.screenEl.querySelector('#hs-close-gallery')?.addEventListener('click', () => {
      this.hide();
    });

    // Row "Folder" -> opens project manager folder picker (reveals the artworks gallery)
    this.screenEl.querySelector('#nc-row-folder')?.addEventListener('click', () => {
      this.closeModal();
      const grid = this.screenEl.querySelector('#hs-gallery-grid');
      if (grid) grid.scrollTop = 0;
    });

    // Custom Row Dimension Inputs
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
    customWInput?.addEventListener('input', () => {
      const w = Math.max(1, Math.min(4096, parseInt(customWInput.value, 10) || 1));
      const h = Math.max(1, Math.min(4096, parseInt(customHInput.value, 10) || 1));
      if (customIconSlot) customIconSlot.innerHTML = getDashedRatioIconHtml(w, h);
    });
    customHInput?.addEventListener('input', () => {
      const w = Math.max(1, Math.min(4096, parseInt(customWInput.value, 10) || 1));
      const h = Math.max(1, Math.min(4096, parseInt(customHInput.value, 10) || 1));
      if (customIconSlot) customIconSlot.innerHTML = getDashedRatioIconHtml(w, h);
    });

    // Prevent clicking inside inputs from triggering row click
    customInputsWrap?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Pencil button focuses width input for quick typing
    this.screenEl.querySelector('#nc-custom-pencil-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      customWInput?.focus();
      customWInput?.select();
    });

    const submitCustom = () => {
      updateCustomValues();
      this.createAndOpenProject(this.lastCustomW, this.lastCustomH);
    };

    customWInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCustom();
    });
    customHInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCustom();
    });

    this.screenEl.querySelector('#nc-custom-create-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      submitCustom();
    });

    this.screenEl.querySelector('#nc-row-custom')?.addEventListener('click', () => {
      submitCustom();
    });

    // Preset rows and chevron toggle handlers
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

    // Setup memory warning dialog actions
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

    // Warn gently if canvas size exceeds device memory (~12.5 MP)
    if (w * h > 12500000) {
      this.showMemoryWarning(w, h);
      return;
    }

    this.doCreateProject(w, h);
  }

  doCreateProject(width, height) {
    this.closeModal();
    this.hide();
    this.onNewProject?.({ width, height });
  }

  openModal() {
    const modal = this.screenEl.querySelector('#hs-modal');
    if (!modal) return;

    // Refresh custom inputs with remembered size
    const customWInput = this.screenEl.querySelector('#nc-custom-w');
    const customHInput = this.screenEl.querySelector('#nc-custom-h');
    const customIconSlot = this.screenEl.querySelector('#nc-custom-icon-slot');

    if (customWInput) customWInput.value = this.lastCustomW;
    if (customHInput) customHInput.value = this.lastCustomH;
    if (customIconSlot) {
      customIconSlot.innerHTML = getDashedRatioIconHtml(this.lastCustomW, this.lastCustomH);
    }

    modal.classList.add('open');
  }

  closeModal() {
    const modal = this.screenEl.querySelector('#hs-modal');
    if (modal) modal.classList.remove('open');
  }

  async refresh() {
    this.projects = await this.storage.getAllProjects();
    const countBadge = this.screenEl.querySelector('#hs-count-badge');
    if (countBadge) countBadge.textContent = this.projects.length;

    const grid = this.screenEl.querySelector('#hs-gallery-grid');
    if (!grid) return;

    if (this.projects.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 260px; color: var(--text-2); gap: 10px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span style="font-size: var(--text-body); font-weight: 500;">No saved artworks</span>
          <button id="hs-first-new-btn" class="btn-text accent" style="margin-top: 6px;">+ Create canvas</button>
        </div>
      `;
      grid.querySelector('#hs-first-new-btn')?.addEventListener('click', () => {
        this.openModal();
      });
      return;
    }

    grid.innerHTML = this.projects
      .map(p => `
      <div class="gallery-card" data-id="${p.id}">
        <img class="gallery-card-thumb" src="${p.thumbnail || ''}" alt="${p.name}" />
        <div class="gallery-card-info">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 500; font-size: var(--text-body); color: var(--text);">${p.name}</span>
            <button class="btn-icon hs-del-btn" data-id="${p.id}" style="width: 28px; height: 28px; color: var(--danger);" title="Delete">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <span class="tabular" style="font-size: var(--text-secondary); color: var(--text-2);">${new Date(p.updatedAt).toLocaleDateString()} · ${p.width} × ${p.height}</span>
        </div>
      </div>
    `)
      .join('');

    grid.querySelectorAll('.gallery-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.hs-del-btn')) return;
        const id = card.dataset.id;
        const project = this.projects.find(p => p.id === id);
        if (project) {
          this.hide();
          this.onOpenProject?.(project);
        }
      });
    });

    grid.querySelectorAll('.hs-del-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Delete this artwork?')) {
          await this.storage.deleteProject(id);
          await this.refresh();
        }
      });
    });
  }

  show() {
    this.screenEl.classList.remove('hidden');
    this.refresh();
  }

  hide() {
    this.screenEl.classList.add('hidden');
  }
}
