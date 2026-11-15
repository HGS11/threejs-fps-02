import { CFG } from './config.js';
import { MAP } from './mapdata.js';
import { buy } from './rounds.js';

// Creates the HUD controller for readouts, overlays, and interactive buttons.
export function makeHud(s) {
  let menuWasOpen = false;

  // Finds a HUD element by its stable document id.
  function element(id) {
    return document.getElementById(id);
  }

  // Draws the yard layout, objectives, visible allies, and recently seen enemies.
  function drawMap(state) {
    const canvas = element('map');
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(10, 20, 27, 0.88)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(75 - state.player.x * 1.7, 75 - state.player.z * 1.7);
    context.strokeStyle = '#62737a';
    context.lineWidth = 2;
    for (const box of MAP.boxes) {
      context.strokeRect(box.x * 1.7 - box.w * 0.85,
        box.z * 1.7 - box.d * 0.85, box.w * 1.7, box.d * 1.7);
    }
    context.fillStyle = '#ff9b5e';
    context.font = 'bold 12px sans-serif';
    for (const key of ['A', 'B']) {
      const site = MAP.sites[key];
      context.fillText(key, site.x * 1.7, site.z * 1.7);
    }
    if (state.charge.planted) {
      drawMarker(context, state.charge.x, state.charge.z, '#ff382d', 6);
    }
    for (const bot of state.bots) {
      if (!bot.alive) continue;
      if (bot.team === state.player.team) {
        drawMarker(context, bot.x, bot.z, '#ff783e', 3);
      } else {
        const age = state.elapsed - bot.lastSeen;
        if (age <= 3) {
          context.globalAlpha = Math.max(0.12, 1 - age / 3);
          drawMarker(context, bot.lastSeenX, bot.lastSeenZ, '#27c6b0', 3);
          context.globalAlpha = 1;
        }
      }
    }
    drawMarker(context, state.player.x, state.player.z, '#ffffff', 4);
    context.restore();
  }

  // Draws a centered marker at a world coordinate on the translated minimap.
  function drawMarker(context, x, z, color, radius) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x * 1.7, z * 1.7, radius, 0, Math.PI * 2);
    context.fill();
  }

  // Updates text, indicators, menus, timer banners, and kill feed entries.
  function update(state) {
    element('health').textContent = Math.ceil(state.player.health);
    element('armor').textContent = Math.ceil(state.player.armor);
    element('ammo').textContent = state.player.ammo[state.player.weapon] + ' / ' +
      state.player.reserve[state.player.weapon];
    element('weapon').textContent = state.player.weapon;
    element('cash').textContent = '$' + state.money.ember;
    element('timer').textContent = Math.max(0,
      state.phase === 'buy' ? state.buyTime : state.time).toFixed(1);
    element('score').textContent = state.scores.ember + '  :  ' + state.scores.harbor;
    element('round').textContent = 'ROUND ' + state.round;
    element('bomb').textContent = state.charge.planted ?
      'CHARGE ' + state.charge.fuse.toFixed(1) :
      state.phase === 'buy' ? 'BUY PHASE' : 'CHARGE: CARRIED';
    element('fragCount').textContent = state.player.frag;
    element('smokeCount').textContent = state.player.smoke;
    element('damage').style.opacity = Math.max(0, state.damageFlash || 0);
    element('hitmarker').style.opacity = state.hitmarker > 0 ? 1 : 0;
    element('hitmarker').classList.toggle('headshot', state.hitmarker > 1);
    element('crosshair').style.setProperty('--gap',
      5 + state.player.bloom * 250 +
      Math.hypot(state.player.vx, state.player.vz) * 1.2 + 'px');
    element('scope').style.display = state.scope ? 'block' : 'none';

    const progress = Math.max(0, Math.min(1, state.interact || 0));
    element('progress').style.width = progress * 100 + '%';
    element('progressWrap').style.display = progress > 0 ? 'block' : 'none';
    element('progressLabel').textContent = state.charge.planted ? 'DEFUSING' : 'PLANTING';

    const latestEvent = state.events[state.events.length - 1];
    element('banner').textContent = state.bannerLife > 0 && latestEvent ?
      latestEvent.text : '';
    element('banner').style.opacity = state.bannerLife > 0 ? 1 : 0;
    updateFeed(state);
    updateBuyMenu(state);
    element('pause').classList.toggle('open', state.phase === 'paused');
    element('end').classList.toggle('open', state.phase === 'matchend');
    element('start').classList.toggle('open', state.phase === 'start');
    element('scoreboard').classList.toggle('open', !!state.scoreboard);
    if (state.phase === 'matchend') {
      element('finalTitle').textContent = state.result === 'ember' ?
        'MERIDIAN SECURED' : 'YARD LOST';
      element('finalScore').textContent = 'FINAL SCORE  ' + state.scores.ember +
        ' : ' + state.scores.harbor;
    }
    drawMap(state);
  }

  // Renders up to five kill feed messages that still have lifetime remaining.
  function updateFeed(state) {
    const entries = state.feed.filter(entry => entry.life > 0).slice(0, 5);
    element('feed').innerHTML = entries.map(entry => '<div>' + entry.text + '</div>').join('');
  }

  // Shows the buy panel, item affordability, and current inventory totals.
  function updateBuyMenu(state) {
    if (state.phase !== 'buy') state.showBuy = false;
    const open = state.phase === 'buy' && state.showBuy;
    element('buy').classList.toggle('open', open);
    element('buyMoney').textContent = '$' + state.money.ember;
    element('buyFrag').textContent = state.player.frag;
    element('buySmoke').textContent = state.player.smoke;
    for (const button of document.querySelectorAll('[data-buy]')) {
      const affordable = state.money.ember >= CFG.prices[button.dataset.buy];
      button.disabled = !affordable;
      button.classList.toggle('unaffordable', !affordable);
    }
    if (open !== menuWasOpen) {
      menuWasOpen = open;
      state.buyMenuOpen = open;
      if (open) window.gameInput.unlock();
      else if ((state.phase === 'buy' || state.phase === 'live') &&
        !window.__shotMode) window.gameInput.lock();
    }
  }

  // Opens or closes an overlay by id.
  function show(id, visible) {
    element(id).classList.toggle('open', visible);
  }

  // Connects buy, play, resume, restart, and menu buttons to game actions.
  function wire(state) {
    for (const button of document.querySelectorAll('[data-buy]')) {
      // Applies the selected purchase and refreshes the menu totals.
      button.onclick = () => {
        buy(state, button.dataset.buy);
        update(state);
      };
    }
    // Starts the match when the player accepts the start overlay.
    element('play').onclick = () => window.startGame();
    // Resumes the phase that was active before the pause.
    element('resume').onclick = () => window.resumeGame();
    // Restarts the match with the selected deterministic seed.
    element('restart').onclick = () => window.restartGame();
    // Toggles the buy panel from its button.
    element('menuBuy').onclick = () => {
      state.showBuy = !state.showBuy;
      update(state);
    };
    // Closes the buy panel and restores gameplay pointer lock.
    element('closeBuy').onclick = () => {
      state.showBuy = false;
      update(state);
    };
  }

  return { update, drawMap, show, wire };
}
