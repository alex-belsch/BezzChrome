(() => {
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');

  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');

  const linkNodes = Array.from({length:5}, (_,i) => document.getElementById('l'+i));
  const editLinksBtn = document.getElementById('editLinks');
  const linkEditor = document.getElementById('linkEditor');
  const editorBody = document.getElementById('editorBody');
  const closeEditorBtn = document.getElementById('closeEditor');
  const saveLinksBtn = document.getElementById('saveLinks');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const cfg = {
    density: 1.8,
    linkDist: 140,
    size: 3.0,
    speed: 0.5,
    links: JSON.parse(localStorage.getItem('pc-links') || '[]')
  };
  if (!cfg.links.length) {
    cfg.links = [
      { label: 'Link 1', url: '#' },
      { label: 'Link 2', url: '#' },
      { label: 'Link 3', url: '#' },
      { label: 'Link 4', url: '#' },
      { label: 'Link 5', url: '#' },
    ];
  }
  const persistLinks = () => localStorage.setItem('pc-links', JSON.stringify(cfg.links));

  function renderLinks() {
    cfg.links.slice(0,5).forEach((l, i) => {
      linkNodes[i].textContent = l.label || ('Link ' + (i+1));
      linkNodes[i].href = l.url && l.url !== '' ? l.url : '#';
    });
  }

  function openEditor() {
    editorBody.innerHTML = '';
    cfg.links.slice(0,5).forEach((l, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input type="text" placeholder="Label" value="${l.label || ''}" data-idx="${i}" data-kind="label" />
        <input type="url" placeholder="https://example.com" value="${l.url || ''}" data-idx="${i}" data-kind="url" />
      `;
      editorBody.appendChild(row);
    });
    linkEditor.classList.remove('hidden');
  }
  function closeEditor() { linkEditor.classList.add('hidden'); }

  editLinksBtn.addEventListener('click', openEditor);
  closeEditorBtn.addEventListener('click', closeEditor);
  linkEditor.addEventListener('click', (e) => { if (e.target === linkEditor) closeEditor(); });
  saveLinksBtn.addEventListener('click', () => {
    const inputs = editorBody.querySelectorAll('input');
    inputs.forEach(inp => {
      const i = parseInt(inp.getAttribute('data-idx'), 10);
      const k = inp.getAttribute('data-kind');
      cfg.links[i][k] = inp.value.trim();
    });
    persistLinks();
    renderLinks();
    closeEditor();
  });

  window.addEventListener('load', () => { try { searchInput.focus(); } catch(e){} });
  searchForm.addEventListener('submit', (e) => {
    const q = (searchInput.value || '').trim();
    if (!q) { e.preventDefault(); searchInput.focus(); }
  });

  let particles = [];
  let running = true;
  const mouse = { x: null, y: null, active: false };
  const DESTROY_RADIUS = 80;

  function resize() {
    canvas.width = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    initParticles();
  }

  function particleCountForArea() {
    const area = window.innerWidth * window.innerHeight;
    const base = area / 11000;
    return Math.max(40, Math.floor(base * cfg.density));
  }
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function makeParticle() {
    const ang = rand(0, Math.PI * 2);
    const speed = cfg.speed;
    return { x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
             vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: cfg.size };
  }
  function initParticles() {
    const count = particleCountForArea();
    particles = new Array(count).fill(0).map(() => makeParticle());
  }
  function pointSegDist(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const c1 = vx*wx + vy*wy;
    if (c1 <= 0) return Math.hypot(px - x1, py - y1);
    const c2 = vx*vx + vy*vy;
    if (c2 <= c1) return Math.hypot(px - x2, py - y2);
    const b = c1 / c2; const bx = x1 + b * vx, by = y1 + b * vy;
    return Math.hypot(px - bx, py - by);
  }
  function impulseAwayFromMouse(p) {
    const dx = p.x - mouse.x, dy = p.y - mouse.y;
    const dist = Math.hypot(dx, dy) || 1;
    const push = 0.9;
    p.vx += (dx/dist) * push; p.vy += (dy/dist) * push;
    const sp = Math.hypot(p.vx, p.vy) || 1;
    p.vx = (p.vx / sp) * cfg.speed; p.vy = (p.vy / sp) * cfg.speed;
    p.x += (dx/dist) * 4; p.y += (dy/dist) * 4;
  }

  function step() {
    if (!running) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < -50) p.x = window.innerWidth + 50;
      if (p.x > window.innerWidth + 50) p.x = -50;
      if (p.y < -50) p.y = window.innerHeight + 50;
      if (p.y > window.innerHeight + 50) p.y = -50;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(229,231,235,0.9)'; ctx.fill();
    }

    const maxDist = cfg.linkDist;
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < maxDist * maxDist) {
          let cut = false;
          if (mouse.active) {
            const md = pointSegDist(mouse.x, mouse.y, a.x, a.y, b.x, b.y);
            if (md < DESTROY_RADIUS) { cut = true; impulseAwayFromMouse(a); impulseAwayFromMouse(b); }
          }
          if (!cut) {
            const alpha = 1 - Math.sqrt(d2) / maxDist;
            ctx.strokeStyle = `rgba(148,163,184,${alpha * 0.8})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    }
    requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  window.addEventListener('mouseleave', () => { mouse.active = false; });
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') { running = !running; if (running) requestAnimationFrame(step); }
  });

  renderLinks();
  resize();
  requestAnimationFrame(step);
})();