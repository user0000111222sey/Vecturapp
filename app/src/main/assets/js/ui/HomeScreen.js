/**
 * Vectura Projects Gallery & New Canvas Screen
 */
import { CANVAS_PRESETS, ProjectManager } from '../storage/ProjectManager.js';

export class HomeScreen {
  constructor(storage, onOpenProject, onNewProject) {
    this.storage = storage;
    this.onOpenProject = onOpenProject;
    this.onNewProject = onNewProject;

    this.screenEl = document.getElementById('home-screen');
    this.projects = [];
    this.init();
  }

  async init() {
    this.screenEl.innerHTML = `
      <div class="home-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; border: 1.5px solid var(--accent-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: var(--accent-primary);">V</div>
          <span style="font-size: 16px; font-weight: 700; color: var(--text-main);">My Artworks</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="hs-new-btn" class="glass-btn glass-btn-cta" style="font-size: 12px; padding: 6px 12px; height: 32px;">
            + New Canvas
          </button>
          <button id="hs-close-gallery" class="glass-btn glass-btn-icon" style="width: 32px; height: 32px;" title="Back to Drawing">
            ✕
          </button>
        </div>
      </div>

      <!-- Quick 1-Tap Presets Carousel -->
      <div class="home-presets-row">
        <div class="preset-chip" data-id="square_1080">1080×1080 Square</div>
        <div class="preset-chip" data-id="fhd_landscape">1920×1080 Landscape</div>
        <div class="preset-chip" data-id="fhd_portrait">1080×1920 Portrait</div>
        <div class="preset-chip" data-id="uhd_4k">4K Ultra HD</div>
        <div class="preset-chip" data-id="a4_print">A4 Print (300DPI)</div>
        <div class="preset-chip" data-id="pixel_32">Pixel Art (32×32)</div>
      </div>

      <!-- Projects Grid -->
      <div class="home-gallery" id="hs-gallery-grid"></div>

      <!-- New Project Dialog Modal -->
      <div id="hs-modal" class="glass-modal-backdrop">
        <div class="glass-panel glass-modal" style="padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 15px; font-weight: 700;">Create Custom Canvas</span>
            <button id="hs-modal-close" class="glass-btn glass-btn-icon" style="width: 28px; height: 28px;">✕</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Preset</label>
              <select id="hs-preset-select" class="glass-input" style="width: 100%;">
                ${CANVAS_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; gap: 10px;">
              <div style="flex: 1;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Width (px)</label>
                <input type="number" id="hs-input-w" class="glass-input" style="width: 100%;" value="1080" />
              </div>
              <div style="flex: 1;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Height (px)</label>
                <input type="number" id="hs-input-h" class="glass-input" style="width: 100%;" value="1080" />
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
              <span style="font-size: 12px;">Pixel Art Mode</span>
              <input type="checkbox" id="hs-input-pixel" />
            </div>

            <button id="hs-create-submit" class="glass-btn glass-btn-cta" style="margin-top: 4px; width: 100%; height: 38px;">
              Create Artwork
            </button>
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
    await this.refresh();
  }

  setupEvents() {
    const modal = this.screenEl.querySelector('#hs-modal');
    this.screenEl.querySelector('#hs-new-btn')?.addEventListener('click', () => {
      modal.classList.add('open');
    });
    this.screenEl.querySelector('#hs-modal-close')?.addEventListener('click', () => {
      modal.classList.remove('open');
    });
    this.screenEl.querySelector('#hs-close-gallery')?.addEventListener('click', () => {
      this.hide();
    });

    // 1-Tap Preset Chips
    this.screenEl.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.id;
        const p = CANVAS_PRESETS.find(item => item.id === id);
        if (p) {
          this.hide();
          this.onNewProject?.({ width: p.width, height: p.height, pixelArtMode: !!p.pixelMode });
        }
      });
    });

    // Custom Modal form
    const presetSelect = this.screenEl.querySelector('#hs-preset-select');
    const widthInput = this.screenEl.querySelector('#hs-input-w');
    const heightInput = this.screenEl.querySelector('#hs-input-h');
    const pixelInput = this.screenEl.querySelector('#hs-input-pixel');

    presetSelect?.addEventListener('change', () => {
      const p = CANVAS_PRESETS.find(item => item.id === presetSelect.value);
      if (p) {
        widthInput.value = p.width;
        heightInput.value = p.height;
        pixelInput.checked = !!p.pixelMode;
      }
    });

    this.screenEl.querySelector('#hs-create-submit')?.addEventListener('click', () => {
      const w = parseInt(widthInput.value) || 1080;
      const h = parseInt(heightInput.value) || 1080;
      const pixel = pixelInput.checked;
      modal.classList.remove('open');
      this.hide();
      this.onNewProject?.({ width: w, height: h, pixelArtMode: pixel });
    });
  }

  async refresh() {
    this.projects = await this.storage.getAllProjects();
    const grid = this.screenEl.querySelector('#hs-gallery-grid');
    if (!grid) return;

    if (this.projects.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 260px; color: var(--text-muted); gap: 10px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <span style="font-size: 14px; font-weight: 600;">No saved artworks</span>
          <button id="hs-first-new-btn" class="glass-btn glass-btn-cta" style="margin-top: 6px; font-size: 12px;">+ Create Canvas</button>
        </div>
      `;
      grid.querySelector('#hs-first-new-btn')?.addEventListener('click', () => {
        this.hide();
        this.onNewProject?.({ width: 1080, height: 1080 });
      });
      return;
    }

    grid.innerHTML = this.projects
      .map(p => `
      <div class="project-card" data-id="${p.id}">
        <img class="project-thumbnail" src="${p.thumbnail || ''}" alt="${p.name}" />
        <div class="project-info">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="project-name">${p.name}</span>
            <button class="glass-btn hs-del-btn" data-id="${p.id}" style="width: 24px; height: 24px; padding: 0; min-width: 24px; color: var(--danger);" title="Delete">✕</button>
          </div>
          <span class="project-date">${new Date(p.updatedAt).toLocaleDateString()} • ${p.width}×${p.height}</span>
        </div>
      </div>
    `)
      .join('');

    grid.querySelectorAll('.project-card').forEach(card => {
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
