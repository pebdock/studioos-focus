/* STUDIOOS Focus · scelta dei fogli con il selettore Google (solo la prima volta).
   Con l'ambito drive.file l'app può aprire solo i file scelti qui; gli altri dispositivi li ritrovano da soli. */
(function () {
  "use strict";
  var P = "sfocus.pwa.";
  function get(k) { try { return JSON.parse(localStorage.getItem(P + k)); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function msg(t, bad) { var m = $("msg"); m.textContent = t; m.className = bad ? "bad" : ""; }
  var cfg = get("cfg2") || {}, tok = get("tok");
  var ready = tok && tok.exp > Date.now() && (tok.scope || []).indexOf("https://www.googleapis.com/auth/drive.file") >= 0;
  if (!ready) { msg("Prima collega Google dalla pagina principale (Impostazioni › Account Google), poi torna qui.", true); $("pick").disabled = true; return; }
  if (!cfg.pickerKey || !cfg.project) {
    $("pick").disabled = true; msg("Recupero la configurazione del selettore dal tuo account Google…");
    var shared = window.STUDIOOS_PICKER_CONFIG;
    if (shared) shared.load(tok, cfg).then(function (found) {
      cfg = found; set("cfg2", cfg); $("pick").disabled = false;
      msg("Selettore pronto. Tocca «Scegli i fogli».");
    }).catch(function () {
      msg("Configurazione non trovata: torna a Focus, collega lo stesso account Google e premi «Cerca i fogli». La configurazione avanzata serve solo per il primo collegamento dell'account.", true);
    });
    else msg("Aggiornamento dell'app incompleto: ricarica questa pagina con una connessione attiva.", true);
  }
  async function classify(id) {
    var r = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(id) + "?fields=properties.title,sheets.properties.title", { headers: { Authorization: "Bearer " + tok.t }, cache: "no-store", referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error("Google " + r.status);
    var s = await r.json(), t = (s.sheets || []).map(function (x) { return x.properties.title; });
    /* l'archivio tecnico contiene anche vecchie schede PROGRAMMA/SISTEMA: i suoi marcatori hanno la precedenza */
    var kind = (t.indexOf("FOCUS_LOG") >= 0 || t.indexOf("PIANO_PROPOSTE") >= 0) ? "arch" : (t.indexOf("PROGRAMMA") >= 0 && t.indexOf("SISTEMA") >= 0) ? "sheet" : "";
    return { kind: kind, name: (s.properties && s.properties.title) || "" };
  }
  async function picked(data) {
    if (data.action !== google.picker.Action.PICKED) { if (data.action === google.picker.Action.CANCEL) msg("Selezione annullata."); return; }
    msg("Controllo i fogli scelti…");
    var got = { sheet: null, arch: null }, other = [];
    for (var i = 0; i < data.docs.length; i++) {
      var d = data.docs[i];
      try { var c = await classify(d.id); if (c.kind && !got[c.kind]) got[c.kind] = { id: d.id, name: c.name }; else other.push(c.name || d.name); }
      catch (e) { other.push((d.name || "file") + " (" + e.message + ")"); }
    }
    cfg = get("cfg2") || {};
    if (got.sheet) { cfg.sheet = got.sheet.id; } if (got.arch) { cfg.arch = got.arch.id; }
    cfg.names = { sheet: got.sheet ? got.sheet.name : (cfg.names && cfg.names.sheet) || "", arch: got.arch ? got.arch.name : (cfg.names && cfg.names.arch) || "" };
    delete cfg.choices; set("cfg2", cfg);
    var miss = [];
    if (!cfg.sheet) miss.push("il piano (foglio con le schede PROGRAMMA e SISTEMA)");
    if (!cfg.arch) miss.push("l'archivio tecnico (foglio con FOCUS_LOG e PIANO_PROPOSTE)");
    if (miss.length) { msg("Manca " + miss.join(" e ") + ". Tocca di nuovo «Scegli i fogli»." + (other.length ? " Non riconosciuti: " + other.join(", ") : ""), true); return; }
    msg("Collegati «" + cfg.names.sheet + "» e «" + cfg.names.arch + "». Torno a Focus…");
    setTimeout(function () { location.href = "./#impostazioni"; }, 1200);
  }
  function open() {
    var view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setIncludeFolders(true).setSelectFolderEnabled(false).setMode(google.picker.DocsViewMode.LIST);
    new google.picker.PickerBuilder()
      .addView(view)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(tok.t)
      .setDeveloperKey(cfg.pickerKey)
      .setAppId(cfg.project)
      .setOrigin(location.origin)
      .setLocale("it")
      .setTitle("Scegli il piano D-035 e l'archivio tecnico STUDIOOS")
      .setCallback(picked)
      .build().setVisible(true);
  }
  $("pick").addEventListener("click", function () {
    $("pick").disabled = true; msg("Carico il selettore Google…");
    var s = document.createElement("script"); s.src = "https://apis.google.com/js/api.js"; s.async = true;
    s.onload = function () { gapi.load("picker", { callback: function () { $("pick").disabled = false; msg("Scegli i due fogli (tieni premuto per selezionarne più di uno)."); open(); } }); };
    s.onerror = function () { $("pick").disabled = false; msg("Il selettore Google non si è caricato: controlla la connessione.", true); };
    document.head.appendChild(s);
  });
})();
