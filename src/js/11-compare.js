/* ==================== COMPARE MODE (⚔️ VS) ==================== */
const VS = { kind: 'papers', aId: null, bId: null };

$('#modeCompare').addEventListener('click', () => setMode('compare'));
$('#vsKindP').addEventListener('click', () => setVsKind('papers'));
$('#vsKindA').addEventListener('click', () => setVsKind('authors'));

function setVsKind(k) {
  if (VS.kind === k) return;
  VS.kind = k; VS.aId = null; VS.bId = null;
  $('#vsKindP').classList.toggle('on', k === 'papers');
  $('#vsKindA').classList.toggle('on', k === 'authors');
  $('#vsA').value = ''; $('#vsB').value = '';
  $('#vsA').placeholder = k === 'papers' ? 'Contender A — type a paper…' : 'Contender A — type a researcher…';
  $('#vsB').placeholder = k === 'papers' ? 'Contender B — type a paper…' : 'Contender B — type a researcher…';
  $('#vsresults').style.display = 'none';
}

/* dual autocomplete */
function wireVsInput(inputSel, sugSel, slot) {
  let t = null, seq = 0;
  const inp = $(inputSel), box = $(sugSel);
  inp.addEventListener('input', () => {
    clearTimeout(t);
    VS[slot] = null;
    const v = inp.value.trim();
    if (v.length < 3) { box.className = 'suggest'; return; }
    t = setTimeout(async () => {
      const s = ++seq;
      try {
        const kind = VS.kind === 'papers' ? 'works' : 'authors';
        const j = await getJSON(`${API}/autocomplete/${kind}?q=${encodeURIComponent(v)}`);
        if (s !== seq) return;
        box.innerHTML = '';
        const items = (j.results || []).slice(0, 5);
        if (!items.length) { box.className = 'suggest'; return; }
        for (const it of items) {
          const b = el('button', 'sug');
          b.innerHTML = `<span class="t">${esc(it.display_name)}</span>
            <div class="m">${esc(it.hint || '')}<span class="cite-pill">${fmt(it.cited_by_count)} cites</span></div>`;
          b.addEventListener('click', () => {
            inp.value = it.display_name;
            box.className = 'suggest';
            VS[slot] = idTail(it.id);
            if (VS.aId && VS.bId) buildCompare();
          });
          box.appendChild(b);
        }
        box.className = 'suggest open';
      } catch (e) {}
    }, 250);
  });
}
wireVsInput('#vsA', '#vsASug', 'aId');
wireVsInput('#vsB', '#vsBSug', 'bId');
document.addEventListener('click', e => {
  if (!e.target.closest('#vsbar')) { $('#vsASug').className = 'suggest'; $('#vsBSug').className = 'suggest'; }
});

/* ---- data ---- */
async function vsCountries(id) {
  try {
    if (VS.kind === 'papers') {
      const j = await getJSON(`${API}/works?filter=cites:${id}&group_by=authorships.countries`);
      return vsCountsFromGroups(j.group_by);
    }
    const wj = await getJSON(`${API}/works?filter=authorships.author.id:${id}&sort=cited_by_count:desc&per-page=50&select=id`);
    const ids = (wj.results || []).map(x => idTail(x.id));
    if (!ids.length) return [];
    const j = await getJSON(`${API}/works?filter=cites:${ids.join('|')}&group_by=authorships.countries`);
    return vsCountsFromGroups(j.group_by);
  } catch (e) { return []; }
}
function vsCountsFromGroups(groups) {
  const counts = {};
  for (const g of (groups || [])) {
    const cc = String(g.key || '').replace(/.*\//, '').toUpperCase();
    if (/^[A-Z]{2}$/.test(cc)) counts[cc] = (counts[cc] || 0) + g.count;
  }
  return Object.entries(counts).sort((x, y) => y[1] - x[1]);
}

async function buildCompare() {
  const ep = ++EPOCH;
  setMode('compare');
  $('#vsresults').style.display = '';
  $('#vsHeroes').innerHTML = miniLoad('weighing in the contenders…');
  $('#vstape').innerHTML = miniLoad('measuring gloves…');
  $('#vstrend').innerHTML = '';
  $('#vsgeo').innerHTML = miniLoad('mapping the crowds…');
  try {
    const fetchOne = id => VS.kind === 'papers'
      ? getJSON(`${API}/works/${id}?select=${WORK_SELECT}`)
      : getJSON(`${API}/authors/${id}?select=${AUTHOR_SELECT}`);
    const [A, B] = await Promise.all([fetchOne(VS.aId), fetchOne(VS.bId)]);
    if (stale(ep)) return;
    try {
      const u = new URL(location.href);
      u.searchParams.delete('w'); u.searchParams.delete('a');
      u.searchParams.set('vs', `${VS.aId}.${VS.bId}`);
      history.replaceState(null, '', u);
    } catch (e) {}
    renderVsHeroes(A, B);
    renderVsTape(A, B);
    renderVsTrend(A, B);
    vsGeoRender(ep, A, B); // async, own loading state
  } catch (e) {
    $('#vsHeroes').innerHTML = `<div class="empty">💥 One of the contenders didn't show up (${esc(e.message)}). Try again?</div>`;
    $('#vstape').innerHTML = ''; $('#vsgeo').innerHTML = '';
  }
}

function vsSub(x) {
  if (VS.kind === 'papers') {
    const venue = x.primary_location && x.primary_location.source && x.primary_location.source.display_name;
    return [x.publication_year, venue].filter(Boolean).join(' · ');
  }
  const inst = x.last_known_institutions && x.last_known_institutions[0];
  return inst ? `${inst.country_code ? flag(inst.country_code) + ' ' : ''}${inst.display_name}` : 'Affiliation unknown';
}

function renderVsHeroes(A, B) {
  const card = (x, side) => `
    <div class="vscard ${side}">
      <div class="corner">CONTENDER ${side.toUpperCase()}</div>
      <h3><a href="#" data-open="${esc(idTail(x.id))}" title="Open the full dashboard">${esc(x.display_name)}</a></h3>
      <div class="sub">${esc(vsSub(x))}</div>
      <div class="big">${fmt(x.cited_by_count)} <small>citations</small></div>
    </div>`;
  $('#vsHeroes').innerHTML = card(A, 'a') + `<div class="vs-mid">VS</div>` + card(B, 'b');
  document.querySelectorAll('#vsHeroes a[data-open]').forEach(a => a.addEventListener('click', ev => {
    ev.preventDefault();
    scrollTo({ top: 0, behavior: 'smooth' });
    VS.kind === 'papers' ? loadPaper(a.dataset.open) : loadAuthor(a.dataset.open);
  }));
}

function vsMetrics(x) {
  const now = new Date().getFullYear();
  if (VS.kind === 'papers') {
    const age = Math.max(1, now - (x.publication_year || now) + 1);
    return [
      ['citations', x.cited_by_count, v => fmt(v)],
      ['cites / year', Math.round((x.cited_by_count || 0) / age), v => fmt(v)],
      ['FWCI', x.fwci, v => v != null ? v.toFixed(1) : '—'],
      ['field percentile', x.citation_normalized_percentile && x.citation_normalized_percentile.value, v => v != null ? (v * 100).toFixed(1) + '%' : '—'],
      ['references cited', (x.referenced_works || []).length || null, v => v != null ? fmt(v) : '—'],
    ];
  }
  const st = x.summary_stats || {};
  return [
    ['citations', x.cited_by_count, v => fmt(v)],
    ['papers', x.works_count, v => fmt(v)],
    ['h-index', st.h_index, v => v ?? '—'],
    ['i10-index', st.i10_index, v => v != null ? fmt(v) : '—'],
    ['cites / paper', x.works_count ? Math.round((x.cited_by_count || 0) / x.works_count) : null, v => v != null ? fmt(v) : '—'],
  ];
}

function renderVsTape(A, B) {
  const ma = vsMetrics(A), mb = vsMetrics(B);
  let html = '';
  ma.forEach(([label, va, fmtFn], i) => {
    const vb = mb[i][1];
    const aWin = va != null && (vb == null || va > vb);
    const bWin = vb != null && (va == null || vb > va);
    const total = (va || 0) + (vb || 0);
    const aPct = total ? Math.max(6, Math.min(94, 100 * (va || 0) / total)) : 50;
    html += `<div class="trow">
      <span class="tl"><span class="${aWin ? 'win' : ''}">${fmtFn(va)}</span></span>
      <span class="tm2">${esc(label)}</span>
      <span class="tr2"><span class="${bWin ? 'win' : ''}">${fmtFn(vb)}</span></span>
      <span class="tug"><span class="ta" style="width:${aPct}%"></span><span class="tb"></span></span>
    </div>`;
  });
  $('#vstape').innerHTML = html;
}

function renderVsTrend(A, B) {
  const now = new Date().getFullYear();
  const series = x => new Map((x.counts_by_year || []).map(cy => [cy.year, cy.cited_by_count]));
  const sa = series(A), sb = series(B);
  const years = [...new Set([...sa.keys(), ...sb.keys()])].sort((p, q) => p - q).slice(-12);
  if (years.length < 2) { $('#vstrend').innerHTML = '<div class="empty">🌱 Not enough yearly data on both sides for a duel.</div>'; return; }
  const max = Math.max(...years.flatMap(y => [sa.get(y) || 0, sb.get(y) || 0]), 1);
  const box = $('#vstrend');
  const W = Math.max(300, (box.clientWidth || 500) - 26), H = 230, axis = 26;
  const group = Math.max(16, Math.floor((W - 6 * years.length) / years.length));
  const bw = Math.floor((group - 3) / 2);
  let bars = '', labels = '';
  const lblStep = Math.ceil(years.length / 6);
  years.forEach((y, i) => {
    const x0 = i * (group + 6);
    const va = sa.get(y) || 0, vb = sb.get(y) || 0;
    const ha = Math.max(2, Math.round(va / max * (H - axis - 14)));
    const hb = Math.max(2, Math.round(vb / max * (H - axis - 14)));
    const partial = y === now;
    bars += `<rect x="${x0}" y="${H - axis - ha}" width="${bw}" height="${ha}" fill="${partial ? '#86b6ef' : '#3A86FF'}" stroke="#141414" stroke-width="2"><title>A · ${y}${partial ? ' (so far)' : ''}: ${fmt(va)}</title></rect>`;
    bars += `<rect x="${x0 + bw + 3}" y="${H - axis - hb}" width="${bw}" height="${hb}" fill="${partial ? '#f9a170' : '#FB5607'}" stroke="#141414" stroke-width="2"><title>B · ${y}${partial ? ' (so far)' : ''}: ${fmt(vb)}</title></rect>`;
    if (i % lblStep === 0 || i === years.length - 1) labels += `<text x="${x0 + bw + 1}" y="${H - 8}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#898781">${y}</text>`;
  });
  box.innerHTML = `<div class="trend-chart"><svg width="${W}" height="${H}" role="img" aria-label="Citations per year for both contenders">${bars}${labels}</svg></div>
    <div class="legend" style="margin-top:10px">
      <span class="lg"><i style="background:#3A86FF"></i>A — ${esc((A.display_name || '').slice(0, 34))}</span>
      <span class="lg"><i style="background:#FB5607"></i>B — ${esc((B.display_name || '').slice(0, 34))}</span>
    </div>`;
}

async function vsGeoRender(ep, A, B) {
  const [ca, cb] = await Promise.all([vsCountries(idTail(A.id)), vsCountries(idTail(B.id))]);
  if (stale(ep)) return;
  const col = (entries, side, x) => {
    if (!entries.length) return `<div><div class="vsgeo-head ${side}">${side.toUpperCase()} — no fans located</div></div>`;
    const maxV = entries[0][1];
    return `<div><div class="vsgeo-head ${side}">${side.toUpperCase()} — ${entries.length} countries</div><div class="bars">` +
      entries.slice(0, 5).map(([cc, v]) => `<div class="brow">
        <span class="nm"><span class="flag">${flag(cc)}</span>${esc(MAPDATA.names[cc] || cc)}</span>
        <span class="val">${fmt(v)}</span>
        <span class="track"><span class="fill" style="width:${Math.max(3, 100 * v / maxV)}%;background:${side === 'a' ? 'var(--c1)' : 'var(--c2)'}"></span></span>
      </div>`).join('') + '</div></div>';
  };
  const verdict = ca.length !== cb.length
    ? `<div class="psub" style="margin-top:10px">🌍 wider reach: <b>${ca.length > cb.length ? 'Contender A' : 'Contender B'}</b> (${Math.max(ca.length, cb.length)} vs ${Math.min(ca.length, cb.length)} countries)</div>`
    : `<div class="psub" style="margin-top:10px">🤝 dead heat — ${ca.length} countries apiece</div>`;
  $('#vsgeo').innerHTML = `<div class="vsgeo-cols">${col(ca, 'a', A)}${col(cb, 'b', B)}</div>` + verdict;
}
