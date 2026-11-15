/* STUDIOOS Focus · adattatore della versione autonoma (PWA) · 1.1.0
 * Sostituisce window.claude.use("mcp" | "db" | "downloads") con le API Google chiamate dal browser.
 *
 * Sicurezza
 *  - Ambito OAuth predefinito: drive.file (non sensibile). L'app vede SOLO i fogli che scegli tu
 *    con il selettore Google (setup.html); sugli altri dispositivi li ritrova da sola.
 *  - Calendar è facoltativo e in sola lettura (calendar.readonly), chiesto solo se lo attivi.
 *  - Nessun segreto nel codice. Il Client ID OAuth è pubblico per natura. Gli ID dei fogli
 *    restano solo su questo dispositivo e non passano mai in un URL.
 *  - Scritture limitate per foglio, scheda, intervallo e valori (vedi WRITE_RULES).
 *  - Il token dura circa un'ora, resta su questo dispositivo e viene cancellato con «Disconnetti».
 */
(function () {
  "use strict";
  var VERSION = "pwa-1.5.0 · R13h.5";
  var CLIENT_ID = "588484343295-379le6qi7t5340nv4toi6vav0nqpg13q.apps.googleusercontent.com";
  var P = "sfocus.pwa.";
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(P + k); } catch (e) {} }
  };
  var S_FILE = "https://www.googleapis.com/auth/drive.file";
  var S_CAL = "https://www.googleapis.com/auth/calendar.readonly";
  var SH = "https://sheets.googleapis.com/v4/spreadsheets/";
  var DRV = "https://www.googleapis.com/drive/v3/files";
  var CAL = "https://www.googleapis.com/calendar/v3/";
  var TAB = "FOCUS_DB";
  var enc = encodeURIComponent;
  var RE_FILE = /^[\w-]{25,60}$/;
  var STATES = ["Da iniziare", "Affrontato", "Parziale", "Da consolidare", "Verificato autonomamente"];
  var DECISIONS = ["APPROVATA", "RIFIUTATA", "RISPOSTA", "LETTA"];

  /* ---------- configurazione locale (mai in un URL) ---------- */
  var CFG = ls.get("cfg2", null) || { readOnly: true };
  if (CFG.readOnly == null) CFG.readOnly = true;
  ls.del("cfg"); /* eventuale configurazione della 1.0 con link #cfg: non più usata */
  function saveCfg() {
    var previous = window.STUDIOOS_CFG && window.STUDIOOS_CFG.cal;
    ls.set("cfg2", CFG); window.STUDIOOS_CFG = { sheet: CFG.sheet || "", arch: CFG.arch || "", cal: CFG.calOn ? (CFG.cal || "") : "" };
    if(previous!==window.STUDIOOS_CFG.cal)window.dispatchEvent(new CustomEvent("studioos:calendar-config",{detail:{id:window.STUDIOOS_CFG.cal}}));
  }
  function configured() { return !!(CFG.sheet && CFG.arch); }
  window.STUDIOOS_PWA = true;
  window.STUDIOOS_DATA_PREFIX = window.STUDIOOS_SYNC.prefix(CFG);
  try { window.STUDIOOS_SYNC.migrate(localStorage, window.STUDIOOS_DATA_PREFIX); } catch (e) {}
  saveCfg();

  /* ---------- ritorno da Google (OAuth 2.0 per app web lato client, con redirect) ---------- */
  var h = location.hash || "";
  if (/[#&]cfg=/.test(h)) { history.replaceState(null, "", location.pathname + location.search); h = ""; }
  if (/[#&]access_token=/.test(h) || /[#&]error=/.test(h)) {
    var q = new URLSearchParams(h.slice(1)), st = ls.get("oauthState", null);
    ls.del("oauthState");
    if (q.get("access_token") && st && q.get("state") === st.nonce && Date.now() - (st.at || 0) < 15 * 60000) {
      var granted = (q.get("scope") || "").split(/\s+/);
      ls.set("tok", { t: q.get("access_token"), exp: Date.now() + (Number(q.get("expires_in") || 3600) - 120) * 1000, scope: granted });
      ls.del("authErr");
      if (granted.indexOf(S_FILE) < 0) ls.set("authErr", "Non hai concesso l'accesso ai file scelti: Focus non può leggere il piano.");
      else if (st.wantCal && granted.indexOf(S_CAL) < 0) { CFG.calOn = false; saveCfg(); ls.set("authErr", "Accesso a Calendar non concesso: il controllo resta spento."); }
    } else if (q.get("error")) {
      ls.set("authErr", q.get("error") === "access_denied" ? "Accesso annullato." : "Accesso non riuscito (" + q.get("error") + ").");
    } else {
      ls.set("authErr", (navigator.standalone ? "" : "L'accesso è tornato in una finestra diversa da quella che l'ha chiesto (su iPhone succede se l'app dalla schermata Home passa a Safari). ") + "Riprova; se si ripete, usa Focus da Safari.");
    }
    history.replaceState(null, "", location.pathname + location.search + ((st && st.hash) || ""));
  }

  function tokObj() { var t = ls.get("tok", null); return t && t.exp > Date.now() ? t : null; }
  function token() { var t = tokObj(); return t ? t.t : null; }
  function hasScope(s) { var t = tokObj(); return !!(t && t.scope && t.scope.indexOf(s) >= 0); }
  function signIn(opts) {
    opts = opts || {};
    if (!/\.apps\.googleusercontent\.com$/.test(CLIENT_ID)) { setErr("Client ID OAuth non configurato in questa build."); return; }
    var a = new Uint32Array(4); crypto.getRandomValues(a);
    var nonce = Array.prototype.join.call(a, "-");
    var keep = /^#(focus|giorno|piano|registro|settimana|impostazioni)$/.test(location.hash) ? location.hash : "";
    var wantCal = opts.cal != null ? !!opts.cal : !!CFG.calOn;
    ls.set("oauthState", { nonce: nonce, hash: keep, at: Date.now(), wantCal: wantCal, back: opts.back || "" });
    var scopes = [S_FILE].concat(wantCal ? [S_CAL] : []).join(" ");
    var redirect = location.origin + location.pathname.replace(/[^/]*$/, "");
    var u = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirect, response_type: "token", scope: scopes,
      state: nonce, include_granted_scopes: "true", prompt: opts.consent ? "consent" : ""
    }).toString().replace(/&prompt=$/, "");
    location.assign(u);
  }
  function signOut() {
    var t = ls.get("tok", null); ls.del("tok");
    if (t && t.t) fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "token=" + enc(t.t) }).catch(function () {});
    renderPanel();
  }
  function setErr(m) { ls.set("authErr", m); renderPanel(); }

  /* ---------- chiamate a Google ---------- */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function g(url, opt) {
    opt = opt || {};
    for (var attempt = 0; ; attempt++) {
      var t = token();
      if (!t) { renderPanel(); throw new Error("Accesso a Google necessario"); }
      var headers = { "Authorization": "Bearer " + t };
      if (opt.body) headers["Content-Type"] = "application/json";
      var r;
      try { r = await fetch(url, { signal: typeof AbortSignal!=="undefined"&&AbortSignal.timeout?AbortSignal.timeout(20000):undefined, method: opt.method || "GET", headers: headers, body: opt.body, cache: "no-store", referrerPolicy: "no-referrer" }); }
      catch (e) { if (attempt < 1) { await sleep(800); continue; } throw new Error("Rete non raggiungibile"); }
      if (r.status === 401) { ls.del("tok"); setErr("Accesso scaduto: tocca «Collega Google»."); throw new Error("Accesso a Google scaduto"); }
      if ((r.status === 429 || r.status >= 500) && attempt < 2) { await sleep(700 * Math.pow(2, attempt)); continue; }
      if (!r.ok) {
        var m = ""; try { m = (await r.json()).error.message || ""; } catch (e) {}
        if (r.status === 403 || r.status === 404) ls.set("lastApiErr", r.status + " " + m.slice(0, 160));
        throw new Error("Google " + r.status + (m ? ": " + m : ""));
      }
      return r.status === 204 ? {} : r.json();
    }
  }
  function tzOff(ms, tz) {
    var o = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms)).forEach(function (x) { o[x.type] = x.value; });
    return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second) - ms;
  }
  function toRfc(s, tz) {
    if (!s || /([zZ]|[+-]\d\d:\d\d)$/.test(s)) return s;
    var guess = Date.parse(s.length === 10 ? s + "T00:00:00Z" : s + "Z");
    var off = tzOff(guess, tz || "Europe/Rome");
    var t = guess - off; off = tzOff(t, tz || "Europe/Rome");
    return new Date(guess - off).toISOString();
  }

  /* ---------- contratto delle scritture ---------- */
  function int(x) { return typeof x === "number" ? (Number.isInteger(x) ? x : NaN) : (/^\d+$/.test(String(x)) ? Number(x) : NaN); }
  var WRITE_RULES = [
    { file: "sheet", re: /^PROGRAMMA!J(\d+):K\1$/, ok: function (m, v) { var n = +m[1]; return n >= 6 && n <= 427 && v.length === 1 && v[0].length === 2 && STATES.indexOf(v[0][0]) >= 0 && int(v[0][1]) >= 0 && int(v[0][1]) <= 900; } },
    { file: "arch", re: /^FOCUS_LOG!A(\d+):X\1$/, ok: function (m, v) { return +m[1] >= 3 && +m[1] <= 400 && v.length === 1 && v[0].length <= 24 && /^\d{4}-\d{2}-\d{2}$/.test(v[0][0]); } },
    { file: "arch", re: /^PIANO_PROPOSTE!A(\d+):I\1$/, ok: function (m, v) { return +m[1] >= 3 && +m[1] <= 400 && v.length === 1 && v[0].length === 9 && v[0][3] === "RICHIESTA" && v[0][8] === "IN_ATTESA"; } },
    { file: "arch", re: /^PIANO_PROPOSTE!I(\d+):L\1$/, ok: function (m, v) { return +m[1] >= 3 && +m[1] <= 400 && v.length === 1 && v[0].length === 4 && DECISIONS.indexOf(v[0][0]) >= 0; } }
  ];
  function fileKey(id) { return id && id === CFG.sheet ? "sheet" : id && id === CFG.arch ? "arch" : ""; }
  function checkWrite(id, range, values) {
    var k = fileKey(id);
    if (!k) throw new Error("Foglio non autorizzato");
    for (var i = 0; i < WRITE_RULES.length; i++) {
      var r = WRITE_RULES[i]; if (r.file !== k) continue;
      var m = r.re.exec(range); if (m && Array.isArray(values) && r.ok(m, values)) return true;
    }
    throw new Error("Scrittura fuori dal contratto dati di Focus: " + range);
  }

  var mcp = {
    callTool: async function (server, tool, input) {
      input = input || {};
      if (server === "Google Sheets" && tool === "get_values") {
        if (!fileKey(input.spreadsheetId)) throw new Error("Foglio non autorizzato");
        var r = await g(SH + enc(input.spreadsheetId) + "/values/" + enc(input.range) + "?valueRenderOption=FORMATTED_VALUE");
        return { range: r.range, values: r.values || [] };
      }
      if (server === "Google Sheets" && tool === "update_values") {
        if (CFG.readOnly) throw new Error("Sola lettura: registrazione nei fogli spenta");
        checkWrite(input.spreadsheetId, input.range, input.values);
        return g(SH + enc(input.spreadsheetId) + "/values/" + enc(input.range) + "?valueInputOption=RAW",
          { method: "PUT", body: JSON.stringify({ range: input.range, majorDimension: "ROWS", values: input.values }) });
      }
      if (server === "Google Calendar" && tool === "list_events") {
        if (!CFG.calOn || !CFG.cal || input.calendarId !== CFG.cal) throw new Error("Calendar non attivo");
        var tz = input.timeZone || "Europe/Rome";
        var qs = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: String(Math.min(250, input.pageSize || 100)), timeZone: tz });
        if (input.startTime) qs.set("timeMin", toRfc(input.startTime, tz));
        if (input.endTime) qs.set("timeMax", toRfc(input.endTime, tz));
        var items = [], page = "";
        do { if(page)qs.set("pageToken",page);var ev=await g(CAL+"calendars/"+enc(input.calendarId)+"/events?"+qs.toString());items=items.concat(ev.items||[]);page=ev.nextPageToken||""; } while(page);
        return { events: items.filter(function(e){return e.status!=="cancelled";}).map(function (e) { return { summary: e.summary || "", description: e.description || "", start: e.start, end: e.end }; }) };
      }
      throw new Error("Funzione non disponibile nella versione autonoma: " + server + " · " + tool);
    }
  };

  /* ---------- archivio: journal di snapshot, compatibile con FOCUS_DB precedente ---------- */
  var SYNC = window.STUDIOOS_SYNC;
  var rows = null, rowsAt = 0, loading = null, tabOK = false, writerReady = false, chain = Promise.resolve();
  var nextRow = 2, seenOps = new Set(), lastCloudRead = 0, lastCloudWrite = 0;
  var CH = 45000;
  var RE_PATH = /^(runs|errors|state)\/[\w.:-]{1,120}$/;
  async function ensureTab() {
    if ((tabOK === true && (CFG.readOnly || writerReady)) || (tabOK === "none" && CFG.readOnly)) return;
    var s = await g(SH + enc(CFG.arch) + "?fields=sheets.properties.title");
    var has = (s.sheets || []).some(function (x) { return x.properties && x.properties.title === TAB; });
    if (!has && CFG.readOnly) { tabOK = "none"; return; }
    if (!has) {
      try {
        await g(SH + enc(CFG.arch) + ":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB, hidden: true, gridProperties: { rowCount: 500, columnCount: 6 } } } }] }) });
        await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A1:F1") + "?valueInputOption=RAW", { method: "PUT", body: JSON.stringify({ values: [["percorso", "aggiornato_ms", "json_1", "json_2", "json_3", "dispositivo"]] }) });
      } catch (error) {
        /* A second device can create the tab while this request is in flight. */
        var verify = await g(SH + enc(CFG.arch) + "?fields=sheets.properties.title");
        if (!(verify.sheets || []).some(function (x) { return x.properties.title === TAB; })) throw error;
      }
    }
    if (!CFG.readOnly) {
      var header = await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A1:F1"));
      var first = (header.values || [])[0] || [];
      if (!first.length) await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A1:F1") + "?valueInputOption=RAW", {method:"PUT",body:JSON.stringify({values:[["percorso","aggiornato_ms","json_1","json_2","json_3","dispositivo"]]})});
      else if (first[0] !== "percorso") throw new Error("La prima riga dell'archivio non è riconosciuta: nessun dato è stato sostituito");
      writerReady = true;
    }
    tabOK = true;
  }
  function parseRow(v) {
    try {
      var record = JSON.parse((v[2] || "") + (v[3] || "") + (v[4] || ""));
      return record && record.sfocus === 2 && record.data ? { obj: record.data, op: record.op } : { obj: record, op: "legacy-" + SYNC.fingerprint(v) };
    } catch (e) { return null; }
  }
  function archiveRuns() {
    var result = {};
    Object.keys(rows || {}).forEach(function (path) { if (path.indexOf("runs/") === 0) result[path.slice(5)] = rows[path].obj; });
    return result;
  }
  async function loadAll(maxAge) {
    if (rows && Date.now() - rowsAt < (maxAge == null ? 4000 : maxAge)) return rows;
    if (loading) return loading;
    loading = (async function () {
      await ensureTab();
      if (!rows) rows = {};
      if (tabOK === "none") { rowsAt = Date.now(); return rows; }
      /* Append-only records allow incremental reads without overwriting another device. */
      var start = nextRow;
      var r = await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A" + start + ":F") + "?valueRenderOption=UNFORMATTED_VALUE");
      var values = r.values || [];
      var changed = [];
      values.forEach(function (v, i) {
        var path = v[0], parsed = parseRow(v);
        if (!RE_PATH.test(path || "") || !parsed || !parsed.obj) return;
        seenOps.add(parsed.op);
        if (!rows[path] || SYNC.compare(path, parsed.obj, rows[path].obj) >= 0) {
          rows[path] = { row: start + i, upd: Number(v[1]) || 0, obj: parsed.obj, op: parsed.op };changed.push(path);
        }
      });
      nextRow = start + values.length;
      rowsAt = lastCloudRead = Date.now();
      if(changed.length)window.dispatchEvent(new CustomEvent("studioos:archive-update",{detail:{paths:changed}}));
      return rows;
    })();
    try { return await loading; } finally { loading = null; }
  }
  function devName() { try { return String(JSON.parse(localStorage.getItem("sfocus.device")) || "").slice(0, 40); } catch (e) { return ""; } }
  async function setDoc(path, obj) {
    if (CFG.readOnly) throw new Error("Sola lettura: la sessione resta salvata su questo dispositivo");
    if (!RE_PATH.test(path)) throw new Error("Percorso d'archivio non valido");
    var m = await loadAll(0), current = m[path], op = obj.__opId || SYNC.fingerprint(path + "\n" + JSON.stringify(obj));
    if (path === "state/live" && obj.run) {
      var normalized = SYNC.normalizeLive(obj, archiveRuns());
      if (!normalized.run) return { accepted: false, current: normalized, verified: true };
    }
    if (current && SYNC.compare(path, current.obj, obj) > 0) return { accepted: false, current: SYNC.copy(current.obj), verified: true };
    if (seenOps.has(op)) return { accepted: true, current: current && SYNC.copy(current.obj), verified: true };
    var js = JSON.stringify({ sfocus: 2, op: op, data: obj });
    if (js.length > 3 * CH) throw new Error("Sessione troppo grande per l'archivio: esporta un backup");
    var u = SYNC.stamp(obj) || Date.now();
    var vals = [[path, u, js.slice(0, CH), js.slice(CH, 2 * CH), js.slice(2 * CH), devName()]];
    var r = await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A:F") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", { method: "POST", body: JSON.stringify({ values: vals }) });
    var match = /!A(\d+)/.exec((r.updates && r.updates.updatedRange) || "");
    if (!match) throw new Error("Google non ha confermato la riga salvata: riprovo dalla coda locale");
    var writtenRow = +match[1];
    var readback = await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A" + writtenRow + ":F" + writtenRow) + "?valueRenderOption=UNFORMATTED_VALUE");
    var value = (readback.values || [])[0] || [], verified = parseRow(value);
    if (value[0] !== path || !verified || verified.op !== op || JSON.stringify(verified.obj) !== JSON.stringify(obj)) throw new Error("Rilettura del salvataggio non riuscita: la sessione resta in coda");
    seenOps.add(op); lastCloudWrite = Date.now(); ls.set("cloudWriteAt", lastCloudWrite);
    if (!current || SYNC.compare(path, obj, current.obj) >= 0) rows[path] = { row: writtenRow, upd: u, obj: SYNC.copy(obj), op: op };
    /* Do not advance nextRow here: a concurrent append before ours must still be read. */
    return { accepted: true, current: SYNC.copy(obj), verified: true };
  }
  function snap(o, cache) { return { exists: !!o, data: function () { return o; }, metadata: { fromCache: !!cache } }; }
  function watch(path, cb, err) {
    var stop = false, last = "", timer = null, busy = false;
    async function tick() {
      if (stop || busy) return;
      busy = true; clearTimeout(timer);
      try {
        var m = await loadAll(0), value = m[path] ? m[path].obj : null;
        if (path === "state/live") value = SYNC.normalizeLive(value, archiveRuns());
        var signature = SYNC.fingerprint(value);
        if (last !== signature) { last = signature; cb(snap(value, false)); }
      } catch (e) { if (err) err(e); }
      finally { busy = false; if (!stop) timer = setTimeout(tick, document.hidden ? 45000 : 8000); }
    }
    function wake() { if (!document.hidden) tick(); }
    document.addEventListener("visibilitychange", wake); window.addEventListener("online", wake); window.addEventListener("pageshow", wake);
    tick();
    return function () { stop = true; clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); window.removeEventListener("pageshow", wake); };
  }
  var db = {
    collection: function (col) {
      return { get: async function () {
        var m = await loadAll();
        return Object.keys(m).filter(function (path) { return path.indexOf(col + "/") === 0; })
          .map(function (path) { return { id: path.slice(col.length + 1), data: function () { return SYNC.copy(m[path].obj); } }; });
      } };
    },
    doc: function (path) {
      return {
        get: async function () { var m = await loadAll(0), value = m[path] && m[path].obj; if (path === "state/live") value = SYNC.normalizeLive(value, archiveRuns()); return snap(SYNC.copy(value), false); },
        set: function (obj) { var payload = SYNC.copy(obj); var p = chain.then(function () { return setDoc(path, payload); }); chain = p.catch(function () {}); return p; },
        onSnapshot: function (cb, err) { return watch(path, cb, err); }
      };
    }
  };

  /* ---------- download ---------- */
  var downloads = {
    save: async function (o) {
      var name = String(o.filename || "STUDIOOS.txt").replace(/[^\w.\- ]/g, "_");
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data == null ? "" : o.data], { type: /\.json$/i.test(name) ? "application/json" : "text/plain" });
      if (navigator.canShare && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        try { var f = new File([blob], name, { type: blob.type }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return { ok: true }; } } catch (e) { if (e && e.name === "AbortError") throw e; }
      }
      var u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 8000);
      return { ok: true };
    }
  };

  window.claude = {
    use: async function (k) {
      if (k === "downloads") return downloads;
      if (!configured()) return null;
      if (k === "mcp") return mcp;
      if (k === "db") return db;
      return null;
    }
  };

  /* ---------- ricerca automatica dei fogli già autorizzati ---------- */
  async function classify(id) {
    var s = await g(SH + enc(id) + "?fields=properties.title,sheets.properties.title");
    var t = (s.sheets || []).map(function (x) { return x.properties.title; });
    var name = (s.properties && s.properties.title) || "";
    if (t.indexOf("FOCUS_LOG") >= 0 || t.indexOf("PIANO_PROPOSTE") >= 0) return { kind: "arch", name: name };
    if (t.indexOf("PROGRAMMA") >= 0 && t.indexOf("SISTEMA") >= 0) return { kind: "sheet", name: name };
    return { kind: "", name: name };
  }
  async function discover() {
    var r = await g(DRV + "?" + new URLSearchParams({ q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false", fields: "files(id,name,modifiedTime)", pageSize: "50", orderBy: "modifiedTime desc" }).toString());
    var found = { sheet: [], arch: [] };
    for (var i = 0; i < (r.files || []).length; i++) {
      var f = r.files[i]; if (!RE_FILE.test(f.id)) continue;
      try { var c = await classify(f.id); if (c.kind) found[c.kind].push({ id: f.id, name: c.name || f.name }); } catch (e) {}
    }
    return found;
  }
  async function autoConfigure() {
    var f = await discover();
    var msg = "";
    if (f.sheet.length === 1) CFG.sheet = f.sheet[0].id;
    if (f.arch.length === 1) CFG.arch = f.arch[0].id;
    if (f.sheet.length > 1 || f.arch.length > 1) { CFG.choices = f; msg = "Ho trovato più fogli compatibili: scegli quali usare."; }
    if (!f.sheet.length || !f.arch.length) msg = "Nessun foglio STUDIOOS autorizzato per questa app: tocca «Scegli i fogli» (solo la prima volta).";
    CFG.names = { sheet: (f.sheet.find(function (x) { return x.id === CFG.sheet; }) || {}).name || "", arch: (f.arch.find(function (x) { return x.id === CFG.arch; }) || {}).name || "" };
    saveCfg();
    return msg;
  }
  async function findCalendar() {
    var list = [], page = "";
    do {
      var qs=new URLSearchParams({minAccessRole:"reader",maxResults:"250",fields:"nextPageToken,items(id,summary,primary)"});
      if(page)qs.set("pageToken",page);
      var r=await g(CAL+"users/me/calendarList?"+qs.toString());list=list.concat(r.items||[]);page=r.nextPageToken||"";
    }while(page);
    return list;
  }
  async function sharePreferences() {
    if(window.STUDIOOS_PICKER_CONFIG&&window.STUDIOOS_PICKER_CONFIG.valid(CFG)&&token()&&CFG.arch) {
      try {await window.STUDIOOS_PICKER_CONFIG.save(tokObj(),CFG);return true;} catch(e){return false;}
    }
    return false;
  }
  async function connectCalendar(quiet) {
    CFG.calOn=true;saveCfg();
    if(!hasScope(S_CAL)){signIn({cal:true});return;}
    try {
      var list=await findCalendar();CFG.calChoices=list;
      var selected=list.find(function(c){return c.id===CFG.cal;});
      if(!selected){var study=list.filter(function(c){return /studio/i.test(c.summary||"");});if(study.length===1)selected=study[0];}
      if(selected){var changed=CFG.cal!==selected.id;CFG.cal=selected.id;CFG.calendarName=selected.summary;saveCfg();if(!quiet||changed)await sharePreferences();if(!quiet)toast("Calendar «"+selected.summary+"» collegato in sola lettura");}
      else {delete CFG.cal;saveCfg();toast(list.length?"Scegli il calendario di studio nell'elenco":"Nessun calendario leggibile trovato");}
    } catch(error){setErr("Calendar: "+error.message);}
    renderPanel();
  }
  async function diagnose() {
    var out = [];
    var t = tokObj();
    out.push(t ? "Google collegato · accesso valido ancora per circa " + Math.max(0, Math.round((t.exp - Date.now()) / 60000)) + " min" : "Google non collegato");
    if (t) out.push("Autorizzazioni: " + (t.scope || []).map(function (s) { return s === S_FILE ? "solo i file scelti (drive.file)" : s === S_CAL ? "Calendar in sola lettura" : s.replace("https://www.googleapis.com/auth/", ""); }).join(", "));
    if (CFG.sheet) {
      try { var a = await g(SH + enc(CFG.sheet) + "/values/" + enc("PROGRAMMA!L6:L427")); var ids = (a.values || []).filter(function (x) { return /^R20-\d{4}$/.test(x[0] || ""); }).length; out.push("Piano «" + (CFG.names && CFG.names.sheet || "D-035") + "»: " + ids + " blocchi letti ✓"); }
      catch (e) { out.push("Piano: ✗ " + e.message); }
    } else out.push("Piano: non collegato");
    if (CFG.arch) {
      try { var s = await g(SH + enc(CFG.arch) + "?fields=sheets.properties.title"); var tt = (s.sheets || []).map(function (x) { return x.properties.title; }); out.push("Archivio: " + ["FOCUS_LOG", "PIANO_PROPOSTE", TAB].map(function (n) { return n + (tt.indexOf(n) >= 0 ? " ✓" : " —"); }).join(" · ")); }
      catch (e) { out.push("Archivio: ✗ " + e.message); }
    } else out.push("Archivio: non collegato");
    out.push(CFG.readOnly ? "Registrazione nei fogli: spenta (sola lettura)" : "Registrazione nei fogli: attiva (solo campi previsti)");
    if(!(CFG.calOn&&CFG.cal)) out.push("Calendar: non configurato (facoltativo)");
    else if(!t||!hasScope(S_CAL)) out.push("Calendar «"+(CFG.calendarName||"calendario selezionato")+"»: non autorizzato · ricollega Google Calendar");
    else { try { var d0=new Date();d0.setHours(0,0,0,0);var qs=new URLSearchParams({singleEvents:"true",maxResults:"50",timeMin:d0.toISOString(),timeMax:new Date(d0.getTime()+864e5).toISOString(),fields:"items(summary,description)"});var ev=await g(CAL+"calendars/"+enc(CFG.cal)+"/events?"+qs.toString());var nn=(ev.items||[]).filter(function(x){return /\[R20:R20-\d{4}\]/.test((x.summary||"")+" "+(x.description||""));}).length;out.push("Calendar «"+(CFG.calendarName||"calendario selezionato")+"»: lettura riuscita · "+(nn?nn+" eventi STUDIOOS oggi":"nessun evento STUDIOOS oggi")+" · sola lettura"); }
      catch (e) { out.push("Calendar «"+(CFG.calendarName||"calendario selezionato")+"»: ✗ "+e.message); } }
    out.push(lastCloudWrite?"Ultimo salvataggio verificato: "+new Date(lastCloudWrite).toLocaleTimeString("it-IT"):"Nessuna nuova scrittura verificata in questa apertura");
    var le = ls.get("lastApiErr", ""); if (le) out.push("Ultimo errore Google: " + le);
    out.push("Versione " + VERSION + (navigator.serviceWorker && navigator.serviceWorker.controller ? " · funziona anche offline" : ""));
    return out;
  }

  /* ---------- pannello: collegamento guidato e configurazione avanzata ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(id) { return document.getElementById(id); }
  function platformHelp() {
    var ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    if (standalone) return "Focus è installato su questo dispositivo.";
    if (ios) return "Per installarlo: in Safari tocca Condividi → «Aggiungi alla schermata Home», poi aprilo dall'icona.";
    if (/Windows/.test(ua)) return "Per installarlo: in Edge menu ⋯ → App → «Installa questo sito come app»; in Chrome usa l'icona di installazione nella barra degli indirizzi.";
    return "Puoi installarlo dal menu del browser («Installa app» o «Aggiungi alla schermata Home»).";
  }
  function renderPanel() {
    var top = el("pwaTop"), card = el("pwaCard");
    if (!top || !card) return;
    var ok = !!token(), err = ls.get("authErr", "");
    var step = !ok ? 1 : !configured() ? 2 : 3;
    if (step === 3 && CFG.readOnly && !err) {
      top.hidden = false;
      top.innerHTML = '<span><b>Sola lettura.</b> Focus legge il piano ma non scrive nei fogli (registro, FOCUS_LOG, archivio sessioni). Attivala quando usi la PWA al posto dell\'Artifact.</span> <button class="btn" data-pwa="settings">Impostazioni</button>';
    } else if (step < 3 || err) {
      top.hidden = false;
      var txt = step === 1 ? "Passo 1 di 2 · Collega il tuo account Google: Focus vedrà solo i fogli STUDIOOS che autorizzi."
        : "Passo 2 di 2 · Collega i fogli STUDIOOS (piano D-035 e archivio tecnico).";
      top.innerHTML = (err ? '<span><b>' + esc(err) + '</b></span> ' : "") + '<span>' + txt + '</span> ' +
        (step === 1 ? '<button class="btn primary" data-pwa="in">Collega Google</button>' :
          step === 2 ? '<button class="btn primary" data-pwa="find">Cerca i fogli</button><a class="btn" href="setup.html">Scegli i fogli</a>' :
          '<button class="btn" data-pwa="dismiss">Ok</button>');
    } else { top.hidden = true; top.innerHTML = ""; }
    if (card.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    var wasOpen=!!(card.querySelector("details")&&card.querySelector("details").open);
    var previousDiag=el("pwaDiag"),diagText=previousDiag&&!previousDiag.hidden?previousDiag.textContent:"";
    var ch = CFG.choices, choice = "";
    if (ch && (ch.sheet.length > 1 || ch.arch.length > 1)) {
      choice = '<label for="pwaSelSheet">Piano</label><select id="pwaSelSheet">' + ch.sheet.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === CFG.sheet ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select>" +
        '<label for="pwaSelArch">Archivio</label><select id="pwaSelArch">' + ch.arch.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === CFG.arch ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select>" +
        '<div class="row"><button class="btn primary" data-pwa="choose">Usa questi fogli</button></div>';
    }
    card.innerHTML = '<h2>Account Google e collegamenti</h2>' +
      '<p class="small">' + (ok ? "Collegato." : "Non collegato.") + " " + (configured() ? "Fogli: «" + esc(CFG.names && CFG.names.sheet || "piano") + "» e «" + esc(CFG.names && CFG.names.arch || "archivio") + "»." : "Fogli STUDIOOS non ancora collegati.") + "</p>" + choice +
      '<div class="row" style="margin-top:6px">' + (ok ? '<button class="btn" data-pwa="diag">Verifica connessione</button><button class="btn" data-pwa="out">Disconnetti</button>' : '<button class="btn primary" data-pwa="in">Collega Google</button>') +
      (ok ? '<button class="btn" data-pwa="find">Cerca i fogli</button><a class="btn" href="setup.html">Scegli i fogli</a>' : "") + "</div>" +
      '<pre class="cons small" id="pwaDiag" hidden></pre>' +
      '<div class="pwa-save"><span class="pwa-save-label">Le tue sessioni</span><p id="pwaSaveState" role="status" aria-live="polite">Controllo dei salvataggi…</p><button class="btn" data-pwa="sync-now">Sincronizza ora</button><p class="small mute">Puoi passare a un altro dispositivo dopo «Salvato su Google». Piano e Calendar si aggiornano automaticamente ogni 30 secondi e alla riapertura. Recupero anche la sessione; senza rete conservo le modifiche qui e le invio quando torni online.</p></div>' +
      (configured() ? '<p class="small"><b>Registrazione nei fogli:</b> ' + (CFG.readOnly ? 'spenta su questo dispositivo. <button class="btn" data-pwa="wr-on">Attiva</button><span id="pwaWr" hidden> Le sessioni si salvano nel tuo archivio Google e l\'attivazione segue lo stesso archivio sugli altri dispositivi. Il registro PROGRAMMA richiede sempre la tua conferma. Usa la PWA come timer operativo. <button class="btn primary" data-pwa="wr-on-ok">Conferma attivazione</button></span>' : 'attiva. <button class="btn" data-pwa="wr-off">Solo salvataggio locale qui</button>') + '</p>' : '') +
      '<div class="pwa-calendar"><label><input type="checkbox" id="pwaCal"' + (CFG.calOn ? " checked" : "") + '> Confronta il piano con Google Calendar</label><p class="small mute">Solo lettura. Google richiede accesso in lettura ai calendari; Focus usa quello che scegli e non modifica gli eventi.</p>' +
      (CFG.calOn&&CFG.cal?'<p class="small">Collegato a <b>'+esc(CFG.calendarName||"calendario selezionato")+'</b>.</p>':"")+
      '<div class="row"><button class="btn" data-pwa="cal-connect">'+(CFG.calOn&&CFG.cal?"Cambia calendario":"Collega Google Calendar")+'</button></div>'+
      (CFG.calChoices&&CFG.calChoices.length?'<label for="pwaCalSelect">Calendario di studio</label><select id="pwaCalSelect"><option value="">Scegli un calendario…</option>'+CFG.calChoices.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===CFG.cal?' selected':'')+'>'+esc(c.summary||c.id)+'</option>';}).join("")+'</select>':"")+'</div>'+
      '<p class="small mute">' + esc(platformHelp()) + '</p>' +
      '<details><summary class="small">Configurazione avanzata</summary>' +
      '<p class="small mute">La configurazione del selettore si recupera con lo stesso account Google. Questi campi servono per il primo collegamento: il salvataggio la rende disponibile anche agli altri dispositivi tramite i metadati privati dell\'archivio autorizzato.</p>' +
      '<label for="pwaKey">Chiave API del selettore</label><input id="pwaKey" autocomplete="off" spellcheck="false" value="' + esc(CFG.pickerKey || "") + '">' +
      '<label for="pwaProj">Numero del progetto</label><input id="pwaProj" inputmode="numeric" autocomplete="off" value="' + esc(CFG.project || "") + '">' +
      '<div class="row"><button class="btn" data-pwa="saveadv">Salva</button><button class="btn" data-pwa="reset">Scollega i fogli da questo dispositivo</button></div></details>' +
      '<p class="small mute">' + esc(VERSION) + ' · archivio sessioni nella scheda nascosta ' + TAB + ' del foglio archivio.</p>';
    if(wasOpen&&card.querySelector("details"))card.querySelector("details").open=true;
    if(diagText){el("pwaDiag").hidden=false;el("pwaDiag").textContent=diagText;}
    updateSavePanel();
  }
  var appSaveStatus=null;
  function updateSavePanel(){var target=el("pwaSaveState");if(target){target.textContent=appSaveStatus?appSaveStatus.text:CFG.readOnly?"Salvataggio locale · attiva Google per sincronizzare":"Archivio Google collegato";target.dataset.state=appSaveStatus&&appSaveStatus.pending?"pending":CFG.readOnly?"local":"saved";}}
  function toast(t) { var box = el("toasts"); if (!box) return; var d = document.createElement("div"); d.className = "toast"; d.textContent = t; box.appendChild(d); setTimeout(function () { d.remove(); }, 5000); }
  async function runFind() {
    try { toast("Cerco i fogli autorizzati…"); var m = await autoConfigure(); ls.del("authErr"); if (m) setErr(m); else { toast("Fogli collegati: ricarico"); setTimeout(function () { location.reload(); }, 600); } }
    catch (e) { setErr("Ricerca non riuscita: " + e.message); }
    renderPanel();
  }
  function mount() {
    var main = document.querySelector("main");
    if (main && !el("pwaTop")) { var top = document.createElement("div"); top.id = "pwaTop"; top.className = "pwatop"; top.hidden = true; main.parentNode.insertBefore(top, main); }
    var set = el("v-impostazioni");
    if (set && !el("pwaCard")) { var c = document.createElement("article"); c.className = "card"; c.id = "pwaCard"; set.insertBefore(c, set.firstChild); }
    var css = document.createElement("style");
    css.textContent = ".pwatop{position:sticky;top:0;z-index:50;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:calc(env(safe-area-inset-top) + 6px) 12px 6px;padding:10px 12px;border-radius:14px;background:var(--surface);border:1px solid var(--line);box-shadow:0 6px 24px rgba(0,0,0,.18);font-size:.9rem}.pwatop[hidden]{display:none}";
    document.head.appendChild(css);
    renderPanel();
    document.addEventListener("click", async function (e) {
      var b = e.target.closest && e.target.closest("[data-pwa]"); if (!b) return;
      var a = b.getAttribute("data-pwa");
      if (a === "in") { e.preventDefault(); signIn(); }
      else if (a === "out") { signOut(); }
      else if (a === "find") { runFind(); }
      else if (a === "dismiss") { ls.del("authErr"); renderPanel(); }
      else if (a === "settings") { location.hash = "impostazioni"; }
      else if (a === "wr-on") { var w = el("pwaWr"); if (w) w.hidden = false; }
      else if (a === "wr-on-ok") { CFG.readOnly = false;CFG.writesOverride=false;saveCfg();await sharePreferences();toast("Salvataggio e sincronizzazione attivi");window.dispatchEvent(new CustomEvent("studioos:sync-now"));renderPanel(); }
      else if (a === "wr-off") { CFG.readOnly = true;CFG.writesOverride=true;saveCfg();toast("Su questo dispositivo salvo solo in locale");window.dispatchEvent(new CustomEvent("studioos:sync-now"));renderPanel(); }
      else if (a === "sync-now") { window.dispatchEvent(new CustomEvent("studioos:sync-now"));toast("Controllo i salvataggi e gli altri dispositivi…"); }
      else if (a === "cal-connect") { await connectCalendar(); }
      else if (a === "diag") { var d = el("pwaDiag"); d.hidden = false; d.textContent = "Verifico…"; try { d.textContent = (await diagnose()).join("\n"); } catch (x) { d.textContent = "Verifica non riuscita: " + x.message; } }
      else if (a === "choose") { CFG.sheet = el("pwaSelSheet").value; CFG.arch = el("pwaSelArch").value; CFG.names = { sheet: el("pwaSelSheet").selectedOptions[0].text, arch: el("pwaSelArch").selectedOptions[0].text }; delete CFG.choices;ls.del("authErr");saveCfg(); location.reload(); }
      else if (a === "saveadv") {
        var k = el("pwaKey").value.trim(), p = el("pwaProj").value.trim(); CFG.pickerKey = /^[\w-]{20,60}$/.test(k) ? k : ""; CFG.project = /^\d{6,15}$/.test(p) ? p : ""; saveCfg();
        if (window.STUDIOOS_PICKER_CONFIG && window.STUDIOOS_PICKER_CONFIG.valid(CFG) && token() && CFG.arch) {
          try { await window.STUDIOOS_PICKER_CONFIG.save(tokObj(), CFG); toast("Configurazione salvata e verificata anche per gli altri dispositivi"); }
          catch (x) { toast("Salvata su questo dispositivo. Condivisione non riuscita: " + x.message); }
        } else toast(CFG.pickerKey && CFG.project ? "Salvato su questo dispositivo: collega Google e l'archivio per condividerla" : "Valori non validi o vuoti");
        renderPanel();
      }
      else if (a === "reset") { delete CFG.sheet; delete CFG.arch; delete CFG.names; delete CFG.choices; CFG.readOnly = true; saveCfg(); location.reload(); }
    });
    document.addEventListener("change", async function (e) {
      if (e.target && e.target.id === "pwaCal") {
        if (e.target.checked) await connectCalendar();
        else {CFG.calOn=false;saveCfg();await sharePreferences();toast("Confronto con Calendar spento");renderPanel();}
      }
      if(e.target&&e.target.id==="pwaCalSelect"){
        var selected=(CFG.calChoices||[]).find(function(c){return c.id===e.target.value;});
        if(selected){CFG.cal=selected.id;CFG.calOn=true;CFG.calendarName=selected.summary;saveCfg();await sharePreferences();toast("Calendar «"+selected.summary+"» collegato");renderPanel();}
      }
    });
    window.addEventListener("studioos:sync-status",function(e){appSaveStatus=e.detail;updateSavePanel();});
    setInterval(function(){if(!el("pwaCard")||!el("pwaCard").contains(document.activeElement))updateSavePanel();},60000);
    /* La configurazione del Picker segue l'account, anche se i fogli sono già collegati. */
    if (token() && window.STUDIOOS_PICKER_CONFIG) {
      window.STUDIOOS_PICKER_CONFIG.load(tokObj(), CFG,{refresh:true,preferences:true}).then(function () { saveCfg(); renderPanel();window.dispatchEvent(new CustomEvent("studioos:sync-now"));if(CFG.calOn&&hasScope(S_CAL))connectCalendar(true); }).catch(function () {});
    }
    /* dopo l'accesso: collega i fogli e, se richiesto, il calendario */
    if (token() && !configured()) runFind();
    if (token() && CFG.calOn && hasScope(S_CAL) && !window.STUDIOOS_PICKER_CONFIG) connectCalendar(true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  /* ---------- service worker e aggiornamenti ---------- */
  if ("serviceWorker" in navigator && /^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href)) {
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading) return;
      var active = null; try { active = JSON.parse(localStorage.getItem(window.STUDIOOS_DATA_PREFIX+"active")); } catch (e) {}
      if (active && active.run) { toast("Nuova versione installata: verrà usata alla prossima apertura."); return; }
      reloading = true; location.reload();
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).then(function (reg) {
        function offer(w) { if (w) w.postMessage("skip"); }
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener("updatefound", function () { var w = reg.installing; w && w.addEventListener("statechange", function () { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); }); });
        setInterval(function () { reg.update().catch(function () {}); }, 3600000);
      }).catch(function () {});
    });
  }

  window.STUDIOOS_ADAPTER = { version: VERSION, toRfc: toRfc, signIn: signIn, signOut: signOut, configured: configured, diagnose: diagnose, checkWrite: checkWrite,
    canWrite: function () { return !CFG.readOnly && !!token(); }, refresh: function () { return loadAll(0); },
    storagePrefix: window.STUDIOOS_DATA_PREFIX, cloudStatus: function () { return {ready:tabOK===true,readAt:lastCloudRead,writtenAt:lastCloudWrite||ls.get("cloudWriteAt",0),readOnly:CFG.readOnly}; }, _cfg: function () { return CFG; } };
})();

