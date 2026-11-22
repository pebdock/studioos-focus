/* scansiona ogni settimana S3..S14: coppie (andata, ritorno) con slot di default; stampa quante sono fattibili e la migliore */
const fs = require("fs"), T = require("../travel.js");
const B = JSON.parse(fs.readFileSync(__dirname + "/fixtures/real/programma.json", "utf8"));
const C = T.constants, wk = T.weeksTo("2027-02-14");
const only = process.argv[2] ? process.argv.slice(2).map(Number) : null;
wk.forEach((w, i) => {
  if (only && !only.includes(i + 3)) return;
  const days = []; for (let k = 0; k < 7; k++) { const d = T.addDays(w.start, k); if (d <= C.LAST && !C.EXAM[d] && d !== "2026-11-23") days.push(d); }
  let ok = 0, tot = 0, best = null;
  for (let a = 0; a < days.length; a++) for (let b = a + 1; b < days.length; b++) {
    tot++;
    const trips = [{ n: 1, d: days[a], s: 950, e: 1130 }, { n: 2, d: days[b], s: 360, e: 540 }];
    const r = T.simulate(B, trips);
    if (r.ok) { ok++; if (!best || r.moves.length < best.n) best = { n: r.moves.length, a: days[a].slice(5), b: days[b].slice(5), m: r.mode }; }
  }
  console.log("S" + (i + 3), w.start.slice(5), "fattibili", ok + "/" + tot, best ? "migliore " + best.a + "+" + best.b + " mosse " + best.n + " " + best.m : "nessuna");
});
