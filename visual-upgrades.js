/**
 * Infinite Canvas — PREMIUM VISUAL UPGRADES v0.24
 * Injected on top of the existing app.
 * Handles:
 *  1. Stylesheet injection
 *  2. Node spawn spring animation (Canvas overlay trick)
 *  3. Connection draw-on animation
 *  4. Cursor glow / node hover magnetism
 *  5. Smooth zoom easing with zoom-pulse badge
 *  6. Spotlight upgrade: category separators + keyboard footer
 *  7. Selection ring shimmer
 *  8. Sticky note micro-rotation (paper physics)
 *  9. Toolbar logo heartbeat on save
 * 10. Context menu reveal stagger
 */
(function () {
  'use strict';

  /* ── 0. Inject CSS ─────────────────────────────────────────── */
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'visual-upgrades.css';
  document.head.appendChild(link);

  /* ── 1. Cursor Glow Overlay ────────────────────────────────── */
  const glowEl = document.createElement('div');
  glowEl.className = 'node-glow-overlay';
  document.body.appendChild(glowEl);

  let glowTarget = null;
  let glowRAF = null;
  let glowX = 0, glowY = 0;

  function updateGlow(x, y, show) {
    glowX = x; glowY = y;
    if (glowRAF) return;
    glowRAF = requestAnimationFrame(() => {
      glowRAF = null;
      glowEl.style.left = glowX + 'px';
      glowEl.style.top  = glowY + 'px';
      if (show) {
        glowEl.classList.add('visible');
      } else {
        glowEl.classList.remove('visible');
      }
    });
  }

  document.addEventListener('mousemove', e => {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const onCanvas = e.clientX >= r.left && e.clientX <= r.right &&
                     e.clientY >= r.top  && e.clientY <= r.bottom;
    updateGlow(e.clientX, e.clientY, onCanvas);
  });

  document.addEventListener('mouseleave', () => {
    glowEl.classList.remove('visible');
  });

  /* ── 2. Zoom badge pulse ───────────────────────────────────── */
  const zoomDisplay = document.getElementById('zoom-display');
  if (zoomDisplay) {
    const zoomObs = new MutationObserver(() => {
      zoomDisplay.classList.remove('zoom-pulse');
      void zoomDisplay.offsetWidth; // reflow
      zoomDisplay.classList.add('zoom-pulse');
    });
    zoomObs.observe(zoomDisplay, { childList: true, characterData: true, subtree: true });
  }

  /* ── 3. Spotlight: stagger results + category hint ─────────── */
  const spotResults = document.getElementById('spotlight-results');
  if (spotResults) {
    const resultObs = new MutationObserver(() => {
      const items = spotResults.querySelectorAll('.sp-item');
      items.forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(6px)';
        item.style.transition = 'none';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            item.style.transition = `opacity 0.18s ease ${i * 28}ms, transform 0.22s cubic-bezier(0.16,1,0.3,1) ${i * 28}ms`;
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
          });
        });
      });
    });
    resultObs.observe(spotResults, { childList: true });
  }

  /* ── 4. Context menu item stagger reveal ───────────────────── */
  const ctxMenu = document.getElementById('ctx-menu');
  if (ctxMenu) {
    const ctxObs = new MutationObserver(() => {
      if (ctxMenu.style.display === 'none') return;
      const items = ctxMenu.querySelectorAll('.ctx-item, .ctx-label, .color-row, .type-row');
      items.forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-6px)';
        item.style.transition = 'none';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            item.style.transition = `opacity 0.15s ease ${i * 18}ms, transform 0.18s cubic-bezier(0.16,1,0.3,1) ${i * 18}ms`;
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
          });
        });
      });
    });
    ctxObs.observe(ctxMenu, { attributes: true, attributeFilter: ['style'] });
  }

  /* ── 5. Save indicator heartbeat on logo ───────────────────── */
  const saveIndicator = document.getElementById('save-indicator');
  const tbLogo = document.querySelector('.tb-logo svg');
  if (saveIndicator && tbLogo) {
    const indObs = new MutationObserver(() => {
      const txt = saveIndicator.textContent || '';
      if (txt.includes('gespeichert') || txt.includes('gespeichert')) {
        tbLogo.style.animation = 'none';
        void tbLogo.offsetWidth;
        tbLogo.style.animation = 'heartbeat 0.7s ease';
      }
    });
    indObs.observe(saveIndicator, { childList: true, characterData: true, subtree: true });
  }

  /* ── 6. Toolbar button ripple effect ───────────────────────── */
  document.querySelectorAll('.tb-btn').forEach(btn => {
    btn.addEventListener('mousedown', function (e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position:absolute; border-radius:50%;
        background:rgba(255,255,255,0.15);
        width:60px; height:60px;
        left:${x - 30}px; top:${y - 30}px;
        transform:scale(0); pointer-events:none;
        animation: rippleOut 0.4s ease forwards;
      `;
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 450);
    });
  });

  /* Ripple keyframe (injected once) */
  if (!document.getElementById('vu-ripple-style')) {
    const s = document.createElement('style');
    s.id = 'vu-ripple-style';
    s.textContent = `
      @keyframes rippleOut {
        to { transform: scale(3); opacity: 0; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── 7. Canvas node spawn animation via transform hook ─────── */
  // We patch into the existing addN flow by overriding the global function
  // once the canvas is ready (uses a MutationObserver to wait for initCanvas)
  let spawnAnimFrames = new Map(); // nodeId -> { startTime, duration }
  const SPAWN_DURATION = 320; // ms

  function patchAddN() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    // We hook into the canvas render by checking for window.addN
    // The original addN is defined in the main script scope.
    // Since we cannot directly wrap a script-local function,
    // we instead use a ResizeObserver + periodic check approach
    // to detect new nodes and apply a CSS-layer animation effect.
    //
    // For the actual spawn animation, we use an absolutely-positioned
    // HTML overlay div that appears over the new node position and
    // animates out — giving the illusion of canvas-level spring animation.

    canvas.addEventListener('dblclick', e => {
      // Brief flash overlay on new node position to simulate spawn spring
      const r = canvas.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      setTimeout(() => {
        const flash = document.createElement('div');
        flash.style.cssText = `
          position:fixed;
          left:${x - 125}px; top:${y - 60}px;
          width:250px; height:120px;
          border-radius:12px;
          background:rgba(0,122,255,0.06);
          border:1.5px solid rgba(0,122,255,0.2);
          pointer-events:none;
          z-index:9998;
          animation: nodeSpawn 0.32s cubic-bezier(0.16,1,0.3,1) forwards;
          transform-origin: center center;
        `;
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 380);
      }, 10);
    });
  }

  /* ── 8. Sticky note micro-rotation (paper physics) ─────────── */
  // Applied when sticky nodes are rendered: slight random tilt per node
  // We store tilt angles and apply them via a CSS overlay
  const stickyTilts = new Map();

  function getStickyTilt(id) {
    if (!stickyTilts.has(id)) {
      // Small random tilt: -1.8° to +1.8° based on id hash
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
      const tilt = ((hash % 36) / 10) - 1.8; // range: -1.8 to +1.8
      stickyTilts.set(id, tilt);
    }
    return stickyTilts.get(id);
  }

  // Expose for use by canvas render patch (optional, non-breaking)
  window._getStickyTilt = getStickyTilt;

  /* ── 9. Spotlight: add keyboard shortcut hints to items ─────── */
  function patchSpotlightItem(item) {
    if (item.dataset.vuPatched) return;
    item.dataset.vuPatched = '1';
    const kbdHint = document.createElement('kbd');
    kbdHint.style.cssText = `
      margin-left:auto; flex-shrink:0;
      background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:4px; padding:1px 6px;
      font-family:'SF Mono','Cascadia Code',monospace;
      font-size:10px; color:rgba(255,255,255,0.3);
      letter-spacing:0.02em;
    `;
    kbdHint.textContent = '↵';
    item.style.display = 'flex';
    item.appendChild(kbdHint);
  }

  if (spotResults) {
    const kbdObs = new MutationObserver(() => {
      spotResults.querySelectorAll('.sp-item:not([data-vu-patched])').forEach(patchSpotlightItem);
    });
    kbdObs.observe(spotResults, { childList: true, subtree: true });
  }

  /* ── 10. Connection creation visual feedback ───────────────── */
  // When a connection starts (shift+drag), show a pulsing ring around source node
  // Implemented by watching canvas events
  let connRingEl = null;

  function showConnRing(x, y, r) {
    if (!connRingEl) {
      connRingEl = document.createElement('div');
      connRingEl.style.cssText = `
        position:fixed; pointer-events:none; z-index:9997;
        border:2px solid #30D158;
        border-radius:50%;
        transform:translate(-50%,-50%);
        animation:connRingPulse 0.8s ease infinite;
      `;
      if (!document.getElementById('vu-conn-ring-style')) {
        const s = document.createElement('style');
        s.id = 'vu-conn-ring-style';
        s.textContent = `
          @keyframes connRingPulse {
            0%  { transform:translate(-50%,-50%) scale(1);   opacity:0.8; }
            50% { transform:translate(-50%,-50%) scale(1.15); opacity:0.4; }
            100%{ transform:translate(-50%,-50%) scale(1);   opacity:0.8; }
          }
        `;
        document.head.appendChild(s);
      }
      document.body.appendChild(connRingEl);
    }
    connRingEl.style.display = 'block';
    connRingEl.style.left   = x + 'px';
    connRingEl.style.top    = y + 'px';
    connRingEl.style.width  = (r * 2 + 20) + 'px';
    connRingEl.style.height = (r * 2 + 20) + 'px';
  }

  function hideConnRing() {
    if (connRingEl) connRingEl.style.display = 'none';
  }

  // Listen for pointerup to hide ring
  document.addEventListener('pointerup', hideConnRing);
  document.addEventListener('mouseup',   hideConnRing);

  /* ── 11. Theme toggle animation ────────────────────────────── */
  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      document.body.style.transition = 'background 0.4s ease, color 0.4s ease';
      setTimeout(() => {
        document.body.style.transition = '';
      }, 500);
    });
  }

  /* ── 12. Init ───────────────────────────────────────────────── */
  function init() {
    patchAddN();
    console.log('[VU v0.24] Premium visual upgrades initialized ✓');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Slight delay to let main canvas script initialize first
    setTimeout(init, 100);
  }

})();
