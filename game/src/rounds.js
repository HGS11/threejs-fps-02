import { CFG } from './config.js';
import { MAP } from './mapdata.js';
import { resetRound, resetMatch } from './state.js';
import { AUDIO } from './audio.js';

// Purchases an available item during the buy phase.
export function buy(s, item) {
  const price = CFG.prices[item] || 0;
  if (s.phase !== 'buy' || s.money.ember < price) return false;
  s.money.ember -= price;
  if (CFG.weapons[item]) {
    s.player.weapon = item;
    s.player.ammo[item] = CFG.weapons[item].mag;
    s.player.reserve[item] = CFG.weapons[item].reserve;
  } else if (item === 'armor') s.player.armor = CFG.armor;
  else if (item === 'frag') s.player.frag++;
  else if (item === 'smoke') s.player.smoke++;
  return true;
}

// Ends a round and applies its score, loss streak, and economy changes.
export function finish(s, winner, reason) {
  s.phase = 'end';
  s.result = winner;
  s.events.push({ type: 'banner', text: winner.toUpperCase() + ' WIN: ' + reason });
  s.bannerLife = 4;
  s.scores[winner]++;
  s.losses[winner] = 0;
  const loser = winner === 'ember' ? 'harbor' : 'ember';
  s.losses[loser] = Math.min(CFG.lossCap, s.losses[loser] + 1);
  s.money[winner] += CFG.win$;
  s.money[loser] += CFG.loss$ + Math.max(0, s.losses[loser] - 1) * CFG.lossStep$;
  AUDIO[winner === 'ember' ? 'win' : 'lose']();
}

// Advances buy timers, planted charge, win conditions, and player planting.
export function stepRounds(s, dt, input) {
  if (s.phase === 'buy') {
    s.buyTime -= dt;
    if (s.buyTime <= 0) {
      s.phase = 'live';
      s.time = CFG.round;
      s.events.push({ type: 'banner', text: 'ROUND ' + s.round + ' — LIVE' });
      s.bannerLife = 4;
    }
  } else if (s.phase === 'live') {
    s.time -= dt;
    if (s.charge.planted) {
      s.charge.fuse -= dt;
      if (s.charge.fuse <= 0) {
        finish(s, 'ember', 'CHARGE DETONATED');
        return;
      }
    }
    const alive = s.bots.some(bot => bot.alive &&
      (bot.team === 'ember' && s.player.alive || bot.team === 'harbor'));
    if (!s.player.alive && !s.bots.some(bot => bot.alive && bot.team === 'ember')) {
      finish(s, 'harbor', 'VANGUARD ELIMINATED');
      return;
    }
    if (!alive) {
      finish(s, 'ember', 'WARDENS ELIMINATED');
      return;
    }
    if (s.time <= 0 && !s.charge.planted) {
      finish(s, 'harbor', 'TIME EXPIRED');
      return;
    }
  } else if (s.phase === 'end') {
    s.endTime = (s.endTime || 0) + dt;
    if (s.scores.ember >= CFG.wins || s.scores.harbor >= CFG.wins || s.round >= CFG.rounds) {
      s.phase = 'matchend';
      s.events.push({ type: 'banner', text: s.result === 'ember' ? 'MERIDIAN SECURED' : 'YARD LOST' });
      s.bannerLife = 4;
      return;
    }
    if (s.endTime > 4) {
      s.endTime = 0;
      s.round++;
      resetRound(s);
    }
  }
  const player = s.player;
  if (input && input.held('KeyE') && s.phase === 'live') {
    let site = '';
    for (const key of ['A', 'B']) {
      const target = MAP.sites[key];
      if (Math.hypot(player.x - target.x, player.z - target.z) < target.r) site = key;
    }
    if (site && !s.charge.planted) {
      s.charge.plant += dt;
      s.interact = s.charge.plant / CFG.plant;
      if (s.charge.plant >= CFG.plant) {
        s.charge.planted = true;
        s.charge.site = site;
        s.charge.x = player.x;
        s.charge.z = player.z;
        s.charge.fuse = CFG.fuse;
        s.charge.plant = 0;
        s.interact = 0;
        s.events.push({ type: 'banner', text: 'PULSE CHARGE PLANTED' });
        s.bannerLife = 4;
        AUDIO.plant();
      }
    } else {
      s.charge.plant = 0;
      s.interact = s.botInteract || 0;
    }
  } else {
    s.charge.plant = 0;
    s.interact = s.botInteract || 0;
  }
}

// Restarts the match with the selected random seed.
export function restart(s, seed) {
  resetMatch(s, seed);
}
