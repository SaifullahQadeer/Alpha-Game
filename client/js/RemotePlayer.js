/**
 * RemotePlayer
 * A detailed humanoid built from primitives (no external model assets).
 * Shape varies per character class via `character.palette` + `character.build`.
 *
 * Anatomy (feet at y=0, head top ≈ 1.85):
 *   - head sphere
 *   - helmet + visor + nose guard
 *   - neck
 *   - torso (chest) with chest plate + ab plate + belt
 *   - shoulder pads + upper arms + forearms + gloves
 *   - upper legs + lower legs + boots
 *
 * Minimal walk animation: when the player is visibly moving, swing arms
 * and legs in opposition. Reads velocity from interpolation buffer.
 */
import * as THREE from 'three';
import { C } from './config.js';

const DEFAULT_PALETTE = {
  primary:   0x2a55c8,
  secondary: 0xff8033,
  visor:     0x00e6ff,
  skin:      0xe0b79a,
  trim:      0xf0e6d8,
  metal:     0x4a5668,
};

export class RemotePlayer {
  /**
   * @param {THREE.Scene} scene
   * @param {{id:string, name:string, pos:{x,y,z}, rot:{yaw,pitch}, alive?:boolean, health?:number, characterId?:string}} data
   * @param {{id:string, name:string, palette:object, build?:string}|null} [character]
   */
  constructor(scene, data, character = null) {
    this.id = data.id;
    this.name = data.name;
    this.scene = scene;
    this.character = character;
    this.palette = character?.palette ?? DEFAULT_PALETTE;
    this.build = character?.build ?? 'regular';

    /** @type {{t:number, pos:THREE.Vector3, yaw:number, pitch:number}[]} */
    this.buffer = [];
    this.alive = data.alive !== false;
    this.health = data.health ?? C.MAX_HEALTH;

    this.group = new THREE.Group();
    this.group.position.set(data.pos.x, data.pos.y, data.pos.z);
    scene.add(this.group);

    this._buildHumanoid();

    this.nameplate = this._makeNameplate(data.name, this.palette.visor);
    this.nameplate.position.y = C.PLAYER_HEIGHT + 0.45;
    this.group.add(this.nameplate);

    this._animTime = 0;
    this._lastPos = this.group.position.clone();
    this._speedEMA = 0; // smoothed speed for bob/swing
  }

  _buildHumanoid() {
    const p = this.palette;
    const scaleTorso = this.build === 'heavy' ? 1.15 : this.build === 'slim' ? 0.9 : 1.0;
    const scaleLimbs = this.build === 'heavy' ? 1.15 : this.build === 'slim' ? 0.85 : 1.0;

    const matPrimary   = new THREE.MeshStandardMaterial({ color: p.primary, roughness: 0.55, metalness: 0.45 });
    const matSecondary = new THREE.MeshStandardMaterial({ color: p.secondary, roughness: 0.5, metalness: 0.45, emissive: p.secondary, emissiveIntensity: 0.1 });
    const matMetal     = new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.3, metalness: 0.85 });
    const matTrim      = new THREE.MeshStandardMaterial({ color: p.trim, roughness: 0.5, metalness: 0.3 });
    const matSkin      = new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.85, metalness: 0 });
    const matVisor     = new THREE.MeshStandardMaterial({
      color: p.visor, emissive: p.visor, emissiveIntensity: 0.9,
      roughness: 0.2, metalness: 0.6,
    });
    const matBoot      = new THREE.MeshStandardMaterial({ color: 0x0e0e14, roughness: 0.6, metalness: 0.3 });

    this._mats = [matPrimary, matSecondary, matMetal, matTrim, matSkin, matVisor, matBoot];

    // ---- Legs (feet at y=0) --------------------------------------------
    const legLen = 0.85;
    const thighLen = 0.45;
    const shinLen = legLen - thighLen;
    const legRadius = 0.14 * scaleLimbs;

    this.hipL = new THREE.Group(); this.hipL.position.set(-0.18, 0.85, 0); this.group.add(this.hipL);
    this.hipR = new THREE.Group(); this.hipR.position.set( 0.18, 0.85, 0); this.group.add(this.hipR);

    const thighGeom = new THREE.CylinderGeometry(legRadius, legRadius * 0.95, thighLen, 10);
    const shinGeom  = new THREE.CylinderGeometry(legRadius * 0.95, legRadius * 0.8, shinLen, 10);

    for (const hip of [this.hipL, this.hipR]) {
      const thigh = new THREE.Mesh(thighGeom, matPrimary);
      thigh.position.y = -thighLen / 2;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -thighLen;
      hip.add(knee);

      const shin = new THREE.Mesh(shinGeom, matMetal);
      shin.position.y = -shinLen / 2;
      knee.add(shin);

      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(legRadius * 2.6, 0.1, 0.42),
        matBoot
      );
      boot.position.set(0, -shinLen + 0.02, 0.06);
      knee.add(boot);
    }

    // ---- Pelvis / belt -------------------------------------------------
    const pelvis = new THREE.Mesh(
      new THREE.BoxGeometry(0.48 * scaleTorso, 0.22, 0.32 * scaleTorso),
      matPrimary
    );
    pelvis.position.y = 0.95;
    this.group.add(pelvis);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.52 * scaleTorso, 0.1, 0.34 * scaleTorso),
      matMetal
    );
    belt.position.y = 1.05;
    this.group.add(belt);

    // Belt buckle accent
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.02),
      matSecondary
    );
    buckle.position.set(0, 1.05, (0.34 * scaleTorso) / 2 + 0.01);
    this.group.add(buckle);

    // ---- Torso (chest) -------------------------------------------------
    const torsoW = 0.58 * scaleTorso;
    const torsoH = 0.55;
    const torsoD = 0.32 * scaleTorso;
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(torsoW, torsoH, torsoD),
      matPrimary
    );
    torso.position.y = 1.1 + torsoH / 2;
    this.group.add(torso);

    // Chest plate (trapezoid via custom shape)
    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(torsoW * 0.82, torsoH * 0.85, 0.04),
      matSecondary
    );
    chestPlate.position.set(0, torso.position.y, torsoD / 2 + 0.03);
    this.group.add(chestPlate);

    // Vertical seam
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, torsoH * 0.9, 0.01),
      matTrim
    );
    seam.position.set(0, torso.position.y, torsoD / 2 + 0.06);
    this.group.add(seam);

    // Shoulder pads — heavier for 'heavy' build
    const padSize = this.build === 'heavy' ? 0.22 : this.build === 'slim' ? 0.13 : 0.17;
    const shoulderY = torso.position.y + torsoH / 2 - 0.04;
    for (const sign of [-1, 1]) {
      const pad = new THREE.Mesh(
        new THREE.SphereGeometry(padSize, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        matMetal
      );
      pad.position.set(sign * (torsoW / 2 + 0.02), shoulderY, 0);
      pad.rotation.z = sign * 0.15;
      this.group.add(pad);
    }

    // ---- Arms ---------------------------------------------------------
    const upperArmLen = 0.36;
    const forearmLen  = 0.36;
    const armRadius   = 0.1 * scaleLimbs;

    this.shoulderL = new THREE.Group(); this.shoulderL.position.set(-torsoW / 2 - 0.02, shoulderY - 0.05, 0); this.group.add(this.shoulderL);
    this.shoulderR = new THREE.Group(); this.shoulderR.position.set( torsoW / 2 + 0.02, shoulderY - 0.05, 0); this.group.add(this.shoulderR);

    const upperArmGeom = new THREE.CylinderGeometry(armRadius, armRadius * 0.9, upperArmLen, 10);
    const forearmGeom  = new THREE.CylinderGeometry(armRadius * 0.9, armRadius * 0.85, forearmLen, 10);
    const gloveGeom    = new THREE.BoxGeometry(armRadius * 2.2, armRadius * 2.1, armRadius * 2.1);

    for (const shoulder of [this.shoulderL, this.shoulderR]) {
      const upper = new THREE.Mesh(upperArmGeom, matPrimary);
      upper.position.y = -upperArmLen / 2;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -upperArmLen;
      shoulder.add(elbow);

      const fore = new THREE.Mesh(forearmGeom, matMetal);
      fore.position.y = -forearmLen / 2;
      elbow.add(fore);

      const glove = new THREE.Mesh(gloveGeom, matBoot);
      glove.position.y = -forearmLen - 0.02;
      elbow.add(glove);
    }

    // Right hand holds a small rifle silhouette, facing forward (+Z of group).
    const rifle = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.7),
      matMetal
    );
    rifle.add(body);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.15, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.7 })
    );
    grip.position.set(0, -0.1, 0.05);
    rifle.add(grip);
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8),
      matMetal
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0, 0.42);
    rifle.add(muzzle);
    // Mount under right elbow, pointing forward (+Z)
    rifle.position.set(0, -forearmLen + 0.02, 0.25);
    this.shoulderR.children[1].add(rifle); // elbow = children[1]

    // ---- Neck & Head ---------------------------------------------------
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.1, 0.1, 10),
      matSkin
    );
    neck.position.y = torso.position.y + torsoH / 2 + 0.05;
    this.group.add(neck);

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = torso.position.y + torsoH / 2 + 0.22;
    this.group.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), matSkin);
    this.headGroup.add(head);

    // Helmet — style differs per build
    const helmet = this._buildHelmet(matPrimary, matMetal, matSecondary);
    this.headGroup.add(helmet);

    // Visor (glowing band across eyes)
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.055, 0.02),
      matVisor
    );
    visor.position.set(0, 0.03, 0.13);
    this.headGroup.add(visor);

    // Jaw / chin strap
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.015, 8, 16, Math.PI),
      matTrim
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, -0.09, 0);
    this.headGroup.add(strap);
  }

  _buildHelmet(matPrimary, matMetal, matSecondary) {
    const helmet = new THREE.Group();
    const primary = matPrimary;
    const metal = matMetal;

    // Main dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.6),
      primary
    );
    dome.position.y = 0.04;
    helmet.add(dome);

    // Front face plate (covers brow down to visor)
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 20, 14, -Math.PI / 2, Math.PI, Math.PI / 3, Math.PI / 3),
      metal
    );
    face.position.y = 0.02;
    face.rotation.y = Math.PI;
    helmet.add(face);

    // Crest (ridge along top) — 'heavy' gets a thicker one, 'slim' a slim one
    const crestHeight = this.build === 'heavy' ? 0.16 : this.build === 'slim' ? 0.06 : 0.1;
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, crestHeight, 0.28),
      matSecondary
    );
    crest.position.set(0, 0.12 + crestHeight / 2, 0);
    helmet.add(crest);

    // Ear cups
    for (const sign of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), metal);
      ear.position.set(sign * 0.17, -0.01, 0);
      helmet.add(ear);
    }

    return helmet;
  }

  pushState(serverT, pos, rot, alive, health) {
    this.alive = alive;
    this.health = health;
    this.buffer.push({
      t: serverT,
      pos: new THREE.Vector3(pos.x, pos.y, pos.z),
      yaw: rot.yaw,
      pitch: rot.pitch,
    });
    while (this.buffer.length > 12) this.buffer.shift();
    this.group.visible = alive;
  }

  /**
   * Evaluate interpolated position + rotation and animate limbs.
   * @param {number} renderT
   */
  interpolate(renderT) {
    if (this.buffer.length === 0) return;

    let a = null, b = null;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].t <= renderT) {
        a = this.buffer[i];
        b = this.buffer[i + 1] || null;
        break;
      }
    }
    if (!a) a = this.buffer[0];
    if (!b) b = a;

    let targetYaw;
    let targetPitch;
    if (a === b) {
      this.group.position.copy(a.pos);
      targetYaw = a.yaw;
      targetPitch = a.pitch;
    } else {
      const span = b.t - a.t || 1;
      const alpha = Math.max(0, Math.min(1, (renderT - a.t) / span));
      this.group.position.lerpVectors(a.pos, b.pos, alpha);
      let dy = b.yaw - a.yaw;
      if (dy >  Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      targetYaw = a.yaw + dy * alpha;
      targetPitch = a.pitch + (b.pitch - a.pitch) * alpha;
    }

    this.group.rotation.y = targetYaw + Math.PI;
    if (this.headGroup) this.headGroup.rotation.x = -targetPitch * 0.6;

    // --- Walk anim: swing arms/legs based on horizontal speed ----------
    const now = performance.now();
    const dt = (now - (this._lastAnimT || now)) / 1000;
    this._lastAnimT = now;

    const dx = this.group.position.x - this._lastPos.x;
    const dz = this.group.position.z - this._lastPos.z;
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    this._lastPos.copy(this.group.position);
    // Smooth it so sudden jitter doesn't thrash limbs
    this._speedEMA = this._speedEMA * 0.8 + speed * 0.2;

    const walking = this._speedEMA > 0.5;
    if (walking) {
      this._animTime += dt * Math.min(6, this._speedEMA * 0.9);
      const swing = Math.sin(this._animTime * 2) * 0.5;
      if (this.hipL)       this.hipL.rotation.x =  swing;
      if (this.hipR)       this.hipR.rotation.x = -swing;
      if (this.shoulderL)  this.shoulderL.rotation.x = -swing * 0.8;
      if (this.shoulderR)  this.shoulderR.rotation.x =  swing * 0.8;
      // Subtle vertical bob
      this.group.position.y += Math.abs(Math.sin(this._animTime * 2)) * 0.02;
    } else {
      // Decay limbs to idle
      const decay = 0.85;
      if (this.hipL)      this.hipL.rotation.x      *= decay;
      if (this.hipR)      this.hipR.rotation.x      *= decay;
      if (this.shoulderL) this.shoulderL.rotation.x *= decay;
      if (this.shoulderR) this.shoulderR.rotation.x *= decay;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    if (this.nameplate?.material?.map) this.nameplate.material.map.dispose();
  }

  _makeNameplate(name, colorHex = 0x00e6ff) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const hex = '#' + colorHex.toString(16).padStart(6, '0');
    ctx.font = 'bold 30px Orbitron, sans-serif';
    ctx.fillStyle = hex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = hex;
    ctx.shadowBlur = 12;
    ctx.fillText(name, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }
}
