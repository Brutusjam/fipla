// Finanzplan-Simulator: Oberfläche, Stellhebel, Grafiken. Rechenlogik siehe model.js.
(function () {
  'use strict';
  const DATA = window.FINANZPLAN_DATA, M = window.FinanzModell;
  const PLAN_YEARS = [2027, 2028, 2029, 2030, 2031, 2032];
  const SHOW_YEARS = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032];
  const yi = (y) => y - M.Y0;
  const $ = (s, el) => (el || document).querySelector(s);
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const fmtN = (v, d = 0) => { if (v == null || isNaN(v)) return '–'; const s = Math.abs(v).toFixed(d); const [a, b] = s.split('.'); return (v < 0 ? '−' : '') + a.replace(/\B(?=(\d{3})+(?!\d))/g, "'") + (b ? '.' + b : ''); };
  const fmtP = (v, d = 1) => (v == null || isNaN(v) || !isFinite(v)) ? '–' : (v * 100).toFixed(d).replace('-', '−') + ' %';
  const fmtD = (v, d = 0) => v === 0 ? '±0' : (v > 0 ? '+' : '−') + fmtN(Math.abs(v), d);

  // ---------- Zustand ----------
  const base = M.defaultLevers(DATA);
  const baseOut = M.compute(DATA, base);
  let L = M.defaultLevers(DATA);
  // UI-Hilfszustand für "ab Jahr"-Hebel
  let ui = { steuerfussVal: 0.95, steuerfussAb: 2027, sparVal: 0, sparAb: 2028, mehrVal: 0, mehrAb: 2028, ertragVal: 0, ertragAb: 2028, zusatzInvVal: 0, zusatzInvJahr: 2029, uebrige: 1 };
  const uiDefaults = JSON.parse(JSON.stringify(ui));
  let out = baseOut;

  function applyUi() {
    for (const y of PLAN_YEARS) {
      L.steuerfuss[y] = y >= ui.steuerfussAb ? ui.steuerfussVal : 0.95;
      L.sparpaket[y] = y >= ui.sparAb ? -ui.sparVal : 0;
      L.extra_aufwand[y] = y >= ui.mehrAb ? ui.mehrVal : 0;
      L.extra_ertrag[y] = y >= ui.ertragAb ? ui.ertragVal : 0;
      L.extra_invest[y] = y === ui.zusatzInvJahr ? ui.zusatzInvVal : 0;
    }
    for (const c of ['mobilien', 'immateriell', 'informatik', 'invbeitr_mit']) L.invest_scale[c] = ui.uebrige;
  }
  function recompute() { applyUi(); out = M.compute(DATA, L); render(); saveHash(); }

  // ---------- Hebel-Definitionen ----------
  const pct = { fmt: (v) => fmtP(v, 1), step: 0.001 };
  const sections = [
    { id: 'steuern', title: 'Steuern & Bevölkerung', controls: [
      { type: 'range', key: 'ui.steuerfussVal', label: 'Steuerfuss', min: 0.80, max: 1.15, step: 0.01, fmt: (v) => (v * 100).toFixed(0) + ' %', hint: 'Basis 95 %. Wirkt auf Einkommens- und Vermögenssteuern nat. Personen.' },
      { type: 'year', key: 'ui.steuerfussAb', label: 'gültig ab' },
      { type: 'range', key: 'w_einkommen', label: 'Wachstum Einkommenssteuern', min: -0.02, max: 0.06, ...pct, hint: 'Steuert auch Quellensteuern, Grundstückgewinnsteuern und Finanzausgleich.' },
      { type: 'range', key: 'w_vermoegen', label: 'Wachstum Vermögenssteuern', min: -0.02, max: 0.08, ...pct },
      { type: 'range', key: 'w_jurpers', label: 'Wachstum jur. Personen (übrige)', min: -0.10, max: 0.10, ...pct, hint: 'Merck und Dätwyler bleiben gemäss Plan konstant.' },
      { type: 'range', key: 'w_bevoelkerung', label: 'Bevölkerungswachstum', min: 0, max: 0.03, ...pct, hint: 'Siedlungsleitbild: 0.94 % pro Jahr. Wirkt auf Kopfsteuern und Pro-Kopf-Kennzahlen.' },
    ] },
    { id: 'aufwand', title: 'Aufwand', controls: [
      { type: 'range', key: 'w_personal', label: 'Personalaufwand (Teuerung, Stufen)', min: 0, max: 0.06, ...pct },
      { type: 'range', key: 'w_sach', label: 'Sachaufwand', min: -0.03, max: 0.06, ...pct },
      { type: 'range', key: 'w_unterhalt', label: 'Baulicher Unterhalt & Anschaffungen', min: -0.05, max: 0.08, ...pct },
      { type: 'range', key: 'w_pflege', label: 'Restkosten Pflegefinanzierung', min: 0, max: 0.08, ...pct },
      { type: 'range', key: 'w_transfer', label: 'Transferaufwand (ohne Sozialhilfe)', min: 0, max: 0.06, ...pct },
      { type: 'range', key: 'w_sozialhilfe', label: 'Sozialhilfe', min: -0.05, max: 0.15, ...pct, hint: 'Rückerstattungen wachsen mit.' },
      { type: 'range', key: 'w_schueler', label: 'Schülerpauschale (Ertrag)', min: 0, max: 0.05, ...pct },
      { type: 'range', key: 'ui.sparVal', label: 'Sparmassnahmen pro Jahr', min: 0, max: 3000, step: 50, fmt: (v) => fmtN(v) + " T", hint: 'Dauerhafte Entlastung des Sachaufwands, in 1\'000 CHF pro Jahr.' },
      { type: 'year', key: 'ui.sparAb', label: 'ab Jahr' },
      { type: 'range', key: 'ui.mehrVal', label: 'Neue Aufgabe / Mehraufwand pro Jahr', min: 0, max: 3000, step: 50, fmt: (v) => fmtN(v) + " T" },
      { type: 'year', key: 'ui.mehrAb', label: 'ab Jahr' },
      { type: 'range', key: 'ui.ertragVal', label: 'Mehrertrag pro Jahr (Gebühren u. a.)', min: 0, max: 3000, step: 50, fmt: (v) => fmtN(v) + " T" },
      { type: 'year', key: 'ui.ertragAb', label: 'ab Jahr' },
    ] },
    { id: 'invest', title: 'Investitionen', controls: [
      { type: 'range', key: 'invest_scale.hochbau', label: 'Hochbauten (alle Projekte)', min: 0, max: 2, step: 0.05, fmt: (v) => (v * 100).toFixed(0) + ' %' },
      { type: 'range', key: 'invest_scale.tiefbau', label: 'Tiefbauten (alle Projekte)', min: 0, max: 2, step: 0.05, fmt: (v) => (v * 100).toFixed(0) + ' %' },
      { type: 'range', key: 'ui.uebrige', label: 'Übrige (Mobilien, Planungen, Beiträge)', min: 0, max: 2, step: 0.05, fmt: (v) => (v * 100).toFixed(0) + ' %' },
      { type: 'range', key: 'ui.zusatzInvVal', label: 'Zusätzliches Hochbauprojekt', min: 0, max: 15000, step: 250, fmt: (v) => fmtN(v) + " T", hint: 'Einmalig, abgeschrieben mit 10 % degressiv, finanziert über Fremdkapital.' },
      { type: 'year', key: 'ui.zusatzInvJahr', label: 'im Jahr' },
      { type: 'projects' },
    ] },
    { id: 'finanz', title: 'Finanzierung', controls: [
      { type: 'range', key: 'passivzins', label: 'Zinssatz Neuverschuldung', min: 0, max: 0.05, ...pct, hint: 'Bestehende Darlehen behalten ihre vertraglichen Zinssätze.' },
      { type: 'range', key: 'abschr.hochbau', label: 'Abschreibungssatz Hochbauten', min: 0.05, max: 0.20, step: 0.005, fmt: (v) => fmtP(v, 1) },
      { type: 'range', key: 'abschr.tiefbau', label: 'Abschreibungssatz Tiefbauten', min: 0.03, max: 0.15, step: 0.005, fmt: (v) => fmtP(v, 1) },
    ] },
    { id: 'annahmen', title: 'Annahmen des Finanzplans', controls: [
      { type: 'switch', key: 'korr_sachaufwand', label: 'Finanzplankorrektur Sachaufwand', hint: '−250 T pro Jahr (pauschale Korrektur)' },
      { type: 'switch', key: 'globalbilanz', label: 'Kürzung Globalbilanzausgleich', hint: '−650 T Ertrag 2027–2030 (Kanton)' },
      { type: 'switch', key: 'korr_sozialhilfe_2029', label: 'Korrektur Kindesschutz 2029', hint: '−500 T Sozialhilfe Altdorf und −500 T Uri Nord, dauerhaft' },
      { type: 'switch', key: 'korr_unterhalt_2028', label: 'Reduktion baulicher Unterhalt 2028', hint: '−200 T einmalig, wirkt auf die Folgejahre' },
      { type: 'switch', key: 'finanzertrag_2028', label: 'Einmaliger Finanzertrag nur 2027', hint: 'Ab 2028 fallen 1\'230 T Finanzertrag weg' },
      { type: 'switch', key: 'miete_stoffelmatte', label: 'Miete Stoffelmatte', hint: '50 T ab 2029, 100 T ab 2030' },
      { type: 'switch', key: 'tellspiele', label: 'Tellspiele / Alpentöne / Volksmusikfest', hint: '190 T 2028, 90 T 2029, danach 20 T' },
    ] },
  ];

  const getKey = (key) => { const p = key.split('.'); let o = p[0] === 'ui' ? ui : L; if (p[0] === 'ui') p.shift(); for (let k = 0; k < p.length - 1; k++) o = o[p[k]]; return o[p[p.length - 1]]; };
  const setKey = (key, v) => { const p = key.split('.'); let o = p[0] === 'ui' ? ui : L; if (p[0] === 'ui') p.shift(); for (let k = 0; k < p.length - 1; k++) o = o[p[k]]; o[p[p.length - 1]] = v; };

  // Projekte: Gruppen nach Volumen 2027–2032
  const projects = DATA.invest.groups.map(g => ({ name: g.name, cat: g.cat, sum: g.v.slice(6).reduce((a, b) => a + b, 0), v: g.v.slice(6) }))
    .filter(p => p.sum > 0).sort((a, b) => b.sum - a.sum);
  const catLabel = { hochbau: 'Hochbau', tiefbau: 'Tiefbau', mobilien: 'Mobilien', immateriell: 'Planung', informatik: 'Informatik', invbeitr_mit: 'Beitrag', invbeitr_ohne: 'Beitrag', beteiligungen: 'Beteiligung' };

  // ---------- Hebel-Panel ----------
  function buildPanel() {
    const panel = $('#levers'); panel.textContent = '';
    for (const sec of sections) {
      const body = h('div', { class: 'sec-body' });
      for (const c of sec.controls) body.append(buildControl(c));
      const det = h('details', { class: 'sec', open: sec.id === 'steuern' || sec.id === 'invest' ? '' : null }, h('summary', {}, h('span', { text: sec.title }), h('span', { class: 'sec-badge', id: 'badge-' + sec.id })), body);
      panel.append(det);
    }
  }
  function buildControl(c) {
    if (c.type === 'range') {
      const val = h('output', { class: 'ctl-val' });
      const input = h('input', { type: 'range', min: c.min, max: c.max, step: c.step, 'aria-label': c.label });
      const sync = () => { const v = getKey(c.key); input.value = v; val.textContent = c.fmt(v); const bv = c.key.startsWith('ui.') ? uiDefaults[c.key.slice(3)] : getBase(c.key); input.closest('.ctl').classList.toggle('changed', Math.abs(v - bv) > 1e-9); };
      input.addEventListener('input', () => { setKey(c.key, parseFloat(input.value)); val.textContent = c.fmt(parseFloat(input.value)); recompute(); });
      const wrap = h('div', { class: 'ctl' }, h('div', { class: 'ctl-head' }, h('label', { text: c.label }), val), input, c.hint ? h('p', { class: 'hint', text: c.hint }) : null);
      wrap._sync = sync; sync(); return wrap;
    }
    if (c.type === 'year') {
      const sel = h('select', { 'aria-label': c.label }, PLAN_YEARS.map(y => h('option', { value: y, text: y })));
      const sync = () => { sel.value = getKey(c.key); };
      sel.addEventListener('change', () => { setKey(c.key, parseInt(sel.value, 10)); recompute(); });
      const wrap = h('div', { class: 'ctl ctl-year' }, h('label', { text: c.label }), sel); wrap._sync = sync; sync(); return wrap;
    }
    if (c.type === 'switch') {
      const input = h('input', { type: 'checkbox', role: 'switch' });
      const sync = () => { input.checked = !!getKey(c.key); input.closest('.ctl').classList.toggle('changed', !!getKey(c.key) !== !!getBase(c.key)); };
      input.addEventListener('change', () => { setKey(c.key, input.checked); recompute(); });
      const wrap = h('label', { class: 'ctl ctl-switch' }, h('span', { class: 'sw-text' }, h('span', { class: 'sw-label', text: c.label }), h('span', { class: 'hint', text: c.hint })), h('span', { class: 'switch' }, input, h('span', { class: 'knob' })));
      wrap._sync = sync; sync(); return wrap;
    }
    if (c.type === 'projects') {
      const list = h('div', { class: 'projects' });
      const rows = [];
      for (const p of projects.slice(0, 24)) {
        const sw = h('input', { type: 'checkbox', role: 'switch', 'aria-label': p.name + ' aktiv' });
        const shift = h('select', { 'aria-label': 'Verschiebung ' + p.name }, [0, 1, 2, 3].map(s => h('option', { value: s, text: s === 0 ? 'planmässig' : '+' + s + ' J.' })));
        const st = () => L.projects[p.name] || (L.projects[p.name] = { on: true, shift: 0 });
        sw.addEventListener('change', () => { st().on = sw.checked; recompute(); });
        shift.addEventListener('change', () => { st().shift = parseInt(shift.value, 10); recompute(); });
        const row = h('div', { class: 'proj' },
          h('div', { class: 'proj-main' }, h('span', { class: 'proj-name', text: p.name }), h('span', { class: 'proj-meta' }, h('span', { class: 'chip chip-' + p.cat, text: catLabel[p.cat] }), ' ', fmtN(p.sum) + ' T · ' + p.v.map((v, k) => v ? PLAN_YEARS[k] : null).filter(Boolean).join(', '))),
          h('div', { class: 'proj-ctl' }, shift, h('span', { class: 'switch' }, sw, h('span', { class: 'knob' }))));
        row._sync = () => { const s = L.projects[p.name] || {}; sw.checked = s.on !== false; shift.value = s.shift || 0; row.classList.toggle('off', s.on === false); row.classList.toggle('changed', s.on === false || (s.shift || 0) > 0); };
        rows.push(row); list.append(row);
      }
      const wrap = h('div', { class: 'ctl' }, h('div', { class: 'ctl-head' }, h('label', { text: 'Projekte (grösste zuerst, 2027–2032)' })), h('p', { class: 'hint', text: 'Ausschalten streicht das Projekt, Verschieben rückt alle Tranchen um ganze Jahre nach hinten. Tranchen nach 2032 fallen aus dem Horizont.' }), list);
      wrap._sync = () => rows.forEach(r => r._sync()); return wrap;
    }
  }
  function getBase(key) { const p = key.split('.'); let o = base; for (const k of p) o = o[k]; return o; }
  function syncPanel() { document.querySelectorAll('#levers .ctl').forEach(el => el._sync && el._sync()); }

  // ---------- Grafiken (SVG) ----------
  function barChart(el, opt) {
    // opt: {years, series:[{label, values, color, ghost}], fmt, lines:[{label, values, color}], thresholds:[{value,label}], unit}
    const W = el.clientWidth || 520, H = 240, mL = 52, mR = 12, mT = 20, mB = 28;
    const iw = W - mL - mR, ih = H - mT - mB;
    const all = [...opt.series.flatMap(s => s.values), ...(opt.lines || []).flatMap(s => s.values), ...(opt.thresholds || []).map(t => t.value), 0].filter(v => v != null && isFinite(v));
    let lo = Math.min(...all), hi = Math.max(...all); if (hi === lo) hi = lo + 1;
    const pad = (hi - lo) * 0.03; lo = Math.min(0, lo - pad); hi = Math.max(0, hi + pad);
    const ticks = niceTicks(lo, hi, 5); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    const y = (v) => mT + (hi - v) / (hi - lo) * ih;
    const n = opt.years.length, band = iw / n, ns = opt.series.length;
    const bw = Math.min(22, (band - 10) / ns - 2);
    const ns_ = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns_, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', '100%'); svg.setAttribute('height', H); svg.classList.add('chart');
    const mk = (t, a, txt) => { const e = document.createElementNS(ns_, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (txt != null) e.textContent = txt; return e; };
    for (const t of ticks) { svg.append(mk('line', { x1: mL, x2: W - mR, y1: y(t), y2: y(t), class: t === 0 ? 'zero' : 'grid' })); svg.append(mk('text', { x: mL - 6, y: y(t) + 3.5, class: 'tick', 'text-anchor': 'end' }, opt.tickFmt ? opt.tickFmt(t) : fmtN(t))); }
    opt.years.forEach((yr, k) => {
      svg.append(mk('text', { x: mL + band * k + band / 2, y: H - 8, class: 'tick' + (yr >= 2027 ? '' : ' hist'), 'text-anchor': 'middle' }, yr));
      opt.series.forEach((s, j) => {
        const v = s.values[k]; if (v == null || !isFinite(v)) return;
        const x = mL + band * k + band / 2 - (ns * bw + (ns - 1) * 2) / 2 + j * (bw + 2);
        const y0 = y(0), y1 = y(v), top = Math.min(y0, y1), hgt = Math.abs(y1 - y0), r = Math.min(4, hgt);
        const d = v >= 0 ? `M${x},${y0} v${-(hgt - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${hgt - r} z` : `M${x},${y0} v${hgt - r} a${r},${r} 0 0 0 ${r},${r} h${bw - 2 * r} a${r},${r} 0 0 0 ${r},${-r} v${-(hgt - r)} z`;
        const p = mk('path', { d, fill: s.color, class: 'bar' + (s.ghost ? ' ghost' : '') + (v < 0 && s.neg ? ' neg' : '') }); if (s.neg && v < 0) p.setAttribute('fill', s.neg);
        p.append(mk('title', {}, `${yr} · ${s.label}: ${opt.fmt(v)}`)); svg.append(p); void top;
      });
    });
    for (const t of (opt.thresholds || [])) { svg.append(mk('line', { x1: mL, x2: W - mR, y1: y(t.value), y2: y(t.value), class: 'threshold' })); svg.append(mk('text', { x: W - mR, y: y(t.value) - 4, class: 'tick', 'text-anchor': 'end' }, t.label)); }
    for (const ln of (opt.lines || [])) {
      const pts = opt.years.map((yr, k) => ln.values[k] == null ? null : `${mL + band * k + band / 2},${y(ln.values[k])}`).filter(Boolean).join(' ');
      svg.append(mk('polyline', { points: pts, fill: 'none', stroke: ln.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      opt.years.forEach((yr, k) => { if (ln.values[k] == null) return; const c = mk('circle', { cx: mL + band * k + band / 2, cy: y(ln.values[k]), r: 4, fill: ln.color, class: 'dot' }); c.append(mk('title', {}, `${yr} · ${ln.label}: ${opt.fmt(ln.values[k])}`)); svg.append(c); });
    }
    el.textContent = ''; el.append(svg);
  }
  function niceTicks(lo, hi, n) {
    const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const t = []; for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + 1e-9; v += step) t.push(Math.round(v / step) * step);
    return t;
  }

  const charts = [
    { id: 'c-erfolg', title: 'Ergebnis Erfolgsrechnung', sub: 'Ertragsüberschuss (+) oder Aufwandüberschuss (−), in 1\'000 CHF', get: (o) => o.erfolg, cmp: true, neg: true },
    { id: 'c-ek', title: 'Eigenkapital', sub: 'Bilanzüberschuss per Jahresende; Linie: Reserve von 20 % der Steuererträge (Finanzleitbild)', get: (o) => o.ek, cmp: true, line: (o) => ({ label: 'EK-Reserve 20 %', values: o.ekReserve }) },
    { id: 'c-nspk', title: 'Nettoschuld I pro Einwohner', sub: 'Fremdkapital abzüglich Finanzvermögen, in CHF pro Kopf', get: (o) => o.nettoschuld1ProKopf, cmp: true },
    { id: 'c-inv', title: 'Nettoinvestitionen und Selbstfinanzierung', sub: 'Szenario, in 1\'000 CHF. Selbstfinanzierung = Ergebnis + Abschreibungen', multi: (o) => [{ label: 'Nettoinvestitionen', values: pick(o.nettoInv), color: 'var(--s1)' }, { label: 'Selbstfinanzierung', values: pick(o.selbstfin), color: 'var(--s2)', neg: 'var(--crit)' }], legend: true },
    { id: 'c-sfg', title: 'Selbstfinanzierungsgrad über 5 Jahre', sub: 'inkl. freies Eigenkapital, Zielvorgabe 100 % (Finanzleitbild Grundsatz 3)', get: (o) => o.selbstfinGrad5EK, cmp: true, pct: true, thresholds: [{ value: 1, label: 'Ziel 100 %' }] },
    { id: 'c-nsq', title: 'Nettoschuld I in % der Steuereinnahmen', sub: 'Zielgrösse 50 %, Maximum 100 % (Finanzleitbild Grundsatz 4)', get: (o) => o.nettoschuldQuote, cmp: true, pct: true, thresholds: [{ value: 0.5, label: 'Ziel 50 %' }, { value: 1, label: 'Max. 100 %' }] },
    { id: 'c-schuld', title: 'Mittel- und langfristige Schulden', sub: 'Darlehensbestand per Jahresende, in 1\'000 CHF', get: (o) => o.schulden, cmp: true },
    { id: 'c-steuer', title: 'Steuererträge Rechnungsjahr', sub: 'Natürliche und juristische Personen, in 1\'000 CHF', get: (o) => o.steuerertrag, cmp: true },
  ];
  const pick = (arr) => SHOW_YEARS.map(y => arr[yi(y)]);

  function buildCharts() {
    const grid = $('#charts'); grid.textContent = '';
    for (const c of charts) grid.append(h('figure', { class: 'card chart-card', id: c.id }, h('figcaption', {}, h('h3', { text: c.title }), h('p', { class: 'sub', text: c.sub }), c.cmp || c.legend ? h('div', { class: 'legend' }, c.legend ? c.multi(out).map(s => h('span', {}, h('i', { style: 'background:' + s.color }), s.label)) : [h('span', {}, h('i', { class: 'ghost' }), 'Finanzplan (Basis)'), h('span', {}, h('i', { style: 'background:var(--s1)' }), 'Szenario')]) : null), h('div', { class: 'plot' })));
  }
  function renderCharts() {
    for (const c of charts) {
      const el = $('#' + c.id + ' .plot'), fmt = c.pct ? (v) => fmtP(v, 0) : (v) => fmtN(v);
      const opt = { years: SHOW_YEARS, fmt, tickFmt: c.pct ? (v) => (v * 100).toFixed(0) + '%' : (v) => fmtN(v), thresholds: c.thresholds };
      if (c.multi) opt.series = c.multi(out);
      else opt.series = [{ label: 'Finanzplan (Basis)', values: pick(c.get(baseOut)), color: 'var(--ghost)', ghost: true }, { label: 'Szenario', values: pick(c.get(out)), color: 'var(--s1)', neg: c.neg ? 'var(--crit)' : null }];
      if (c.line) { const ln = c.line(out); opt.lines = [{ label: ln.label, values: pick(ln.values), color: 'var(--s2)' }]; }
      barChart(el, opt);
    }
  }

  // ---------- KPI-Kacheln ----------
  const sumPlan = (arr) => PLAN_YEARS.reduce((a, y) => a + (arr[yi(y)] || 0), 0);
  const kpis = [
    { label: 'Kumuliertes Ergebnis 2027–2032', get: (o) => sumPlan(o.erfolg), fmt: (v) => fmtN(v) + ' T', up: true },
    { label: 'Eigenkapital Ende 2032', get: (o) => o.ek[11], fmt: (v) => fmtN(v) + ' T', up: true },
    { label: 'Nettoschuld I pro Kopf 2032', get: (o) => o.nettoschuld1ProKopf[11], fmt: (v) => 'CHF ' + fmtN(v), up: false },
    { label: 'Selbstfinanzierungsgrad 2027–2032', get: (o) => sumPlan(o.selbstfin) / sumPlan(o.nettoInv), fmt: (v) => fmtP(v, 0), up: true, pct: true },
    { label: 'Nettoinvestitionen 2027–2032', get: (o) => sumPlan(o.nettoInv), fmt: (v) => fmtN(v) + ' T', up: null },
    { label: 'Schulden Ende 2032', get: (o) => o.schulden[11], fmt: (v) => fmtN(v) + ' T', up: false },
  ];
  function renderKpis() {
    const row = $('#kpis'); row.textContent = '';
    for (const k of kpis) {
      const v = k.get(out), b = k.get(baseOut), d = v - b;
      let cls = 'flat'; if (Math.abs(d) > (k.pct ? 0.0005 : 0.5) && k.up != null) cls = (d > 0) === k.up ? 'good' : 'bad';
      row.append(h('div', { class: 'kpi' }, h('div', { class: 'kpi-label', text: k.label }), h('div', { class: 'kpi-value', text: k.fmt(v) }),
        h('div', { class: 'kpi-delta ' + cls, text: Math.abs(d) < (k.pct ? 0.0005 : 0.5) ? 'wie Finanzplan' : (k.pct ? (d > 0 ? '+' : '−') + (Math.abs(d) * 100).toFixed(0) + ' Pp.' : fmtD(d) + ' T') + ' gegenüber Finanzplan' })));
    }
  }

  // ---------- Finanzleitbild ----------
  function renderLeitbild() {
    const tbl = $('#leitbild'); tbl.textContent = '';
    const o = out, rules = [
      { name: '1 · Ergebnis inkl. 20 % freies EK ≥ 0', get: (i) => o.erfolg[i] + 0.2 * o.ekFrei[i], fmt: (v) => fmtN(v) + ' T', state: (v) => v >= 0 ? 'good' : 'crit' },
      { name: '2 · Eigenkapital ≥ 20 % der Steuererträge', get: (i) => o.ek[i] / o.steuerertrag[i], fmt: (v) => fmtP(v, 0), state: (v) => v >= 0.2 ? 'good' : v >= 0.1 ? 'warn' : 'crit' },
      { name: '3 · Selbstfinanzierung 5 J. inkl. freies EK ≥ 100 %', get: (i) => o.selbstfinGrad5EK[i], fmt: (v) => fmtP(v, 0), state: (v) => v >= 1 ? 'good' : v >= 0.8 ? 'warn' : 'crit' },
      { name: '4 · Nettoschuld I ≤ 50 % (Ziel) / 100 % (Max.) der Steuern', get: (i) => o.nettoschuldQuote[i], fmt: (v) => fmtP(v, 0), state: (v) => v <= 0.5 ? 'good' : v <= 1 ? 'warn' : 'crit' },
      { name: '5 · Steuerfuss ≤ Median Nachbargemeinden + 4 (97 %)', get: (i) => o.steuerfuss[i], fmt: (v) => (v * 100).toFixed(0) + ' %', state: (v) => v <= 0.97 ? 'good' : 'crit' },
    ];
    tbl.append(h('thead', {}, h('tr', {}, h('th', { text: 'Grundsatz' }), PLAN_YEARS.map(y => h('th', { text: y })))));
    const tb = h('tbody', {});
    for (const r of rules) tb.append(h('tr', {}, h('th', { text: r.name }), PLAN_YEARS.map(y => { const v = r.get(yi(y)); return h('td', {}, h('span', { class: 'pill ' + r.state(v), text: r.fmt(v) })); })));
    tbl.append(tb);
  }

  // ---------- Tabelle ----------
  const tableRows = [
    { label: 'Gesamtaufwand', get: (o) => o.aufwand }, { label: 'Gesamtertrag', get: (o) => o.ertrag },
    { label: 'Ergebnis Erfolgsrechnung', get: (o) => o.erfolg, bold: true, neg: true },
    { label: 'Ordentliche Abschreibungen', get: (o) => o.abschreibungen }, { label: 'Selbstfinanzierung', get: (o) => o.selbstfin },
    { label: 'Nettoinvestitionen', get: (o) => o.nettoInv }, { label: 'Finanzierungsergebnis', get: (o) => o.finanzierung, bold: true, neg: true },
    { label: 'Selbstfinanzierungsgrad', get: (o) => o.selbstfinGrad, pct: true },
    { label: 'Eigenkapital', get: (o) => o.ek }, { label: 'Mittel- und langfristige Schulden', get: (o) => o.schulden },
    { label: 'Nettoschuld I', get: (o) => o.nettoschuld1 }, { label: 'Nettoschuld I pro Kopf (CHF)', get: (o) => o.nettoschuld1ProKopf },
    { label: 'Nettozinsen', get: (o) => o.nettozinsen }, { label: 'Zinsbelastungsanteil', get: (o) => o.zinsanteil, pct: true, d: 1 },
    { label: 'Steuererträge nat. Personen', get: (o) => o.steuernNP }, { label: 'Steuererträge jur. Personen', get: (o) => o.steuernJP },
    { label: 'Steuerfuss', get: (o) => o.steuerfuss, pct: true, d: 0 }, { label: 'Einwohner', get: (o) => o.bev },
  ];
  const detailRows = [
    ['Aufwand', [[7, 'Personalaufwand'], [8, 'Sachaufwand'], [9, 'Anschaffungen'], [10, 'Baulicher Unterhalt'], [13, 'Ordentliche Abschreibungen'], [23, 'Finanzaufwand (Zinsen)'], [26, 'Transferaufwand'], [30, 'Restkosten Pflegefinanzierung'], [32, 'Sozialhilfe Altdorf'], [33, 'Sozialhilfe Uri Nord'], [35, 'Beiträge Finanzausgleich']]],
    ['Ertrag', [[46, 'Steuern nat. Personen'], [47, 'Steuern nat. Personen Vorjahre'], [49, 'Quellensteuern'], [50, 'Steuern jur. Personen'], [66, 'Grundstückgewinnsteuern'], [67, 'Entschädigungen von Gemeinwesen'], [68, 'Beiträge Finanzausgleich'], [70, 'Kürzung Globalbilanzausgleich'], [73, 'Schülerpauschale']]],
  ];
  function renderTable() {
    const tbl = $('#table'); tbl.textContent = '';
    tbl.append(h('thead', {}, h('tr', {}, h('th', { text: "in 1'000 CHF" }), SHOW_YEARS.map(y => h('th', { text: y, class: y < 2027 ? 'hist' : '' })))));
    const tb = h('tbody', {});
    const cell = (v, b, r) => {
      const d = v - b, sig = r.pct ? 0.0005 : 0.5;
      return h('td', { class: (r.neg && v < 0 ? 'neg ' : '') + (Math.abs(d) > sig ? (d > 0 ? 'up' : 'down') : '') }, h('span', { text: r.pct ? fmtP(v, r.d ?? 0) : fmtN(v) }), Math.abs(d) > sig ? h('small', { text: r.pct ? (d > 0 ? '+' : '−') + (Math.abs(d) * 100).toFixed(1) : fmtD(d) }) : null);
    };
    for (const r of tableRows) { const a = r.get(out), b = r.get(baseOut); tb.append(h('tr', { class: r.bold ? 'bold' : '' }, h('th', { text: r.label }), SHOW_YEARS.map(y => cell(a[yi(y)], b[yi(y)], r)))); }
    if ($('#details').checked) for (const [grp, rows] of detailRows) {
      tb.append(h('tr', { class: 'grp' }, h('th', { text: grp, colspan: 9 })));
      for (const [rw, label] of rows) tb.append(h('tr', {}, h('th', { text: label }), SHOW_YEARS.map(y => cell(out.rows[rw][yi(y)] || 0, baseOut.rows[rw][yi(y)] || 0, {}))));
    }
    tbl.append(tb);
  }

  // ---------- Szenarien speichern / laden / teilen ----------
  function diffState() { return { L: JSON.parse(JSON.stringify(L)), ui: JSON.parse(JSON.stringify(ui)), name: $('#scenario-name').value }; }
  function loadState(s) { if (!s) return; L = Object.assign(M.defaultLevers(DATA), s.L || {}); L.projects = (s.L && s.L.projects) || {}; ui = Object.assign(JSON.parse(JSON.stringify(uiDefaults)), s.ui || {}); if (s.name) $('#scenario-name').value = s.name; syncPanel(); recompute(); }
  function saveHash() { try { const s = diffState(); const changed = JSON.stringify(s.L) !== JSON.stringify(base) || JSON.stringify(s.ui) !== JSON.stringify(uiDefaults); history.replaceState(null, '', changed ? '#s=' + btoa(unescape(encodeURIComponent(JSON.stringify(s)))) : location.pathname + location.search); } catch (e) { /* ignore */ } }
  function readHash() { try { const m = location.hash.match(/#s=(.+)/); if (m) return JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { /* ignore */ } return null; }
  function scenarios() { try { return JSON.parse(localStorage.getItem('fipla.szenarien') || '{}'); } catch (e) { return {}; } }
  function renderScenarioList() { const sel = $('#scenario-list'); sel.textContent = ''; sel.append(h('option', { value: '', text: 'Gespeicherte Szenarien …' })); for (const n of Object.keys(scenarios())) sel.append(h('option', { value: n, text: n })); }

  function bindToolbar() {
    $('#reset').addEventListener('click', () => { L = M.defaultLevers(DATA); ui = JSON.parse(JSON.stringify(uiDefaults)); $('#scenario-name').value = ''; syncPanel(); recompute(); toast('Zurückgesetzt auf den Finanzplan'); });
    $('#save').addEventListener('click', () => { const name = $('#scenario-name').value.trim() || 'Szenario ' + new Date().toLocaleDateString('de-CH'); const all = scenarios(); all[name] = diffState(); try { localStorage.setItem('fipla.szenarien', JSON.stringify(all)); } catch (e) { toast('Speichern nicht möglich (Browser-Speicher gesperrt)'); return; } $('#scenario-name').value = name; renderScenarioList(); toast('Gespeichert: ' + name); });
    $('#scenario-list').addEventListener('change', (e) => { const s = scenarios()[e.target.value]; if (s) { loadState(s); toast('Geladen: ' + e.target.value); } e.target.value = ''; });
    $('#share').addEventListener('click', async () => { saveHash(); try { await navigator.clipboard.writeText(location.href); toast('Link in die Zwischenablage kopiert'); } catch (e) { toast('Link steht in der Adresszeile bereit'); } });
    $('#export').addEventListener('click', () => { const blob = new Blob([JSON.stringify(diffState(), null, 1)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: (($('#scenario-name').value.trim() || 'szenario') + '.json').replace(/\s+/g, '_') }); document.body.append(a); a.click(); a.remove(); });
    $('#import').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { loadState(JSON.parse(r.result)); toast('Szenario importiert'); } catch (err) { toast('Datei konnte nicht gelesen werden'); } }; r.readAsText(f); e.target.value = ''; });
    $('#details').addEventListener('change', renderTable);
    $('#csv').addEventListener('click', () => { const lines = [['Zeile', ...SHOW_YEARS].join(';')]; for (const r of tableRows) lines.push([r.label, ...SHOW_YEARS.map(y => { const v = r.get(out)[yi(y)]; return r.pct ? (v * 100).toFixed(2) : v.toFixed(1); })].join(';')); const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }); const a = h('a', { href: URL.createObjectURL(blob), download: 'finanzplan_szenario.csv' }); document.body.append(a); a.click(); a.remove(); });
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderCharts, 120); });
  }
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 2400); }

  function renderBadges() {
    const changed = (keys) => keys.filter(k => JSON.stringify(getKey(k)) !== JSON.stringify(k.startsWith('ui.') ? uiDefaults[k.slice(3)] : getBase(k))).length;
    const counts = { steuern: changed(['ui.steuerfussVal', 'w_einkommen', 'w_vermoegen', 'w_jurpers', 'w_bevoelkerung']),
      aufwand: changed(['w_personal', 'w_sach', 'w_unterhalt', 'w_pflege', 'w_transfer', 'w_sozialhilfe', 'w_schueler', 'ui.sparVal', 'ui.mehrVal', 'ui.ertragVal']),
      invest: changed(['invest_scale.hochbau', 'invest_scale.tiefbau', 'ui.uebrige', 'ui.zusatzInvVal']) + Object.values(L.projects).filter(p => p.on === false || (p.shift || 0) > 0).length,
      finanz: changed(['passivzins', 'abschr.hochbau', 'abschr.tiefbau']),
      annahmen: changed(['korr_sachaufwand', 'globalbilanz', 'korr_sozialhilfe_2029', 'korr_unterhalt_2028', 'finanzertrag_2028', 'miete_stoffelmatte', 'tellspiele']) };
    for (const [k, n] of Object.entries(counts)) { const b = $('#badge-' + k); if (b) { b.textContent = n ? n + ' geändert' : ''; b.hidden = !n; } }
  }
  function render() { renderKpis(); renderLeitbild(); renderCharts(); renderTable(); renderBadges(); }

  // ---------- Start ----------
  buildPanel(); buildCharts(); bindToolbar(); renderScenarioList();
  const fromHash = readHash();
  if (fromHash) loadState(fromHash); else recompute();
})();
