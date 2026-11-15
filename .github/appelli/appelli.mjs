/* STUDIOOS · appelli pubblici UniBo (pagine docente e pagina appelli del corso di studio).
   Solo pagine pubbliche, nessun accesso autenticato, nessuna iscrizione: legge date e finestre
   d'iscrizione per i sei insegnamenti del piano e calcola gli eventi da notificare. */

export const SUBJECTS = Object.freeze({
  MDP: {code: '77776', teacher: 'https://www.unibo.it/sitoweb/fabrizio.caselli/didattica?tab=appelli'},
  BD: {code: '10906', teacher: 'https://www.unibo.it/sitoweb/annalisa.franco/didattica?tab=appelli'},
  MN: {code: 'B2561', teacher: 'https://www.unibo.it/sitoweb/damiana.lazzaro/didattica?tab=appelli'},
  FIS: {code: '00405', teacher: 'https://www.unibo.it/sitoweb/luigi.guiducci3/didattica?tab=appelli'},
  OOP: {code: '70219', teacher: 'https://www.unibo.it/sitoweb/mirko.viroli/didattica?tab=appelli'},
  RETI: {code: '70226', teacher: 'https://www.unibo.it/sitoweb/franco.callegati/didattica?tab=appelli'}
});
export const CDS_URL = 'https://corsi.unibo.it/laurea/IngegneriaScienzeInformatiche/appelli';
export const ALMAESAMI_URL = 'https://almaesami.unibo.it/';
const MESI = {gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12};
const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù', Agrave: 'À', Egrave: 'È', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—'};
const pad = n => String(n).padStart(2, '0');

export function text(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10)) : (ENT[e] ?? m))
    .replace(/<[^>]+>/g, ' ')   /* tag arrivati come entità (&lt;a …&gt;) */
    .replace(/\s+/g, ' ').trim();
}
/* «14 gennaio 2027 ore 09:00» oppure «14/01/2027» */
export function parseDay(s) {
  const t = String(s || '').toLowerCase();
  let m = t.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (m && MESI[m[2]]) return `${m[3]}-${pad(MESI[m[2]])}-${pad(m[1])}`;
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
export function parseWhen(s) {
  const date = parseDay(s);
  const m = String(s || '').match(/ore\s+(\d{1,2})[:.](\d{2})/i);
  return {date, time: m ? `${pad(m[1])}:${m[2]}` : null};
}
export function parseWindow(s) {
  const t = String(s || '');
  const m = t.match(/dal\s+(.+?)\s+al\s+(.+)$/i);
  if (m) return {from: parseDay(m[1]), to: parseDay(m[2]), raw: t};
  return {from: null, to: null, raw: t};
}
function item(fields, code, name, teacher, source) {
  const when = parseWhen(fields['data e ora']);
  if (!when.date) return null;
  const win = parseWindow(fields['lista iscrizioni']);
  const corso = fields['corso'] || '';
  return {code, name, teacher: teacher || '', date: when.date, time: when.time, type: (fields['tipo prova'] || '').trim(),
    from: win.from, to: win.to, room: (fields['luogo'] || '').slice(0, 160), notes: (fields['note'] || '').slice(0, 300),
    cds: corso, component: fields['componente'] || '', source};
}

/* Pagina docente: <button …><span>CODICE - NOME</span> … <article class="course"><section><span>Etichetta:</span><p>valore</p></section>… */
export function parseTeacherPage(html, source) {
  const out = [];
  const re = /<button[^>]*aria-controls[^>]*>\s*<span>\s*([^<]+?)\s*<\/span>|<article class="course">([\s\S]*?)<\/article>/g;
  let cur = null, m;
  while ((m = re.exec(String(html)))) {
    if (m[1]) { const h = text(m[1]); const k = h.match(/^([A-Z0-9]{5})\s*-\s*(.+)$/); cur = k ? {code: k[1], name: k[2]} : null; continue; }
    if (!cur) continue;
    const fields = {};
    for (const s of m[2].matchAll(/<section>\s*<span>([^<]+?):?\s*<\/span>\s*<p>([\s\S]*?)<\/p>\s*<\/section>/g)) fields[text(s[1]).replace(/:$/, '').toLowerCase()] = text(s[2]);
    const it = item(fields, cur.code, cur.name, '', source);
    if (it) out.push(it);
  }
  return out;
}
/* Pagina del corso di studio: <h3 …><span class="code">CODICE</span> NOME <span class="docente">DOCENTE</span> … <table class="single-item"><tr><th>Etichetta:</th><td>valore</td></tr>… */
export function parseCdsPage(html, source) {
  const out = [];
  const re = /<span class="code">\s*([A-Z0-9]{5})\s*<\/span>([\s\S]*?)<span class="docente">([\s\S]*?)<\/span>|<table class="single-item">([\s\S]*?)<\/table>/g;
  let cur = null, m;
  while ((m = re.exec(String(html)))) {
    if (m[1]) { cur = {code: m[1], name: text(m[2]), teacher: text(m[3])}; continue; }
    if (!cur) continue;
    const fields = {};
    for (const r of m[4].matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) fields[text(r[1]).replace(/:$/, '').toLowerCase()] = text(r[2]);
    const it = item(fields, cur.code, cur.name, cur.teacher, source);
    if (it) out.push(it);
  }
  return out;
}

/* Solo i sei insegnamenti del piano; per le pagine docente si scartano appelli riservati ad altri corsi di studio. */
export function select(items) {
  const codes = new Map(Object.entries(SUBJECTS).map(([s, v]) => [v.code, s]));
  const seen = new Map();
  for (const it of items) {
    const subject = codes.get(it.code);
    if (!subject) continue;
    if (it.cds && !/ingegneria e scienze informatiche/i.test(it.cds)) continue;
    const key = [it.code, it.date, it.time || '', (it.type || '').toLowerCase()].join('|');
    const p = seen.get(key);
    seen.set(key, p ? {...p, teacher: p.teacher || it.teacher, room: p.room || it.room, notes: p.notes || it.notes,
      from: p.from || it.from, to: p.to || it.to, sources: [...new Set([...p.sources, it.source])]}
      : {...it, subject, key, sources: [it.source]});
  }
  return [...seen.values()].map(({source, cds, ...x}) => x)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')) || a.subject.localeCompare(b.subject));
}

export function windowState(it, todayIso) {
  if (!it.from || !it.to) return 'sconosciuta';
  if (todayIso < it.from) return 'non_aperta';
  if (todayIso > it.to) return 'chiusa';
  return 'aperta';
}

/* Eventi da notificare: nuove date, iscrizioni aperte, iscrizioni in chiusura (2 giorni) se non prenotato,
   attività diventata prenotabile in AlmaEsami. Ogni evento ha un id stabile: si notifica una sola volta. */
export function events({prev = [], cur = [], todayIso, booked = new Set(), prevBookable = [], bookable = [], prevEvents = []}) {
  const done = new Set(prevEvents.map(e => e.id));
  const out = [];
  const add = e => { if (!done.has(e.id)) { done.add(e.id); out.push(e); } };
  const prevKeys = new Set(prev.map(x => x.key));
  const firstRun = !prev.length;
  for (const it of cur) {
    if (it.date < todayIso) continue;
    const base = {subject: it.subject, code: it.code, date: it.date, time: it.time, type: it.type, from: it.from, to: it.to};
    if (!firstRun && !prevKeys.has(it.key)) add({id: 'nuova:' + it.key, kind: 'nuova_data', ...base});
    const st = windowState(it, todayIso);
    if (st === 'aperta' && !booked.has(it.code + '|' + it.date)) add({id: 'aperta:' + it.key, kind: 'iscrizioni_aperte', ...base});
    if (st === 'aperta' && it.to && daysBetween(todayIso, it.to) <= 2 && !booked.has(it.code + '|' + it.date)) add({id: 'chiude:' + it.key, kind: 'iscrizioni_in_chiusura', ...base});
  }
  const codes = new Map(Object.entries(SUBJECTS).map(([s, v]) => [v.code, s]));
  for (const c of bookable) if (codes.has(c) && !prevBookable.includes(c)) add({id: 'prenotabile:' + c + ':' + todayIso, kind: 'prenotabile_almaesami', subject: codes.get(c), code: c});
  return out;
}
export function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }

export function message(e) {
  const d = e.date ? e.date.split('-').reverse().join('/') : '';
  const w = e.to ? e.to.split('-').reverse().join('/') : '';
  switch (e.kind) {
    case 'nuova_data': return `${e.subject}: nuova data d'esame ${d}${e.time ? ' ' + e.time : ''}${e.type ? ' · ' + e.type : ''}`;
    case 'iscrizioni_aperte': return `${e.subject}: iscrizioni aperte per il ${d}${w ? ' (fino al ' + w + ')' : ''}`;
    case 'iscrizioni_in_chiusura': return `${e.subject}: iscrizioni per il ${d} chiudono il ${w} e non risulti prenotato`;
    case 'prenotabile_almaesami': return `${e.subject}: AlmaEsami segnala l'attività come prenotabile`;
    default: return e.subject + ': aggiornamento appelli';
  }
}

/* Lettura di rete (solo sul PC): pagine pubbliche, un tentativo per pagina, 30 s di limite. */
export async function fetchAll(fetchImpl = fetch) {
  const pages = [{url: CDS_URL, kind: 'cds'}, ...Object.values(SUBJECTS).map(v => ({url: v.teacher, kind: 'teacher'}))];
  const items = [], errors = [];
  for (const p of pages) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 30000);
      const r = await fetchImpl(p.url, {signal: ac.signal, headers: {'User-Agent': 'STUDIOOS-ponte/1.1 (uso personale, lettura appelli pubblici)', 'Accept-Language': 'it'}});
      clearTimeout(t);
      if (!r.ok) { errors.push(p.url + ' ' + r.status); continue; }
      const html = await r.text();
      items.push(...(p.kind === 'cds' ? parseCdsPage(html, p.url) : parseTeacherPage(html, p.url)));
    } catch (e) { errors.push(p.url + ' ' + String(e && e.message || e).slice(0, 80)); }
  }
  return {items: select(items), errors, pages: pages.length};
}
