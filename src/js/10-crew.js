/* ============ panel 4: citing authors ============ */
async function buildAuthors(w, citersP, ep) {
  const { works, total } = await citersP;
  if (stale(ep)) return;
  if (!works.length) {
    $('#acards').innerHTML = '<div class="empty">🦗 Crickets — no citing papers yet. Someone has to be first!</div>';
    return;
  }
  const agg = new Map();
  for (const cw of works) {
    for (const a of (cw.authorships || [])) {
      if (!a.author || !a.author.id) continue;
      const id = idTail(a.author.id);
      let rec = agg.get(id);
      if (!rec) { rec = { id, name: a.author.display_name, n: 0, inst: null, cc: null }; agg.set(id, rec); }
      rec.n++;
      if (!rec.inst && a.institutions && a.institutions[0]) { rec.inst = a.institutions[0].display_name; rec.instId = a.institutions[0].id; rec.cc = a.institutions[0].country_code; }
      if (!rec.cc && a.countries && a.countries[0]) rec.cc = a.countries[0];
    }
  }
  const top = [...agg.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  $('#asub').textContent = `Top citers among the ${Math.min(100, total)} most-cited of ${fmt(total)} citing papers.`;

  // enrich with author stats (best-effort)
  let enrich = {};
  try {
    const f = top.map(t => t.id).join('|');
    const sel = 'id,display_name,summary_stats,last_known_institutions,works_count,cited_by_count';
    const j = await getJSONChain([
      `${API}/authors?filter=ids.openalex:${f}&per-page=25&select=${sel}`,
      `${API}/authors?filter=openalex:${f}&per-page=25&select=${sel}`,
    ]);
    for (const a of (j.results || [])) enrich[idTail(a.id)] = a;
  } catch (e) { /* cards still render without stats */ }
  if (stale(ep)) return;
  const box = $('#acards'); box.innerHTML = '';
  top.forEach((t, i) => {
    const e2 = enrich[t.id] || {};
    const stats = e2.summary_stats || {};
    const lki = e2.last_known_institutions && e2.last_known_institutions[0];
    const inst = (lki && lki.display_name) || t.inst || 'Institution unknown';
    const instId = (lki && lki.id) || t.instId;
    const cc = (lki && lki.country_code) || t.cc;
    const initials = (t.name || '?').split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const card = el('div', 'acard');
    card.innerHTML = `
      <div class="avatar" style="background:${PALETTE[i % PALETTE.length]}">${esc(initials)}</div>
      <div class="who">
        <div class="nm"><a href="#" data-aid="${esc(t.id)}" title="Scope this researcher — their whole citation story">${esc(t.name)}</a></div>
        <div class="inst">${cc ? flag(cc) + ' ' : ''}${instId ? `<a href="${esc(instId)}" target="_blank" rel="noopener" title="Open this institution on OpenAlex">${esc(inst)}</a>` : esc(inst)}</div>
        <div class="apills">
          <span class="apill n">cites this ×${t.n}</span>
          ${stats.h_index != null ? `<span class="apill h">h-index ${stats.h_index}</span>` : ''}
          ${e2.works_count != null ? `<span class="apill">${fmt(e2.works_count)} papers</span>` : ''}
          ${e2.cited_by_count != null ? `<span class="apill">${fmt(e2.cited_by_count)} cites</span>` : ''}
        </div>
      </div>`;
    card.querySelector('a[data-aid]').addEventListener('click', ev => {
      ev.preventDefault();
      scrollTo({ top: 0, behavior: 'smooth' });
      loadAuthor(t.id);
    });
    box.appendChild(card);
  });
}
