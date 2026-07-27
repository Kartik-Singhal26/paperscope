/* ============ mode toggle ============ */
let MODE = 'paper';
const DAY_SEED = Math.floor(Date.now() / 864e5); // rotates once a day, same for everyone
const pick = arr => arr[DAY_SEED % arr.length];
const PAPER_EXAMPLES = [
  ['Attention is all you need', 'CRISPR-Cas9', '10.1038/nature14539'],
  ['Deep residual learning', 'mRNA vaccines', '10.1126/science.1258096'],
  ['Highly accurate protein structure prediction with AlphaFold', 'graphene', '10.1038/s41586-021-03819-2'],
  ['Generative adversarial networks', 'gut microbiome', '10.1038/nature14539'],
  ['ImageNet classification with deep convolutional neural networks', 'perovskite solar cells', '10.1126/science.1258096'],
  ['A brief history of black holes', 'quantum supremacy', '10.1038/s41586-019-1666-5'],
  ['Random forests', 'circadian rhythms', '10.1038/nature14539'],
];
const AUTHOR_EXAMPLES = ['Yoshua Bengio', 'Jennifer Doudna', 'Terence Tao', 'Katalin Karikó', 'Demis Hassabis', 'Frances Arnold', 'Shinya Yamanaka'];
const MODE_UI = {
  paper: { ph: 'Type a paper title or paste a DOI…', hint: () => {
    const [a, b, doi] = pick(PAPER_EXAMPLES);
    return `Try <b>“${a}”</b>, <b>“${b}”</b>, or paste a DOI like <b>${doi}</b> · press 🎲 for pot luck · fresh examples daily`;
  } },
  author: { ph: 'Type a researcher’s name or paste an ORCID…', hint: () => `Try your own name, <b>“${pick(AUTHOR_EXAMPLES)}”</b>, or paste an ORCID like <b>0000-0002-1825-0097</b> — ORCID skips the name-twin problem · 🎲 for a random star` },
};
function setMode(m) {
  MODE = m;
  $('#modePaper').classList.toggle('on', m === 'paper');
  $('#modeAuthor').classList.toggle('on', m === 'author');
  $('#modeCompare').classList.toggle('on', m === 'compare');
  const cmp = m === 'compare';
  document.querySelector('.searchbox').style.display = cmp ? 'none' : '';
  document.querySelector('.hint').style.display = cmp ? 'none' : '';
  $('#vsbar').style.display = cmp ? '' : 'none';
  if (!cmp) {
    $('#vsresults').style.display = 'none';
    qInput.placeholder = MODE_UI[m].ph;
    document.querySelector('.hint').innerHTML = MODE_UI[m].hint();
  } else {
    $('#results').className = '';
    $('#trendingWrap').style.display = 'none';
  }
  closeSug();
}
$('#modePaper') && document.addEventListener('DOMContentLoaded', () => {});

/* panel headlines per mode */
function setModeTexts(m) {
  $('#tabCoauth').style.display = m === 'author' ? '' : 'none';
  $('#tabWhere').style.display = m === 'author' ? '' : 'none';
  if (m !== 'author' && $('#tabWhere').classList.contains('on')) setTab('rank');
  $('#journeyPanel').style.display = m === 'author' ? '' : 'none';
  if (m !== 'author' && $('#coauthTab').style.display !== 'none' && $('#tabCoauth').classList.contains('on')) setTab('rank');
  if (m === 'author') {
    $('#netTitle').textContent = '🗺️ PAPER PORTFOLIO';
    $('#netsub').textContent = 'Every paper is a bubble — size = citations, color = subfield. Blue links = papers of theirs that cite each other. Click one to scope it, or flip to the timeline for the career view.';
    $('#mapTitle').textContent = '🌍 WHERE THE FANS ARE';
    $('#crewTitle').textContent = '🧑‍🔬 THE FAN CLUB';
    $('#tabRank').textContent = '🏛️ TOP VENUES';
  } else {
    $('#netTitle').textContent = '🕸️ SIMILAR-PAPER MAP';
    $('#netsub').textContent = 'Papers orbiting this one — OpenAlex “related works” + heavy-hitters from the same topic. Node size = citations, color = subfield. Drag nodes! Click one to scope that paper.';
    $('#mapTitle').textContent = '🌍 WHO CITES IT, WHERE';
    $('#crewTitle').textContent = '🧑‍🔬 THE CITING CREW';
    $('#tabRank').textContent = '🏆 JOURNAL RANK';
  }
}


// stamp today's examples into the landing hint on first paint
document.querySelector('.hint').innerHTML = MODE_UI.paper.hint();
