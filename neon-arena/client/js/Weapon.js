/**
 * Weapon — viewmodel attached to the camera + shot effects (tracers,
 * muzzle flashes, impact sparks). Purely visual; actual hit detection
 * is server-authoritative.
 */
import * as THREE from 'three';

export class Weapon {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.viewmodel = this._buildViewmodel();
    camera.add(this.viewmodel);
    scene.add(camera);

    /** @type {{mesh:THREE.Line, life:number, max:number}[]} */
    this.tracers = [];
    /** @type {{mesh:THREE.Mesh, life:number, max:number}[]} */
    this.flashes = [];

    // Kick animation offset
    this.kickZ = 0;
  }

  _buildViewmodel() {
    const group = new THREE.Group();
    // Position: bottom-right of the screen, in camera space.
    group.position.set(0.35, -0.35, -0.6);

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x1a1f2e,
        emissive: 0x00e6ff,
        emissiveIntensity: 0.15,
        metalness: 0.8,
        roughness: 0.3,
      })
    );
    body.position.set(0, 0, 0);
    group.add(body);

    // Barrel
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x0a0d15, metalness: 1, roughness: 0.2 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.45);
    group.add(barrel);

    // Sight rail
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xff2bd1 })
    );
    rail.position.set(0, 0.085, -0.1);
    group.add(rail);

    // Grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.16, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0a0d15, metalness: 0.5, roughness: 0.7 })
    );
    grip.position.set(0, -0.13, 0.1);
    grip.rotation.x = -0.25;
    group.add(grip);

    this._muzzleAnchor = new THREE.Object3D();
    this._muzzleAnchor.position.set(0, 0.01, -0.67);
    group.add(this._muzzleAnchor);

    return group;
  }

  /** Local player fired. Play viewmodel kick + muzzle flash. */
  playShot() {
    this.kickZ = 0.06; // will decay in update()
    this._spawnMuzzleFlash();
  }

  /**
   * Render a tracer from `origin` to `end` for anyone (including self).
   */
  spawnTracer(origin, end, color = 0x00e6ff) {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(origin.x, origin.y, origin.z),
      new THREE.Vector3(end.x, end.y, end.z),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 1.0,
    });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);
    this.tracers.push({ mesh: line, life: 0, max: 0.12 });
  }

  _spawnMuzzleFlash() {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 1 })
    );
    // World-space position of muzzle anchor
    const pos = this._muzzleAnchor.getWorldPosition(new THREE.Vector3());
    flash.position.copy(pos);
    this.scene.add(flash);
    this.flashes.push({ mesh: flash, life: 0, max: 0.08 });
  }

  /** Call every frame. */
  update(dt) {
    // Kick recover
    if (this.kickZ > 0) {
      this.kickZ = Math.max(0, this.kickZ - dt * 0.6);
    }
    this.viewmodel.position.z = -0.6 + this.kickZ;

    // Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life += dt;
      const a = 1 - t.life / t.max;
      t.mesh.material.opacity = Math.max(0, a);
      if (t.life >= t.max) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life += dt;
      const a = 1 - f.life / f.max;
      f.mesh.material.opacity = Math.max(0, a);
      f.mesh.scale.setScalar(1 + f.life * 20);
      if (f.life >= f.max) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mesh.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }
}
