import { CFG } from './config.js';
import { createRng } from './rng.js';
import { createState } from './state.js';
import { resolveCircle } from './collision.js';
import { MAP } from './mapdata.js';
import { buildWorld } from './world.js';
import { INPUT } from './input.js';
import { AUDIO } from './audio.js';
import { makeEffects } from './effects.js';
import { makeWeapons } from './weapons.js';
import { stepPlayer } from './player.js';
import { spawnBots, stepBots } from './bots.js';
import { throwGrenade, stepGrenades } from './grenades.js';
import { stepRounds, restart } from './rounds.js';
import { makeHud } from './hud.js';
import * as THREE from 'three';

const parameters = new URLSearchParams(window.location.search);
const shot = parameters.get('shot');
const seedValue = Number(parameters.get('seed') || 1);
const seed = Number.isFinite(seedValue) ? seedValue : 1;
let rng = createRng(seed);
const state = createState(seed);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(76, 1, 0.1, 140);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'game';
document.getElementById('viewport').appendChild(renderer.domElement);
scene.add(camera);

const updateWorld = buildWorld(scene);
const effects = makeEffects(scene);
const weapons = makeWeapons(camera, scene, effects, rng);
const hud = makeHud(state);
hud.wire(state);
INPUT.init();
window.gameInput = INPUT;

let lastTime = 0;
let accumulator = 0;
let pausedPhase = 'live';
let renderedFrames = 0;
let pointerLossAllowed = !!shot;
let previousPhase = state.phase;

// Hides and respawns all bots for the next buy phase when no team remains.
function ensureBots() {
  if (state.bots.some(bot => bot.alive)) return;
  const spawnCount = MAP.spawns.ember.length + MAP.spawns.harbor.length;
  if (!spawnCount) return;
  for (const bot of state.bots) {
    if (bot.mesh) {
      bot.mesh.visible = false;
      scene.remove(bot.mesh);
    }
  }
  state.bots.length = 0;
  spawnBots(state, scene, rng);
}

// Starts a new round flow from the start overlay and requests gameplay focus.
function startGame() {
  AUDIO.gesture();
  if (state.phase === 'start') state.phase = 'buy';
  state.showBuy = false;
  state.buyMenuOpen = false;
  pointerLossAllowed = !!shot;
  ensureBots();
  if (!pointerLossAllowed) INPUT.lock();
  hud.update(state);
}

// Pauses active play and remembers which phase should resume.
function pauseGame() {
  if (state.phase !== 'live' && state.phase !== 'buy') return;
  pausedPhase = state.phase;
  state.phase = 'paused';
  state.showBuy = false;
  state.buyMenuOpen = false;
  INPUT.unlock();
  hud.update(state);
}

// Resumes a paused round and restores pointer lock for interactive play.
function resumeGame() {
  if (state.phase !== 'paused') return;
  state.phase = pausedPhase;
  if (!pointerLossAllowed && !state.showBuy) INPUT.lock();
  hud.update(state);
}

// Resets scores, economy, player state, and seeded bot placement.
function restartGame() {
  restart(state, seed);
  rng = createRng(seed);
  for (const bot of state.bots) {
    if (bot.mesh) scene.remove(bot.mesh);
  }
  state.bots.length = 0;
  INPUT.clear();
  state.phase = 'buy';
  state.time = CFG.round;
  state.buyTime = CFG.buy;
  pointerLossAllowed = !!shot;
  ensureBots();
  if (!pointerLossAllowed) INPUT.lock();
  hud.update(state);
}

// Switches weapons or uses the number key to purchase an open buy menu item.
function handleDigit(code) {
  const index = Number(code.slice(-1));
  if (state.phase === 'buy' && state.showBuy) {
    const items = ['Kestrel', 'VK7', 'Longbow', 'armor', 'frag', 'smoke'];
    const item = items[index - 1];
    if (item) {
      const button = document.querySelector('[data-buy="' + item + '"]');
      button?.click();
    }
    return;
  }
  const weaponsByKey = { 1: 'P9', 2: 'Kestrel', 3: 'VK7', 4: 'Longbow' };
  const weapon = weaponsByKey[index];
  const player = state.player;
  const owned = weapon === 'P9' || player.ammo[weapon] + player.reserve[weapon] > 0;
  if (weapon && owned) {
    state.player.weapon = weapon;
    state.player.reloading = 0;
  }
}

// Runs one fixed simulation tick, including input, actors, timers, and effects.
function tick() {
  if (state.phase === 'paused' || state.phase === 'start' ||
    state.phase === 'matchend') return;

  const dt = CFG.step;
  state.elapsed += dt;
  const reloadPressed = INPUT.take('KeyR');
  if (INPUT.take('Escape')) {
    pauseGame();
    return;
  }
  if (INPUT.take('KeyB') && state.phase === 'buy') {
    state.showBuy = !state.showBuy;
    state.buyMenuOpen = state.showBuy;
  }
  if (INPUT.take('Tab')) state.scoreboard = !state.scoreboard;
  if (INPUT.take('KeyM')) AUDIO.mute();
  if (reloadPressed && state.player.reloading <= 0 &&
    (state.phase === 'buy' || state.phase === 'live')) {
    startReload();
  }
  for (let index = 1; index <= 6; index++) {
    const code = 'Digit' + index;
    if (INPUT.take(code)) handleDigit(code);
  }
  if (state.phase === 'live' && INPUT.take('KeyG') && state.player.frag > 0) {
    state.player.frag--;
    throwGrenade(state, rng, 'frag');
  }
  if (state.phase === 'live' && INPUT.take('KeyH') && state.player.smoke > 0) {
    state.player.smoke--;
    throwGrenade(state, rng, 'smoke');
  }

  if (state.phase === 'live') {
    state.botInteract = 0;
    stepPlayer(state, INPUT, camera, dt, weapons, state.bots);
    stepBots(state, dt, rng, effects);
    stepGrenades(state, dt, effects);
  }
  stepRounds(state, dt, INPUT);
  if (state.phase === 'buy' && previousPhase !== 'buy') ensureBots();
  if (state.phase === 'buy') ensureBots();
  previousPhase = state.phase;
  updateAimCamera();
  effects.update(dt);
  weapons.update(dt, state);
  updateWorld(state.elapsed, state);
  state.shake = Math.max(0, state.shake - dt);
  state.bannerLife = Math.max(0, state.bannerLife - dt);
  state.hitmarker = Math.max(0, state.hitmarker - dt * 2.4);
  state.damageFlash = Math.max(0, state.damageFlash - dt * 0.45);
  for (const entry of state.feed) entry.life -= dt;
  state.feed = state.feed.filter(entry => entry.life > 0);
  hud.update(state);
}

// Begins a reload timer and plays its confirmation click.
function startReload() {
  const player = state.player;
  const definition = CFG.weapons[player.weapon];
  if (!definition || player.ammo[player.weapon] >= definition.mag ||
    player.reserve[player.weapon] <= 0) return;
  player.reloading = definition.reload;
  AUDIO.click();
}

// Applies Longbow scope zoom and refreshes projection when its field of view changes.
function updateAimCamera() {
  const aiming = state.player.aiming;
  const fieldOfView = aiming && state.player.weapon === 'Longbow' ? CFG.scopeFov : 76;
  state.scope = aiming && state.player.weapon === 'Longbow';
  if (camera.fov !== fieldOfView) {
    camera.fov = fieldOfView;
    camera.updateProjectionMatrix();
  }
}

// Resizes the renderer and updates the camera aspect ratio.
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

// Renders frames while advancing the world in sixty hertz fixed steps.
function frame(time) {
  requestAnimationFrame(frame);
  const elapsed = lastTime ? Math.min(0.1, (time - lastTime) / 1000) : 0;
  lastTime = time;
  accumulator += elapsed;
  while (accumulator >= CFG.step) {
    tick();
    accumulator -= CFG.step;
  }
  const shake = state.shake > 0 ? state.shake * 0.025 : 0;
  camera.position.x += shake * Math.sin(state.elapsed * 38);
  camera.position.y += shake * Math.cos(state.elapsed * 31);
  renderer.render(scene, camera);
  camera.position.x -= shake * Math.sin(state.elapsed * 38);
  camera.position.y -= shake * Math.cos(state.elapsed * 31);
  INPUT.end();
  renderedFrames++;
  if (shot === 'play' && renderedFrames === 1) {
    state.player.health = CFG.health;
    state.player.alive = true;
    state.damageFlash = 0;
    hud.update(state);
  }
  if (shot && renderedFrames >= 2) window.__shotReady = true;
}

// Places deterministic screenshot actors and configures the requested phase.
function stageShot() {
  if (!shot) return;
  pointerLossAllowed = true;
  if (shot === 'start') {
    state.phase = 'start';
    return;
  }
  ensureBots();
  state.player.x = 0;
  state.player.z = 19;
  const safeStart = resolveCircle(state.player.x, state.player.z);
  state.player.x = safeStart.x;
  state.player.z = safeStart.z;
  state.player.yaw = 0;
  state.player.pitch = 0;
  camera.position.set(state.player.x, CFG.eye, state.player.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(0, 0, 0);
  state.player.alive = true;
  state.player.health = CFG.health;
  state.player.weapon = 'VK7';
  state.player.ammo.VK7 = CFG.weapons.VK7.mag;
  state.player.reserve.VK7 = CFG.weapons.VK7.reserve;
  for (let index = 0; index < state.bots.length; index++) {
    const bot = state.bots[index];
    bot.alive = true;
    bot.health = 100;
    bot.mesh.visible = true;
    if (bot.team === 'harbor') {
      const enemyIndex = index - 3;
      bot.x = [-4, -1.5, 1.5, 4][enemyIndex];
      bot.z = 3 + enemyIndex % 2 * 1.5;
      bot.lastSeenX = bot.x;
      bot.lastSeenZ = bot.z;
      bot.lastSeen = state.elapsed;
      bot.mesh.position.set(bot.x, 0, bot.z);
      bot.mesh.rotation.y = Math.PI;
      bot.seen = 0.6;
      bot.fire = 0.01;
    }
  }
  if (shot === 'play') {
    state.phase = 'live';
    state.time = CFG.round;
    state.showBuy = false;
    state.player.damageFlash = 0;
    state.damageFlash = 0;
  } else if (shot === 'buy') {
    state.phase = 'buy';
    state.showBuy = true;
    state.buyTime = CFG.buy;
  } else if (shot === 'end') {
    state.phase = 'matchend';
    state.round = 8;
    state.time = 0;
    state.scores.ember = 5;
    state.scores.harbor = 3;
    state.result = 'ember';
  }
  updateAimCamera();
  hud.update(state);
}

window.startGame = startGame;
window.pauseGame = pauseGame;
window.resumeGame = resumeGame;
window.restartGame = restartGame;
window.__shotMode = !!shot;
// Handles pointer-lock loss without interrupting an open buy panel.
window.pointerLockChanged = locked => {
  if (!locked && !pointerLossAllowed && !state.buyMenuOpen &&
    (state.phase === 'live' || state.phase === 'buy')) pauseGame();
};
window.__game = {
  state,
  // Runs the requested number of fixed simulation ticks.
  step(count = 1) {
    for (let index = 0; index < count; index++) tick();
  }
};

window.addEventListener('resize', resize);
resize();
spawnBots(state, scene, rng);
stageShot();
updateWorld(state.elapsed, state);
hud.update(state);
requestAnimationFrame(frame);
