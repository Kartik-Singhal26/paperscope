/* ============ search + autocomplete ============ */
const qInput = $('#q'), sugBox = $('#suggest');
let sugItems = [], sugHot = -1, acTimer = null, acSeq = 0;

qInput.addEventListener('input', () => {
  clearTimeout(acTimer);
  const v = qInput.value.trim();
  if (v.length < 3 || looksLikeDOI(v) || looksLikeORCID(v)) { closeSug(); return; }
  acTimer = setTimeout(() => autocomplete(v), 220);
});
qInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!sugItems.length) return;
    e.preventDefault();
    sugHot = (sugHot + (e.key === 'ArrowDown' ? 1 : -1) + sugItems.length) % sugItems.length;
    [...sugBox.children].forEach((c, i) => c.classList.toggle('hot', i === sugHot));
  } else if (e.key === 'Enter') {
    if (sugHot >= 0 && sugItems[sugHot]) pickSuggestion(sugItems[sugHot]);
    else runSearch();
  } else if (e.key === 'Escape') closeSug();
});
document.addEventListener('click', e => { if (!e.target.closest('.searchbox')) closeSug(); });

function looksLikeDOI(v) {
  return /^(https?:\/\/(dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i.test(v);
}
function looksLikeORCID(v) {
  return /^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(v.trim());
}
function closeSug() { sugBox.className = 'suggest'; sugBox.innerHTML = ''; sugItems = []; sugHot = -1; }

async function autocomplete(v) {
  const seq = ++acSeq;
  try {
    const kind = MODE === 'author' ? 'authors' : 'works';
    const j = await getJSON(`${API}/autocomplete/${kind}?q=${encodeURIComponent(v)}`);
    if (seq !== acSeq) return;
    sugItems = (j.results || []).slice(0, 7);
    sugHot = -1;
    sugBox.innerHTML = '';
    if (!sugItems.length) { closeSug(); return; }
    for (const it of sugItems) {
      const b = el('button', 'sug');
      b.innerHTML = `<span class="t">${esc(it.display_name)}</span>
        <div class="m">${esc(it.hint || '')}<span class="cite-pill">${fmt(it.cited_by_count)} cites</span></div>`;
      b.addEventListener('click', () => pickSuggestion(it));
      sugBox.appendChild(b);
    }
    sugBox.className = 'suggest open';
  } catch (e) { /* autocomplete is best-effort */ }
}
function pickSuggestion(it) {
  qInput.value = it.display_name;
  closeSug();
  if (MODE === 'author') loadAuthor(idTail(it.id));
  else loadPaper(idTail(it.id));
}
$('#modePaper').addEventListener('click', () => setMode('paper'));
$('#modeAuthor').addEventListener('click', () => setMode('author'));

$('#go').addEventListener('click', runSearch);
/* Pot luck: a genuinely random paper from OpenAlex's ~250M-work catalog, via its
   sample API. Lightly filtered (has a DOI, 25+ citations) so the roll lands on a
   paper with enough of a citation story to fill the dashboards. Falls back to a
   short famous-papers list if the sample endpoint is unreachable. */
const FAMOUS = ['W2741809807','W2963403868','W2100837269','W2144634347','W2194775991','W2108234281','W1861714852','W2119103177'];
$('#lucky').addEventListener('click', async () => {
  qInput.value = '';
  closeSug();
  const seed = Math.floor(Math.random() * 2147483647);
  if (MODE === 'author') {
    showLoading('drawing a random star from the researcher hat…');
    try {
      const j = await getJSON(`${API}/authors?filter=summary_stats.h_index:>30&sample=1&seed=${seed}&per-page=1&select=id`);
      if (j.results && j.results[0]) { loadAuthor(idTail(j.results[0].id)); return; }
      throw new Error('empty sample');
    } catch (e) { showError('The hat was empty — try a name instead'); }
    return;
  }
  showLoading('rolling the dice across 250 million papers…');
  try {
    const j = await getJSON(`${API}/works?filter=has_doi:true,cited_by_count:>24&sample=1&seed=${seed}&per-page=1&select=id`);
    if (j.results && j.results[0]) { loadPaper(idTail(j.results[0].id)); return; }
    throw new Error('empty sample');
  } catch (e) {
    loadPaper(FAMOUS[Math.floor(Math.random() * FAMOUS.length)]);
  }
});

async function runSearch() {
  const v = qInput.value.trim();
  if (!v) return;
  closeSug();
  if (MODE === 'author') {
    if (looksLikeORCID(v)) {
      const oid = v.replace(/^https?:\/\/orcid\.org\//i, '');
      loadAuthor('https://orcid.org/' + oid);
      return;
    }
    showLoading('tracking down “' + v.slice(0, 60) + '”…');
    try {
      const j = await getJSON(`${API}/authors?search=${encodeURIComponent(v)}&per-page=1`);
      if (!j.results || !j.results.length) { showError('No researcher found by that name'); return; }
      loadAuthor(idTail(j.results[0].id));
    } catch (e) { showError('Author search flopped (' + esc(e.message) + ')'); }
    return;
  }
  if (looksLikeDOI(v)) {
    const doi = v.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    loadPaper('https://doi.org/' + doi);
    return;
  }
  showLoading('hunting down “' + v.slice(0, 60) + '”…');
  try {
    const j = await getJSON(`${API}/works?search=${encodeURIComponent(v)}&per-page=1`);
    if (!j.results || !j.results.length) { showError('No paper found for that search'); return; }
    loadPaper(idTail(j.results[0].id));
  } catch (e) { showError('Search flopped (' + esc(e.message) + ')'); }
}

