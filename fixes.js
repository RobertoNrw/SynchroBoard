'use strict';
// ============================================================
// SynchroBoard – fixes.js  (Patch-Modul v1.0)
// Eingebunden NACH app.js / index-Script.
// Überschreibt / erweitert fehlerhafte Funktionen sicher,
// ohne die Hauptdatei zu modifizieren.
// ============================================================

// ── Warte bis initCanvas fertig ist ──────────────────────────
window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    applyFixes();
  });
});

function applyFixes() {

  // ════════════════════════════════════════════════════════════
  // FIX 1: Auto-Save – State-Hash auf echten Inhalt erweitern
  // Problem: _lastSaved verglich nur nodes.length + conns.length,
  //          Textänderungen an Nodes triggerten keinen neuen Save.
  // Lösung:  Hash über id+text+x+y aller Nodes → echter Content-Check
  // ════════════════════════════════════════════════════════════
  (function patchAutoSave() {
    // Zugriff auf globale Variablen die in index / app.js definiert sind
    const origAS = window.aS;
    if (typeof origAS !== 'function') return;

    let _fixLastSaved = '';

    window.aS = function aS_fixed() {
      // Content-Hash: id + text + x + y aller Nodes + Conn-Anzahl
      const hash = JSON.stringify(
        (window.nodes || []).map(n => ({
          id: n.id,
          t: (n.text || '').slice(0, 80), // Substring reicht für Change-Detection
          x: Math.round(n.x),
          y: Math.round(n.y),
          w: n.width,
          h: n.height,
          td: n.typeData ? JSON.stringify(n.typeData).slice(0, 100) : ''
        }))
      ) + '|' + (window.conns || []).length;

      if (hash === _fixLastSaved) return; // Kein echter Change → Skip
      _fixLastSaved = hash;

      // Original-Funktion aufrufen
      origAS.call(this);
    };

    console.log('[fixes.js] ✅ FIX 1: Auto-Save Content-Hash aktiv');
  })();


  // ════════════════════════════════════════════════════════════
  // FIX 2: SVG-Export – Text nicht mehr auf slice(0,40) kürzen
  // Problem: Mehrzeiliger Markdown-Content wurde hart abgeschnitten.
  // Lösung:  Alle Zeilen exportieren (max 20 statt 8, max 60 Zeichen/Zeile)
  // ════════════════════════════════════════════════════════════
  (function patchSVGExport() {
    const origSVG = window.expSVG;
    if (typeof origSVG !== 'function') return;

    window.expSVG = function expSVG_fixed() {
      const nodes = window.nodes || [];
      const conns = window.conns || [];
      const isDark = window.isDark !== undefined ? window.isDark : true;

      if (!nodes.length) { if (window.toast) window.toast('Leer'); return; }

      let mX = Infinity, mY = Infinity, MX = -Infinity, MY = -Infinity;
      nodes.forEach(n => {
        mX = Math.min(mX, n.x); mY = Math.min(mY, n.y);
        MX = Math.max(MX, n.x + n.width); MY = Math.max(MY, n.y + n.height);
      });

      const pad = 40, w = MX - mX + pad * 2, h = MY - mY + pad * 2;
      const bg = isDark ? '#1c1c1e' : '#f2f2f7';
      const esc = s => String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/\n/g, '&#10;');

      const parts = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Inter,system-ui,sans-serif">`,
        `<rect width="100%" height="100%" fill="${bg}"/>`,
        `<g transform="translate(${pad - mX},${pad - mY})">`
      ];

      // Connections
      conns.forEach(c => {
        const fn = nodes.find(n => n.id === c.from), tn = nodes.find(n => n.id === c.to);
        if (!fn || !tn) return;
        const cPtsFn = _svgCPts(fn), cPtsTn = _svgCPts(tn);
        const fp = cPtsFn.find(p => p.side === c.fromSide) || cPtsFn[1];
        const tp = cPtsTn.find(p => p.side === c.toSide) || cPtsTn[3];
        const dist = Math.max(60, Math.hypot(tp.x - fp.x, tp.y - fp.y) * 0.45);
        const fc = _svgSOff(fp, c.fromSide, dist), tc = _svgSOff(tp, c.toSide, dist);
        const col = c.color || (isDark ? '#4a7fa0' : '#8ab4d4');
        const dash = c.style === 'dashed' ? '8,4' : (c.style === 'dotted' ? '3,3' : '');
        parts.push(`<path d="M${fp.x},${fp.y} C${fc.x},${fc.y} ${tc.x},${tc.y} ${tp.x},${tp.y}" fill="none" stroke="${col}" stroke-width="1.8"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
        const ang = Math.atan2(tp.y - tc.y, tp.x - tc.x), al = 12, aa = Math.PI / 6;
        const ax1 = tp.x - al * Math.cos(ang - aa), ay1 = tp.y - al * Math.sin(ang - aa);
        const ax2 = tp.x - al * Math.cos(ang + aa), ay2 = tp.y - al * Math.sin(ang + aa);
        parts.push(`<polygon points="${tp.x},${tp.y} ${ax1},${ay1} ${ax2},${ay2}" fill="${col}"/>`);
        if (c.label) {
          const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
          parts.push(`<rect x="${mx - c.label.length * 3.5 - 6}" y="${my - 8}" width="${c.label.length * 7 + 12}" height="18" rx="6" fill="${isDark ? '#1c1c1e' : '#fff'}" stroke="${col}"/>`);
          parts.push(`<text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="11" fill="${isDark ? '#f5f5f7' : '#1c1c1e'}">${esc(c.label)}</text>`);
        }
      });

      // Nodes – FIX: max 20 Zeilen, max 60 Zeichen pro Zeile (statt 8/40)
      nodes.forEach(n => {
        const tc = esc(n.textColor || '#fff'), bc = esc(n.border || '#48484a'), nbg = esc(n.bg || '#2c2c2e');
        if (n.type === 'link') {
          const r = Math.min(n.width, n.height) / 2, cx = n.x + n.width / 2, cy = n.y + n.height / 2;
          parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${nbg}" stroke="${bc}" stroke-width="1.5"/>`);
          parts.push(`<text x="${cx}" y="${cy + r * 0.55}" text-anchor="middle" font-size="11" fill="${tc}">${esc((n.text || '').slice(0, 20))}</text>`);
        } else if (n.type === 'ellipse') {
          parts.push(`<ellipse cx="${n.x + n.width / 2}" cy="${n.y + n.height / 2}" rx="${n.width / 2}" ry="${n.height / 2}" fill="${nbg}" stroke="${bc}" stroke-width="1.5"/>`);
          const lines = (n.text || '').split('\n').slice(0, 20);
          lines.forEach((l, i) => {
            parts.push(`<text x="${n.x + n.width / 2}" y="${n.y + n.height / 2 + 4 + i * 16}" text-anchor="middle" font-size="13" fill="${tc}">${esc(l.slice(0, 60))}</text>`);
          });
        } else if (n.type === 'diamond') {
          const cx = n.x + n.width / 2, cy = n.y + n.height / 2;
          parts.push(`<polygon points="${cx},${n.y} ${n.x + n.width},${cy} ${cx},${n.y + n.height} ${n.x},${cy}" fill="${nbg}" stroke="${bc}" stroke-width="1.5"/>`);
          const lines = (n.text || '').split('\n').slice(0, 6);
          lines.forEach((l, i) => {
            parts.push(`<text x="${cx}" y="${cy + 4 + (i - (lines.length - 1) / 2) * 16}" text-anchor="middle" font-size="13" fill="${tc}">${esc(l.slice(0, 60))}</text>`);
          });
        } else if (n.type === 'hexagon') {
          const cx = n.x + n.width / 2, cy = n.y + n.height / 2, rx = n.width / 2, ry = n.height / 2;
          let pts = '';
          for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; pts += `${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)} `; }
          parts.push(`<polygon points="${pts.trim()}" fill="${nbg}" stroke="${bc}" stroke-width="1.5"/>`);
          const lines = (n.text || '').split('\n').slice(0, 6);
          lines.forEach((l, i) => {
            parts.push(`<text x="${cx}" y="${cy + 4 + (i - (lines.length - 1) / 2) * 16}" text-anchor="middle" font-size="13" fill="${tc}">${esc(l.slice(0, 60))}</text>`);
          });
        } else if (n.type === 'group') {
          parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="16" fill="${nbg}" stroke="${bc}" stroke-width="1.5" stroke-dasharray="8,5"/>`);
          parts.push(`<text x="${n.x + 12}" y="${n.y + 22}" font-size="12" font-weight="600" fill="${tc}">${esc(n.text || 'Bereich')}</text>`);
        } else {
          const r = n.type === 'sticky' ? 6 : 12;
          parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${r}" fill="${nbg}" stroke="${bc}" stroke-width="1"/>`);
          // FIX: Alle Zeilen exportieren, max 20, max 60 Zeichen
          const lines = (n.text || '').split('\n').slice(0, 20);
          lines.forEach((l, i) => {
            parts.push(`<text x="${n.x + 12}" y="${n.y + 22 + i * 17}" font-size="12" fill="${tc}">${esc(l.slice(0, 60))}</text>`);
          });
        }
      });

      parts.push('</g></svg>');
      const blob = new Blob([parts.join('\n')], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = 'canvas-' + Date.now() + '.svg';
      a.href = url; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if (window.toast) window.toast('SVG ↓ (vollständig)');
    };

    // Hilfsfunktionen für SVG-Export
    function _svgCPts(n) {
      const cx = n.x + n.width / 2, cy = n.y + n.height / 2;
      return [
        { x: cx, y: n.y, side: 'top' },
        { x: n.x + n.width, y: cy, side: 'right' },
        { x: cx, y: n.y + n.height, side: 'bottom' },
        { x: n.x, y: cy, side: 'left' }
      ];
    }
    function _svgSOff(pt, s, d) {
      switch (s) {
        case 'right': return { x: pt.x + d, y: pt.y };
        case 'left': return { x: pt.x - d, y: pt.y };
        case 'bottom': return { x: pt.x, y: pt.y + d };
        case 'top': return { x: pt.x, y: pt.y - d };
        default: return { x: pt.x + d, y: pt.y };
      }
    }

    console.log('[fixes.js] ✅ FIX 2: SVG-Export vollständiger Text aktiv');
  })();


  // ════════════════════════════════════════════════════════════
  // FIX 3: Hexagon Hit-Test – echte Polygon-Trefferprüfung
  // Problem: nAt() prüfte für Hexagons nur Bounding-Box,
  //          Ecken außerhalb der Form waren klickbar.
  // Lösung:  Point-in-Polygon für Hexagon via Ray-Casting
  // ════════════════════════════════════════════════════════════
  (function patchHexagonHit() {
    const origNAt = window.nAt;
    if (typeof origNAt !== 'function') return;

    function pointInHexagon(cx, cy, n) {
      const hcx = n.x + n.width / 2, hcy = n.y + n.height / 2;
      const rx = n.width / 2, ry = n.height / 2;
      // Ray-Casting Algorithmus für konvexes Polygon
      const verts = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 2;
        verts.push({ x: hcx + rx * Math.cos(a), y: hcy + ry * Math.sin(a) });
      }
      let inside = false;
      for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y;
        const xj = verts[j].x, yj = verts[j].y;
        if (((yi > cy) !== (yj > cy)) && (cx < (xj - xi) * (cy - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    }

    window.nAt = function nAt_fixed(cx, cy) {
      // Hexagon-Nodes zuerst mit echtem Hit-Test prüfen
      const nodes = window.nodes || [];
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.type === 'hexagon') {
          // Bounding-Box Vorprüfung für Performance
          if (cx >= n.x && cx <= n.x + n.width && cy >= n.y && cy <= n.y + n.height) {
            if (pointInHexagon(cx, cy, n)) return n;
          }
        }
      }
      // Für alle anderen Typen: Original-Funktion
      // Hexagons aus Original-Ergebnis filtern (würden false-positiv zurückgeben)
      const result = origNAt.call(this, cx, cy);
      if (result && result.type === 'hexagon') {
        // Original hat Hexagon gefunden → nochmal mit echtem Test prüfen
        return pointInHexagon(cx, cy, result) ? result : null;
      }
      return result;
    };

    console.log('[fixes.js] ✅ FIX 3: Hexagon Hit-Test (Ray-Casting) aktiv');
  })();


  // ════════════════════════════════════════════════════════════
  // FIX 4: Image-Node – Bild austauschen per Doppelklick
  // Problem: Doppelklick auf Image-Node öffnete nur Lightbox,
  //          kein Weg das Bild zu ersetzen ohne Löschung.
  // Lösung:  Erweiterung von openImageAction mit "Bild ersetzen"-Button
  // ════════════════════════════════════════════════════════════
  (function patchImageEdit() {
    const origOpenImageAction = window.openImageAction;
    if (typeof origOpenImageAction !== 'function') return;

    window.openImageAction = function openImageAction_fixed(n) {
      // Wenn Shift gedrückt oder kein src: Direkt zum Upload
      if (!n.typeData || !n.typeData.src) {
        _openImageReplaceDialog(n);
        return;
      }
      // Normaler Doppelklick: Lightbox zeigen + Edit-Button einblenden
      const lb = document.getElementById('lightbox');
      const lbImg = document.getElementById('lightbox-img');
      if (lb && lbImg) {
        lbImg.src = n.typeData.src;
        lb.classList.add('open');

        // Edit-Button in Lightbox einfügen (einmalig)
        if (!document.getElementById('lb-edit-btn')) {
          const editBtn = document.createElement('button');
          editBtn.id = 'lb-edit-btn';
          editBtn.textContent = '🖼️ Bild ersetzen';
          editBtn.style.cssText = `
            position:absolute; bottom:20px; left:50%; transform:translateX(-50%);
            padding:8px 18px; border-radius:8px; border:none;
            background:rgba(0,122,255,0.9); color:#fff;
            font-size:12px; font-weight:600; cursor:pointer;
            font-family:var(--font); z-index:100001;
            transition:all 0.2s;
          `;
          editBtn.onmouseenter = () => editBtn.style.background = 'rgba(0,122,255,1)';
          editBtn.onmouseleave = () => editBtn.style.background = 'rgba(0,122,255,0.9)';
          editBtn.onclick = (e) => {
            e.stopPropagation();
            lb.classList.remove('open');
            _openImageReplaceDialog(n);
          };
          lb.appendChild(editBtn);
        }
        // Edit-Button immer auf aktuellen Node binden
        const btn = document.getElementById('lb-edit-btn');
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation();
            lb.classList.remove('open');
            _openImageReplaceDialog(n);
          };
        }
      }
    };

    function _openImageReplaceDialog(n) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (!n.typeData) n.typeData = {};
          n.typeData.src = ev.target.result;
          // imgCache leeren für diesen Node
          if (window.imgCache) delete window.imgCache[n.id];
          if (window.pH) window.pH();
          if (window.aS) window.aS();
          if (window.sR) window.sR();
          if (window.toast) window.toast('🖼️ Bild ersetzt');
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    console.log('[fixes.js] ✅ FIX 4: Image-Node Bild-Ersetzen aktiv');
  })();


  // ════════════════════════════════════════════════════════════
  // FIX 5: LiveRoom – Sichere Guards für undefined-Referenzen
  // Problem: LiveRoom wird überall mit typeof-Check referenziert,
  //          aber bei Fehler im LiveRoom-Modul crasht nichts,
  //          ABER: cursor-Broadcast auf pointermove ist immer aktiv
  //          und verschwendet Ressourcen wenn kein Room aktiv.
  // Lösung:  Zentrales LiveRoom-Stub-Objekt falls Modul fehlt
  // ════════════════════════════════════════════════════════════
  (function patchLiveRoomGuard() {
    if (typeof window.LiveRoom === 'undefined') {
      window.LiveRoom = {
        peer: null,
        peers: [],
        conn: null,
        isHost: false,
        syncEnabled: false,
        remoteCursors: {},
        send: function() {},
        sendCursor: function() {},
        getBoardState: function() { return {}; },
        _stub: true
      };
      console.log('[fixes.js] ✅ FIX 5: LiveRoom Stub installiert (Modul nicht geladen)');
    } else {
      console.log('[fixes.js] ✅ FIX 5: LiveRoom-Modul vorhanden – kein Stub nötig');
    }
  })();


  // ════════════════════════════════════════════════════════════
  // FIX 6: Help-Modal – Keyboard-Shortcut ? und H
  // Problem: In app.js fehlte in der Index-Version der Help-Button Handler
  //          und die Escape-Logik für das Help-Modal.
  // Lösung:  Sicherstellen dass Help-Modal korrekt funktioniert
  // ════════════════════════════════════════════════════════════
  (function patchHelpModal() {
    const helpModal = document.getElementById('help-modal');
    if (!helpModal) {
      console.log('[fixes.js] ℹ️ FIX 6: Kein help-modal gefunden – übersprungen');
      return;
    }

    // Öffnen / Schließen Funktionen sicherstellen
    if (typeof window.openHelp !== 'function') {
      window.openHelp = function() { helpModal.classList.add('open'); };
    }
    if (typeof window.closeHelp !== 'function') {
      window.closeHelp = function() { helpModal.classList.remove('open'); };
    }

    // Klick auf Backdrop schließt Modal
    helpModal.addEventListener('mousedown', e => {
      if (e.target === helpModal) window.closeHelp();
    });

    // Help-Button in Toolbar
    const btnHelp = document.getElementById('btn-help');
    if (btnHelp && !btnHelp._fixBound) {
      btnHelp.addEventListener('click', () => window.openHelp());
      btnHelp._fixBound = true;
    }

    // Help-Close Button
    const helpClose = document.getElementById('help-close');
    if (helpClose && !helpClose._fixBound) {
      helpClose.addEventListener('click', () => window.closeHelp());
      helpClose._fixBound = true;
    }

    console.log('[fixes.js] ✅ FIX 6: Help-Modal Guards aktiv');
  })();


  // ════════════════════════════════════════════════════════════
  // FIX 7: Sticky-Note Overflow-Indikator
  // Problem: Sticky-Notes schneiden Text ohne Feedback ab.
  // Lösung:  Overflow-Gradient + visueller Indikator am unteren Rand
  // ════════════════════════════════════════════════════════════
  (function patchStickyOverflow() {
    const origDrawSticky = window.drawSticky;
    if (typeof origDrawSticky !== 'function') return;

    window.drawSticky = function drawSticky_fixed(n) {
      // Original zeichnen
      origDrawSticky.call(this, n);

      // Overflow-Check: Berechne ob Text abgeschnitten wird
      const ctx = window.ctx;
      if (!ctx) return;
      const de = 20, p = 10, lh = 20;
      ctx.font = `15px ${window.FB || 'Inter'}`;
      const words = (n.text || '').split(' ');
      const mW = n.width - de - p * 2;
      let lineCount = 0;
      let line = '';
      words.forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > mW && line) { lineCount++; line = w; }
        else line = t;
      });
      if (line) lineCount++;

      const totalH = lineCount * lh + p * 2;
      const hasOverflow = totalH > n.height - 4;

      if (hasOverflow) {
        // Fade-Out Gradient am unteren Rand
        const grad = ctx.createLinearGradient(n.x, n.y + n.height - 28, n.x, n.y + n.height - 4);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, n.bg || '#FFD60A');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.fillRect(n.x + 2, n.y + n.height - 28, n.width - de - 4, 24);

        // "↓ mehr" Indikator
        ctx.font = `10px ${window.FB || 'Inter'}`;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('↓ mehr', n.x + n.width - de - p, n.y + n.height - 5);
        ctx.restore();
      }
    };

    console.log('[fixes.js] ✅ FIX 7: Sticky Overflow-Indikator aktiv');
  })();


  // ════════════════════════════════════════════════════════════
  // BONUS: Version-Badge im Footer aktualisieren
  // ════════════════════════════════════════════════════════════
  (function updateFooter() {
    const footer = document.getElementById('rb-footer');
    if (!footer) return;
    const badge = footer.querySelector('span');
    if (badge) {
      badge.innerHTML += ' · <span style="color:#FF9F0A;">✓ fixes.js v1.0 aktiv</span>';
    }
  })();

  console.log('[fixes.js] 🎉 Alle Fixes erfolgreich angewendet');
}
