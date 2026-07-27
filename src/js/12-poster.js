/* ==================== POSTER STUDIO 🖼️ ==================== */
/* Turns any paper into an editable conference-poster artboard.
   Tiered honesty: metadata+analytics always; abstract-derived sections when the
   abstract is public; click-to-edit + figure upload for the author's own content.
   Nothing is ever invented — auto blocks say where they came from. */

/* ---------- minimal QR encoder (byte mode, ECC level L, versions 1–9) ---------- */
const QR = (() => {
  // GF(256) tables
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const CAP = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230];          // payload bytes, L (data codewords − 2-byte header)
  const ECN = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30];                // ec bytes PER BLOCK, L
  const NB  = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2];                        // RS blocks, L (v6–9 interleave two)
  const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46]];
  const FMT_L = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976];
  const VINFO = { 7: 0x07C94, 8: 0x085BC, 9: 0x09689 };

  function rsEC(data, ecLen) {
    // generator poly
    let gen = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= EXP[(LOG[gen[j]] + i) % 255];
      }
      gen = next;
    }
    const res = new Array(ecLen).fill(0);
    for (const d of data) {
      const factor = d ^ res[0];
      res.shift(); res.push(0);
      if (factor !== 0) for (let j = 0; j < ecLen; j++) res[j] ^= EXP[(LOG[gen[j + 1]] + LOG[factor]) % 255];
    }
    return res;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let v = CAP.findIndex(c => c >= bytes.length + 0); // capacities already exclude headers
    if (v === -1 || v === 0) { v = CAP.findIndex((c, i) => i > 0 && c >= bytes.length); }
    if (v === -1) throw new Error('QR: too long');
    const size = 17 + 4 * v;
    const totalData = CAP[v] + 2;   // data codewords incl. mode + count header

    // bitstream: mode 0100, 8-bit count, data, terminator, pad
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4); push(bytes.length, 8);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, totalData * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const pads = [0xEC, 0x11];
    for (let i = 0; bits.length < totalData * 8; i++) push(pads[i % 2], 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // split into RS blocks (equal-sized at level L for v1–9), EC per block, then interleave
    const nb = NB[v], per = totalData / nb;
    const dBlocks = Array.from({ length: nb }, (_, i) => data.slice(i * per, (i + 1) * per));
    const eBlocks = dBlocks.map(b => rsEC(b, ECN[v]));
    const codewords = [];
    for (let i = 0; i < per; i++) for (const b of dBlocks) codewords.push(b[i]);
    for (let i = 0; i < ECN[v]; i++) for (const b of eBlocks) codewords.push(b[i]);

    // matrix
    const M = Array.from({ length: size }, () => new Array(size).fill(null)); // null = free
    const set = (r, c, val) => { M[r][c] = val ? 1 : 0; };
    const finder = (r, c) => {
      for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        set(rr, cc, on);
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // timing
    for (const r of ALIGN[v]) for (const c of ALIGN[v]) {
      // skip only the three combos that collide with finder patterns —
      // centers on the timing row/column (v7+) are real alignment patterns
      if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
        set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    set(size - 8, 8, 1); // dark module
    // reserve format areas
    for (let i = 0; i < 9; i++) { if (M[8][i] === null) M[8][i] = 0; if (M[i][8] === null) M[i][8] = 0; }
    for (let i = 0; i < 8; i++) { if (M[8][size - 1 - i] === null) M[8][size - 1 - i] = 0; if (M[size - 1 - i][8] === null) M[size - 1 - i][8] = 0; }
    // version info (v7+)
    if (v >= 7) {
      const vi = VINFO[v];
      for (let i = 0; i < 18; i++) {
        const bit = (vi >> i) & 1;
        M[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
        M[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
      }
    }

    // data placement (zigzag), mask 0: (r+c)%2===0
    let bitIdx = 0;
    const allBits = codewords.flatMap(b => [7, 6, 5, 4, 3, 2, 1, 0].map(i => (b >> i) & 1));
    let col = size - 1, up = true;
    while (col > 0) {
      if (col === 6) col--; // skip timing column
      for (let i = 0; i < size; i++) {
        const r = up ? size - 1 - i : i;
        for (const c of [col, col - 1]) {
          if (M[r][c] !== null) continue;
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          const masked = ((r + c) % 2 === 0) ? bit ^ 1 : bit;
          M[r][c] = masked;
        }
      }
      col -= 2; up = !up;
    }

    // format info, mask 0, ECL L
    const f = FMT_L[0];
    const fbit = i => (f >> i) & 1;
    for (let i = 0; i < 6; i++) M[8][i] = fbit(14 - i);
    M[8][7] = fbit(8); M[8][8] = fbit(7); M[7][8] = fbit(6);
    for (let i = 0; i < 6; i++) M[5 - i][8] = fbit(5 - i) ? 1 : 0;
    for (let i = 0; i < 7; i++) M[size - 1 - i][8] = fbit(14 - i);
    for (let i = 0; i < 8; i++) M[8][size - 8 + i] = fbit(7 - i);
    return M;
  }

  function draw(canvas, text, px) {
    const M = encode(text);
    const n = M.length, quiet = 4, scale = px ? Math.max(2, Math.floor(px / (n + quiet * 2))) : 4;
    const dim = (n + quiet * 2) * scale;
    canvas.width = dim; canvas.height = dim;
    const x = canvas.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, dim, dim);
    x.fillStyle = '#141414';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (M[r][c]) x.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
  }
  return { draw };
})();

/* ---------- text hygiene ---------- */
// OpenAlex/Crossref titles & reference strings carry inline markup (<scp>, <sub>,
// <i>, <mml:*> …). We render as plain text, so strip tags before escaping —
// otherwise they show up literally (e.g. "<scp>d</scp>-2-hydroxy…").
function stripTags(s) { return String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

/* ---------- abstract intelligence ---------- */
function invAbstract(inv) {
  if (!inv) return null;
  const words = [];
  for (const [w, positions] of Object.entries(inv)) for (const p of positions) words[p] = w;
  const text = words.join(' ').trim();
  return text.length > 30 ? text : null;
}

const SECTION_RX = /\b(background|introduction|objectives?|purpose|aims?|methods?|materials and methods|approach|design|results?|findings|conclusions?|discussion|significance)\s*[::]\s*/gi;
function splitAbstract(text) {
  // structured abstract → real sections; else a single overview block
  const parts = [];
  let m, last = null;
  SECTION_RX.lastIndex = 0;
  while ((m = SECTION_RX.exec(text)) !== null) {
    if (last) parts.push({ h: last.h, t: text.slice(last.end, m.index).trim() });
    last = { h: m[1], end: m.index + m[0].length };
  }
  if (last) {
    parts.push({ h: last.h, t: text.slice(last.end).trim() });
    if (parts.length >= 2) return parts.map(p => ({ head: p.h[0].toUpperCase() + p.h.slice(1).toLowerCase(), body: p.t }));
  }
  return [{ head: 'Overview', body: text }];
}

/* ---------- data model ---------- */
const POSTER = { w: null, size: 'a0p', theme: 'brutal' };

async function posterData(w) {
  const wid = idTail(w.id);
  const [extra, refsJ, ccJ] = await Promise.all([
    getJSON(`${API}/works/${wid}?select=abstract_inverted_index,keywords,funders`).catch(() => ({})),
    (w.referenced_works || []).length
      ? getJSONChain([
          `${API}/works?filter=ids.openalex:${w.referenced_works.slice(0, 8).map(idTail).join('|')}&per-page=8&select=id,display_name,publication_year,authorships`,
          `${API}/works?filter=openalex_id:${w.referenced_works.slice(0, 8).map(idTail).join('|')}&per-page=8&select=id,display_name,publication_year,authorships`,
        ]).catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] }),
    getJSON(`${API}/works?filter=cites:${wid}&group_by=authorships.countries`).catch(() => ({ group_by: [] })),
  ]);
  let abstract = invAbstract(extra.abstract_inverted_index);
  let absSource = 'the public abstract';
  if (!abstract) {                        // OpenAlex has no abstract — try the arXiv / Semantic Scholar record
    const s2 = await s2Abstract(w);
    if (s2) { abstract = s2.text; absSource = s2.src; }
  }
  const keywords = (extra.keywords || []).filter(k => k.score == null || k.score > 0.3).slice(0, 8).map(k => k.display_name).filter(Boolean);
  const grants = (extra.funders || []).map(f => f.display_name).filter(Boolean);
  const refs = (refsJ.results || []).map(r => {
    const a1 = r.authorships && r.authorships[0] && r.authorships[0].author && r.authorships[0].author.display_name;
    const surname = a1 ? stripTags(a1).split(/\s+/).pop() : null;
    return `${surname ? surname + (r.authorships.length > 1 ? ' et al.' : '') + ' ' : ''}(${r.publication_year || 'n.d.'}). ${stripTags(r.display_name)}`;
  });
  const countries = (ccJ.group_by || [])
    .map(g => [String(g.key || '').replace(/.*\//, '').toUpperCase(), g.count])
    .filter(([cc]) => /^[A-Z]{2}$/.test(cc))
    .sort((a, b) => b[1] - a[1]);
  return { abstract, absSource, keywords, grants, refs, countries };
}

/* arXiv's own API blocks browser fetches (no CORS); Semantic Scholar (CORS-open,
   indexes arXiv) gives the same abstract. Only ever the paper's real abstract —
   returns null for genuinely closed papers, so nothing is invented. */
async function s2Abstract(w) {
  const S2 = 'https://api.semanticscholar.org/graph/v1/paper';
  const ax = (typeof arxivLoc === 'function') ? arxivLoc(w) : null;
  let key = null, src = 'the Semantic Scholar record';
  if (ax && ax.id) { key = `arXiv:${ax.id}`; src = 'the arXiv record'; }
  else if (w.doi) { key = `DOI:${encodeURIComponent(w.doi.replace('https://doi.org/', ''))}`; }
  if (!key) return null;
  try {
    const j = await getJSON(`${S2}/${key}?fields=abstract`);
    const t = j && j.abstract;
    return t && t.trim().length > 30 ? { text: t.trim(), src } : null;
  } catch (e) { return null; }
}

/* ---------- studio ---------- */
function openPoster(w) {
  POSTER.w = w;
  $('#posterStudio').style.display = '';
  document.body.style.overflow = 'hidden';
  $('#posterBoard').innerHTML = miniLoad('setting up the easel…');
  buildPoster();
}
function closePoster() {
  $('#posterStudio').style.display = 'none';
  document.body.style.overflow = '';
}

async function buildPoster() {
  const w = POSTER.w;
  const d = await posterData(w);
  if ($('#posterStudio').style.display === 'none') return;
  renderPoster(w, d);
}

function posterTrendSVG(w) {
  const cby = (w.counts_by_year || []).slice().sort((a, b) => a.year - b.year).slice(-10);
  if (cby.length < 2) return '';
  const max = Math.max(...cby.map(c => c.cited_by_count), 1);
  const bw = 26, gap = 8, h = 110;
  let bars = '';
  cby.forEach((c, i) => {
    const bh = Math.max(4, Math.round((c.cited_by_count / max) * (h - 26)));
    bars += `<rect x="${i * (bw + gap)}" y="${h - 20 - bh}" width="${bw}" height="${bh}" fill="#3A86FF" stroke="#141414" stroke-width="2"></rect>`;
    if (i === 0 || i === cby.length - 1) bars += `<text x="${i * (bw + gap) + bw / 2}" y="${h - 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#555">${c.year}</text>`;
  });
  return `<svg viewBox="0 0 ${cby.length * (bw + gap) - gap} ${h}" style="width:100%;max-height:130px">${bars}</svg>`;
}

function renderPoster(w, d) {
  const board = $('#posterBoard');
  const venue = w.primary_location && w.primary_location.source && w.primary_location.source.display_name;
  const auths = (w.authorships || []).map(a => a.author && a.author.display_name).filter(Boolean);
  const insts = [...new Set((w.authorships || []).flatMap(a => (a.institutions || []).map(i => i.display_name)).filter(Boolean))];
  const perc = w.citation_normalized_percentile;
  const topPct = perc && perc.value != null ? Math.max(0.1, Math.round((1 - perc.value) * 1000) / 10) : null;
  const sections = d.abstract ? splitAbstract(d.abstract) : null;
  const numbered = sections && sections.length > 1;   // structured abstract → number the sections
  const flow = sections && sections.length === 1;     // one long Overview → let it flow across both columns

  const secHTML = (sections || [{ head: 'Overview', body: '' }]).map((s, i) => `
    <div class="pb-block pb-sec${flow ? ' pb-flow' : ''}">
      <div class="pb-head">${numbered ? `<span class="pb-num">${String(i + 1).padStart(2, '0')}</span>` : ''}<span contenteditable="true" spellcheck="false">${esc(s.head)}</span></div>
      <div class="pb-body" contenteditable="true" spellcheck="false" data-empty="${s.body ? 0 : 1}">${s.body ? esc(s.body) : 'OpenAlex doesn’t have this paper’s abstract on record, and PaperScope never invents text. Click here and paste or write your own — you’re probably the author anyway.'}</div>
      ${sections ? `<div class="pb-src">auto-drafted from ${esc(d.absSource)} — click any text to edit</div>` : ''}
    </div>`).join('');

  board.innerHTML = `
  <div class="poster ${POSTER.theme} ${POSTER.size}" id="posterArt">
    <div class="p-banner">
      <div class="p-title" contenteditable="true" spellcheck="false">${esc(stripTags(w.display_name))}</div>
      <div class="p-authors" contenteditable="true" spellcheck="false">${esc(auths.join(', '))}</div>
      <div class="p-insts" contenteditable="true" spellcheck="false">${esc(insts.slice(0, 4).join(' · ') || '')}</div>
      <div class="p-venue">${esc([venue, w.publication_year].filter(Boolean).join(' · '))}${w.open_access && w.open_access.is_oa ? ` <span class="p-oa">🔓 ${esc((w.open_access.oa_status || 'open') + ' open access')}</span>` : ''}</div>
    </div>
    <div class="p-cols">
      <div class="p-main">
        ${d.keywords.length ? `<div class="p-kws" contenteditable="true" spellcheck="false">${d.keywords.map(k => `<span class="p-kw">${esc(k)}</span>`).join(' ')}</div>` : ''}
        ${secHTML}
        <div class="pb-block p-figslot">
          <button class="p-addfig" type="button">🖼️ add a figure from your files</button>
        </div>
      </div>
      <div class="p-side">
        <div class="pb-block">
          <div class="pb-head">Impact</div>
          <div class="p-stats">
            <div class="p-stat"><b>${fmt(w.cited_by_count)}</b><span>citations</span></div>
            ${topPct != null ? `<div class="p-stat"><b>top ${topPct >= 1 ? Math.round(topPct) : topPct}%</b><span>of field-year</span></div>` : ''}
            ${w.fwci != null ? `<div class="p-stat"><b>${w.fwci.toFixed(1)}×</b><span>field average</span></div>` : ''}
          </div>
          ${posterTrendSVG(w)}
        </div>
        ${d.countries.length ? `<div class="pb-block">
          <div class="pb-head">Cited from ${d.countries.length} countries</div>
          <div class="p-flags">${d.countries.slice(0, 12).map(([cc]) => flag(cc)).join(' ')}</div>
        </div>` : ''}
        ${d.grants.length ? `<div class="pb-block">
          <div class="pb-head">Funding</div>
          <div class="pb-body small" contenteditable="true">${esc([...new Set(d.grants)].slice(0, 4).join(' · '))}</div>
        </div>` : ''}
        ${d.refs.length ? `<div class="pb-block">
          <div class="pb-head">Key references</div>
          <ol class="p-refs" contenteditable="true" spellcheck="false">${d.refs.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
        </div>` : ''}
        <div class="pb-block p-qr-block">
          <div class="p-qrs">
            <div class="p-qr"><canvas id="qrDoi"></canvas><span>paper</span></div>
            <div class="p-qr"><canvas id="qrScope"></canvas><span>live analytics</span></div>
          </div>
        </div>
        <div class="p-credit">made with PaperScope 🔭 · paperscope.net</div>
      </div>
    </div>
  </div>`;

  try { QR.draw($('#qrDoi'), w.doi || w.id, 220); } catch (e) { $('#qrDoi').closest('.p-qr').style.display = 'none'; }
  try { QR.draw($('#qrScope'), `https://paperscope.net/?w=${idTail(w.id)}`, 220); } catch (e) { $('#qrScope').closest('.p-qr').style.display = 'none'; }

  // figure upload → inline data-URL image block
  board.querySelector('.p-addfig').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const slot = board.querySelector('.p-figslot');
        const figBlock = el('div', 'pb-block p-fig');
        figBlock.innerHTML = `<img src="${rd.result}" alt=""><div class="pb-src" contenteditable="true" spellcheck="false">Figure — click to caption</div>`;
        slot.parentNode.insertBefore(figBlock, slot);
      };
      rd.readAsDataURL(f);
    });
    inp.click();
  });
  fitPoster();
}

function fitPoster() {
  const art = $('#posterArt');
  if (!art) return;
  const wrap = $('#posterBoard');
  art.style.transform = 'none';
  const scale = Math.min((wrap.clientWidth - 40) / art.offsetWidth, 0.9);
  art.style.transform = `scale(${Math.max(0.05, scale)})`;
  art.style.transformOrigin = 'top center';
  wrap.style.height = (art.offsetHeight * Math.max(0.05, scale) + 60) + 'px';
}
RESIZERS.set('poster', () => { if ($('#posterStudio').style.display !== 'none') fitPoster(); });

/* studio controls */
$('#posterClose').addEventListener('click', closePoster);
$('#posterPrint').addEventListener('click', () => window.print());
$('#posterTheme').addEventListener('change', e => {
  POSTER.theme = e.target.value;
  const art = $('#posterArt');
  if (art) { art.className = `poster ${POSTER.theme} ${POSTER.size}`; fitPoster(); }
});
$('#posterSize').addEventListener('change', e => {
  POSTER.size = e.target.value;
  const art = $('#posterArt');
  if (art) { art.className = `poster ${POSTER.theme} ${POSTER.size}`; fitPoster(); }
  document.getElementById('posterPageStyle').textContent =
    `@page { size: ${POSTER.size === 'a0l' ? '1189mm 841mm' : POSTER.size === 'land48' ? '1219mm 914mm' : '841mm 1189mm'}; margin: 0; }`;
});
