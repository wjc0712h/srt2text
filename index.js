(() => {
  const dropZone    = document.getElementById('dropZone');
  const fileInput   = document.getElementById('fileInput');
  const fileList    = document.getElementById('fileList');
  const emptyState  = document.getElementById('emptyState');
  const fileCountBadge = document.getElementById('fileCountBadge');
  const outputPanel = document.getElementById('outputPanel');
  const emptyContent= document.getElementById('emptyContent');
  const outputText  = document.getElementById('outputText');
  const fileName    = document.getElementById('fileName');
  const lineCount   = document.getElementById('lineCount');
  const charCount   = document.getElementById('charCount');
  const copyBtn     = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const toast       = document.getElementById('toast');

  // State
  const files = []; // { id, name, baseName, text }
  let activeId = null;
  let idCounter = 0;

  // ── SRT Parser ─────────────────────────────────────────────
  function parseSRT(raw) {
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split(/\n{2,}/);
    const lines = [];
    for (const block of blocks) {
      const bLines = block.trim().split('\n');
      if (bLines.length < 1) continue;
      const isSeq  = /^\d+$/.test(bLines[0].trim());
      const isTime = /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(bLines[1] || '');
      let start = 0;
      if (isSeq)  start = 1;
      if (isTime) start = 2;
      const text = bLines.slice(start)
        .map(l => l.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean);
      if (text.length) lines.push(text.join(' '));
    }
    return lines.join('\n');
  }

  // ── Add files ───────────────────────────────────────────────
  function addFiles(fileObjs) {
    let firstNew = null;
    for (const file of fileObjs) {
      if (!file.name.toLowerCase().endsWith('.srt')) continue;
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = ++idCounter;
        const baseName = file.name.replace(/\.srt$/i, '');
        const text = parseSRT(e.target.result);
        files.push({ id, name: file.name, baseName, text });
        renderSidebar();
        if (firstNew === null) {
          firstNew = id;
          setActive(id);
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
  }

  // ── Sidebar rendering ───────────────────────────────────────
  function renderSidebar() {
    // Clear
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
      const li = document.createElement('li');
      li.className = 'file-item' + (f.id === activeId ? ' active' : '');
      li.dataset.id = f.id;

      const dot = document.createElement('span');
      dot.className = 'file-item-dot';

      const name = document.createElement('span');
      name.className = 'file-item-name';
      name.textContent = f.baseName;
      name.title = f.name;

      const del = document.createElement('button');
      del.className = 'file-item-del';
      del.textContent = '✕';
      del.title = 'Remove';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(f.id);
      });

      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(del);
      li.addEventListener('click', () => setActive(f.id));
      fileList.appendChild(li);
    }
  }

  // ── Set active file ─────────────────────────────────────────
  function setActive(id) {
    activeId = id;
    const f = files.find(x => x.id === id);
    if (!f) return;

    // Update sidebar highlight
    document.querySelectorAll('.file-item').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.id) === id);
    });

    // Show output
    fileName.textContent = f.baseName + '.txt';
    outputText.textContent = f.text;

    const lines = f.text.split('\n').length;
    lineCount.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
    charCount.textContent = `${f.text.length.toLocaleString()} characters`;

    emptyContent.style.display = 'none';
    outputPanel.classList.add('visible');
  }

  // ── Remove file ─────────────────────────────────────────────
  function removeFile(id) {
    const idx = files.findIndex(x => x.id === id);
    if (idx === -1) return;
    files.splice(idx, 1);

    if (activeId === id) {
      // Switch to nearest neighbour
      const next = files[idx] || files[idx - 1];
      if (next) {
        setActive(next.id);
      } else {
        activeId = null;
        outputPanel.classList.remove('visible');
        emptyContent.style.display = '';
      }
    }
    renderSidebar();
  }

  // ── Drag & drop ─────────────────────────────────────────────
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files));
  });

  // Also allow drop anywhere on the page
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const hasFile = Array.from(e.dataTransfer.files).some(f => f.name.toLowerCase().endsWith('.srt'));
    if (hasFile) addFiles(Array.from(e.dataTransfer.files));
  });

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  // ── Actions ─────────────────────────────────────────────────
  copyBtn.addEventListener('click', () => {
    const f = files.find(x => x.id === activeId);
    if (!f) return;
    navigator.clipboard.writeText(f.text).then(showToast);
  });

  downloadBtn.addEventListener('click', () => {
    const f = files.find(x => x.id === activeId);
    if (!f) return;
    const blob = new Blob([f.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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

  // Init
  renderSidebar();
})();
