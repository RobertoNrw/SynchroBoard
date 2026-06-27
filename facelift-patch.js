/*
  ╔══════════════════════════════════════════════════════════════╗
  ║  SynchroBoard — FACELIFT PATCH 3                            ║
  ║  • Connection Context Menu (Farbe, Stil, Umkehren, Löschen) ║
  ║  • Multi-Selection CM (Align, Distribute, Group)            ║
  ║  • Canvas-CM (Template, Screenshot)                         ║
  ║  • Node Hover-Glow auf Canvas                               ║
  ║  • Connection Hover-Highlight                               ║
  ║  • Board-Name editierbar                                    ║
  ║  • Statusbar XY-Koordinaten                                 ║
  ║  • Save-Indicator Pulse                                     ║
  ║  • Drag-Lift Effekt                                         ║
  ║  • Node Opacity Slider im CM                                ║
  ║  • Sticky Color Switcher im CM                              ║
  ║  • Distribute evenly (H + V)                                ║
  ╚══════════════════════════════════════════════════════════════╝
*/

(function() {
'use strict';

// ─── Wait for app to be ready ────────────────────────────────────
function waitReady(cb) {
  if (typeof nodes !== 'undefined' && typeof conns !== 'undefined') { cb(); return; }
  setTimeout(() => waitReady(cb), 80);
}

waitReady(() => {

// ═══════════════════════════════════════════════════════════════
// 1. BOARD-NAME EDITIERBAR
// ═══════════════════════════════════════════════════════════════
const $logoSpan = document.querySelector('.tb-logo span:last-child');
if ($logoSpan) {
  $logoSpan.style.cursor = 'text';
  $logoSpan.title = 'Doppelklick zum Umbenennen';
  $logoSpan.addEventListener('dblclick', () => {
    const inp = document.createElement('input');
    inp.value = $logoSpan.textContent;
    inp.style.cssText = `background:transparent;border:none;border-bottom:1.5px solid var(--accent);outline:none;
      color:var(--text2);font-size:13px;font-weight:700;font-family:var(--font);width:${Math.max(80,$logoSpan.offsetWidth+20)}px;
      letter-spacing:.3px;padding:0 2px;`;
    $logoSpan.replaceWith(inp);
    inp.focus(); inp.select();
    const done = () => {
      const newName = inp.value.trim() || 'Infinite Canvas';
      const span = document.createElement('span');
      span.textContent = newName;
      span.style.cssText = $logoSpan.style.cssText;
      span.style.cursor = 'text';
      span.title = 'Doppelklick zum Umbenennen';
      inp.replaceWith(span);
      document.title = newName + ' — SynchroBoard';
      // Rebind
      span.addEventListener('dblclick', arguments.callee || (() => {}));
      try { localStorage.setItem('ic_board_name', newName); } catch(e) {}
    };
    inp.addEventListener('blur', done);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); inp.blur(); } });
  });
  // Restore saved name
  try {
    const saved = localStorage.getItem('ic_board_name');
    if (saved) { $logoSpan.textContent = saved; document.title = saved + ' — SynchroBoard'; }
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// 2. STATUSBAR XY-KOORDINATEN
// ═══════════════════════════════════════════════════════════════
const $statusbar = document.getElementById('statusbar');
let $xyDisplay = document.getElementById('xy-display');
if (!$xyDisplay && $statusbar) {
  $xyDisplay = document.createElement('span');
  $xyDisplay.id = 'xy-display';
  $xyDisplay.style.cssText = 'font-feature-settings:"tnum";color:var(--text3);font-size:10px;min-width:80px;text-align:right;';
  $xyDisplay.textContent = 'X:0 Y:0';
  const zoomDisplay = document.getElementById('zoom-display');
  if (zoomDisplay) $statusbar.insertBefore($xyDisplay, zoomDisplay);
  else $statusbar.appendChild($xyDisplay);
}

const $cvs = document.getElementById('canvas');
if ($cvs && $xyDisplay) {
  $cvs.addEventListener('mousemove', e => {
    const r = $cvs.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (typeof vx !== 'undefined' && typeof vy !== 'undefined' && typeof vs !== 'undefined') {
      const wx = Math.round((mx - vx) / vs);
      const wy = Math.round((my - vy) / vs);
      $xyDisplay.textContent = `X:${wx} Y:${wy}`;
    }
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════
// 3. SAVE-INDICATOR PULS-ANIMATION
// ═══════════════════════════════════════════════════════════════
const $saveInd = document.getElementById('save-indicator');
if ($saveInd) {
  const origSet = window.setSaveIndicator;
  if (origSet) {
    window.setSaveIndicator = function(msg, color) {
      origSet(msg, color);
      $saveInd.classList.remove('save-pulse');
      void $saveInd.offsetWidth; // reflow
      $saveInd.classList.add('save-pulse');
      setTimeout(() => $saveInd.classList.remove('save-pulse'), 600);
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. DRAG-LIFT EFFEKT (node scale-up beim Ziehen)
// ═══════════════════════════════════════════════════════════════
// Patchen der drawNode-Funktion um beim Ziehen ein visuelles Lift zu machen
// Wir überschreiben den shadowBlur während des Drags
const _origRender = window.render;
if (typeof render === 'function') {
  // Wir injizieren in den render-loop via rAF-Hook
  // isDrag + isND + dNode sind globale Variablen in app.js
  const _patchDrawNode = setInterval(() => {
    if (typeof drawNode === 'function') {
      clearInterval(_patchDrawNode);
      const _origDrawNode = drawNode;
      window.drawNode = function(n) {
        if (typeof isDrag !== 'undefined' && isDrag &&
            typeof isND !== 'undefined' && isND &&
            typeof selN !== 'undefined' && selN.includes(n)) {
          // Boost shadow during drag
          if (typeof ctx !== 'undefined') {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 32;
          }
        }
        _origDrawNode(n);
        // Reset after
        if (typeof ctx !== 'undefined') {
          ctx.shadowBlur = 0;
          ctx.shadowColor = 'transparent';
        }
      };
    }
  }, 100);
}

// ═══════════════════════════════════════════════════════════════
// 5. CONNECTION HOVER-HIGHLIGHT
// ═══════════════════════════════════════════════════════════════
let hoveredConn = null;

const _patchConnHover = setInterval(() => {
  if (typeof drawConn === 'function' && typeof cAt === 'function') {
    clearInterval(_patchConnHover);
    const _origDrawConn = drawConn;
    window.drawConn = function(c, sel) {
      const isHov = hoveredConn && hoveredConn.id === c.id;
      _origDrawConn(c, sel || isHov);
    };
    // Track hover
    if ($cvs) {
      $cvs.addEventListener('mousemove', e => {
        if (typeof vx === 'undefined') return;
        const r = $cvs.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const cx = (mx - vx) / vs, cy = (my - vy) / vs;
        const c = cAt(cx, cy);
        if (c !== hoveredConn) {
          hoveredConn = c;
          if (typeof sR === 'function') sR();
        }
      }, { passive: true });
    }
  }
}, 100);

// ═══════════════════════════════════════════════════════════════
// 6. ERWEITERTES CONTEXT MENU (showCM Patch)
// ═══════════════════════════════════════════════════════════════
const $ctxMenu = document.getElementById('ctx-menu');

// Color palette for connections
const CONN_COLORS = [
  { hex: '', label: 'Standard' },
  { hex: '#007AFF', label: 'Blau' },
  { hex: '#30D158', label: 'Grün' },
  { hex: '#FF453A', label: 'Rot' },
  { hex: '#FF9F0A', label: 'Orange' },
  { hex: '#BF5AF2', label: 'Lila' },
  { hex: '#5AC8FA', label: 'Cyan' },
  { hex: '#FFD60A', label: 'Gelb' },
  { hex: '#FF375F', label: 'Pink' },
];

// Node opacity levels
const OPACITY_LEVELS = [25, 50, 75, 100];

function makeCM_item(icon, label, shortcut, cls, onClick) {
  const d = document.createElement('div');
  d.className = 'ctx-item' + (cls ? ' ' + cls : '');
  d.innerHTML = `<span>${icon}</span><span>${label}</span>${shortcut ? `<span class="shortcut">${shortcut}</span>` : ''}`;
  d.addEventListener('click', e => { e.stopPropagation(); closeCMExt(); onClick(); });
  return d;
}

function makeCM_sep() {
  const d = document.createElement('div'); d.className = 'ctx-sep'; return d;
}

function makeCM_label(text) {
  const d = document.createElement('div'); d.className = 'ctx-label'; d.textContent = text; return d;
}

function makeCM_colorRow(colors, onPick) {
  const row = document.createElement('div'); row.className = 'color-row';
  colors.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot';
    dot.style.background = c.hex || 'var(--glass-border)';
    dot.title = c.label;
    if (!c.hex) {
      dot.style.background = 'conic-gradient(#FF453A 0deg 90deg, #30D158 90deg 180deg, #007AFF 180deg 270deg, #FF9F0A 270deg 360deg)';
    }
    dot.addEventListener('click', e => { e.stopPropagation(); closeCMExt(); onPick(c.hex); });
    row.appendChild(dot);
  });
  return row;
}

function closeCMExt() {
  if ($ctxMenu) { $ctxMenu.style.display = 'none'; $ctxMenu.innerHTML = ''; }
}

function positionCM(x, y) {
  if (!$ctxMenu) return;
  $ctxMenu.style.display = 'block';
  $ctxMenu.style.left = '0px'; $ctxMenu.style.top = '0px';
  const w = $ctxMenu.offsetWidth, h = $ctxMenu.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  $ctxMenu.style.left = Math.min(x, vw - w - 8) + 'px';
  $ctxMenu.style.top  = Math.min(y, vh - h - 8) + 'px';
}

// ── 6a. Connection CM ────────────────────────────────────────────
function showConnCM(c, mx, my) {
  if (!$ctxMenu) return;
  $ctxMenu.innerHTML = '';

  $ctxMenu.appendChild(makeCM_label('Verbindung'));

  // Style buttons
  const styleRow = document.createElement('div');
  styleRow.style.cssText = 'display:flex;gap:4px;padding:5px 12px;';
  ['solid','dashed','dotted'].forEach(s => {
    const b = document.createElement('button');
    b.textContent = s === 'solid' ? '─' : s === 'dashed' ? '╌' : '·····';
    b.title = s;
    b.style.cssText = `flex:1;padding:4px;border:1px solid var(--glass-border);border-radius:6px;background:${
      (c.style||'solid')===s?'var(--accent-soft)':'transparent'};color:var(--text);font-size:13px;cursor:pointer;
      font-family:var(--font);transition:all .12s;`;
    b.addEventListener('click', e => {
      e.stopPropagation();
      c.style = s;
      if (typeof pH === 'function') pH();
      if (typeof aS === 'function') aS();
      if (typeof sR === 'function') sR();
      closeCMExt();
    });
    styleRow.appendChild(b);
  });
  $ctxMenu.appendChild(styleRow);

  $ctxMenu.appendChild(makeCM_sep());
  $ctxMenu.appendChild(makeCM_label('Farbe'));
  $ctxMenu.appendChild(makeCM_colorRow(CONN_COLORS, hex => {
    c.color = hex;
    if (typeof pH === 'function') pH();
    if (typeof aS === 'function') aS();
    if (typeof sR === 'function') sR();
  }));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('🏷️', 'Label bearbeiten', '', '', () => {
    if (typeof openCLE === 'function') openCLE(c, mx, my);
  }));

  $ctxMenu.appendChild(makeCM_item('⇄', 'Richtung umkehren', '', '', () => {
    const tmpFrom = c.from, tmpFromSide = c.fromSide;
    c.from = c.to; c.fromSide = c.toSide;
    c.to = tmpFrom; c.toSide = tmpFromSide;
    if (typeof pH === 'function') pH();
    if (typeof aS === 'function') aS();
    if (typeof sR === 'function') sR();
    if (typeof toast === 'function') toast('⇄ Umgekehrt');
  }));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('🗑', 'Löschen', 'Del', 'danger', () => {
    if (typeof delC === 'function') delC(c);
  }));

  positionCM(mx, my);
}

// ── 6b. Multi-Selection CM ───────────────────────────────────────
function showMultiCM(selectedNodes, mx, my) {
  if (!$ctxMenu) return;
  $ctxMenu.innerHTML = '';

  $ctxMenu.appendChild(makeCM_label(selectedNodes.length + ' Nodes ausgewählt'));

  // Align submenu items
  const alignActions = [
    { icon: '⬅', label: 'Links ausrichten', fn: () => alignNodes('left') },
    { icon: '↔', label: 'Horizontal zentrieren', fn: () => alignNodes('centerH') },
    { icon: '➡', label: 'Rechts ausrichten', fn: () => alignNodes('right') },
    { icon: '⬆', label: 'Oben ausrichten', fn: () => alignNodes('top') },
    { icon: '↕', label: 'Vertikal zentrieren', fn: () => alignNodes('centerV') },
    { icon: '⬇', label: 'Unten ausrichten', fn: () => alignNodes('bottom') },
  ];

  alignActions.forEach(a => $ctxMenu.appendChild(makeCM_item(a.icon, a.label, '', '', a.fn)));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('↔', 'Horizontal verteilen', '', '', () => distributeNodes('h')));
  $ctxMenu.appendChild(makeCM_item('↕', 'Vertikal verteilen', '', '', () => distributeNodes('v')));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('D', 'Alle duplizieren', 'D', '', () => {
    if (typeof dupN === 'function') dupN(selectedNodes.map(n => { const {_rh,_sb,_ch,_ms,_ca,isEditing,...r} = n; return r; }));
  }));

  $ctxMenu.appendChild(makeCM_item('🔒', 'Alle sperren/entsperren', 'L', '', () => {
    const allLocked = selectedNodes.every(n => n.locked);
    selectedNodes.forEach(n => n.locked = !allLocked);
    if (typeof pH === 'function') pH();
    if (typeof aS === 'function') aS();
    if (typeof sR === 'function') sR();
    if (typeof toast === 'function') toast(allLocked ? '🔓 Entsperrt' : '🔒 Gesperrt');
  }));

  $ctxMenu.appendChild(makeCM_sep());
  $ctxMenu.appendChild(makeCM_item('🗑', 'Alle löschen', 'Del', 'danger', () => {
    [...selectedNodes].forEach(n => { if (typeof delN === 'function') delN(n); });
  }));

  positionCM(mx, my);
}

// ── 6c. Single Node CM ───────────────────────────────────────────
function showNodeCM(n, mx, my) {
  if (!$ctxMenu) return;
  $ctxMenu.innerHTML = '';

  const typeLabel = { text:'Text', sticky:'Sticky', checklist:'Liste', group:'Gruppe',
    table:'Tabelle', link:'Link', diamond:'Raute', ellipse:'Ellipse', hexagon:'Hexagon', image:'Bild' };
  $ctxMenu.appendChild(makeCM_label(typeLabel[n.type] || n.type));

  // Edit action
  $ctxMenu.appendChild(makeCM_item('✏️', 'Bearbeiten', 'Dbl', '', () => {
    if (n.type === 'checklist' && typeof openCLEd === 'function') openCLEd(n);
    else if (n.type === 'table' && typeof openTblEd === 'function') openTblEd(n);
    else if (n.type === 'link' && typeof editLink === 'function') editLink(n);
    else if (typeof editNT === 'function') editNT(n);
  }));

  $ctxMenu.appendChild(makeCM_item('📋', 'Duplizieren', 'D', '', () => {
    if (typeof dupN === 'function') dupN([n].map(nd => { const {_rh,_sb,_ch,_ms,_ca,isEditing,...r} = nd; return r; }));
  }));

  $ctxMenu.appendChild(makeCM_item(n.locked ? '🔓' : '🔒', n.locked ? 'Entsperren' : 'Sperren', 'L', '', () => {
    n.locked = !n.locked;
    if (typeof pH === 'function') pH();
    if (typeof aS === 'function') aS();
    if (typeof sR === 'function') sR();
    if (typeof toast === 'function') toast(n.locked ? '🔒' : '🔓');
  }));

  $ctxMenu.appendChild(makeCM_sep());

  // Node color
  $ctxMenu.appendChild(makeCM_label('Hintergrundfarbe'));
  const nodePalette = [
    {hex:'#2c2c2e',label:'Dunkel'},{hex:'#1e2a3a',label:'Blau-Dunkel'},
    {hex:'#1e2a1e',label:'Grün-Dunkel'},{hex:'#3a2a1e',label:'Orange-Dunkel'},
    {hex:'#2a1e3a',label:'Lila-Dunkel'},{hex:'#FFD60A',label:'Gelb'},
    {hex:'#30D158',label:'Grün'},{hex:'#007AFF',label:'Blau'},
    {hex:'#FF375F',label:'Pink'},{hex:'#FF9F0A',label:'Orange'},
  ];
  const nodeColorRow = document.createElement('div');
  nodeColorRow.className = 'color-row';
  nodePalette.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot';
    dot.style.background = c.hex;
    dot.title = c.label;
    if (n.bg === c.hex) dot.style.border = '2px solid #007AFF';
    dot.addEventListener('click', e => {
      e.stopPropagation(); closeCMExt();
      n.bg = c.hex;
      // Auto-adjust text color
      const lum = parseInt(c.hex.slice(1,3),16)*0.299 + parseInt(c.hex.slice(3,5),16)*0.587 + parseInt(c.hex.slice(5,7),16)*0.114;
      n.textColor = lum > 128 ? '#1c1c1e' : '#f5f5f7';
      if (typeof pH === 'function') pH();
      if (typeof aS === 'function') aS();
      if (typeof sR === 'function') sR();
    });
    nodeColorRow.appendChild(dot);
  });
  $ctxMenu.appendChild(nodeColorRow);

  // Sticky-specific color switcher
  if (n.type === 'sticky') {
    $ctxMenu.appendChild(makeCM_sep());
    $ctxMenu.appendChild(makeCM_label('Sticky Farbe'));
    const stickyColors = [
      {bg:'#FFD60A',border:'#CCB000',textColor:'#1a1200'},
      {bg:'#30D158',border:'#1d7a5a',textColor:'#001a12'},
      {bg:'#007AFF',border:'#0055cc',textColor:'#fff'},
      {bg:'#FF375F',border:'#cc2040',textColor:'#fff'},
      {bg:'#FF9F0A',border:'#cc7f00',textColor:'#1a0800'},
      {bg:'#BF5AF2',border:'#9040c0',textColor:'#fff'},
    ];
    const stickyRow = document.createElement('div');
    stickyRow.className = 'color-row';
    stickyColors.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'color-dot';
      dot.style.background = c.bg;
      dot.style.borderColor = n.bg === c.bg ? '#fff' : 'transparent';
      dot.addEventListener('click', e => {
        e.stopPropagation(); closeCMExt();
        n.bg = c.bg; n.border = c.border; n.textColor = c.textColor;
        if (typeof pH === 'function') pH();
        if (typeof aS === 'function') aS();
        if (typeof sR === 'function') sR();
      });
      stickyRow.appendChild(dot);
    });
    $ctxMenu.appendChild(stickyRow);
  }

  $ctxMenu.appendChild(makeCM_sep());

  // Opacity slider
  $ctxMenu.appendChild(makeCM_label('Deckkraft'));
  const opRow = document.createElement('div');
  opRow.style.cssText = 'display:flex;gap:4px;padding:5px 12px;';
  OPACITY_LEVELS.forEach(op => {
    const b = document.createElement('button');
    b.textContent = op + '%';
    const curOp = Math.round((n.opacity !== undefined ? n.opacity : 1) * 100);
    b.style.cssText = `flex:1;padding:4px 2px;border:1px solid var(--glass-border);border-radius:6px;background:${
      curOp === op ? 'var(--accent-soft)' : 'transparent'};color:var(--text);font-size:10px;cursor:pointer;
      font-family:var(--font);transition:all .12s;`;
    b.addEventListener('click', e => {
      e.stopPropagation(); closeCMExt();
      n.opacity = op / 100;
      if (typeof pH === 'function') pH();
      if (typeof aS === 'function') aS();
      if (typeof sR === 'function') sR();
    });
    opRow.appendChild(b);
  });
  $ctxMenu.appendChild(opRow);

  $ctxMenu.appendChild(makeCM_sep());

  // Bring to front / Send to back
  $ctxMenu.appendChild(makeCM_item('⬆', 'In den Vordergrund', '', '', () => {
    if (typeof nodes !== 'undefined') {
      const idx = nodes.indexOf(n);
      if (idx > -1) { nodes.splice(idx, 1); nodes.push(n); }
      if (typeof pH === 'function') pH();
      if (typeof aS === 'function') aS();
      if (typeof sR === 'function') sR();
    }
  }));
  $ctxMenu.appendChild(makeCM_item('⬇', 'In den Hintergrund', '', '', () => {
    if (typeof nodes !== 'undefined') {
      const idx = nodes.indexOf(n);
      if (idx > -1) { nodes.splice(idx, 1); nodes.unshift(n); }
      if (typeof pH === 'function') pH();
      if (typeof aS === 'function') aS();
      if (typeof sR === 'function') sR();
    }
  }));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('🗑', 'Löschen', 'Del', 'danger', () => {
    if (typeof delN === 'function') delN(n);
  }));

  positionCM(mx, my);
}

// ── 6d. Canvas CM (Rechtsklick auf leere Fläche) ─────────────────
function showCanvasCM(worldX, worldY, mx, my) {
  if (!$ctxMenu) return;
  $ctxMenu.innerHTML = '';

  $ctxMenu.appendChild(makeCM_label('Canvas'));

  $ctxMenu.appendChild(makeCM_item('+ T', 'Text-Node einfügen', '', '', () => {
    if (typeof addN === 'function') addN('text', worldX - 125, worldY - 60);
  }));
  $ctxMenu.appendChild(makeCM_item('+ S', 'Sticky Note einfügen', '', '', () => {
    if (typeof addN === 'function') addN('sticky', worldX - 90, worldY - 90);
  }));
  $ctxMenu.appendChild(makeCM_item('+ ✓', 'Checkliste einfügen', '', '', () => {
    if (typeof addN === 'function') addN('checklist', worldX - 120, worldY - 90);
  }));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('⊞', 'Template laden', '', '', () => {
    const $tpl = document.getElementById('tpl-picker');
    if ($tpl) $tpl.classList.add('open');
  }));

  $ctxMenu.appendChild(makeCM_item('📷', 'Screenshot (PNG)', '', '', () => {
    if (typeof expPNG === 'function') expPNG();
  }));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('⊟', 'Alles einpassen', '1', '', () => {
    if (typeof fitAll === 'function') fitAll();
  }));

  $ctxMenu.appendChild(makeCM_item('🎨', 'Theme wechseln', '', '', () => {
    const btn = document.getElementById('btn-theme');
    if (btn) btn.click();
  }));

  $ctxMenu.appendChild(makeCM_sep());

  $ctxMenu.appendChild(makeCM_item('↶', 'Rückgängig', '⌘Z', '', () => { if (typeof undo === 'function') undo(); }));
  $ctxMenu.appendChild(makeCM_item('↷', 'Wiederholen', '⌘Y', '', () => { if (typeof redo === 'function') redo(); }));

  positionCM(mx, my);
}

// ── 6e. Patch contextmenu event ──────────────────────────────────
function showCMExt(e) {
  e.preventDefault();
  if (!$ctxMenu) return;

  const $c = document.getElementById('canvas');
  if (!$c) return;
  const r = $c.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;

  if (typeof vx === 'undefined' || typeof vy === 'undefined' || typeof vs === 'undefined') return;
  const worldX = (mx - vx) / vs, worldY = (my - vy) / vs;

  // Determine what was clicked
  let clickedNode = null, clickedConn = null;
  if (typeof nAt === 'function') clickedNode = nAt(worldX, worldY);
  if (!clickedNode && typeof cAt === 'function') clickedConn = cAt(worldX, worldY);

  // Check multi-selection
  const multiSel = typeof selN !== 'undefined' && selN.length > 1;

  if (multiSel && clickedNode && selN.includes(clickedNode)) {
    showMultiCM(selN, e.clientX, e.clientY);
  } else if (clickedConn) {
    // Select the connection
    if (typeof clrS === 'function') clrS();
    if (typeof selC !== 'undefined') window.selC = clickedConn;
    if (typeof sR === 'function') sR();
    showConnCM(clickedConn, e.clientX, e.clientY);
  } else if (clickedNode) {
    if (typeof selOne === 'function') selOne(clickedNode);
    if (typeof sR === 'function') sR();
    showNodeCM(clickedNode, e.clientX, e.clientY);
  } else {
    showCanvasCM(worldX, worldY, e.clientX, e.clientY);
  }
}

// Register on canvas — using capture to override existing handler
if ($cvs) {
  $cvs.addEventListener('contextmenu', showCMExt, true);
}

// Close CM on outside click
document.addEventListener('mousedown', e => {
  if ($ctxMenu && $ctxMenu.style.display === 'block' && !$ctxMenu.contains(e.target)) {
    closeCMExt();
  }
}, { capture: true });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $ctxMenu && $ctxMenu.style.display === 'block') {
    closeCMExt();
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. ALIGN FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function alignNodes(direction) {
  if (typeof selN === 'undefined' || selN.length < 2) return;
  const ns = selN.filter(n => !n.locked);
  if (!ns.length) return;

  switch(direction) {
    case 'left': {
      const minX = Math.min(...ns.map(n => n.x));
      ns.forEach(n => n.x = minX);
      break;
    }
    case 'right': {
      const maxR = Math.max(...ns.map(n => n.x + n.width));
      ns.forEach(n => n.x = maxR - n.width);
      break;
    }
    case 'centerH': {
      const avgCX = ns.reduce((s,n) => s + n.x + n.width/2, 0) / ns.length;
      ns.forEach(n => n.x = avgCX - n.width/2);
      break;
    }
    case 'top': {
      const minY = Math.min(...ns.map(n => n.y));
      ns.forEach(n => n.y = minY);
      break;
    }
    case 'bottom': {
      const maxB = Math.max(...ns.map(n => n.y + n.height));
      ns.forEach(n => n.y = maxB - n.height);
      break;
    }
    case 'centerV': {
      const avgCY = ns.reduce((s,n) => s + n.y + n.height/2, 0) / ns.length;
      ns.forEach(n => n.y = avgCY - n.height/2);
      break;
    }
  }
  if (typeof pH === 'function') pH();
  if (typeof aS === 'function') aS();
  if (typeof sR === 'function') sR();
  if (typeof toast === 'function') toast('✓ Ausgerichtet');
}

function distributeNodes(axis) {
  if (typeof selN === 'undefined' || selN.length < 3) {
    if (typeof toast === 'function') toast('Mind. 3 Nodes nötig');
    return;
  }
  const ns = [...selN].filter(n => !n.locked);
  if (axis === 'h') {
    ns.sort((a,b) => a.x - b.x);
    const totalW = ns.reduce((s,n) => s + n.width, 0);
    const span = ns[ns.length-1].x + ns[ns.length-1].width - ns[0].x;
    const gap = (span - totalW) / (ns.length - 1);
    let curX = ns[0].x;
    ns.forEach(n => { n.x = curX; curX += n.width + gap; });
  } else {
    ns.sort((a,b) => a.y - b.y);
    const totalH = ns.reduce((s,n) => s + n.height, 0);
    const span = ns[ns.length-1].y + ns[ns.length-1].height - ns[0].y;
    const gap = (span - totalH) / (ns.length - 1);
    let curY = ns[0].y;
    ns.forEach(n => { n.y = curY; curY += n.height + gap; });
  }
  if (typeof pH === 'function') pH();
  if (typeof aS === 'function') aS();
  if (typeof sR === 'function') sR();
  if (typeof toast === 'function') toast('✓ Verteilt');
}

// ═══════════════════════════════════════════════════════════════
// 8. NODE OPACITY IN RENDER (patch drawNode)
// ═══════════════════════════════════════════════════════════════
const _patchOpacity = setInterval(() => {
  if (typeof drawNode === 'function') {
    clearInterval(_patchOpacity);
    const _prevDrawNode = drawNode;
    window.drawNode = function(n) {
      const op = (n.opacity !== undefined && n.opacity !== null) ? n.opacity : 1;
      if (typeof ctx !== 'undefined' && op < 1) {
        ctx.globalAlpha = op;
      }
      _prevDrawNode(n);
      if (typeof ctx !== 'undefined') ctx.globalAlpha = 1;
    };
  }
}, 150);

// ═══════════════════════════════════════════════════════════════
// 9. KEYBOARD SHORTCUT — ALIGN
// ═══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (!e.ctrlKey && !e.metaKey) return;
  if (typeof selN === 'undefined' || selN.length < 2) return;
  switch(e.key) {
    case 'ArrowLeft':  e.preventDefault(); alignNodes('left'); break;
    case 'ArrowRight': e.preventDefault(); alignNodes('right'); break;
    case 'ArrowUp':    e.preventDefault(); alignNodes('top'); break;
    case 'ArrowDown':  e.preventDefault(); alignNodes('bottom'); break;
  }
}, true);

// ═══════════════════════════════════════════════════════════════
// 10. FOOTER VERSION-FIX
// ═══════════════════════════════════════════════════════════════
const $footer = document.getElementById('rb-footer');
if ($footer) {
  $footer.innerHTML = $footer.innerHTML.replace(/v0\.\d+/g, 'v4.0');
}

// ═══════════════════════════════════════════════════════════════
// 11. ZOOM DISPLAY PULSE on change
// ═══════════════════════════════════════════════════════════════
const $zoomDisp = document.getElementById('zoom-display');
if ($zoomDisp) {
  let lastZoomVal = $zoomDisp.textContent;
  const zoomObs = new MutationObserver(() => {
    if ($zoomDisp.textContent !== lastZoomVal) {
      lastZoomVal = $zoomDisp.textContent;
      $zoomDisp.classList.remove('zoom-pulse');
      void $zoomDisp.offsetWidth;
      $zoomDisp.classList.add('zoom-pulse');
      setTimeout(() => $zoomDisp.classList.remove('zoom-pulse'), 300);
    }
  });
  zoomObs.observe($zoomDisp, { childList: true, characterData: true, subtree: true });
}

console.log('%c✅ SynchroBoard Facelift Patch 3 geladen', 'color:#30D158;font-weight:bold;font-size:13px;');

}); // end waitReady

})(); // end IIFE
