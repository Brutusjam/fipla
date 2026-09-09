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
  const T = (v) => fmtN(v) + ' T';

  // ---------- Infobox (Mausover / Fokus / Tippen) ----------
  const tipEl = h('div', { class: 'tip', role: 'tooltip', id: 'tip', hidden: '' });
  document.body.append(tipEl);
  let tipOwner = null;
  function showTip(btn) {
    tipOwner = btn; tipEl.textContent = ''; tipEl.append(btn._content()); tipEl.hidden = false;
    const r = btn.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), vw - tw - 8);
    let y = r.bottom + 8; if (y + th > vh - 8) y = Math.max(8, r.top - th - 8);
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  function hideTip() { tipEl.hidden = true; tipOwner = null; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  document.addEventListener('click', (e) => { if (tipOwner && !tipOwner.contains(e.target) && !tipEl.contains(e.target)) hideTip(); });
  window.addEventListener('scroll', () => { if (tipOwner) showTip(tipOwner); }, true);
  // content: Funktion, die ein DOM-Fragment liefert (wird bei jedem Öffnen neu aufgebaut, daher immer aktuelle Zahlen)
  function infoBtn(content, label) {
    const b = h('button', { class: 'info', type: 'button', 'aria-label': 'Berechnung: ' + (label || ''), 'aria-describedby': 'tip' }, 'i');
    b._content = content;
    b.addEventListener('mouseenter', () => showTip(b)); b.addEventListener('mouseleave', () => { if (!b._pinned) hideTip(); });
    b.addEventListener('focus', () => showTip(b)); b.addEventListener('blur', () => { b._pinned = false; hideTip(); });
    b.addEventListener('click', (e) => { e.stopPropagation(); if (tipOwner === b && b._pinned) { b._pinned = false; hideTip(); } else { b._pinned = true; showTip(b); } });
    return b;
  }
  // Bausteine für Infoboxen
  const box = (title, def, formula, calc, note) => h('div', { class: 'tip-in' }, h('b', { text: title }), def ? h('p', { text: def }) : null, formula ? h('code', { text: formula }) : null, calc ? h('p', { class: 'calc', text: calc }) : null, note ? h('p', { class: 'note-s', text: note }) : null);
  const at = (o, i) => ({ erg: o.erfolg[i], ab: o.abschreibungen[i], ent: o.rows[75][i] + o.rows[77][i] + o.rows[76][i] + o.rows[63][i], sf: o.selbstfin[i], inv: o.nettoInv[i], ek: o.ek[i], st: o.steuerertrag[i], ns: o.nettoschuld1[i], bev: o.bev[i], fk: o.rows[110][i] + o.rows[111][i] + o.rows[112][i] + o.rows[113][i], fv: o.rows[87][i] + o.rows[88][i] + o.rows[89][i] + o.rows[90][i] });
  const yrs = (a, b) => `${a}–${b}`;

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
    { id: 'c-erfolg', title: 'Ergebnis Erfolgsrechnung', sub: 'Ertragsüberschuss (+) oder Aufwandüberschuss (−), in 1\'000 CHF', get: (o) => o.erfolg, cmp: true, neg: true,
      info: (o) => box('Ergebnis Erfolgsrechnung', 'Gesamtertrag minus Gesamtaufwand pro Jahr (ER Bilanz, Zeile 81). Ab 2028 wachsen die Positionen vom Budget 2027 aus mit den gewählten Raten; Abschreibungen folgen den Investitionen, Zinsen der Verschuldung des Vorjahres.', 'Ergebnis = Σ Ertrag (Zeilen 46–79) − Σ Aufwand (Zeilen 7–43)', `2032: ${fmtN(o.ertrag[11])} − ${fmtN(o.aufwand[11])} = ${T(o.erfolg[11])}`) },
    { id: 'c-ek', title: 'Eigenkapital', sub: 'Bilanzüberschuss per Jahresende; Linie: Reserve von 20 % der Steuererträge (Finanzleitbild)', get: (o) => o.ek, cmp: true, line: (o) => ({ label: 'EK-Reserve 20 %', values: o.ekReserve }),
      info: (o) => box('Eigenkapital und Reserve', 'Das Eigenkapital verändert sich jedes Jahr um das Ergebnis. Die Linie zeigt die Reserve, die das Finanzleitbild verlangt.', 'EK(Jahr) = EK(Vorjahr) + Ergebnis(Jahr)\nReserve = 20 % × (Steuern nat. Pers. + jur. Pers.)', `2032: EK ${fmtN(o.ek[11])} gegenüber Reserve 0.2 × ${fmtN(o.steuerertrag[11])} = ${fmtN(o.ekReserve[11])}; freies EK = ${T(o.ekFrei[11])}`) },
    { id: 'c-nspk', title: 'Nettoschuld I pro Einwohner', sub: 'Fremdkapital abzüglich Finanzvermögen, in CHF pro Kopf', get: (o) => o.nettoschuld1ProKopf, cmp: true,
      info: (o) => { const a = at(o, 11); return box('Nettoschuld I pro Einwohner', 'Fremdkapital (Darlehen, IHG-Darlehen, übriges FK, Spezialfinanzierungen FK) abzüglich Finanzvermögen (Festgeld, Anlagen, Finanzliegenschaften, übriges FV), geteilt durch die Einwohnerzahl.', 'pro Kopf = (Fremdkapital − Finanzvermögen) × 1000 ÷ Einwohner', `2032: (${fmtN(a.fk)} − ${fmtN(a.fv)}) × 1000 ÷ ${fmtN(a.bev)} = CHF ${fmtN(a.ns * 1000 / a.bev)}`, 'Die Einwohnerzahl wächst mit dem gewählten Bevölkerungswachstum.'); } },
    { id: 'c-inv', title: 'Nettoinvestitionen und Selbstfinanzierung', sub: 'Szenario, in 1\'000 CHF. Selbstfinanzierung = Ergebnis + Abschreibungen', multi: (o) => [{ label: 'Nettoinvestitionen', values: pick(o.nettoInv), color: 'var(--s1)' }, { label: 'Selbstfinanzierung', values: pick(o.selbstfin), color: 'var(--s2)', neg: 'var(--crit)' }], legend: true,
      info: (o) => { const a = at(o, 11); return box('Nettoinvestitionen und Selbstfinanzierung', 'Ragt der blaue Balken über den orangen, muss die Differenz über neue Darlehen finanziert werden.', 'Selbstfinanzierung = Ergebnis + ordentliche Abschreibungen (inkl. Investitionsbeiträge) − Entnahmen aus Vorfinanzierungen\nFinanzierungsergebnis = Selbstfinanzierung − Nettoinvestitionen', `2032: ${fmtN(a.erg)} + ${fmtN(a.ab)} − ${fmtN(a.ent)} = ${fmtN(a.sf)}; ${fmtN(a.sf)} − ${fmtN(a.inv)} = ${T(a.sf - a.inv)}`); } },
    { id: 'c-sfg', title: 'Selbstfinanzierungsgrad über 5 Jahre', sub: 'inkl. freies Eigenkapital, Zielvorgabe 100 % (Finanzleitbild Grundsatz 3)', get: (o) => o.selbstfinGrad5EK, cmp: true, pct: true, thresholds: [{ value: 1, label: 'Ziel 100 %' }],
      info: (o) => { const sf5 = [7, 8, 9, 10, 11].reduce((a, k) => a + o.selbstfin[k], 0), in5 = [7, 8, 9, 10, 11].reduce((a, k) => a + o.nettoInv[k], 0); return box('Selbstfinanzierungsgrad über 5 Jahre', 'Rollend: Jeder Balken umfasst das Jahr und die vier Vorjahre (Finanzleitbild, Zeile 23).', 'Grad(Jahr) = (Σ Selbstfinanzierung der 5 Jahre + freies EK des Jahres) ÷ Σ Nettoinvestitionen der 5 Jahre', `2032: (${fmtN(sf5)} + ${fmtN(o.ekFrei[11])}) ÷ ${fmtN(in5)} = ${fmtP(o.selbstfinGrad5EK[11], 1)}`, 'Ohne freies Eigenkapital und ohne Rollung liegt der Grad 2027–2032 bei ' + fmtP(sumPlan(o.selbstfin) / sumPlan(o.nettoInv), 0) + ' (Kachel oben).'); } },
    { id: 'c-nsq', title: 'Nettoschuld I in % der Steuereinnahmen', sub: 'Zielgrösse 50 %, Maximum 100 % (Finanzleitbild Grundsatz 4)', get: (o) => o.nettoschuldQuote, cmp: true, pct: true, thresholds: [{ value: 0.5, label: 'Ziel 50 %' }, { value: 1, label: 'Max. 100 %' }],
      info: (o) => { const a = at(o, 11); return box('Nettoschuldquote', 'Nettoschuld I im Verhältnis zu den Steuereinnahmen des laufenden Jahres (Finanzleitbild, Zeilen 28–30).', 'Quote = (Fremdkapital − Finanzvermögen) ÷ (Steuern nat. Pers. + jur. Pers.)', `2032: ${fmtN(a.ns)} ÷ ${fmtN(a.st)} = ${fmtP(o.nettoschuldQuote[11], 1)}`); } },
    { id: 'c-schuld', title: 'Mittel- und langfristige Schulden', sub: 'Darlehensbestand per Jahresende, in 1\'000 CHF', get: (o) => o.schulden, cmp: true,
      info: (o) => box('Schulden', 'Restgrösse der Bilanz: Aktiven abzüglich übriges Fremdkapital und Eigenkapital (ER Bilanz, Zeile 110). Wirtschaftlich: Vorjahr plus Finanzierungsfehlbetrag.', 'Schulden(Jahr) ≈ Schulden(Vorjahr) + Nettoinvestitionen − Selbstfinanzierung\nZinsen(Jahr+1) = Zinsen bestehende Darlehen + (Schulden − Bestand bestehende Darlehen) × Zinssatz', `2032: ${fmtN(o.schulden[10])} + ${fmtN(o.nettoInv[11])} − ${fmtN(o.selbstfin[11])} ≈ ${T(o.schulden[11])}; Finanzaufwand 2032 = ${T(o.rows[23][11])}`) },
    { id: 'c-steuer', title: 'Steuererträge Rechnungsjahr', sub: 'Natürliche und juristische Personen, in 1\'000 CHF', get: (o) => o.steuerertrag, cmp: true,
      info: (o) => box('Steuererträge', 'Natürliche Personen: Einkommens- und Vermögenssteuern bei 100 % wachsen mit den gewählten Raten und werden mit dem Steuerfuss multipliziert; Kopfsteuern wachsen mit der Bevölkerung. Juristische Personen: Grossfirmen konstant, übrige mit der gewählten Rate, Steuerfuss 95 % (Blatt Steuern).', 'nat. Pers. = (Einkommen₁₀₀ + Vermögen₁₀₀) × Steuerfuss + Kopfsteuern\nEinkommen₁₀₀(Jahr) = Einkommen₁₀₀(Vorjahr) × (1 + Wachstum)', `2032: nat. Pers. ${fmtN(o.steuernNP[11])} + jur. Pers. ${fmtN(o.steuernJP[11])} = ${T(o.steuerertrag[11])} bei Steuerfuss ${(o.steuerfuss[11] * 100).toFixed(0)} %`) },
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
    { label: 'Kumuliertes Ergebnis 2027–2032', get: (o) => sumPlan(o.erfolg), fmt: (v) => fmtN(v) + ' T', up: true,
      info: (o) => box('Kumuliertes Ergebnis', 'Summe der Jahresergebnisse der Erfolgsrechnung über die sechs Planjahre.', 'Ergebnis = Gesamtertrag − Gesamtaufwand (ER Bilanz, Zeile 81)', PLAN_YEARS.map(y => `${y}: ${fmtN(o.erfolg[yi(y)])}`).join(' · ') + ` = ${T(sumPlan(o.erfolg))}`) },
    { label: 'Eigenkapital Ende 2032', get: (o) => o.ek[11], fmt: (v) => fmtN(v) + ' T', up: true,
      info: (o) => box('Eigenkapital', 'Bilanzüberschuss (Konto 299). Wächst jedes Jahr um das Ergebnis der Erfolgsrechnung.', 'EK(Jahr) = EK(Vorjahr) + Ergebnis(Jahr)', `EK 2026 ${fmtN(o.ek[5])} + Ergebnisse 2027–2032 ${fmtN(sumPlan(o.erfolg))} = ${T(o.ek[11])}`) },
    { label: 'Nettoschuld I pro Kopf 2032', get: (o) => o.nettoschuld1ProKopf[11], fmt: (v) => 'CHF ' + fmtN(v), up: false,
      info: (o) => { const a = at(o, 11); return box('Nettoschuld I pro Einwohner', 'Fremdkapital abzüglich Finanzvermögen, verteilt auf die Einwohner (ER Bilanz, Zeilen 143 und 154).', 'Nettoschuld I = Fremdkapital − Finanzvermögen; pro Kopf = Nettoschuld I × 1000 ÷ Einwohner', `(${fmtN(a.fk)} − ${fmtN(a.fv)}) × 1000 ÷ ${fmtN(a.bev)} Einw. = CHF ${fmtN(a.ns * 1000 / a.bev)}`); } },
    { label: 'Selbstfinanzierungsgrad 2027–2032', get: (o) => sumPlan(o.selbstfin) / sumPlan(o.nettoInv), fmt: (v) => fmtP(v, 0), up: true, pct: true,
      info: (o) => box('Selbstfinanzierungsgrad über den Planungshorizont', 'Welcher Anteil der Nettoinvestitionen 2027–2032 aus eigener Kraft finanziert wird. Summenbasiert, nicht der Durchschnitt der Jahreswerte.', 'Selbstfinanzierung = Ergebnis + ordentliche Abschreibungen − Entnahmen aus Vorfinanzierungen\nGrad = Σ Selbstfinanzierung ÷ Σ Nettoinvestitionen', `${fmtN(sumPlan(o.selbstfin))} ÷ ${fmtN(sumPlan(o.nettoInv))} = ${fmtP(sumPlan(o.selbstfin) / sumPlan(o.nettoInv), 1)}`, 'Entspricht dem Block „Selbstfinanzierung Finanzplan“ am Ende der Excel-Investitionsrechnung. Die Ampel im Finanzleitbild rechnet rollend über 5 Jahre und inkl. freiem Eigenkapital.') },
    { label: 'Nettoinvestitionen 2027–2032', get: (o) => sumPlan(o.nettoInv), fmt: (v) => fmtN(v) + ' T', up: null,
      info: (o) => box('Nettoinvestitionen', 'Summe aller Investitionstranchen der Investitionsrechnung abzüglich Beiträge Dritter, nach Ein/Aus, Skalierung und Verschiebung der Projekte.', 'Σ Hochbau + Tiefbau + Mobilien + immaterielle Anlagen + Informatik + Investitionsbeiträge', PLAN_YEARS.map(y => `${y}: ${fmtN(o.nettoInv[yi(y)])}`).join(' · ') + ` = ${T(sumPlan(o.nettoInv))}`) },
    { label: 'Schulden Ende 2032', get: (o) => o.schulden[11], fmt: (v) => fmtN(v) + ' T', up: false,
      info: (o) => box('Mittel- und langfristige Schulden', 'Darlehensbestand per Jahresende (Konto 201/206). Im Modell die Restgrösse, die die Bilanz ausgleicht: Was die Selbstfinanzierung nicht deckt, wird als Darlehen aufgenommen.', 'Schulden = Aktiven − übriges Fremdkapital − Eigenkapital\n≈ Schulden(Vorjahr) + Nettoinvestitionen − Selbstfinanzierung', `Schulden 2026 ${fmtN(o.schulden[5])} + Investitionen ${fmtN(sumPlan(o.nettoInv))} − Selbstfinanzierung ${fmtN(sumPlan(o.selbstfin))} ≈ ${T(o.schulden[11])}`, 'Neue Darlehen kosten im Folgejahr Zinsen zum gewählten Zinssatz.') },
  ];
  function renderKpis() {
    const row = $('#kpis'); row.textContent = '';
    for (const k of kpis) {
      const v = k.get(out), b = k.get(baseOut), d = v - b;
      let cls = 'flat'; if (Math.abs(d) > (k.pct ? 0.0005 : 0.5) && k.up != null) cls = (d > 0) === k.up ? 'good' : 'bad';
      row.append(h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, h('span', { text: k.label }), infoBtn(() => k.info(out), k.label)), h('div', { class: 'kpi-value', text: k.fmt(v) }),
        h('div', { class: 'kpi-delta ' + cls, text: Math.abs(d) < (k.pct ? 0.0005 : 0.5) ? 'wie Finanzplan' : (k.pct ? (d > 0 ? '+' : '−') + (Math.abs(d) * 100).toFixed(0) + ' Pp.' : fmtD(d) + ' T') + ' gegenüber Finanzplan' })));
    }
  }

  // ---------- Finanzleitbild ----------
  function renderLeitbild() {
    const tbl = $('#leitbild'); tbl.textContent = '';
    const o = out, rules = [
      { name: '1 · Ergebnis inkl. 20 % freies EK ≥ 0', get: (i) => o.erfolg[i] + 0.2 * o.ekFrei[i], fmt: (v) => fmtN(v) + ' T', state: (v) => v >= 0 ? 'good' : 'crit',
        info: () => { const i = 11; return box('Grundsatz 1: Erfolgsrechnung', 'Das Jahresergebnis darf negativ sein, solange 20 % des freien Eigenkapitals das Defizit decken (Finanzleitbild, Zeilen 8–10).', 'Wert = Ergebnis + 20 % × freies EK\nfreies EK = Eigenkapital − 20 % der Steuererträge', `2032: ${fmtN(o.erfolg[i])} + 0.2 × ${fmtN(o.ekFrei[i])} = ${T(o.erfolg[i] + 0.2 * o.ekFrei[i])}`, 'Grün ab 0, sonst rot.'); } },
      { name: '2 · Eigenkapital ≥ 20 % der Steuererträge', get: (i) => o.ek[i] / o.steuerertrag[i], fmt: (v) => fmtP(v, 0), state: (v) => v >= 0.2 ? 'good' : v >= 0.1 ? 'warn' : 'crit',
        info: () => { const i = 11; return box('Grundsatz 2: Eigenkapital', 'Als Reserve sollen mindestens 20 % der Steuererträge (nat. + jur. Personen, Rechnungsjahr) als Eigenkapital vorhanden sein (Finanzleitbild, Zeilen 14–17).', 'Quote = Eigenkapital ÷ (Steuern nat. Pers. + Steuern jur. Pers.)', `2032: ${fmtN(o.ek[i])} ÷ ${fmtN(o.steuerertrag[i])} = ${fmtP(o.ek[i] / o.steuerertrag[i], 1)}`, 'Grün ab 20 %, gelb ab 10 %, sonst rot.'); } },
      { name: '3 · Selbstfinanzierung 5 J. inkl. freies EK ≥ 100 %', get: (i) => o.selbstfinGrad5EK[i], fmt: (v) => fmtP(v, 0), state: (v) => v >= 1 ? 'good' : v >= 0.8 ? 'warn' : 'crit',
        info: () => { const i = 11, sf5 = [7, 8, 9, 10, 11].reduce((a, k) => a + o.selbstfin[k], 0), in5 = [7, 8, 9, 10, 11].reduce((a, k) => a + o.nettoInv[k], 0); return box('Grundsatz 3: Selbstfinanzierung', 'Über fünf Jahre sollen die Nettoinvestitionen aus Selbstfinanzierung und freiem Eigenkapital gedeckt sein, Zielvorgabe 100 % (Finanzleitbild, Zeile 23).', 'Grad = (Σ Selbstfinanzierung 5 J. + freies EK) ÷ Σ Nettoinvestitionen 5 J.\nSelbstfinanzierung = Ergebnis + Abschreibungen − Entnahmen Vorfinanzierungen', `2032 (Jahre 2028–2032): (${fmtN(sf5)} + ${fmtN(o.ekFrei[i])}) ÷ ${fmtN(in5)} = ${fmtP(o.selbstfinGrad5EK[i], 1)}`, 'Grün ab 100 %, gelb ab 80 %, sonst rot.'); } },
      { name: '4 · Nettoschuld I ≤ 50 % (Ziel) / 100 % (Max.) der Steuern', get: (i) => o.nettoschuldQuote[i], fmt: (v) => fmtP(v, 0), state: (v) => v <= 0.5 ? 'good' : v <= 1 ? 'warn' : 'crit',
        info: () => { const i = 11, a = at(o, i); return box('Grundsatz 4: Nettoschuld I', 'Die Nettoschuld soll höchstens die Steuereinnahmen eines Jahres betragen, Zielgrösse ist die Hälfte (Finanzleitbild, Zeilen 28–30).', 'Quote = (Fremdkapital − Finanzvermögen) ÷ (Steuern nat. Pers. + jur. Pers.)', `2032: (${fmtN(a.fk)} − ${fmtN(a.fv)}) ÷ ${fmtN(a.st)} = ${fmtP(o.nettoschuldQuote[i], 1)}`, 'Grün bis 50 %, gelb bis 100 %, sonst rot.'); } },
      { name: '5 · Steuerfuss ≤ Median Nachbargemeinden + 4 (97 %)', get: (i) => o.steuerfuss[i], fmt: (v) => (v * 100).toFixed(0) + ' %', state: (v) => v <= 0.97 ? 'good' : 'crit',
        info: () => box('Grundsatz 5: Steuerbelastung', 'Der Steuerfuss von Altdorf soll höchstens 4 Punkte über dem Median der Nachbargemeinden liegen (Finanzleitbild, Zeilen 34–42).', 'Maximum = Median(Schattdorf 91, Erstfeld 103, Silenen 105, Flüelen 93, Seedorf 90, Attinghausen 97, Bürglen 92) + 4 = 93 + 4 = 97 %', `Steuerfuss im Szenario: ${PLAN_YEARS.map(y => (o.steuerfuss[yi(y)] * 100).toFixed(0)).join(' / ')} %`, 'Grün bis 97 %, sonst rot. Die Nachbarwerte sind wie im Excel fix.') },
    ];
    tbl.append(h('thead', {}, h('tr', {}, h('th', { text: 'Grundsatz' }), PLAN_YEARS.map(y => h('th', { text: y })))));
    const tb = h('tbody', {});
    for (const r of rules) tb.append(h('tr', {}, h('th', {}, h('span', { text: r.name }), infoBtn(r.info, r.name)), PLAN_YEARS.map(y => { const v = r.get(yi(y)); return h('td', {}, h('span', { class: 'pill ' + r.state(v), text: r.fmt(v) })); })));
    tbl.append(tb);
  }

  // ---------- Tabelle ----------
  const tableRows = [
    { label: 'Gesamtaufwand', get: (o) => o.aufwand, info: 'Summe der Aufwandarten 30–39 (ER Bilanz, Zeile 6): Personal, Sach- und Betriebsaufwand, Abschreibungen, Finanzaufwand, Transferaufwand, durchlaufende Beiträge, interne Verrechnungen.' },
    { label: 'Gesamtertrag', get: (o) => o.ertrag, info: 'Summe der Ertragsarten 40–49 (ER Bilanz, Zeile 45): Steuern, Regalien, Entgelte, Finanzertrag, Transferertrag, durchlaufende Beiträge, interne Verrechnungen.' },
    { label: 'Ergebnis Erfolgsrechnung', get: (o) => o.erfolg, bold: true, neg: true, info: 'Gesamtertrag − Gesamtaufwand (ER Bilanz, Zeile 81).' },
    { label: 'Ordentliche Abschreibungen', get: (o) => o.abschreibungen, info: 'Abschreibungen Verwaltungsvermögen (Zeile 13) + Anlagen im Bau (14) + Investitionsbeiträge (28, 29). Degressiv auf Bestand Vorjahr plus Investitionen des Jahres: Hochbau 10 %, Tiefbau 7 %, Mobilien 50 %, immaterielle Anlagen 50 %, Informatik 60 %, Beiträge mit Rückforderung 10 %, ohne Rückforderung 100 %.' },
    { label: 'Selbstfinanzierung', get: (o) => o.selbstfin, info: 'Ergebnis + ordentliche Abschreibungen + a.o. Abschreibungen + Einlagen in Spezialfinanzierungen − Entnahmen aus Spezial-/Vorfinanzierungen (ER Bilanz, Zeile 138).' },
    { label: 'Nettoinvestitionen', get: (o) => o.nettoInv, info: 'Summe aller Investitionstranchen abzüglich Beiträge Dritter (Investitionsrechnung, Zeile 6), nach den gewählten Projekt-Schaltern.' },
    { label: 'Finanzierungsergebnis', get: (o) => o.finanzierung, bold: true, neg: true, info: 'Selbstfinanzierung − Nettoinvestitionen (ER Bilanz, Zeile 137). Negativ = Fehlbetrag, der über neue Darlehen finanziert wird.' },
    { label: 'Selbstfinanzierungsgrad', get: (o) => o.selbstfinGrad, pct: true, info: 'Selbstfinanzierung ÷ Nettoinvestitionen des Jahres (ER Bilanz, Zeile 149). Schwankt stark, weil einzelne Jahre wenig Investitionen haben.' },
    { label: 'Eigenkapital', get: (o) => o.ek, info: 'Bilanzüberschuss per Jahresende: Vorjahr + Ergebnis (ER Bilanz, Zeile 120).' },
    { label: 'Mittel- und langfristige Schulden', get: (o) => o.schulden, info: 'Darlehensbestand per Jahresende, als Restgrösse aus der Bilanz: Aktiven − übriges Fremdkapital − Eigenkapital (ER Bilanz, Zeile 110).' },
    { label: 'Nettoschuld I', get: (o) => o.nettoschuld1, info: 'Fremdkapital (Zeilen 109–113) − Finanzvermögen (Zeilen 87–90) (ER Bilanz, Zeile 143). Nettoschuld II zieht zusätzlich die Beteiligungen ab.' },
    { label: 'Nettoschuld I pro Kopf (CHF)', get: (o) => o.nettoschuld1ProKopf, info: 'Nettoschuld I × 1000 ÷ Einwohnerzahl (ER Bilanz, Zeile 154).' },
    { label: 'Nettozinsen', get: (o) => o.nettozinsen, info: 'Finanzaufwand (Zinsen, Zeile 23) − Zinsertrag (Zeile 60). Die Zinsen eines Jahres folgen aus dem Darlehensbestand am Ende des Vorjahres: bestehende Darlehen zu ihren Vertragszinsen, Neuverschuldung zum gewählten Zinssatz.' },
    { label: 'Zinsbelastungsanteil', get: (o) => o.zinsanteil, pct: true, d: 1, info: 'Nettozinsen ÷ laufender Ertrag (Ertrag ohne durchlaufende Beiträge, interne Verrechnungen und a.o. Erträge) (ER Bilanz, Zeile 152).' },
    { label: 'Steuererträge nat. Personen', get: (o) => o.steuernNP, info: '(Einkommenssteuern₁₀₀ + Vermögenssteuern₁₀₀) × Steuerfuss + Kopfsteuern (Blatt Steuern, Zeile 24). Ohne Nachträge, Quellensteuern und Vorjahre.' },
    { label: 'Steuererträge jur. Personen', get: (o) => o.steuernJP, info: 'Gewinnsteuern (Grossfirmen konstant, Statusgesellschaften und übrige mit gewählter Rate) + Kapitalsteuern, Steuerfuss jur. Personen 95 % (Blatt Steuern, Zeile 48).' },
    { label: 'Steuerfuss', get: (o) => o.steuerfuss, pct: true, d: 0, info: 'Steuerfuss natürliche Personen in % der einfachen Steuer. Bis 2026 gemäss Rechnung, ab dem gewählten Jahr gemäss Hebel.' },
    { label: 'Einwohner', get: (o) => o.bev, info: 'Bis 2027 gemäss Parameterblatt, danach Vorjahr × (1 + Bevölkerungswachstum).' },
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
    for (const r of tableRows) { const a = r.get(out), b = r.get(baseOut); tb.append(h('tr', { class: r.bold ? 'bold' : '' }, h('th', {}, h('span', { text: r.label }), infoBtn(() => box(r.label, r.info), r.label)), SHOW_YEARS.map(y => cell(a[yi(y)], b[yi(y)], r)))); }
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
