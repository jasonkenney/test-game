class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // sky
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

    this.ui = new UI(this.player, this.world);

    this.locked = false;
    this.lastTime = performance.now();

    this._setupEvents();
    this._loop();
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff8e0, 0.9);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 250;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    this.scene.add(sun);
  }

  _setupEvents() {
    // Pointer lock
    document.getElementById('start-btn').addEventListener('click', () => {
      this.canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      document.getElementById('overlay').classList.toggle('hidden', this.locked);
      if (!this.locked) this.ui.closeInventory();
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.player.yaw   -= e.movementX * 0.002;
      this.player.pitch -= e.movementY * 0.002;
      this.player.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.player.pitch));
    });

    // Mouse buttons
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.player.startBreaking();
      if (e.button === 2) this.player.placeBlock(this.world.getMeshes());
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.stopBreaking();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Scroll wheel for hotbar
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.player.inventory.scrollHotbar(e.deltaY > 0 ? 1 : -1);
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.player.keys[e.code] = true;
      if (e.code === 'Space' && this.locked) { e.preventDefault(); this.player.jump(); }
      if (e.code === 'KeyE' && this.locked) {
        this.ui.toggleInventory();
        if (this.ui.open) document.exitPointerLock();
        else this.canvas.requestPointerLock();
      }
      if (e.code === 'KeyR' && this.locked) this.ui.showRecipes();
      if (e.code === 'Escape') {
        if (this.ui.open) { this.ui.closeInventory(); this.canvas.requestPointerLock(); }
      }
      // Number keys 1-9
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        this.player.inventory.selectSlot(parseInt(e.code.slice(-1)) - 1);
      }
    });
    document.addEventListener('keyup', (e) => { this.player.keys[e.code] = false; });

    // Resize
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.player.camera.aspect = window.innerWidth / window.innerHeight;
      this.player.camera.updateProjectionMatrix();
    });
  }

  _loop() {
    requestAnimationFrame(() => this._loop());

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.locked || this.ui.open) {
      this.player.update(dt);
    }

    this.world.update();

    const hit = this.locked ? this.player.getLookTarget(this.world.getMeshes()) : null;
    this.ui.updateHUD(hit, this.world.getMeshes());

    this.renderer.render(this.scene, this.player.camera);
  }
}

window.addEventListener('load', () => { new Game(); });
