# SynchroBoard – fixes.js Patch-Modul

## Einbindung in index

Füge diese Zeile **direkt vor `</body>`** am Ende der `index`-Datei ein:

```html
<script src="fixes.js"></script>
```

Das Skript muss **nach** dem Haupt-`<script>`-Block geladen werden, damit es die globalen Funktionen korrekt überschreiben kann.

---

## Was wurde gefixt? (v1.0 – 27.06.2026)

### 🔴 Kritisch

| # | Datei | Problem | Fix |
|---|-------|---------|-----|
| 1 | `fixes.js` | **Auto-Save** ignorierte Textänderungen (nur Länge verglichen) | Content-Hash über `id + text + x + y` aller Nodes |

### 🟡 Mittel

| # | Datei | Problem | Fix |
|---|-------|---------|-----|
| 2 | `fixes.js` | **SVG-Export** schnitt Text auf 40 Zeichen / 8 Zeilen ab | Max 60 Zeichen / 20 Zeilen |
| 4 | `fixes.js` | **Image-Node** hatte keinen Weg das Bild zu ersetzen | Neuer "🖼️ Bild ersetzen"-Button in Lightbox |
| 5 | `fixes.js` | **LiveRoom** nicht definiert → TypeError wenn nicht geladen | Sicheres Stub-Objekt als Fallback |

### 🟢 Niedrig / Verbesserungen

| # | Datei | Problem | Fix |
|---|-------|---------|-----|
| 3 | `fixes.js` | **Hexagon Hit-Test** nutzte nur Bounding-Box | Ray-Casting Algorithmus für exaktes Polygon-Treffen |
| 6 | `fixes.js` | **Help-Modal** Buttons ggf. nicht gebunden | Guards + Backdrop-Click zum Schließen |
| 7 | `fixes.js` | **Sticky Overflow** kein visuelles Feedback | Fade-Gradient + "↓ mehr" Indikator |

---

## Wie funktioniert das Patch-System?

`fixes.js` lädt nach dem `window.load`-Event und überschreibt gezielt einzelne Funktionen via `window.functionName`. Jedes Patch-Modul:

1. Prüft ob die Original-Funktion existiert (`typeof window.fn === 'function'`)
2. Speichert die Original-Referenz
3. Ersetzt sie durch eine verbesserte Version
4. Ruft ggf. das Original intern auf
5. Loggt den Status in der Konsole

Dieses Muster ist **nicht-destruktiv**: Wenn eine Funktion nicht gefunden wird, wird der Patch einfach übersprungen.

---

## Bekannte noch offene Issues

- **`applyAutoLayout()`** in `app.js` ist abgeschnitten – Auto-Layout im AI-Organizer funktioniert möglicherweise nicht vollständig. Bitte die vollständige `app.js` bereitstellen.
- **Link-Favicon CORS** kann in manchen CSP-Umgebungen scheitern (externe `google.com/s2/favicons` Anfrage)
- **Code-Splitting** empfohlen: Aktuell ist `index` > 3.000 Zeilen inline – Module wie `ai-organizer.js`, `storage.js`, `canvas-engine.js` würden die Wartbarkeit deutlich verbessern
