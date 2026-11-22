/* STUDIOOS Focus - pannello "Viaggi della settimana" (D-040-R28). Solo Google Sheets: nessun Calendar, nessun ICS.
 * Legge PROGRAMMA dall'indice gia' caricato da app.js, simula con STUDIOOS_TRAVEL, applica via Apps Script doPost
 * (action "applyTravelShift") oppure esporta la patch JSON/CSV. Nessun dato lascia il dispositivo se non verso il tuo script. */
(function () {
  "use strict";
  var T = window.STUDIOOS_TRAVEL;
  if (!T) return;
  var K = "sfocus.travel.v1", KC = "sfocus.travel.cfg", DAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
  var C = T.constants, state = { wk: null, trips: null, res: null, busy: false };

  function jget(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } }
  function mins(t) { var a = String(t).split(":"); return (+a[0]) * 60 + (+a[1]); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function it(d) { return d.slice(8) + "/" + d.slice(5, 7); }
  function mon(d) { var k = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7; return T.addDays(d, -k); }
  function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date()); }
  function say(t) { if (typeof toast === "function") toast(t, 4200); }
  function idx() { return typeof index !== "undefined" ? index : {}; }
  function blocks() {
    return Object.keys(idx()).map(function (k) { var b = idx()[k]; return { id: b.id, row: b.row, d: b.date, s: mins(b.from), e: mins(b.to), net: b.min, mat: b.mat, st: b.stato, mf: b.fatti, f: b.cons }; });
  }
  function defaults(wk) {
    var d1 = T.addDays(wk, 4), d2 = T.addDays(wk, 6);
    return [{ n: 1, dir: "andata", d: d1, s: 950, e: 1130 }, { n: 2, dir: "ritorno", d: d2, s: 360, e: 540 }];
  }
  function setWeek(wk) {
    var first = C.W0, last = mon(C.LAST);
    wk = wk < first ? first : wk > last ? last : wk;
    state.wk = wk; state.res = null;
    var saved = jget(K, {})[wk];
    state.trips = saved && saved.trips ? saved.trips : defaults(wk);
  }
  function persist() { var o = jget(K, {}), cur = o[state.wk] || {}; cur.trips = state.trips; o[state.wk] = cur; jset(K, o); }

  function simulate() {
    var bl = blocks();
    if (!bl.length) { state.res = { ok: false, unresolved: [{ reason: "PROGRAMMA non ancora caricato: aggiorna e riprova" }], moves: [], violations: [], margins: [] }; return state.res; }
    state.res = T.simulate(bl, state.trips); state.res.before = bl; return state.res;
  }
  function dayOpts(sel) {
    var o = "";
    for (var k = 0; k < 7; k++) { var d = T.addDays(state.wk, k), dis = d > C.LAST || d < C.W0 || C.EXAM[d]; o += '<option value="' + d + '"' + (d === sel ? " selected" : "") + (dis ? " disabled" : "") + ">" + DAYS[k] + " " + it(d) + (C.EXAM[d] ? " (esame)" : "") + "</option>"; }
    return o;
  }
  function tripRow(t) {
    var h = function (m) { return T.hh(m); };
    return '<div class="trv-row"><b>Viaggio ' + t.n + " · " + (t.dir === "andata" ? "Andata" : "Ritorno") + '</b>' +
      '<label>Giorno <select data-tf="d" data-n="' + t.n + '">' + dayOpts(t.d) + "</select></label>" +
      '<label>Inizio <input type="time" step="300" data-tf="s" data-n="' + t.n + '" value="' + h(t.s) + '"></label>' +
      '<label>Fine <input type="time" step="300" data-tf="e" data-n="' + t.n + '" value="' + h(t.e) + '"></label>' +
      '<span class="mute small">' + (t.e - t.s) + "′</span></div>";
  }
  function resultHtml() {
    var r = state.res; if (!r) return '<p class="mute small">Scegli 2 giorni e premi “Simula spostamento”: nulla viene scritto finché non premi “Applica su Sheets”.</p>';
    var h = "";
    if (r.ok) h += '<p class="trv-ok"><b>FATTIBILE</b> · ' + r.moves.length + " blocchi spostati (modalità " + esc(r.mode) + ") · 0 violazioni</p>";
    else {
      h += '<p class="trv-ko"><b>NON FATTIBILE</b> · il piano resta com’è.</p>';
      (r.unresolved || []).slice(0, 4).forEach(function (u) { h += '<p class="small">· ' + esc(u.reason || u.rule || "") + (u.id ? " (" + esc(u.id) + ")" : "") + "</p>"; });
      (r.margins || []).forEach(function (m, i, a) { if (!i || m.week !== a[i - 1].week) h += '<p class="small">Settimana ' + it(m.week) + ": buffer fisico " + m.bufferMin + "′ · richiesto " + m.needMin + "′ · margine " + (m.marginMin >= 0 ? "+" : "") + m.marginMin + "′ · giorni che ospitano un viaggio: " + m.hostDays + "</p>"; });
    }
    var chk = T.validate(r.blocks || [], state.trips), by = {};
    chk.violations.forEach(function (v) { by[v.rule] = (by[v.rule] || 0) + 1; });
    var rules = ["sovrapposizione", "pausa<10", "pranzo", "cena", "riposo", "tetto_gg", "tetto_sett", "finestra"], inv = T.inversions(r.blocks || []), dl = T.deadlineBad(r.blocks || []).length;
    h += '<p class="small">Vincoli: ' + rules.map(function (k) { return k + " " + (by[k] || 0); }).join(" · ") + " · inversioni propedeutiche " + inv + " · scadenze appello " + dl + "</p>";
    if (r.moves && r.moves.length) {
      h += '<table class="trv-diff"><thead><tr><th>Blocco</th><th>Prima</th><th>Dopo</th></tr></thead><tbody>';
      r.moves.slice(0, 60).forEach(function (m) { h += "<tr><td>" + esc(m.id) + " " + esc(m.mat) + "</td><td>" + it(m.from.d) + " " + T.hh(m.from.s) + "–" + T.hh(m.from.e) + "</td><td>" + it(m.to.d) + " " + T.hh(m.to.s) + "–" + T.hh(m.to.e) + "</td></tr>"; });
      h += "</tbody></table>"; if (r.moves.length > 60) h += '<p class="mute small">…e altri ' + (r.moves.length - 60) + " (nella patch esportata)</p>";
    }
    return h;
  }
  function render() {
    var box = document.getElementById("travelPanel"); if (!box) return;
    var cfg = jget(KC, {}), a = state.wk, b = T.addDays(a, 6);
    box.innerHTML = '<h3>Viaggi della settimana</h3><p class="mute small">2 giorni a scelta, fino al 15/02. Spostiamo solo blocchi “Da iniziare”; Completato, Parziale e Min fatti restano dove sono.</p>' +
      '<div class="trv-nav"><button class="btn ghost" data-ta="prev">◀</button><b>' + it(a) + "–" + it(b) + '</b><button class="btn ghost" data-ta="next">▶</button></div>' +
      state.trips.map(tripRow).join("") +
      '<div class="row trv-btn"><button class="btn" data-ta="sim">Simula spostamento</button><button class="btn" data-ta="apply"' + (state.res && state.res.ok ? "" : " disabled") + '>Applica su Sheets</button><button class="btn ghost" data-ta="restore">Ripristina viaggi</button></div>' +
      '<div class="row trv-btn"><button class="btn ghost" data-ta="json"' + (state.res && state.res.ok ? "" : " disabled") + '>Esporta patch JSON</button><button class="btn ghost" data-ta="csv"' + (state.res && state.res.ok ? "" : " disabled") + ">Esporta CSV</button></div>" +
      '<div id="trvOut" role="status" aria-live="polite">' + resultHtml() + "</div>" +
      '<details class="trv-cfg"><summary>Collegamento Apps Script (facoltativo)</summary><label>URL Web App <input id="trvUrl" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(cfg.url || "") + '"></label><label>Chiave <input id="trvTok" type="password" autocomplete="off" value="' + esc(cfg.token || "") + '"></label><p class="mute small">Senza questi due dati “Applica” non scrive: usa l’esportazione. Restano solo su questo dispositivo.</p></details>';
  }
  function download(name, text, type) {
    var u = URL.createObjectURL(new Blob([text], { type: type })), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  async function post(patch) {
    var cfg = jget(KC, {});
    if (!cfg.url || !cfg.token) throw new Error("Web App non configurata");
    var resp = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ token: cfg.token }, patch)) });
    var j = await resp.json(); if (!j || !j.ok) throw new Error((j && j.error) || "risposta non valida"); return j;
  }
  async function refreshIndex() { if (typeof loadIndex === "function") { try { await loadIndex(); } catch (e) { /* copia locale */ } } }
  async function apply() {
    if (state.busy) return; state.busy = true;
    try {
      await refreshIndex();
      var r = simulate();
      if (!r.ok) { render(); say("Non applicabile: ricontrolla la simulazione"); return; }
      var patch = T.toPatch(r.moves, state.trips), cfg = jget(KC, {});
      if (!cfg.url || !cfg.token) { say("Web App non configurata: esporta la patch"); render(); return; }
      var j = await post(patch), log = jget(K, {}); log[state.wk] = { trips: state.trips, moves: r.moves, at: Date.now() }; jset(K, log);
      await refreshIndex();
      var bad = r.moves.filter(function (m) { var b = idx()[m.id]; return !b || b.date !== m.to.d || b.from !== T.hh(m.to.s) || b.to !== T.hh(m.to.e); }).length;
      say(bad ? "Scritto, ma " + bad + " blocchi non coincidono alla rilettura: controlla PROGRAMMA" : "Applicato su Sheets e riletto: " + (j.updated || r.moves.length) + " blocchi");
      state.res = null; render();
    } catch (e) { say("Applicazione fallita: " + String(e.message || e).slice(0, 120)); } finally { state.busy = false; }
  }
  async function restore() {
    var log = jget(K, {}), cur = log[state.wk];
    if (cur && cur.moves && cur.moves.length) {
      var inv = cur.moves.map(function (m) { return { id: m.id, row: m.row, mat: m.mat, from: m.to, to: m.from, f0: m.f, f: m.f0 }; });
      var patch = T.toPatch(inv, []); patch.restore = true;
      try { await post(patch); delete log[state.wk]; jset(K, log); await refreshIndex(); say("Viaggi ripristinati: " + inv.length + " blocchi rimessi al posto originale"); }
      catch (e) { download("studioos-ripristino-" + state.wk + ".json", JSON.stringify(patch, null, 1), "application/json"); say("Ripristino non scritto (" + String(e.message || e).slice(0, 60) + "): patch inversa scaricata"); }
    } else say("Nessun viaggio applicato in questa settimana: tolti solo quelli salvati qui");
    var o = jget(K, {}); delete o[state.wk]; jset(K, o); setWeek(state.wk); render();
  }
  function onClick(e) {
    var a = e.target.closest && e.target.closest("[data-ta]"); if (!a) return;
    var k = a.getAttribute("data-ta");
    if (k === "prev") { setWeek(T.addDays(state.wk, -7)); render(); }
    else if (k === "next") { setWeek(T.addDays(state.wk, 7)); render(); }
    else if (k === "sim") { refreshIndex().then(function () { simulate(); render(); }); }
    else if (k === "apply") apply();
    else if (k === "restore") restore();
    else if (k === "json" && state.res && state.res.ok) download("studioos-viaggi-" + state.wk + ".json", JSON.stringify(T.toPatch(state.res.moves, state.trips), null, 1), "application/json");
    else if (k === "csv" && state.res && state.res.ok) download("studioos-viaggi-" + state.wk + ".csv", T.toCsv(state.res.moves), "text/csv");
  }
  function onChange(e) {
    var t = e.target, f = t.getAttribute && t.getAttribute("data-tf");
    if (t.id === "trvUrl" || t.id === "trvTok") { var c = jget(KC, {}); c[t.id === "trvUrl" ? "url" : "token"] = t.value.trim(); jset(KC, c); return; }
    if (!f) return;
    var tr = state.trips.filter(function (x) { return String(x.n) === t.getAttribute("data-n"); })[0]; if (!tr) return;
    if (f === "d") tr.d = t.value;
    else if (f === "s") { var len = tr.e - tr.s; tr.s = mins(t.value); tr.e = Math.min(1439, tr.s + len); }
    else tr.e = Math.max(tr.s + 5, mins(t.value));
    persist(); state.res = null; render();
  }
  function init() {
    var v = document.getElementById("v-settimana"); if (!v || document.getElementById("travelPanel")) return;
    var box = document.createElement("section"); box.id = "travelPanel"; box.className = "card trv"; v.insertBefore(box, v.firstChild);
    box.addEventListener("click", onClick); box.addEventListener("change", onChange);
    setWeek(mon(today())); render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.STUDIOOS_TRAVEL_UI = { render: render, state: state };
})();
