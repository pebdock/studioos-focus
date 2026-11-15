/* STUDIOOS · aggiornamento degli appelli pubblici senza PC (GitHub Actions, ogni 3 ore).
   Legge solo pagine pubbliche UniBo (corso di studio 8615 e pagine docente), con lo stesso
   parser del ponte del PC, e scrive appelli.json nel sito. Nessuna credenziale, nessun dato
   personale: niente prenotazioni, voti o carriera (quelli restano al ponte del PC). */
import fs from 'node:fs';
import * as AP from './appelli.mjs';

const OUT = process.argv[2] || 'appelli.json';
const now = new Date();
const iso = now.toISOString();
const romeDay = d => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Rome'}).format(d);
let prev = null;
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { prev = null; }

const r = await AP.fetchAll();
const had = !!(prev && Array.isArray(prev.items) && prev.items.length);
const ok = !(r.errors.length && (had || !r.items.length));   // una pagina non letta non cancella le date note
const items = ok ? r.items : (prev && prev.items) || [];
const prevItems = (prev && prev.items) || [];
const ev = AP.events({prev: prevItems, cur: items, todayIso: romeDay(now), prevEvents: (prev && prev.eventi) || []})
  .filter(e => e.kind !== 'prenotabile_almaesami')
  .map(e => ({...e, at: iso, msg: AP.message(e), silent: !had}));
const eventi = [...ev, ...((prev && prev.eventi) || [])].slice(0, 60);

const errStr = ok ? null : r.errors.length + '/' + r.pages + ' pagine non lette: ' + r.errors[0];
const same = prev && JSON.stringify(prev.items) === JSON.stringify(items) && !ev.length && (prev.error || null) === errStr;
const recent = prev && prev.checkedAt && now - Date.parse(prev.checkedAt) < 12 * 3600e3;
const changed = !(same && recent);   // si scrive se cambia qualcosa, e comunque ogni 12 ore (prova di vita)
const out = {
  v: 1,
  source: 'Pagine pubbliche UniBo · GitHub Actions ogni 3 ore',
  checkedAt: iso,
  changedAt: same && prev ? (prev.changedAt || prev.checkedAt) : iso,
  status: ok ? 'ok' : 'errore',
  error: errStr,
  items, eventi
};
if (changed) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({changed, status: out.status, items: items.length, nuoviEventi: ev.map(e => (e.silent ? '(silenzioso) ' : '') + e.msg), errors: r.errors}));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + changed + '\n');
