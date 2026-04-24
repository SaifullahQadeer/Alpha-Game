/**
 * Authoritative player state on the server.
 * Client-authoritative for pos/rot (pragmatic MVP trade-off); the server
 * enforces fire-rate, ammo, damage, respawn, and map bounds.
 */
'use strict';

const C = require('./constants');

class Player {
  constructor(id, name, characterId) {
    this.id = id;
    this.name = name;
    this.characterId = C.CHARACTERS[characterId] ? characterId : C.DEFAULT_CHARACTER;
    this.pos = { x: 0, y: 0, z: 0 };
    this.rot = { yaw: 0, pitch: 0 };
    this.health = C.MAX_HEALTH;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.ammo = C.WEAPON.magSize;
    this.reloading = false;
    this.lastShotAt = 0;
    this.respawnAt = 0;
    this.joinedAt = Date.now();
  }

  /** Snapshot for broadcast. Keep small. */
  toSnapshot() {
    return {
      id: this.id,
      name: this.name,
      characterId: this.characterId,
      pos: this.pos,
      rot: this.rot,
      health: this.health,
      alive: this.alive,
      kills: this.kills,
      deaths: this.deaths,
    };
  }
}

module.exports = Player;
