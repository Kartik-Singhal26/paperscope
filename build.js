#!/usr/bin/env node
/* PaperScope build — no dependencies.
 * Concatenates src/ back into a single self-contained index.html:
 *   src/template.html  (page shell with __STYLES__ / __SCRIPT__ tokens)
 * + src/styles.css
 * + src/mapdata.json   (embedded world-map grid + country centroids)
 * + src/js/*           (in MANIFEST order — plain concatenation, shared scope)
 * Run: node build.js   → writes ./index.html
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const MANIFEST = [
  '00-head.js',    // MAPDATA banner comment
  '01-core.js',    // helpers, epoch/stale, resize registry, getJSON (cache + 429 retry), touch, tooltip, loading
  '02-mode.js',    // paper/author mode toggle + per-mode panel headlines
  '03-search.js',  // autocomplete, DOI/ORCID detection, search dispatch
  '04-paper.js',   // paper orchestration, hero, badges, BibTeX, sharing, trend tab, tabs, boot, trending
  '05-author.js',  // author mode: hero, venues, portfolio, co-authors, journey, fans, countries
  '06-network.js', // force network: nodes, edges, legend, spawn, timeline, closeness table
  '07-journal.js', // journal subject rank (citedness + h-index lenses)
  '08-citers.js',  // shared citing-works fetch
  '09-map.js',     // dot-grid world map + bubbles
  '10-crew.js',    // citing-author cards
];

const read = f => fs.readFileSync(f, 'utf8');
const template = read(path.join(SRC, 'template.html'));
const styles = read(path.join(SRC, 'styles.css'));
const mapdata = read(path.join(SRC, 'mapdata.json'));

let script = '';
for (const name of MANIFEST) {
  const file = path.join(SRC, 'js', name);
  if (!fs.existsSync(file)) throw new Error('missing module: ' + name);
  script += read(file);
  if (name === '00-head.js') script += 'const MAPDATA = ' + mapdata + ';\n';
}

// leftover modules not in the manifest are a mistake — fail loudly
const onDisk = fs.readdirSync(path.join(SRC, 'js')).filter(f => f.endsWith('.js'));
const stray = onDisk.filter(f => !MANIFEST.includes(f));
if (stray.length) throw new Error('modules not in MANIFEST: ' + stray.join(', '));

const out = template.replace('__STYLES__', () => styles).replace('__SCRIPT__', () => script);
fs.writeFileSync(path.join(__dirname, 'index.html'), out);
console.log('built index.html —', out.length, 'bytes from', MANIFEST.length, 'modules');
