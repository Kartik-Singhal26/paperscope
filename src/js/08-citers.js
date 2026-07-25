/* ============ shared: citing works ============ */
function fetchCiters(w) {
  const wid = idTail(w.id);
  const sel = 'id,display_name,publication_year,cited_by_count,authorships';
  return getJSON(`${API}/works?filter=cites:${wid}&sort=cited_by_count:desc&per-page=100&select=${sel}`)
    .then(j => ({ works: j.results || [], total: (j.meta && j.meta.count) || (j.results || []).length }));
}

