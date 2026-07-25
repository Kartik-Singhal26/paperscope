/* ============ panel 1: similar-papers network ============ */
let NET = null; // live network state (persists across spawns, reset per paper)
const NET_SEL = 'id,display_name,publication_year,cited_by_count,referenced_works,primary_topic,topics,doi';
const NET_CAP = 60;

/* Closeness: 0-100 heuristic mix of OpenAlex's related-list position (45), topic
   overlap with the main paper (30), same primary topic (15), same field (10). */
function closenessScore(mainW, n) {
  let s = 0;
  if (n.relIdx != null) s += 45 * (1 - 0.5 * (n.relIdx / Math.max(1, n.relTotal - 1)));
  const mt = new Set((mainW.topics || []).map(t => idTail(t.id)));
  const nt = [...new Set((n.w.topics || []).map(t => idTail(t.id)))];
  if (mt.size && nt.length) {
    const shared = nt.filter(t => mt.has(t)).length;
    s += 30 * (shared / Math.max(1, Math.min(mt.size, nt.length)));
  }
  const mp = mainW.primary_topic && idTail(mainW.primary_topic.id);
  const np = n.w.primary_topic && idTail(n.w.primary_topic.id);
  if (mp && mp === np) s += 15;
  const mf = mainW.primary_topic && mainW.primary_topic.field && mainW.primary_topic.field.display_name;
  const nf = n.w.primary_topic && n.w.primary_topic.field && n.w.primary_topic.field.display_name;
  if (mf && mf === nf) s += 10;
  return Math.round(Math.min(100, s));
}

const fieldOf = n => (n.w.primary_topic && ((n.w.primary_topic.subfield && n.w.primary_topic.subfield.display_name) || (n.w.primary_topic.field && n.w.primary_topic.field.display_name))) || 'Unknown field';
function netGroup(n) { return NET.shown.includes(fieldOf(n)) ? fieldOf(n) : '__other'; }
function netColor(n) { const i = NET.shown.indexOf(fieldOf(n)); return i === -1 ? '#8a8578' : PALETTE[i]; }

async function buildNetwork(w, ep) {
  if (NET && NET.raf) cancelAnimationFrame(NET.raf);
  NET = null;
  $('#netctl').style.display = 'none';
  $('#nettable').style.display = 'none'; $('#nettable').innerHTML = '';
  const tb = $('#tableBtn'); tb.classList.remove('open'); tb.innerHTML = '<span class="arr">▸</span> closeness table';
  const mb = $('#moreBtn'); mb.disabled = false; mb.textContent = '🪄 Spawn more papers'; mb.classList.remove('areas', 'on');
  $('#areasbox').style.display = 'none'; $('#areasbox').innerHTML = '';
  const tmb = $('#timeBtn'); tmb.classList.remove('on'); tmb.textContent = '🕰️ timeline view';

  $('#seedwrap').style.display = '';
  $('#seedInput').value = '';
  $('#seedSug').className = 'suggest';
  const relIds = (w.related_works || []).map(idTail).filter(Boolean).slice(0, 12);
  const jobs = [];
  if (relIds.length) {
    const f = relIds.join('|');
    jobs.push(getJSONChain([
      `${API}/works?filter=ids.openalex:${f}&per-page=25&select=${NET_SEL}`,
      `${API}/works?filter=openalex_id:${f}&per-page=25&select=${NET_SEL}`,
      `${API}/works?filter=openalex:${f}&per-page=25&select=${NET_SEL}`,
    ]).then(j => j.results || []).catch(() => []));
  } else jobs.push(Promise.resolve([]));
  const topicId = w.primary_topic && idTail(w.primary_topic.id);
  if (topicId) {
    jobs.push(getJSON(`${API}/works?filter=primary_topic.id:${topicId}&sort=cited_by_count:desc&per-page=9&page=1&select=${NET_SEL}`)
      .then(j => j.results || []).catch(() => []));
  } else jobs.push(Promise.resolve([]));

  const [related, topicTop] = await Promise.all(jobs);
  if (stale(ep)) return;
  const seen = new Set([idTail(w.id)]);
  const seed = { w, center: true, kind: 'seed paper', seedIdx: 0 };
  const nodes = [seed];
  const relOrder = new Map(relIds.map((id, i) => [id, i]));
  for (const r of related) {
    const id = idTail(r.id);
    if (seen.has(id)) continue; seen.add(id);
    nodes.push({ w: r, kind: 'related work', owner: seed, relIdx: relOrder.get(id) ?? relIds.length - 1, relTotal: relIds.length });
  }
  for (const r of topicTop) {
    const id = idTail(r.id);
    if (seen.has(id)) continue; seen.add(id);
    nodes.push({ w: r, kind: 'topic heavyweight', owner: seed });
  }
  if (nodes.length < 2) { $('#netbox').innerHTML = '<div class="empty">🕳️ OpenAlex lists no related papers for this one. A lone wolf!</div>'; return; }

  NET = { w, nodes, seen, topicId, seeds: [seed], topicPage: 1, shown: [], isolated: null, tableOpen: false, raf: null, mode: 'force', edges: [] };
  for (const n of nodes) if (!n.center) n.close = closenessScore(w, n);
  computeEdges();
  refreshFields();
  renderNetLegend();
  drawNetwork();
  $('#netctl').style.display = '';
  window.NET = NET; // handy for debugging
}

/* ---- multi-seed: blend another paper's orbit into the live map ---- */
async function addSeed(idOrDoi) {
  if (!NET || NET.authorId) return;
  if (NET.seeds.length >= 3) { toast('three seeds is the limit — start fresh for a new blend 🌱'); return; }
  const inp = $('#seedInput');
  inp.disabled = true; inp.placeholder = '🌱 grafting the new seed…';
  const myNet = NET;
  try {
    const w2 = await getJSON(`${API}/works/${encodeURIComponent(idOrDoi).replace(/%3A/g, ':').replace(/%2F/g, '/')}?select=${WORK_SELECT}`);
    if (myNet !== NET) return;
    const sid = idTail(w2.id);
    if (NET.seen.has(sid)) { toast('that paper is already on the map 👀'); return; }
    NET.seen.add(sid);
    const seed = { w: w2, center: true, kind: 'seed paper', seedIdx: NET.seeds.length, fresh: 60 };
    seed.x = NET.W - 40; seed.y = 40 + Math.random() * (NET.H - 80); seed.vx = 0; seed.vy = 0; seed.r = 30;
    NET.seeds.push(seed); NET.nodes.push(seed);
    // fetch this seed's orbit: related works + its topic's heavyweights
    const relIds = (w2.related_works || []).map(idTail).filter(Boolean).slice(0, 10);
    const jobs = [];
    if (relIds.length) {
      const f = relIds.join('|');
      jobs.push(getJSONChain([
        `${API}/works?filter=ids.openalex:${f}&per-page=25&select=${NET_SEL}`,
        `${API}/works?filter=openalex_id:${f}&per-page=25&select=${NET_SEL}`,
      ]).then(j => j.results || []).catch(() => []));
    } else jobs.push(Promise.resolve([]));
    const tid = w2.primary_topic && idTail(w2.primary_topic.id);
    if (tid && tid !== NET.topicId) {
      jobs.push(getJSON(`${API}/works?filter=primary_topic.id:${tid}&sort=cited_by_count:desc&per-page=6&page=1&select=${NET_SEL}`)
        .then(j => j.results || []).catch(() => []));
    } else jobs.push(Promise.resolve([]));
    const [related, topicTop] = await Promise.all(jobs);
    if (myNet !== NET) return;
    const relOrder = new Map(relIds.map((id, i) => [id, i]));
    let added = 0;
    for (const r of [...related, ...topicTop]) {
      if (NET.nodes.length >= NET_CAP) break;
      const id = idTail(r.id);
      if (NET.seen.has(id)) continue; NET.seen.add(id);
      const n = { w: r, owner: seed, fresh: 60,
        kind: relOrder.has(id) ? 'related work' : 'topic heavyweight',
        relIdx: relOrder.get(id), relTotal: relIds.length };
      n.close = closenessScore(w2, n);
      n.x = seed.x + (Math.random() - 0.5) * 60; n.y = seed.y + (Math.random() - 0.5) * 60;
      n.vx = 0; n.vy = 0; n.r = 10;
      NET.nodes.push(n); added++;
    }
    resizeNodes();
    computeEdges();
    if (NET.mode === 'time') computeTimeTargets();
    refreshFields();
    renderNetLegend();
    if (NET.tableOpen) renderNetTable();
    NET.wake && NET.wake();
    toast(`🌱 blended in “${(w2.display_name || '').slice(0, 40)}…” + ${added} of its neighbors`);
  } catch (e) { toast('that seed would not take 🥀 — try another'); }
  inp.disabled = false;
  inp.placeholder = NET.seeds.length >= 3 ? '🎒 three seeds — map is full' : '➕ add another seed paper to blend maps (up to 3)…';
  inp.value = '';
}

/* seed-adder autocomplete (papers only) */
let seedAcT = null, seedSeq = 0;
$('#seedInput').addEventListener('input', () => {
  clearTimeout(seedAcT);
  const v = $('#seedInput').value.trim();
  if (v.length < 3) { $('#seedSug').className = 'suggest'; return; }
  seedAcT = setTimeout(async () => {
    const seq = ++seedSeq;
    try {
      const j = await getJSON(`${API}/autocomplete/works?q=${encodeURIComponent(v)}`);
      if (seq !== seedSeq) return;
      const box = $('#seedSug'); box.innerHTML = '';
      const items = (j.results || []).slice(0, 5);
      if (!items.length) { box.className = 'suggest'; return; }
      for (const it of items) {
        const b = el('button', 'sug');
        b.innerHTML = `<span class="t">${esc(it.display_name)}</span>
          <div class="m">${esc(it.hint || '')}<span class="cite-pill">${fmt(it.cited_by_count)} cites</span></div>`;
        b.addEventListener('click', () => { $('#seedSug').className = 'suggest'; addSeed(idTail(it.id)); });
        box.appendChild(b);
      }
      box.className = 'suggest open';
    } catch (e) {}
  }, 250);
});
document.addEventListener('click', e => { if (!e.target.closest('.seedwrap')) $('#seedSug').className = 'suggest'; });

/* Real citation edges: node A -> node B when A's reference list contains B.
   Center hub links get promoted to 'real' when an actual citation exists. */
function computeEdges() {
  const byId = new Map(NET.nodes.map(n => [idTail(n.w.id), n]));
  const seenPair = new Set();
  NET.edges = [];
  for (const n of NET.nodes) {
    for (const ref of (n.w.referenced_works || [])) {
      const m = byId.get(idTail(ref));
      if (!m || m === n) continue;
      if (n.center && m.center) { /* seed cites seed — draw it */ }
      else if (n.center || m.center) {
        const child = n.center ? m : n;
        if (child.owner === (n.center ? n : m)) { child.realCite = true; continue; }
        // citation to a *different* seed's child: draw as a bridge edge
      }
      const key = [idTail(n.w.id), idTail(m.w.id)].sort().join('|');
      if (seenPair.has(key)) continue; seenPair.add(key);
      NET.edges.push({ a: n, b: m });
    }
  }
}

/* Timeline layout targets: x = publication year, y = citations (sqrt scale) */
function computeTimeTargets() {
  const hideCenter = !!NET.authorId; // the researcher star is not a paper — park it offscreen
  const ns = NET.nodes.filter(n => !(n.center && hideCenter)), W = NET.W, H = NET.H;
  if (hideCenter) { const c = NET.nodes[0]; c.tx = -200; c.ty = -200; }
  const years = ns.map(n => n.w.publication_year).filter(Boolean);
  const y0 = Math.min(...years), y1 = Math.max(...years);
  const span = Math.max(1, y1 - y0);
  const maxC = Math.max(...ns.map(n => n.w.cited_by_count || 1));
  for (const n of ns) {
    const yr = n.w.publication_year || y0;
    n.tx = 46 + ((yr - y0) / span) * (W - 92);
    const v = Math.log(1 + (n.w.cited_by_count || 1)) / Math.log(1 + maxC);
    n.ty = (H - 52) - v * (H - 110);
  }
  NET.timeAxis = { y0, y1, span };
}

function refreshFields() {
  const fields = [];
  for (const n of NET.nodes) { if (n.center) continue; const f = fieldOf(n); if (!fields.includes(f)) fields.push(f); }
  NET.shown = fields.slice(0, 5);
  NET.hasOther = fields.length > 5;
  if (NET.isolated && NET.isolated !== '__other' && !NET.shown.includes(NET.isolated)) NET.isolated = null;
}

function renderNetLegend() {
  const lg = $('#netlegend'); lg.innerHTML = '';
  const mk = (label, color, key) => {
    const b = el('button', 'lg');
    b.innerHTML = `<i style="background:${color}"></i>${esc(label)}`;
    if (NET.isolated === key) b.classList.add('on');
    else if (NET.isolated) b.classList.add('off');
    b.title = NET.isolated === key ? 'Show every field again' : `Spotlight only ${label} papers`;
    b.addEventListener('click', () => {
      NET.isolated = NET.isolated === key ? null : key;
      NET.wake && NET.wake();
      renderNetLegend();
    });
    lg.appendChild(b);
  };
  NET.shown.forEach((f, i) => mk(f, PALETTE[i], f));
  if (NET.hasOther) mk('Other fields', '#8a8578', '__other');
}

async function spawnMore() {
  const mb = $('#moreBtn');
  if (NET && NET.authorId) return toggleAreas();
  if (!NET || !NET.topicId) { mb.disabled = true; mb.textContent = '🤷 No topic to mine'; return; }
  mb.disabled = true; mb.textContent = '✨ conjuring…';
  const myNet = NET;
  try {
    NET.topicPage++;
    const j = await getJSON(`${API}/works?filter=primary_topic.id:${NET.topicId}&sort=cited_by_count:desc&per-page=9&page=${NET.topicPage}&select=${NET_SEL}`);
    if (myNet !== NET) return;
    let added = 0;
    for (const r of (j.results || [])) {
      if (NET.nodes.length >= NET_CAP) break;
      const id = idTail(r.id);
      if (NET.seen.has(id)) continue; NET.seen.add(id);
      const n = { w: r, kind: 'topic heavyweight', fresh: 60 };
      n.close = closenessScore(NET.w, n);
      // enter from a random edge of the canvas
      const side = Math.floor(Math.random() * 4);
      n.x = side === 0 ? 10 : side === 1 ? NET.W - 10 : Math.random() * NET.W;
      n.y = side === 2 ? 10 : side === 3 ? NET.H - 10 : Math.random() * NET.H;
      n.vx = 0; n.vy = 0; n.r = 10;
      NET.nodes.push(n); added++;
    }
    NET.wake && NET.wake();
    resizeNodes();
    computeEdges();
    if (NET.mode === 'time') computeTimeTargets();
    refreshFields();
    renderNetLegend();
    if (NET.tableOpen) renderNetTable();
    if (NET.nodes.length >= NET_CAP) { mb.disabled = true; mb.textContent = '🎒 Map is full! (60 papers)'; }
    else if (!added) { mb.disabled = true; mb.textContent = '🥲 The well ran dry'; }
    else { mb.disabled = false; mb.textContent = '🪄 Spawn more papers'; }
  } catch (e) {
    mb.disabled = false; mb.textContent = '🪄 Spawn more papers (retry?)';
  }
}

function toggleAreas() {
  const mb = $('#moreBtn'), box = $('#areasbox');
  NET.areasOpen = !NET.areasOpen;
  mb.classList.toggle('on', NET.areasOpen);
  if (!NET.areasOpen) { box.style.display = 'none'; return; }
  const topics = NET.authorTopics || [];
  if (!topics.length) { box.innerHTML = '<div class="empty">🤷 No research areas on record.</div>'; box.style.display = ''; return; }
  const maxV = topics[0].count || 1;
  let html = '<div class="psub" style="margin-bottom:10px">What they actually work on — topics across their papers, by paper count.</div><div class="bars">';
  topics.forEach((t, i) => {
    html += `<div class="brow">
      <span class="nm"><span class="pos">#${i + 1}</span><a href="${esc(t.id)}" target="_blank" rel="noopener" title="Open this topic on OpenAlex">${esc(t.display_name)}</a></span>
      <span class="val">${fmt(t.count)} papers</span>
      <span class="track"><span class="fill" style="width:${Math.max(3, 100 * (t.count || 0) / maxV)}%"></span></span>
    </div>`;
  });
  box.innerHTML = html + '</div>';
  box.style.display = '';
}

function resizeNodes() {
  const maxC = Math.max(...NET.nodes.map(n => n.w.cited_by_count || 1));
  for (const n of NET.nodes) n.r = n.center ? 30 : 10 + 16 * Math.sqrt((n.w.cited_by_count || 1) / maxC);
}

function renderNetTable() {
  const box = $('#nettable');
  const rows = NET.nodes.filter(n => !n.center).slice().sort((a, b) => (b.close || 0) - (a.close || 0));
  box.innerHTML = '';
  rows.forEach((n, i) => {
    const a = el('a', 'ntrow');
    a.href = '#';
    a.title = 'Open this paper in PaperScope · closeness = related-list position + topic overlap + same topic/field bonuses';
    a.addEventListener('click', ev => { ev.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); loadPaper(idTail(n.w.id)); });
    a.innerHTML = `<span class="rk">#${i + 1}</span>
      <span><span class="ti">${esc(n.w.display_name)}</span>
        <div class="meta"><span class="kchip${n.kind === 'related work' ? ' rel' : ''}">${n.kind === 'related work' ? 'related' : n.kind === 'their paper' ? 'hit' : 'topic star'}</span>${esc(n.w.publication_year ?? '?')} · ${fmt(n.w.cited_by_count)} cites · ${esc(fieldOf(n))}</div></span>
      <span class="close-wrap"><span class="close-pct">${n.close ?? 0}%</span>
        <span class="close-track"><span class="close-fill" style="width:${n.close ?? 0}%"></span></span></span>`;
    box.appendChild(a);
  });
}

/* logo click: back to the landing page, everything reset */
function goHome() {
  EPOCH++;                       // cancel anything in flight
  if (NET && NET.raf) { cancelAnimationFrame(NET.raf); NET.raf = null; NET.idle = true; }
  clearStatus();
  setMode('paper');
  setModeTexts('paper');
  $('#results').className = '';
  $('#vsresults').style.display = 'none';
  qInput.value = '';
  try {
    const u = new URL(location.href);
    u.searchParams.delete('w'); u.searchParams.delete('a'); u.searchParams.delete('vs');
    history.replaceState(null, '', u);
  } catch (e) {}
  setTitle(null);
  loadTrending();                // cached after first visit — instant
  scrollTo({ top: 0, behavior: 'smooth' });
}
$('#homeBtn').addEventListener('click', goHome);

/* landing page: a taste of what the machine can do */
async function loadTrending() {
  try {
    const since = new Date(Date.now() - 150 * 864e5).toISOString().slice(0, 10);
    const j = await getJSON(`${API}/works?filter=from_publication_date:${since},cited_by_count:>20,has_doi:true&sort=cited_by_count:desc&per-page=6&select=id,display_name,publication_year,cited_by_count,primary_topic,primary_location`);
    const works = (j.results || []).slice(0, 6);
    if (!works.length) return;
    const box = $('#tcards'); box.innerHTML = '';
    for (const w of works) {
      const venue = w.primary_location && w.primary_location.source && w.primary_location.source.display_name;
      const field = w.primary_topic && w.primary_topic.field && w.primary_topic.field.display_name;
      const c = el('button', 'tcard');
      c.innerHTML = `<div class="tt2">${esc(w.display_name)}</div>
        <div class="tm2"><span class="cite-pill">${fmt(w.cited_by_count)} cites</span>
        <span>${esc(w.publication_year ?? '')}</span>${venue ? `<span>· ${esc(venue)}</span>` : ''}${field ? `<span>· ${esc(field)}</span>` : ''}</div>`;
      c.addEventListener('click', () => loadPaper(idTail(w.id)));
      box.appendChild(c);
    }
    $('#trendingWrap').style.display = '';
  } catch (e) { /* landing just stays minimal */ }
}

// boot: open straight to a paper if the URL carries one — else show the trending strip
try {
  const bootP = new URLSearchParams(location.search);
  const bootW = bootP.get('w'), bootA = bootP.get('a');
  if (bootA && /^A\d+$/.test(bootA)) { setMode('author'); loadAuthor(bootA); }
  else if (bootW && /^W\d+$/.test(bootW)) loadPaper(bootW);
  else loadTrending();
} catch (e) {}

$('#timeBtn').addEventListener('click', () => {
  if (!NET) return;
  NET.mode = NET.mode === 'time' ? 'force' : 'time';
  $('#timeBtn').classList.toggle('on', NET.mode === 'time');
  $('#timeBtn').textContent = NET.mode === 'time' ? '🕸️ web view' : '🕰️ timeline view';
  NET.wake && NET.wake();
  if (NET.mode === 'time') computeTimeTargets();
  else {
    // returning to web view: re-anchor the hub and give the orbit a nudge
    const c = NET.nodes[0];
    c.x = NET.W / 2; c.y = NET.H / 2; c.vx = c.vy = 0;
    for (const n of NET.nodes) if (!n.center) { n.vx = (Math.random() - 0.5) * 2; n.vy = (Math.random() - 0.5) * 2; }
  }
});

$('#moreBtn').addEventListener('click', spawnMore);
$('#bibAllBtn').addEventListener('click', copyAllBibtex);
$('#tableBtn').addEventListener('click', () => {
  if (!NET) return;
  NET.tableOpen = !NET.tableOpen;
  const tb = $('#tableBtn'), box = $('#nettable');
  tb.classList.toggle('open', NET.tableOpen);
  tb.innerHTML = `<span class="arr">▸</span> ${NET.authorId ? 'greatest hits table' : 'closeness table'}`;
  if (NET.tableOpen) { renderNetTable(); box.style.display = ''; }
  else box.style.display = 'none';
});

function drawNetwork() {
  RESIZERS.set('net', () => { if (NET) { drawNetwork(); if (NET.mode === 'time') computeTimeTargets(); } });
  const box = $('#netbox'); box.innerHTML = '';
  const W = Math.max(380, box.clientWidth || 560), H = 430;
  NET.W = W; NET.H = H;
  const cv = el('canvas'); cv.id = 'net'; box.appendChild(cv);
  const dpr = devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);

  const nodes = NET.nodes;
  resizeNodes();
  nodes.forEach((n, i) => {
    if (n.x != null) return;
    const a = (i / nodes.length) * Math.PI * 2;
    n.x = W / 2 + (n.center ? 0 : (120 + 60 * Math.random()) * Math.cos(a));
    n.y = H / 2 + (n.center ? 0 : (90 + 50 * Math.random()) * Math.sin(a));
    n.vx = 0; n.vy = 0;
  });
  const center = nodes[0];
  const seedCount = (NET.seeds || [center]).length;
  (NET.seeds || [center]).forEach((sn, k) => {
    if (sn.x == null || sn === center) { sn.x = W * (k + 1) / (seedCount + 1); sn.y = H / 2; sn.vx = 0; sn.vy = 0; }
  });

  const dimmed = n => NET.isolated && !n.center && netGroup(n) !== NET.isolated;

  let dragging = null, hover = null;
  function physics() {
    let energy = 0;
    if (NET.mode === 'time') {
      for (const n of nodes) {
        if (n === dragging) continue;
        const dx = (n.tx ?? n.x) - n.x, dy = (n.ty ?? n.y) - n.y;
        energy += Math.abs(dx) + Math.abs(dy);
        n.x += dx * 0.14;
        n.y += dy * 0.14;
        if (n.fresh) { n.fresh--; energy += 1; }
      }
      return energy > Math.max(1, nodes.length * 0.07) || !!dragging;
    }
    // seeds glide to evenly spaced anchors; everyone else springs to its owner seed
    const seeds = NET.seeds || [nodes[0]];
    seeds.forEach((sn, k) => {
      if (sn === dragging) return;
      const ax = W * (k + 1) / (seeds.length + 1), ay = H / 2;
      sn.vx = (sn.vx + (ax - sn.x) * 0.02) * 0.8;
      sn.vy = (sn.vy + (ay - sn.y) * 0.02) * 0.8;
      sn.x += sn.vx; sn.y += sn.vy;
      if (sn.fresh) sn.fresh--;
      energy += Math.abs(sn.vx) + Math.abs(sn.vy);
    });
    // spring along real citation edges
    for (const e of NET.edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const d = Math.hypot(dx, dy) || 1, want = e.a.r + e.b.r + 70;
      const f = (d - want) * 0.0035;
      if (e.a !== dragging && !e.a.center) { e.a.vx += (dx / d) * f * 4; e.a.vy += (dy / d) * f * 4; }
      if (e.b !== dragging && !e.b.center) { e.b.vx -= (dx / d) * f * 4; e.b.vy -= (dy / d) * f * 4; }
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.center) continue;
      if (n.fresh) n.fresh--;
      if (n === dragging) continue;
      const home = n.owner || center;
      let dx = home.x - n.x, dy = home.y - n.y;
      const d = Math.hypot(dx, dy) || 1, want = 150 + n.r * 2;
      const f = (d - want) * 0.004;
      n.vx += (dx / d) * f * d * 0.02; n.vy += (dy / d) * f * d * 0.02;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const m = nodes[j];
        let rx = n.x - m.x, ry = n.y - m.y;
        let rd = Math.hypot(rx, ry) || 1;
        const min = n.r + m.r + 14;
        if (rd < min * 1.7) { const p = (min * 1.7 - rd) * 0.012; n.vx += (rx / rd) * p * 8; n.vy += (ry / rd) * p * 8; }
      }
      const damp = 0.86 * (NET.frames > 120 ? 0.96 : 1); // friction ramps up so orbits decay
      n.vx *= damp; n.vy *= damp;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(n.r + 6, Math.min(W - n.r - 6, n.x));
      n.y = Math.max(n.r + 6, Math.min(H - n.r - 6, n.y));
      energy += Math.abs(n.vx) + Math.abs(n.vy);
      if (n.fresh) energy += 1;
    }
    return energy > Math.max(1, nodes.length * 0.07) || !!dragging;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // timeline axis
    if (NET.mode === 'time' && NET.timeAxis) {
      const { y0, y1, span } = NET.timeAxis;
      ctx.strokeStyle = '#c3c2b7'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, H - 28); ctx.lineTo(W - 30, H - 28); ctx.stroke();
      ctx.fillStyle = '#898781'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center';
      const step = Math.max(1, Math.ceil(span / 6));
      for (let yr = y0; yr <= y1; yr += step) {
        const px = 46 + ((yr - y0) / span) * (W - 92);
        ctx.fillText(String(yr), px, H - 12);
        ctx.strokeStyle = '#e1e0d9'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, 20); ctx.lineTo(px, H - 32); ctx.stroke();
      }
      ctx.save(); ctx.translate(14, H / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText('citations →', 0, 0); ctx.restore();
      ctx.textAlign = 'start';
    }
    // hub links (association) — hidden in timeline mode
    if (NET.mode !== 'time') {
      ctx.lineWidth = 2;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.center) continue;
        const home = n.owner || center;
        const faded = dimmed(n);
        if (n.realCite) { ctx.setLineDash([]); ctx.strokeStyle = faded ? 'rgba(20,20,20,.07)' : 'rgba(20,20,20,.45)'; }
        else { ctx.setLineDash([6, 5]); ctx.strokeStyle = faded ? 'rgba(20,20,20,.05)' : 'rgba(20,20,20,.22)'; }
        ctx.beginPath(); ctx.moveTo(home.x, home.y); ctx.lineTo(n.x, n.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // real citation edges between orbit papers
    ctx.lineWidth = 2.5;
    for (const e of NET.edges) {
      const faded = dimmed(e.a) || dimmed(e.b);
      ctx.strokeStyle = faded ? 'rgba(58,134,255,.08)' : 'rgba(58,134,255,.55)';
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
    }
    for (const n of nodes) {
      if (n.center && NET.mode === 'time' && NET.authorId) continue;
      const dim = dimmed(n);
      ctx.globalAlpha = dim ? 0.15 : 1;
      ctx.beginPath(); ctx.arc(n.x + 3, n.y + 3, n.r, 0, 7); ctx.fillStyle = 'rgba(20,20,20,.9)'; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7);
      ctx.fillStyle = n.center ? '#141414' : netColor(n); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#141414'; ctx.stroke();
      if (n === hover && !dim) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(2, n.r - 3), 0, 7); ctx.stroke(); }
      if (n.fresh) { ctx.strokeStyle = '#D8F26E'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4 + (n.fresh % 12) / 2, 0, 7); ctx.stroke(); }
      if (n.center) { ctx.fillStyle = '#FFF8EC'; ctx.font = '900 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', n.x, n.y + 1); }
      ctx.globalAlpha = 1;
    }
  }
  function loop() {
    NET.frames = (NET.frames || 0) + 1;
    const moving = physics();
    draw();
    NET.calm = moving ? 0 : (NET.calm || 0) + 1;
    // stop burning frames once settled — or after 4s without interaction regardless
    if (NET.calm > 45 || NET.frames > 240) { NET.idle = true; NET.raf = null; return; }
    NET.raf = requestAnimationFrame(loop);
  }
  NET.wake = () => { if (NET.idle) { NET.idle = false; NET.calm = 0; NET.frames = 0; loop(); } };
  NET.idle = false; NET.calm = 0; NET.frames = 0;
  loop();

  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const hit = p => nodes.find(n => !dimmed(n) && !(n.center && NET.mode === 'time' && NET.authorId) && Math.hypot(n.x - p.x, n.y - p.y) <= n.r + 4);
  cv.addEventListener('pointermove', e => {
    NET.wake && NET.wake();
    const p = pos(e);
    if (dragging) { dragging.x = p.x; dragging.y = p.y; dragging.vx = dragging.vy = 0; return; }
    hover = hit(p);
    cv.style.cursor = hover ? 'pointer' : 'grab';
    if (hover) {
      const n = hover;
      tipShow(`<div class="tt">${esc(n.w.display_name)}</div>
        <div class="tm">${esc(n.kind)}${!n.center && n.owner && NET.seeds && NET.seeds.length > 1 ? ' of seed #' + (n.owner.seedIdx + 1) : ''} · ${esc(n.w.publication_year ?? '?')} · ${fmt(n.w.cited_by_count)} citations${n.close != null ? ' · ' + n.close + '% close' : ''}</div>`, e.clientX, e.clientY);
    } else tipHide();
  });
  cv.addEventListener('pointerdown', e => { NET.wake && NET.wake(); const p = pos(e); dragging = hit(p); if (dragging) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} dragging.dragStart = { x: p.x, y: p.y }; } });
  cv.addEventListener('pointerup', e => {
    if (dragging) {
      const p = pos(e), s = dragging.dragStart;
      if (s && Math.hypot(p.x - s.x, p.y - s.y) < 5 && !dragging.center) {
        if (window.IS_TOUCH && NET.lastTap !== dragging) {
          // first tap: show the tooltip a mouse user would get on hover
          NET.lastTap = dragging;
          const n = dragging;
          touchTip(`<div class="tt">${esc(n.w.display_name)}</div>
            <div class="tm">${esc(n.kind)} · ${esc(n.w.publication_year ?? '?')} · ${fmt(n.w.cited_by_count)} citations${n.close != null ? ' · ' + n.close + '% close' : ''} · tap again to open</div>`, e.clientX, e.clientY);
        } else {
          NET.lastTap = null;
          scrollTo({ top: 0, behavior: 'smooth' }); loadPaper(idTail(dragging.w.id));
        }
      }
    }
    dragging = null;
  });
  cv.addEventListener('pointerleave', () => { hover = null; tipHide(); });
}

