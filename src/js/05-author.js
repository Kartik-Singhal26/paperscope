/* ==================== AUTHOR MODE ==================== */
const AUTHOR_SELECT = 'id,display_name,orcid,works_count,cited_by_count,summary_stats,counts_by_year,last_known_institutions,affiliations,topics';
const AWORK_SEL = 'id,display_name,publication_year,cited_by_count,referenced_works,primary_topic,doi';

async function loadAuthor(idOrOrcid) {
  const ep = ++EPOCH;
  showLoading('pulling up the researcher’s file…');
  $('#results').className = '';
  try {
    const a = await getJSON(`${API}/authors/${encodeURIComponent(idOrOrcid).replace(/%3A/g, ':').replace(/%2F/g, '/')}?select=${AUTHOR_SELECT}`);
    if (stale(ep)) return;
    clearStatus();
    $('#trendingWrap').style.display = 'none';
    $('#vsresults').style.display = 'none';
    setMode('author');
    setModeTexts('author');
    renderAuthorHero(a, ep);
    setAuthorPermalink(a);
    $('#results').className = 'on';
    setTab('rank');
    $('#netbox').innerHTML = miniLoad('laying out the life’s work…');
    $('#netlegend').innerHTML = '';
    $('#journal').innerHTML = miniLoad('checking their favorite venues…');
    $('#mapbox').innerHTML = miniLoad('finding the fan clubs…');
    $('#cbars').innerHTML = '';
    $('#acards').innerHTML = miniLoad('interviewing the admirers…');
    $('#jsub').textContent = 'Where they publish most — their home turf venues.';

    // top works power the portfolio AND the citer analytics
    const worksP = getJSON(`${API}/works?filter=authorships.author.id:${idTail(a.id)}&sort=cited_by_count:desc&per-page=50&page=1&select=${AWORK_SEL}`)
      .then(j => j.results || []);
    renderTrend(a); // authors carry counts_by_year too
    panelSafe(buildPortfolio(a, worksP, ep), '#netbox', 'The portfolio got tangled');
    panelSafe(buildAuthorVenues(a, ep), '#journal', 'Venue list unavailable');
    $('#coauth').innerHTML = miniLoad('rounding up the partners…');
    $('#journey').innerHTML = miniLoad('tracing the journey…');
    panelSafe(buildCoauthors(a, ep), '#coauth', 'Co-author list unavailable');
    $('#wherenext').innerHTML = miniLoad('scouting the venues…');
    panelSafe(buildWhereNext(a, ep), '#wherenext', 'The scout came back empty-handed');
    panelSafe(buildJourney(a, ep), '#journey', 'The trail went cold');
    const citersP = fetchAuthorCiters(a, worksP);
    panelSafe(buildAuthorCountries(a, citersP, ep), '#mapbox', 'The globe jammed');
    panelSafe(buildAuthorFans(a, citersP, ep), '#acards', 'The fan club went quiet');
  } catch (e) {
    showError('Could not fetch that researcher (' + esc(e.message) + ')');
  }
}

function setAuthorPermalink(a) {
  try {
    const u = new URL(location.href);
    u.searchParams.delete('w'); u.searchParams.delete('vs');
    u.searchParams.set('a', idTail(a.id));
    history.replaceState(null, '', u);
  } catch (e) {}
}

function renderAuthorHero(a, ep) {
  const inst = a.last_known_institutions && a.last_known_institutions[0];
  const stats = a.summary_stats || {};
  const years = (a.affiliations || []).flatMap(af => af.years || []);
  const since = years.length ? Math.min(...years) : null;
  const topTopics = (a.topics || []).slice(0, 3);
  $('#hero').innerHTML = `
    <div class="sticker">UNDER THE SCOPE 🧑‍🔬</div>
    <h2>${esc(a.display_name)}</h2>
    <div class="authors">${inst ? `${inst.country_code ? flag(inst.country_code) + ' ' : ''}${esc(inst.display_name)}` : 'Affiliation unknown'}${since ? ` · active since ${since}` : ''}</div>
    <div class="meta-row">
      <span class="chip c">📣 ${fmt(a.cited_by_count)} citations</span>
      <span class="chip y">📚 ${fmt(a.works_count)} papers</span>
      <span class="chip v">💪 h-index ${stats.h_index ?? '—'}</span>
      ${stats.i10_index != null ? `<span class="chip t">🔟 i10 ${fmt(stats.i10_index)}</span>` : ''}
    </div>
    <div class="meta-row">
      ${topTopics.map(t => `<a class="chip t" href="${esc(t.id)}" target="_blank" rel="noopener" title="Open this topic on OpenAlex">🧠 ${esc(t.display_name)}</a>`).join('')}
    </div>
    <div class="toolbar">
      ${a.orcid ? `<a class="tool" href="${esc(a.orcid)}" target="_blank" rel="noopener" title="Verified ORCID profile">🪪 ORCID ↗</a>` : ''}
      <a class="tool" href="${esc(a.id)}" target="_blank" rel="noopener" title="Open on OpenAlex">📄 OpenAlex ↗</a>
      <button class="tool" id="shareBtn" title="Copy a link that opens this exact dashboard">🔗 copy link</button>
      <button class="tool" id="passportBtn" title="Download a citation-passport card">🛂 passport</button>
    </div>`;
  $('#shareBtn').addEventListener('click', copyPermalink);
  $('#passportBtn').addEventListener('click', downloadPassport);
  if (a.orcid) enrichORCID(a, ep);
}

/* ---- ORCID extras: employment + funding from the public registry (best-effort) ---- */
async function enrichORCID(a, ep) {
  try {
    const oid = a.orcid.replace(/^https?:\/\/orcid\.org\//i, '');
    const r = await fetch(`https://pub.orcid.org/v3.0/${encodeURIComponent(oid)}/record`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const rec = await r.json();
    if (stale(ep)) return;
    const chips = [];
    const groups = (((rec['activities-summary'] || {}).employments || {})['affiliation-group']) || [];
    const jobs = groups.flatMap(g => (g.summaries || []).map(x => x['employment-summary']).filter(Boolean));
    for (const j of jobs.slice(0, 3)) {
      const org = j.organization && j.organization.name;
      if (!org) continue;
      const y0 = j['start-date'] && j['start-date'].year && j['start-date'].year.value;
      const y1 = j['end-date'] && j['end-date'].year && j['end-date'].year.value;
      const role = j['role-title'] ? esc(j['role-title']) + ' · ' : '';
      chips.push(`<span class="oxchip" title="From their ORCID record">🏢 ${role}${esc(org)}${y0 ? ` (${y0}–${y1 || 'now'})` : ''}</span>`);
    }
    const fundGroups = (((rec['activities-summary'] || {}).fundings || {}).group) || [];
    if (fundGroups.length) chips.push(`<span class="oxchip fund" title="Funded projects on their ORCID record">💰 ${fundGroups.length} funded project${fundGroups.length === 1 ? '' : 's'}</span>`);
    if (!chips.length) return;
    const hero = $('#hero');
    if (!hero || !hero.textContent.includes(a.display_name)) return;
    const div = el('div', 'orcid-extras', `<span class="oxhead">via ORCID 🪪</span>` + chips.join(''));
    hero.appendChild(div);
  } catch (e) { /* registry unreachable — hero stays as-is */ }
}

/* ---- where next: venues in their topics, impact x fit, home-turf bonus ---- */
async function buildWhereNext(a, ep) {
  const topics = (a.topics || []).slice(0, 3);
  const box = $('#wherenext');
  if (!topics.length) { box.innerHTML = '<div class="empty">🤷 No topics on record to scout venues for.</div>'; return; }
  const maxT = topics[0].count || 1;
  const lists = await Promise.all(topics.map(t =>
    getJSON(`${API}/sources?filter=topics.id:${idTail(t.id)}&sort=summary_stats.2yr_mean_citedness:desc&per-page=15&select=id,display_name,summary_stats,type`)
      .then(j => (j.results || []).map(srcx => ({ srcx, t }))).catch(() => [])));
  // home turf: where they already publish (same group_by the venues tab uses — cached, so free)
  let home = {};
  try {
    const hj = await getJSON(`${API}/works?filter=authorships.author.id:${idTail(a.id)}&group_by=primary_location.source.id`);
    for (const g of (hj.group_by || [])) if (g.key && g.key !== 'unknown') home[idTail(g.key)] = g.count;
  } catch (e) {}
  if (stale(ep)) return;
  const best = new Map();
  for (const { srcx, t } of lists.flat()) {
    if (srcx.type && !['journal', 'conference'].includes(srcx.type)) continue;
    const sid = idTail(srcx.id);
    const imp = (srcx.summary_stats && srcx.summary_stats['2yr_mean_citedness']) || 0;
    const fit = (t.count || 1) / maxT;
    const score = Math.log(1 + imp) * (0.5 + 0.5 * fit) * (home[sid] ? 1.25 : 1);
    const prev = best.get(sid);
    if (!prev || score > prev.score) best.set(sid, { srcx, t, imp, score, homeN: home[sid] || 0 });
  }
  const rows = [...best.values()].sort((x, y) => y.score - x.score).slice(0, 10);
  if (!rows.length) { box.innerHTML = '<div class="empty">🌵 No journal-shaped venues found in their topics.</div>'; return; }
  box.innerHTML = rows.map((rw, i) => `
    <div class="wrow">
      <span class="pos">#${i + 1}</span>
      <span class="wn"><a href="${esc(rw.srcx.id)}" target="_blank" rel="noopener" title="Open this venue on OpenAlex">${esc(rw.srcx.display_name)}</a></span>
      <span class="wchips">
        <span class="wchip">🧠 ${esc(rw.t.display_name)}</span>
        <span class="wchip imp">⚡ ${rw.imp.toFixed(1)} avg cites</span>
        ${rw.homeN ? `<span class="wchip home">🏠 you've published here ×${rw.homeN}</span>` : ''}
      </span>
    </div>`).join('');
}

/* right panel, rank tab: where they publish most */
async function buildAuthorVenues(a, ep) {
  const j = await getJSON(`${API}/works?filter=authorships.author.id:${idTail(a.id)}&group_by=primary_location.source.id`);
  if (stale(ep)) return;
  const groups = (j.group_by || []).filter(g => g.key && g.key !== 'unknown').slice(0, 8);
  const box = $('#journal');
  if (!groups.length) { box.innerHTML = '<div class="empty">🕵️ No venues on record.</div>'; return; }
  const maxV = groups[0].count;
  let html = '<div class="bars">';
  groups.forEach((g, i) => {
    html += `<div class="brow">
      <span class="nm"><span class="pos">#${i + 1}</span><a href="${esc(g.key)}" target="_blank" rel="noopener">${esc(g.key_display_name || 'Unknown venue')}</a></span>
      <span class="val">${fmt(g.count)}×</span>
      <span class="track"><span class="fill" style="width:${Math.max(3, 100 * g.count / maxV)}%"></span></span>
    </div>`;
  });
  box.innerHTML = html + '</div>';
}

/* portfolio: their papers as the network */
async function buildPortfolio(a, worksP, ep) {
  const works = await worksP;
  if (stale(ep)) return;
  if (!works.length) { $('#netbox').innerHTML = '<div class="empty">🕳️ No papers on record. A ghost!</div>'; return; }
  if (NET && NET.raf) cancelAnimationFrame(NET.raf);
  $('#netctl').style.display = 'none';
  $('#seedwrap').style.display = 'none';
  $('#nettable').style.display = 'none'; $('#nettable').innerHTML = '';
  const tb = $('#tableBtn'); tb.classList.remove('open'); tb.innerHTML = '<span class="arr">▸</span> greatest hits table';
  const mb = $('#moreBtn'); mb.disabled = false; mb.textContent = '🧠 areas of interest'; mb.classList.add('areas'); mb.classList.remove('on');
  $('#areasbox').style.display = 'none'; $('#areasbox').innerHTML = '';
  const tmb = $('#timeBtn'); tmb.classList.remove('on'); tmb.textContent = '🕰️ career timeline';

  const years = works.map(x => x.publication_year).filter(Boolean);
  const pseudo = { id: a.id, display_name: a.display_name, cited_by_count: a.cited_by_count, publication_year: years.length ? Math.min(...years) : null };
  const seen = new Set([idTail(a.id)]);
  const nodes = [{ w: pseudo, center: true, kind: 'the researcher' }];
  const maxC = Math.max(...works.map(x => x.cited_by_count || 1));
  for (const r of works) {
    const id = idTail(r.id);
    if (seen.has(id)) continue; seen.add(id);
    nodes.push({ w: r, kind: 'their paper', close: Math.round(100 * (r.cited_by_count || 0) / maxC) });
  }
  NET = { w: pseudo, nodes, seen, topicId: null, authorId: idTail(a.id), authorTopics: (a.topics || []).slice(0, 10), workPage: 1, topicPage: 1, shown: [], isolated: null, tableOpen: false, areasOpen: false, raf: null, mode: 'force', edges: [] };
  computeEdges(); // their papers citing their papers
  refreshFields();
  renderNetLegend();
  drawNetwork();
  $('#netctl').style.display = '';
  window.NET = NET;
}

/* co-authors: one group_by, self excluded, enriched */
async function buildCoauthors(a, ep) {
  const selfId = idTail(a.id);
  const j = await getJSON(`${API}/works?filter=authorships.author.id:${selfId}&group_by=authorships.author.id`);
  if (stale(ep)) return;
  const raw = (j.group_by || [])
    .map(g => ({ id: idTail(g.key || ''), name: g.key_display_name, n: g.count }))
    .filter(g => g.id && g.id !== selfId && /^A\d+$/.test(g.id));
  const groups = raw.sort((x, y) => y.n - x.n); // every collaborator, ranked
  const box = $('#coauth');
  if (!groups.length) { box.innerHTML = '<div class="empty">🐺 A lone wolf — no co-authors on record.</div>'; return; }
  document.querySelector('#coauthTab .psub').textContent =
    `All ${groups.length}${(j.group_by || []).length >= 200 ? '+' : ''} people they've published with, ranked by shared papers. Click a name to scope them.`;
  let enrich = {};
  try {
    const f = groups.slice(0, 50).map(g => g.id).join('|');
    const sel = 'id,display_name,summary_stats,last_known_institutions';
    const jj = await getJSONChain([
      `${API}/authors?filter=ids.openalex:${f}&per-page=25&select=${sel}`,
      `${API}/authors?filter=openalex:${f}&per-page=25&select=${sel}`,
    ]);
    for (const x of (jj.results || [])) enrich[idTail(x.id)] = x;
  } catch (e) {}
  if (stale(ep)) return;
  const maxV = groups[0].n;
  box.innerHTML = '';
  const wrap = el('div');
  wrap.style.maxHeight = '460px'; wrap.style.overflow = 'auto'; wrap.style.paddingRight = '6px';
  const multi = groups.filter(g => g.n > 1), single = groups.filter(g => g.n === 1);
  const mkLink = g => {
    const e2 = enrich[g.id] || {};
    const lki = e2.last_known_institutions && e2.last_known_institutions[0];
    const flg = lki && lki.country_code ? ' ' + flag(lki.country_code) : '';
    const h = e2.summary_stats && e2.summary_stats.h_index != null ? ` <span class="apill h" style="font-size:10px;padding:0 6px">h ${e2.summary_stats.h_index}</span>` : '';
    return `<a href="#" data-aid="${esc(g.id)}" title="Scope this researcher">${esc(g.name || 'Unknown')}</a>${flg}${h}`;
  };
  multi.forEach((g, i) => {
    const row = el('div', 'corow');
    row.innerHTML = `<span class="pos">#${i + 1}</span><span class="conm">${mkLink(g)}</span>
      <span class="cobar"><span class="cofill" style="width:${Math.max(4, 100 * g.n / maxV)}%"></span></span>
      <span class="cn">${g.n}×</span>`;
    wrap.appendChild(row);
  });
  if (single.length) {
    wrap.appendChild(el('div', 'cohead', `☝️ one-paper collaborators (${single.length})`));
    const cloud = el('div');
    for (const g of single) {
      const c = el('a', 'cochip');
      c.href = '#'; c.dataset.aid = g.id;
      const e2 = enrich[g.id] || {};
      const lki = e2.last_known_institutions && e2.last_known_institutions[0];
      c.innerHTML = esc(g.name || 'Unknown') + (lki && lki.country_code ? ' ' + flag(lki.country_code) : '');
      cloud.appendChild(c);
    }
    wrap.appendChild(cloud);
  }
  wrap.querySelectorAll('a[data-aid]').forEach(x => x.addEventListener('click', ev => {
    ev.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); loadAuthor(x.dataset.aid);
  }));
  box.appendChild(wrap);
}

/* research journey: stacked subfield areas over the years */
async function buildJourney(a, ep) {
  const j = await getJSON(`${API}/works?filter=authorships.author.id:${idTail(a.id)}&sort=publication_date:desc&per-page=200&select=id,display_name,publication_year,cited_by_count,doi,primary_topic`);
  if (stale(ep)) return;
  const works = (j.results || []).filter(x => x.publication_year);
  const total = (j.meta && j.meta.count) || works.length;
  const box = $('#journey');
  if (works.length < 3) { box.innerHTML = '<div class="empty">🌱 Not enough papers yet to chart a journey.</div>'; return; }
  const sub = x => (x.primary_topic && ((x.primary_topic.subfield && x.primary_topic.subfield.display_name) || (x.primary_topic.field && x.primary_topic.field.display_name))) || 'Uncharted';
  const totals = {};
  for (const x of works) totals[sub(x)] = (totals[sub(x)] || 0) + 1;
  const top = Object.entries(totals).sort((p, q) => q[1] - p[1]).slice(0, 5).map(e => e[0]);
  const grp = x => top.includes(sub(x)) ? sub(x) : 'Other';
  const series = top.slice(); if (Object.keys(totals).length > 5) series.push('Other');
  const y0 = Math.min(...works.map(x => x.publication_year)), y1 = Math.max(...works.map(x => x.publication_year));
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  const counts = years.map(y => { const c = {}; for (const k of series) c[k] = 0; return c; });
  const cellPapers = new Map();
  for (const x of works) {
    const k = grp(x);
    counts[x.publication_year - y0][k]++;
    const key = k + '|' + x.publication_year;
    if (!cellPapers.has(key)) cellPapers.set(key, []);
    cellPapers.get(key).push(x);
  }

  // order rows by when each subfield first appears — the journey reads top-to-bottom
  const firstIdx = k => counts.findIndex(c => c[k] > 0);
  const rows = series.slice().sort((p, q) => (p === 'Other') - (q === 'Other') || firstIdx(p) - firstIdx(q));
  const maxCell = Math.max(...counts.flatMap(c => rows.map(k => c[k])), 1);
  const RAMP = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95'];
  const shade = v => v === 0 ? null : RAMP[maxCell === 1 ? 2 : Math.round((v - 1) / (maxCell - 1) * (RAMP.length - 1))];
  const avail = Math.max(320, (box.clientWidth || 800) - 210);
  const cw = Math.max(22, Math.min(42, Math.floor(avail / years.length)));
  let grid = `<div style="display:grid;grid-template-columns:190px repeat(${years.length},${cw}px);gap:3px;align-items:center;min-width:${190 + years.length * (cw + 3)}px">`;
  for (const k of rows) {
    const tot = k === 'Other' ? works.length - top.reduce((s2, t) => s2 + totals[t], 0) : totals[k];
    grid += `<div class="jlabel" title="${esc(k)} — ${fmt(tot)} papers">${esc(k)} <span style="color:#898781">(${fmt(tot)})</span></div>`;
    years.forEach((y, i) => {
      const v = counts[i][k];
      const bg = shade(v);
      grid += `<div class="jcell${v ? ' has' : ''}" data-key="${esc(k)}|${y}" data-t="${esc(k)} · ${y}: ${v} paper${v === 1 ? '' : 's'}${v ? ' — click to see them' : ''}" style="background:${bg || '#fff'};${bg ? '' : 'border-color:rgba(20,20,20,.18);'}color:${v && RAMP.indexOf(bg) >= 3 ? '#fff' : '#141414'}">${v || ''}</div>`;
    });
  }
  grid += `<div></div>`;
  const step = Math.max(1, Math.ceil(years.length / 12));
  years.forEach((y, i) => { grid += `<div class="jyear">${i % step === 0 || i === years.length - 1 ? y : ''}</div>`; });
  grid += `</div>`;

  box.innerHTML = `<div class="trend-chart" style="overflow-x:auto">${grid}</div>
    <div class="legend" style="margin-top:12px"><span class="lg">papers/yr:</span>
      ${RAMP.map((c, i) => `<span class="lg"><i style="background:${c}"></i>${i === 0 ? '1' : i === RAMP.length - 1 ? 'up to ' + maxCell : ''}</span>`).join('')}
    </div>
    ${total > works.length ? `<div class="psub" style="margin-top:8px">Based on their ${works.length} most recent papers (of ${fmt(total)}).</div>` : ''}
    <div id="journeyDetail" style="display:none"></div>
  `;
  RESIZERS.set('journey', () => { if (MODE === 'author') buildJourney(a); });
  const detail = $('#journeyDetail');
  let selKey = null;
  const closeDetail = () => { selKey = null; detail.style.display = 'none'; detail.innerHTML = ''; box.querySelectorAll('.jcell.sel').forEach(c => c.classList.remove('sel')); };
  box.querySelectorAll('.jcell').forEach(c => {
    c.addEventListener('pointermove', e => tipShow(`<div class="tt">${c.dataset.t}</div>`, e.clientX, e.clientY));
    c.addEventListener('pointerleave', tipHide);
    c.addEventListener('click', () => {
      const key = c.dataset.key;
      const papers = cellPapers.get(key);
      if (!papers || key === selKey) { closeDetail(); return; }
      closeDetail();
      selKey = key; c.classList.add('sel');
      const [kk, yy] = key.split('|');
      let html = `<div class="jd-head"><b>${esc(kk)} · ${yy}</b> — ${papers.length} paper${papers.length === 1 ? '' : 's'}
        <button class="jd-close" title="Close">✕</button></div>`;
      for (const p of papers.slice().sort((a2, b2) => (b2.cited_by_count || 0) - (a2.cited_by_count || 0))) {
        html += `<a class="jd-row" href="#" data-wid="${esc(idTail(p.id))}" title="Open this paper in PaperScope">
          <span class="ti">${esc(p.display_name)}</span>
          <span class="jd-cites">${fmt(p.cited_by_count)} cites</span></a>`;
      }
      detail.innerHTML = html;
      detail.style.display = '';
      detail.querySelector('.jd-close').addEventListener('click', closeDetail);
      detail.querySelectorAll('a[data-wid]').forEach(x => x.addEventListener('click', ev => {
        ev.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); loadPaper(x.dataset.wid);
      }));
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

/* citing works for the author's top papers (one OR-batched query) */
function fetchAuthorCiters(a, worksP) {
  return worksP.then(async works => {
    const ids = works.slice(0, 50).map(x => idTail(x.id));
    if (!ids.length) return { works: [], total: 0, ids, basis: 'no papers' };
    const f = ids.join('|');
    const j = await getJSON(`${API}/works?filter=cites:${f}&sort=cited_by_count:desc&per-page=100&select=id,display_name,publication_year,cited_by_count,authorships`);
    return { works: j.results || [], total: (j.meta && j.meta.count) || 0, ids, basis: `their top ${ids.length} papers` };
  });
}

async function buildAuthorCountries(a, citersP, ep) {
  const { works, total, ids, basis } = await citersP;
  let counts = null, usedBasis = '';
  if (ids.length) {
    try {
      const j = await getJSON(`${API}/works?filter=cites:${ids.join('|')}&group_by=authorships.countries`);
      const groups = j.group_by || [];
      if (groups.length) {
        counts = {};
        for (const g of groups) {
          const cc = String(g.key || '').replace(/.*\//, '').toUpperCase();
          if (/^[A-Z]{2}$/.test(cc)) counts[cc] = (counts[cc] || 0) + g.count;
        }
        usedBasis = `every paper citing ${basis}`;
      }
    } catch (e) {}
  }
  if (!counts || !Object.keys(counts).length) {
    counts = {};
    for (const cw of works) {
      const per = new Set();
      for (const au of (cw.authorships || [])) {
        for (const c of (au.countries || [])) per.add(String(c).toUpperCase());
        for (const inst of (au.institutions || [])) if (inst.country_code) per.add(String(inst.country_code).toUpperCase());
      }
      for (const cc of per) if (/^[A-Z]{2}$/.test(cc)) counts[cc] = (counts[cc] || 0) + 1;
    }
    usedBasis = `the ${works.length} most-cited papers citing ${basis}`;
  }
  if (stale(ep)) return;
  const entries = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  if (!entries.length) { $('#mapbox').innerHTML = '<div class="empty">🌵 No fans located yet — early days!</div>'; $('#cbars').innerHTML = ''; return; }
  $('#mapsub').textContent = 'Author countries across ' + usedBasis + '. Hover the bubbles!';
  PASSPORT = { w: { display_name: a.display_name, cited_by_count: a.cited_by_count, publication_year: null }, entries };
  drawWorld(entries, null);
  const maxV = entries[0][1];
  const cb = $('#cbars'); cb.innerHTML = '';
  entries.slice(0, 8).forEach(([cc, v]) => {
    const row = el('div', 'brow');
    row.innerHTML = `<span class="nm"><span class="flag">${flag(cc)}</span>${esc(MAPDATA.names[cc] || cc)}</span>
      <span class="val">${fmt(v)}</span>
      <span class="track"><span class="fill" style="width:${Math.max(3, 100 * v / maxV)}%"></span></span>`;
    cb.appendChild(row);
  });
  if (entries.length > 8) cb.appendChild(el('div', 'psub', '+ ' + (entries.length - 8) + ' more countries in the bubbles above'));
}

async function buildAuthorFans(a, citersP, ep) {
  const { works, total, basis } = await citersP;
  if (stale(ep)) return;
  if (!works.length) { $('#acards').innerHTML = '<div class="empty">🦗 Crickets so far — someone has to be first!</div>'; return; }
  const selfId = idTail(a.id);
  let selfCiting = 0;
  const agg = new Map();
  for (const cw of works) {
    let isSelf = false;
    for (const au of (cw.authorships || [])) {
      if (!au.author || !au.author.id) continue;
      const id = idTail(au.author.id);
      if (id === selfId) { isSelf = true; continue; }
      let rec = agg.get(id);
      if (!rec) { rec = { id, name: au.author.display_name, n: 0, inst: null, instId: null, cc: null }; agg.set(id, rec); }
      rec.n++;
      if (!rec.inst && au.institutions && au.institutions[0]) { rec.inst = au.institutions[0].display_name; rec.instId = au.institutions[0].id; rec.cc = au.institutions[0].country_code; }
      if (!rec.cc && au.countries && au.countries[0]) rec.cc = au.countries[0];
    }
    if (isSelf) selfCiting++;
  }
  const organic = Math.round(100 * (1 - selfCiting / works.length));
  $('#asub').innerHTML = `Top fans among the ${works.length} most-cited of ${fmt(total)} papers citing ${esc(basis)} — you excluded, obviously. <b>${organic}% organic citations 🌱</b> (${selfCiting} self-cites in sample).`;
  const top = [...agg.values()].sort((x, y) => y.n - x.n).slice(0, 6);
  let enrich = {};
  try {
    const f = top.map(t => t.id).join('|');
    const sel = 'id,display_name,summary_stats,last_known_institutions,works_count,cited_by_count';
    const j = await getJSONChain([
      `${API}/authors?filter=ids.openalex:${f}&per-page=25&select=${sel}`,
      `${API}/authors?filter=openalex:${f}&per-page=25&select=${sel}`,
    ]);
    for (const x of (j.results || [])) enrich[idTail(x.id)] = x;
  } catch (e) {}
  if (stale(ep)) return;
  const box = $('#acards'); box.innerHTML = '';
  top.forEach((t, i) => {
    const e2 = enrich[t.id] || {};
    const stats = e2.summary_stats || {};
    const lki = e2.last_known_institutions && e2.last_known_institutions[0];
    const inst = (lki && lki.display_name) || t.inst || 'Institution unknown';
    const instId = (lki && lki.id) || t.instId;
    const cc = (lki && lki.country_code) || t.cc;
    const initials = (t.name || '?').split(/\s+/).map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const card = el('div', 'acard');
    card.innerHTML = `
      <div class="avatar" style="background:${PALETTE[i % PALETTE.length]}">${esc(initials)}</div>
      <div class="who">
        <div class="nm"><a href="#" data-aid="${esc(t.id)}">${esc(t.name)}</a></div>
        <div class="inst">${cc ? flag(cc) + ' ' : ''}${instId ? `<a href="${esc(instId)}" target="_blank" rel="noopener">${esc(inst)}</a>` : esc(inst)}</div>
        <div class="apills">
          <span class="apill n">cites them ×${t.n}</span>
          ${stats.h_index != null ? `<span class="apill h">h-index ${stats.h_index}</span>` : ''}
          ${e2.works_count != null ? `<span class="apill">${fmt(e2.works_count)} papers</span>` : ''}
        </div>
      </div>`;
    card.querySelector('a[data-aid]').addEventListener('click', ev => { ev.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); loadAuthor(t.id); });
    box.appendChild(card);
  });
}

