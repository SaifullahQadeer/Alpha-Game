/**
 * HUD — all DOM-based HUD updates in one place.
 * The game layer never touches the DOM directly.
 */
import { C } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      hpFill: document.getElementById('hp-fill'),
      hpValue: document.getElementById('hp-value'),
      ammoCur: document.getElementById('ammo-cur'),
      ammoMax: document.getElementById('ammo-max'),
      killFeed: document.getElementById('kill-feed'),
      hitmarker: document.getElementById('hitmarker'),
      damageVignette: document.getElementById('damage-vignette'),
      reloadOverlay: document.getElementById('reload-overlay'),
      reloadFill: document.getElementById('reload-fill'),
      deathOverlay: document.getElementById('death-overlay'),
      respawnTimer: document.getElementById('respawn-timer'),
      killedBy: document.getElementById('killed-by'),
      scoreboard: document.getElementById('scoreboard'),
      scoreboardBody: document.getElementById('scoreboard-body'),
      minimap: document.getElementById('minimap'),
      matchTimer: document.getElementById('match-timer'),
      clickToPlay: document.getElementById('click-to-play'),
    };
    this._hitmarkerHideAt = 0;
    this._respawnEndsAt = 0;
    this.mctx = this.el.minimap.getContext('2d');

    // Tick for death/respawn countdown and hitmarker auto-hide
    setInterval(() => this._tick(), 100);
  }

  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    this.el.hpFill.style.width = pct + '%';
    this.el.hpFill.classList.toggle('low', pct < 35);
    this.el.hpValue.textContent = Math.round(pct);
  }

  setAmmo(cur, max) {
    this.el.ammoCur.textContent = cur;
    this.el.ammoMax.textContent = max;
  }

  flashDamage() {
    this.el.damageVignette.classList.add('hit');
    setTimeout(() => this.el.damageVignette.classList.remove('hit'), 200);
  }

  showHitmarker(isKill = false) {
    this.el.hitmarker.classList.toggle('kill', isKill);
    this.el.hitmarker.classList.add('show');
    this._hitmarkerHideAt = performance.now() + (isKill ? 400 : 200);
  }

  pushKill({ killerName, victimName, weapon, killerId, victimId, selfId }) {
    const item = document.createElement('div');
    item.className = 'kf-item';
    if (killerId === selfId || victimId === selfId) item.classList.add('self');
    item.innerHTML = `
      <span class="killer">${escapeHtml(killerName)}</span>
      <span class="weapon">[${escapeHtml(weapon)}]</span>
      <span class="victim">${escapeHtml(victimName)}</span>
    `;
    this.el.killFeed.appendChild(item);
    setTimeout(() => {
      item.style.transition = 'opacity .3s, transform .3s';
      item.style.opacity = '0';
      item.style.transform = 'translateX(60px)';
      setTimeout(() => item.remove(), 350);
    }, 5000);
    while (this.el.killFeed.childElementCount > 6) {
      this.el.killFeed.firstChild.remove();
    }
  }

  showDeath(killedByName, respawnMs) {
    this.el.killedBy.textContent = killedByName || 'the world';
    this.el.deathOverlay.classList.remove('hidden');
    this._respawnEndsAt = performance.now() + respawnMs;
  }

  hideDeath() {
    this.el.deathOverlay.classList.add('hidden');
    this._respawnEndsAt = 0;
  }

  showReload(durationMs) {
    this.el.reloadOverlay.classList.remove('hidden');
    this.el.reloadFill.style.transition = 'none';
    this.el.reloadFill.style.width = '0%';
    // next frame
    requestAnimationFrame(() => {
      this.el.reloadFill.style.transition = `width ${durationMs}ms linear`;
      this.el.reloadFill.style.width = '100%';
    });
  }

  hideReload() {
    this.el.reloadOverlay.classList.add('hidden');
  }

  showScoreboard(show) {
    this.el.scoreboard.classList.toggle('hidden', !show);
  }

  updateScoreboard(players, selfId) {
    const rows = [...players]
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map((p) => {
        const kd = p.deaths === 0 ? p.kills.toFixed(2) : (p.kills / p.deaths).toFixed(2);
        const me = p.id === selfId ? ' class="me"' : '';
        return `<tr${me}><td>${escapeHtml(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${kd}</td></tr>`;
      })
      .join('');
    this.el.scoreboardBody.innerHTML = rows;
  }

  setMatchTimer(msLeft) {
    const s = Math.max(0, Math.floor(msLeft / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    this.el.matchTimer.textContent = `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  setClickToPlay(show) {
    this.el.clickToPlay.classList.toggle('hidden', !show);
  }

  /** Draw top-down minimap from current player list. */
  drawMinimap(players, selfId, mapSize, walls) {
    const ctx = this.mctx;
    const size = this.el.minimap.width;
    const scale = size / mapSize;
    const cx = size / 2, cz = size / 2;

    ctx.clearRect(0, 0, size, size);

    // bg
    ctx.fillStyle = 'rgba(0, 10, 20, 0.5)';
    ctx.fillRect(0, 0, size, size);

    // walls
    ctx.fillStyle = 'rgba(255, 43, 209, 0.3)';
    ctx.strokeStyle = 'rgba(255, 43, 209, 0.7)';
    ctx.lineWidth = 1;
    for (const w of walls) {
      const [wx, , wz] = w.pos;
      const [sx, , sz] = w.size;
      ctx.fillRect(cx + wx * scale - sx * scale / 2, cz + wz * scale - sz * scale / 2, sx * scale, sz * scale);
    }

    // grid
    ctx.strokeStyle = 'rgba(0, 230, 255, 0.1)';
    for (let i = 0; i <= mapSize; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i * scale, 0);
      ctx.lineTo(i * scale, size);
      ctx.moveTo(0, i * scale);
      ctx.lineTo(size, i * scale);
      ctx.stroke();
    }

    // players
    for (const p of players) {
      if (!p.alive) continue;
      const px = cx + p.pos.x * scale;
      const pz = cz + p.pos.z * scale;
      const isMe = p.id === selfId;
      ctx.fillStyle = isMe ? '#00e6ff' : '#ff2bd1';
      ctx.beginPath();
      ctx.arc(px, pz, isMe ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();

      if (isMe) {
        // direction indicator (based on yaw)
        const yaw = p.rot.yaw;
        ctx.strokeStyle = '#00e6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, pz);
        ctx.lineTo(px + Math.sin(yaw) * -8, pz + Math.cos(yaw) * -8);
        ctx.stroke();
      }
    }

    // border
    ctx.strokeStyle = 'rgba(0, 230, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
  }

  _tick() {
    // auto-hide hitmarker
    if (this._hitmarkerHideAt && performance.now() > this._hitmarkerHideAt) {
      this.el.hitmarker.classList.remove('show');
      this._hitmarkerHideAt = 0;
    }
    // respawn countdown
    if (this._respawnEndsAt) {
      const left = Math.max(0, Math.ceil((this._respawnEndsAt - performance.now()) / 1000));
      this.el.respawnTimer.textContent = String(left);
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
