const { chromium } = require('playwright');

const work = (id, name, year, cites, field, topic) => ({
  id: `https://openalex.org/${id}`, display_name: name, publication_year: year,
  cited_by_count: cites, doi: `https://doi.org/10.1000/${id}`,
  primary_topic: { id: 'https://openalex.org/T10102', display_name: topic || 'Scientometrics', subfield: { id: 'https://openalex.org/subfields/1802', display_name: (field || 'Decision Sciences') + ' — Applied' }, field: { id: 'https://openalex.org/fields/18', display_name: field || 'Decision Sciences' } },
});

const MAIN = {
  ...work('W2741809807', 'Attention Is All You Need (test fixture)', 2017, 130000, 'Computer Science', 'Neural nets'),
  authorships: [
    { author: { id: 'https://openalex.org/A100', display_name: 'Ashish Vaswani' }, institutions: [{ display_name: 'Google Brain', country_code: 'US' }], countries: ['US'] },
    { author: { id: 'https://openalex.org/A101', display_name: 'Noam Shazeer' }, institutions: [{ display_name: 'Google Brain', country_code: 'US' }], countries: ['US'] },
  ],
  topics: [], concepts: [{ id: 'https://openalex.org/C154945302', display_name: 'Artificial intelligence', score: 0.9 }],
  primary_location: { source: { id: 'https://openalex.org/S1983995261', display_name: 'NeurIPS', type: 'conference' } },
  related_works: Array.from({ length: 10 }, (_, i) => `https://openalex.org/W90${i}`),
  referenced_works: ['https://openalex.org/W900', 'https://openalex.org/W901'],
  counts_by_year: Array.from({ length: 9 }, (_, i) => ({ year: 2018 + i, cited_by_count: [500, 1500, 4000, 9000, 16000, 26000, 30000, 34000, 12000][i] })),
  open_access: { is_oa: true },
};
// related papers cite each other: W901->W900, W902->W900, W903->W901
for (const [a, b] of [[1, 0], [2, 0], [3, 1]]) {
  // patched into relatedBatch after its definition below
}

const relatedBatch = { results: Array.from({ length: 10 }, (_, i) => work(`W90${i}`, `Related paper number ${i} with a long-ish title`, 2015 + i, 50 * (i + 1), ['Computer Science', 'Mathematics', 'Engineering'][i % 3])) , meta: { count: 10 } };
relatedBatch.results[1].referenced_works = ['https://openalex.org/W900', 'https://openalex.org/W2741809807'];
relatedBatch.results[2].referenced_works = ['https://openalex.org/W900'];
relatedBatch.results[3].referenced_works = ['https://openalex.org/W901'];
const topicTop = { results: Array.from({ length: 8 }, (_, i) => work(`W80${i}`, `Topic heavyweight ${i}`, 2010 + i, 900 - i * 100, 'Computer Science')), meta: { count: 8 } };
const topicTop2 = { results: Array.from({ length: 9 }, (_, i) => work(`W81${i}`, `Freshly spawned paper ${i}`, 2019, 400 - i * 30, ['Physics', 'Computer Science'][i % 2])), meta: { count: 9 } };

const srcDetail = { id: 'https://openalex.org/S1983995261', display_name: 'NeurIPS', type: 'conference', works_count: 21000, cited_by_count: 900000, summary_stats: { '2yr_mean_citedness': 8.31, h_index: 412, i10_index: 9000 } };
const srcRank = {
  meta: { count: 132 },
  results: Array.from({ length: 20 }, (_, i) => ({
    id: `https://openalex.org/S${i === 6 ? '1983995261' : 5000 + i}`,
    display_name: i === 6 ? 'NeurIPS' : `Journal of Serious Things ${i}`,
    summary_stats: { '2yr_mean_citedness': 20 - i, h_index: 100 - i },
  })),
};

const groupCountries = { group_by: [
  { key: 'US', key_display_name: 'United States', count: 4200 }, { key: 'CN', key_display_name: 'China', count: 3900 },
  { key: 'GB', key_display_name: 'UK', count: 1200 }, { key: 'DE', key_display_name: 'Germany', count: 980 },
  { key: 'IN', key_display_name: 'India', count: 940 }, { key: 'KR', key_display_name: 'South Korea', count: 600 },
  { key: 'JP', key_display_name: 'Japan', count: 580 }, { key: 'CA', key_display_name: 'Canada', count: 500 },
  { key: 'AU', key_display_name: 'Australia', count: 300 }, { key: 'BR', key_display_name: 'Brazil', count: 210 },
  { key: 'unknown', key_display_name: 'unknown', count: 999 },
] };

const citers = { meta: { count: 152000 }, results: Array.from({ length: 100 }, (_, i) => ({
  id: `https://openalex.org/W7${i}`, display_name: `Citing paper ${i}`, publication_year: 2020, cited_by_count: 1000 - i,
  authorships: [
    { author: { id: `https://openalex.org/A${200 + (i % 5)}`, display_name: ['Yann Le Cun', 'Fei-Fei Li', 'Jitendra Malik', 'Yoshua Bengio', 'Percy Liang'][i % 5] }, institutions: [{ id: `https://openalex.org/I${300 + (i % 5)}`, display_name: ['NYU', 'Stanford', 'Berkeley', 'MILA', 'Stanford'][i % 5], country_code: ['US','US','US','CA','US'][i % 5] }], countries: ['US'] },
  ],
})) };

const authorsBatch = { results: Array.from({ length: 5 }, (_, i) => ({
  id: `https://openalex.org/A${200 + i}`, display_name: ['Yann Le Cun', 'Fei-Fei Li', 'Jitendra Malik', 'Yoshua Bengio', 'Percy Liang'][i],
  works_count: 400 + i * 30, cited_by_count: 150000 - i * 10000,
  summary_stats: { h_index: 140 - i * 7 }, last_known_institutions: [{ id: `https://openalex.org/I${300 + i}`, display_name: ['NYU','Stanford','Berkeley','MILA','Stanford'][i], country_code: ['US','US','US','CA','US'][i] }],
})) };

const autoc = { results: [
  { id: 'https://openalex.org/W2741809807', display_name: 'Attention Is All You Need (test fixture)', hint: 'Ashish Vaswani et al., 2017', cited_by_count: 130000 },
  { id: 'https://openalex.org/W123', display_name: 'Attention in psychology', hint: 'Someone Else, 1990', cited_by_count: 500 },
] };

function routeFor(url) {
  const u = decodeURIComponent(url);
  if (process.env.FALLBACK) {
    if (u.includes('group_by=authorships.countries')) return null;
    if (u.includes('/sources?filter=topics.id:')) return null;
    if (u.includes('filter=ids.openalex:W90')) return null;
    if (u.includes('/authors?filter=ids.openalex:')) return null;
  }
  if (u.includes('/autocomplete/works')) return autoc;
  if (u.match(/\/works\/W2741809807/)) return MAIN;
  const wd = u.match(/\/works\/(W90\d)\?/);
  if (wd) { const r = relatedBatch.results.find(x => x.id.endsWith(wd[1])); return { ...r, authorships: [], topics: [], concepts: [], related_works: [], counts_by_year: [{ year: 2020, cited_by_count: 30 }, { year: 2021, cited_by_count: 60 }, { year: 2022, cited_by_count: 90 }, { year: 2023, cited_by_count: 100 }, { year: 2024, cited_by_count: 70 }] }; }
  if (u.includes('filter=ids.openalex:W90') || u.includes('filter=openalex_id:W90')) return relatedBatch;
  if (u.includes('filter=primary_topic.id:')) return u.includes('page=2') ? topicTop2 : topicTop;
  if (u.match(/\/sources\/S1983995261/)) return srcDetail;
  if (u.includes('summary_stats.2yr_mean_citedness:>')) return { meta: { count: 136 }, results: [] };
  if (u.includes('summary_stats.h_index:>')) return { meta: { count: 0 }, results: [] };
  if (u.includes('/sources?filter=topics.id:') || u.includes('/sources?filter=x-concepts.id:')) return srcRank;
  if (u.includes('group_by=authorships.countries')) return groupCountries;
  if (u.includes('filter=cites:')) return citers;
  if (u.includes('/authors?filter=ids.openalex:')) return authorsBatch;
  if (u.includes('sample=1')) return { results: [{ id: 'https://openalex.org/W2741809807' }], meta: { count: 1 } };
  if (u.includes('/works?search=')) return { results: [MAIN], meta: { count: 1 } };
  return null;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.route('**/api.openalex.org/**', async route => {
    const fx = routeFor(route.request().url());
    if (fx) await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(fx) });
    else await route.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: 'not found' }) });
  });

  await page.route('**/api.semanticscholar.org/**', async route => {
    const u = route.request().url();
    const body = u.includes('/DOI:') ? { citationCount: 94, influentialCitationCount: 6 } : { data: [{ citationCount: 94, influentialCitationCount: 6 }] };
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });

  await page.goto('file:///home/claude/paperscope/index.html');
  await page.screenshot({ path: 'shot_home.png' });

  // autocomplete flow
  await page.fill('#q', 'attention is all');
  await page.waitForSelector('.suggest.open', { timeout: 5000 });
  await page.screenshot({ path: 'shot_suggest.png' });
  await page.click('.sug');

  await page.waitForSelector('#results.on', { timeout: 8000 });
  await page.waitForTimeout(2500); // let panels + physics settle
  await page.screenshot({ path: process.env.FALLBACK ? 'shot_fallback.png' : 'shot_full.png', fullPage: true });

  // checks
  const checks = {};
  checks.hero = await page.textContent('#hero');
  checks.rank = await page.textContent('#journal');
  checks.legend = await page.textContent('#netlegend');
  checks.cbars = await page.textContent('#cbars');
  checks.authors = await page.textContent('#acards');
  checks.mapsub = await page.textContent('#mapsub');
  checks.s2 = await page.textContent('#s2badge');
  checks.venueBadge = await page.getAttribute('.badge.v', 'href');
  checks.rankLink = await page.getAttribute('.rank-ctx a', 'href');
  checks.leaderLink = await page.getAttribute('.bars .brow .nm a', 'href');
  checks.countryLink = await page.getAttribute('#cbars a.brow', 'href');
  checks.instLink = await page.getAttribute('.acard .inst a', 'href');
  checks.gsLink = await page.getAttribute('.badge.gs', 'href');
  const netCanvas = await page.$('#net'); checks.netCanvas = !!netCanvas;
  const mapCanvas = await page.$('#worldmap'); checks.mapCanvas = !!mapCanvas;

  // hover network center for tooltip
  if (netCanvas) {
    const bb = await netCanvas.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(300);
    checks.tooltipVisible = await page.evaluate(() => document.getElementById('tip').style.display === 'block');
  }
  // trend tab, permalink, edges, timeline
  await page.click('#tabTrend');
  checks.trendVisible = await page.$eval('#trendTab', el => el.style.display !== 'none');
  checks.trendBars = await page.$$eval('#trend rect', els => els.length);
  checks.trendText = await page.$eval('#trend', el => el.textContent.replace(/\s+/g, ' ').slice(0, 100));
  await page.screenshot({ path: 'shot_trend.png' });
  await page.click('#tabRank');
  checks.rankBack = await page.$eval('#rankTab', el => el.style.display !== 'none');
  checks.originalLink = await page.getAttribute('.hero a.badge.share[target=_blank]', 'href');
  checks.permalink = await page.evaluate(() => location.search);
  checks.edges = await page.evaluate(() => window.NET.edges.length);
  checks.realCiteHubs = await page.evaluate(() => window.NET.nodes.filter(n => n.realCite).length);
  await page.click('#timeBtn');
  await page.waitForTimeout(900);
  checks.mode = await page.evaluate(() => window.NET.mode);
  await page.screenshot({ path: 'shot_timeline.png' });
  await page.click('#timeBtn');
  checks.modeBack = await page.evaluate(() => window.NET.mode);
  await page.waitForTimeout(600);
  checks.centerRestored = await page.evaluate(() => {
    const c = window.NET.nodes[0];
    return Math.abs(c.x - window.NET.W / 2) < 2 && Math.abs(c.y - window.NET.H / 2) < 2;
  });

  // network interactions: legend isolation, spawn, closeness table
  checks.nodesBefore = await page.evaluate(() => window.NET.nodes.length);
  await page.click('#netlegend .lg');                       // isolate first field
  checks.isolated = await page.evaluate(() => window.NET.isolated);
  checks.legendOff = await page.$$eval('#netlegend .lg.off', els => els.length);
  await page.click('#netlegend .lg');                       // un-isolate
  checks.unIsolated = await page.evaluate(() => window.NET.isolated);
  await page.click('#moreBtn');
  await page.waitForTimeout(600);
  checks.nodesAfter = await page.evaluate(() => window.NET.nodes.length);
  await page.click('#tableBtn');
  await page.waitForTimeout(200);
  checks.tableRows = await page.$$eval('#nettable .ntrow', els => els.length);
  checks.tableFirst = await page.textContent('#nettable .ntrow');
  await page.click('#nettable .ntrow');
  await page.waitForTimeout(1200);
  checks.inAppNav = (await page.textContent('#hero')).includes('Related paper number');
  checks.inAppPermalink = await page.evaluate(() => location.search);
  await page.screenshot({ path: 'shot_net.png', fullPage: false });

  // pot-luck roll
  await page.click('#lucky');
  await page.waitForSelector('#results.on', { timeout: 8000 });
  await page.waitForTimeout(800);
  checks.luckyHero = (await page.textContent('#hero')).includes('Attention Is All You Need');
  console.log(JSON.stringify(checks, null, 1));
  console.log('CONSOLE ISSUES:', errors.length ? errors.slice(0, 10) : 'none');
  await browser.close();
})();
