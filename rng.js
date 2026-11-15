// Creates the deterministic random generator used by simulation systems.
export function createRng(seed = 1) {
  let value = seed >>> 0;

  // Advances the seeded integer generator and returns a value from zero to one.
  function next() {
    value = (value + 0x6D2B79F5) | 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  }

  return {
    next,
    float: (low, high) => low + next() * (high - low),
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    pick: items => items[Math.floor(next() * items.length)]
  };
}
