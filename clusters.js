(function(){
  const table = document.getElementById('clustersTable');
  const tbody = table.querySelector('tbody');
  const message = document.getElementById('message');
  const cbEnglish = document.getElementById('filterEnglishOnly');
  const startInput = document.getElementById('filterStart');
  const endInput = document.getElementById('filterEnd');
  let clustersData = [];
  const downloadBtn = document.getElementById('downloadBtn');
  // sortState: key can be 'count', 'domain', 'links' ; dir 'asc'|'desc'
  let sortState = { key: 'count', dir: 'desc' };

  function setSort(key){
    if (sortState.key === key){
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.dir = key === 'count' ? 'desc' : 'asc';
    }
    renderFiltered();
    updateHeaderIndicators();
  }

  function updateHeaderIndicators(){
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th, idx) => {
      th.classList.remove('sort-asc','sort-desc');
      let key = idx === 0 ? 'domain' : (idx === 1 ? 'representative' : (idx === 2 ? 'count' : 'links'));
      if (key === sortState.key){
        th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  async function loadClusters(){
    message.textContent = 'Loading clusters...';

    fetch('cdn/json/sponsor_clusters.json' ).then(r => {
        if (!r.ok) 
            throw new Error('Network response was not ok: ' + r.status);
        return r.json();
    }).then(json => {
        let clusters = [];
            if (Array.isArray(json)) clusters = json;
            else if (json.clusters) clusters = json.clusters;
            else if (json.results) clusters = json.results;
            else clusters = json;

            clustersData = clusters;
            renderFiltered();
    });
  }

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

  function renderFiltered(){
    if (!clustersData) return;
    let rows = clustersData.slice();
    // english-only filter
    if (cbEnglish && cbEnglish.checked){
      rows = rows.filter(r => (r.language || '').toLowerCase() === 'en');
    }
    // prepare date filter bounds
    let sdate = startInput && startInput.value ? parseDateStart(startInput.value) : null;
    let edate = endInput && endInput.value ? parseDateEndExclusive(endInput.value) : null;

    // For each row compute `_filteredLinks` based on unique_data timeSubmitted and date filters
    rows = rows.map(r => {
      const ud = r.unique_data || [];
      let filtered = [];
      if (!sdate && !edate){
        filtered = Array.isArray(ud) ? ud.slice() : [];
      } else {
        if (Array.isArray(ud) && ud.length && ud[0] && typeof ud[0] === 'object' && ud[0].timeSubmitted){
          filtered = ud.filter(i => {
            if (!i || !i.timeSubmitted) return false;
            const d = new Date(i.timeSubmitted);
            if (isNaN(d)) return false;
            if (sdate && d < sdate) return false;
            if (edate && d >= edate) return false;
            return true;
          });
        } else {
          // fallback: if cluster-level latestTimeSubmitted is within range, include all links
          let lt = r.latestTimeSubmitted ? new Date(r.latestTimeSubmitted) : null;
          if (lt && !isNaN(lt)){
            if ((sdate && lt < sdate) || (edate && lt >= edate)){
              filtered = [];
            } else {
              filtered = Array.isArray(ud) ? ud.slice() : [];
            }
          } else {
            filtered = [];
          }
        }
      }
      // attach temp filtered links for later use in sorting/rendering
      return Object.assign({}, r, {_filteredLinks: filtered});
    }).filter(r => {
      // only keep rows that have at least one filtered link
      return Array.isArray(r._filteredLinks) && r._filteredLinks.length > 0;
    });

    // sorting based on header clicks
    const key = sortState.key;
    const dir = sortState.dir === 'asc' ? 1 : -1;
    rows.sort((a,b) => {
      if (key === 'count') {
        const ac = (Array.isArray(a._filteredLinks) ? a._filteredLinks.length : ((a.unique_data||[]).length || (a.count||0)));
        const bc = (Array.isArray(b._filteredLinks) ? b._filteredLinks.length : ((b.unique_data||[]).length || (b.count||0)));
        return dir * (ac - bc);
      }
      if (key === 'domain') return dir * String((a.domain||'')).localeCompare(String((b.domain||'')));
      if (key === 'representative') return dir * String((a.representative||'')).localeCompare(String((b.representative||'')));
      if (key === 'links') {
        const la = (Array.isArray(a._filteredLinks) ? a._filteredLinks.length : (a.unique_data||[]).length) || 0;
        const lb = (Array.isArray(b._filteredLinks) ? b._filteredLinks.length : (b.unique_data||[]).length) || 0;
        return dir * (la - lb);
      }
      return 0;
    });

    tbody.innerHTML = '';
    rows.forEach(c => {
      const tr = document.createElement('tr');
      const domainTd = document.createElement('td');
      domainTd.textContent = c.domain || '';
      const repTd = document.createElement('td');
      repTd.textContent = c.representative || c.rep || '';
      const countTd = document.createElement('td');
      const effectiveCount = Array.isArray(c._filteredLinks) ? c._filteredLinks.length : ((c.unique_data||[]).length || (c.count||0));
      countTd.textContent = String(effectiveCount);
      const linksTd = document.createElement('td');
      const links = Array.isArray(c._filteredLinks) ? c._filteredLinks : (c.unique_data || []);
      if (Array.isArray(links) && links.length){
        const ul = document.createElement('ul');
        ul.style.paddingLeft = '18px';
        links.forEach(l => {
          const href = (typeof l === 'string') ? l : (l && l.link ? l.link : '');
          if (!href) return;
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = href;
          a.textContent = href;
          a.target = '_blank';
          li.appendChild(a);
          ul.appendChild(li);
        });
        linksTd.appendChild(ul);
      } else {
        linksTd.textContent = '';
      }
      tr.appendChild(domainTd);
      tr.appendChild(repTd);
      tr.appendChild(countTd);
      tr.appendChild(linksTd);
      tbody.appendChild(tr);
    });
    message.textContent = `Showing ${rows.length}/${clustersData.length} clusters.`;
  }

  window.addEventListener('DOMContentLoaded', () => {
    // set defaults for date inputs (start = 48 hours ago, end = today)
    function formatLocalDate(d){ const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; }
    if (startInput){ const s = new Date(Date.now() - 48*3600*1000); startInput.value = formatLocalDate(s); startInput.addEventListener('change', renderFiltered); }
    if (endInput){ const e = new Date(); endInput.value = formatLocalDate(e); endInput.addEventListener('change', renderFiltered); }
    if (cbEnglish) cbEnglish.addEventListener('change', renderFiltered);
    // wire header clicks for sorting
    const ths = table.querySelectorAll('thead th');
    if (ths && ths.length){
      ths.forEach((th, idx) => {
        th.style.cursor = 'pointer';
          th.addEventListener('click', () => {
            const key = idx === 0 ? 'domain' : (idx === 1 ? 'representative' : (idx === 2 ? 'count' : 'links'));
            setSort(key);
          });
      });
      updateHeaderIndicators();
    }
    if (downloadBtn) downloadBtn.addEventListener('click', () => {
      // produce JSON from currently filtered rows
      let rows = clustersData.slice();
      // reuse filtering logic by temporarily using renderFiltered's core filters
      // apply english filter
      if (cbEnglish && cbEnglish.checked){
        rows = rows.filter(r => (r.language || '').toLowerCase() === 'en');
      }
      // apply date filters
      let sdate = startInput && startInput.value ? parseDateStart(startInput.value) : null;
      let edate = endInput && endInput.value ? parseDateEndExclusive(endInput.value) : null;
      if (sdate || edate){
        rows = rows.filter(r => {
          let t = null;
          const ud = r.unique_data || [];
          if (Array.isArray(ud) && ud.length){
            const times = ud.map(i => (i && i.timeSubmitted) ? new Date(i.timeSubmitted) : null).filter(Boolean);
            if (times.length) t = new Date(Math.max.apply(null, times.map(d => d.getTime())));
          }
          if (!t && r.latestTimeSubmitted) t = new Date(r.latestTimeSubmitted);
          if (!t) return false;
          if (sdate && t < sdate) return false;
          if (edate && t >= edate) return false;
          return true;
        });
      }
      // apply same sort using header-based state
      const key = sortState.key;
      const dir = sortState.dir === 'asc' ? 1 : -1;
      rows.sort((a,b) => {
        if (key === 'count') return dir * (((a.count||0) - (b.count||0)));
        if (key === 'domain') return dir * String((a.domain||a.rep||'')).localeCompare(String((b.domain||b.rep||'')));
        if (key === 'links') {
          const la = (a.unique_data||[]).length || 0;
          const lb = (b.unique_data||[]).length || 0;
          return dir * (la - lb);
        }
        return 0;
      });
      const out = rows.map(r => {
        const source = Array.isArray(r._filteredLinks) ? r._filteredLinks : (r.unique_data  || []);
        const urls = (Array.isArray(source) ? source.map(u => (typeof u === 'string') ? u : (u && u.link ? u.link : '')).filter(Boolean) : []);
        return {representative: r.representative||r.domain, domain: r.domain, count: urls.length, unique_links: urls, latestTimeSubmitted: r.latestTimeSubmitted, language: r.language};
      });
      const blob = new Blob([JSON.stringify(out, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clusters-filtered.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
    loadClusters();
  });
})();
