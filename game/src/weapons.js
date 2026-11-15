import * as THREE from 'three';
import { CFG } from './config.js';
import { AUDIO } from './audio.js';
import { blocked, raySphere } from './collision.js';

// Builds the camera mounted viewmodel and its muzzle flash light.
export function makeWeapons(camera, scene, effects, rng) {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x222a2d, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x59666b, roughness: 0.45 });
  const flash = new THREE.PointLight(0xffaf54, 0, 5);
  camera.add(group, flash);
  let kick = 0;
  let currentWeapon = '';

  // Replaces the viewmodel boxes with the selected weapon silhouette.
  function pose(weapon) {
    while (group.children.length) group.remove(group.children[0]);
    const dimensions = weapon === 'Longbow' ? [0.065, 0.065, 0.54] :
      weapon === 'Kestrel' ? [0.1, 0.085, 0.35] :
      weapon === 'VK7' ? [0.085, 0.07, 0.44] : [0.07, 0.06, 0.24];
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), steel);
    barrel.position.set(0.4, -0.38, -0.66);
    group.add(barrel);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.095, 0.22), dark);
    receiver.position.set(0.38, -0.44, -0.52);
    group.add(receiver);
    const magazineDepth = weapon === 'Longbow' ? 0.08 : weapon === 'Kestrel' ? 0.14 : 0.11;
    const magazineHeight = weapon === 'Kestrel' ? 0.2 : 0.17;
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.07, magazineHeight, magazineDepth), dark);
    magazine.position.set(0.37, -0.56, -0.43);
    group.add(magazine);
    if (weapon === 'VK7' || weapon === 'Longbow') {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.21), dark);
      stock.position.set(0.38, -0.41, -0.28);
      group.add(stock);
    }
    currentWeapon = weapon;
  }

  // Fires one player shot, applies movement and aim spread, and resolves hits.
  function shoot(s, bots) {
    const player = s.player;
    const definition = CFG.weapons[player.weapon];
    if (player.fireWait > 0) return;
    if (player.ammo[player.weapon] <= 0) {
      AUDIO.dry();
      player.fireWait = 0.2;
      return;
    }
    if (player.reloading) return;
    player.ammo[player.weapon]--;
    player.fireWait = definition.rate;
    player.bloom = Math.min(0.1, player.bloom + definition.spread * 0.55);
    player.recoil = Math.min(0.12, player.recoil + definition.recoil);
    kick = 0.1;
    flash.intensity = 4;
    AUDIO.shot(player.weapon);
    s.sound = { x: player.x, z: player.z, time: s.elapsed };
    const speed = Math.hypot(player.vx, player.vz);
    const movementSpread = speed * CFG.moveSpread * (player.crouched ? CFG.crouchSpread : 1);
    const aimFactor = player.aiming ? CFG.aimSpread : 1;
    const spread = (definition.spread + player.bloom + movementSpread) * aimFactor;
    const yaw = player.yaw + rng.float(-1, 1) * spread;
    const pitch = player.pitch + player.recoil + rng.float(-1, 1) * spread;
    const direction = {
      x: -Math.sin(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch)
    };
    const origin = { x: player.x, y: 1.45, z: player.z };
    let closest = definition.range;
    let hit = null;
    let part = 'body';
    for (const bot of bots) {
      if (!bot.alive || bot.team === player.team) continue;
      const targets = [
        { x: bot.x, y: 1.62, z: bot.z, r: 0.22, p: 'head' },
        { x: bot.x, y: 0.95, z: bot.z, r: 0.38, p: 'body' },
        { x: bot.x, y: 0.35, z: bot.z, r: 0.32, p: 'leg' }
      ];
      for (const target of targets) {
        const distance = raySphere(origin, direction, target, target.r);
        if (distance < closest && !blocked(player.x, player.z, bot.x, bot.z)) {
          closest = distance;
          hit = bot;
          part = target.p;
        }
      }
    }
    effects.trace(origin, {
      x: origin.x + direction.x * closest,
      y: origin.y + direction.y * closest,
      z: origin.z + direction.z * closest
    });
    if (hit) {
      let damage = definition.damage * Math.max(0.35, 1 - Math.max(0, closest - 20) * 0.009);
      if (part === 'head') damage *= 3;
      if (part === 'leg') damage *= 0.7;
      hit.damage = damage;
      hit.hitPart = part;
      s.hitmarker = part === 'head' ? 2 : 1;
      AUDIO[part === 'head' ? 'head' : 'hit']();
    }
  }

  pose('P9');
  return {
    group,
    shoot,
    // Updates viewmodel motion and muzzle flash decay.
    update(dt, s) {
      const player = s.player;
      if (currentWeapon !== player.weapon) pose(player.weapon);
      kick = Math.max(0, kick - dt * 1.8);
      flash.intensity = Math.max(0, flash.intensity - dt * 30);
      const speed = Math.hypot(player.vx, player.vz);
      group.position.set(0.015 * Math.sin(s.elapsed * 8) * speed,
        -0.012 * Math.abs(Math.sin(s.elapsed * 8)) * speed - kick, -kick);
      group.rotation.x = kick * 0.7;
    }
  };
}
