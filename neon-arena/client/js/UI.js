/**
 * UI — lobby (with map & character selection), loading, game, endgame.
 */
import { MAPS, CHARACTERS, DEFAULT_MAP, DEFAULT_CHARACTER } from './config.js';

export class UI {
  constructor() {
    this.screens = {
      lobby:    document.getElementById('screen-lobby'),
      loading:  document.getElementById('screen-loading'),
      game:     document.getElementById('screen-game'),
      endgame:  document.getElementById('screen-endgame'),
    };
    this.loadingStatus = document.getElementById('loadingStatus');
    this.joinForm = document.getElementById('joinForm');
    this.nameInput = document.getElementById('nameInput');
    this.playAgainBtn = document.getElementById('playAgainBtn');
    this.charGrid = document.getElementById('character-grid');
    this.mapGrid = document.getElementById('map-grid');
    this.currentMapLabel = document.getElementById('current-map');

    this.selectedCharacter = localStorage.getItem('na_character') || DEFAULT_CHARACTER;
    this.selectedMap = localStorage.getItem('na_map') || DEFAULT_MAP;

    this._onJoinCb = null;
    this._onPlayAgainCb = null;
  }

  init() {
    const saved = localStorage.getItem('na_name');
    if (saved) this.nameInput.value = saved;

    this._renderCharacters();
    this._renderMaps();

    this.joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.nameInput.value.trim();
      if (!name) return;
      localStorage.setItem('na_name', name);
      localStorage.setItem('na_character', this.selectedCharacter);
      localStorage.setItem('na_map', this.selectedMap);
      this._onJoinCb?.({
        name,
        characterId: this.selectedCharacter,
        mapId: this.selectedMap,
      });
    });

    this.playAgainBtn.addEventListener('click', () => {
      this._onPlayAgainCb?.();
    });
  }

  _renderCharacters() {
    this.charGrid.innerHTML = CHARACTERS.map((c) => `
      <button type="button" class="card char-card${c.id === this.selectedCharacter ? ' selected' : ''}"
              data-id="${c.id}"
              style="--char-color:${c.color}; --char-accent:${c.accent}; --char-visor:${visorFor(c.id)}; --char-skin:${skinFor(c.id)}">
        <div class="preview">
          <div class="figure">
            <div class="helmet"></div>
            <div class="head"></div>
            <div class="visor"></div>
            <div class="torso"></div>
            <div class="chest-plate"></div>
            <div class="arm-l"></div>
            <div class="arm-r"></div>
            <div class="legs"></div>
            <div class="boots"></div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(c.name)}</div>
          <div class="card-tagline">${escapeHtml(c.tagline)}</div>
          <div class="card-desc">${escapeHtml(c.description)}</div>
        </div>
      </button>
    `).join('');

    this.charGrid.querySelectorAll('.card').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectedCharacter = el.dataset.id;
        this.charGrid.querySelectorAll('.card').forEach((c) => c.classList.toggle('selected', c.dataset.id === this.selectedCharacter));
      });
    });
  }

  _renderMaps() {
    this.mapGrid.innerHTML = MAPS.map((m) => `
      <button type="button" class="card map-card${m.id === this.selectedMap ? ' selected' : ''}"
              data-id="${m.id}"
              style="--map-bg:${m.bg}; --map-accent:${m.accent};">
        <div class="preview">
          <div class="map-badge">${escapeHtml(m.subtitle)}</div>
          <div class="skyline">
            ${skylineBars(m.id).map((h) => `<span style="width:10%;height:${h}%"></span>`).join('')}
          </div>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(m.name)}</div>
          <div class="card-desc">${escapeHtml(m.description)}</div>
        </div>
      </button>
    `).join('');

    this.mapGrid.querySelectorAll('.card').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectedMap = el.dataset.id;
        this.mapGrid.querySelectorAll('.card').forEach((c) => c.classList.toggle('selected', c.dataset.id === this.selectedMap));
      });
    });
  }

  show(which) {
    for (const [name, el] of Object.entries(this.screens)) {
      el.classList.toggle('active', name === which);
    }
  }

  setLoadingStatus(msg) {
    if (this.loadingStatus) this.loadingStatus.textContent = msg;
  }

  /** Shown in the top-bar during play. */
  setCurrentMap(mapName, mapSubtitle) {
    if (!this.currentMapLabel) return;
    this.currentMapLabel.textContent = `${mapName} · ${mapSubtitle || ''}`.trim();
  }

  onJoin(cb) { this._onJoinCb = cb; }
  onPlayAgain(cb) { this._onPlayAgainCb = cb; }

  showEndgame({ winnerName, standings, selfId }) {
    document.getElementById('winner-name').textContent = winnerName;
    const rows = standings.map((p, i) => {
      const kd = p.deaths === 0 ? p.kills.toFixed(2) : (p.kills / p.deaths).toFixed(2);
      const me = p.id === selfId ? ' class="me"' : '';
      return `<tr${me}><td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${kd}</td></tr>`;
    }).join('');
    document.getElementById('final-body').innerHTML = rows;
    this.show('endgame');
  }
}

// Lobby preview helpers (colors that complement each character card)
function visorFor(id) {
  return ({
    assault: '#00e6ff',
    stealth: '#b05cff',
    heavy:   '#ffcc5c',
    recon:   '#7cff9a',
  })[id] || '#00e6ff';
}
function skinFor(id) {
  return ({
    assault: '#e0b79a',
    stealth: '#cfa484',
    heavy:   '#c89870',
    recon:   '#e3b890',
  })[id] || '#e0b79a';
}
function skylineBars(id) {
  // Distinct silhouette per map, rendered as bar heights (%)
  return ({
    'neon-arena':      [30, 55, 45, 70, 40, 60, 50, 35],
    'royal-palace':    [60, 60, 80, 80, 80, 80, 60, 60], // columns
    'desert-temple':   [20, 40, 60, 80, 80, 60, 40, 20], // pyramid
    'frozen-fortress': [45, 70, 55, 70, 55, 70, 55, 70], // crenellations
  })[id] || [40, 50, 60, 50, 40, 60, 50, 40];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
