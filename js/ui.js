class UI {
  constructor(player, world, canvas) {
    this.player = player;
    this.world = world;
    this.inv = player.inventory;
    this.canvas = canvas;

    this.menuOpen = false;
    this.inventoryOpen = false;

    // Crafting grid: 3×3 array of item strings or null
    this.craftGrid = Array.from({length: 3}, () => Array(3).fill(null));
    this.heldItem = null; // {item, count} picked up in inventory screen

    this._buildHotbar();
    this._buildInventoryScreen();
    this._buildCursorItem();
    this._bindButtons();
  }

  // True when any overlay is open (used by game loop for player update)
  get open() { return this.menuOpen || this.inventoryOpen; }

  // ── Build DOM ──────────────────────────────────────────────────────────────

  _buildHotbar() {
    const hotbar = document.getElementById('hotbar');
    hotbar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.dataset.slot = i;
      hotbar.appendChild(slot);
    }
  }

  _buildInventoryScreen() {
    // Crafting grid cells
    const cg = document.getElementById('crafting-grid');
    cg.innerHTML = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = document.createElement('div');
        cell.className = 'slot craft-slot';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', () => this._clickCraftSlot(r, c));
        cg.appendChild(cell);
      }
    }

    // Inventory grid (27 slots, rows 9-35)
    const ig = document.getElementById('inventory-grid');
    ig.innerHTML = '';
    for (let i = 9; i < 36; i++) ig.appendChild(this._makeInvSlot(i));

    // Hotbar in inventory screen (slots 0-8)
    const hi = document.getElementById('hotbar-inv');
    hi.innerHTML = '';
    for (let i = 0; i < 9; i++) hi.appendChild(this._makeInvSlot(i));
  }

  _makeInvSlot(index) {
    const slot = document.createElement('div');
    slot.className = 'slot inv-slot';
    slot.dataset.index = index;
    slot.addEventListener('click', () => this._clickInvSlot(index));
    return slot;
  }

  _buildCursorItem() {
    const el = document.createElement('div');
    el.id = 'cursor-item';
    el.className = 'slot cursor-floating hidden';
    document.body.appendChild(el);
    document.addEventListener('mousemove', (e) => {
      el.style.left = (e.clientX + 4) + 'px';
      el.style.top  = (e.clientY + 4) + 'px';
    });
  }

  _bindButtons() {
    document.getElementById('craft-btn').addEventListener('click', () => this._doCraft());

    document.getElementById('menu-resume').addEventListener('click', () => {
      this.closeAll();
      this.canvas.requestPointerLock();
    });
    document.getElementById('menu-inventory').addEventListener('click', () => {
      this.openInventory();
    });
    document.getElementById('menu-recipes').addEventListener('click', () => {
      this.showRecipes();
    });
    document.getElementById('inv-back-btn').addEventListener('click', () => {
      this._closeInventory();
      this.showMenu();
    });
  }

  // ── Menu control ───────────────────────────────────────────────────────────

  showMenu() {
    this.menuOpen = true;
    document.getElementById('game-menu').classList.remove('hidden');
  }

  hideMenu() {
    this.menuOpen = false;
    document.getElementById('game-menu').classList.add('hidden');
  }

  toggleMenu() {
    if (this.menuOpen) this.hideMenu();
    else this.showMenu();
  }

  openInventory() {
    this.hideMenu();
    this.inventoryOpen = true;
    document.getElementById('inventory-screen').classList.remove('hidden');
    this.refreshInventory();
  }

  _closeInventory() {
    // Return held item to inventory
    if (this.heldItem) {
      this.inv.add(this.heldItem.item, this.heldItem.count);
      this.heldItem = null;
    }
    // Return crafting grid items
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.craftGrid[r][c]) {
          this.inv.add(this.craftGrid[r][c], 1);
          this.craftGrid[r][c] = null;
        }
      }
    }
    this.inventoryOpen = false;
    document.getElementById('inventory-screen').classList.add('hidden');
    this.refreshInventory();
  }

  closeAll() {
    if (this.inventoryOpen) this._closeInventory();
    if (this.menuOpen) this.hideMenu();
  }

  // ── Inventory interaction ──────────────────────────────────────────────────

  _clickInvSlot(index) {
    if (!this.heldItem) {
      if (this.inv.slots[index]) {
        this.heldItem = this.inv.slots[index];
        this.inv.slots[index] = null;
      }
    } else {
      const existing = this.inv.slots[index];
      if (existing && existing.item === this.heldItem.item) {
        existing.count += this.heldItem.count;
        this.heldItem = null;
      } else {
        this.inv.slots[index] = this.heldItem;
        this.heldItem = existing;
      }
    }
    this.refreshInventory();
  }

  _clickCraftSlot(r, c) {
    if (!this.heldItem) {
      const existing = this.craftGrid[r][c];
      if (existing) {
        this.heldItem = { item: existing, count: 1 };
        this.craftGrid[r][c] = null;
      }
    } else {
      this.craftGrid[r][c] = this.heldItem.item;
      this.heldItem.count--;
      if (this.heldItem.count <= 0) this.heldItem = null;
    }
    this.refreshInventory();
  }

  _doCraft() {
    const recipe = matchRecipe(this.craftGrid);
    if (!recipe || !canCraft(recipe, this.inv)) return;
    consumeIngredients(recipe, this.inv);
    this.inv.add(recipe.result.item, recipe.result.count);
    this.craftGrid = Array.from({length: 3}, () => Array(3).fill(null));
    this.refreshInventory();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _refreshHotbar() {
    const slots = document.querySelectorAll('.hotbar-slot');
    slots.forEach((slot, i) => {
      slot.classList.toggle('selected', i === this.inv.hotbarSlot);
      this._renderSlotContent(slot, this.inv.slots[i]);
    });
  }

  refreshInventory() {
    document.querySelectorAll('.inv-slot').forEach(el => {
      this._renderSlotContent(el, this.inv.slots[parseInt(el.dataset.index)]);
    });

    document.querySelectorAll('.craft-slot').forEach(el => {
      const item = this.craftGrid[parseInt(el.dataset.r)][parseInt(el.dataset.c)];
      this._renderSlotContent(el, item ? { item, count: 1 } : null);
    });

    // Crafting result preview
    const resultSlot = document.getElementById('crafting-result');
    const recipe = matchRecipe(this.craftGrid);
    if (recipe && canCraft(recipe, this.inv)) {
      this._renderSlotContent(resultSlot, recipe.result);
      resultSlot.classList.add('craftable');
      resultSlot.style.opacity = '';
    } else if (recipe) {
      this._renderSlotContent(resultSlot, recipe.result);
      resultSlot.classList.remove('craftable');
      resultSlot.style.opacity = '0.4';
    } else {
      this._renderSlotContent(resultSlot, null);
      resultSlot.classList.remove('craftable');
      resultSlot.style.opacity = '';
    }

    // Floating cursor item
    const cursor = document.getElementById('cursor-item');
    if (this.heldItem) {
      this._renderSlotContent(cursor, this.heldItem);
      cursor.classList.remove('hidden');
    } else {
      cursor.classList.add('hidden');
    }

    this._refreshHotbar();
  }

  _renderSlotContent(el, slotData) {
    el.innerHTML = '';
    el.style.opacity = '';
    if (!slotData) return;

    const props = ITEM_PROPS[slotData.item];
    if (!props) return;

    const icon = document.createElement('div');
    icon.className = 'slot-icon';
    icon.style.background = props.color || '#888';
    el.appendChild(icon);

    // Always show count
    const cnt = document.createElement('span');
    cnt.className = 'slot-count';
    cnt.textContent = slotData.count;
    el.appendChild(cnt);

    el.title = props.name;
  }

  updateHUD(hit) {
    // Block name tooltip
    const lookEl = document.getElementById('look-info');
    if (hit) {
      const b = this.world.hitToBlock(hit);
      const props = BLOCK_PROPS[this.world.get(b.x, b.y, b.z)];
      lookEl.textContent = props ? props.name : '';
    } else {
      lookEl.textContent = '';
    }

    // Break progress bar
    const indicator = document.getElementById('break-indicator');
    const bar = document.getElementById('break-bar');
    if (this.player.mouseHeld && this.player.breakTarget) {
      indicator.classList.remove('hidden');
      bar.style.width = (this.player.breakProgress * 100) + '%';
    } else {
      indicator.classList.add('hidden');
    }

    this._refreshHotbar();
  }

  showRecipes() {
    const lines = RECIPES.map(r => r.desc).join('\n');
    alert('Recipes:\n' + lines);
  }
}
