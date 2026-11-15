let context = null;
let master = null;
let muted = false;

// Creates the synthesized audio context after the first user gesture.
function init() {
  if (context) return;
  context = new (window.AudioContext || window.webkitAudioContext)();
  master = context.createGain();
  master.gain.value = 0.24;
  master.connect(context.destination);
}

// Plays a short synthesized oscillator tone through the master gain.
function tone(frequency, duration, type = 'sine', volume = 0.2) {
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

export const AUDIO = {
  gesture() { init(); },
  mute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.24;
  },
  shot(weapon) {
    init();
    const frequency = weapon === 'Longbow' ? 100 : weapon === 'VK7' ? 150 :
      weapon === 'Kestrel' ? 230 : 185;
    tone(frequency, 0.12, 'sawtooth', 0.13);
    tone(frequency * 0.48, 0.2, 'sine', 0.18);
  },
  click() { tone(700, 0.035, 'square', 0.08); },
  dry() { tone(180, 0.045, 'square', 0.09); },
  hit() { tone(900, 0.06, 'sine', 0.08); },
  head() { tone(1350, 0.16, 'sine', 0.12); },
  plant() { tone(520, 0.2); tone(780, 0.25); },
  defuse() { tone(780, 0.2); },
  explode() { tone(65, 0.8, 'sawtooth', 0.4); },
  win() { tone(520, 0.4); tone(780, 0.5); },
  lose() { tone(300, 0.6); },
  step(amount = 1) { tone(100, 0.025, 'sine', 0.025 * amount); }
};
