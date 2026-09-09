// Finanzplan-Modell: Nachbau der Excel-Logik (ER Bilanz, Steuern, Fremdkapital, Investitionsrechnung).
// Alle Beträge in 1'000 CHF. Jahresindex i: 0 = 2021 ... 11 = 2032. Planjahre: 2027 (i=6) bis 2032 (i=11).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinanzModell = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const Y0 = 2021, N = 12, I_BUDGET = 6; // 2027 = Budgetjahr, ab 2028 Formeln

  // ---------- Standard-Stellhebel (entsprechen den Excel-Annahmen) ----------
  function defaultLevers(data) {
    const P = data.params, S = data.steuern;
    const years = [2027, 2028, 2029, 2030, 2031, 2032];
    const per = (v) => Object.fromEntries(years.map(y => [y, v]));
    return {
      steuerfuss: per(0.95),                    // Finanzleitbild!42
      w_einkommen: S[16].v[7],                  // Steuern!J16  2.5%
      w_vermoegen: S[17].v[7],                  // Steuern!J17  2.4%
      w_jurpers: S[36].v[7],                    // Steuern!J36  2.0% (übrige jur. Pers. + Statusges. + Kapitalsteuern)
      w_bevoelkerung: P[25].v[7],               // Parameter!J25 ~1.0%
      w_personal: P[30].v[7],                   // 2.5%
      w_sach: P[31].v[7],                       // 1.0%
      w_pflege: P[32].v[7],                     // 1.0%
      w_unterhalt: P[33].v[7],                  // 2.0% (Baulicher Unterhalt + Anschaffungen)
      w_transfer: P[34].v[7],                   // 2.0%
      w_sozialhilfe: P[35].v[7],                // 2.0%
      w_schueler: P[49].v[7],                   // 2.2% Schülerpauschale
      w_entschaedigung: P[47].v[7],             // 2.0% Entschädigungen Gemeinwesen
      w_beitraege: P[48].v[7],                  // 2.5% Beiträge eigene Rechnung
      nachtraege_np: P[38].v[7],                // 4% Steuernachträge nat. Pers.
      w_jurpers_vorjahre: P[40].v[7],           // 2%
      passivzins: P[13].v[7],                   // 1.5%
      abschr: { hochbau: P[5].v[7], tiefbau: P[6].v[7], mobilien: P[7].v[7], immateriell: P[8].v[7], informatik: P[9].v[7], invbeitr_mit: P[10].v[7], invbeitr_ohne: P[11].v[7] },
      // Einmalige Korrekturen (im Excel als Konstanten in den Formeln)
      korr_sachaufwand: true,       // -250/Jahr Finanzplankorrektur Sachaufwand (Zeile 12)
      korr_unterhalt_2028: true,    // -200 Baulicher Unterhalt 2028 (J10)
      korr_sozialhilfe_2029: true,  // -500 Sozialhilfe Altdorf und -500 Uri Nord 2029 (K32/K33)
      globalbilanz: true,           // Streichung Globalbilanzausgleich -650 bis 2030 (Zeile 70)
      miete_stoffelmatte: true,     // 50/100/100/100/100 ab 2029 (Zeile 11)
      finanzertrag_2028: true,      // Finanzertrag -1230 in 2028 (J59: einmaliger Effekt 2027 fällt weg)
      tellspiele: true,             // Zeile 31: 190/90/20/20/20
      // Investitionen
      invest_scale: { hochbau: 1, tiefbau: 1, mobilien: 1, immateriell: 1, informatik: 1, invbeitr_mit: 1, invbeitr_ohne: 1, beteiligungen: 1 },
      projects: {},                 // name -> {on: true/false, shift: 0..3}
      extra_invest: per(0),         // zusätzliche Investitionen (Hochbau) pro Jahr
      extra_aufwand: per(0),        // zusätzlicher Sachaufwand pro Jahr (z.B. neue Aufgabe)
      extra_ertrag: per(0),         // zusätzlicher Ertrag pro Jahr
      sparpaket: per(0),            // Entlastung Personal+Sachaufwand pro Jahr (negativ = Kürzung)
    };
  }

  // ---------- Investitionsrechnung ----------
  function computeInvest(data, L) {
    const cats = ['hochbau', 'tiefbau', 'mobilien', 'immateriell', 'informatik', 'invbeitr_mit', 'invbeitr_ohne', 'beteiligungen'];
    const inv = Object.fromEntries(cats.map(c => [c, new Array(N).fill(0)]));
    for (const g of data.invest.groups) {
      const pj = L.projects[g.name] || {};
      const on = pj.on !== false, shift = pj.shift || 0;
      for (let i = 0; i < N; i++) {
        let v = g.v[i];
        if (i >= I_BUDGET) {                        // nur Planjahre beeinflussbar
          if (!on) v = 0; else v *= (L.invest_scale[g.cat] ?? 1);
        }
        let ti = i;
        if (i >= I_BUDGET && on && shift) ti = i + shift;   // Verschiebung um ganze Jahre
        if (ti < N) inv[g.cat][ti] += v; // Verschiebung über 2032 hinaus fällt aus dem Planhorizont
      }
    }
    for (let i = I_BUDGET; i < N; i++) inv.hochbau[i] += (L.extra_invest[Y0 + i] || 0);
    const netto = new Array(N).fill(0);
    for (let i = 0; i < N; i++) for (const c of cats) netto[i] += inv[c][i];
    return { byCat: inv, netto };
  }

  // ---------- Steuern ----------
  function computeSteuern(data, L, bevWachstum) {
    const S = data.steuern;
    const g = (r) => S[r].v.slice();
    const eink = g(11), verm = g(12), kopf = g(13);
    const sf = new Array(N).fill(0).map((_, i) => i >= I_BUDGET ? L.steuerfuss[Y0 + i] : S[15].v[i]);
    for (let i = 7; i < N; i++) {
      eink[i] = eink[i - 1] * (1 + L.w_einkommen);
      verm[i] = verm[i - 1] * (1 + L.w_vermoegen);
      kopf[i] = kopf[i - 1] * (1 + bevWachstum[i]);
    }
    const natPers = new Array(N), einkSt = new Array(N), vermSt = new Array(N);
    for (let i = 0; i < N; i++) {
      if (i < 2) { natPers[i] = S[24].v[i]; continue; }
      einkSt[i] = Math.round(eink[i] * sf[i] * 10) / 10;
      vermSt[i] = Math.round(verm[i] * sf[i] * 10) / 10;
      natPers[i] = einkSt[i] + vermSt[i] + kopf[i];
    }
    // Juristische Personen: Zeilen 40..45 (Gewinnsteuern) + 47 (Kapitalsteuern); Steuerfuss jur. Pers. bleibt 0.95 (Steuern!31)
    const jurRows = [40, 41, 42, 43, 44, 45];
    const jur = Object.fromEntries(jurRows.map(r => [r, g(r)]));
    const kap = g(47);
    const sfJ = S[31].v;
    const growth = { 40: S[32].v, 41: S[33].v, 42: S[34].v, 43: S[35].v, 44: S[36].v, 45: S[36].v };
    for (let i = 7; i < N; i++) {
      for (const r of jurRows) {
        const w = (r === 44 || r === 45) ? L.w_jurpers : (growth[r][i] || 0);
        jur[r][i] = ((jur[r][i - 1] || 0) * (1 + w)) / sfJ[i - 1] * sfJ[i];
      }
      kap[i] = kap[i - 1] * (1 + L.w_jurpers);
    }
    const jurPers = new Array(N);
    for (let i = 0; i < N; i++) jurPers[i] = i < 2 ? S[48].v[i] : jurRows.reduce((a, r) => a + (jur[r][i] || 0), 0) + kap[i];
    return { natPers, jurPers, steuerfuss: sf, eink100: eink };
  }

  // ---------- Hauptmodell ----------
  function compute(data, L) {
    const E = data.er, P = data.params, y = (i) => Y0 + i;
    const v = (r) => E[r].v.map(x => (x == null ? 0 : x));
    const R = {};                                   // Ergebniszeilen, Index = Excel-Zeile ER Bilanz
    const rows = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 41, 43,
      46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 79,
      87, 88, 89, 90, 93, 94, 95, 96, 97, 98, 99, 101, 102, 104, 105, 110, 111, 112, 113, 116, 117, 118, 120];
    for (const r of rows) R[r] = v(r);

    // Bevölkerung
    const bev = P[24].v.slice(), bevW = P[25].v.slice();
    for (let i = 7; i < N; i++) { bevW[i] = L.w_bevoelkerung; bev[i] = bev[i - 1] * (1 + bevW[i]); }

    const inv = computeInvest(data, L);
    const st = computeSteuern(data, L, bevW);
    const A = L.abschr;
    const sum = (arr, a, b) => { let s = 0; for (let k = a; k <= b; k++) s += arr[k] || 0; return s; };

    // Fremdkapital: Zinsen Jahr i = bestehende Darlehen (Jahr i-1) + Neuverschuldung(i-1) * Passivzins(i-1)
    const fkBestand = data.fk.bestand, fkZins = data.fk.zins_bestand;   // Index 0 = 2021
    const passiv = P[13].v.slice();
    for (let i = 7; i < N; i++) passiv[i] = L.passivzins;

    const out = { years: [], erfolg: [], aufwand: [], ertrag: [], ek: [], nettoInv: inv.netto, nettoschuld1: [], nettoschuld2: [], nettoschuld1ProKopf: [],
      selbstfin: [], selbstfinGrad: [], selbstfinGrad5: [], selbstfinAnteil: [], zinsanteil: [], kapitaldienstanteil: [], schulden: [], abschreibungen: [], nettozinsen: [],
      steuernNP: [], steuernJP: [], steuerertrag: [], bev, steuerfuss: st.steuerfuss, finanzierung: [], ekFrei: [], ekReserve: [], nettoschuldQuote: [], laufenderErtrag: [] };

    for (let i = 0; i < N; i++) {
      const yr = y(i), plan = i >= 7, budget = i >= I_BUDGET;
      const prev = i - 1;
      if (plan) {
        // ---- Aufwand ----
        R[7][i] = R[7][prev] * (1 + L.w_personal);
        R[8][i] = R[8][prev] * (1 + L.w_sach);
        R[9][i] = R[9][prev] * (1 + L.w_unterhalt);
        R[10][i] = R[10][prev] * (1 + L.w_unterhalt) - (yr === 2028 && L.korr_unterhalt_2028 ? 200 : 0);
        R[11][i] = L.miete_stoffelmatte ? (yr === 2029 ? 50 : yr >= 2030 ? 100 : 0) : 0;
        R[12][i] = L.korr_sachaufwand ? -250 : 0;
        R[24][i] = R[24][prev] * (1 + P[16].v[i]);
        R[26][i] = R[26][prev] * (1 + L.w_transfer);
        R[30][i] = R[30][prev] * (1 + L.w_pflege);
        R[31][i] = L.tellspiele ? ({ 2028: 190, 2029: 90 }[yr] ?? 20) : 0;
        const sozKorr = (yr === 2029 && L.korr_sozialhilfe_2029) ? 500 : 0;
        R[32][i] = R[32][prev] * (1 + L.w_sozialhilfe) - sozKorr;
        R[33][i] = R[33][prev] * (1 + L.w_sozialhilfe) - sozKorr;
        R[34][i] = R[34][prev];                                   // Parameter!44 = 0
        R[35][i] = R[35][prev] * (1 + L.w_einkommen);
        R[36][i] = R[36][prev]; R[43][i] = R[43][prev];
        // ---- Ertrag ----
        R[47][i] = st.natPers[i] * L.nachtraege_np;
        R[48][i] = R[48][prev];
        R[49][i] = R[49][prev] * (1 + L.w_einkommen);             // Quellensteuern = Steuerwachstum
        R[51][i] = R[51][prev] * (1 + L.w_jurpers_vorjahre);
        R[52][i] = R[52][prev] * (1 + L.w_jurpers_vorjahre);
        R[53][i] = R[53][prev] * (1 + P[42].v[i]);
        R[54][i] = R[54][prev]; R[55][i] = R[55][prev] * (1 + L.w_sozialhilfe);
        R[57][i] = R[57][prev]; R[58][i] = R[58][prev];
        R[59][i] = R[59][prev] * (1 + P[43].v[i]) - (yr === 2028 && L.finanzertrag_2028 ? 1230 : 0);
        R[60][i] = R[60][prev]; R[61][i] = R[61][prev];
        R[62][i] = (R[62][i - 3] + R[62][i - 2] + R[62][i - 1]) / 3;
        R[63][i] = R[63][prev]; R[64][i] = R[64][prev]; R[65][i] = 0;
        R[66][i] = R[66][prev] * (1 + L.w_einkommen);
        R[67][i] = R[67][prev] * (1 + L.w_entschaedigung);
        R[68][i] = R[68][prev] * (1 + L.w_einkommen);
        R[69][i] = R[69][prev];
        R[70][i] = (L.globalbilanz && yr <= 2030) ? -650 : 0;
        R[71][i] = R[71][prev] * (1 + L.w_beitraege);
        R[72][i] = 0; R[73][i] = R[73][prev] * (1 + L.w_schueler);
        R[74][i] = R[36][i]; R[75][i] = 0; R[77][i] = 0; R[79][i] = R[43][i];
        // Sparpaket / Zusatzaufwand / Zusatzertrag
        R[8][i] += (L.extra_aufwand[yr] || 0) + (L.sparpaket[yr] || 0);
        R[58][i] += (L.extra_ertrag[yr] || 0);
      }
      if (budget) {
        R[46][i] = st.natPers[i]; R[50][i] = st.jurPers[i];
        R[56][i] = R[33][i];
        if (plan) {
          // Abschreibungen auf Bestand Vorjahr + Investitionen laufendes Jahr
          R[16][i] = R[93][prev] * A.hochbau;
          R[17][i] = (R[94][prev] + inv.byCat.hochbau[i]) * A.hochbau;
          R[18][i] = (R[95][prev] + inv.byCat.tiefbau[i]) * A.tiefbau;
          R[19][i] = (R[96][prev] + inv.byCat.mobilien[i]) * A.mobilien;
          R[20][i] = (R[97][prev] + inv.byCat.immateriell[i]) * A.immateriell;
          R[21][i] = R[101][prev] * A.hochbau;
          R[22][i] = (R[98][prev] + inv.byCat.informatik[i]) * A.informatik;
          R[28][i] = (R[99][prev] + inv.byCat.invbeitr_mit[i]) * A.invbeitr_mit;
          R[29][i] = (0 + inv.byCat.invbeitr_ohne[i]) * A.invbeitr_ohne;
          R[13][i] = [16, 17, 18, 19, 20, 21, 22].reduce((a, r) => a + R[r][i], 0);
          R[76][i] = R[118][prev] * A.hochbau;
          // Zinsen: Fremdkapital!52 des Vorjahres = Zinsen bestehende Darlehen(prev) + (Schuld(prev) - Bestand(prev)) * Passivzins(prev)
          const neu = R[110][prev] - (fkBestand[prev] || 0);
          R[23][i] = (fkZins[prev] || 0) + neu * passiv[prev];
        }
        // ---- Totale ----
        const aufwand = [7, 8, 9, 10, 11, 12, 13, 14].reduce((a, r) => a + (R[r][i] || 0), 0)
          + [23, 24, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 41, 43].reduce((a, r) => a + (R[r][i] || 0), 0);
        const ertrag = [46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 79].reduce((a, r) => a + (R[r][i] || 0), 0);
        const erfolg = ertrag - aufwand;
        // ---- Bilanz ----
        R[87][i] = R[87][prev]; R[88][i] = R[88][prev]; R[89][i] = R[89][prev]; R[90][i] = R[90][prev];
        R[93][i] = R[93][prev];                     // Grundstücke: im Excel ab 2027 konstant (Abschreibung Zeile 16 läuft separat)
        R[94][i] = R[94][prev] + inv.byCat.hochbau[i] - R[17][i];
        R[95][i] = R[95][prev] + inv.byCat.tiefbau[i] - R[18][i];
        R[96][i] = R[96][prev] + inv.byCat.mobilien[i] - R[19][i];
        R[97][i] = R[97][prev] + inv.byCat.immateriell[i] - R[20][i];
        R[98][i] = R[98][prev] + inv.byCat.informatik[i] - R[22][i];
        R[99][i] = R[99][prev] + inv.byCat.invbeitr_mit[i] - R[28][i];
        R[101][i] = R[101][prev] - R[21][i];
        R[102][i] = R[102][prev]; R[104][i] = 0; R[105][i] = R[105][prev];
        const aktiven = [87, 88, 89, 90, 93, 94, 95, 96, 97, 98, 99, 101, 102, 104, 105].reduce((a, r) => a + (R[r][i] || 0), 0);
        R[111][i] = 0; R[112][i] = R[112][prev]; R[113][i] = R[113][prev];
        R[116][i] = R[116][prev]; R[117][i] = R[117][prev];
        R[118][i] = R[118][prev] - R[76][i];
        R[120][i] = R[120][prev] + erfolg;
        R[110][i] = aktiven - [111, 112, 113, 116, 117, 118, 120].reduce((a, r) => a + R[r][i], 0);   // Restgrösse: Schulden
        out.aufwand[i] = aufwand; out.ertrag[i] = ertrag; out.erfolg[i] = erfolg;
      } else {
        out.aufwand[i] = E[6].v[i]; out.ertrag[i] = E[45].v[i]; out.erfolg[i] = E[81].v[i];
      }
      // ---- Finanzierung & Kennzahlen (alle Jahre) ----
      out.years[i] = yr;
      out.steuernNP[i] = R[46][i]; out.steuernJP[i] = R[50][i];
      out.steuerertrag[i] = R[46][i] + R[50][i];
      out.ek[i] = R[120][i];
      out.schulden[i] = R[110][i];
      const abschr = R[13][i] + R[14][i] + R[28][i] + R[29][i];
      const entnahmen = R[75][i] + R[77][i] + R[76][i] + R[63][i];
      out.abschreibungen[i] = abschr;
      out.selbstfin[i] = out.erfolg[i] + abschr + 0 + 0 - entnahmen;
      out.finanzierung[i] = out.selbstfin[i] - inv.netto[i];
      out.selbstfinGrad[i] = inv.netto[i] ? out.selbstfin[i] / inv.netto[i] : 0;
      out.selbstfinGrad5[i] = i >= 4 ? sum(out.selbstfin, i - 4, i) / sum(inv.netto, i - 4, i) : null;
      out.laufenderErtrag[i] = [46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73].reduce((a, r) => a + (R[r][i] || 0), 0);
      out.selbstfinAnteil[i] = out.selbstfin[i] / out.laufenderErtrag[i];
      out.nettozinsen[i] = R[23][i] - R[60][i];
      out.zinsanteil[i] = out.nettozinsen[i] / out.laufenderErtrag[i];
      out.kapitaldienstanteil[i] = (out.nettozinsen[i] + abschr) / out.laufenderErtrag[i];
      const fk = R[110][i] + R[111][i] + R[112][i] + R[113][i], fv = R[87][i] + R[88][i] + R[89][i] + R[90][i];
      out.nettoschuld1[i] = fk - fv; out.nettoschuld2[i] = fk - fv - R[105][i];
      out.nettoschuld1ProKopf[i] = out.nettoschuld1[i] * 1000 / bev[i];
      out.ekReserve[i] = out.steuerertrag[i] * 0.2;
      out.ekFrei[i] = out.ek[i] - out.ekReserve[i];
      out.nettoschuldQuote[i] = out.nettoschuld1[i] / out.steuerertrag[i];
    }
    // Finanzleitbild Grundsatz 3: Selbstfinanzierung 5 J inkl. freies EK / Nettoinvestitionen 5 J
    out.selbstfinGrad5EK = out.years.map((_, i) => i >= 4 ? (sum(out.selbstfin, i - 4, i) + out.ekFrei[i]) / sum(inv.netto, i - 4, i) : null);
    out.rows = R; out.invest = inv; out.steuern = st;
    return out;
  }

  return { defaultLevers, compute, Y0, N, I_BUDGET };
});
