const boxes = [];

// Adds one collision and line of sight box to the shared map list.
function box(x, z, w, d, h = 3, type = 'wall') {
  boxes.push({ x, z, w, d, h, type });
}

box(0, -26, 70, 1, 4);
box(0, 26, 70, 1, 4);
box(-35, 0, 1, 52, 4);
box(35, 0, 1, 52, 4);
box(-13, -10, 12, 3, 3, 'container');
box(-13, -6, 12, 3, 3, 'container');
box(0, -12, 13, 3, 3, 'container');
box(8, 0, 3, 12, 3, 'shelf');
box(14, 0, 3, 12, 3, 'shelf');
box(20, 0, 3, 12, 3, 'shelf');
box(15, -13, 17, 1, 4, 'wall');
box(15, 13, 17, 1, 4, 'wall');
box(24, 0, 1, 27, 4, 'wall');

for (const item of [
  [-25, -1, 4, 4], [-23, 8, 3, 2], [-7, 4, 3, 3], [1, 3, 3, 3],
  [5, 8, 3, 2], [-1, -1, 2, 2], [26, 15, 3, 2], [27, -16, 3, 2],
  [16, 17, 3, 2], [-17, 15, 3, 2]
]) box(item[0], item[1], item[2], item[3], 1.6, 'crate');

const props = [
  { type: 'forklift', x: -27, z: 10 },
  { type: 'barrel', x: -8, z: 13 },
  { type: 'barrel', x: 9, z: -8 },
  { type: 'crate', x: -29, z: -7 },
  { type: 'crate', x: 4, z: -15 }
];

for (const prop of props) {
  if (prop.type === 'barrel') box(prop.x, prop.z, 0.9, 0.9, 1.1, 'prop');
  if (prop.type === 'forklift') box(prop.x, prop.z, 2.8, 1.6, 2.2, 'prop');
  if (prop.type === 'crate') box(prop.x, prop.z, 1.4, 1.4, 1.6, 'prop');
}

export const MAP = {
  boxes,
  props,
  spawns: {
    ember: [[-5, 20], [-2, 21], [2, 21], [5, 20]],
    harbor: [[-25, -21], [-21, -21], [20, -21], [24, -21]]
  },
  sites: {
    A: { x: -24, z: -14, r: 4, name: 'Crane Pad' },
    B: { x: 19, z: -17, r: 4, name: 'Pump House' }
  },
  nodes: [
    [-4, 18], [-7, 11], [-12, 5], [-19, 0], [-22, -8], [-21, -13],
    [1, 12], [1, 5], [0, -4], [-5, -10], [3, 10], [3, -18],
    [10, -19], [19, -19], [19, -17], [10, 8], [10, -8],
    [3, 12], [10, 12], [25, -8], [25, -19], [-6.75, -8.7], [-20, -12],
    [25, -14.5], [10, -8.7], [-20, -18], [25, -18], [-6.75, -12]
  ],
  routes: {
    A: [0, 1, 2, 3, 4, 5],
    B: [0, 6, 7, 10, 17, 18, 15, 16, 24, 21, 27, 22, 25, 26, 20, 13, 14],
    mid: [0, 1, 2, 3, 4, 5]
  },
  holds: [[-21, -7, 0], [-3, -7, 1.5], [12, -5, 3], [18, -10, 3.14]]
};
