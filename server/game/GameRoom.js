/**
 * GameRoom
 * ------------------------------------------------------------
 * One match / one arena. Responsibilities:
 *  - hold Player state
 *  - validate & process inputs (movement, shoot, reload)
 *  - authoritative hit detection (ray vs player AABB)
 *  - broadcast snapshots at TICK_RATE
 *  - manage respawns, kill feed, scoring
 *
 * The room's current map can change between matches (decided by the next
 * joining player when the room is empty, or kept when others are present).
 */
'use strict';

const Player = require('./Player');
const C = require('./constants');
const { randomSpawn, raycastPlayer, normalize } = require('./math');

class GameRoom {
  constructor(id, io, mapId = C.DEFAULT_MAP) {
    this.id = id;
    this.io = io;
    this.players = new Map();
    this.killFeed = [];
    this.matchStartedAt = Date.now();
    this.running = false;
    this.tickHandle = null;
    this.mapId = C.MAPS[mapId] ? mapId : C.DEFAULT_MAP;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tickMs = 1000 / C.TICK_RATE;
    this.tickHandle = setInterval(() => this.tick(), tickMs);
  }

  stop() {
    this.running = false;
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  get currentMap() {
    return C.MAPS[this.mapId] || C.MAPS[C.DEFAULT_MAP];
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------

  addPlayer(socket, name, characterId, requestedMapId) {
    if (this.players.size >= C.MAX_PLAYERS_PER_ROOM) {
      socket.emit('joinRejected', { reason: 'room full' });
      return;
    }

    // If the room is empty and the joiner requested a valid map, adopt it.
    if (this.players.size === 0 && requestedMapId && C.MAPS[requestedMapId]) {
      this.mapId = requestedMapId;
      this.matchStartedAt = Date.now();
      this.killFeed = [];
    }

    const player = new Player(socket.id, name, characterId);
    const spawn = randomSpawn();
    player.pos = spawn;
    this.players.set(socket.id, player);

    socket.join(this.id);

    const map = this.currentMap;
    socket.emit('init', {
      selfId: socket.id,
      map: {
        id: map.id,
        name: map.name,
        size: map.size,
        wallHeight: map.wallHeight,
        walls: map.walls,
        theme: map.theme,
        decorations: map.decorations,
      },
      players: [...this.players.values()].map((p) => p.toSnapshot()),
      characters: C.CHARACTERS,
      constants: {
        MAX_HEALTH: C.MAX_HEALTH,
        WEAPON: C.WEAPON,
        RESPAWN_TIME_MS: C.RESPAWN_TIME_MS,
        MATCH_DURATION_MS: C.MATCH_DURATION_MS,
        SCORE_TO_WIN: C.SCORE_TO_WIN,
      },
      matchStartedAt: this.matchStartedAt,
      serverTime: Date.now(),
    });

    socket.to(this.id).emit('playerJoined', player.toSnapshot());

    socket.on('input', (d) => this._onInput(socket.id, d));
    socket.on('shoot', (d) => this._onShoot(socket.id, d));
    socket.on('reload', () => this._onReload(socket.id));
    socket.on('chat', (d) => this._onChat(socket.id, d));
  }

  removePlayer(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this.io.to(this.id).emit('playerLeft', { id });
  }

  // -----------------------------------------------------------------
  // Input handlers
  // -----------------------------------------------------------------

  _onInput(id, data) {
    const p = this.players.get(id);
    if (!p || !p.alive || !data || !data.pos || !data.rot) return;

    const half = this.currentMap.size / 2;
    p.pos = {
      x: Math.max(-half, Math.min(half, +data.pos.x || 0)),
      y: Math.max(0, Math.min(10, +data.pos.y || 0)),
      z: Math.max(-half, Math.min(half, +data.pos.z || 0)),
    };
    p.rot = {
      yaw: +data.rot.yaw || 0,
      pitch: +data.rot.pitch || 0,
    };
  }

  _onShoot(id, data) {
    const p = this.players.get(id);
    if (!p || !p.alive || !data || !data.origin || !data.dir) return;

    const now = Date.now();
    if (p.reloading) return;
    if (p.ammo <= 0) return;
    if (now - p.lastShotAt < C.WEAPON.fireRateMs) return;

    p.lastShotAt = now;
    p.ammo--;

    const origin = {
      x: +data.origin.x || 0,
      y: +data.origin.y || 0,
      z: +data.origin.z || 0,
    };
    const dir = normalize({
      x: +data.dir.x || 0,
      y: +data.dir.y || 0,
      z: +data.dir.z || 0,
    });

    let closest = null;
    for (const target of this.players.values()) {
      if (target.id === id || !target.alive) continue;
      const t = raycastPlayer(origin, dir, target.pos);
      if (t !== null && t <= C.WEAPON.range) {
        if (!closest || t < closest.t) closest = { t, target };
      }
    }

    this.io.to(this.id).emit('shotFired', {
      shooterId: id,
      origin,
      dir,
      hit: closest ? { playerId: closest.target.id, dist: closest.t } : null,
      ammo: p.ammo,
    });

    if (!closest) return;

    const target = closest.target;
    target.health -= C.WEAPON.damage;

    this.io.to(id).emit('hitConfirmed', {
      targetId: target.id,
      damage: C.WEAPON.damage,
      killing: target.health <= 0,
    });

    this.io.to(target.id).emit('tookDamage', {
      attackerId: id,
      damage: C.WEAPON.damage,
      health: Math.max(0, target.health),
    });

    if (target.health <= 0) {
      target.health = 0;
      target.alive = false;
      target.deaths++;
      p.kills++;
      target.respawnAt = now + C.RESPAWN_TIME_MS;

      const kill = {
        killerId: p.id,
        killerName: p.name,
        victimId: target.id,
        victimName: target.name,
        weapon: C.WEAPON.name,
        t: now,
      };
      this.killFeed.push(kill);
      if (this.killFeed.length > 6) this.killFeed.shift();
      this.io.to(this.id).emit('playerKilled', kill);

      if (p.kills >= C.SCORE_TO_WIN) this._endMatch(p);
    }
  }

  _onReload(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || p.reloading) return;
    if (p.ammo >= C.WEAPON.magSize) return;

    p.reloading = true;
    this.io.to(id).emit('reloadStart', { duration: C.WEAPON.reloadTimeMs });

    setTimeout(() => {
      const cur = this.players.get(id);
      if (!cur) return;
      cur.ammo = C.WEAPON.magSize;
      cur.reloading = false;
      this.io.to(id).emit('reloadComplete', { ammo: cur.ammo });
    }, C.WEAPON.reloadTimeMs);
  }

  _onChat(id, data) {
    const p = this.players.get(id);
    if (!p || !data || typeof data.msg !== 'string') return;
    const msg = data.msg.slice(0, 140);
    this.io.to(this.id).emit('chat', { id, name: p.name, msg, t: Date.now() });
  }

  // -----------------------------------------------------------------
  // Tick
  // -----------------------------------------------------------------

  tick() {
    const now = Date.now();

    for (const p of this.players.values()) {
      if (!p.alive && now >= p.respawnAt) {
        const spawn = randomSpawn();
        p.pos = spawn;
        p.health = C.MAX_HEALTH;
        p.alive = true;
        p.ammo = C.WEAPON.magSize;
        p.reloading = false;
        this.io.to(p.id).emit('respawn', { pos: p.pos, health: p.health, ammo: p.ammo });
        this.io.to(this.id).emit('playerRespawned', { id: p.id, pos: p.pos });
      }
    }

    const players = new Array(this.players.size);
    let i = 0;
    for (const p of this.players.values()) {
      players[i++] = {
        id: p.id,
        pos: p.pos,
        rot: p.rot,
        health: p.health,
        alive: p.alive,
        kills: p.kills,
        deaths: p.deaths,
        characterId: p.characterId,
      };
    }
    this.io.to(this.id).emit('snapshot', { t: now, players });

    if (now - this.matchStartedAt >= C.MATCH_DURATION_MS) {
      const winner = [...this.players.values()].sort((a, b) => b.kills - a.kills)[0];
      this._endMatch(winner);
    }
  }

  _endMatch(winner) {
    const standings = [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths }))
      .sort((a, b) => b.kills - a.kills);

    this.io.to(this.id).emit('matchEnd', {
      winnerId: winner ? winner.id : null,
      winnerName: winner ? winner.name : 'Nobody',
      standings,
    });

    this.matchStartedAt = Date.now();
    this.killFeed = [];
    for (const p of this.players.values()) {
      p.kills = 0;
      p.deaths = 0;
      p.health = C.MAX_HEALTH;
      p.ammo = C.WEAPON.magSize;
      p.alive = true;
      p.reloading = false;
      p.pos = randomSpawn();
    }
  }
}

module.exports = GameRoom;
