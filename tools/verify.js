// Vergleicht das JS-Modell mit den im Excel gespeicherten Werten (Basisszenario).
const M = require('../src/model.js');
const data = require('../src/data.json');
const L = M.defaultLevers(data);
const out = M.compute(data, L);
const E = data.er;
const checks = [
  ['Erfolg (81)', out.erfolg, E[81].v], ['Aufwand (6)', out.aufwand, E[6].v], ['Ertrag (45)', out.ertrag, E[45].v],
  ['Eigenkapital (120)', out.ek, E[120].v], ['Schulden (110)', out.schulden, E[110].v],
  ['Finanzaufwand (23)', out.rows[23], E[23].v], ['Abschreibungen (13)', out.rows[13], E[13].v],
  ['Steuern NP (46)', out.steuernNP, E[46].v], ['Steuern JP (50)', out.steuernJP, E[50].v],
  ['Nettoschuld I (143)', out.nettoschuld1, E[143].v], ['Selbstfin (138)', out.selbstfin, E[138].v],
  ['Hochbauten VV (94)', out.rows[94], E[94].v], ['Tiefbauten VV (95)', out.rows[95], E[95].v],
  ['SelbstfinGrad (149)', out.selbstfinGrad, E[149].v], ['NS I pro Kopf (154)', out.nettoschuld1ProKopf, E[154].v],
];
let bad = 0;
for (const [name, a, b] of checks) {
  const diffs = [];
  for (let i = 6; i < 12; i++) {
    const d = Math.abs((a[i] || 0) - (b[i] || 0));
    const tol = Math.max(0.6, Math.abs(b[i] || 0) * 0.0005);
    if (d > tol) { diffs.push(`${2021 + i}: js=${(a[i] || 0).toFixed(1)} xl=${(b[i] || 0).toFixed(1)}`); bad++; }
  }
  console.log((diffs.length ? 'FAIL ' : 'ok   ') + name.padEnd(22) + diffs.join(' | '));
}
console.log(bad ? `\n${bad} Abweichungen` : '\nAlle Werte 2027-2032 stimmen mit dem Excel überein.');
process.exit(bad ? 1 : 0);
