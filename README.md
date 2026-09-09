# fipla – Finanzplan-Simulator Altdorf

Interaktives HTML-Tool, das den Excel-Finanzplan der Gemeinde Altdorf (Finanzplan BG 2027, Planjahre 2027–2032) nachrechnet und mit Slidern und Schaltern Szenarien simuliert.

- `dist/finanzplan.html` – **fertiges Tool, eine Datei, läuft offline im Browser** (Doppelklick genügt).
- `src/` – Quellcode: `model.js` (Rechenkern), `app.js` (Oberfläche), `index.html`, `data.js`/`data.json` (Basisdaten aus dem Excel).
- `tools/extract_excel.py` – liest ein neues Finanzplan-Excel und erzeugt `src/data.json` und `src/data.js` (benötigt `pip install openpyxl`).
- `tools/verify.js` – prüft, ob das Modell die Excel-Werte reproduziert (`node tools/verify.js`).
- `tools/build.py` – baut `dist/finanzplan.html` aus `src/`.
- `KONZEPT.md` – Analyse des Excel und Konzept des Tools.

## Neue Planungsrunde einlesen

```bash
pip install openpyxl
python3 tools/extract_excel.py Pfad/zum/Finanzplan_BG_2028.xlsx
node tools/verify.js
python3 tools/build.py
```

Der Extraktor setzt den heutigen Blattaufbau voraus (Zeilennummern in `ER Bilanz`, `Parameter`, `Steuern`, Objektgruppen in `Investitionsrechnung`). Verschieben sich Zeilen, müssen die Zeilennummern in `tools/extract_excel.py` und `src/model.js` nachgeführt werden.
