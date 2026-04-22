// Recipes: pattern uses keys mapped to ingredient items.
// '_' = must be empty. Pattern normalized to bounding box before matching.
const RECIPES = [
  {
    id: 'planks',
    pattern: [['L']],
    ingredients: { L: ITEM.LOG },
    result: { item: ITEM.PLANKS, count: 4 },
    desc: '1 Log → 4 Planks',
  },
  {
    id: 'sticks',
    pattern: [['P'], ['P']],
    ingredients: { P: ITEM.PLANKS },
    result: { item: ITEM.STICK, count: 4 },
    desc: '2 Planks → 4 Sticks',
  },
  {
    id: 'wooden_pickaxe',
    pattern: [['P','P','P'], ['_','S','_'], ['_','S','_']],
    ingredients: { P: ITEM.PLANKS, S: ITEM.STICK },
    result: { item: ITEM.WOODEN_PICKAXE, count: 1 },
    desc: '3 Planks + 2 Sticks → Wooden Pickaxe',
  },
  {
    id: 'wooden_axe',
    pattern: [['P','P'], ['P','S'], ['_','S']],
    ingredients: { P: ITEM.PLANKS, S: ITEM.STICK },
    result: { item: ITEM.WOODEN_AXE, count: 1 },
    desc: '3 Planks + 2 Sticks → Wooden Axe',
  },
  {
    id: 'wooden_shovel',
    pattern: [['P'], ['S'], ['S']],
    ingredients: { P: ITEM.PLANKS, S: ITEM.STICK },
    result: { item: ITEM.WOODEN_SHOVEL, count: 1 },
    desc: '1 Plank + 2 Sticks → Wooden Shovel',
  },
];

function normalizeCraftingGrid(grid) {
  // grid[row][col] = item string or null (3×3)
  let r0 = 3, r1 = -1, c0 = 3, c1 = -1;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c]) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
    }
  }
  if (r1 === -1) return null;
  const out = [];
  for (let r = r0; r <= r1; r++) {
    const row = [];
    for (let c = c0; c <= c1; c++) row.push(grid[r][c] || null);
    out.push(row);
  }
  return out;
}

function matchRecipe(grid) {
  const current = normalizeCraftingGrid(grid);
  if (!current) return null;
  for (const recipe of RECIPES) {
    if (patternMatches(current, recipe)) return recipe;
  }
  return null;
}

function patternMatches(current, recipe) {
  const rp = recipe.pattern;
  if (current.length !== rp.length) return false;
  for (let r = 0; r < rp.length; r++) {
    if (current[r].length !== rp[r].length) return false;
    for (let c = 0; c < rp[r].length; c++) {
      const expected = rp[r][c];
      const actual = current[r][c];
      if (expected === '_') { if (actual !== null) return false; }
      else { if (actual !== recipe.ingredients[expected]) return false; }
    }
  }
  return true;
}

function canCraft(recipe, inventory) {
  const needed = {};
  for (const row of recipe.pattern) {
    for (const key of row) {
      if (key && key !== '_') {
        const item = recipe.ingredients[key];
        needed[item] = (needed[item] || 0) + 1;
      }
    }
  }
  for (const [item, count] of Object.entries(needed)) {
    if (inventory.count(item) < count) return false;
  }
  return true;
}

function consumeIngredients(recipe, inventory) {
  const needed = {};
  for (const row of recipe.pattern) {
    for (const key of row) {
      if (key && key !== '_') {
        const item = recipe.ingredients[key];
        needed[item] = (needed[item] || 0) + 1;
      }
    }
  }
  for (const [item, count] of Object.entries(needed)) {
    inventory.remove(item, count);
  }
}
