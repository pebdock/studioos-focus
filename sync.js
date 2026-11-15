/* STUDIOOS persistence helpers. Timer/study rules deliberately live elsewhere. */
(function (root) {
  "use strict";
  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function terminal(value) { return !!value && (value.status === "confirmed" || value.status === "discarded"); }
  function stamp(value) { return Number(value && (value.updatedAt || value.at || value.confirmedAt)) || 0; }
  function fingerprint(value) {
    var text = typeof value === "string" ? value : JSON.stringify(value), a = 2166136261, b = 2246822507;
    for (var i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489909); }
    return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
  }
  function compare(path, a, b) {
    if (!a) return b ? -1 : 0; if (!b) return 1;
    if (/^runs\//.test(path)) {
      var rank = function (r) { return r.status === "confirmed" ? 2 : r.status === "discarded" ? 1 : 0; };
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if ((+a.rev || 0) !== (+b.rev || 0)) return (+a.rev || 0) - (+b.rev || 0);
    }
    if (stamp(a) !== stamp(b)) return stamp(a) - stamp(b);
    return String(a.__opId || fingerprint(a)).localeCompare(String(b.__opId || fingerprint(b)));
  }
  function operation(entry) { return entry[2].__opId || fingerprint(entry); }
  function enqueue(queue, entry) {
    var key = entry[0] + "/" + entry[1], found = false, result = [];
    for (var i = 0; i < queue.length; i++) {
      var old = queue[i];
      if (!Array.isArray(old) || old.length < 3 || !old[2]) continue;
      if (old[0] + "/" + old[1] === key) {
        if (!found) result.push(compare(key, old[2], entry[2]) > 0 ? old : entry);
        found = true;
      } else result.push(old);
    }
    if (!found) result.push(copy(entry));
    return result;
  }
  function acknowledge(queue, entry) {
    var key = entry[0] + "/" + entry[1], op = operation(entry);
    return queue.filter(function (item) { return item[0] + "/" + item[1] !== key || operation(item) !== op; });
  }
  function normalizeLive(live, runs) {
    if (!live || !live.run) return live;
    var saved = runs[live.run.runId];
    if (saved && terminal(saved.obj || saved)) {
      saved = saved.obj || saved;
      return { key: "live", run: null, ended: saved.runId, endedStatus: saved.status, endedRun: copy(saved), at: stamp(saved), updatedAt: stamp(saved), by: saved.by };
    }
    return live;
  }
  function prefix(cfg) { return cfg && cfg.sheet && cfg.arch ? "sfocus.data." + cfg.sheet + "." + cfg.arch + "." : "sfocus.unlinked."; }
  function migrate(storage, scope) {
    if (!scope || scope === "sfocus." || scope === "sfocus.unlinked." || storage.getItem("sfocus.legacyScope")) return;
    var keys = [];
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key && key.startsWith("sfocus.") && !/^sfocus\.(pwa\.|data\.|unlinked\.|device$|settings$|legacy)/.test(key)) keys.push(key);
    }
    for (var j = 0; j < keys.length; j++) {
      var destination = scope + keys[j].slice(7);
      if (storage.getItem(destination) == null) storage.setItem(destination, storage.getItem(keys[j]));
    }
    /* Keep the original keys as a recovery copy; bind migration to one data set. */
    storage.setItem("sfocus.legacyScope", scope);
  }
  root.STUDIOOS_SYNC = { copy: copy, terminal: terminal, stamp: stamp, fingerprint: fingerprint, compare: compare,
    operation: operation, enqueue: enqueue, acknowledge: acknowledge, normalizeLive: normalizeLive, prefix: prefix, migrate: migrate };
  if (typeof module === "object" && module.exports) module.exports = root.STUDIOOS_SYNC;
})(typeof window === "object" ? window : globalThis);
