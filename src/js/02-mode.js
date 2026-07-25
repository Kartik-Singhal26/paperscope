/* ============ mode toggle ============ */
let MODE = 'paper';
const MODE_UI = {
  paper: { ph: 'Type a paper title or paste a DOI…', hint: 'Try <b>“Attention is all you need”</b>, <b>“CRISPR-Cas9”</b>, or paste a DOI like <b>10.1038/nature14539</b> · press 🎲 for pot luck' },
  author: { ph: 'Type a researcher’s name or paste an ORCID…', hint: 'Try your own name, or paste an ORCID like <b>0000-0002-1825-0097</b> — ORCID skips the name-twin problem · 🎲 for a random star' },
};
function setMode(m) {
  MODE = m;
  $('#modePaper').classList.toggle('on', m === 'paper');
  $('#modeAuthor').classList.toggle('on', m === 'author');
  qInput.placeholder = MODE_UI[m].ph;
  document.querySelector('.hint').innerHTML = MODE_UI[m].hint;
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

