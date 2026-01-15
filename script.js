const message = document.getElementById('message');
const table = document.getElementById('dataTable');
const tbody = table.querySelector('tbody');
let data = [];
let sortState = { key: 'timeSubmitted', asc: false };

Array.from(table.querySelectorAll('th')).forEach(th => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (sortState.key === key) sortState.asc = !sortState.asc; else { sortState.key = key; sortState.asc = true; }
    renderTable();
  });
});

function loadData(){
  message.textContent = 'Loading trimmed.json...';
  fetch('cdn/json/trimmed.json').then(r => {
    if (!r.ok) throw new Error('Network response was not ok: ' + r.status);
    return r.json();
  }).then(json => {
    data = json.map(item => ({
      timeSubmitted: item.timeSubmitted,
      videoID: item.videoID,
      sponsors: Array.isArray(item.sponsors) ? item.sponsors : []
    }));
    message.textContent = `Loaded ${data.length} items.`;
    renderTable();
  }).catch(err => {
    message.textContent = 'Failed to load: ' + err;
  });
}

function renderTable(){
  let rows = data.slice();
  // skip entries that have no sponsors to display
  rows = rows.filter(item => Array.isArray(item.sponsors) && item.sponsors.length > 0);
  if (sortState.key){
    rows.sort((a,b) => {
      if (sortState.key === 'timeSubmitted'){
        const da = new Date(a.timeSubmitted || 0).getTime();
        const db = new Date(b.timeSubmitted || 0).getTime();
        return (da - db) * (sortState.asc ? 1 : -1);
      }
      if (sortState.key === 'video'){
        const va = (a.videoID || '').toLowerCase();
        const vb = (b.videoID || '').toLowerCase();
        if (va < vb) return sortState.asc ? -1 : 1;
        if (va > vb) return sortState.asc ? 1 : -1;
        return 0;
      }
      if (sortState.key === 'sponsorCount'){
        const ca = (a.sponsors || []).length;
        const cb = (b.sponsors || []).length;
        return (ca - cb) * (sortState.asc ? 1 : -1);
      }
      return 0;
    });
  }

  tbody.innerHTML = '';
  rows.forEach(item => {
    const tr = document.createElement('tr');
    const timeTd = document.createElement('td');
    timeTd.textContent = item.timeSubmitted ? new Date(item.timeSubmitted).toLocaleString() : '';
    const videoTd = document.createElement('td');
    if (item.videoID){
      const aVid = document.createElement('a');
      const vidUrl = 'https://www.youtube.com/watch?v=' + item.videoID;
      aVid.href = vidUrl;
      aVid.textContent = vidUrl;
      aVid.target = '_blank';
      aVid.rel = 'noopener noreferrer';
      videoTd.appendChild(aVid);
    } else {
      videoTd.textContent = '';
    }
    const sponsorsTd = document.createElement('td');
    if (!item.sponsors || item.sponsors.length === 0){
      sponsorsTd.textContent = '';
    } else {
      const ul = document.createElement('ul');
      ul.style.paddingLeft = '18px';
      item.sponsors.forEach(s => {
        const li = document.createElement('li');
        if (s.link){
          const a = document.createElement('a');
          a.href = s.link;
          a.textContent = s.link;
          a.target = '_blank';
          li.appendChild(a);
        } else {
          li.textContent = s.sponsorName || s.sponsor || '';
        }
        ul.appendChild(li);
      });
      sponsorsTd.appendChild(ul);
    }
    tr.appendChild(timeTd); tr.appendChild(videoTd); tr.appendChild(sponsorsTd);
    tbody.appendChild(tr);
  });

  Array.from(table.querySelectorAll('th')).forEach(th => {
    const key = th.getAttribute('data-key');
    th.classList.remove('sort-asc','sort-desc');
    if (sortState.key === key) th.classList.add(sortState.asc ? 'sort-asc' : 'sort-desc');
  });
}

window.addEventListener('DOMContentLoaded', loadData);
