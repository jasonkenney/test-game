class UI {
  constructor(player, world) {
    this.player = player;
    this.world = world;
    this.inv = player.inventory;
    this.open = false;

    // Crafting grid: 3×3 array of item strings or null
    this.craftGrid = Array.from({length: 3}, () => Array(3).fill(null));
    this.heldItem = null; // {item, count} picked up in inventory screen

    this._buildHotbar();
    this._buildInventoryScreen();
    this._buildCursorItem();
    this._bindCraftButtons();
  }

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
    for (let i = 9; i < 36; i++) {
      const slot = this._makeInvSlot(i);
      ig.appendChild(slot);
    }

    // Hotbar in inventory screen (slots 0-8)
    const hi = document.getElementById('hotbar-inv');
    hi.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = this._makeInvSlot(i);
      hi.appendChild(slot);
    }
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

  _bindCraftButtons() {
    document.getElementById('craft-btn').addEventListener('click', () => this._doCraft());
  }

  _clickInvSlot(index) {
    if (!this.heldItem) {
      // Pick up
      if (this.inv.slots[index]) {
        this.heldItem = this.inv.slots[index];
        this.inv.slots[index] = null;
      }
    } else {
      // Place or swap
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
      // Pick up from craft grid
      const existing = this.craftGrid[r][c];
      if (existing) {
        this.heldItem = { item: existing, count: 1 };
        this.craftGrid[r][c] = null;
      }
    } else {
      // Place one into craft grid (only block/item items make sense)
      this.craftGrid[r][c] = this.heldItem.item;
      this.heldItem.count--;
      if (this.heldItem.count <= 0) this.heldItem = null;
    }
    this.refreshInventory();
  }

  _doCraft() {
    const recipe = matchRecipe(this.craftGrid);
    if (!recipe) return;
    if (!canCraft(recipe, this.inv)) return;
    consumeIngredients(recipe, this.inv);
    this.inv.add(recipe.result.item, recipe.result.count);
    this.craftGrid = Array.from({length: 3}, () => Array(3).fill(null));
    this.refreshInventory();
  }

  toggleInventory() {
    this.open = !this.open;
    const screen = document.getElementById('inventory-screen');
    screen.classList.toggle('hidden', !this.open);
    if (!this.open) {
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
      this.refreshInventory();
    }
  }

  closeInventory() {
    if (this.open) this.toggleInventory();
  }

  refreshAll() {
    this._refreshHotbar();
    if (this.open) this.refreshInventory();
  }

  _refreshHotbar() {
    const slots = document.querySelectorAll('.hotbar-slot');
    slots.forEach((slot, i) => {
      slot.classList.toggle('selected', i === this.inv.hotbarSlot);
      this._renderSlotContent(slot, this.inv.slots[i]);
    });
  }

  refreshInventory() {
    // Inventory slots
    document.querySelectorAll('.inv-slot').forEach(el => {
      const idx = parseInt(el.dataset.index);
      this._renderSlotContent(el, this.inv.slots[idx]);
    });

    // Crafting grid
    document.querySelectorAll('.craft-slot').forEach(el => {
      const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
      const item = this.craftGrid[r][c];
      this._renderSlotContent(el, item ? { item, count: 1 } : null);
    });

    // Crafting result preview
    const resultSlot = document.getElementById('crafting-result');
    const recipe = matchRecipe(this.craftGrid);
    if (recipe && canCraft(recipe, this.inv)) {
      this._renderSlotContent(resultSlot, recipe.result);
      resultSlot.classList.add('craftable');
    } else if (recipe) {
      this._renderSlotContent(resultSlot, recipe.result);
      resultSlot.classList.remove('craftable');
      resultSlot.style.opacity = '0.4';
    } else {
      this._renderSlotContent(resultSlot, null);
      resultSlot.classList.remove('craftable');
      resultSlot.style.opacity = '';
    }

    // Cursor item
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

    if (slotData.count > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.textContent = slotData.count;
      el.appendChild(cnt);
    }

    el.title = props.name;
  }

  updateHUD(hit, meshes) {
    // Look info
    const lookEl = document.getElementById('look-info');
    if (hit) {
      const b = this.world.hitToBlock(hit);
      const blockType = this.world.get(b.x, b.y, b.z);
      const props = BLOCK_PROPS[blockType];
      lookEl.textContent = props ? props.name : '';
    } else {
      lookEl.textContent = '';
    }

    // Break progress
    const indicator = document.getElementById('break-indicator');
    const bar = document.getElementById('break-bar');
    if (this.player.breaking && this.player.breakTarget) {
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
