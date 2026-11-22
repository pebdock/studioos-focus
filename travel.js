/* STUDIOOS Focus - viaggi dinamici (D-040-R28). Solo Google Sheets, nessun Calendar.
 * Riflusso deterministico: sposta solo blocchi "Da iniziare" (mai Completato/Parziale/Min fatti>0, mai lun 23/11),
 * conserva l'ordine per materia (propedeuticita), pasti, pause >=10', riposo, giorni esame e scadenze appello. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.STUDIOOS_TRAVEL = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var W0 = "2026-11-23", LAST = "2027-02-14", FROZEN = { "2026-11-23": 1 };
  var EXAM = { "2027-01-11": 1, "2027-01-13": 1, "2027-01-19": 1, "2027-02-12": 1, "2027-02-15": 1 };
  var DEADLINE = { MDP: "2027-01-12", BD: "2027-01-18", RETI: "2027-01-31", OOP: "2027-02-11", MN: "2027-02-14" };
  var WIN = [[375, 1410], [375, 1410], [375, 1410], [375, 1410], [375, 1140], [450, 1140], [450, 1380]];
  var MEALS = [[40, 40], [40, 40], [40, 40], [40, 40], [40, 0], [60, 0], [60, 60]];
  var LUNCH = [690, 900], DINNER = [1080, 1290], PAUSE = 10, MAXNET = 840, MAXWEEK = 5100, NODES = 1500;

  function dow(d) { return (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7; }
  function addDays(d, n) { return new Date(new Date(d + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10); }
  function monday(d) { return addDays(d, -dow(d)); }
  function win(d) { var w = WIN[dow(d)], lo = w[0], hi = w[1]; if (EXAM[d]) lo = Math.max(lo, 840); if (d === "2027-01-10") hi = 825; return [lo, hi]; }
  function meals(d) { var m = MEALS[dow(d)]; return EXAM[d] && win(d)[0] >= 840 ? [0, m[1]] : m; }
  function restNeed(a) { var k = dow(a); return k === 4 || k === 5 ? 480 : 435; }
  function hh(t) { return (t < 600 ? "0" : "") + Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); }

  function shiftText(f, delta, lo, hi) {   /* lo/hi: sposta solo gli orari del blocco, non i riferimenti ad altri blocchi */
    return String(f == null ? "" : f).replace(/\b([01]\d|2[0-3]):([0-5]\d)\b/g, function (m, h, mi) {
      var t0 = (+h) * 60 + (+mi), t = t0 + delta;
      if ((lo != null && t0 < lo) || (hi != null && t0 > hi)) return m;
      if (t < 0 || t > 1439) throw new Error("orario fuori giornata: " + m + " " + (delta > 0 ? "+" : "") + delta);
      return hh(t);
    });
  }
  function isMovable(b) { return b.st === "Da iniziare" && !(b.mf > 0) && !FROZEN[b.d] && b.net > 0; }
  function isActive(b) { return b.st !== "Rinviato"; }
  function byTime(a, b) { return a.s - b.s || a.e - b.e; }

  function gapIn(items, lo, hi) {
    var best = 0, cur = lo, a = items.map(function (x) { return [x.s, x.e]; }).concat([[lo, lo], [hi, hi]]).sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
    for (var i = 0; i < a.length; i++) { if (a[i][0] > cur) best = Math.max(best, Math.min(a[i][0], hi) - cur); cur = Math.max(cur, a[i][1]); }
    return best;
  }
  /* violazioni interne a un giorno; items = blocchi studio + viaggi (t:true), ordinati per s */
  function dayErrors(d, items) {
    var out = [], w = win(d), m = meals(d), net = 0, i, x, y;
    for (i = 0; i < items.length; i++) { x = items[i]; if (!x.t) { net += x.net; if (x.s < w[0] || x.e > w[1]) out.push("finestra"); if (x.e - x.s < x.net) out.push("durata"); } }
    if (net > MAXNET) out.push("tetto_gg");
    for (i = 1; i < items.length; i++) { x = items[i - 1]; y = items[i]; if (y.s < x.e) out.push("sovrapposizione"); else if (y.s < x.e + PAUSE) out.push("pausa<10"); }
    if (m[0] && gapIn(items, LUNCH[0], LUNCH[1]) < m[0]) out.push("pranzo");
    if (m[1] && gapIn(items, DINNER[0], DINNER[1]) < m[1]) out.push("cena");
    return out;
  }
  function tripItems(trips) { return (trips || []).map(function (t) { return { id: "T" + t.n, d: t.d, s: t.s, e: t.e, t: true }; }); }
  function byDay(items) {
    var m = {};
    items.forEach(function (b) { (m[b.d] = m[b.d] || []).push(b); });
    Object.keys(m).forEach(function (k) { m[k].sort(byTime); });
    return m;
  }
  function restOk(m, d) {  /* riposo tra d e d+1 */
    var a = m[d], b = m[addDays(d, 1)];
    if (!a || !a.length || !b || !b.length) return true;
    return 1440 - a[a.length - 1].e + b[0].s >= restNeed(d);
  }

  function validate(blocks, trips) {
    var items = blocks.filter(function (b) { return isActive(b) && b.d >= W0; }).concat(tripItems(trips)), m = byDay(items), v = [], wk = {};
    Object.keys(m).sort().forEach(function (d) {
      dayErrors(d, m[d]).forEach(function (r) { v.push({ rule: r, d: d }); });
      if (!restOk(m, d)) v.push({ rule: "riposo", d: d });
      var k = monday(d); m[d].forEach(function (x) { if (!x.t) wk[k] = (wk[k] || 0) + x.net; });
    });
    Object.keys(wk).forEach(function (k) { if (wk[k] > MAXWEEK) v.push({ rule: "tetto_sett", d: k }); });
    return { violations: v, week: wk };
  }
  function inversions(blocks) {
    var bad = 0, mats = {};
    blocks.forEach(function (b) { if (isActive(b) && b.d >= W0) (mats[b.mat] = mats[b.mat] || []).push(b); });
    Object.keys(mats).forEach(function (k) {
      var q = mats[k].sort(function (a, b) { return a.row - b.row; });
      for (var i = 1; i < q.length; i++) if (q[i].d + hh(q[i].s) < q[i - 1].d + hh(q[i - 1].s)) bad++;
    });
    return bad;
  }
  function deadlineBad(blocks) {
    var last = {}, out = [];
    blocks.forEach(function (b) { if (isActive(b) && b.d >= W0 && (!last[b.mat] || b.d > last[b.mat])) last[b.mat] = b.d; });
    Object.keys(DEADLINE).forEach(function (k) { if (last[k] && last[k] > DEADLINE[k]) out.push({ rule: "scadenza", mat: k, d: last[k], max: DEADLINE[k] }); });
    return out;
  }

  /* riflusso: ripacchetta il giorno del viaggio e, se serve, sposta in coda (avanti) o in testa (indietro) i blocchi
     verso il giorno vicino, ripetendo. Ordine per materia = ordine di riga. */
  function plan(blocks, trips, mode) {
    var T = tripItems(trips), mov = blocks.filter(function (b) { return isActive(b) && isMovable(b); }).sort(function (a, b) { return a.row - b.row; });
    var fixedMap = byDay(blocks.filter(function (b) { return isActive(b) && !isMovable(b) && b.d >= W0; }).concat(T)), P0 = {}, fail = [];
    mov.forEach(function (b) { P0[b.id] = { d: b.d, s: b.s }; });
    function F(d) { return fixedMap[d] || []; }
    function cp(P) { var o = {}; Object.keys(P).forEach(function (k) { o[k] = { d: P[k].d, s: P[k].s }; }); return o; }
    function itemsOn(d, P) {
      var l = F(d).slice();
      mov.forEach(function (b) { var p = P[b.id]; if (p.d === d) l.push({ id: b.id, d: d, s: p.s, e: p.s + b.e - b.s, net: b.net, mat: b.mat }); });
      return l.sort(byTime);
    }
    function movOn(d, P) { return mov.filter(function (b) { return P[b.id].d === d; }); }
    function restSides(d, items, P) {
      var a = itemsOn(addDays(d, -1), P), b = itemsOn(addDays(d, 1), P);
      if (!items.length) return true;
      if (a.length && 1440 - a[a.length - 1].e + items[0].s < restNeed(addDays(d, -1))) return false;
      if (b.length && 1440 - items[items.length - 1].e + b[0].s < restNeed(d)) return false;
      return true;
    }
    function dayBad(d, P) { var it = itemsOn(d, P); return dayErrors(d, it).length > 0 || !restSides(d, it, P); }

    function pack(d, L, P) {
      var w = win(d), m = meals(d), Fd = F(d), nodes = 0, out = null;
      function conflict(c, span) { for (var i = 0; i < Fd.length; i++) if (c < Fd[i].e + PAUSE && c + span > Fd[i].s - PAUSE) return true; return false; }
      function starts(b, t, prevEnd) {
        var set = {}, arr = [], i, x;
        function add(v) { if (v >= t && !set[v]) { set[v] = 1; arr.push(v); } }
        arr.first = b.d === d && b.s >= t ? b.s : -1;
        add(t); if (prevEnd) { add(prevEnd + m[0]); add(prevEnd + m[1]); }
        for (i = 0; i < Fd.length; i++) { x = Fd[i]; add(x.e + PAUSE); add(x.e + m[0]); add(x.e + m[1]); }
        arr.sort(function (p, q) { return p - q; });
        if (arr.first >= 0) { arr = arr.filter(function (v) { return v !== arr.first; }); arr.unshift(b.s); }
        return arr;
      }
      function rec(placed, t, rem) {
        if (out || ++nodes > NODES) return !!out;
        if (!rem.length) {
          var items = Fd.concat(placed.map(function (p) { return { id: p.b.id, d: d, s: p.s, e: p.s + p.b.e - p.b.s, net: p.b.net, mat: p.b.mat }; })).sort(byTime);
          if (dayErrors(d, items).length || !restSides(d, items, P)) return false;
          out = placed.slice(); return true;
        }
        var seen = {}, i, j, b, cs, c, span, need = PAUSE * (rem.length - 1);
        for (i = 0; i < rem.length; i++) need += rem[i].e - rem[i].s;
        if (t + need > w[1]) return false;
        for (i = 0; i < rem.length; i++) {
          b = rem[i]; if (seen[b.mat]) continue; seen[b.mat] = 1; span = b.e - b.s;
          cs = starts(b, t, placed.length ? t - PAUSE : 0);
          for (j = 0; j < cs.length; j++) {
            c = cs[j]; if (c + span > w[1] || conflict(c, span)) continue;
            placed.push({ b: b, s: c });
            if (rec(placed, c + span + PAUSE, rem.filter(function (x) { return x !== b; }))) return true;
            placed.pop();
          }
        }
        return false;
      }
      return rec([], w[0], L.slice()) ? out : null;
    }

    function fits(d, L) {   /* capacita' grezza del giorno: finestra - pasti - viaggi/blocchi fissi >= somma spans + pause */
      var w = win(d), m = meals(d), k = (m[0] ? 1 : 0) + (m[1] ? 1 : 0), i, sp = 0, net = 0, Fd = F(d), n = Fd.length + L.length;
      for (i = 0; i < Fd.length; i++) { sp += Fd[i].e - Fd[i].s; if (!Fd[i].t) net += Fd[i].net; }
      for (i = 0; i < L.length; i++) { sp += L[i].e - L[i].s; net += L[i].net; }
      return net <= MAXNET && (w[1] - w[0]) - sp - PAUSE * Math.max(n - 1 - k, 0) - m[0] - m[1] >= 0;
    }
    function cascade(dir, d0, P) {
      var d = d0, spill = [], first = true;
      while (d <= LAST && d > W0) {
        if (EXAM[d] && !first) { d = addDays(d, dir); continue; }
        var L = movOn(d, P).concat(spill).sort(function (a, b) { return a.row - b.row; }), tail = [], sol = null;
        while (true) {
          sol = fits(d, L) ? pack(d, L, P) : null;
          if (sol || !L.length) break;
          tail = dir > 0 ? [L.pop()].concat(tail) : tail.concat([L.shift()]);
        }
        if (!sol) return spill.concat(tail).map(function (b) { return b.id; });
        movOn(d, P).forEach(function (b) { P[b.id] = { d: null, s: 0 }; });
        sol.forEach(function (x) { P[x.b.id] = { d: d, s: x.s }; });
        spill = tail;
        if (!spill.length) return [];
        spill.forEach(function (b) { P[b.id] = { d: null, s: 0 }; });
        first = false; d = addDays(d, dir);
      }
      return spill.map(function (b) { return b.id; });
    }
    var days = Object.keys(T.reduce(function (a, x) { a[x.d] = 1; return a; }, {})).sort();
    if (mode === "bwd") days.reverse();
    var P = cp(P0);
    days.forEach(function (td) {
      if (!dayBad(td, P)) return;
      var snap = cp(P), left;
      if (mode === "mix") {
        var P1 = cp(snap), P2 = cp(snap), l1 = cascade(1, td, P1), l2 = cascade(-1, td, P2);
        var n1 = Object.keys(P1).filter(function (k) { return P1[k].d !== P0[k].d || P1[k].s !== P0[k].s; }).length;
        var n2 = Object.keys(P2).filter(function (k) { return P2[k].d !== P0[k].d || P2[k].s !== P0[k].s; }).length;
        var pick1 = (l1.length < l2.length) || (l1.length === l2.length && n1 <= n2);
        left = pick1 ? l1 : l2; P = pick1 ? P1 : P2;
      } else left = cascade(mode === "bwd" ? -1 : 1, td, P);
      left.forEach(function (id) { fail.push({ id: id, reason: "nessuno slot valido (" + (mode === "bwd" ? "indietro" : mode === "mix" ? "misto" : "avanti") + ")" }); P[id] = { d: P0[id].d, s: P0[id].s }; });
    });
    var pos = {};
    mov.forEach(function (b) { var p = P[b.id]; if (p.d !== null && (p.d !== b.d || p.s !== b.s)) pos[b.id] = { d: p.d, s: p.s, e: p.s + b.e - b.s }; });
    return { pos: pos, fail: fail };
  }

  function applyPos(blocks, pos) {
    var moves = [], out = blocks.map(function (b) {
      var p = pos[b.id]; if (!p || (p.d === b.d && p.s === b.s)) return b;
      var n = {}; Object.keys(b).forEach(function (k) { n[k] = b[k]; });
      n.d = p.d; n.s = p.s; n.e = p.e; n.f = shiftText(b.f, p.s - b.s, b.s, b.e);
      moves.push({ id: b.id, row: b.row, mat: b.mat, from: { d: b.d, s: b.s, e: b.e }, to: { d: p.d, s: p.s, e: p.e }, f0: b.f, f: n.f });
      return n;
    });
    moves.sort(function (a, b) { return a.row - b.row; });
    return { blocks: out, moves: moves };
  }

  function simulate(blocks, trips) {
    trips = trips || [];
    var res = { ok: false, mode: null, moves: [], violations: [], unresolved: [], blocks: blocks, trips: trips };
    var i, t, bad = false;
    for (i = 0; i < trips.length; i++) {
      t = trips[i];
      if (EXAM[t.d]) { res.unresolved.push({ trip: t.n, reason: "giorno esame: nessun viaggio" }); bad = true; }
      else if (t.d < W0 || t.d > LAST) { res.unresolved.push({ trip: t.n, reason: "data fuori dal piano (23/11-14/02)" }); bad = true; }
      else if (!(t.e > t.s)) { res.unresolved.push({ trip: t.n, reason: "intervallo non valido" }); bad = true; }
    }
    if (bad) return res;
    var prot = blocks.filter(function (b) { return isActive(b) && !isMovable(b); }), protBad = [];
    tripItems(trips).forEach(function (x) {
      prot.forEach(function (b) { if (b.d === x.d && b.s < x.e + PAUSE && b.e > x.s - PAUSE) protBad.push({ trip: x.id, id: b.id, reason: "blocco protetto in collisione (" + b.st + ")" }); });
    });
    var best = null;
    ["fwd", "bwd", "mix"].forEach(function (mode) {
      if (mode === "mix" && best && best.score[0] === 0) return;
      var sw = plan(blocks, trips, mode), ap;
      try { ap = applyPos(blocks, sw.pos); } catch (e) { sw.fail.push({ reason: String(e.message) }); ap = { blocks: blocks, moves: [] }; }
      var v = validate(ap.blocks, trips).violations.concat(deadlineBad(ap.blocks)), inv = inversions(ap.blocks);
      var cand = { mode: mode, moves: ap.moves, blocks: ap.blocks, violations: v, inv: inv, fail: sw.fail };
      cand.score = [v.length + inv + sw.fail.length, ap.moves.length];
      if (!best || cand.score[0] < best.score[0] || (cand.score[0] === best.score[0] && cand.score[1] < best.score[1])) best = cand;
    });
    res.mode = best.mode; res.moves = best.moves; res.blocks = best.blocks; res.violations = best.violations;
    res.unresolved = protBad.concat(best.fail);
    if (best.inv) res.violations.push({ rule: "inversione_propedeutica", n: best.inv });
    res.ok = !res.violations.length && !res.unresolved.length;
    if (!res.ok) {   /* mai proporre un piano parziale: si resta sul piano originale e si riporta il margine */
      res.attempt = { mode: best.mode, moves: best.moves.length, violations: res.violations.length };
      res.moves = []; res.blocks = blocks;
      res.margins = trips.map(function (x) { return weekMargin(blocks, x.d); });
    }
    return res;
  }

  /* buffer fisico della settimana: somma del tempo libero dei giorni (finestra - blocchi - pasti - pause), esami e lun 23/11 esclusi */
  function weekMargin(blocks, anyDay) {
    var w0 = monday(anyDay), tot = 0, i, d, l, sp, k, m, hosts = 0;
    for (i = 0; i < 7; i++) {
      d = addDays(w0, i); if (d < W0 || d > LAST || EXAM[d] || FROZEN[d]) continue;
      l = blocks.filter(function (b) { return isActive(b) && b.d === d; }); m = meals(d); k = (m[0] ? 1 : 0) + (m[1] ? 1 : 0);
      sp = l.reduce(function (a, b) { return a + b.e - b.s; }, 0);
      var s = win(d)[1] - win(d)[0] - sp - m[0] - m[1] - PAUSE * Math.max(l.length - 1 - k, 0);
      if (s > 0) tot += s; if (s >= 190) hosts++;
    }
    return { week: w0, bufferMin: tot, needMin: 360, marginMin: tot - 360, hostDays: hosts };
  }
  function restore(blocks, moves) {
    var by = {}; moves.forEach(function (m) { by[m.id] = m; });
    return blocks.map(function (b) {
      var m = by[b.id]; if (!m) return b;
      var n = {}; Object.keys(b).forEach(function (k) { n[k] = b[k]; });
      n.d = m.from.d; n.s = m.from.s; n.e = m.from.e; n.f = m.f0; return n;
    });
  }
  function toPatch(moves, trips) {
    return { action: "applyTravelShift", version: "D-040-R28", trips: trips || [], moves: moves.map(function (m) { return { id: m.id, row: m.row, d: m.to.d, s: hh(m.to.s), e: hh(m.to.e), f: m.f, from: { d: m.from.d, s: hh(m.from.s), e: hh(m.from.e) } }; }) };
  }
  function q(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
  function toCsv(moves) {
    return ["id,riga,materia,data_da,inizio_da,fine_da,data_a,inizio_a,fine_a"].concat(moves.map(function (m) {
      return [m.id, m.row, m.mat, m.from.d, hh(m.from.s), hh(m.from.e), m.to.d, hh(m.to.s), hh(m.to.e)].map(q).join(",");
    })).join("\n") + "\n";
  }
  function weeksTo(lastDay) {
    var out = [], d = W0; while (d <= (lastDay || LAST)) { out.push({ start: d, end: addDays(d, 6) }); d = addDays(d, 7); } return out;
  }
  return { weekMargin: weekMargin, _plan: plan, _applyPos: applyPos, simulate: simulate, validate: validate, restore: restore, toPatch: toPatch, toCsv: toCsv, shiftText: shiftText,
    inversions: inversions, deadlineBad: deadlineBad, weeksTo: weeksTo, addDays: addDays, hh: hh, isMovable: isMovable,
    constants: { W0: W0, LAST: LAST, EXAM: EXAM, DEADLINE: DEADLINE, SLOT: 180 } };
});
