/**
 * Game — top-level orchestrator. Wires together scene, network,
 * local/remote players, weapon, HUD.
 *
 * Loop:
 *   1. input / local simulation  (LocalPlayer.update)
 *   2. interpolate remote players to (now - INTERP_DELAY_MS)
 *   3. update viewmodel / effects
 *   4. render
 */
import * as THREE from 'three';
import { C } from './config.js';
import { Network } from './Network.js';
import { World } from './World.js';
import { LocalPlayer } from './LocalPlayer.js';
import { RemotePlayer } from './RemotePlayer.js';
import { Weapon } from './Weapon.js';
import { HUD } from './HUD.js';

export class Game {
  constructor({ ui }) {
    this.ui = ui;
    this.network = new Network();
    this.hud = new HUD();

    /** @type {Map<string, RemotePlayer>} */
    this.remotes = new Map();

    this.serverTimeOffset = 0; // serverTime - clientTime at init
    this.matchStartedAt = 0;
    this.matchDurationMs = 5 * 60 * 1000;
    this.running = false;
    this.lastFrame = performance.now();
  }

  async connect({ name, characterId, mapId }) {
    this.ui.setLoadingStatus('Connecting to server...');
    try {
      const init = await this.network.connect({ name, characterId, mapId }, (msg) => this.ui.setLoadingStatus(msg));
      this.ui.setLoadingStatus(`Building ${init.map?.name || 'arena'}...`);
      this._boot(init);
    } catch (err) {
      this.ui.setLoadingStatus(`Failed: ${err.message}. Refresh to retry.`);
    }
  }

  _boot(init) {
    this.selfId = init.selfId;
    this.matchStartedAt = init.matchStartedAt;
    this.matchDurationMs = init.constants.MATCH_DURATION_MS;
    this.serverTimeOffset = init.serverTime - Date.now();

    this.characters = init.characters || {};

    // Three.js renderer
    const canvas = document.getElementById('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.ui.setCurrentMap(init.map?.name || 'Arena', init.map?.theme?.style?.toUpperCase() || '');

    // Camera
    this.camera = new THREE.PerspectiveCamera(C.FOV, window.innerWidth / window.innerHeight, C.NEAR, C.FAR);
    this.camera.rotation.order = 'YXZ';

    // World / scene
    this.world = new World(init.map);

    // Weapon viewmodel (adds camera to scene internally)
    this.weapon = new Weapon(this.world.scene, this.camera);

    // Local player
    this.local = new LocalPlayer({
      camera: this.camera,
      world: this.world,
      network: this.network,
      hud: this.hud,
      weapon: this.weapon,
    });
    const me = init.players.find((p) => p.id === this.selfId);
    if (me) this.local.spawn(me.pos);
    this.hud.setHealth(C.MAX_HEALTH);
    this.hud.setAmmo(C.WEAPON.magSize, C.WEAPON.magSize);

    // Spawn existing remotes (except self)
    for (const p of init.players) {
      if (p.id === this.selfId) continue;
      this._addRemote(p);
    }

    // Wire network events
    this._wireNetworkEvents();

    // Show game
    this.ui.show('game');
    this.running = true;
    window.addEventListener('resize', () => this._onResize());

    requestAnimationFrame((t) => this._loop(t));
  }

  _wireNetworkEvents() {
    const n = this.network;

    n.on('snapshot', (s) => {
      const serverT = s.t;
      // Update remotes' interpolation buffers + HUD.
      for (const p of s.players) {
        if (p.id === this.selfId) continue;
        let r = this.remotes.get(p.id);
        if (!r) {
          // Late-join catch-up: synthesize RemotePlayer from this snapshot
          r = this._addRemote({ id: p.id, name: `Player-${p.id.slice(0, 4)}`, pos: p.pos, rot: p.rot, alive: p.alive, health: p.health, characterId: p.characterId });
        }
        r.pushState(serverT, p.pos, p.rot, p.alive, p.health);
      }
      this.hud.updateScoreboard(s.players, this.selfId);
      // Minimap uses freshest positions
      this._lastSnapshotPlayers = s.players;
    });

    n.on('playerJoined', (p) => {
      if (p.id === this.selfId) return;
      this._addRemote(p);
    });

    n.on('playerLeft', ({ id }) => {
      const r = this.remotes.get(id);
      if (r) { r.dispose(); this.remotes.delete(id); }
    });

    n.on('shotFired', ({ shooterId, origin, dir, hit }) => {
      // Compute tracer end: either hit player position or ray into world
      let endPoint;
      if (hit) {
        endPoint = new THREE.Vector3(
          origin.x + dir.x * hit.dist,
          origin.y + dir.y * hit.dist,
          origin.z + dir.z * hit.dist,
        );
      } else {
        const o = new THREE.Vector3(origin.x, origin.y, origin.z);
        const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
        const worldT = this.world.raycastWorld(o, d);
        const maxT = Math.min(worldT, C.WEAPON.range);
        endPoint = o.clone().add(d.multiplyScalar(maxT));
      }

      // Tracer origin: for own shots, start at muzzle; for others, at their chest.
      let tracerStart;
      if (shooterId === this.selfId) {
        tracerStart = new THREE.Vector3(origin.x, origin.y, origin.z);
      } else {
        const r = this.remotes.get(shooterId);
        if (r) {
          tracerStart = r.group.position.clone();
          tracerStart.y += C.PLAYER_HEIGHT - 0.4;
        } else {
          tracerStart = new THREE.Vector3(origin.x, origin.y, origin.z);
        }
      }
      this.weapon.spawnTracer(tracerStart, endPoint, shooterId === this.selfId ? 0x00e6ff : 0xff2bd1);
    });

    n.on('hitConfirmed', ({ killing }) => {
      this.hud.showHitmarker(!!killing);
    });

    n.on('tookDamage', ({ health }) => {
      this.local.takeDamage(health);
    });

    n.on('playerKilled', (kill) => {
      this.hud.pushKill({ ...kill, selfId: this.selfId });
      if (kill.victimId === this.selfId) {
        this.local.alive = false;
        this.hud.showDeath(kill.killerName, C.RESPAWN_TIME_MS);
      }
    });

    n.on('respawn', (data) => {
      this.local.onRespawn(data);
    });

    n.on('reloadStart', () => { /* HUD already shown in LocalPlayer */ });
    n.on('reloadComplete', ({ ammo }) => this.local.onReloadComplete(ammo));

    n.on('matchEnd', ({ winnerName, standings }) => {
      this.running = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.ui.showEndgame({ winnerName, standings, selfId: this.selfId });
    });
  }

  _addRemote(data) {
    const character = this.characters[data.characterId] || null;
    const r = new RemotePlayer(this.world.scene, data, character);
    this.remotes.set(data.id, r);
    return r;
  }

  _onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  _loop(tMs) {
    if (!this.running) return;
    const dt = Math.min(0.05, (tMs - this.lastFrame) / 1000);
    this.lastFrame = tMs;

    // 1. Local simulation
    this.local.update(dt);

    // 2. Interpolate remote players
    const renderT = (Date.now() + this.serverTimeOffset) - C.INTERP_DELAY_MS;
    for (const r of this.remotes.values()) r.interpolate(renderT);

    // 3. Effects
    this.weapon.update(dt);

    // 4. Minimap + match timer (cheap; every frame is fine)
    if (this._lastSnapshotPlayers) {
      this.hud.drawMinimap(this._lastSnapshotPlayers, this.selfId, C.MAP_SIZE, this.world.mapData.walls);
    }
    const serverNow = Date.now() + this.serverTimeOffset;
    const left = this.matchDurationMs - (serverNow - this.matchStartedAt);
    this.hud.setMatchTimer(left);

    // 5. Render
    this.renderer.render(this.world.scene, this.camera);

    requestAnimationFrame((t) => this._loop(t));
  }
}
