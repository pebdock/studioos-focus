/* Configurazione del selettore condivisa fra dispositivi dello stesso account.
   Resta nelle appProperties private dell'archivio già autorizzato con drive.file.
   Non contiene dati di studio e non richiede altri ambiti OAuth. */
(function () {
  "use strict";
  var CLIENT = "588484343295-379le6qi7t5340nv4toi6vav0nqpg13q.apps.googleusercontent.com";
  var DRIVE = "https://www.googleapis.com/drive/v3/files";
  var FIELDS = { client: "sfocus.picker.client", key: "sfocus.picker.key", project: "sfocus.picker.project", calendar:"sfocus.calendar", calOn:"sfocus.calendar.on", save:"sfocus.save" };
  function valid(cfg) {
    return !!(cfg && /^AIza[\w-]{35}$/.test(cfg.pickerKey || "") && /^\d{6,15}$/.test(cfg.project || "") && cfg.project === CLIENT.split("-")[0]);
  }
  function bearer(tok) {
    if (!tok || !tok.t || !(tok.exp > Date.now()) || (tok.scope || []).indexOf("https://www.googleapis.com/auth/drive.file") < 0) {
      throw new Error("Collega Google per recuperare la configurazione del selettore.");
    }
    return tok.t;
  }
  async function request(url, tok, body) {
    var headers = { Authorization: "Bearer " + bearer(tok) };
    var opt = { method: body ? "PATCH" : "GET", headers: headers, cache: "no-store", referrerPolicy: "no-referrer" };
    if (body) { headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    var response = await fetch(url, opt);
    if (!response.ok) throw new Error("Configurazione del selettore: Google " + response.status);
    return response.json();
  }
  async function load(tok, cfg, options) {
    cfg = cfg || {};
    options = options || {};
    if (valid(cfg) && !options.refresh) return cfg;
    var page = "";
    do {
      var query = new URLSearchParams({
        q: "trashed=false and mimeType='application/vnd.google-apps.spreadsheet' and appProperties has { key='" + FIELDS.client + "' and value='" + CLIENT + "' }",
        fields: "nextPageToken,files(id,appProperties)", pageSize: "100"
      });
      if (page) query.set("pageToken", page);
      var result = await request(DRIVE + "?" + query.toString(), tok);
      var files = (result.files || []).sort(function(a,b){return Number(b.id===cfg.arch)-Number(a.id===cfg.arch);});
      for (var i = 0; i < files.length; i++) {
        var p = files[i].appProperties || {};
        var candidate = { pickerKey: p[FIELDS.key], project: p[FIELDS.project] };
        if (p[FIELDS.client] === CLIENT && valid(candidate)) {
          cfg.pickerKey = candidate.pickerKey; cfg.project = candidate.project;
          if (options.preferences && files[i].id === cfg.arch) {
            if (!cfg.writesOverride && p[FIELDS.save] === "1") cfg.readOnly = false;
            if (cfg.calOn == null && p[FIELDS.calOn] != null) cfg.calOn = p[FIELDS.calOn] === "1";
            if (!cfg.cal && typeof p[FIELDS.calendar] === "string" && p[FIELDS.calendar].length <= 240) cfg.cal = p[FIELDS.calendar];
          }
          return cfg;
        }
      }
      page = result.nextPageToken || "";
    } while (page);
    throw new Error("Configurazione condivisa non ancora disponibile.");
  }
  async function save(tok, cfg) {
    if (!valid(cfg) || !/^[\w-]{25,60}$/.test(cfg.arch || "")) throw new Error("Collega l'archivio e verifica la configurazione del selettore.");
    var url = DRIVE + "/" + encodeURIComponent(cfg.arch) + "?fields=appProperties";
    var old = await request(url, tok), properties = Object.assign({}, old.appProperties || {});
    properties[FIELDS.client] = CLIENT; properties[FIELDS.key] = cfg.pickerKey; properties[FIELDS.project] = cfg.project;
    if (cfg.readOnly === false) properties[FIELDS.save] = "1";
    if (cfg.calOn != null) properties[FIELDS.calOn] = cfg.calOn ? "1" : "0";
    if (cfg.cal) properties[FIELDS.calendar] = new TextEncoder().encode(FIELDS.calendar + cfg.cal).length <= 124 ? cfg.cal : null;
    await request(url, tok, { appProperties: properties });
    var check = (await request(url, tok)).appProperties || {};
    if (check[FIELDS.client] !== CLIENT || check[FIELDS.key] !== cfg.pickerKey || check[FIELDS.project] !== cfg.project) {
      throw new Error("La rilettura della configurazione non coincide.");
    }
    return cfg;
  }
  window.STUDIOOS_PICKER_CONFIG = { valid: valid, load: load, save: save };
})();
