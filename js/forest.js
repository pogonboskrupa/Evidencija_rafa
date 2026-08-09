// Generira dekorativni red borova (obris šume) unutar .forest-strip elemenata.

const HEIGHTS = [34, 48, 30, 52, 40, 46, 32, 50, 36, 44, 30, 48, 38, 52, 34, 46];
const COLORS = ['#c9e8bb', '#a3d68f', '#8bc36f', '#a3d68f'];

function buildForestSVG() {
  const viewW = 1200;
  const viewH = 90;
  const baseline = 88;
  const step = viewW / HEIGHTS.length;

  let trees = '';
  HEIGHTS.forEach((h, i) => {
    const w = h * 0.62;
    const x = i * step + step / 2 - w / 2;
    const y = baseline - h;
    const color = COLORS[i % COLORS.length];
    trees += `<use href="#pineTree" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" color="${color}" />`;
  });

  return `<svg viewBox="0 0 ${viewW} ${viewH}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${trees}</svg>`;
}

export function renderForestStrips() {
  const svgMarkup = buildForestSVG();
  document.querySelectorAll('.forest-strip').forEach((el) => {
    el.innerHTML = svgMarkup;
  });
}
