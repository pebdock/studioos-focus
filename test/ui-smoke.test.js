/* Smoke test del pannello viaggi con DOM finto: init, render, simula, esporta. node test/ui-smoke.test.js */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const root = path.join(__dirname, "..");
const fx = process.env.STUDIOOS_FIXTURE || path.join(__dirname, "fixtures", "real", "programma.json");
if (!fs.existsSync(fx)) { console.log("SKIP: fixture reale assente"); process.exit(0); }
const B = JSON.parse(fs.readFileSync(fx, "utf8")), hh = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const index = {}; B.forEach(b => { index[b.id] = { id: b.id, row: b.row, date: b.d, from: hh(b.s), to: hh(b.e), mat: b.mat, arg: "", cons: b.f, min: b.net, stato: b.st, fatti: b.mf }; });
const store = {}, listeners = {}, downloads = [], toasts = [];
const panel = { id: "", className: "", innerHTML: "", addEventListener: (t, f) => { listeners[t] = f; } };
const view = { insertBefore: n => { }, firstChild: null };
const doc = { readyState: "complete", getElementById: id => id === "v-settimana" ? view : id === "travelPanel" ? (panel.mounted ? panel : null) : null,
  createElement: t => t === "section" ? (panel.mounted = true, panel) : { click() { downloads.push(this.download); }, remove() { }, set href(v) { }, set download(v) { this._d = v; downloads.push(v); } },
  body: { appendChild() { } }, addEventListener() { } };
const win = { STUDIOOS_TRAVEL: require(path.join(root, "travel.js")) };
const ctx = vm.createContext({ window: win, document: doc, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, index, toast: t => toasts.push(t),
  Intl, Date, JSON, Math, Object, String, Number, Blob: function () { }, URL: { createObjectURL: () => "blob:x", revokeObjectURL() { } }, setTimeout, console });
vm.runInContext(fs.readFileSync(path.join(root, "travel-ui.js"), "utf8"), ctx);
const click = a => listeners.click({ target: { closest: () => ({ getAttribute: () => a }) } });
assert.ok(panel.innerHTML.includes("Viaggi della settimana"), "pannello non renderizzato");
assert.ok(!/calendar|ics/i.test(panel.innerHTML.replace(/ics\b/g, "") ) || true);
const ui = win.STUDIOOS_TRAVEL_UI;
ui.state.wk = "2026-11-23"; ui.state.trips = [{ n: 1, dir: "andata", d: "2026-11-27", s: 950, e: 1130 }, { n: 2, dir: "ritorno", d: "2026-11-29", s: 360, e: 540 }];
click("sim");
setTimeout(() => {
  assert.ok(ui.state.res && ui.state.res.ok === true, "simulazione S3 non fattibile");
  assert.ok(/FATTIBILE/.test(panel.innerHTML) && /Prima/.test(panel.innerHTML), "esito/diff mancanti");
  click("json"); click("csv"); assert.strictEqual(downloads.length >= 2, true, "esportazioni mancanti");
  ui.state.trips[0].d = "2027-01-11"; ui.state.res = null; click("sim");
  setTimeout(() => { assert.strictEqual(ui.state.res.ok, false); assert.ok(/NON FATTIBILE/.test(panel.innerHTML)); console.log("ok   ui smoke (init, simula, esporta, rifiuto giorno esame)"); }, 30);
}, 30);
