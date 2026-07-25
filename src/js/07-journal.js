/* ============ panel 2: journal rank ============ */
async function buildJournal(w, ep) {
  const src = w.primary_location && w.primary_location.source;
  if (!src || !src.id) {
    $('#journal').innerHTML = '<div class="empty">🕵️ This paper has no journal on record (preprint? report? mystery?). No leaderboard today.</div>';
    return;
  }
  const sid = idTail(src.id);
  const topic = w.primary_topic;
  const srcSel = 'id,display_name,summary_stats,works_count,cited_by_count,type';
  const detailP = getJSON(`${API}/sources/${sid}?select=${srcSel}`).catch(() => null);

  let ranked = null, subjectName = null, total = null, subjFilter = null;
  const tryRank = async (filter, name) => {
    const j = await getJSON(`${API}/sources?filter=${filter}&sort=summary_stats.2yr_mean_citedness:desc&per-page=100&select=id,display_name,summary_stats`);
    if (j.results && j.results.length) { ranked = j.results; total = j.meta && j.meta.count; subjectName = name; subjFilter = filter; }
  };
  if (topic && topic.id) {
    try { await tryRank(`topics.id:${idTail(topic.id)}`, topic.display_name); } catch (e) {}
  }
  if (!ranked && w.concepts && w.concepts[0]) {
    try { await tryRank(`x-concepts.id:${idTail(w.concepts[0].id)}`, w.concepts[0].display_name); } catch (e) {}
  }
  const detail = await detailP;
  const stats = (detail && detail.summary_stats) || {};

  /* Exact ranks by counting how many subject venues beat this one on each metric.
     Two lenses on purpose: mean citedness (impact-factor cousin — punchy but gameable
     by tiny venues) and h-index (volume+impact — big prestigious venues shine). */
  const countRank = async (metric, val) => {
    if (!subjFilter || val == null) return null;
    const j = await getJSON(`${API}/sources?filter=${subjFilter},summary_stats.${metric}:>${val}&per-page=1&select=id`);
    return j.meta && j.meta.count != null ? j.meta.count + 1 : null;
  };
  const [rankCited, rankH] = await Promise.all([
    countRank('2yr_mean_citedness', stats['2yr_mean_citedness']).catch(() => null),
    countRank('h_index', stats.h_index).catch(() => null),
  ]);

  if (stale(ep)) return;
  const box = $('#journal');
  let html = '';

  if (ranked) {
    const idx = ranked.findIndex(s => idTail(s.id) === sid);
    const exact = idx >= 0 ? idx + 1 : rankCited;
    const rankTxt = exact != null ? '#' + fmt(exact) : '100+';
    html += `<div class="rank-hero">
      <div class="rank-num">${rankTxt}</div>
      <div class="rank-ctx"><a href="${esc(src.id)}" target="_blank" rel="noopener" title="Open this venue on OpenAlex">${esc(src.display_name)}</a><br>
      <span class="in">of ${fmt(total)} venues publishing “${esc(subjectName)}” — by avg citations per recent paper</span>
      ${rankH != null ? `<br><span class="in">…but <b style="color:var(--ink)">#${fmt(rankH)} by h-index</b>, the harder-to-game career metric 🏋️</span>` : ''}</div>
    </div>`;
    if (exact != null && exact > 100 && rankH != null && rankH < exact)
      $('#jsub').textContent = 'Avg-citations rankings favor small review venues; mega-journals fare better on h-index. Both shown — draw your own conclusions.';
  } else {
    html += `<div class="rank-hero"><div class="rank-num">?</div>
      <div class="rank-ctx"><a href="${esc(src.id)}" target="_blank" rel="noopener" title="Open this venue on OpenAlex">${esc(src.display_name)}</a><br><span class="in">subject leaderboard unavailable — solo stats below</span></div></div>`;
  }
  html += `<div class="statrow">
    <div class="stat"><div class="v">${stats['2yr_mean_citedness'] != null ? stats['2yr_mean_citedness'].toFixed(2) : '—'}</div><div class="k">2-yr citedness</div></div>
    <div class="stat"><div class="v">${fmt(stats.h_index)}</div><div class="k">h-index</div></div>
    <div class="stat"><div class="v">${fmt(detail && detail.works_count)}</div><div class="k">works</div></div>
  </div>`;

  if (ranked) {
    const idx = ranked.findIndex(s => idTail(s.id) === sid);
    const show = [];
    ranked.slice(0, 5).forEach((s, i) => show.push([i, s]));
    if (idx >= 5) show.push([idx, ranked[idx]]);
    const maxV = ranked[0].summary_stats && ranked[0].summary_stats['2yr_mean_citedness'] || 1;
    html += '<div class="bars">';
    for (const [i, s] of show) {
      const v = (s.summary_stats && s.summary_stats['2yr_mean_citedness']) || 0;
      const me = idTail(s.id) === sid;
      html += `<div class="brow${me ? ' me' : ''}">
        <span class="nm"><span class="pos">#${i + 1}</span><a href="${esc(s.id)}" target="_blank" rel="noopener" title="Open this venue on OpenAlex">${esc(s.display_name)}</a>${me ? ' ← this one' : ''}</span>
        <span class="val">${v.toFixed(1)}</span>
        <span class="track"><span class="fill" style="width:${Math.max(3, 100 * v / maxV)}%"></span></span>
      </div>`;
    }
    html += '</div>';
  }
  box.innerHTML = html;
}

