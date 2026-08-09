// Generiše suptilnu, slojevitu siluetu šume koja se koristi kao ambijentalna
// pozadina na dnu stranice. Umjesto pojedinačnih "clipart" stabala crtaju se
// tri sloja isprepletene linije krošnji koje se gube u pozadini.

const W = 1440;
const H = 220;

// Deterministički pseudo-slučajni generator (mulberry32) — isti raspored
// stabala pri svakom učitavanju.
function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Jedan sloj šume: niz preklopljenih krošnji četinara duž zajedničke linije tla.
// Krošnje su široke i mekih rubova kako bi se čitale kao daleki obris šume,
// a ne kao pojedinačna stabla.
function treelinePath({ seed, baseY, minH, maxH, baseW }) {
  const rnd = mulberry32(seed);
  let d = `M -120 ${H} L -120 ${baseY}`;
  let x = -120;

  while (x < W + 120) {
    const h = minH + rnd() * (maxH - minH);
    const w = baseW * (0.65 + rnd() * 0.8);
    const apex = x + w / 2;
    const shoulder = baseY - h * 0.34;
    // meka, blago konkavna krošnja četinara
    d += ` C ${(x + w * 0.3).toFixed(1)} ${shoulder.toFixed(1)} ${(apex - w * 0.09).toFixed(1)} ${(baseY - h * 0.82).toFixed(1)} ${apex.toFixed(1)} ${(baseY - h).toFixed(1)}`;
    d += ` C ${(apex + w * 0.09).toFixed(1)} ${(baseY - h * 0.82).toFixed(1)} ${(x + w * 0.7).toFixed(1)} ${shoulder.toFixed(1)} ${(x + w).toFixed(1)} ${baseY.toFixed(1)}`;
    x += w * 0.66;
  }

  d += ` L ${W + 120} ${baseY} L ${W + 120} ${H} Z`;
  return d;
}

const LAYERS = [
  { seed: 1337, baseY: 158, minH: 46, maxH: 84, baseW: 92, fill: '#cfe8c2', opacity: 0.6 },
  { seed: 90210, baseY: 190, minH: 60, maxH: 108, baseW: 126, fill: '#aed69a', opacity: 0.62 },
  { seed: 4242, baseY: 224, minH: 74, maxH: 132, baseW: 168, fill: '#84bd6e', opacity: 0.6 },
];

export function renderForestBackdrop() {
  const host = document.querySelector('.forest-backdrop');
  if (!host) return;

  const paths = LAYERS.map(
    (l) => `<path d="${treelinePath(l)}" fill="${l.fill}" opacity="${l.opacity}" />`
  ).join('');

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${paths}</svg>`;
}
