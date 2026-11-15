import * as THREE from 'three';
import { CFG } from './config.js';
import { MAP } from './mapdata.js';

// Builds the yard scene and returns its animated environment update.
export function buildWorld(scene) {
  scene.background = new THREE.Color(CFG.colors.slate);
  scene.fog = new THREE.FogExp2(0x40515a, 0.008);

  const hemisphere = new THREE.HemisphereLight(0xaec5d2, 0x35302b, 1.8);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffd7ad, 2.3);
  sun.position.set(-18, 30, 15);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  const yardTexture = makeTexture('yard');
  const ribTexture = makeTexture('container');
  const materials = new Map();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);

  // Returns a shared material for the requested surface color.
  function material(color, roughness = 0.8) {
    const key = color + ':' + roughness;
    if (!materials.has(key)) {
      const map = color === CFG.colors.ground ? yardTexture :
        color === CFG.colors.rust ? ribTexture : null;
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, map }));
    }
    return materials.get(key);
  }

  // Adds a scaled, shadow casting box to the scene.
  function block(x, y, z, width, height, depth, color) {
    const mesh = new THREE.Mesh(unitBox, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  block(0, -0.2, 0, 70, 0.4, 52, CFG.colors.ground);
  for (const item of MAP.boxes) {
    const color = item.type === 'container' ? CFG.colors.rust :
      item.type === 'crate' || item.type === 'prop' ? 0x665947 :
      item.type === 'shelf' ? 0x46515a : 0x35434b;
    block(item.x, item.h / 2, item.z, item.w, item.h, item.d, color);
  }

  buildCrane(block);
  buildProps(block, material, scene);
  const skyline = buildSkyline(scene, material);
  const lamps = buildLamps(scene);
  const beacons = buildBeacons(scene);
  const charge = buildCharge(scene);

  // Animates site beacons, sodium lamps, skyline windows, and the charge device.
  function update(time, state) {
    for (let index = 0; index < beacons.length; index++) {
      const beacon = beacons[index];
      beacon.disc.material.opacity = 0.28 + Math.sin(time * 2 + index) * 0.12;
      beacon.light.intensity = 2 + Math.sin(time * 4 + index) * 0.45;
    }
    for (let index = 0; index < lamps.length; index++) {
      lamps[index].intensity = 1.8 + Math.sin(time * 2.2 + index) * 0.2;
    }
    for (let index = 0; index < skyline.length; index++) {
      skyline[index].material.opacity = 0.55 + Math.sin(time * 1.5 + index) * 0.12;
    }
    charge.visible = !!state.charge.planted;
    if (state.charge.planted) {
      charge.position.set(state.charge.x, 0.22, state.charge.z);
      const pulseRate = 3 + (CFG.fuse - state.charge.fuse) * 0.4;
      charge.children[1].intensity = 1.2 +
        (0.5 + 0.5 * Math.sin(time * pulseRate)) * 3;
    }
  }

  return update;
}

// Creates a reusable canvas texture for concrete and ribbed metal.
function makeTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = kind === 'yard' ? '#747a75' : '#b9c1bd';
  context.fillRect(0, 0, 128, 128);
  if (kind === 'yard') {
    for (let index = 0; index < 380; index++) {
      const x = (index * 37) % 128;
      const y = (index * 71) % 128;
      context.fillStyle = index % 2 ? '#636a66' : '#83847c';
      context.fillRect(x, y, 1 + index % 3, 1);
    }
  } else {
    for (let index = 0; index < 12; index++) {
      context.fillStyle = index % 2 ? '#8a938f' : '#d5d8d2';
      context.fillRect(index * 12, 0, 5, 128);
    }
    context.fillStyle = '#f0b13d';
    for (let offset = -128; offset < 128; offset += 24) {
      context.beginPath();
      context.moveTo(offset, 128);
      context.lineTo(offset + 40, 128);
      context.lineTo(offset + 128, 0);
      context.lineTo(offset + 88, 0);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

// Constructs the crane gantry, cab, and hanging hook above the center lane.
function buildCrane(block) {
  block(-13, 4, -8, 0.3, 8, 0.35, 0x464548);
  block(17, 4, -8, 0.3, 8, 0.35, 0x464548);
  block(2, 8, -8, 30, 0.35, 0.4, 0x555152);
  block(0, 7.35, -8, 3.2, 1.1, 2.1, 0x545254);
  block(2, 4.2, -8, 0.12, 7, 0.12, 0x77726c);
  block(2, 0.9, -8, 0.8, 0.65, 0.7, 0x55575a);
  block(1.68, 0.35, -8, 0.12, 0.45, 0.12, 0x252b2d);
  block(2.32, 0.35, -8, 0.12, 0.45, 0.12, 0x252b2d);
}

// Places the shared map props as visible barrel, forklift, and crate meshes.
function buildProps(block, material, scene) {
  for (const prop of MAP.props) {
    if (prop.type === 'barrel') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 1.1, 8),
        material(0x816343));
      barrel.position.set(prop.x, 0.55, prop.z);
      barrel.castShadow = true;
      scene.add(barrel);
    } else if (prop.type === 'forklift') {
      block(prop.x, 0.65, prop.z, 2.6, 1.3, 1.4, 0x9b6b2d);
      block(prop.x + 1.15, 1.5, prop.z, 0.12, 2.2, 0.15, 0x4a4a43);
      block(prop.x + 1.5, 1.5, prop.z, 0.12, 2.2, 0.15, 0x4a4a43);
    } else {
      block(prop.x, 0.8, prop.z, 1.4, 1.6, 1.4, 0x695b4d);
    }
  }
}

// Creates distant dark building silhouettes and a few lit window dots.
function buildSkyline(scene, material) {
  const windows = [];
  for (let index = 0; index < 12; index++) {
    const side = index % 2 ? -1 : 1;
    const x = side * (39 + index % 3 * 3);
    const z = -25 + Math.floor(index / 2) * 9;
    const width = 4 + index % 4;
    const height = 8 + index % 5 * 2;
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 4),
      material(CFG.colors.skyline));
    building.position.set(x, height / 2 - 0.5, z);
    scene.add(building);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    for (let dot = 0; dot < 12; dot++) {
      context.fillStyle = dot % 3 ? '#b58c55' : '#657c80';
      context.fillRect(5 + dot % 4 * 14, 5 + Math.floor(dot / 4) * 16, 5, 7);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const face = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    }));
    face.position.set(x, height * 0.55, z + 2.1);
    face.scale.set(width, height, 1);
    scene.add(face);
    windows.push(face);
  }
  return windows;
}

// Adds warm sodium point lamps around the yard.
function buildLamps(scene) {
  const lamps = [];
  for (const point of [[-28, -12], [-8, 8], [24, 5]]) {
    const lamp = new THREE.PointLight(0xffb568, 1.8, 20);
    lamp.position.set(point[0], 5, point[1]);
    scene.add(lamp);
    lamps.push(lamp);
  }
  return lamps;
}

// Adds site discs and pulsing beacon lights for both objectives.
function buildBeacons(scene) {
  const beacons = [];
  for (const key of ['A', 'B']) {
    const site = MAP.sites[key];
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(site.r, site.r, 0.08, 24),
      new THREE.MeshBasicMaterial({
        color: CFG.colors.ember,
        transparent: true,
        opacity: 0.35
      }));
    disc.position.set(site.x, 0.05, site.z);
    scene.add(disc);
    const light = new THREE.PointLight(0xffa85c, 2, 16);
    light.position.set(site.x, 3, site.z);
    scene.add(light);
    beacons.push({ disc, light });
  }
  return beacons;
}

// Creates a hidden charge box whose indicator is shown after planting.
function buildCharge(scene) {
  const device = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x20282b, roughness: 0.6 }));
  box.castShadow = true;
  const light = new THREE.PointLight(0xff382d, 2, 5);
  light.position.set(0, 0.25, 0);
  device.add(box, light);
  device.visible = false;
  scene.add(device);
  return device;
}
