# SynchroBoard — Patch-Dateien Integration

Alle Patch-Dateien sind fertig. Du musst sie nur in deiner `index.html` kurz vor `</body>` einbinden.

## Reihenfolge (wichtig!)

```html
<!-- Am Ende von index.html, kurz vor </body> -->
<script src="fixes.js"></script>
<script src="visual-upgrades.js"></script>
<script src="facelift-patch.js"></script>
</body>
```

## Was jede Datei macht

### `fixes.js`
- Storage-Manager Fallback (Private Mode / localStorage voll)
- Image-Cache Memory-Leak Fix
- Korrigierte DOM-Variablen (`$statusbar`, `$tmList`)
- Wheel-Throttle Optimierung (60fps)
- Optimiertes drawGrid mit Performance-Guards

### `visual-upgrades.js`
- Verbesserte Node-Render-Qualität
- Animationen & Transitions
- Lightbox für Bilder
- Spring-Animationen für Modals

### `facelift-patch.js`
- Connection Context Menu (Farbe, Stil, Umkehren, Löschen)
- Multi-Selection Context Menu (Align, Distribute, Group)
- Canvas Context Menu (Template, Screenshot)
- Node Hover-Glow
- Connection Hover-Highlight
- Board-Name editierbar (Doppelklick auf Logo)
- Statusbar XY-Koordinaten
- Save-Indicator Puls-Animation
- Drag-Lift Effekt
- Node Opacity Slider im Context Menu
- Sticky Color Switcher im Context Menu
- Distribute evenly (H + V)
- Align Shortcuts (Strg + Pfeiltasten bei Multi-Selektion)

## Hinweise

- `visual-upgrades.css` ist bereits via `<link>` im `<head>` eingebunden (schon vorhanden in index.html)
- Die JS-Patches warten intern auf `initCanvas()` bzw. `nodes`/`conns` — keine Race Conditions
- Reihenfolge einhalten: `fixes.js` → `visual-upgrades.js` → `facelift-patch.js`
