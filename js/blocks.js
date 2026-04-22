const BLOCK = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAVES: 5, PLANKS: 6, SAND: 7 };

const ITEM = {
  DIRT: 'dirt', STONE: 'stone', LOG: 'log', LEAVES: 'leaves',
  PLANKS: 'planks', SAND: 'sand',
  STICK: 'stick',
  WOODEN_AXE: 'wooden_axe',
  WOODEN_SHOVEL: 'wooden_shovel',
  WOODEN_PICKAXE: 'wooden_pickaxe',
};

// Per-face colors: [r,g,b] × {top, side, bottom}
const BLOCK_COLORS = {
  [BLOCK.GRASS]: {
    top:    [0.36, 0.76, 0.27],
    side:   [0.48, 0.68, 0.32],
    bottom: [0.56, 0.39, 0.22],
  },
  [BLOCK.DIRT]: {
    top: [0.56, 0.39, 0.22], side: [0.56, 0.39, 0.22], bottom: [0.56, 0.39, 0.22],
  },
  [BLOCK.STONE]: {
    top: [0.55, 0.55, 0.55], side: [0.50, 0.50, 0.50], bottom: [0.45, 0.45, 0.45],
  },
  [BLOCK.LOG]: {
    top: [0.66, 0.59, 0.38], side: [0.42, 0.28, 0.14], bottom: [0.66, 0.59, 0.38],
  },
  [BLOCK.LEAVES]: {
    top: [0.18, 0.55, 0.18], side: [0.18, 0.52, 0.18], bottom: [0.14, 0.46, 0.14],
  },
  [BLOCK.PLANKS]: {
    top: [0.74, 0.60, 0.36], side: [0.72, 0.57, 0.33], bottom: [0.68, 0.53, 0.30],
  },
  [BLOCK.SAND]: {
    top: [0.84, 0.80, 0.56], side: [0.82, 0.77, 0.52], bottom: [0.80, 0.74, 0.50],
  },
};

const BLOCK_PROPS = {
  [BLOCK.GRASS]:  { name: 'Grass',  hardness: 0.6, tool: null,      drops: [{ item: ITEM.DIRT,   count: 1 }] },
  [BLOCK.DIRT]:   { name: 'Dirt',   hardness: 0.5, tool: 'shovel',  drops: [{ item: ITEM.DIRT,   count: 1 }] },
  [BLOCK.STONE]:  { name: 'Stone',  hardness: 1.5, tool: 'pickaxe', drops: [{ item: ITEM.STONE,  count: 1 }] },
  [BLOCK.LOG]:    { name: 'Log',    hardness: 2.0, tool: 'axe',     drops: [{ item: ITEM.LOG,    count: 1 }] },
  [BLOCK.LEAVES]: { name: 'Leaves', hardness: 0.2, tool: null,      drops: [] },
  [BLOCK.PLANKS]: { name: 'Planks', hardness: 2.0, tool: 'axe',     drops: [{ item: ITEM.PLANKS, count: 1 }] },
  [BLOCK.SAND]:   { name: 'Sand',   hardness: 0.5, tool: 'shovel',  drops: [{ item: ITEM.SAND,   count: 1 }] },
};

// Item → place as block
const ITEM_TO_BLOCK = {
  [ITEM.DIRT]:   BLOCK.DIRT,
  [ITEM.STONE]:  BLOCK.STONE,
  [ITEM.LOG]:    BLOCK.LOG,
  [ITEM.LEAVES]: BLOCK.LEAVES,
  [ITEM.PLANKS]: BLOCK.PLANKS,
  [ITEM.SAND]:   BLOCK.SAND,
};

const ITEM_PROPS = {
  [ITEM.DIRT]:           { name: 'Dirt',           color: '#8B6340', isBlock: true },
  [ITEM.STONE]:          { name: 'Stone',           color: '#888888', isBlock: true },
  [ITEM.LOG]:            { name: 'Log',             color: '#6B4718', isBlock: true },
  [ITEM.LEAVES]:         { name: 'Leaves',          color: '#2E8B2E', isBlock: true },
  [ITEM.PLANKS]:         { name: 'Planks',          color: '#BF9855', isBlock: true },
  [ITEM.SAND]:           { name: 'Sand',            color: '#D6CB8A', isBlock: true },
  [ITEM.STICK]:          { name: 'Stick',           color: '#A0784A', isBlock: false },
  [ITEM.WOODEN_AXE]:     { name: 'Wooden Axe',      color: '#C8A060', isBlock: false, tool: 'axe',     speed: 2.0 },
  [ITEM.WOODEN_SHOVEL]:  { name: 'Wooden Shovel',   color: '#C8A060', isBlock: false, tool: 'shovel',  speed: 2.0 },
  [ITEM.WOODEN_PICKAXE]: { name: 'Wooden Pickaxe',  color: '#C8A060', isBlock: false, tool: 'pickaxe', speed: 2.0 },
};
