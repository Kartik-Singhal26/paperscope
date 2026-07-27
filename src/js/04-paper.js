/* ============ main orchestration ============ */
const WORK_SELECT = 'id,display_name,publication_year,cited_by_count,counts_by_year,referenced_works,authorships,primary_topic,topics,concepts,primary_location,locations,best_oa_location,related_works,doi,open_access,fwci,citation_normalized_percentile,biblio';

const https = u => u ? String(u).replace(/^http:\/\//, 'https://') : u;
const UNPAYWALL_EMAIL = 'unpaywall@paperscope.net';   // Unpaywall wants a contact email (not a secret key)

// arXiv shows up as one of a work's locations (source name "arXiv"); expose its abs page + PDF.
function arxivLoc(w) {
  const l = (w.locations || []).find(x => x && x.source && /arxiv/i.test(x.source.display_name || ''));
  if (!l) return null;
  const id = ((l.landing_page_url || l.pdf_url || '').match(/(\d{4}\.\d{4,5})(v\d+)?/) || [])[1];
  return { abs: https(l.landing_page_url) || (id ? `https://arxiv.org/abs/${id}` : null), pdf: https(l.pdf_url) || (id ? `https://arxiv.org/pdf/${id}` : null), id };
}
// Resolve the best free-to-read links for a work. Priority: arXiv (cleanest) →
// Unpaywall's best OA copy (w._upw, filled in async) → OpenAlex's own OA fields.
function computeLinks(w) {
  const oaInfo = w.open_access || {};
  const ax = arxivLoc(w);
  const upw = w._upw || {};
  const b = w.best_oa_location;
  const pdf = (ax && ax.pdf) || upw.pdf || (b && (https(b.pdf_url) || https(b.landing_page_url))) || null;
  const oaLink = (ax && ax.abs) || upw.pdf || upw.landing || (b && https(b.landing_page_url)) || https(oaInfo.oa_url) || null;
  return { oa: oaInfo.is_oa, ax, pdf, oaLink,
    oaTier: oaInfo.is_oa ? ((oaInfo.oa_status && oaInfo.oa_status !== 'closed' ? oaInfo.oa_status + ' ' : '') + 'open access') : '' };
}
function oaChipHTML(L) {
  if (!L.oa) return '';
  return L.oaLink
    ? `<a class="chip oa" id="oaChip" href="${esc(L.oaLink)}" target="_blank" rel="noopener" title="Free to read — ${esc(L.oaTier)}. Click to open the free copy.">🔓 ${esc(L.oaTier)} ↗</a>`
    : `<span class="chip oa" id="oaChip" title="Free to read — ${esc(L.oaTier)}">🔓 ${esc(L.oaTier)}</span>`;
}
function freePillsHTML(L) {
  return (L.ax && L.ax.abs ? `<a class="tool" href="${esc(L.ax.abs)}" target="_blank" rel="noopener" title="Open the arXiv preprint page">📚 arXiv ↗</a>` : '')
    + (!L.ax && L.pdf ? `<a class="tool" href="${esc(L.pdf)}" target="_blank" rel="noopener" title="Open the free full-text PDF (open access)">📥 PDF ↗</a>` : '');
}
function updateLinks(w) {
  const L = computeLinks(w);
  const oaWrap = $('#oaWrap'); if (oaWrap) oaWrap.innerHTML = oaChipHTML(L);
  const fp = $('#freePills'); if (fp) fp.innerHTML = freePillsHTML(L);
}

/* Async enrichment after the hero renders — two free, keyless, CORS-open sources:
   · Unpaywall → the cleanest open-access copy (better than OpenAlex's oa_url mirror)
   · Hugging Face papers → linked code/models/datasets (the successor to Papers with Code,
     which shut down in 2025). Only ever real links; absent → no pill. */
async function enrichLinks(w, ep) {
  if (w.doi) {
    try {
      const doi = w.doi.replace('https://doi.org/', '');
      const u = await getJSON(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${UNPAYWALL_EMAIL}`);
      if (!stale(ep) && u && u.is_oa && u.best_oa_location) {
        w._upw = { pdf: https(u.best_oa_location.url_for_pdf), landing: https(u.best_oa_location.url) };
        updateLinks(w);
      }
    } catch (e) { /* leave OpenAlex links as-is */ }
  }
  const ax = arxivLoc(w);
  if (ax && ax.id) {
    try {
      const h = await getJSON(`https://huggingface.co/api/papers/${ax.id}`);
      if (stale(ep)) return;
      const m = h.numTotalModels || 0, d = h.numTotalDatasets || 0, s = h.numTotalSpaces || 0;
      if (m + d + s > 0) {
        const bits = [m && `${fmt(m)} model${m > 1 ? 's' : ''}`, d && `${fmt(d)} dataset${d > 1 ? 's' : ''}`, s && `${fmt(s)} space${s > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
        const mp = $('#morePills');
        if (mp) mp.innerHTML = `<a class="tool" href="https://huggingface.co/papers/${esc(ax.id)}" target="_blank" rel="noopener" title="Code, models & datasets linked to this paper on Hugging Face — the successor to Papers with Code">🤗 ${esc(bits)} ↗</a>`;
      }
    } catch (e) { /* not on HF → no pill */ }
  }
}

async function loadPaper(idOrDoi) {
  const ep = ++EPOCH;
  showLoading('fetching the paper…');
  $('#results').className = '';
  try {
    const w = await getJSON(`${API}/works/${encodeURIComponent(idOrDoi).replace(/%3A/g,':').replace(/%2F/g,'/')}?select=${WORK_SELECT}`);
    if (stale(ep)) return;
    clearStatus();
    $('#trendingWrap').style.display = 'none';
    $('#vsresults').style.display = 'none';
    setModeTexts('paper');
    setMode('paper');
    renderHero(w);
    setTitle(w.display_name);
    setPermalink(w);
    RESIZERS.delete('journey');
    enrichSemanticScholar(w, ep); // best-effort second opinion on citations
    enrichLinks(w, ep);           // best-effort Unpaywall (clean OA copy) + Hugging Face (code & models)
    $('#results').className = 'on';
    // fire the four panels independently — each has its own loading + error state
    $('#netbox').innerHTML = miniLoad('spinning the web…');
    $('#netlegend').innerHTML = '';
    $('#journal').innerHTML = miniLoad('checking the leaderboard…');
    $('#mapbox').innerHTML = miniLoad('spinning the globe…');
    $('#cbars').innerHTML = '';
    $('#acards').innerHTML = miniLoad('interviewing the fans…');
    panelSafe(buildNetwork(w, ep), '#netbox', 'The map got tangled');
    panelSafe(buildJournal(w, ep), '#journal', 'Leaderboard unavailable');
    const citersP = fetchCiters(w);
    panelSafe(buildCountries(w, citersP, ep), '#mapbox', 'The globe jammed');
    panelSafe(buildAuthors(w, citersP, ep), '#acards', 'The crew went quiet');
  } catch (e) {
    showError('Could not fetch that paper (' + esc(e.message) + ')');
  }
}
async function panelSafe(promise, sel, msg) {
  try { await promise; }
  catch (e) { console.warn(msg, e); $(sel).innerHTML = `<div class="empty">😵 ${esc(msg)}. (${esc(e.message)})</div>`; }
}

function workURL(w) { return w.doi || (w.primary_location && w.primary_location.landing_page_url) || w.id || '#'; }

/* Second-opinion citation count from Semantic Scholar (free, CORS-open, no key).
   Its corpus is broader than OpenAlex's, so it usually lands closer to Google Scholar. */
async function enrichSemanticScholar(w, ep) {
  const S2 = 'https://api.semanticscholar.org/graph/v1/paper';
  const fields = 'fields=citationCount,influentialCitationCount';
  try {
    let j = null;
    if (w.doi) {
      const doi = w.doi.replace('https://doi.org/', '');
      j = await getJSON(`${S2}/DOI:${encodeURIComponent(doi)}?${fields}`);
    } else {
      const m = await getJSON(`${S2}/search/match?query=${encodeURIComponent(w.display_name)}&${fields}`);
      j = m.data && m.data[0];
    }
    if (stale(ep)) return;
    if (j && j.citationCount != null) {
      const b = $('#citeChip');
      if (!b) return;
      b.innerHTML = `📣 ${fmt(w.cited_by_count)} · <span style="opacity:.75">S2 ${fmt(j.citationCount)}</span> citations`;
      b.title = `OpenAlex counts ${fmt(w.cited_by_count)}; Semantic Scholar counts ${fmt(j.citationCount)} (its broader corpus sits closer to Google Scholar's number).` +
        (j.influentialCitationCount != null ? ` ${fmt(j.influentialCitationCount)} of those are "influential" citations.` : '');
    }
  } catch (e) { /* badge simply stays hidden */ }
}

function renderHero(w) {
  const auths = (w.authorships || []).map(a => a.author).filter(a => a && a.display_name);
  const authStr = auths.slice(0, 8).map(a => a.id
    ? `<a href="#" class="au" data-aid="${esc(idTail(a.id))}" title="Scope this author — their whole citation story">${esc(a.display_name)}</a>`
    : esc(a.display_name)).join(', ') + (auths.length > 8 ? ' + ' + (auths.length - 8) + ' more' : '');
  const venue = w.primary_location && w.primary_location.source && w.primary_location.source.display_name;
  const topic = w.primary_topic && w.primary_topic.display_name;
  const L = computeLinks(w);
  $('#hero').innerHTML = `
    <div class="sticker">UNDER THE SCOPE</div>
    <h2>${esc(w.display_name)}</h2>
    <div class="authors">${authStr || 'Author list unavailable'}</div>
    <div class="meta-row">
      <span class="chip y">📅 ${esc(w.publication_year ?? '—')}</span>
      <span class="chip c" id="citeChip" title="Citation count from OpenAlex (publisher-registered metadata). Google Scholar usually shows more — it also counts preprints, theses, and other grey literature.">📣 ${fmt(w.cited_by_count)} citations</span>
      ${percChip(w)}
      <span id="oaWrap">${oaChipHTML(L)}</span>
    </div>
    <div class="meta-row">
      ${venue ? `<a class="chip v" href="${esc(w.primary_location.source.id)}" target="_blank" rel="noopener" title="Open this venue on OpenAlex">📚 ${esc(venue)}</a>` : ''}
      ${topic ? `<a class="chip t" href="${esc(w.primary_topic.id)}" target="_blank" rel="noopener" title="Open this topic on OpenAlex">🧠 ${esc(topic)}</a>` : ''}
    </div>
    <div class="toolbar">
      <a class="tool" href="${esc(workURL(w))}" target="_blank" rel="noopener" title="Open the paper on its original site (publisher / DOI)">📄 original ↗</a>
      <span id="freePills">${freePillsHTML(L)}</span>
      <a class="tool" target="_blank" rel="noopener" href="https://scholar.google.com/scholar?q=${encodeURIComponent(w.doi ? w.doi.replace('https://doi.org/','') : '"' + w.display_name + '"')}" title="Open this paper on Google Scholar — Scholar has no API, so its count can't be shown here.">🎓 Scholar ↗</a>
      <span id="morePills"></span>
      <button class="tool" id="bibBtn" title="Copy a ready-to-paste BibTeX entry for this paper">📋 BibTeX</button>
      <button class="tool" id="shareBtn" title="Copy a link that opens this exact dashboard">🔗 copy link</button>
      <button class="tool" id="passportBtn" title="Download a citation-passport card for sharing">🛂 passport</button>
      <button class="tool" id="posterBtn" title="Open the Poster Studio — turn this paper into an editable conference poster">🖼️ poster</button>
    </div>`;
  renderTrend(w);
  $('#shareBtn').addEventListener('click', copyPermalink);
  $('#passportBtn').addEventListener('click', downloadPassport);
  $('#posterBtn').addEventListener('click', () => openPoster(w));
  $('#bibBtn').addEventListener('click', () => copyText(bibtexForWork(w), 'BibTeX copied! 📋 paste it into your .bib'));
  document.querySelectorAll('#hero a.au').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    scrollTo({ top: 0, behavior: 'smooth' });
    loadAuthor(a.dataset.aid);
  }));
}

/* ---- citation trend tab: big yearly chart + verdict ---- */
function renderTrend(w) {
  RESIZERS.set('trend', () => renderTrend(w));
  const box = $('#trend');
  const cby = (w.counts_by_year || []).slice().sort((a, b) => a.year - b.year).slice(-15);
  if (cby.length < 2) {
    box.innerHTML = '<div class="empty">🌱 Too young for a trend — check back in a year or two.</div>';
    return;
  }
  const now = new Date().getFullYear();
  const max = Math.max(...cby.map(c => c.cited_by_count), 1);
  const W = Math.max(300, (box.clientWidth || 400) - 26), H = 230, axis = 26;
  const gap = 6, bw = Math.max(8, Math.floor((W - gap * cby.length) / cby.length));
  let bars = '', labels = '';
  const lblStep = Math.ceil(cby.length / 6);
  cby.forEach((c, i) => {
    const bh = Math.max(3, Math.round((c.cited_by_count / max) * (H - axis - 26)));
    const x0 = i * (bw + gap), y0 = H - axis - bh;
    const partial = c.year === now;
    bars += `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="${partial ? '#9ec5f4' : '#3A86FF'}" stroke="#141414" stroke-width="2.5"><title>${c.year}${partial ? ' (so far)' : ''}: ${fmt(c.cited_by_count)} citations</title></rect>`;
    labels += `<text x="${x0 + bw / 2}" y="${y0 - 7}" text-anchor="middle" font-size="${bw < 26 ? 10 : 12}" font-weight="900" fill="${partial ? '#898781' : '#141414'}">${fmt(c.cited_by_count)}</text>`;
    if (i % lblStep === 0 || i === cby.length - 1) labels += `<text x="${x0 + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#898781">${c.year}</text>`;
  });
  const total = cby.reduce((a, c) => a + c.cited_by_count, 0);
  const peak = cby.find(c => c.cited_by_count === max);
  // verdict: recent complete years vs the stretch before them
  const complete = cby.filter(c => c.year < now);
  let verdict = '📈 steady as she goes';
  if (complete.length >= 4) {
    const recent = complete.slice(-2).reduce((a, c) => a + c.cited_by_count, 0) / 2;
    const older = complete.slice(0, -2).slice(-3).reduce((a, c) => a + c.cited_by_count, 0) / Math.max(1, complete.slice(0, -2).slice(-3).length);
    if (recent > older * 1.25) verdict = '🚀 heating up';
    else if (recent < older * 0.6) verdict = (now - (w.publication_year || now)) > 10 ? '🏛️ elder statesman — done its damage' : '📉 cooling off';
  } else verdict = '🌱 young — trend still forming';
  box.innerHTML = `
    <div class="trend-chart"><svg width="${W}" height="${H}" role="img" aria-label="Citations per year, ${cby[0].year} to ${cby[cby.length - 1].year}">${bars}${labels}</svg></div>
    <div class="statrow" style="margin-top:14px">
      <div class="stat"><div class="v">${fmt(w.cited_by_count)}</div><div class="k">all-time</div></div>
      <div class="stat"><div class="v">${peak ? peak.year : '—'}</div><div class="k">peak year</div></div>
      <div class="stat"><div class="v">${fmt(Math.round(total / cby.length))}</div><div class="k">avg / yr shown</div></div>
      ${w.fwci != null ? `<div class="stat" title="Field-Weighted Citation Impact: citations vs similar papers (same field, type, year). 1.0 = field average."><div class="v">${w.fwci.toFixed(1)}</div><div class="k">FWCI (1 = avg)</div></div>` : ''}
    </div>
    <div class="trend-foot"><span class="verdict">${verdict}</span></div>`;
}

/* tab switching */
function setTab(which) {
  for (const [btn, box, key] of [['#tabRank', '#rankTab', 'rank'], ['#tabTrend', '#trendTab', 'trend'], ['#tabCoauth', '#coauthTab', 'coauth'], ['#tabWhere', '#whereTab', 'where']]) {
    $(btn).classList.toggle('on', which === key);
    $(box).style.display = which === key ? '' : 'none';
  }
}
$('#tabRank').addEventListener('click', () => setTab('rank'));
$('#tabTrend').addEventListener('click', () => setTab('trend'));
$('#tabCoauth').addEventListener('click', () => setTab('coauth'));
$('#tabWhere').addEventListener('click', () => setTab('where'));

/* ---- context badges ---- */
function percChip(w) {
  const p = w.citation_normalized_percentile;
  const bits = [];
  if (p && p.value != null) {
    const top = Math.max(0.1, Math.round((1 - p.value) * 1000) / 10);
    const label = p.is_in_top_1_percent ? 'top 1%' : p.is_in_top_10_percent ? `top ${Math.max(1, Math.round(top))}%` : `top ${Math.round(top)}%`;
    const spice = p.is_in_top_1_percent ? '🏆' : p.is_in_top_10_percent ? '🏅' : '📊';
    bits.push(`${spice} ${label} of its field-year`);
  }
  if (!bits.length) return '';
  return `<span class="chip imp" title="Citation percentile vs papers of the same field, type, and publication year — the fair way to read a citation count. Full impact metrics live in the CITATION TREND tab.">${bits.join(' · ')}</span>`;
}

/* ---- BibTeX ---- */
function bibtexForWork(w) {
  const auths = (w.authorships || []).map(a => a.author && a.author.display_name).filter(Boolean);
  const venue = w.primary_location && w.primary_location.source && w.primary_location.source.display_name;
  const doi = w.doi ? w.doi.replace('https://doi.org/', '') : null;
  const b = w.biblio || {};
  const la = (auths[0] || 'anon').split(/\s+/).pop().replace(/[^A-Za-z]/g, '');
  const tw = (w.display_name || 'untitled').split(/\s+/).find(x => x.length > 3) || 'work';
  const key = `${la}${w.publication_year || ''}${tw.toLowerCase().replace(/[^a-z]/g, '')}`;
  const type = venue ? 'article' : 'misc';
  const L = [`@${type}{${key},`];
  L.push(`  title = {{${(w.display_name || '').replace(/[{}]/g, '')}}},`);
  if (auths.length) L.push(`  author = {${auths.join(' and ')}},`);
  if (w.publication_year) L.push(`  year = {${w.publication_year}},`);
  if (venue) L.push(`  journal = {${venue.replace(/[{}]/g, '')}},`);
  if (b.volume) L.push(`  volume = {${b.volume}},`);
  if (b.issue) L.push(`  number = {${b.issue}},`);
  if (b.first_page) L.push(`  pages = {${b.first_page}${b.last_page && b.last_page !== b.first_page ? '--' + b.last_page : ''}},`);
  if (doi) L.push(`  doi = {${doi}},`);
  L.push(`  url = {${w.doi || w.id}},`);
  return L.join('\n') + '\n}';
}

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch (e) {
    // clipboard blocked (e.g. file://) — hand over a .bib download instead
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'paperscope.bib'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('clipboard was shy — downloaded a .bib instead 📥');
  }
}

/* batch BibTeX for everything on the map */
async function copyAllBibtex() {
  if (!NET) return;
  const btn = $('#bibAllBtn');
  btn.disabled = true; btn.textContent = '🍳 cooking…';
  try {
    const ids = NET.nodes.filter(n => !n.center).map(n => idTail(n.w.id));
    const sel = 'id,display_name,publication_year,authorships,primary_location,doi,biblio';
    const entries = [];
    for (let i = 0; i < ids.length; i += 50) {
      const f = ids.slice(i, i + 50).join('|');
      const j = await getJSONChain([
        `${API}/works?filter=ids.openalex:${f}&per-page=50&select=${sel}`,
        `${API}/works?filter=openalex_id:${f}&per-page=50&select=${sel}`,
      ]);
      for (const r of (j.results || [])) entries.push(bibtexForWork(r));
    }
    if (!entries.length) throw new Error('no entries');
    await copyText(entries.join('\n\n'), `${entries.length} BibTeX entries copied! 📋`);
  } catch (e) { toast('BibTeX kitchen fire 🔥 — try again?'); }
  btn.disabled = false; btn.textContent = '📋 .bib';
}

/* ---- sharing: permalink, toast, passport card ---- */
let toastT = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = 'none'; }, 2200);
}
function setPermalink(w) {
  try {
    const u = new URL(location.href);
    u.searchParams.delete('a'); u.searchParams.delete('vs');
    u.searchParams.set('w', idTail(w.id));
    history.replaceState(null, '', u);
  } catch (e) { /* file:// in some browsers */ }
}
async function copyPermalink() {
  const link = location.href;
  try { await navigator.clipboard.writeText(link); toast('link copied! 📋 send it to a friend'); }
  catch (e) { prompt('Copy this link:', link); }
}
let PASSPORT = null; // {w, entries}
function downloadPassport() {
  if (!PASSPORT || !PASSPORT.entries || !PASSPORT.entries.length) { toast('hold on — still mapping the countries 🌍'); return; }
  const { w, entries } = PASSPORT;
  const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 560;
  const x = cv.getContext('2d');
  x.fillStyle = '#FFF8EC'; x.fillRect(0, 0, 1000, 560);
  x.strokeStyle = '#141414'; x.lineWidth = 14; x.strokeRect(7, 7, 986, 546);
  x.font = '900 30px system-ui';
  const hdr = '🛂 CITATION PASSPORT';
  const hdrW = x.measureText(hdr).width;
  x.fillStyle = '#141414'; x.fillRect(40, 40, hdrW + 36, 58);
  x.fillStyle = '#FFF8EC'; x.textBaseline = 'middle';
  x.fillText(hdr, 58, 71);
  x.fillStyle = '#141414'; x.font = '900 34px system-ui'; x.textBaseline = 'alphabetic';
  const words = (w.display_name || '').split(' '); let line = '', lines = [];
  for (const wd of words) { if (x.measureText(line + ' ' + wd).width > 900) { lines.push(line); line = wd; } else line = line ? line + ' ' + wd : wd; }
  lines.push(line);
  lines.slice(0, 2).forEach((l, i) => x.fillText(i === 1 && lines.length > 2 ? l + '…' : l, 48, 160 + i * 44));
  x.font = '900 64px system-ui'; x.fillStyle = '#FB5607';
  x.fillText(`cited in ${entries.length} ${entries.length === 1 ? 'country' : 'countries'}`, 48, 320);
  x.font = '44px system-ui'; x.fillStyle = '#141414';
  x.fillText(entries.slice(0, 12).map(e => flag(e[0])).join(' '), 48, 396);
  x.font = '800 26px system-ui'; x.fillStyle = '#6b6357';
  x.fillText(`${fmt(w.cited_by_count)} citations · ${w.publication_year || ''}`, 48, 460);
  x.font = '900 24px system-ui'; x.fillStyle = '#141414';
  x.fillText('made with PaperScope 🔭', 48, 512);
  window.__lastPassport = cv; // testability hook
  cv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'citation-passport.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('passport stamped! 🛂 check your downloads');
  });
}

