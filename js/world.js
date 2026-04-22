class World {
  constructor() {
    this.W = 64;
    this.H = 48;
    this.D = 64;
    this.blocks = new Uint8Array(this.W * this.H * this.D);
    this.dirty = true;

    // Three.js objects set by Game
    this.scene = null;
    this.instancedMeshes = {};
    this.MAX_INST = 65536;

    // Shared BoxGeometry vertex layout for face colors
    this._geoCache = {};
  }

  idx(x, y, z) { return x + y * this.W + z * this.W * this.H; }

  get(x, y, z) {
    if (x < 0 || x >= this.W || y < 0 || y >= this.H || z < 0 || z >= this.D) return BLOCK.AIR;
    return this.blocks[this.idx(x, y, z)];
  }

  set(x, y, z, type) {
    if (x < 0 || x >= this.W || y < 0 || y >= this.H || z < 0 || z >= this.D) return;
    this.blocks[this.idx(x, y, z)] = type;
    this.dirty = true;
  }

  isOpaque(x, y, z) {
    const b = this.get(x, y, z);
    return b !== BLOCK.AIR;
  }

  // Returns true if any adjacent face is exposed to air (worth rendering)
  isVisible(x, y, z) {
    return !this.isOpaque(x+1,y,z) || !this.isOpaque(x-1,y,z) ||
           !this.isOpaque(x,y+1,z) || !this.isOpaque(x,y-1,z) ||
           !this.isOpaque(x,y,z+1) || !this.isOpaque(x,y,z-1);
  }

  generate(seed) {
    const noise = new SimplexNoise(seed || 42);
    const { W, D } = this;

    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const nx = x / 28, nz = z / 28;
        const n = noise.octave(nx, nz, 5, 0.5, 2.0);
        const height = Math.floor(10 + n * 9);

        for (let y = 0; y <= height; y++) {
          let b;
          if (y === height) {
            b = height <= 7 ? BLOCK.SAND : BLOCK.GRASS;
          } else if (y >= height - 3) {
            b = height <= 7 ? BLOCK.SAND : BLOCK.DIRT;
          } else {
            b = BLOCK.STONE;
          }
          this.set(x, y, z, b);
        }

        // Trees: only on grass, with spacing to avoid clustering
        if (height > 7 && height < 22) {
          const tr = noise.noise(x * 3.7, z * 3.7);
          if (tr > 0.72) this._tree(x, height + 1, z);
        }
      }
    }
    this.dirty = true;
  }

  _tree(x, y, z) {
    const h = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < h; i++) this.set(x, y + i, z, BLOCK.LOG);
    const top = y + h;
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let ly = -1; ly <= 2; ly++) {
          if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly) > 3) continue;
          if (lx === 0 && lz === 0 && ly < 0) continue;
          if (this.get(x+lx, top+ly, z+lz) === BLOCK.AIR) {
            this.set(x+lx, top+ly, z+lz, BLOCK.LEAVES);
          }
        }
      }
    }
  }

  _makeBlockGeo(blockType) {
    if (this._geoCache[blockType]) return this._geoCache[blockType];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const bc = BLOCK_COLORS[blockType];
    if (!bc) { this._geoCache[blockType] = geo; return geo; }

    // BoxGeometry face order: +X,-X,+Y,-Y,+Z,-Z (4 verts each = 24 total)
    const faceColors = [
      bc.side,   // +X
      bc.side,   // -X
      bc.top,    // +Y
      bc.bottom, // -Y
      bc.side,   // +Z
      bc.side,   // -Z
    ];
    // Side shading multipliers
    const shades = [0.85, 0.85, 1.0, 0.5, 0.9, 0.9];

    const colors = new Float32Array(24 * 3);
    for (let f = 0; f < 6; f++) {
      const [r, g, b] = faceColors[f];
      const s = shades[f];
      for (let v = 0; v < 4; v++) {
        const i = (f * 4 + v) * 3;
        colors[i]   = r * s;
        colors[i+1] = g * s;
        colors[i+2] = b * s;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this._geoCache[blockType] = geo;
    return geo;
  }

  initScene(scene) {
    this.scene = scene;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });

    for (const [key, type] of Object.entries(BLOCK)) {
      if (type === BLOCK.AIR) continue;
      const geo = this._makeBlockGeo(type);
      const mesh = new THREE.InstancedMesh(geo, mat.clone(), this.MAX_INST);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      scene.add(mesh);
      this.instancedMeshes[type] = mesh;
    }
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;

    // Bucket visible blocks by type
    const buckets = {};
    for (const type of Object.values(BLOCK)) {
      if (type !== BLOCK.AIR) buckets[type] = [];
    }

    for (let x = 0; x < this.W; x++) {
      for (let y = 0; y < this.H; y++) {
        for (let z = 0; z < this.D; z++) {
          const b = this.get(x, y, z);
          if (b === BLOCK.AIR) continue;
          if (this.isVisible(x, y, z)) buckets[b].push(x, y, z);
        }
      }
    }

    const mat4 = new THREE.Matrix4();
    for (const [typeStr, coords] of Object.entries(buckets)) {
      const type = parseInt(typeStr);
      const mesh = this.instancedMeshes[type];
      if (!mesh) continue;
      const count = coords.length / 3;
      mesh.count = count;
      for (let i = 0; i < count; i++) {
        const x = coords[i*3], y = coords[i*3+1], z = coords[i*3+2];
        mat4.setPosition(x + 0.5, y + 0.5, z + 0.5);
        mesh.setMatrixAt(i, mat4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Returns all mesh objects (for raycasting)
  getMeshes() {
    return Object.values(this.instancedMeshes);
  }

  // Given a raycaster hit, return the block coords
  hitToBlock(hit) {
    const mat = new THREE.Matrix4();
    hit.object.getMatrixAt(hit.instanceId, mat);
    const pos = new THREE.Vector3().setFromMatrixPosition(mat);
    return {
      x: Math.round(pos.x - 0.5),
      y: Math.round(pos.y - 0.5),
      z: Math.round(pos.z - 0.5),
    };
  }

  // Block adjacent to hit face (for placement)
  hitToPlace(hit) {
    const b = this.hitToBlock(hit);
    const n = hit.face.normal;
    return {
      x: b.x + Math.round(n.x),
      y: b.y + Math.round(n.y),
      z: b.z + Math.round(n.z),
    };
  }

  spawnHeight(x, z) {
    for (let y = this.H - 1; y >= 0; y--) {
      if (this.get(x, y, z) !== BLOCK.AIR) return y + 2;
    }
    return 20;
  }
}
