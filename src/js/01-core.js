
/* ============ tiny helpers ============ */
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n == null ? '—' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'k' : String(n);
const idTail = url => String(url || '').split('/').pop();
const flag = cc => cc && /^[A-Za-z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🏳️';
const PALETTE = ['#3A86FF','#FB5607','#068F6C','#C98A00','#E4569B','#7B2FBF'];
const API = 'https://api.openalex.org';
const BASE_TITLE = 'PaperScope 🔭 — feed it a paper, get the whole story';
function setTitle(t) {
  document.title = t ? `${String(t).slice(0, 70)} — PaperScope 🔭` : BASE_TITLE;
}
window.IS_TOUCH = matchMedia('(pointer: coarse)').matches; // tap-once-preview, tap-twice-act on canvases
let touchTipT = null;
function touchTip(html, x, y) {
  tipShow(html, x, y);
  clearTimeout(touchTipT);
  touchTipT = setTimeout(tipHide, 2600);
}
let EPOCH = 0;                                   // bumped on every navigation
const RESIZERS = new Map();                      // panel -> re-render thunk (cache makes these cheap)
let resizeT = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { for (const fn of RESIZERS.values()) { try { fn(); } catch (e) {} } }, 250);
});
const stale = ep => ep != null && ep !== EPOCH;  // stale loads must not touch the DOM

const API_CACHE = new Map();          // url -> {v, t}; makes revisits instant
const CACHE_TTL = 10 * 60 * 1000;     // counts can drift; refetch after 10 min
async function getJSON(url, attempt = 0) {
  const hit = API_CACHE.get(url);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.v;
  const r = await fetch(url);
  if (r.status === 429 && attempt < 2) {          // polite backoff on rate limits
    await new Promise(res => setTimeout(res, 700 * (attempt + 1)));
    return getJSON(url, attempt + 1);
  }
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url.slice(0, 120));
  const v = await r.json();
  API_CACHE.set(url, { v, t: Date.now() });
  if (API_CACHE.size > 300) API_CACHE.delete(API_CACHE.keys().next().value);
  return v;
}
/* Try a chain of URLs until one works (endpoint-variant fallbacks). */
async function getJSONChain(urls) {
  let lastErr;
  for (const u of urls) { try { return await getJSON(u); } catch (e) { lastErr = e; } }
  throw lastErr;
}

/* ============ quirky loading copy ============ */
const QUIPS = ['bribing the librarian…','dusting off the archives…','untangling citation spaghetti…','asking the peer reviewers nicely…','counting semicolons in the bibliography…','waking up the co-authors…','herding h-indexes…'];
let quipTimer = null;
function showLoading(msg) {
  const s = $('#status'); s.className = 'on';
  s.innerHTML = '';
  const card = el('div', 'loading-card');
  card.appendChild(el('div', 'spinner'));
  const t = el('div', '', esc(msg));
  card.appendChild(t); s.appendChild(card);
  clearInterval(quipTimer);
  quipTimer = setInterval(() => { t.textContent = QUIPS[Math.floor(Math.random() * QUIPS.length)]; }, 1600);
}
function showError(msg) {
  clearInterval(quipTimer);
  const s = $('#status'); s.className = 'on';
  s.innerHTML = '';
  s.appendChild(el('div', 'err-card', '💥 ' + esc(msg) + ' — try another paper?'));
}
function clearStatus() { clearInterval(quipTimer); const s = $('#status'); s.className = ''; s.innerHTML = ''; }
const miniLoad = msg => `<div class="mini-load"><div class="spinner"></div>${esc(msg)}</div>`;

/* ============ tooltip ============ */
const tip = $('#tip');
function tipShow(html, x, y) {
  tip.innerHTML = html; tip.style.display = 'block';
  const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(x + pad, innerWidth - w - 8) + 'px';
  tip.style.top = (y - h - pad < 8 ? y + pad : y - h - pad) + 'px';
}
function tipHide() { tip.style.display = 'none'; }

