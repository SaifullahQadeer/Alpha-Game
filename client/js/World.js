/**
 * World — builds the Three.js scene from a server-provided map payload.
 * `mapData` contains: { id, name, size, wallHeight, walls, theme, decorations }.
 *
 * Collision is still AABB against `walls` only. Decorations are purely
 * visual ornaments (columns, thrones, palms, ice spikes, etc.) and do not
 * add colliders — keeps movement crisp and predictable.
 */
import * as THREE from 'three';
import { C } from './config.js';

export class World {
  constructor(mapData) {
    this.mapData = mapData;
    this.theme = mapData.theme || defaultTheme();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.skyBottom || 0x05070d);
    this.scene.fog = new THREE.Fog(this.theme.fogColor || 0x05070d, this.theme.fogNear || 30, this.theme.fogFar || 120);

    /** @type {{min: THREE.Vector3, max: THREE.Vector3}[]} */
    this.colliders = [];

    this._buildLights();
    this._buildGround();
    this._buildArenaWalls();
    this._buildObstacles();
    this._buildSkybox();
    this._buildDecorations();
  }

  _buildLights() {
    const t = this.theme;
    this.scene.add(new THREE.AmbientLight(t.ambient ?? 0x334466, t.ambientIntensity ?? 0.6));

    const dir = new THREE.DirectionalLight(t.sunColor ?? 0xa8d8ff, t.sunIntensity ?? 0.9);
    const [sx, sy, sz] = t.sunPos || [30, 40, 20];
    dir.position.set(sx, sy, sz);
    this.scene.add(dir);
  }

  _buildGround() {
    const size = this.mapData.size;
    const t = this.theme;
    const g = new THREE.PlaneGeometry(size, size, 1, 1);
    const m = new THREE.MeshStandardMaterial({
      color: t.groundColor ?? 0x0a1020,
      roughness: t.groundRoughness ?? 0.9,
      metalness: t.groundMetalness ?? 0.1,
    });
    const floor = new THREE.Mesh(g, m);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Palace gets checkerboard tiling; desert gets cracks; ice gets subtle tiles.
    if (t.style === 'palace') this._addMarbleTiles(size);
    else if (t.style === 'desert') this._addSandPattern(size);
    else if (t.style === 'ice') this._addIceSheen(size);
    else this._addNeonGrid(size, t);
  }

  _addNeonGrid(size, t) {
    const grid = new THREE.GridHelper(size, size / 2, t.gridColor ?? 0x00e6ff, t.gridColor2 ?? 0x0a3040);
    grid.material.opacity = t.gridOpacity ?? 0.25;
    grid.material.transparent = true;
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  _addMarbleTiles(size) {
    const tileSize = 5;
    const count = Math.floor(size / tileSize);
    const tileGeom = new THREE.PlaneGeometry(tileSize - 0.05, tileSize - 0.05);
    const matA = new THREE.MeshStandardMaterial({ color: 0xf3ecd7, roughness: 0.3, metalness: 0.15 });
    const matB = new THREE.MeshStandardMaterial({ color: 0x8e7a4a, roughness: 0.4, metalness: 0.25 });
    for (let i = -count / 2; i < count / 2; i++) {
      for (let j = -count / 2; j < count / 2; j++) {
        const tile = new THREE.Mesh(tileGeom, ((i + j) & 1) ? matA : matB);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(i * tileSize + tileSize / 2, 0.011, j * tileSize + tileSize / 2);
        this.scene.add(tile);
      }
    }
  }

  _addSandPattern(size) {
    // Sparse ruin cracks via thin darker lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0x5a3a1a, transparent: true, opacity: 0.3 });
    for (let i = 0; i < 14; i++) {
      const x = (Math.random() - 0.5) * size * 0.9;
      const z = (Math.random() - 0.5) * size * 0.9;
      const len = 3 + Math.random() * 4;
      const angle = Math.random() * Math.PI * 2;
      const pts = [
        new THREE.Vector3(x, 0.02, z),
        new THREE.Vector3(x + Math.cos(angle) * len, 0.02, z + Math.sin(angle) * len),
      ];
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      this.scene.add(new THREE.Line(geom, lineMat));
    }
  }

  _addIceSheen(size) {
    const grid = new THREE.GridHelper(size, size / 3, 0xb8eaff, 0x5a8aad);
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    grid.position.y = 0.02;
    this.scene.add(grid);
  }

  _buildArenaWalls() {
    const size = this.mapData.size;
    const h = this.mapData.wallHeight || C.WALL_HEIGHT;
    const t = 1;
    const theme = this.theme;

    const wallMat = new THREE.MeshStandardMaterial({
      color: theme.wallColor ?? 0x1a2338,
      roughness: theme.style === 'palace' ? 0.2 : theme.style === 'ice' ? 0.3 : 0.4,
      metalness: theme.style === 'palace' ? 0.2 : 0.6,
      emissive: theme.wallEmissive ?? 0x00394a,
      emissiveIntensity: theme.wallEmissiveIntensity ?? 0.4,
      transparent: theme.style === 'ice',
      opacity: theme.style === 'ice' ? 0.85 : 1,
    });

    const make = (w, d, x, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(g, wallMat);
      m.position.set(x, h / 2, z);
      this.scene.add(m);
      this._addCollider(m.position, new THREE.Vector3(w, h, d));

      // Top trim strip (varies per theme)
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.08, d),
        new THREE.MeshBasicMaterial({ color: theme.stripColor ?? 0x00e6ff })
      );
      strip.position.set(x, h + 0.04, z);
      this.scene.add(strip);
    };

    make(size, t, 0,  size / 2);
    make(size, t, 0, -size / 2);
    make(t, size,  size / 2, 0);
    make(t, size, -size / 2, 0);
  }

  _buildObstacles() {
    const theme = this.theme;
    const obstacleMat = new THREE.MeshStandardMaterial({
      color: theme.obstacleColor ?? 0x1a1530,
      roughness: theme.style === 'palace' ? 0.3 : 0.6,
      metalness: theme.style === 'palace' ? 0.3 : 0.5,
      emissive: theme.obstacleEmissive ?? 0x3a0a44,
      emissiveIntensity: theme.obstacleEmissiveIntensity ?? 0.35,
    });

    for (const w of this.mapData.walls) {
      const [x, y, z] = w.pos;
      const [sx, sy, sz] = w.size;
      const g = new THREE.BoxGeometry(sx, sy, sz);
      const m = new THREE.Mesh(g, obstacleMat);
      m.position.set(x, y, z);
      this.scene.add(m);
      this._addCollider(m.position, new THREE.Vector3(sx, sy, sz));

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(g),
        new THREE.LineBasicMaterial({ color: theme.outlineColor ?? 0xff2bd1 })
      );
      edges.position.copy(m.position);
      this.scene.add(edges);
    }
  }

  _buildSkybox() {
    const t = this.theme;
    const g = new THREE.SphereGeometry(250, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top:    { value: new THREE.Color(t.skyTop    ?? 0x0a0520) },
        bottom: { value: new THREE.Color(t.skyBottom ?? 0x05070d) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 top;
        uniform vec3 bottom;
        void main() {
          float h = normalize(vWorldPos).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottom, top, h), 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(g, m));
  }

  _buildDecorations() {
    const decos = this.mapData.decorations || [];
    for (const d of decos) {
      switch (d.kind) {
        case 'pointLight':     this._spawnPointLight(d); break;
        case 'hologramPillar': this._spawnHologramPillar(d); break;
        case 'column':         this._spawnColumn(d); break;
        case 'throne':         this._spawnThrone(d); break;
        case 'fountain':       this._spawnFountain(d); break;
        case 'torch':          this._spawnTorch(d); break;
        case 'redCarpet':      this._spawnCarpet(d); break;
        case 'obelisk':        this._spawnObelisk(d); break;
        case 'palm':           this._spawnPalm(d); break;
        case 'crackedStone':   this._spawnCrackedStone(d); break;
        case 'iceSpike':       this._spawnIceSpike(d); break;
        case 'watchtowerCap':  this._spawnWatchtowerCap(d); break;
        case 'pineTree':       this._spawnPineTree(d); break;
        case 'snow':           this._spawnSnow(d); break;
      }
    }
  }

  // --- Decoration builders ---------------------------------------------

  _spawnPointLight({ pos, color, intensity = 1.0, dist = 50 }) {
    const l = new THREE.PointLight(color, intensity, dist);
    l.position.set(pos[0], pos[1], pos[2]);
    this.scene.add(l);
  }

  _spawnHologramPillar({ pos, color }) {
    const g = new THREE.CylinderGeometry(0.3, 0.3, 5, 16, 1, true);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(pos[0], 2.5, pos[2]);
    this.scene.add(mesh);
    const light = new THREE.PointLight(color, 0.6, 18);
    light.position.copy(mesh.position);
    this.scene.add(light);
  }

  _spawnColumn({ pos, height = 8, color = 0xf2ead4, capColor = 0xd4af37 }) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, height, 24),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 })
    );
    shaft.position.set(pos[0], height / 2, pos[2]);
    this.scene.add(shaft);

    // Gilded capital + base
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.6, 2.2),
      new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.2, metalness: 0.8, emissive: 0x4a3010, emissiveIntensity: 0.3 })
    );
    cap.position.set(pos[0], height - 0.3, pos[2]);
    this.scene.add(cap);

    const base = cap.clone();
    base.position.set(pos[0], 0.3, pos[2]);
    this.scene.add(base);

    // Subtle fluting
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, height - 0.8, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xdcd0b0, roughness: 0.4 })
      );
      stripe.position.set(pos[0] + Math.cos(a) * 0.95, height / 2, pos[2] + Math.sin(a) * 0.95);
      this.scene.add(stripe);
    }
  }

  _spawnThrone({ pos, color = 0xd4af37 }) {
    const gold = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.9, emissive: 0x4a3010, emissiveIntensity: 0.4 });
    const velvet = new THREE.MeshStandardMaterial({ color: 0x8b1a2b, roughness: 0.8 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 2.5), gold);
    seat.position.set(pos[0], pos[1] + 1.0, pos[2]);
    this.scene.add(seat);

    const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.1), velvet);
    cushion.position.set(pos[0], pos[1] + 1.5, pos[2]);
    this.scene.add(cushion);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 0.5), gold);
    backrest.position.set(pos[0], pos[1] + 3, pos[2] - 1.0);
    this.scene.add(backrest);

    // Crown points on backrest
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 4), gold);
      spike.position.set(pos[0] + i * 1.1, pos[1] + 5, pos[2] - 1.0);
      this.scene.add(spike);
    }

    // Arm rests
    for (const dx of [-1.6, 1.6]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 2.2), gold);
      arm.position.set(pos[0] + dx, pos[1] + 1.6, pos[2]);
      this.scene.add(arm);
    }
  }

  _spawnFountain({ pos, color = 0x99c7ff }) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.3, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xe8e3d5, roughness: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos[0], 0.3, pos[2]);
    this.scene.add(ring);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.75, emissive: 0x224466, emissiveIntensity: 0.3 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(pos[0], 0.31, pos[2]);
    this.scene.add(water);

    // Central spout
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.4, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 })
    );
    spout.position.set(pos[0], 0.9, pos[2]);
    this.scene.add(spout);
  }

  _spawnTorch({ pos, color = 0xffb347 }) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 })
    );
    pole.position.set(pos[0], pos[1], pos[2]);
    this.scene.add(pole);

    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
    );
    bowl.position.set(pos[0], pos[1] + 1.3, pos[2]);
    this.scene.add(bowl);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.8, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    flame.position.set(pos[0], pos[1] + 1.8, pos[2]);
    this.scene.add(flame);

    const light = new THREE.PointLight(color, 0.8, 12);
    light.position.set(pos[0], pos[1] + 1.7, pos[2]);
    this.scene.add(light);
  }

  _spawnCarpet({ pos, size = [5, 30] }) {
    const [w, l] = size;
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(w, l),
      new THREE.MeshStandardMaterial({ color: 0x8b1a2b, roughness: 0.9 })
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(pos[0], pos[1] || 0.02, pos[2]);
    this.scene.add(carpet);
    // Gold trim
    const trim = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.3, l - 0.3),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.6, emissive: 0x2a1a0a, emissiveIntensity: 0.2 })
    );
    trim.rotation.x = -Math.PI / 2;
    trim.position.set(pos[0], (pos[1] || 0.02) + 0.001, pos[2]);
    this.scene.add(trim);
    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.8, l - 0.8),
      new THREE.MeshStandardMaterial({ color: 0x8b1a2b, roughness: 0.95 })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(pos[0], (pos[1] || 0.02) + 0.002, pos[2]);
    this.scene.add(inner);
  }

  _spawnObelisk({ pos, color = 0xc89560, capColor = 0xffd86b }) {
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 7, 1.2),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    shaft.position.set(pos[0], 3.5, pos[2]);
    this.scene.add(shaft);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.4, metalness: 0.5, emissive: 0x3a2010, emissiveIntensity: 0.25 })
    );
    tip.rotation.y = Math.PI / 4;
    tip.position.set(pos[0], 7.7, pos[2]);
    this.scene.add(tip);
  }

  _spawnPalm({ pos }) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.95 });
    const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2f7a2f, roughness: 0.8, side: THREE.DoubleSide });

    // Trunk: slightly curved stack
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25 - i * 0.02, 0.3 - i * 0.02, 1.2, 10),
        trunkMat
      );
      seg.position.set(pos[0] + i * 0.05, 0.6 + i * 1.15, pos[2]);
      this.scene.add(seg);
    }

    // Leaves (spiky fronds)
    const topY = 6.0;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3.5), leafMat);
      leaf.position.set(pos[0] + 0.25 + Math.cos(a) * 1.4, topY + 0.5, pos[2] + Math.sin(a) * 1.4);
      leaf.rotation.y = a;
      leaf.rotation.x = -0.5;
      this.scene.add(leaf);
    }
  }

  _spawnCrackedStone({ pos, size = [3, 0.6, 3] }) {
    const [sx, sy, sz] = size;
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshStandardMaterial({ color: 0xb07742, roughness: 0.95 })
    );
    stone.position.set(pos[0], sy / 2, pos[2]);
    stone.rotation.y = Math.random() * Math.PI;
    this.scene.add(stone);
  }

  _spawnIceSpike({ pos, height = 5 }) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, height, 6),
      new THREE.MeshStandardMaterial({
        color: 0xa8dcf4, roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.85,
        emissive: 0x1a4a70, emissiveIntensity: 0.3,
      })
    );
    spike.position.set(pos[0], height / 2, pos[2]);
    spike.rotation.y = Math.random() * Math.PI;
    this.scene.add(spike);

    const glow = new THREE.PointLight(0x86ddff, 0.4, 8);
    glow.position.set(pos[0], height * 0.7, pos[2]);
    this.scene.add(glow);
  }

  _spawnWatchtowerCap({ pos, color = 0x86ddff }) {
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 3, 4),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4, emissive: 0x1a4a70, emissiveIntensity: 0.4 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(pos[0], pos[1] + 1.5, pos[2]);
    this.scene.add(roof);
  }

  _spawnPineTree({ pos }) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.9 })
    );
    trunk.position.set(pos[0], 0.75, pos[2]);
    this.scene.add(trunk);

    const pineMat = new THREE.MeshStandardMaterial({ color: 0x1f4a2a, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const r = 1.8 - i * 0.35;
      const h = 1.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), pineMat);
      cone.position.set(pos[0], 1.8 + i * 1.0, pos[2]);
      this.scene.add(cone);
    }

    // Snow cap
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    );
    snow.position.set(pos[0], 5.4, pos[2]);
    this.scene.add(snow);
  }

  _spawnSnow() {
    // Gentle snow particles using Points. Positions rotate around origin on update
    // to suggest drift — simple and cheap.
    const count = 800;
    const geom = new THREE.BufferGeometry();
    const size = this.mapData.size;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * size;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * size;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });
    const snow = new THREE.Points(geom, mat);
    this.scene.add(snow);
  }

  _addCollider(center, size) {
    const half = size.clone().multiplyScalar(0.5);
    this.colliders.push({
      min: center.clone().sub(half),
      max: center.clone().add(half),
    });
  }

  /**
   * Resolve horizontal AABB collision against world colliders. Modifies
   * `nextPos` to be a safe position given `curPos`. Y is handled separately.
   */
  resolveCollision(curPos, nextPos) {
    const r = C.PLAYER_RADIUS;
    const height = C.PLAYER_HEIGHT;

    {
      const test = { x: nextPos.x, y: curPos.y, z: curPos.z };
      if (this._playerHitsAny(test, r, height)) nextPos.x = curPos.x;
    }
    {
      const test = { x: nextPos.x, y: curPos.y, z: nextPos.z };
      if (this._playerHitsAny(test, r, height)) nextPos.z = curPos.z;
    }
  }

  _playerHitsAny(p, r, h) {
    for (const c of this.colliders) {
      if (
        p.x + r > c.min.x && p.x - r < c.max.x &&
        p.y + h > c.min.y && p.y     < c.max.y &&
        p.z + r > c.min.z && p.z - r < c.max.z
      ) return true;
    }
    return false;
  }

  raycastWorld(origin, dir) {
    let best = Infinity;
    for (const c of this.colliders) {
      const t = rayAABB(origin, dir, c.min, c.max);
      if (t !== null && t >= 0 && t < best) best = t;
    }
    return best;
  }
}

function defaultTheme() {
  return {
    style: 'neon',
    skyTop: 0x0a0520, skyBottom: 0x05070d,
    fogColor: 0x05070d, fogNear: 30, fogFar: 120,
    ambient: 0x334466, ambientIntensity: 0.6,
    sunColor: 0xa8d8ff, sunIntensity: 0.9, sunPos: [30, 40, 20],
    groundColor: 0x0a1020, gridColor: 0x00e6ff, gridColor2: 0x0a3040,
    wallColor: 0x1a2338, wallEmissive: 0x00394a, wallEmissiveIntensity: 0.4,
    obstacleColor: 0x1a1530, obstacleEmissive: 0x3a0a44, obstacleEmissiveIntensity: 0.35,
    stripColor: 0x00e6ff, outlineColor: 0xff2bd1,
  };
}

function rayAABB(origin, dir, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    const o = origin[ax], d = dir[ax];
    if (Math.abs(d) < 1e-8) {
      if (o < min[ax] || o > max[ax]) return null;
    } else {
      let t1 = (min[ax] - o) / d;
      let t2 = (max[ax] - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : tmax;
}
