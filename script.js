const message = document.getElementById('message');
const table = document.getElementById('dataTable');
const tbody = table.querySelector('tbody');
let data = [];
let sortState = { key: 'timeSubmitted', asc: false };

// Lazy-loading / pagination settings
const PAGE_SIZE = 50; // items to add per scroll
let displayedCount = PAGE_SIZE;
let isLoadingMore = false;
let rafScheduled = false;

// description modal: inject styles and create modal container
function createDescriptionModal(){
  if (document.getElementById('desc-modal-overlay')) return;
  const style = document.createElement('style');
  style.textContent = `
  #desc-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:9999}
  #desc-modal{background:#fff;max-width:900px;width:90%;max-height:80vh;overflow:auto;border-radius:6px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,0.3);}
  #desc-modal .desc-close{position:absolute;right:12px;top:8px;background:transparent;border:none;font-size:20px;cursor:pointer}
  #desc-modal pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:14px}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'desc-modal-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });

  const modal = document.createElement('div');
  modal.id = 'desc-modal';
  modal.style.position = 'relative';

  const close = document.createElement('button');
  close.className = 'desc-close';
  close.innerHTML = '✕';
  close.addEventListener('click', () => { overlay.style.display = 'none'; });

  const content = document.createElement('div');
  content.id = 'desc-modal-content';
  const pre = document.createElement('pre');
  pre.id = 'desc-modal-pre';
  content.appendChild(pre);

  modal.appendChild(close);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function openDescriptionModal(text){
  createDescriptionModal();
  const overlay = document.getElementById('desc-modal-overlay');
  const pre = document.getElementById('desc-modal-pre');
  if (pre) pre.textContent = text || '';
  if (overlay) overlay.style.display = 'flex';
}

Array.from(table.querySelectorAll('th')).forEach(th => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (sortState.key === key) sortState.asc = !sortState.asc; else { sortState.key = key; sortState.asc = true; }
    // reset pagination when sort changes
    displayedCount = PAGE_SIZE;
    window.scrollTo({ top: 0 });
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
      title: item.title || '',
      sponsors: Array.isArray(item.sponsors) ? item.sponsors : [],
      description: item.description || '',
      descriptionLanguage: (item.descriptionLanguage || '').toLowerCase(),
    }));
    displayedCount = PAGE_SIZE;
    message.textContent = `Loaded ${data.length} items.`;
    renderTable();
  }).catch(err => {
    message.textContent = 'Failed to load: ' + err;
  });
}

function getFilteredSortedRows(){
  let rows = data.slice();
  rows = rows.filter(item => Array.isArray(item.sponsors) && item.sponsors.length > 0);
  // apply English-only filter if checkbox enabled
  const cb = document.getElementById('filterEnglishOnly');
  if (cb && cb.checked){
    rows = rows.filter(r => {
      const lang = (r.descriptionLanguage || '').toLowerCase();
      return lang === 'en';
    });
  }

  // apply time-range filter if inputs are present
  const startInput = document.getElementById('filterStart');
  const endInput = document.getElementById('filterEnd');
  if ((startInput && startInput.value) || (endInput && endInput.value)){
    // inputs are date-only; treat start as that day's midnight (00:00)
    // and end as the following day's midnight so the end date is inclusive
    function parseDateStart(v){
      if (!v) return null;
      const parts = v.split('-');
      const y = parseInt(parts[0],10); const m = parseInt(parts[1],10) - 1; const d = parseInt(parts[2],10);
      return new Date(y, m, d, 0, 0, 0, 0);
    }
    function parseDateEndExclusive(v){
      if (!v) return null;
      const parts = v.split('-');
      const y = parseInt(parts[0],10); const m = parseInt(parts[1],10) - 1; const d = parseInt(parts[2],10);
      return new Date(y, m, d + 1, 0, 0, 0, 0);
    }
    let startDate = startInput && startInput.value ? parseDateStart(startInput.value) : null;
    let endDate = endInput && endInput.value ? parseDateEndExclusive(endInput.value) : null;
    rows = rows.filter(r => {
      if (!r.timeSubmitted) return false;
      const t = new Date(r.timeSubmitted);
      if (startDate && t < startDate) return false;
      if (endDate && t >= endDate) return false;
      return true;
    });
  }
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
  return rows;
}

function renderTable(){
  const rows = getFilteredSortedRows();
  const visible = rows.slice(0, displayedCount);

  tbody.innerHTML = '';
  visible.forEach(item => {
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

    const descTd = document.createElement('td');
    const descTxt = item.description || '';
    if (!descTxt){
      descTd.textContent = '';
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'desc-preview';
      const preview = descTxt.length > 120 ? (descTxt.slice(0, 120).replace(/\s+\S*$/, '') + '…') : descTxt;
      btn.textContent = preview;
      btn.title = 'Click to view full description';
      btn.addEventListener('click', () => openDescriptionModal(descTxt));
      descTd.appendChild(btn);
    }

    // title column (after video link)
    const titleTd = document.createElement('td');
    titleTd.textContent = item.title || '';

    tr.appendChild(timeTd);
    tr.appendChild(videoTd);
    tr.appendChild(titleTd);
    tr.appendChild(sponsorsTd);
    tr.appendChild(descTd);
    // language column
    const langTd = document.createElement('td');
    langTd.textContent = item.descriptionLanguage || '';
    tr.appendChild(langTd);
    tbody.appendChild(tr);
  });

  Array.from(table.querySelectorAll('th')).forEach(th => {
    const key = th.getAttribute('data-key');
    th.classList.remove('sort-asc','sort-desc');
    if (sortState.key === key) th.classList.add(sortState.asc ? 'sort-asc' : 'sort-desc');
  });

  // update status message with visible count
  message.textContent = `Loaded ${data.length} items — showing ${visible.length}/${getFilteredSortedRows().length}.`;
}

function loadMore(){
  if (isLoadingMore) return;
  const total = getFilteredSortedRows().length;
  if (displayedCount >= total) return;
  isLoadingMore = true;
  setTimeout(() => {
    displayedCount = Math.min(displayedCount + PAGE_SIZE, total);
    renderTable();
    isLoadingMore = false;
  }, 50);
}

function onScroll(){
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    const triggerDistance = 200; // px from bottom
    if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - triggerDistance)){
      loadMore();
    }
  });
}

window.addEventListener('scroll', onScroll);

window.addEventListener('DOMContentLoaded', () => { 
  createDescriptionModal(); 
  // wire filter checkbox to reset pagination and re-render
  const cb = document.getElementById('filterEnglishOnly');
  if (cb){
    cb.addEventListener('change', () => { displayedCount = PAGE_SIZE; window.scrollTo({ top: 0 }); renderTable(); });
  }
  // initialize time filter defaults (start = 48 hours ago's date, end = today)
  const startInput = document.getElementById('filterStart');
  const endInput = document.getElementById('filterEnd');
  function formatLocalDate(d){
    const yy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yy}-${mm}-${dd}`;
  }
  if (startInput){ const s = new Date(Date.now() - 48*3600*1000); startInput.value = formatLocalDate(s); startInput.addEventListener('change', ()=>{ displayedCount = PAGE_SIZE; window.scrollTo({ top:0 }); renderTable(); }); }
  if (endInput){ const e = new Date(); endInput.value = formatLocalDate(e); endInput.addEventListener('change', ()=>{ displayedCount = PAGE_SIZE; window.scrollTo({ top:0 }); renderTable(); }); }
  // wire download button
  const dl = document.getElementById('downloadJson');
  if (dl){
    dl.addEventListener('click', () => {
      const rows = getFilteredSortedRows();
      const out = rows.map(r => ({
        videoID: r.videoID,
        timeSubmitted: r.timeSubmitted,
        title: r.title || '',
        sponsors: r.sponsors || [],
        description: r.description || '',
        descriptionLanguage: r.descriptionLanguage || ''
      }));
      const blob = new Blob([JSON.stringify(out, null, 2)], {type: 'application/json;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date().toISOString().replace(/[:.]/g,'-');
      a.download = `filtered-${now}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
  loadData();
});
