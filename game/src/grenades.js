import { CFG } from './config.js';
import { blocked, resolveCircle } from './collision.js';
import { hurt } from './player.js';
import { AUDIO } from './audio.js';

// Throws a frag or smoke grenade from a chosen origin and direction.
export function throwGrenade(s, rng, kind = 'frag', origin = null, direction = null,
  team = 'ember') {
  const player = s.player;
  const start = origin || { x: player.x, y: 1.35 + player.y, z: player.z };
  const yaw = player.yaw;
  const pitch = player.pitch;
  const aim = direction || {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch) + 0.42,
    z: -Math.cos(yaw) * Math.cos(pitch)
  };
  const length = Math.hypot(aim.x, aim.y, aim.z) || 1;
  s.grenades.push({
    x: start.x, y: start.y, z: start.z,
    vx: aim.x / length * 9,
    vy: aim.y / length * 9,
    vz: aim.z / length * 9,
    t: 2.5, kind, team
  });
}

// Advances pooled grenades, resolves wall and floor bounce, and detonates them.
export function stepGrenades(s, dt, effects) {
  for (let i = s.grenades.length - 1; i >= 0; i--) {
    const grenade = s.grenades[i];
    grenade.t -= dt;
    const position = resolveCircle(grenade.x + grenade.vx * dt,
      grenade.z + grenade.vz * dt, 0.12);
    if (position.x !== grenade.x + grenade.vx * dt) grenade.vx *= -0.55;
    if (position.z !== grenade.z + grenade.vz * dt) grenade.vz *= -0.55;
    grenade.x = position.x;
    grenade.z = position.z;
    grenade.y += grenade.vy * dt;
    grenade.vy -= 10 * dt;
    if (grenade.y < 0.15) {
      grenade.y = 0.15;
      grenade.vy = Math.abs(grenade.vy) * 0.48;
      grenade.vx *= 0.78;
      grenade.vz *= 0.78;
    }
    effects.grenade(grenade);
    if (grenade.t <= 0) {
      if (grenade.kind === 'smoke') {
        s.smoke = { x: grenade.x, z: grenade.z, t: 12, age: 0 };
      } else {
        const playerDistance = Math.hypot(s.player.x - grenade.x, s.player.z - grenade.z);
        if (grenade.team !== 'ember' && playerDistance < 8 &&
          !blocked(s.player.x, s.player.z, grenade.x, grenade.z)) {
          hurt(s, (1 - playerDistance / 8) * 85, 'Blast');
        }
        for (const bot of s.bots) {
          const distance = Math.hypot(bot.x - grenade.x, bot.z - grenade.z);
          if (bot.alive && bot.team !== grenade.team && distance < 8 &&
            !blocked(bot.x, bot.z, grenade.x, grenade.z)) {
            bot.damage = (1 - distance / 8) * 100;
          }
        }
        s.shake = 0.35;
        effects.explosion(grenade.x, grenade.y, grenade.z);
        AUDIO.explode();
      }
      effects.removeGrenade(grenade);
      s.grenades.splice(i, 1);
    }
  }
  if (s.smoke) {
    s.smoke.t -= dt;
    s.smoke.age += dt;
    effects.smoke(s.smoke);
    if (s.smoke.t <= 0) {
      effects.removeSmoke();
      s.smoke = null;
    }
  } else {
    effects.removeSmoke();
  }
}
