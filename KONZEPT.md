# Finanzplan-Simulator: Analyse des Excel-Finanzplans und Konzept für ein Web-Tool

Grundlage: `Finanzplan_BG_2027.xlsx` (Gemeinde Altdorf, Finanzplan BG 2027, 1. Lesung Budget 2027, Planjahre 2027–2032, Beträge in 1'000 CHF).

## 1. Aufbau des Excel-Finanzplans

| Blatt | Rolle | Was drin steckt |
|---|---|---|
| **Titel** | Deckblatt | Zusammenfassung der Parameter (Steuerfuss, Wachstumsraten) und der Annahmen des Finanzplans. Nur Verweise, keine Logik. |
| **Parameter** | Eingaben | Abschreibungssätze pro Anlagekategorie (Hochbau 10 %, Tiefbau 7 %, Mobilien 50 %, immateriell 50 %, Informatik 60 %, Investitionsbeiträge 10 % / 100 %), Passivzins Neuverschuldung (1.5 %), Einwohnerzahl (+0.998 %/Jahr), Wachstumsraten für Personal (2.5 %), Sachaufwand (1 %), Pflegefinanzierung (1 %), baulicher Unterhalt (2 %), Transferaufwand (2 %), Sozialhilfe (2 %), Steuernachträge (4 %), Schülerpauschale (2.2 %) usw. Für die Rechnungsjahre 2021–2027 sind die Raten rückwärts aus der ER berechnet, ab 2028 sind es Eingaben (eine Zelle pro Zeile, die Folgejahre verweisen darauf). |
| **Steuern** | Teilmodell | Natürliche Personen: Einkommens-, Vermögens-, Kopfsteuern bei 100 % × Wachstum × Steuerfuss (0.95). Juristische Personen: einzelne Grossfirmen (konstant) und übrige jur. Personen (+2 %). Liefert ER-Zeilen 46 und 50. |
| **Fremdkapital** | Teilmodell | Bestehende Darlehen mit Laufzeit und Zins. Darlehensbedarf = Schulden aus der Bilanz. Neuverschuldung = Bedarf − Bestand, verzinst zum Passivzins. Liefert den Finanzaufwand (ER-Zeile 23) **mit einem Jahr Verzögerung** (Zinsen 2028 = f(Schulden Ende 2027)), dadurch kein Zirkelbezug. |
| **ER Bilanz** | Rechenkern | Erfolgsrechnung (Zeilen 6–81), Bilanz (84–123), Finanzierungsrechnung (126–145) und Kennzahlen (149–155). Jede Planzeile ist `Vorjahr × (1 + Rate)` plus Sonderfälle. Die Bilanz rollt das Verwaltungsvermögen vor (Bestand + Investitionen − Abschreibungen). **Die Schulden (Zeile 110) sind die Restgrösse, die die Bilanz ausgleicht**, das Eigenkapital wächst um das Jahresergebnis. |
| **Investitionsrechnung** | Eingaben | ~620 Zeilen: 71 Objekte (Schulhäuser, Strassen, Fahrzeuge, Planungen, Beiträge) mit Einzeltranchen pro Jahr, Notizen der internen Besprechungen und Pro-Memoria-Posten. Summen pro Objektart (Zeilen 664–671) speisen Abschreibungen und Verwaltungsvermögen. |
| **Finanzleitbild** | Zielprüfung | Fünf Grundsätze: (1) Ergebnis inkl. 20 % freies EK ≥ 0, (2) EK-Reserve 20 % der Steuererträge, (3) Selbstfinanzierung 5 Jahre inkl. freies EK ≥ 100 %, (4) Nettoschuld I ≤ 50 % (Ziel) / 100 % (Max.) der Steuereinnahmen, (5) Steuerfuss ≤ Median der Nachbargemeinden + 4 Punkte. |
| **Ergebnisse / Grafiken** | Ausgabe | Kennzahlentabelle und 17 Balkendiagramme (Ergebnis, EK, Abschreibungen, Nettoinvestitionen, Nettoschuld, Fremdkapital, Personal-, Sachaufwand, Selbstfinanzierungsgrad, Steuerfuss). |

### Rechenfluss

```
Parameter ─┐
Steuern ───┼─▶ Erfolgsrechnung ─▶ Ergebnis ─▶ Eigenkapital ─┐
Invest. ───┼─▶ Abschreibungen ─▶ Verwaltungsvermögen ───────┼─▶ Schulden (Restgrösse) ─▶ Zinsen (Folgejahr) ─┐
Fremdkap. ─┘                                                 └─▶ Nettoschuld, Selbstfinanzierung, Kennzahlen  │
           ▲───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Was im Excel schwer zu bedienen ist

- **Stellhebel sind über fünf Blätter verstreut** (Parameter, Steuern, Finanzleitbild!42 für den Steuerfuss, Investitionsrechnung, ER Bilanz).
- **Szenario-Annahmen stecken als Konstanten in Formeln**: `-200` (Unterhalt 2028), `-500` (Sozialhilfe 2029, zweimal), `-250` (Sachaufwandkorrektur), `-650` (Globalbilanzausgleich), `-1230` (Finanzertrag 2028), Miete Stoffelmatte, Tellspiele. Wer sie ändern will, muss die Formel kennen.
- **Kein Vergleich Basis vs. Szenario**: Jede Änderung überschreibt den Plan, ein Vorher/Nachher ist nur per Kopie der Datei möglich.
- **Ein Projekt verschieben** heisst Zahlen zwischen Spalten von Hand verschieben, quer über bis zu 620 Zeilen.
- Reste aus früheren Versionen (`#REF!` in Ergebnisse!C13/C21, defekte Namen `Nettoschuld2`, `Print_Area`).

Positiv: Das Modell ist sauber **nicht zirkulär** (Zinsen um ein Jahr verzögert), gut strukturiert und mit 12 Jahren × ~130 Zeilen klein genug, um es vollständig in JavaScript nachzubauen.

## 2. Konzept für das Web-Tool

### Zielbild

Eine Seite, die ohne Excel-Kenntnisse bedienbar ist: links die Stellhebel (Slider, Schalter, Ein/Aus pro Projekt), rechts sofort die Wirkung auf 2027–2032 als Kennzahlen, Ampel zum Finanzleitbild, Grafiken und Tabelle. Der unveränderte Finanzplan bleibt immer als grauer Vergleich sichtbar.

### Architektur

```
Excel (Quelle der Wahrheit)
   │  tools/extract_excel.py  (einmal pro Planungsrunde)
   ▼
src/data.json / data.js   Basiswerte: Rechnung 2021–2025, HRG 2026, Budget 2027, Parameter, Investitionsobjekte
   │
src/model.js              Rechenkern: Excel-Formeln als Funktionen, compute(data, hebel) → alle Kennzahlen
   │
src/app.js + index.html   Oberfläche: Hebel-Panel, KPI-Kacheln, Finanzleitbild-Ampel, SVG-Grafiken, Tabelle,
                          Szenarien speichern/laden/teilen (localStorage, JSON, URL)
   │
dist/finanzplan.html      Eine einzige Datei, läuft offline per Doppelklick (Build: tools/build.py)
```

**Warum reines HTML/JS ohne Server**

- Die Daten sind öffentlich-relevante Planzahlen einer Gemeinde, aber Szenarien sollen nicht auf fremden Servern liegen. Alles bleibt im Browser.
- Eine Datei lässt sich per E-Mail an den Gemeinderat verteilen oder auf den Gemeinde-Webserver legen, ohne Installation.
- Rechenzeit: eine vollständige Neuberechnung dauert unter einer Millisekunde, Slider reagieren live.

### Stellhebel (umgesetzt im Prototyp)

| Gruppe | Hebel | Excel-Entsprechung |
|---|---|---|
| Steuern & Bevölkerung | Steuerfuss (80–115 %, ab Jahr), Wachstum Einkommen / Vermögen / jur. Personen, Bevölkerungswachstum | Finanzleitbild!42, Steuern!J16/J17/J36, Parameter!J25 |
| Aufwand | Wachstum Personal, Sach, Unterhalt, Pflege, Transfer, Sozialhilfe, Schülerpauschale; Sparmassnahmen, Mehraufwand, Mehrertrag (Betrag ab Jahr) | Parameter!J30–J35, J49; neue Hebel |
| Investitionen | Skalierung Hochbau / Tiefbau / übrige; zusätzliches Projekt (Betrag, Jahr); **pro Objekt Ein/Aus und Verschiebung um 1–3 Jahre** | Investitionsrechnung |
| Finanzierung | Zinssatz Neuverschuldung, Abschreibungssätze Hoch-/Tiefbau | Parameter!J13, J5, J6 |
| Annahmen | Sieben Schalter für die im Excel fest verdrahteten Korrekturen | Konstanten in ER-Bilanz-Formeln |

### Ausgaben

- **Kennzahlen-Kacheln** mit Abweichung zum Finanzplan (kumuliertes Ergebnis, EK 2032, Nettoschuld pro Kopf, Selbstfinanzierungsgrad, Investitionssumme, Schulden).
- **Finanzleitbild-Ampel**: fünf Grundsätze × sechs Planjahre, grün/gelb/rot.
- **Acht Grafiken** Basis vs. Szenario (Ergebnis, EK mit Reservelinie, Nettoschuld pro Kopf, Investitionen vs. Selbstfinanzierung, Selbstfinanzierungsgrad 5 J., Nettoschuldquote, Schulden, Steuererträge).
- **Tabelle** mit Abweichungen, optional die wichtigsten ER-Zeilen, CSV-Export.

### Validierung

`node tools/verify.js` vergleicht das JS-Modell mit den im Excel gespeicherten Werten. Im Basisszenario stimmen Ergebnis, Aufwand, Ertrag, Eigenkapital, Schulden, Zinsen, Abschreibungen, Steuern, Nettoschuld, Selbstfinanzierung und Verwaltungsvermögen für 2027–2032 auf die Rundung genau überein.

### Bewusste Vereinfachungen

- Grossfirmen-Steuern (Merck, Dätwyler) bleiben wie im Plan konstant; Steuerfuss jur. Personen bleibt 95 % (im Excel separat in Steuern!31).
- Rechnungsjahre bis 2025, Hochrechnung 2026 und die Budgetwerte 2027 sind fix; nur die Steuern 2027 reagieren auf den Steuerfuss.
- Verschobene Investitionstranchen, die über 2032 hinausfallen, verschwinden aus dem Horizont (wie im Excel).
- Die Darlehensliste (welche Bank, welche Laufzeit) wird nicht simuliert, nur der Bestand und die Zinsen daraus.

## 3. Ausbaustufen

1. **Jetzt (Prototyp, diese Ablage)**: Eine HTML-Datei, Szenarien lokal im Browser, Link zum Teilen.
2. **Nächster Schritt**: Excel-Upload direkt im Browser (SheetJS), damit die Finanzverwaltung jede neue Planungsrunde ohne Python einlesen kann; Druckansicht für die Botschaft an den Gemeinderat; Steuerfuss pro Jahr statt "ab Jahr".
3. **Optional als Web-App**: Statisches Hosting (GitHub Pages oder Gemeinde-Webserver), Szenarien zentral speichern (kleine Datenbank), Rollen (Finanzverwaltung bearbeitet Basis, Gemeinderat spielt Szenarien), Versionierung der Planrunden, Export zurück nach Excel.
4. **Fachlicher Ausbau**: Sensitivitätsanalyse (welcher Hebel wirkt am stärksten), Monte-Carlo für Steuerwachstum, Vergleich mehrerer gespeicherter Szenarien nebeneinander, Darlehensplanung mit Laufzeiten und Refinanzierungszins.
