import { CFG } from './config.js';
import { resolveCircle } from './collision.js';
import { AUDIO } from './audio.js';

// Advances player movement, firing, reload, and camera aim for one fixed step.
export function stepPlayer(s, input, camera, dt, weapons, bots) {
  const player = s.player;
  if (!player.alive) return;
  const forward = Number(input.held('KeyW')) - Number(input.held('KeyS'));
  const side = Number(input.held('KeyD')) - Number(input.held('KeyA'));
  const length = Math.hypot(forward, side) || 1;
  const crouched = input.held('ControlLeft') || input.held('KeyC');
  const walking = input.held('ShiftLeft');
  const speed = crouched ? CFG.crouch : walking ? CFG.walk : CFG.speed;
  const targetX = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * side) /
    length * speed;
  const targetZ = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * side) /
    length * speed;
  player.vx += (targetX - player.vx) * Math.min(1, CFG.accel * dt);
  player.vz += (targetZ - player.vz) * Math.min(1, CFG.accel * dt);
  const oldX = player.x;
  const oldZ = player.z;
  const position = resolveCircle(player.x + player.vx * dt, player.z + player.vz * dt);
  player.x = position.x;
  player.z = position.z;
  const distance = Math.hypot(player.x - oldX, player.z - oldZ);
  if (distance > 0) {
    s.footsteps += distance;
    if (s.footsteps >= 2.1) {
      s.footsteps -= 2.1;
      AUDIO.step(Math.min(1, Math.hypot(player.vx, player.vz) / CFG.speed));
    }
  }
  if (input.take('Space') && player.y <= 0) player.vy = CFG.jump;
  player.vy -= CFG.gravity * dt;
  player.y = Math.max(0, player.y + player.vy * dt);
  if (player.y === 0) player.vy = 0;
  player.bloom = Math.max(0, player.bloom - dt * 0.05);
  player.recoil = Math.max(0, player.recoil - dt * 0.055);
  player.fireWait = Math.max(0, player.fireWait - dt);
  player.crouched = crouched;
  player.aiming = input.held('Mouse2');
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      const definition = CFG.weapons[player.weapon];
      const amount = Math.min(definition.mag - player.ammo[player.weapon],
        player.reserve[player.weapon]);
      player.ammo[player.weapon] += amount;
      player.reserve[player.weapon] -= amount;
    }
  }
  if (input.held('Mouse0')) weapons.shoot(s, bots);
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - input.dy * 0.002));
  player.yaw -= input.dx * 0.002;
  player.eye = crouched ? 0.95 : CFG.eye;
  camera.position.set(player.x, player.eye + player.y, player.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch + player.recoil;
}

// Applies damage and records the player's death event when health reaches zero.
export function hurt(s, amount, attacker) {
  const player = s.player;
  if (!player.alive) return;
  const absorbed = Math.min(player.armor, amount * 0.45);
  player.armor -= absorbed;
  player.health -= amount - absorbed;
  s.damageFlash = 1;
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
    s.events.push({ type: 'kill', text: 'VANGUARD DOWN', name: attacker || 'Harbor Warden' });
  }
}
