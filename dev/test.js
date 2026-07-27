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
  open_access: { is_oa: true, oa_status: 'gold', oa_url: 'http://mirror.example.cn/bad/copy' },
  locations: [
    { source: { display_name: 'NeurIPS' }, landing_page_url: 'https://doi.org/10.1000/W2741809807', pdf_url: null },
    { source: { display_name: 'arXiv (Cornell University)' }, landing_page_url: 'http://arxiv.org/abs/1706.03762', pdf_url: 'https://arxiv.org/pdf/1706.03762' },
  ],
  best_oa_location: { landing_page_url: 'http://mirror.example.cn/bad/copy', pdf_url: 'http://mirror.example.cn/bad/copy.pdf' },
  fwci: 208.6, citation_normalized_percentile: { value: 0.9999, is_in_top_1_percent: true, is_in_top_10_percent: true },
  biblio: { volume: '30', first_page: '5998', last_page: '6008' },
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

const SEED2 = {
  ...work('W777', 'Second seed: adaptive control of quadrotors', 2019, 900, 'Engineering', 'Quadrotor Control'),
  primary_topic: { id: 'https://openalex.org/T222', display_name: 'Quadrotor Control', subfield: { display_name: 'Aerospace Engineering' }, field: { display_name: 'Engineering' } },
  authorships: [], topics: [], concepts: [],
  related_works: ['https://openalex.org/W770', 'https://openalex.org/W771'],
  referenced_works: ['https://openalex.org/W900'],
  counts_by_year: [], open_access: {},
};
const seed2Orbit = { results: [
  { ...work('W770', 'Quadrotor neighbor A', 2018, 300, 'Engineering'), referenced_works: [] },
  { ...work('W771', 'Quadrotor neighbor B', 2020, 200, 'Engineering'), referenced_works: ['https://openalex.org/W777'] },
], meta: { count: 2 } };
const whereVenues = { results: [
  { id: 'https://openalex.org/S1', display_name: 'Journal of the Franklin Institute', type: 'journal', summary_stats: { '2yr_mean_citedness': 4.2 } },
  { id: 'https://openalex.org/S9', display_name: 'IEEE Transactions on Robotics', type: 'journal', summary_stats: { '2yr_mean_citedness': 9.1 } },
  { id: 'https://openalex.org/S10', display_name: 'Some Repository', type: 'repository', summary_stats: { '2yr_mean_citedness': 99 } },
], meta: { count: 3 } };
const AUTHOR = {
  id: 'https://openalex.org/A5023888391', display_name: 'Kartik Singhal', orcid: 'https://orcid.org/0000-0002-1825-0097',
  works_count: 42, cited_by_count: 1234, summary_stats: { h_index: 18, i10_index: 25 },
  counts_by_year: Array.from({ length: 8 }, (_, i) => ({ year: 2019 + i, cited_by_count: [20, 60, 120, 200, 260, 240, 220, 90][i] })),
  last_known_institutions: [{ id: 'https://openalex.org/I999', display_name: 'IIT Bombay', country_code: 'IN' }],
  affiliations: [{ institution: { display_name: 'IIT Bombay' }, years: [2015, 2016, 2020] }],
  topics: [{ id: 'https://openalex.org/T111', display_name: 'Robot Control', count: 15 }, { id: 'https://openalex.org/T112', display_name: 'Nonlinear Systems', count: 9 }],
};
const authorWorks = { meta: { count: 42 }, results: Array.from({ length: 20 }, (_, i) => ({
  ...work(`W60${i}`, `Their paper number ${i}`, 2015 + (i % 9), 300 - i * 12, ['Engineering', 'Computer Science'][i % 2]),
  referenced_works: i > 0 && i % 4 === 0 ? [`https://openalex.org/W60${i - 1}`] : [],
})) };
const venueGroups = { group_by: [
  { key: 'https://openalex.org/S1', key_display_name: 'Journal of the Franklin Institute', count: 9 },
  { key: 'https://openalex.org/S2', key_display_name: 'IEEE TAC', count: 6 },
  { key: 'unknown', key_display_name: 'unknown', count: 5 },
  { key: 'https://openalex.org/S3', key_display_name: 'Automatica', count: 3 },
] };
const authorCiters = { meta: { count: 900 }, results: Array.from({ length: 60 }, (_, i) => ({
  id: `https://openalex.org/W5${i}`, display_name: `Fan paper ${i}`, publication_year: 2021, cited_by_count: 200 - i,
  authorships: i % 5 === 0
    ? [{ author: { id: 'https://openalex.org/A5023888391', display_name: 'Kartik Singhal' }, institutions: [], countries: ['IN'] }]
    : [{ author: { id: `https://openalex.org/A7${i % 4}`, display_name: ['Ada Fan', 'Bo Cite', 'Cy Ref', 'Di Quote'][i % 4] }, institutions: [{ id: `https://openalex.org/I7${i % 4}`, display_name: 'Fan University', country_code: ['US', 'CN', 'DE', 'IN'][i % 4] }], countries: [['US', 'CN', 'DE', 'IN'][i % 4]] }],
})) };

const posterAbstract = 'Background: The dominant sequence transduction models are based on complex recurrent or convolutional networks. Methods: We propose the Transformer, a new architecture based solely on attention mechanisms. Results: Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task. Conclusions: Attention really is all you need for sequence modeling.';
const POSTER_EXTRA = { abstract_inverted_index: (() => { const inv = {}; posterAbstract.split(' ').forEach((w, i) => { (inv[w] = inv[w] || []).push(i); }); return inv; })(), funders: [{ id: 'https://openalex.org/F1', display_name: 'National Science Foundation' }, { id: 'https://openalex.org/F2', display_name: 'Google Research' }], keywords: [{ display_name: 'Attention mechanism', score: 0.9 }, { display_name: 'Transformer', score: 0.8 }, { display_name: 'Sequence modeling', score: 0.6 }, { display_name: 'Noise keyword', score: 0.1 }] };
const posterRefs = { results: [
  { id: 'https://openalex.org/W900', display_name: 'Neural machine translation by jointly learning to align and translate', publication_year: 2015, authorships: [{ author: { display_name: 'Dzmitry Bahdanau' } }, { author: { display_name: 'Yoshua Bengio' } }] },
  { id: 'https://openalex.org/W901', display_name: 'Long short-term memory of <scp>d</scp>-glucose', publication_year: 1997, authorships: [{ author: { display_name: 'Sepp Hochreiter' } }] },
] };

function routeFor(url) {
  const u = decodeURIComponent(url);
  if (process.env.FALLBACK) {
    if (u.includes('group_by=authorships.countries')) return null;
    if (u.includes('/sources?filter=topics.id:')) return null;
    if (u.includes('filter=ids.openalex:W90')) return null;
    if (u.includes('/authors?filter=ids.openalex:')) return null;
    if (u.includes('select=abstract_inverted_index')) return null;
  }
  if (u.match(/\/works\/W123\?/)) return { ...work('W123', 'Attention in psychology', 1990, 500, 'Psychology'),
    authorships: [], topics: [], concepts: [], related_works: [], referenced_works: ['https://openalex.org/W1', 'https://openalex.org/W2'],
    counts_by_year: Array.from({ length: 9 }, (_, i) => ({ year: 2018 + i, cited_by_count: 30 + i * 5 })),
    open_access: {}, fwci: 1.4, citation_normalized_percentile: { value: 0.81 }, biblio: {} };
  if (u.match(/\/works\/W777\?/)) return SEED2;
  if (u.includes('filter=ids.openalex:W770|W771') || u.includes('filter=openalex_id:W770|W771')) return seed2Orbit;
  if (u.includes('filter=primary_topic.id:T222')) return { results: [], meta: { count: 0 } };
  if (u.includes('/sources?filter=topics.id:T111') || u.includes('/sources?filter=topics.id:T112')) return whereVenues;
  if (u.includes('/autocomplete/works') && u.includes('quadrotor')) return { results: [
    { id: 'https://openalex.org/W777', display_name: 'Second seed: adaptive control of quadrotors', hint: 'Someone, 2019', cited_by_count: 900 },
  ] };
  if (u.includes('/autocomplete/works')) return autoc;
  if (u.includes('/autocomplete/authors')) return { results: [{ id: AUTHOR.id, display_name: AUTHOR.display_name, hint: 'IIT Bombay', cited_by_count: 1234 }] };
  if (u.match(/\/authors\/A\d+\?/) || u.match(/\/authors\/https:\/\/orcid\.org/)) return AUTHOR;
  if (u.includes('authorships.author.id:A5023888391') && u.includes('group_by=primary_location.source.id')) return venueGroups;
  if (u.includes('authorships.author.id:A5023888391') && u.includes('group_by=authorships.author.id')) return { group_by: [
    { key: 'https://openalex.org/A5023888391', key_display_name: 'Kartik Singhal', count: 42 },
    { key: 'https://openalex.org/A801', key_display_name: 'Vineet Kumar', count: 18 },
    { key: 'https://openalex.org/A802', key_display_name: 'K.P.S. Rana', count: 14 },
  ] };
  if (u.includes('authorships.author.id:A5023888391') && u.includes('select=id,display_name,publication_year,cited_by_count,doi,primary_topic')) return { meta: { count: 42 }, results: Array.from({ length: 40 }, (_, i) => ({
    id: `https://openalex.org/W64${i}`, display_name: `Journey paper ${i}`, cited_by_count: 100 - i, doi: null,
    publication_year: 2016 + (i % 10),
    primary_topic: { subfield: { display_name: ['Control and Systems Engineering', 'Artificial Intelligence', 'Signal Processing'][i % 3] }, field: { display_name: 'Engineering' } },
  })) };
  if (u.includes('/authors?filter=ids.openalex:A80')) return { results: [
    { id: 'https://openalex.org/A801', display_name: 'Vineet Kumar', summary_stats: { h_index: 30 }, last_known_institutions: [{ id: 'https://openalex.org/I9', display_name: 'NSUT', country_code: 'IN' }] },
  ] };
  if (u.includes('biblio') && u.includes('filter=ids.openalex:W')) return { results: relatedBatch.results.slice(0, 5).map(r => ({ ...r, authorships: [{ author: { id: 'https://openalex.org/A1', display_name: 'Rel Author' } }], biblio: { volume: '1' } })) };
  if (u.includes('authorships.author.id:A5023888391')) return authorWorks;
  if (u.includes('filter=cites:W600|') && u.includes('group_by=authorships.countries')) return { group_by: [
    { key: 'US', count: 300 }, { key: 'CN', count: 200 }, { key: 'IN', count: 150 }, { key: 'DE', count: 80 }] };
  if (u.includes('filter=cites:W600|')) return authorCiters;
  if (u.includes('/authors?filter=ids.openalex:A7')) return { results: [] };
  if (u.includes('select=abstract_inverted_index')) return POSTER_EXTRA;
  if (u.includes('select=id,display_name,publication_year,authorships')) return posterRefs;
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
  if (u.includes('from_publication_date:') && u.includes('per-page=6')) return { results: Array.from({ length: 6 }, (_, i) => work(`W95${i}`, `Trending banger number ${i}`, 2026, 500 - i * 50, 'Computer Science')), meta: { count: 6 } };
  if (u.includes('sample=1')) return { results: [{ id: 'https://openalex.org/W2741809807' }], meta: { count: 1 } };
  if (u.includes('/works?search=')) return { results: [MAIN], meta: { count: 1 } };
  return null;
}

let srcDetail429 = 0;
(async () => {
  const fs = require('fs');
  const execPath = process.env.CHROMIUM_PATH !== undefined
    ? (process.env.CHROMIUM_PATH || undefined)
    : (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: execPath });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctxB.newPage();
  const errors = [];
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('429') && !m.text().includes('404')) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => { errors.push('PAGEERROR: ' + e.message); console.error('LIVE PAGEERROR:', e.message); });

  await page.route('**/api.openalex.org/**', async route => {
    const u0 = decodeURIComponent(route.request().url());
    if (u0.match(/\/sources\/S1983995261/) && srcDetail429++ === 0) {
      await route.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
      return;
    }
    const fx = routeFor(route.request().url());
    if (fx) await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(fx) });
    else await route.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: 'not found' }) });
  });

  await page.route('**/pub.orcid.org/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
      'activities-summary': {
        employments: { 'affiliation-group': [
          { summaries: [{ 'employment-summary': { organization: { name: 'IIT Bombay' }, 'role-title': 'Research Scholar', 'start-date': { year: { value: '2021' } }, 'end-date': null } }] },
          { summaries: [{ 'employment-summary': { organization: { name: 'NSUT Delhi' }, 'start-date': { year: { value: '2017' } }, 'end-date': { year: { value: '2021' } } } }] },
        ] },
        fundings: { group: [{}, {}] },
      },
    }) });
  });

  await page.route('**/api.semanticscholar.org/**', async route => {
    const u = route.request().url();
    let body;
    if (u.includes('fields=abstract')) body = u.includes('arXiv:2020.00001') ? { abstract: 'This preprint introduces a genuinely novel method, with the real abstract pulled from the arXiv record via Semantic Scholar for machine testing.' } : { abstract: null };
    else if (u.includes('/DOI:')) body = { citationCount: 94, influentialCitationCount: 6 };
    else body = { data: [{ citationCount: 94, influentialCitationCount: 6 }] };
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });

  const INDEX = process.env.PS_INDEX || '/home/claude/paperscope/index.html';
  await page.goto('file://' + INDEX);
  await page.waitForTimeout(800);
  checks0 = {};
  checks0.trendingShown = await page.$eval('#trendingWrap', el => el.style.display !== 'none');
  checks0.trendingCards = await page.$$eval('.tcard', els => els.length);
  checks0.hintDaily = (await page.textContent('.hint')).includes('fresh examples daily');
  checks0.trendingSampled = await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('sample=6')));
  checks0.versionFooter = (await page.textContent('#verSticker')).trim();
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
  const checks = Object.assign({}, typeof checks0 !== 'undefined' ? checks0 : {});
  checks.hero = await page.textContent('#hero');
  checks.trendingHidden = await page.$eval('#trendingWrap', el => el.style.display === 'none');
  checks.titlePaper = (await page.title()).includes('Attention Is All You Need');
  checks.rank = await page.textContent('#journal');
  checks.legend = await page.textContent('#netlegend');
  checks.cbars = await page.textContent('#cbars');
  checks.authors = await page.textContent('#acards');
  checks.mapsub = await page.textContent('#mapsub');
  checks.s2 = await page.textContent('#citeChip');
  checks.venueBadge = await page.getAttribute('.chip.v', 'href');
  checks.rankLink = await page.getAttribute('.rank-ctx a', 'href');
  checks.leaderLink = await page.getAttribute('.bars .brow .nm a', 'href');
  checks.countryLink = await page.getAttribute('#cbars a.brow', 'href');
  checks.instLink = await page.getAttribute('.acard .inst a', 'href');
  checks.gsLink = await page.getAttribute('.toolbar a[title*="Google Scholar"]', 'href');
  checks.gsLinkOk = /scholar\.google\.com\/scholar\?q=/.test(checks.gsLink || '');
  const netCanvas = await page.$('#net'); checks.netCanvas = !!netCanvas;
  const mapCanvas = await page.$('#worldmap'); checks.mapCanvas = !!mapCanvas;

  // hover network center for tooltip
  if (netCanvas) {
    let bb = null;
    for (let t = 0; t < 5 && !bb; t++) {   // re-query on detach: a late re-render can replace the canvas
      try { const h = await page.$('#net'); await h.scrollIntoViewIfNeeded(); bb = await h.boundingBox(); }
      catch (e) { await page.waitForTimeout(500); }
    }
    let tipOk = false;
    for (let i = 0; i < 12 && !tipOk; i++) {   // physics may still be settling — jiggle and retry
      await page.mouse.move(bb.x + bb.width / 2 + (i % 3), bb.y + bb.height / 2 + (i % 2));
      await page.waitForTimeout(220);
      tipOk = await page.evaluate(() => document.getElementById('tip').style.display === 'block');
    }
    checks.tooltipVisible = tipOk;
  }
  // fwci + percentile badges, bibtex
  const heroTxt = await page.textContent('#hero');
  checks.fwciBadge = !heroTxt.includes('208.6');  // moved out of hero
  checks.percBadge = heroTxt.includes('top 1%');
  checks.oaTierChip = heroTxt.includes('gold open access');
  checks.oaChipLink = await page.getAttribute('.chip.oa', 'href');
  // OA chip must prefer the clean arXiv copy over OpenAlex's low-quality mirror
  checks.oaChipPrefersArxiv = /^https:\/\/arxiv\.org\/abs\/1706\.03762/.test(checks.oaChipLink || '') && !/mirror\.example/.test(checks.oaChipLink || '');
  checks.arxivPill = await page.getAttribute('.toolbar a[title*="arXiv"]', 'href');
  checks.arxivPillHttps = /^https:\/\/arxiv\.org\/abs\/1706\.03762$/.test(checks.arxivPill || '');
  checks.originalPill = await page.getAttribute('.toolbar a.tool', 'href');
  // arXiv/Semantic Scholar abstract fallback (CORS-open) — real text only, null for closed papers
  checks.s2Fallback = await page.evaluate(() => s2Abstract({ doi: null, locations: [{ source: { display_name: 'arXiv' }, landing_page_url: 'https://arxiv.org/abs/2020.00001', pdf_url: 'https://arxiv.org/pdf/2020.00001' }] }).then(r => (r ? r.src + '::' + r.text.slice(0, 15) : 'null')).catch(e => 'ERR ' + e.message));
  checks.s2FallbackReal = /^the arXiv record::This preprint/.test(checks.s2Fallback || '');
  checks.s2FallbackNull = await page.evaluate(() => s2Abstract({ doi: 'https://doi.org/10.1/closed', locations: [] }).then(r => r === null).catch(() => false));
  await page.click('#bibBtn');
  await page.waitForTimeout(300);
  checks.bibHero = (await page.evaluate(() => navigator.clipboard.readText())).slice(0, 60);
  await page.click('#bibAllBtn');
  await page.waitForTimeout(1200);
  const allBib = await page.evaluate(() => navigator.clipboard.readText());
  checks.bibAllCount = (allBib.match(/@/g) || []).length;

  // trend tab, permalink, edges, timeline
  await page.click('#tabTrend');
  checks.trendVisible = await page.$eval('#trendTab', el => el.style.display !== 'none');
  checks.trendBars = await page.$$eval('#trend rect', els => els.length);
  checks.trendText = await page.$eval('#trend', el => el.textContent.replace(/\s+/g, ' ').slice(0, 100));
  checks.fwciTile = (await page.textContent('#trend')).includes('208.6');
  await page.screenshot({ path: 'shot_trend.png' });
  await page.click('#tabRank');
  checks.rankBack = await page.$eval('#rankTab', el => el.style.display !== 'none');
  checks.originalLink = await page.getAttribute('.toolbar a.tool', 'href');
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

  // ===== multi-seed map =====
  checks.seedVisible = await page.$eval('#seedwrap', el => el.style.display !== 'none');
  const preSeedNodes = await page.evaluate(() => window.NET.nodes.length);
  await page.fill('#seedInput', 'quadrotor control');
  await page.waitForSelector('#seedSug.open', { timeout: 5000 });
  await page.click('#seedSug .sug');
  await page.waitForTimeout(1500);
  checks.seedCount = await page.evaluate(() => window.NET.seeds.length);
  checks.seedNodesGrew = (await page.evaluate(() => window.NET.nodes.length)) > preSeedNodes;
  checks.seedBridge = await page.evaluate(() => window.NET.edges.some(e2 => !e2.a.center && !e2.b.center) || window.NET.nodes.some(n => n.realCite));
  checks.seedOwners = await page.evaluate(() => window.NET.nodes.filter(n => !n.center).every(n => !!n.owner));

  await page.$eval('#netbox', el => el.scrollIntoView());
  await page.waitForTimeout(2500);
  const nb = await page.$('.p-net');
  await nb.screenshot({ path: 'shot_multiseed.png' });

  // ===== author mode flow =====
  await page.click('#modeAuthor');
  await page.fill('#q', 'kartik singhal');
  await page.waitForSelector('.suggest.open', { timeout: 5000 });
  await page.click('.sug');
  await page.waitForSelector('#results.on', { timeout: 8000 });
  await page.waitForTimeout(2000);
  const heroA = await page.textContent('#hero');
  checks.aHero = heroA.includes('Kartik Singhal') && heroA.includes('ORCID') && heroA.includes('h-index 18');
  checks.aPermalink = await page.evaluate(() => location.search);
  checks.titleAuthor = (await page.title()).includes('Kartik Singhal');
  checks.aNetTitle = await page.textContent('#netTitle');
  checks.aVenues = (await page.textContent('#journal')).includes('Franklin Institute');
  checks.aFans = await page.textContent('#asub');
  checks.aFanExcludesSelf = !(await page.textContent('#acards')).includes('Kartik');
  checks.aNodes = await page.evaluate(() => window.NET.nodes.length);
  checks.aEdges = await page.evaluate(() => window.NET.edges.length);
  checks.aCountries = (await page.textContent('#cbars')).slice(0, 60);
  await page.click('#tabCoauth');
  const coTxt = await page.textContent('#coauth');
  checks.aCoauth = coTxt.includes('Vineet Kumar') && coTxt.includes('18×') && !coTxt.match(/#\d+\s*Kartik/);
  checks.aJourneyCells = await page.$$eval('#journey .jcell', els => els.length);
  checks.aJourneyRows = (await page.textContent('#journey')).includes('Control and Systems Engineering');
  await page.click('#journey .jcell.has');
  await page.waitForTimeout(200);
  const jd = await page.textContent('#journeyDetail');
  checks.aCellDetail = jd.includes('Journey paper') && jd.includes('cites');
  await page.click('.jd-close');
  checks.aCellClosed = await page.$eval('#journeyDetail', el => el.style.display === 'none');
  const jp = await page.$('#journeyPanel');
  await jp.screenshot({ path: 'shot_journey.png' });
  const co = await page.$('#coauthTab');
  await page.click('#tabRank');
  await page.click('#tabWhere');
  await page.waitForTimeout(400);
  const wtxt = await page.textContent('#wherenext');
  if (!process.env.FALLBACK) {
    checks.whereRows = wtxt.includes('IEEE Transactions on Robotics') && wtxt.includes('Franklin Institute');
    checks.whereHome = wtxt.includes("you've published here ×9");
    checks.whereNoRepo = !wtxt.includes('Some Repository');
  } else {
    checks.whereGraceful = wtxt.length > 0; // degrades to an empty-state, never crashes
  }
  checks.seedHiddenAuthor = await page.$eval('#seedwrap', el => el.style.display === 'none');
  await page.waitForTimeout(400);
  checks.orcidChips = (await page.textContent('#hero')).includes('IIT Bombay (2021–now)') && (await page.textContent('#hero')).includes('2 funded projects');
  await page.click('#tabRank');
  checks.aMoreBtn = await page.textContent('#moreBtn');
  await page.click('#moreBtn');
  checks.aAreas = (await page.textContent('#areasbox')).includes('Robot Control');
  checks.aTableLabel = (await page.click('#tableBtn'), await page.textContent('#tableBtn'));
  await page.click('#tableBtn');
  await page.click('#timeBtn');
  await page.waitForTimeout(400);
  checks.aStarHidden = await page.evaluate(() => window.NET.nodes[0].tx === -200);
  await page.click('#timeBtn');
  await page.screenshot({ path: 'shot_author.png', fullPage: true });

  // ORCID direct entry
  await page.fill('#q', '0000-0002-1825-0097');
  await page.click('#go');
  await page.waitForTimeout(1200);
  checks.orcidNav = (await page.textContent('#hero')).includes('Kartik Singhal');

  // back to paper mode via in-app switch for pot luck test
  await page.click('#modePaper');

  // ===== compare mode =====
  await page.click('#modeCompare');
  checks.vsBarShown = await page.$eval('#vsbar', el => el.style.display !== 'none');
  checks.vsSearchHidden = await page.$eval('.searchbox', el => el.style.display === 'none');
  await page.fill('#vsA', 'attention is all');
  await page.waitForSelector('#vsASug.open', { timeout: 5000 });
  await page.click('#vsASug .sug');                      // first suggestion = main fixture
  await page.fill('#vsB', 'attention is all');
  await page.waitForSelector('#vsBSug.open', { timeout: 5000 });
  await page.click('#vsBSug .sug:nth-child(2)');         // second suggestion = W123
  await page.waitForTimeout(1800);
  const vsHero = await page.textContent('#vsHeroes');
  checks.vsHeroes = vsHero.includes('CONTENDER A') && vsHero.includes('Attention in psychology');
  const tape = await page.textContent('#vstape');
  checks.vsTape = tape.includes('citations') && tape.includes('FWCI');
  checks.vsTapeWins = await page.$$eval('#vstape .win', els => els.length);
  checks.vsTrendBars = await page.$$eval('#vstrend rect', els => els.length);
  checks.vsGeo = (await page.textContent('#vsgeo')).includes('countries');
  checks.vsGeoDebug = await page.evaluate(() => vsCountries('W2741809807').then(r => r.length).catch(e => 'ERR ' + e.message));
  checks.vsPermalink = await page.evaluate(() => location.search);
  checks.titleVs = (await page.title()).includes(' vs ');
  await page.screenshot({ path: 'shot_vs.png', fullPage: true });
  // exit compare mode → normal paper flow returns
  await page.click('#modePaper');
  checks.vsExit = await page.$eval('#vsresults', el => el.style.display === 'none');
  await page.evaluate(() => loadPaper('W2741809807'));
  await page.waitForTimeout(1200);

  // pot-luck roll
  await page.click('#lucky');
  await page.waitForSelector('#results.on', { timeout: 8000 });
  await page.waitForTimeout(800);
  checks.luckyHero = (await page.textContent('#hero')).includes('Attention Is All You Need');
  // ===== touch behavior =====
  await page.evaluate(() => { window.IS_TOUCH = true; });
  const tapNode = () => page.evaluate(() => {
    const cv = document.getElementById('net');
    const r = cv.getBoundingClientRect();
    const n = window.NET.nodes[1];
    const o = { clientX: r.left + n.x, clientY: r.top + n.y, pointerId: 99, bubbles: true };
    cv.dispatchEvent(new PointerEvent('pointerdown', o));
    cv.dispatchEvent(new PointerEvent('pointerup', o));
  });
  await tapNode();
  await page.waitForTimeout(250);
  checks.touchFirstTapTip = await page.evaluate(() => document.getElementById('tip').style.display === 'block');
  checks.touchNoNav = (await page.textContent('#hero')).includes('Attention');
  await tapNode();
  await page.waitForTimeout(1200);
  checks.touchSecondTapNav = !(await page.textContent('#hero')).includes('Attention');
  await page.evaluate(() => { window.IS_TOUCH = false; loadPaper('W2741809807'); });
  await page.waitForTimeout(1000);

  // ===== hardening checks =====
  checks.retrySurvived429 = (await page.textContent('#journal')).includes('NeurIPS'); // rank rendered despite one 429
  // cache: reloading the same paper must not refetch (count via route)
  const hitsBefore = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('works/W2741809807')).length);
  await page.evaluate(() => loadPaper('W2741809807'));
  await page.waitForTimeout(1200);
  const hitsAfter = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('works/W2741809807')).length);
  checks.cacheHit = hitsAfter === hitsBefore;
  // physics idles after settling
  await page.waitForTimeout(4800);
  checks.physicsIdle = await page.evaluate(() => window.NET.idle === true && window.NET.raf === null);
  await page.hover('#net');
  await page.mouse.move(700, 500); // wake via pointermove
  await page.waitForTimeout(150);
  checks.physicsWakes = await page.evaluate(() => window.NET.idle === false);
  // resize redraws the canvas at the new width
  const wBefore = await page.evaluate(() => document.getElementById('net').width);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.waitForTimeout(600);
  const wAfter = await page.evaluate(() => document.getElementById('net').width);
  checks.resizeRedraw = wAfter !== wBefore;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(600);
  // race: navigate to a paper then immediately to the author — author must win
  await page.evaluate(() => { loadPaper('W900'); loadAuthor('A5023888391'); });
  await page.waitForTimeout(2000);
  checks.raceWinner = (await page.textContent('#hero')).includes('Kartik Singhal');
  await page.evaluate(() => loadPaper('W2741809807'));
  await page.waitForTimeout(1000);

  // citing-crew names load the author in-app
  await page.click('#acards .acard .nm a');
  await page.waitForTimeout(1500);
  checks.crewInApp = (await page.textContent('#hero')).includes('Kartik Singhal'); checks.crewSearch = await page.evaluate(() => location.search);
  await page.evaluate(() => loadPaper('W2741809807'));
  await page.waitForTimeout(1000);

  // logo returns to landing page
  await page.evaluate(() => { window.__loads = 0; const orig = window.loadPaper; window.loadPaper = function(id) { window.__loads++; window.__lastLoad = id + ' @' + new Error().stack.split('\n')[2]; return orig(id); }; });
  await page.click('#homeBtn');
  checks.homeImmediate = await page.evaluate(() => ({ cls: document.getElementById('results').className, search: location.search, trend: document.getElementById('trendingWrap').style.display }));
  await page.waitForTimeout(600);
  checks.homeLoads = await page.evaluate(() => ({ n: window.__loads, last: window.__lastLoad }));
  checks.homeResultsHidden = await page.$eval('#results', el => !el.className.includes('on'));
  checks.homeDebugHero = (await page.textContent('#hero')).slice(0, 60);
  checks.homeDebugSearch = await page.evaluate(() => location.search);
  checks.homeDebugStatus = await page.evaluate(() => document.getElementById('status').className);
  checks.homeTrending = await page.$eval('#trendingWrap', el => el.style.display !== 'none');
  checks.homeUrlClean = await page.evaluate(() => !location.search.match(/[wa]=|vs=/));
  checks.homeSearchCleared = await page.$eval('#q', el => el.value === '');
  checks.titleHome = (await page.title()).includes('feed it a paper');
  await page.evaluate(() => loadPaper('W2741809807'));
  await page.waitForTimeout(1000);

  // clickable author names in paper hero
  await page.click('#hero a.au');
  await page.waitForTimeout(1500);
  checks.heroAuthorNav = (await page.textContent('#hero')).includes('Kartik Singhal');
  checks.heroAuthorPermalink = await page.evaluate(() => location.search);

  // ===== poster studio =====
  await page.evaluate(() => loadPaper('W2741809807'));
  await page.waitForTimeout(1000);
  await page.click('#posterBtn');
  await page.waitForTimeout(1800);
  checks.posterOpen = await page.$eval('#posterStudio', el => el.style.display !== 'none');
  checks.posterArt = !!(await page.$('#posterArt'));
  const pTxt = (await page.textContent('#posterArt')).replace(/\s+/g, ' ');
  checks.posterTitle = pTxt.includes('Attention Is All You Need');
  checks.posterAuthors = pTxt.includes('Ashish Vaswani');
  checks.posterVenue = pTxt.includes('NeurIPS');
  checks.posterCredit = pTxt.includes('paperscope.net');
  checks.posterStats = pTxt.includes('citations') && pTxt.includes('130.0k');
  if (!process.env.FALLBACK) {
    checks.posterSections = pTxt.includes('Background') && pTxt.includes('Methods') && pTxt.includes('Results') && pTxt.includes('Conclusions');
    checks.posterAutoNote = pTxt.includes('auto-drafted from the public abstract');
    checks.posterFunding = pTxt.includes('National Science Foundation');
    checks.posterRefs = pTxt.includes('Bahdanau et al.') && pTxt.includes('(1997). Long short-term memory');
    checks.posterFlags = await page.$eval('.p-flags', el => el.textContent.trim().length > 0);
    checks.posterKeywords = pTxt.includes('Attention mechanism') && pTxt.includes('Transformer') && !pTxt.includes('Noise keyword');
    checks.posterOaBadge = pTxt.includes('gold open access');
    checks.posterRefsClean = pTxt.includes('d-glucose') && !pTxt.includes('<scp>');
    checks.posterSectionNums = await page.$$eval('.pb-num', els => els.length) >= 4;  // structured abstract → numbered
  } else {
    checks.posterHonest = pTxt.includes('doesn\u2019t have this paper\u2019s abstract on record');  // honest empty state, never invented text
  }
  checks.posterQrCount = await page.$$eval('.p-qr canvas', els => els.filter(c => c.width > 20).length) === 2;
  checks.posterScaled = await page.$eval('#posterArt', el => /scale\(/.test(el.style.transform));
  await page.screenshot({ path: process.env.FALLBACK ? 'shot_poster_fallback.png' : 'shot_poster.png' });
  // click-to-edit
  await page.evaluate(() => { document.querySelector('.p-title').textContent = 'Edited Poster Title'; });
  checks.posterEditable = await page.$eval('.p-title', el => el.getAttribute('contenteditable') === 'true' && el.textContent === 'Edited Poster Title');
  // figure upload (1×1 png via the file chooser)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.p-addfig')]);
  await chooser.setFiles({ name: 'fig.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.waitForTimeout(600);
  checks.posterFigure = !!(await page.$('.p-fig img'));
  // theme + size switching rewrites the artboard class and the @page rule
  await page.selectOption('#posterTheme', 'classic');
  checks.posterTheme = await page.$eval('#posterArt', el => el.classList.contains('classic'));
  await page.selectOption('#posterTheme', 'academic');
  checks.posterThemeAcademic = await page.$eval('#posterArt', el => el.classList.contains('academic'));
  await page.selectOption('#posterSize', 'a0l');
  checks.posterSizeCls = await page.$eval('#posterArt', el => el.classList.contains('a0l'));
  checks.posterPageRule = await page.$eval('#posterPageStyle', el => el.textContent.includes('1189mm 841mm'));
  await page.selectOption('#posterSize', 'a0p');
  await page.selectOption('#posterTheme', 'brutal');
  await page.waitForTimeout(400);
  // QR canvases → PNGs for offline machine decoding
  const qrData = await page.evaluate(() => ({ doi: document.getElementById('qrDoi').toDataURL(), scope: document.getElementById('qrScope').toDataURL() }));
  fs.writeFileSync('qr_doi.png', Buffer.from(qrData.doi.split(',')[1], 'base64'));
  fs.writeFileSync('qr_scope.png', Buffer.from(qrData.scope.split(',')[1], 'base64'));
  // close returns to the dashboard
  await page.click('#posterClose');
  checks.posterClosed = await page.$eval('#posterStudio', el => el.style.display === 'none');
  checks.posterScrollRestored = await page.evaluate(() => document.body.style.overflow === '');

  console.log(JSON.stringify(checks, null, 1));
  console.log('CONSOLE ISSUES:', errors.length ? errors.slice(0, 10) : 'none');
  await browser.close();
  // hard pass/fail for CI: any strictly-false check or console issue fails the run
  const failed = Object.entries(checks).filter(([, v]) => v === false).map(([k]) => k);
  if (failed.length || errors.length) {
    console.error('SUITE FAILED —', failed.length ? 'checks: ' + failed.join(', ') : '', errors.length ? '| console issues: ' + errors.length : '');
    process.exitCode = 1;
  } else {
    console.log('SUITE PASSED —', Object.keys(checks).length, 'checks');
  }
})();
