(() => {
  const dropZone       = document.getElementById('dropZone');
  const fileInput      = document.getElementById('fileInput');
  const fileList       = document.getElementById('fileList');
  const emptyState     = document.getElementById('emptyState');
  const fileCountBadge = document.getElementById('fileCountBadge');
  const outputPanel    = document.getElementById('outputPanel');
  const emptyContent   = document.getElementById('emptyContent');
  const outputText     = document.getElementById('outputText');
  const fileName       = document.getElementById('fileName');
  const lineCount      = document.getElementById('lineCount');
  const charCount      = document.getElementById('charCount');
  const copyBtn        = document.getElementById('copyBtn');
  const downloadBtn    = document.getElementById('downloadBtn');
  const toast          = document.getElementById('toast');
  const sidebar        = document.getElementById('sidebar');
  const menuToggle     = document.getElementById('menuToggle');
  const sidebarClose   = document.getElementById('sidebarClose');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const topbarTitle    = document.getElementById('topbarTitle');

  const isMobile = () => window.innerWidth <= 640;

  // ── Sidebar toggle ───────────────────────────────────────────
  function openSidebar() {
    if (isMobile()) {
      sidebar.classList.add('open');
      sidebarOverlay.classList.add('visible');
    } else {
      sidebar.classList.remove('collapsed');
    }
  }

  function closeSidebar() {
    if (isMobile()) {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('visible');
    } else {
      sidebar.classList.add('collapsed');
    }
  }

  function toggleSidebar() {
    if (isMobile()) {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    } else {
      sidebar.classList.contains('collapsed') ? openSidebar() : closeSidebar();
    }
  }

  menuToggle.addEventListener('click', toggleSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Close sidebar on mobile when a file is selected
  function closeSidebarOnMobile() {
    if (isMobile()) closeSidebar();
  }

  // ── State ────────────────────────────────────────────────────
  const files = []; // { id, name, baseName, lines, bookmarks }
  let activeId  = null;
  let idCounter = 0;

  // ── SRT Parser ───────────────────────────────────────────────
  function parseSRT(raw) {
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split(/\n{2,}/);
    const result = [];
    for (const block of blocks) {
      const bLines = block.trim().split('\n');
      if (!bLines.length) continue;
      const isSeq   = /^\d+$/.test(bLines[0].trim());
      const tsLine  = bLines[isSeq ? 1 : 0] || '';
      const tsMatch = tsLine.match(/(\d{2}:\d{2}:\d{2})[,\.]\d{3}\s*-->/);
      const isTime  = !!tsMatch;
      const timestamp = tsMatch ? tsMatch[1] : '';
      let start = 0;
      if (isSeq)  start = 1;
      if (isTime) start = isSeq ? 2 : 1;
      const text = bLines.slice(start)
        .map(l => l.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean);
      if (text.length) result.push({ text: text.join(' '), timestamp });
    }
    return result;
  }

  function linesToPlainText(lines) {
    return lines.map(l => l.text).join('\n');
  }

  // ── Gist viewer ──────────────────────────────────────────────
  function renderViewer(lines) {
    outputText.innerHTML = '';
    const padLen = String(lines.length).length;
    const f = files.find(x => x.id === activeId);
    const bookmarks = f ? f.bookmarks : new Set();

    lines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'gist-row' + (bookmarks.has(i) ? ' bookmarked' : '');
      row.dataset.idx = i;

      const bm = document.createElement('span');
      bm.className = 'gist-bookmark';
      bm.innerHTML = `<svg viewBox="0 0 10 13" xmlns="http://www.w3.org/2000/svg"><path d="M1 1h8v11l-4-3-4 3V1z"/></svg>`;

      const num = document.createElement('span');
      num.className = 'gist-num';
      num.textContent = String(i + 1).padStart(padLen, ' ');

      const txt = document.createElement('span');
      txt.className = 'gist-text';
      txt.textContent = line.text;

      row.appendChild(bm);
      row.appendChild(num);
      row.appendChild(txt);

      if (line.timestamp) {
        const ts = document.createElement('span');
        ts.className = 'gist-ts';
        ts.textContent = line.timestamp;
        row.appendChild(ts);
      }

      row.addEventListener('click', () => toggleBookmark(i, row));
      outputText.appendChild(row);
    });
  }

  function toggleBookmark(idx, row) {
    const f = files.find(x => x.id === activeId);
    if (!f) return;
    if (f.bookmarks.has(idx)) {
      f.bookmarks.delete(idx);
      row.classList.remove('bookmarked');
    } else {
      f.bookmarks.add(idx);
      row.classList.add('bookmarked');
    }
  }

  // ── Add files ────────────────────────────────────────────────
  function addFiles(fileObjs) {
    let firstNew = null;
    for (const file of fileObjs) {
      if (!file.name.toLowerCase().endsWith('.srt')) continue;
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = ++idCounter;
        const baseName = file.name.replace(/\.srt$/i, '');
        const lines = parseSRT(e.target.result);
        files.push({ id, name: file.name, baseName, lines, bookmarks: new Set() });
        renderSidebar();
        if (firstNew === null) { firstNew = id; setActive(id); }
      };
      reader.readAsText(file, 'UTF-8');
    }
  }

  // ── Sidebar ──────────────────────────────────────────────────
  function renderSidebar() {
    fileList.innerHTML = '';
    if (files.length === 0) {
      fileList.appendChild(emptyState);
      fileCountBadge.textContent = '0';
      fileCountBadge.classList.remove('has-files');
      return;
    }
    fileCountBadge.textContent = files.length;
    fileCountBadge.classList.add('has-files');

    for (const f of files) {
      const li   = document.createElement('li');
      li.className = 'file-item' + (f.id === activeId ? ' active' : '');
      li.dataset.id = f.id;

      const dot  = document.createElement('span');
      dot.className = 'file-item-dot';

      const name = document.createElement('span');
      name.className = 'file-item-name';
      name.textContent = f.baseName;
      name.title = f.name;

      const del  = document.createElement('button');
      del.className = 'file-item-del';
      del.textContent = '✕';
      del.title = 'Remove';
      del.addEventListener('click', (e) => { e.stopPropagation(); removeFile(f.id); });

      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(del);
      li.addEventListener('click', () => { setActive(f.id); closeSidebarOnMobile(); });
      fileList.appendChild(li);
    }
  }

  // ── Set active ───────────────────────────────────────────────
  function setActive(id) {
    activeId = id;
    const f = files.find(x => x.id === id);
    if (!f) return;

    document.querySelectorAll('.file-item').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.id) === id);
    });

    fileName.textContent = f.baseName + '.txt';
    topbarTitle.innerHTML = f.baseName + '<span class="accent">.txt</span>';
    renderViewer(f.lines);

    const total = f.lines.length;
    lineCount.textContent = `${total} line${total !== 1 ? 's' : ''}`;
    charCount.textContent = `${linesToPlainText(f.lines).length.toLocaleString()} chars`;

    emptyContent.style.display = 'none';
    outputPanel.classList.add('visible');
  }

  // ── Remove ───────────────────────────────────────────────────
  function removeFile(id) {
    const idx = files.findIndex(x => x.id === id);
    if (idx === -1) return;
    files.splice(idx, 1);
    if (activeId === id) {
      const next = files[idx] || files[idx - 1];
      if (next) { setActive(next.id); }
      else {
        activeId = null;
        outputPanel.classList.remove('visible');
        emptyContent.style.display = '';
        topbarTitle.innerHTML = 'SRT<span class="accent">→</span>TXT';
      }
    }
    renderSidebar();
  }

  // ── Drag & drop ──────────────────────────────────────────────
  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', (e) => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop',      (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); addFiles(Array.from(e.dataTransfer.files)); });
  document.addEventListener('dragover',  (e) => e.preventDefault());
  document.addEventListener('drop',      (e) => {
    e.preventDefault();
    if (Array.from(e.dataTransfer.files).some(f => f.name.toLowerCase().endsWith('.srt')))
      addFiles(Array.from(e.dataTransfer.files));
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { addFiles(Array.from(fileInput.files)); fileInput.value = ''; });

  // ── Actions ──────────────────────────────────────────────────
  copyBtn.addEventListener('click', () => {
    const f = files.find(x => x.id === activeId);
    if (f) navigator.clipboard.writeText(linesToPlainText(f.lines)).then(showToast);
  });

  downloadBtn.addEventListener('click', () => {
    const f = files.find(x => x.id === activeId);
    if (!f) return;
    const blob = new Blob([linesToPlainText(f.lines)], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = f.baseName + '.txt'; a.click();
    URL.revokeObjectURL(url);
  });

  // ── Toast ────────────────────────────────────────────────────
  let toastTimer;
  function showToast() {
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  renderSidebar();
})();
