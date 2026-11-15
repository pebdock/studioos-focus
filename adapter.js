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
  var VERSION = "pwa-1.1.3 · R13h.3";
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
  function saveCfg() { ls.set("cfg2", CFG); window.STUDIOOS_CFG = { sheet: CFG.sheet || "", arch: CFG.arch || "", cal: CFG.calOn ? (CFG.cal || "") : "" }; }
  function configured() { return !!(CFG.sheet && CFG.arch); }
  window.STUDIOOS_PWA = true;
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
      state: nonce, prompt: opts.consent ? "consent" : ""
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
      try { r = await fetch(url, { method: opt.method || "GET", headers: headers, body: opt.body, cache: "no-store", referrerPolicy: "no-referrer" }); }
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
  function int(x) { return typeof x === "number" ? x : (/^\d+$/.test(String(x)) ? Number(x) : NaN); }
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
        var ev = await g(CAL + "calendars/" + enc(input.calendarId) + "/events?" + qs.toString());
        return { events: (ev.items || []).map(function (e) { return { summary: e.summary || "", description: e.description || "", start: e.start, end: e.end }; }) };
      }
      throw new Error("Funzione non disponibile nella versione autonoma: " + server + " · " + tool);
    }
  };

  /* ---------- archivio: scheda nascosta FOCUS_DB nel foglio archivio ---------- */
  var rows = null, rowsAt = 0, loading = null, tabOK = false, chain = Promise.resolve();
  var CH = 45000;
  var RE_PATH = /^(runs|errors|state)\/[\w.:-]{1,120}$/;
  async function ensureTab() {
    if (tabOK) return;
    var s = await g(SH + enc(CFG.arch) + "?fields=sheets.properties.title");
    var has = (s.sheets || []).some(function (x) { return x.properties && x.properties.title === TAB; });
    if (!has && CFG.readOnly) { tabOK = "none"; return; }
    if (!has) {
      await g(SH + enc(CFG.arch) + ":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB, hidden: true, gridProperties: { rowCount: 500, columnCount: 6 } } } }] }) });
      await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A1:F1") + "?valueInputOption=RAW", { method: "PUT", body: JSON.stringify({ values: [["percorso", "aggiornato_ms", "json_1", "json_2", "json_3", "dispositivo"]] }) });
    }
    tabOK = true;
  }
  function parseRow(v) { try { return JSON.parse((v[2] || "") + (v[3] || "") + (v[4] || "")); } catch (e) { return null; } }
  async function loadAll(maxAge) {
    if (rows && Date.now() - rowsAt < (maxAge == null ? 4000 : maxAge)) return rows;
    if (loading) return loading;
    loading = (async function () {
      await ensureTab();
      if (tabOK === "none") { rows = {}; rowsAt = Date.now(); return rows; }
      var r = await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A2:F") + "?valueRenderOption=UNFORMATTED_VALUE");
      var m = {};
      (r.values || []).forEach(function (v, i) {
        var p = v[0]; if (!p || !RE_PATH.test(p)) return; var o = parseRow(v); if (!o) return; var u = Number(v[1]) || 0;
        if (!m[p] || u >= m[p].upd) m[p] = { row: i + 2, upd: u, obj: o };
      });
      rows = m; rowsAt = Date.now(); return m;
    })();
    try { return await loading; } finally { loading = null; }
  }
  function devName() { try { return String(JSON.parse(localStorage.getItem("sfocus.device")) || "").slice(0, 40); } catch (e) { return ""; } }
  async function setDoc(path, obj) {
    if (CFG.readOnly) throw new Error("Sola lettura: archivio salvato solo su questo dispositivo");
    if (!RE_PATH.test(path)) throw new Error("Percorso d'archivio non valido");
    var m = await loadAll(60000);
    var js = JSON.stringify(obj);
    if (js.length > 3 * CH) throw new Error("Record troppo grande per l'archivio (" + js.length + " caratteri)");
    var u = Number(obj && obj.updatedAt) || Date.now();
    var ex = m[path];
    if (ex && ex.upd > u && path !== "state/live") return; /* più recente già salvato: niente sovrascrittura all'indietro */
    var vals = [[path, u, js.slice(0, CH), js.slice(CH, 2 * CH), js.slice(2 * CH), devName()]];
    if (ex && ex.row) {
      await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A" + ex.row + ":F" + ex.row) + "?valueInputOption=RAW", { method: "PUT", body: JSON.stringify({ values: vals }) });
      ex.upd = u; ex.obj = obj;
    } else {
      var r = await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A:F") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", { method: "POST", body: JSON.stringify({ values: vals }) });
      var mm = /!A(\d+)/.exec((r.updates && r.updates.updatedRange) || "");
      m[path] = { row: mm ? +mm[1] : 0, upd: u, obj: obj };
    }
  }
  function snap(o, cache) { return { exists: !!o, data: function () { return o; }, metadata: { fromCache: !!cache } }; }
  function watch(path, cb, err) {
    var stop = false, last = null, lastFull = 0;
    async function tick() {
      if (stop) return;
      try {
        var ex = rows && rows[path], o = null, u = 0;
        if (ex && ex.row) {
          var r = await g(SH + enc(CFG.arch) + "/values/" + enc(TAB + "!A" + ex.row + ":F" + ex.row) + "?valueRenderOption=UNFORMATTED_VALUE");
          var v = (r.values || [])[0] || [];
          if (v[0] === path) { u = Number(v[1]) || 0; o = parseRow(v); if (o) { ex.obj = o; ex.upd = u; } }
          else { rowsAt = 0; }
        } else if (Date.now() - lastFull > 15000) {
          lastFull = Date.now(); var m = await loadAll(0); if (m[path]) { o = m[path].obj; u = m[path].upd; }
        } else { u = last == null ? 0 : last; }
        if (last === null || u !== last) { last = u; cb(snap(o, false)); }
      } catch (e) { if (err) err(e); }
      finally { if (!stop) setTimeout(tick, document.hidden ? 60000 : 8000); }
    }
    tick();
    return function () { stop = true; };
  }
  var db = {
    collection: function (col) {
      return { get: async function () {
        var m = await loadAll();
        return Object.keys(m).filter(function (p) { return p.indexOf(col + "/") === 0; })
          .map(function (p) { return { id: p.slice(col.length + 1), data: function () { return m[p].obj; } }; });
      } };
    },
    doc: function (path) {
      return {
        get: async function () { var m = await loadAll(); var e = m[path]; return snap(e ? e.obj : null, false); },
        set: function (obj) { var p = chain.then(function () { return setDoc(path, obj); }); chain = p.catch(function () {}); return p; },
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
    if (t.indexOf("PROGRAMMA") >= 0 && t.indexOf("SISTEMA") >= 0) return { kind: "sheet", name: name };
    if (t.indexOf("FOCUS_LOG") >= 0 || t.indexOf("PIANO_PROPOSTE") >= 0) return { kind: "arch", name: name };
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
    var r = await g(CAL + "users/me/calendarList?minAccessRole=reader&fields=items(id,summary)");
    var list = (r.items || []).filter(function (c) { return /studio/i.test(c.summary || ""); });
    return list;
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
    out.push(CFG.calOn ? "Controllo Calendar: attivo (sola lettura)" : "Controllo Calendar: spento");
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
      (configured() ? '<p class="small"><b>Registrazione nei fogli:</b> ' + (CFG.readOnly ? 'spenta (sola lettura). <button class="btn" data-pwa="wr-on">Attiva</button><span id="pwaWr" hidden> Usa una sola versione per il timer (PWA o Artifact): le sessioni di questa app finiscono nella scheda FOCUS_DB, separata dall\'archivio dell\'Artifact. <button class="btn primary" data-pwa="wr-on-ok">Conferma attivazione</button></span>' : 'attiva. <button class="btn" data-pwa="wr-off">Torna a sola lettura</button>') + '</p>' : '') +
      '<label><input type="checkbox" id="pwaCal"' + (CFG.calOn ? " checked" : "") + '> Controllo con Google Calendar (facoltativo, sola lettura: chiede l\'accesso in lettura a tutti i calendari)</label>' +
      '<p class="small mute">' + esc(platformHelp()) + '</p>' +
      '<details><summary class="small">Configurazione avanzata</summary>' +
      '<p class="small mute">Servono solo per «Scegli i fogli» su un dispositivo nuovo: chiave del selettore Google (limitata a questo sito) e numero del progetto Google Cloud. Restano su questo dispositivo.</p>' +
      '<label for="pwaKey">Chiave API del selettore</label><input id="pwaKey" autocomplete="off" spellcheck="false" value="' + esc(CFG.pickerKey || "") + '">' +
      '<label for="pwaProj">Numero del progetto</label><input id="pwaProj" inputmode="numeric" autocomplete="off" value="' + esc(CFG.project || "") + '">' +
      '<div class="row"><button class="btn" data-pwa="saveadv">Salva</button><button class="btn" data-pwa="reset">Scollega i fogli da questo dispositivo</button></div></details>' +
      '<p class="small mute">' + esc(VERSION) + ' · archivio sessioni nella scheda nascosta ' + TAB + ' del foglio archivio.</p>';
  }
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
      else if (a === "wr-on-ok") { CFG.readOnly = false; saveCfg(); toast("Registrazione nei fogli attiva"); setTimeout(function () { location.reload(); }, 600); }
      else if (a === "wr-off") { CFG.readOnly = true; saveCfg(); toast("Sola lettura"); setTimeout(function () { location.reload(); }, 600); }
      else if (a === "diag") { var d = el("pwaDiag"); d.hidden = false; d.textContent = "Verifico…"; try { d.textContent = (await diagnose()).join("\n"); } catch (x) { d.textContent = "Verifica non riuscita: " + x.message; } }
      else if (a === "choose") { CFG.sheet = el("pwaSelSheet").value; CFG.arch = el("pwaSelArch").value; CFG.names = { sheet: el("pwaSelSheet").selectedOptions[0].text, arch: el("pwaSelArch").selectedOptions[0].text }; delete CFG.choices; saveCfg(); location.reload(); }
      else if (a === "saveadv") { var k = el("pwaKey").value.trim(), p = el("pwaProj").value.trim(); CFG.pickerKey = /^[\w-]{20,60}$/.test(k) ? k : ""; CFG.project = /^\d{6,15}$/.test(p) ? p : ""; saveCfg(); toast(CFG.pickerKey && CFG.project ? "Salvato" : "Valori non validi o vuoti"); renderPanel(); }
      else if (a === "reset") { delete CFG.sheet; delete CFG.arch; delete CFG.names; delete CFG.choices; CFG.readOnly = true; saveCfg(); location.reload(); }
    });
    document.addEventListener("change", async function (e) {
      if (e.target && e.target.id === "pwaCal") {
        if (e.target.checked) {
          if (!hasScope(S_CAL)) { CFG.calOn = true; saveCfg(); signIn({ cal: true }); return; }
          try { var l = await findCalendar(); if (l.length) { CFG.cal = l[0].id; CFG.calOn = true; saveCfg(); toast("Calendar «" + l[0].summary + "» collegato in sola lettura"); setTimeout(function () { location.reload(); }, 800); } else { e.target.checked = false; toast("Nessun calendario «Studio» trovato"); } }
          catch (x) { e.target.checked = false; toast("Calendar non raggiungibile: " + x.message); }
        } else { CFG.calOn = false; saveCfg(); toast("Controllo Calendar spento"); setTimeout(function () { location.reload(); }, 600); }
      }
    });
    setInterval(renderPanel, 60000);
    /* dopo l'accesso: collega i fogli e, se richiesto, il calendario */
    if (token() && !configured()) runFind();
    if (token() && CFG.calOn && !CFG.cal && hasScope(S_CAL)) findCalendar().then(function (l) { if (l.length) { CFG.cal = l[0].id; saveCfg(); location.reload(); } }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  /* ---------- service worker e aggiornamenti ---------- */
  if ("serviceWorker" in navigator && /^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href)) {
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading) return;
      var active = null; try { active = JSON.parse(localStorage.getItem("sfocus.active")); } catch (e) {}
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

  window.STUDIOOS_ADAPTER = { version: VERSION, toRfc: toRfc, signIn: signIn, signOut: signOut, configured: configured, diagnose: diagnose, checkWrite: checkWrite, _cfg: function () { return CFG; } };
})();
