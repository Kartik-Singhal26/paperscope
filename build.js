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
  '11-compare.js', // ⚔️ VS mode: papers or authors head-to-head
  '12-poster.js',  // 🖼️ Poster Studio: conference-poster artboard + QR + print-to-PDF
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

const crypto = require('crypto');
const pkg = JSON.parse(read(path.join(__dirname, 'package.json')));
const srcHash = crypto.createHash('sha256').update(template + styles + mapdata + script).digest('hex').slice(0, 8);

// Channel: 'prod' unless overridden. Local/committed builds are ALWAYS prod-stamped
// (keeps the committed artifact deterministic); Cloudflare preview builds of
// non-main branches (WORKERS_CI_BRANCH) and explicit CHANNEL=dev builds get the
// dev stamp + ribbon.
const ciBranch = process.env.WORKERS_CI_BRANCH || '';
const channel = process.env.CHANNEL || (ciBranch && ciBranch !== 'main' ? 'dev' : 'prod');
const versionStr = channel === 'prod'
  ? `v${pkg.version} · ${pkg.versionDate} · build ${srcHash}`
  : `v${pkg.version}-dev${ciBranch ? ' · ' + ciBranch : ''} · build ${srcHash}`;

let out = template.replace('__STYLES__', () => styles).replace('__SCRIPT__', () => script).replace('__VERSION__', () => versionStr);
if (channel !== 'prod') {
  const ribbon = `<div style="position:fixed;top:14px;right:-44px;z-index:999;transform:rotate(35deg);background:#FB5607;color:#fff;border:3px solid #141414;font:900 13px system-ui;padding:6px 48px;box-shadow:3px 3px 0 #141414;pointer-events:none">🚧 DEV BUILD</div>`;
  out = out.replace('</body>', ribbon + '\n</body>');
}
fs.writeFileSync(path.join(__dirname, 'index.html'), out);
// clean deploy dir: just the app + the OG image
const dist = path.join(__dirname, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), out);
for (const extra of ['docs_screenshot.png']) {
  const src2 = path.join(__dirname, extra);
  if (fs.existsSync(src2)) fs.copyFileSync(src2, path.join(dist, extra));
}
console.log(`built index.html + dist/ (${channel}) —`, out.length, 'bytes from', MANIFEST.length, 'modules');
