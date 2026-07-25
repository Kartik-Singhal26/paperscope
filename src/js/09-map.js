/* ============ panel 3: countries map ============ */
async function buildCountries(w, citersP, ep) {
  const wid = idTail(w.id);
  let counts = null, basis = '';
  // primary: server-side group_by over ALL citing works
  try {
    const j = await getJSON(`${API}/works?filter=cites:${wid}&group_by=authorships.countries`);
    const groups = j.group_by || [];
    if (groups.length) {
      counts = {};
      for (const g of groups) {
        const cc = String(g.key || '').replace(/.*\//, '').toUpperCase();
        if (/^[A-Z]{2}$/.test(cc)) counts[cc] = (counts[cc] || 0) + g.count;
      }
      basis = 'all citing papers (a paper counts once per author country)';
    }
  } catch (e) { /* fall through */ }
  // fallback: aggregate client-side from sampled citers
  if (!counts || !Object.keys(counts).length) {
    const { works, total } = await citersP;
    counts = {};
    for (const cw of works) {
      const per = new Set();
      for (const a of (cw.authorships || [])) {
        for (const c of (a.countries || [])) per.add(String(c).toUpperCase());
        for (const inst of (a.institutions || [])) if (inst.country_code) per.add(String(inst.country_code).toUpperCase());
      }
      for (const cc of per) if (/^[A-Z]{2}$/.test(cc)) counts[cc] = (counts[cc] || 0) + 1;
    }
    basis = `the ${Math.min(100, total)} most-cited citing papers`;
  }
  if (stale(ep)) return;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    $('#mapbox').innerHTML = '<div class="empty">🌵 No country data on the citing papers (or nobody has cited it yet — early days!).</div>';
    $('#cbars').innerHTML = '';
    return;
  }
  $('#mapsub').textContent = 'Author countries across ' + basis + '. Hover the bubbles — click one to see those papers!';
  PASSPORT = { w, entries };
  drawWorld(entries, wid);

  // top-8 bars
  const maxV = entries[0][1];
  const cb = $('#cbars'); cb.innerHTML = '';
  entries.slice(0, 8).forEach(([cc, v], i) => {
    const row = el('a', 'brow');
    row.href = `https://openalex.org/works?filter=cites:${wid},authorships.countries:${cc}`;
    row.target = '_blank'; row.rel = 'noopener';
    row.title = `See the citing papers from ${MAPDATA.names[cc] || cc} on OpenAlex`;
    row.innerHTML = `<span class="nm"><span class="flag">${flag(cc)}</span>${esc(MAPDATA.names[cc] || cc)}</span>
      <span class="val">${fmt(v)}</span>
      <span class="track"><span class="fill" style="width:${Math.max(3, 100 * v / maxV)}%"></span></span>`;
    cb.appendChild(row);
  });
  if (entries.length > 8) cb.appendChild(el('div', 'psub', '+ ' + (entries.length - 8) + ' more countries in the bubbles above'));
}

function drawWorld(entries, wid) {
  RESIZERS.set('world', () => drawWorld(entries, wid));
  const box = $('#mapbox'); box.innerHTML = '';
  const G = MAPDATA.grid;
  const W = Math.max(380, box.clientWidth || 560);
  const cell = W / G.cols, H = cell * G.rows;
  const cv = el('canvas'); cv.id = 'worldmap'; box.appendChild(cv);
  const dpr = devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);

  const project = (lon, lat) => [ (lon + 180) / 360 * W, (G.latTop - lat) / (G.latTop - G.latBot) * H ];

  // land dots
  ctx.fillStyle = '#9db8a3';
  for (let r = 0; r < G.rows; r++) {
    const hex = G.hexRows[r];
    for (let c = 0; c < G.cols; c++) {
      const bit = (parseInt(hex[c >> 2], 16) >> (3 - (c & 3))) & 1;
      if (bit) { ctx.beginPath(); ctx.arc((c + .5) * cell, (r + .5) * cell, cell * .32, 0, 7); ctx.fill(); }
    }
  }
  // bubbles
  const maxV = entries[0][1];
  const bubbles = [];
  for (const [cc, v] of entries) {
    const ll = MAPDATA.centroids[cc]; if (!ll) continue;
    const [x, y] = project(ll[0], ll[1]);
    bubbles.push({ cc, v, x, y, r: 5 + 22 * Math.sqrt(v / maxV) });
  }
  bubbles.sort((a, b) => b.r - a.r);
  for (const b of bubbles) {
    ctx.beginPath(); ctx.arc(b.x + 2, b.y + 2, b.r, 0, 7); ctx.fillStyle = 'rgba(20,20,20,.85)'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7);
    ctx.fillStyle = 'rgba(58,134,255,.88)'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#141414'; ctx.stroke();
  }
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    let best = null;
    for (const b of bubbles) if (Math.hypot(b.x - p.x, b.y - p.y) <= b.r + 3) best = b; // smallest wins (drawn last)
    if (best) tipShow(`<div class="tt">${flag(best.cc)} ${esc(MAPDATA.names[best.cc] || best.cc)}</div><div class="tm">${fmt(best.v)} citing papers</div>`, e.clientX, e.clientY);
    else tipHide();
    cv.style.cursor = best ? 'pointer' : 'default';
  });
  cv.addEventListener('pointerleave', tipHide);
  let lastBubbleTap = null;
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    let best = null;
    for (const b of bubbles) if (Math.hypot(b.x - p.x, b.y - p.y) <= b.r + 3) best = b;
    if (!best) return;
    if (window.IS_TOUCH && lastBubbleTap !== best) {
      lastBubbleTap = best;
      touchTip(`<div class="tt">${flag(best.cc)} ${esc(MAPDATA.names[best.cc] || best.cc)}</div><div class="tm">${fmt(best.v)} citing papers${wid ? ' · tap again to see them' : ''}</div>`, e.clientX, e.clientY);
      return;
    }
    lastBubbleTap = null;
    if (wid) window.open(`https://openalex.org/works?filter=cites:${wid},authorships.countries:${best.cc}`, '_blank', 'noopener');
  });
}

