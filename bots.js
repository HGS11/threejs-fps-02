import * as THREE from 'three';
import { CFG } from './config.js';
import { MAP } from './mapdata.js';
import { blocked, resolveCircle } from './collision.js';
import { hurt } from './player.js';
import { AUDIO } from './audio.js';
import { finish } from './rounds.js';
import { throwGrenade } from './grenades.js';

// Creates named ally and enemy bots with seeded route and combat state.
export function spawnBots(s, scene, rng) {
  const bodyGeometry = new THREE.CapsuleGeometry(0.32, 0.72, 3, 6);
  const headGeometry = new THREE.SphereGeometry(0.22, 8, 6);
  const gunGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.55);
  const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x202529 });
  const emberNames = ['Mica', 'Rook', 'Tern'];
  const harborNames = ['Sable', 'Kite', 'Morrow', 'Quay'];
  for (let i = 0; i < 7; i++) {
    const team = i < 3 ? 'ember' : 'harbor';
    const spawn = MAP.spawns[team][i % 4];
    const material = new THREE.MeshStandardMaterial({
      color: team === 'ember' ? CFG.colors.ember : CFG.colors.teal
    });
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(bodyGeometry, material);
    const head = new THREE.Mesh(headGeometry, material);
    const gun = new THREE.Mesh(gunGeometry, gunMaterial);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = '#15232bd9';
    context.fillRect(0, 0, 256, 64);
    context.fillStyle = team === 'ember' ? '#ff9b69' : '#58dfd0';
    context.font = 'bold 28px sans-serif';
    context.textAlign = 'center';
    const name = team === 'ember' ? emberNames[i % 3] : harborNames[(i - 3) % 4];
    context.fillText(name, 128, 42);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), transparent: true
    }));
    label.position.y = 2.12;
    label.scale.set(1.5, 0.38, 1);
    body.position.y = 0.78;
    head.position.y = 1.48;
    gun.position.set(0.35, 1.05, -0.35);
    mesh.add(body, head, gun, label);
    mesh.position.set(spawn[0], 0, spawn[1]);
    mesh.rotation.y = team === 'harbor' ? Math.PI : 0;
    scene.add(mesh);
    s.bots.push({
      x: spawn[0], z: spawn[1], team, health: 100, alive: true, mesh, name,
      fire: rng.float(0.1, 0.8), route: i % 2 ? 'A' : 'B', node: 0,
      damage: 0, hitPart: 'body', seen: 0, lastSeen: -Infinity,
      lastSeenX: spawn[0], lastSeenZ: spawn[1],
      defuse: 0, plant: 0, hold: i % MAP.holds.length, holdTime: 0,
      strafe: rng.next() < 0.5 ? -1 : 1, strafeTime: rng.float(1, 2),
      frag: true, fragWait: rng.float(8, 16), carrier: i === 0
    });
  }
}

// Resolves bot deaths, collision-safe movement, combat, planting, and tactics.
export function stepBots(s, dt, rng, effects) {
  const player = s.player;
  for (const bot of s.bots) {
    if (!bot.alive) continue;
    if (bot.damage) {
      bot.health -= bot.damage;
      bot.damage = 0;
      if (bot.health <= 0) {
        bot.alive = false;
        bot.mesh.visible = false;
        const partText = bot.hitPart === 'head' ? ' with a headshot' : '';
        s.feed.unshift({ text: 'Vanguard eliminated ' + bot.name + partText, life: 5 });
        s.money.ember += CFG.kill$;
        s.kills++;
        continue;
      }
    }
    bot.fragWait -= dt;
    if (bot.team === 'harbor' && s.charge.planted) {
      moveBot(bot, s.charge.x, s.charge.z, dt, CFG.bot.speed);
      if (Math.hypot(s.charge.x - bot.x, s.charge.z - bot.z) < 1.5) {
        bot.defuse += dt;
        s.botInteract = Math.min(1, bot.defuse / CFG.defuse);
        if (bot.defuse >= CFG.defuse) {
          finish(s, 'harbor', 'CHARGE DEFUSED');
          AUDIO.defuse();
          return;
        }
      }
      bot.mesh.position.set(bot.x, 0, bot.z);
      continue;
    }
    if (bot.team === 'ember' && !s.charge.planted &&
      (!player.alive || bot.carrier && farFromSites(player))) {
      const target = MAP.sites[bot.route === 'A' ? 'A' : 'B'];
      if (Math.hypot(target.x - bot.x, target.z - bot.z) < target.r) {
        bot.plant += dt;
        s.botInteract = Math.min(1, bot.plant / CFG.plant);
        if (bot.plant >= CFG.plant) {
          s.charge.planted = true;
          s.charge.site = target === MAP.sites.A ? 'A' : 'B';
          s.charge.x = bot.x;
          s.charge.z = bot.z;
          s.charge.fuse = CFG.fuse;
          s.events.push({ type: 'banner', text: 'PULSE CHARGE PLANTED' });
          s.bannerLife = 4;
          AUDIO.plant();
        }
      }
    }
    let enemy = null;
    let bestDistance = CFG.bot.range;
    if (bot.team === 'harbor' && player.alive) {
      const distance = Math.hypot(player.x - bot.x, player.z - bot.z);
      if (distance < bestDistance) {
        enemy = player;
        bestDistance = distance;
      }
    }
    for (const other of s.bots) {
      if (!other.alive || other.team === bot.team) continue;
      const distance = Math.hypot(other.x - bot.x, other.z - bot.z);
      if (distance < bestDistance) {
        enemy = other;
        bestDistance = distance;
      }
    }
    if (enemy && bot.team === 'ember' && bot.frag && bot.fragWait <= 0 &&
      bestDistance > 15 && !blocked(bot.x, bot.z, enemy.x, enemy.z)) {
      throwGrenade(s, rng, 'frag', { x: bot.x, y: 1.35, z: bot.z },
        { x: enemy.x - bot.x, y: enemy.y ? 1.5 : 1.2, z: enemy.z - bot.z }, bot.team);
      bot.frag = false;
    }
    if (enemy) {
      const dx = enemy.x - bot.x;
      const dz = enemy.z - bot.z;
      const distance = Math.hypot(dx, dz);
      const smoke = s.smoke && Math.hypot((bot.x + enemy.x) / 2 - s.smoke.x,
        (bot.z + enemy.z) / 2 - s.smoke.z) < 4;
      const facingX = -Math.sin(bot.mesh.rotation.y);
      const facingZ = -Math.cos(bot.mesh.rotation.y);
      const facing = (facingX * dx + facingZ * dz) / (distance || 1);
      const visible = distance < CFG.bot.range && facing > 0.15 &&
        !blocked(bot.x, bot.z, enemy.x, enemy.z) && !smoke;
      if (visible) {
        bot.seen += dt;
        bot.lastSeen = s.elapsed;
        bot.lastSeenX = enemy.x;
        bot.lastSeenZ = enemy.z;
        bot.mesh.rotation.y = Math.atan2(-dx, -dz);
        bot.strafeTime -= dt;
        if (bot.strafeTime <= 0) {
          bot.strafe *= -1;
          bot.strafeTime = rng.float(1, 2);
        }
        const strafeX = dz / (distance || 1) * bot.strafe;
        const strafeZ = -dx / (distance || 1) * bot.strafe;
        moveBot(bot, bot.x + strafeX * CFG.bot.speed,
          bot.z + strafeZ * CFG.bot.speed, dt, CFG.bot.speed);
        if (bot.seen > 0.45) {
          bot.fire -= dt;
          if (bot.fire <= 0) {
            bot.fire = rng.float(0.6, 1.25);
            const error = distance * 0.012 + rng.float(0, 0.06);
            const aim = Math.abs(rng.float(-1, 1)) > error * 5;
            if (enemy === player) {
              if (aim) hurt(s, rng.float(7, 17), bot.name);
            } else if (aim && rng.next() < 0.22) enemy.damage = 14;
            effects.trace({ x: bot.x, y: 1.35, z: bot.z },
              { x: enemy.x, y: 1.2, z: enemy.z });
          }
        }
      } else {
        bot.seen = Math.max(0, bot.seen - dt);
        followRoute(bot, s, dt, rng);
      }
    } else {
      followRoute(bot, s, dt, rng);
    }
    bot.mesh.position.set(bot.x, 0, bot.z);
  }
}

// Moves a bot toward a target through the common circle collision resolver.
function moveBot(bot, targetX, targetZ, dt, speed) {
  const dx = targetX - bot.x;
  const dz = targetZ - bot.z;
  const distance = Math.hypot(dx, dz) || 1;
  const position = resolveCircle(bot.x + dx / distance * speed * dt,
    bot.z + dz / distance * speed * dt);
  bot.x = position.x;
  bot.z = position.z;
}

// Reports whether the player is beyond every site radius.
function farFromSites(player) {
  return Object.values(MAP.sites).every(site =>
    Math.hypot(player.x - site.x, player.z - site.z) > 15);
}

// Advances the bot route, pausing briefly at each assigned hold position.
function followRoute(bot, s, dt, rng) {
  if (s.sound && s.elapsed - s.sound.time < 5 &&
    Math.hypot(s.sound.x - bot.x, s.sound.z - bot.z) < 22) {
    moveBot(bot, s.sound.x, s.sound.z, dt, CFG.bot.speed);
    return;
  }
  const hold = MAP.holds[bot.hold];
  if (hold && Math.hypot(hold[0] - bot.x, hold[1] - bot.z) < 2) {
    bot.mesh.rotation.y = hold[2];
    bot.holdTime += dt;
    if (bot.holdTime < 2.5) return;
    bot.holdTime = 0;
    bot.hold = (bot.hold + 1) % MAP.holds.length;
  }
  const route = MAP.routes[bot.route];
  const node = MAP.nodes[route[Math.min(bot.node, route.length - 1)]];
  if (!node) return;
  if (Math.hypot(node[0] - bot.x, node[1] - bot.z) < 1.4) {
    bot.node = (bot.node + 1) % route.length;
    if (rng.next() < 0.25) bot.route = bot.route === 'A' ? 'B' : 'A';
  } else {
    moveBot(bot, node[0], node[1], dt, CFG.bot.speed);
  }
}
