import { CFG } from './config.js';

// Creates the central match state with deterministic defaults.
export function createState(seed = 1) {
  return {
    rngSeed: seed,
    phase: 'start',
    round: 1,
    scores: { ember: 0, harbor: 0 },
    money: { ember: 800, harbor: 800 },
    losses: { ember: 0, harbor: 0 },
    time: CFG.round,
    buyTime: CFG.buy,
    player: {
      x: 0, z: 19, y: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0,
      health: CFG.health, armor: 0, alive: true, team: 'ember', weapon: 'P9',
      ammo: { P9: 12, Kestrel: 0, VK7: 0, Longbow: 0 },
      reserve: { P9: 48, Kestrel: 0, VK7: 0, Longbow: 0 },
      reloading: 0, bloom: 0, recoil: 0, fireWait: 0, frag: 0, smoke: 0,
      aiming: false, crouched: false, eye: CFG.eye
    },
    bots: [],
    grenades: [],
    charge: { planted: false, carrier: -1, x: 0, z: 0, fuse: 0,
      plant: 0, defuse: 0, site: '' },
    feed: [],
    events: [],
    kills: 0,
    result: null,
    interact: 0,
    botInteract: 0,
    scope: false,
    shake: 0,
    sound: null,
    elapsed: 0,
    bannerLife: 0,
    footsteps: 0,
    damageFlash: 0,
    hitmarker: 0,
    smoke: null,
    showBuy: false,
    buyMenuOpen: false,
    scoreboard: false
  };
}

// Resets round state while preserving match economy and score.
export function resetRound(s) {
  s.phase = 'buy';
  s.time = CFG.round;
  s.buyTime = CFG.buy;
  s.charge = { planted: false, carrier: -1, x: 0, z: 0, fuse: 0,
    plant: 0, defuse: 0, site: '' };
  s.grenades.length = 0;
  s.smoke = null;
  s.showBuy = false;
  s.buyMenuOpen = false;
  s.player.x = 0;
  s.player.z = 19;
  s.player.vx = 0;
  s.player.vz = 0;
  s.player.vy = 0;
  s.player.y = 0;
  s.player.health = CFG.health;
  s.player.armor = Math.min(CFG.armor, s.player.armor);
  s.player.alive = true;
  s.player.ammo.P9 = Math.max(0, s.player.ammo.P9);
  s.player.reloading = 0;
  s.events.push({ type: 'round', text: 'BUY PHASE' });
}

// Replaces all match fields with a newly seeded match.
export function resetMatch(s, seed = 1) {
  for (const bot of s.bots) {
    if (bot.mesh) bot.mesh.visible = false;
  }
  const fresh = createState(seed);
  for (const key of Object.keys(s)) delete s[key];
  Object.assign(s, fresh);
}
