/* Test del motore viaggi dinamici (travel.js). Esecuzione: node test/travel.test.js
 * Fixture reale (privata, ignorata da git): test/fixtures/real/programma.json oppure env STUDIOOS_FIXTURE. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const root = path.join(__dirname, "..");
const fixture = process.env.STUDIOOS_FIXTURE || path.join(__dirname, "fixtures", "real", "programma.json");
if (!fs.existsSync(fixture)) { console.log("SKIP: fixture reale assente (" + fixture + ")"); process.exit(0); }
const TRAVEL = require(path.join(root, "travel.js"));
const PROGRESS = require(path.join(root, "progress.js"));
const ctx = vm.createContext({ console, setTimeout, clearTimeout }); ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(root, "prerequisites.js"), "utf8"), ctx);
const PRE = ctx.STUDIOOS_PREREQUISITES;
const BASE = JSON.parse(fs.readFileSync(fixture, "utf8"));
const clone = x => JSON.parse(JSON.stringify(x));
const hm = t => { const a = String(t).split(":").map(Number); return a[0] * 60 + a[1]; };
const active = bl => bl.filter(b => b.st !== "Rinviato");
const protectedBlock = b => b.st !== "Da iniziare" || b.mf > 0 || b.d <= "2026-11-24";

function parserPass(blocks) {
  let sp = 0, pp = 0, n = 0;
  for (const b of blocks) {
    if (b.st !== "Da iniziare") continue; n++;
    const st = PROGRESS.steps(b.f, b.net), tot = st.reduce((a, s) => a + PROGRESS.minutes(s), 0);
    const timed = st.filter(s => s.a && s.b);
    let chain = true;
    for (let i = 0; i < timed.length; i++) { if (hm(timed[i].b) <= hm(timed[i].a)) chain = false; if (i && hm(timed[i].a) < hm(timed[i - 1].b)) chain = false; }
    const inside = !timed.length || (hm(timed[0].a) >= b.s && hm(timed[timed.length - 1].b) <= b.e);
    if (st.some(s => !s.pause) && Math.abs(tot - b.net) < 0.5 && chain && inside) sp++;
    const r = PRE.parse(b.f);
    if (!/PREREQUISITI MIRATI/.test(b.f || "") || (r !== null && r.minutes >= 0)) pp++;
  }
  return { n, sp, pp };
}
function inversions(blocks) {
  let bad = 0;
  for (const m of new Set(blocks.map(b => b.mat))) {
    const seq = active(blocks).filter(b => b.mat === m && b.d >= "2026-11-23").sort((a, b) => a.row - b.row);
    for (let i = 1; i < seq.length; i++) if ((seq[i].d + String(seq[i].s).padStart(5, "0")) < (seq[i - 1].d + String(seq[i - 1].s).padStart(5, "0"))) bad++;
  }
  return bad;
}
const trip = (d1, a1, d2, a2) => [{ n: 1, dir: "andata", d: d1, s: hm(a1), e: hm(a1) + 180 }, { n: 2, dir: "ritorno", d: d2, s: hm(a2), e: hm(a2) + 180 }];

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log("ok   " + name); } catch (e) { fail++; console.log("FAIL " + name + "\n     " + String(e.message).split("\n")[0]); } }

/* ---- unit ---- */
test("shiftText sposta ogni HH:MM e conserva il resto", () => {
  assert.strictEqual(TRAVEL.shiftText("09:15–10:00 «A» (45') pausa 10:00–10:10 quota [10,20)", 75), "10:30–11:15 «A» (45') pausa 11:15–11:25 quota [10,20)");
});
test("shiftText fuori dal giorno -> errore", () => {
  assert.throws(() => TRAVEL.shiftText("23:00–23:30", 120));
});
test("viaggio su giorno esame -> rifiutato senza modifiche", () => {
  const r = TRAVEL.simulate(clone(BASE), trip("2027-01-11", "15:50", "2027-01-12", "06:00"));
  assert.strictEqual(r.ok, false); assert.strictEqual(r.moves.length, 0);
  assert.ok(r.unresolved.some(u => /esame/i.test(u.reason)));
});
test("giorni di febbre 23–24/11 (piani D-052/D-053): vuoti, e il motore non vi sposta studio", () => {
  assert.ok(!BASE.some(b => b.d < "2026-11-25" && b.st === "Da iniziare"), "nessun blocco da iniziare prima del 25/11");
  const r = TRAVEL.simulate(clone(BASE), trip("2026-11-27", "15:50", "2026-11-29", "06:00"));
  assert.ok(!r.moves.some(m => m.to.d < "2026-11-25"), "spostato verso i giorni di febbre");
});
test("nessun viaggio in collisione -> zero spostamenti", () => {
  const r = TRAVEL.simulate(clone(BASE), trip("2026-11-28", "06:00", "2026-11-29", "06:00").slice(0, 0));
  assert.strictEqual(r.moves.length, 0); assert.strictEqual(r.ok, true);
});

/* ---- 5 scenari reali ---- */
/* D-051/D-052: viaggi fino all'ultimo (15 o 18/12); dopo, a Cesena solo nei giorni d'esame (già nel piano) */
const SCEN = [
  ["S3  27/11 + 29/11", trip("2026-11-27", "15:50", "2026-11-29", "06:00")],
  ["S4  04/12 + 06/12", trip("2026-12-04", "15:50", "2026-12-06", "06:00")],
  ["S5  09/12 + 11/12", trip("2026-12-09", "15:50", "2026-12-11", "06:00")],
  ["S6  11/12 + 13/12", trip("2026-12-11", "15:50", "2026-12-13", "06:00")],
  ["S15 ultimo viaggio mar 15/12", trip("2026-12-15", "15:50", "2026-12-15", "15:50").slice(0, 1)],
  ["S18 ultimo viaggio ven 18/12", trip("2026-12-18", "15:50", "2026-12-18", "15:50").slice(0, 1)],
];
/* dopo l'ultimo viaggio: rifiuto sicuro, piano invariato */
const AFTER = [
  ["S7  24/12 + 26/12 (festivi)", trip("2026-12-24", "15:50", "2026-12-26", "06:00")],
  ["S11 appello BD 20/01 + 23/01", trip("2027-01-20", "15:50", "2027-01-23", "06:00")],
  ["S12 fine gennaio 28/01 + 31/01", trip("2027-01-28", "15:50", "2027-01-31", "06:00")],
  ["S14 13/02 + 14/02 (vigilia MN)", trip("2027-02-13", "15:50", "2027-02-14", "06:00")],
];
for (const [name, trips] of AFTER) {
  test("dopo l'ultimo viaggio (rifiuto sicuro) " + name, () => {
    const r = TRAVEL.simulate(clone(BASE), trips);
    assert.strictEqual(r.ok, false); assert.strictEqual(r.moves.length, 0);
    assert.deepStrictEqual(r.blocks.map(b => [b.id, b.d, b.s, b.e, b.f]), BASE.map(b => [b.id, b.d, b.s, b.e, b.f]));
    assert.ok(r.unresolved.length > 0 && r.unresolved.every(u => /ultimo viaggio|esame/.test(u.reason)));
    assert.strictEqual(TRAVEL.validate(r.blocks, []).violations.length, 0);
    assert.strictEqual(inversions(r.blocks), 0);
  });
}
/* settimana piena: il motore rifiuta senza toccare il piano e riporta il margine */
test("infattibile (rifiuto sicuro) S9 tratte lunghe 07/12 + 08/12", () => {
  const trips = [{ n: 1, dir: "andata", d: "2026-12-07", s: 420, e: 1380 }, { n: 2, dir: "ritorno", d: "2026-12-08", s: 420, e: 1380 }];
  const r = TRAVEL.simulate(clone(BASE), trips);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.moves.length, 0);
  assert.deepStrictEqual(r.blocks.map(b => [b.id, b.d, b.s, b.e, b.f]), BASE.map(b => [b.id, b.d, b.s, b.e, b.f]));
  assert.ok(r.unresolved.length > 0 && r.margins.every(m => Number.isFinite(m.marginMin)));
});
for (const [name, trips] of SCEN) {
  test("scenario " + name, () => {
    const before = clone(BASE);
    const r = TRAVEL.simulate(clone(BASE), trips);
    assert.strictEqual(r.ok, true, "ok=false: " + JSON.stringify(r.unresolved.slice(0, 2)) + " viol:" + r.violations.length);
    const after = r.blocks, v = TRAVEL.validate(after, trips);
    assert.strictEqual(v.violations.length, 0, "violazioni: " + JSON.stringify(v.violations.slice(0, 3)));
    assert.strictEqual(inversions(after), 0, "inversioni propedeutiche");
    for (const b of before) if (protectedBlock(b)) {
      const a = after.find(x => x.id === b.id);
      assert.deepStrictEqual([a.d, a.s, a.e, a.f], [b.d, b.s, b.e, b.f], "protetto modificato " + b.id);
    }
    const sum = bl => active(bl).reduce((a, b) => a + b.net, 0);
    assert.strictEqual(sum(after), sum(before), "minuti netti cambiati");
    for (const d of ["2027-01-11", "2027-01-13", "2027-01-19", "2027-02-12", "2027-02-15"]) {
      const was = before.filter(b => b.d === d && b.st !== "Rinviato").length, now = after.filter(b => b.d === d && b.st !== "Rinviato").length;
      assert.ok(now <= was, "blocchi aggiunti in giorno esame " + d);
    }
    const pp = parserPass(after), p0 = parserPass(before);
    assert.deepStrictEqual([pp.sp, pp.pp], [pp.n, pp.n], "parser dopo spostamento");
    assert.strictEqual(pp.n, p0.n);
    assert.ok(r.moves.every(m => before.find(b => b.id === m.id).st === "Da iniziare"));
    assert.strictEqual(JSON.stringify(TRAVEL.simulate(clone(BASE), trips).moves), JSON.stringify(r.moves), "non deterministico");
  });
}
test("ripristino: applicare gli inversi riporta al piano originale", () => {
  const trips = SCEN[0][1], r = TRAVEL.simulate(clone(BASE), trips);
  const back = TRAVEL.restore(r.blocks, r.moves);
  assert.deepStrictEqual(back.map(b => [b.id, b.d, b.s, b.e, b.f]), BASE.map(b => [b.id, b.d, b.s, b.e, b.f]));
});
test("esporta patch CSV/JSON coerente con le mosse", () => {
  const trips = SCEN[0][1], r = TRAVEL.simulate(clone(BASE), trips);
  const p = TRAVEL.toPatch(r.moves, trips);
  assert.strictEqual(p.action, "applyTravelShift"); assert.strictEqual(p.moves.length, r.moves.length);
  assert.strictEqual(TRAVEL.toCsv(r.moves).trim().split("\n").length, r.moves.length + 1);
});

console.log("\n" + pass + " ok, " + fail + " falliti");
process.exit(fail ? 1 : 0);
