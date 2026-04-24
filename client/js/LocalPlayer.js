/**
 * LocalPlayer
 * -------------------------------------------------------------
 * Owns the camera, keyboard/mouse input, local physics, and
 * emits shoot events. Movement is client-simulated and sent to
 * the server at SEND_RATE_HZ; the server broadcasts our position
 * to everyone else.
 *
 * Coordinate conventions:
 *   - this.position is the FEET position (y = 0 when on ground)
 *   - camera is at position.y + EYE_HEIGHT
 *   - yaw rotates around world Y, pitch around camera X
 */
import * as THREE from 'three';
import { C } from './config.js';

const KEY = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', space: 'Space', r: 'KeyR', tab: 'Tab' };

export class LocalPlayer {
  constructor({ camera, world, network, hud, weapon }) {
    this.camera = camera;
    this.world = world;
    this.network = network;
    this.hud = hud;
    this.weapon = weapon;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.recoil = 0;            // additive pitch from recoil
    this.onGround = true;

    this.health = C.MAX_HEALTH;
    this.alive = true;
    this.ammo = C.WEAPON.magSize;
    this.reloading = false;
    this.lastShotAt = 0;

    this.keys = new Set();
    this.mouseHeld = false;
    this.pointerLocked = false;

    this._bindEvents();
  }

  /** Call after network init. */
  spawn(pos) {
    this.position.set(pos.x, pos.y || 0, pos.z);
    this.velocity.set(0, 0, 0);
    this.health = C.MAX_HEALTH;
    this.alive = true;
    this.ammo = C.WEAPON.magSize;
    this.reloading = false;
    this._syncCamera();
  }

  takeDamage(health) {
    this.health = Math.max(0, health);
    this.hud.flashDamage();
    this.hud.setHealth(this.health);
    if (this.health <= 0) this.alive = false;
  }

  // -----------------------------------------------------------------
  // Input binding
  // -----------------------------------------------------------------

  _bindEvents() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (!this.pointerLocked && e.code !== 'Tab') return;
      if (e.code === KEY.tab) { e.preventDefault(); this.hud.showScoreboard(true); return; }
      if (e.code === KEY.r) this._requestReload();
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === KEY.tab) { e.preventDefault(); this.hud.showScoreboard(false); return; }
      this.keys.delete(e.code);
    });

    // Mouse look / click to lock
    const canvas = document.getElementById('canvas');
    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      this.hud.setClickToPlay(!this.pointerLocked && this.alive);
      if (!this.pointerLocked) this.keys.clear();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.yaw   -= e.movementX * C.MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * C.MOUSE_SENSITIVITY;
      const limit = Math.PI / 2 - 0.01;
      if (this.pitch >  limit) this.pitch =  limit;
      if (this.pitch < -limit) this.pitch = -limit;
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked || e.button !== 0) return;
      this.mouseHeld = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseHeld = false;
    });
  }

  // -----------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------

  update(dt) {
    if (!this.alive) { this._syncCamera(); return; }

    this._movement(dt);
    this._tryShoot();

    // Decay recoil
    this.recoil = Math.max(0, this.recoil - C.WEAPON.recoilRecover * dt * this.recoil);

    this._syncCamera();

    // Network: stream our state (rate-limited inside Network)
    this.network.sendInput(
      { x: this.position.x, y: this.position.y, z: this.position.z },
      { yaw: this.yaw, pitch: this.pitch }
    );
  }

  _movement(dt) {
    // Build move vector from keys
    const forward = (this.keys.has(KEY.w) ? 1 : 0) - (this.keys.has(KEY.s) ? 1 : 0);
    const strafe  = (this.keys.has(KEY.d) ? 1 : 0) - (this.keys.has(KEY.a) ? 1 : 0);

    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);

    // Camera forward is -Z in local space. With yaw rotation around Y:
    //   world forward = (-sinY, 0, -cosY)
    //   world right   = ( cosY, 0, -sinY)
    let dx = (-sinY) * forward + ( cosY) * strafe;
    let dz = (-cosY) * forward + (-sinY) * strafe;

    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }

    const speed = this.onGround ? C.MOVE_SPEED : C.MOVE_SPEED_AIR;
    this.velocity.x = dx * speed;
    this.velocity.z = dz * speed;

    // Jump
    if (this.keys.has(KEY.space) && this.onGround) {
      this.velocity.y = C.JUMP_VEL;
      this.onGround = false;
    }

    // Gravity
    this.velocity.y -= C.GRAVITY * dt;

    // Proposed next
    const next = new THREE.Vector3(
      this.position.x + this.velocity.x * dt,
      this.position.y + this.velocity.y * dt,
      this.position.z + this.velocity.z * dt,
    );

    // Horizontal collision
    this.world.resolveCollision(this.position, next);

    // Ground/ceiling
    if (next.y <= 0) {
      next.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Arena bounds (soft clamp)
    const half = C.MAP_SIZE / 2 - C.PLAYER_RADIUS;
    if (next.x >  half) next.x =  half;
    if (next.x < -half) next.x = -half;
    if (next.z >  half) next.z =  half;
    if (next.z < -half) next.z = -half;

    this.position.copy(next);
  }

  _tryShoot() {
    if (!this.mouseHeld || !this.alive || this.reloading) return;
    const now = performance.now();
    if (now - this.lastShotAt < C.WEAPON.fireRateMs) return;
    if (this.ammo <= 0) {
      this._requestReload();
      return;
    }
    this.lastShotAt = now;
    this.ammo--;
    this.hud.setAmmo(this.ammo, C.WEAPON.magSize);
    this.recoil += C.WEAPON.recoilPitch;

    // Compute ray from camera center (true aim after recoil offset is already in camera)
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    this.network.sendShoot(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x,    y: dir.y,    z: dir.z }
    );

    this.weapon.playShot();
  }

  _requestReload() {
    if (this.reloading || this.ammo >= C.WEAPON.magSize) return;
    this.reloading = true;
    this.hud.showReload(C.WEAPON.reloadTimeMs);
    this.network.sendReload();
  }

  onReloadComplete(ammo) {
    this.reloading = false;
    this.ammo = ammo;
    this.hud.setAmmo(this.ammo, C.WEAPON.magSize);
    this.hud.hideReload();
  }

  /** Server-authoritative respawn. */
  onRespawn({ pos, health, ammo }) {
    this.spawn(pos);
    this.health = health ?? C.MAX_HEALTH;
    this.ammo = ammo ?? C.WEAPON.magSize;
    this.alive = true;
    this.hud.setHealth(this.health);
    this.hud.setAmmo(this.ammo, C.WEAPON.magSize);
    this.hud.hideDeath();
  }

  _syncCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + C.EYE_HEIGHT,
      this.position.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.recoil;
  }
}
