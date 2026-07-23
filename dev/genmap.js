// Generate: (1) dot-grid land mask from world-atlas land-110m, (2) ISO2 -> [lon,lat] centroids
const fs = require('fs');
const topojson = require('topojson-client');
const land = require('world-atlas/land-110m.json');
const countries = require('world-countries');

const geo = topojson.feature(land, land.objects.land); // FeatureCollection or Feature
const polys = [];
const collect = (g) => {
  if (g.type === 'Polygon') polys.push(g.coordinates);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach(c => polys.push(c));
};
if (geo.type === 'FeatureCollection') geo.features.forEach(f => collect(f.geometry));
else collect(geo.geometry);
// unwrap every ring into a continuous longitude path (antimeridian-safe)
function unwrap(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}
for (const poly of polys) for (let k = 0; k < poly.length; k++) poly[k] = unwrap(poly[k]);

function inRingRaw(pt, ring) {
  let [x, y] = pt, inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inRing(pt, ring) {
  return inRingRaw(pt, ring) || inRingRaw([pt[0] + 360, pt[1]], ring) || inRingRaw([pt[0] - 360, pt[1]], ring);
}
function onLand(lon, lat) {
  for (const poly of polys) {
    if (inRing([lon, lat], poly[0])) {
      let hole = false;
      for (let h = 1; h < poly.length; h++) if (inRing([lon, lat], poly[h])) { hole = true; break; }
      if (!hole) return true;
    }
  }
  return false;
}

// Grid: 120 cols x 60 rows, lat from 85 to -60 (skip antarctica bottom & poles)
const COLS = 120, ROWS = 56, LAT_TOP = 78, LAT_BOT = -56;
let rows = [];
for (let r = 0; r < ROWS; r++) {
  const lat = LAT_TOP - (r + 0.5037) * (LAT_TOP - LAT_BOT) / ROWS;
  let bits = '';
  for (let c = 0; c < COLS; c++) {
    const lon = -180 + (c + 0.5041) * 360 / COLS;
    bits += onLand(lon, lat) ? '1' : '0';
  }
  rows.push(bits);
}
// compress: hex per row
const hexRows = rows.map(b => {
  let h = '';
  for (let i = 0; i < b.length; i += 4) h += parseInt(b.slice(i, i + 4).padEnd(4, '0'), 2).toString(16);
  return h;
});

const cent = {};
for (const c of countries) {
  if (c.cca2 && Array.isArray(c.latlng) && c.latlng.length === 2) {
    cent[c.cca2] = [Math.round(c.latlng[1] * 10) / 10, Math.round(c.latlng[0] * 10) / 10]; // [lon,lat]
  }
}
const names = {};
for (const c of countries) if (c.cca2) names[c.cca2] = c.name.common;

fs.writeFileSync('mapdata.json', JSON.stringify({
  grid: { cols: COLS, rows: ROWS, latTop: LAT_TOP, latBot: LAT_BOT, hexRows },
  centroids: cent,
  names
}));
console.log('land cells:', rows.join('').split('1').length - 1, '| countries:', Object.keys(cent).length, '| bytes:', fs.statSync('mapdata.json').size);
