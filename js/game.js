class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 40, 140);

    this._setupLights();

    this.world = new World();
    this.world.generate(Math.floor(Math.random() * 9999));
    this.world.initScene(this.scene);
    this.world.update();

    this.player = new Player(this.world);
    const sx = Math.floor(this.world.W / 2);
    const sz = Math.floor(this.world.D / 2);
    this.player.pos.set(sx + 0.5, this.world.spawnHeight(sx, sz), sz + 0.5);

    this.ui = new UI(this.player, this.world, this.canvas);

    this._setupBlockVisuals();

    this.locked = false;
    this.gameStarted = false;
    this.time = 0;
    this.lastTime = performance.now();

    this._setupEvents();
    this._loop();
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const sun = new THREE.DirectionalLight(0xfff8e0, 0.9);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 250;
    const sc = sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80;
    this.scene.add(sun);
  }

  _setupBlockVisuals() {
    // Selection outline: always shown on the hovered block
    const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
    this.selectionBox = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 })
    );
    this.selectionBox.visible = false;
    this.selectionBox.renderOrder = 1;
    this.scene.add(this.selectionBox);

    // Break overlay: darkens and wobbles as the block is broken
    this.breakOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.breakOverlay.visible = false;
    this.breakOverlay.renderOrder = 2;
    this.scene.add(this.breakOverlay);
  }

  _setupEvents() {
    document.getElementById('start-btn').addEventListener('click', () => {
      this.canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === this.canvas;

      if (this.locked) {
        this.gameStarted = true;
        document.getElementById('overlay').classList.add('hidden');
      } else if (wasLocked && !this.ui.open) {
        // Lost lock without a UI panel open (browser Escape or alt-tab) → show menu
        this.ui.showMenu();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.player.yaw   -= e.movementX * 0.002;
      this.player.pitch -= e.movementY * 0.002;
      this.player.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.player.pitch));
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.player.startBreaking();
      if (e.button === 2) this.player.placeBlock(this.world.getMeshes());
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.stopBreaking();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.player.inventory.scrollHotbar(e.deltaY > 0 ? 1 : -1);
    });

    document.addEventListener('keydown', (e) => {
      this.player.keys[e.code] = true;

      if (e.code === 'Space' && this.locked) { e.preventDefault(); this.player.jump(); }

      if (e.code === 'KeyE') {
        if (this.locked) {
          // Open game menu and release pointer lock
          this.ui.showMenu();
          document.exitPointerLock();
        } else if (this.ui.inventoryOpen) {
          // E in inventory → back to menu
          this.ui._closeInventory();
          this.ui.showMenu();
        } else if (this.ui.menuOpen) {
          // E in menu → resume
          this.ui.closeAll();
          this.canvas.requestPointerLock();
        }
      }

      if (e.code === 'Escape') {
        if (this.ui.inventoryOpen) {
          this.ui._closeInventory();
          this.ui.showMenu();
        }
        // Menu case: browser already released lock → pointerlockchange opens menu
      }

      if (e.code === 'KeyR') this.ui.showRecipes();

      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        this.player.inventory.selectSlot(parseInt(e.code.slice(-1)) - 1);
      }
    });
    document.addEventListener('keyup', (e) => { this.player.keys[e.code] = false; });

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.player.camera.aspect = window.innerWidth / window.innerHeight;
      this.player.camera.updateProjectionMatrix();
    });
  }

  _updateBlockVisuals(hit) {
    // Selection outline
    if (hit) {
      const b = this.world.hitToBlock(hit);
      this.selectionBox.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      this.selectionBox.visible = true;
    } else {
      this.selectionBox.visible = false;
    }

    // Break overlay — darkens and pulses to show damage
    const bt = this.player.breakTarget;
    if (bt && this.player.mouseHeld) {
      const p = this.player.breakProgress; // 0..1
      // Opacity ramps from 0 → 0.55 with progress
      const opacity = p * 0.55;
      // Scale pulses faster and wider as block gets more damaged
      const pulse = Math.sin(this.time * 18) * 0.028 * p;
      const scale = 1.0 + pulse;

      this.breakOverlay.position.set(bt.x + 0.5, bt.y + 0.5, bt.z + 0.5);
      this.breakOverlay.scale.setScalar(scale);
      this.breakOverlay.material.opacity = opacity;
      this.breakOverlay.visible = true;
    } else {
      this.breakOverlay.visible = false;
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.time += dt;

    if (this.locked || this.ui.open) {
      this.player.update(dt);
    }

    this.world.update();

    const hit = this.locked ? this.player.getLookTarget(this.world.getMeshes()) : null;
    this._updateBlockVisuals(hit);
    this.ui.updateHUD(hit);

    this.renderer.render(this.scene, this.player.camera);
  }
}

window.addEventListener('load', () => { new Game(); });
