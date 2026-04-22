class Inventory {
  constructor() {
    // 9 hotbar + 27 main = 36 slots. Each: {item, count} or null
    this.slots = new Array(36).fill(null);
    this.hotbarSlot = 0;
  }

  add(item, count) {
    // Stack with existing
    for (let i = 0; i < 36; i++) {
      if (this.slots[i] && this.slots[i].item === item) {
        this.slots[i].count += count;
        return;
      }
    }
    // Empty slot
    for (let i = 0; i < 36; i++) {
      if (!this.slots[i]) { this.slots[i] = { item, count }; return; }
    }
  }

  remove(item, count) {
    let remaining = count;
    for (let i = 0; i < 36 && remaining > 0; i++) {
      if (this.slots[i] && this.slots[i].item === item) {
        const take = Math.min(this.slots[i].count, remaining);
        this.slots[i].count -= take;
        remaining -= take;
        if (this.slots[i].count === 0) this.slots[i] = null;
      }
    }
  }

  count(item) {
    let total = 0;
    for (const s of this.slots) { if (s && s.item === item) total += s.count; }
    return total;
  }

  hotbarItem() { return this.slots[this.hotbarSlot]; }

  selectSlot(n) { this.hotbarSlot = Math.max(0, Math.min(8, n)); }

  scrollHotbar(delta) {
    this.hotbarSlot = ((this.hotbarSlot + delta) % 9 + 9) % 9;
  }
}

class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3(32, 20, 32);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;

    this.WIDTH = 0.6;
    this.HEIGHT = 1.8;

    this.GRAVITY = -28;
    this.JUMP_VEL = 9;
    this.WALK_SPEED = 5.0;
    this.REACH = 5.0;

    this.keys = {};
    this.inventory = new Inventory();

    // Breaking state
    this.breaking = false;
    this.breakProgress = 0;   // 0..1
    this.breakTarget = null;  // {x,y,z}
    this.breakTime = 0;       // seconds to break

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = this.REACH;

    this._lastLook = null; // {x,y,z} of looked-at block
  }

  update(dt) {
    this._move(dt);
    this._updateBreaking(dt);
    this._updateCamera();
  }

  _move(dt) {
    const yawQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQ);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ);

    const move = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    move.addScaledVector(fwd, 1);
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  move.addScaledVector(fwd, -1);
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  move.addScaledVector(right, -1);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.addScaledVector(right, 1);

    if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.WALK_SPEED);

    this.vel.x = move.x;
    this.vel.z = move.z;
    this.vel.y += this.GRAVITY * dt;

    this._collide(dt);
  }

  _collide(dt) {
    const hw = this.WIDTH / 2;
    const steps = ['x','y','z'];
    const delta = [this.vel.x * dt, this.vel.y * dt, this.vel.z * dt];

    this.onGround = false;

    for (let axis = 0; axis < 3; axis++) {
      const d = delta[axis];
      if (d === 0) continue;

      const next = this.pos.clone();
      next[steps[axis]] += d;

      if (this._overlapsWorld(next, hw)) {
        if (axis === 1) {
          if (d < 0) this.onGround = true;
          this.vel.y = 0;
        } else {
          this.vel[steps[axis]] = 0;
        }
      } else {
        this.pos[steps[axis]] += d;
      }
    }

    // World boundary clamp
    this.pos.x = Math.max(hw, Math.min(this.world.W - hw, this.pos.x));
    this.pos.z = Math.max(hw, Math.min(this.world.D - hw, this.pos.z));
    if (this.pos.y < -5) {
      this.pos.y = this.world.spawnHeight(Math.floor(this.pos.x), Math.floor(this.pos.z));
      this.vel.set(0,0,0);
    }
  }

  _overlapsWorld(pos, hw) {
    const minX = pos.x - hw, maxX = pos.x + hw;
    const minY = pos.y,       maxY = pos.y + this.HEIGHT;
    const minZ = pos.z - hw, maxZ = pos.z + hw;

    for (let x = Math.floor(minX); x <= Math.floor(maxX - 0.001); x++) {
      for (let y = Math.floor(minY); y <= Math.floor(maxY - 0.001); y++) {
        for (let z = Math.floor(minZ); z <= Math.floor(maxZ - 0.001); z++) {
          if (this.world.get(x, y, z) !== BLOCK.AIR) return true;
        }
      }
    }
    return false;
  }

  jump() {
    if (this.onGround) this.vel.y = this.JUMP_VEL;
  }

  _updateCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + this.HEIGHT - 0.1, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getLookTarget(meshes) {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(meshes, false);
    return hits.length > 0 ? hits[0] : null;
  }

  _updateBreaking(dt) {
    if (!this.breaking || !this.breakTarget) return;

    const hit = this.getLookTarget(this.world.getMeshes());
    if (!hit) { this._cancelBreak(); return; }

    const b = this.world.hitToBlock(hit);
    if (b.x !== this.breakTarget.x || b.y !== this.breakTarget.y || b.z !== this.breakTarget.z) {
      this._cancelBreak();
      this._startBreak(b, hit);
      return;
    }

    this.breakProgress += dt / this.breakTime;
    if (this.breakProgress >= 1) {
      this._finishBreak(b);
    }
  }

  startBreaking() {
    this.breaking = true;
    const hit = this.getLookTarget(this.world.getMeshes());
    if (!hit) return;
    const b = this.world.hitToBlock(hit);
    this._startBreak(b, hit);
  }

  _startBreak(b, hit) {
    const blockType = this.world.get(b.x, b.y, b.z);
    if (blockType === BLOCK.AIR) return;
    this.breakTarget = b;
    this.breakProgress = 0;

    const props = BLOCK_PROPS[blockType];
    let hardness = props ? props.hardness : 1.0;

    // Tool speed multiplier
    const held = this.inventory.hotbarItem();
    if (held && ITEM_PROPS[held.item]) {
      const ip = ITEM_PROPS[held.item];
      if (ip.tool && props && props.tool === ip.tool) {
        hardness /= ip.speed;
      }
    }
    this.breakTime = hardness;
  }

  _cancelBreak() {
    this.breakTarget = null;
    this.breakProgress = 0;
  }

  stopBreaking() {
    this.breaking = false;
    this._cancelBreak();
  }

  _finishBreak(b) {
    const blockType = this.world.get(b.x, b.y, b.z);
    const props = BLOCK_PROPS[blockType];
    if (props && props.drops) {
      for (const drop of props.drops) {
        this.inventory.add(drop.item, drop.count);
      }
    }
    this.world.set(b.x, b.y, b.z, BLOCK.AIR);
    this.breaking = false;
    this._cancelBreak();
  }

  placeBlock(meshes) {
    const hit = this.getLookTarget(meshes);
    if (!hit) return;

    const place = this.world.hitToPlace(hit);
    const held = this.inventory.hotbarItem();
    if (!held) return;

    const blockType = ITEM_TO_BLOCK[held.item];
    if (!blockType) return;

    // Don't place inside the player
    const hw = this.WIDTH / 2;
    const px = place.x + 0.5, py = place.y + 0.5, pz = place.z + 0.5;
    if (Math.abs(px - this.pos.x) < hw + 0.5 &&
        py > this.pos.y - 0.5 && py < this.pos.y + this.HEIGHT + 0.5 &&
        Math.abs(pz - this.pos.z) < hw + 0.5) return;

    if (this.world.get(place.x, place.y, place.z) !== BLOCK.AIR) return;

    this.world.set(place.x, place.y, place.z, blockType);
    this.inventory.remove(held.item, 1);
  }
}
