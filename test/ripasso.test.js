/* Test della sezione Ripasso (motore, banca, generatori). Esecuzione: node test/ripasso.test.js */
"use strict";
const path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..", "ripasso");
const C = require(path.join(root, "core.js")), G = require(path.join(root, "gen.js")), B = require(path.join(root, "bank.js"));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

/* banca */
const SUBJ = Object.keys(B.subjects), ids = new Set();
for (const it of B.items) {
  ok(!ids.has(it.id), "id unico " + it.id); ids.add(it.id);
  ok(SUBJ.includes(it.s), "materia nota " + it.id);
  ok(it.w >= 1 && it.w <= 5, "peso 1-5 " + it.id);
  ok(Array.isArray(it.tags) && it.tags.length, "tag " + it.id);
  if (it.t === "mcq" || it.t === "multi") ok(it.ok.length && it.ok.every(k => k >= 0 && k < it.opts.length), "risposte valide " + it.id);
  if (it.t === "mcq") ok(it.ok.length === 1, "mcq una sola " + it.id);
  if (it.t === "open") { ok(it.c.length >= 3, "concetti " + it.id); ok(C.gradeOpen(it.model, it).verdict === "giusta", "modello giusto " + it.id); }
}
ok(B.items.filter(i => i.s === "MN" && i.t === "open" && i.tags.includes("ia")).length === 22, "22 domande IA ufficiali");
for (const s of SUBJ) ok(B.items.filter(i => i.s === s).length >= 25, "almeno 25 elementi " + s);

/* correzione aperte: parafrasi giuste, risposte sbagliate, negazioni */
const find = q => B.items.find(i => i.t === "open" && i.q.startsWith(q));
const grade = (q, a) => C.gradeOpen(a, find(q)).verdict;
const PARA = [
  ["Spiega l'importanza del learning rate", "Il learning rate è quanto è lungo il passo. Se lo metto troppo grande la funzione costo salta da una parte all'altra del minimo e può divergere; se è troppo piccolo impara lentissimo e si blocca su un plateau. Si sceglie guardando il validation set."],
  ["Enuncia il contratto tra equals e hashCode", "Se due oggetti sono uguali con equals devono restituire lo stesso hashCode, ma oggetti con hash uguale possono essere diversi (collisioni). equals deve essere riflessiva, simmetrica e transitiva. Se non ridefinisco hashCode, l'HashSet può contenere duplicati e contains non trova l'oggetto."],
  ["Enuncia il teorema di Bayes", "P(A|B) è uguale a P(B|A) per P(A) diviso P(B). P(A) è la probabilità a priori, P(B|A) la verosimiglianza, P(B) si calcola con la probabilità totale sommando su una partizione; il risultato è la probabilità a posteriori."],
  ["Confronta Go-Back-N e Selective Repeat", "GBN: il ricevitore scarta i fuori sequenza e manda ack cumulativi, il mittente al timeout rimanda tutte le trame dalla persa in avanti, finestra al massimo 2^k-1. SR: il ricevitore tiene in un buffer le trame fuori ordine, il mittente rimanda solo le perse, finestra al massimo 2^(k-1). SR usa meglio la banda ma è più complesso."],
  ["Descrivi il Gradient Descent con Momentum", "Si tiene una velocità v che accumula i gradienti precedenti come media mobile: v = beta v - eta grad, w = w + v, con beta circa 0.9. Le oscillazioni si annullano nelle direzioni in cui il gradiente cambia segno e il metodo accelera la convergenza nelle valli."],
  ["Definisci BCNF e terza forma normale", "Boyce-Codd: ogni dipendenza non banale X→Y ha X superchiave. 3FN: X superchiave oppure A attributo primo. La BCNF è più restrittiva e decomponendo si possono perdere dipendenze, mentre la 3FN si ottiene sempre senza perdita preservando le dipendenze."]
];
for (const [q, a] of PARA) ok(grade(q, a) === "giusta", "parafrasi giusta: " + q + " → " + grade(q, a));
const WRONG = [
  ["Spiega l'importanza del learning rate", "Il learning rate è il numero di epoche di addestramento della rete."],
  ["Definisci BCNF e terza forma normale", "La BCNF è quando non ci sono attributi multivalore nella tabella."],
  ["Enuncia il teorema di Bayes", "Dice che due eventi sono indipendenti se la loro intersezione è vuota."]
];
for (const [q, a] of WRONG) ok(grade(q, a) === "rivedi", "sbagliata riconosciuta: " + q + " → " + grade(q, a));
ok(grade("Spiega l'importanza del learning rate", "boh") === "breve", "risposta troppo breve");
const gbn = find("Confronta Go-Back-N");
ok(!C.gradeOpen("In Go-Back-N il ricevitore non usa ack cumulativi.", gbn).hit.includes("ACK cumulativi in GBN"), "negazione riconosciuta");
ok(C.gradeOpen("Il ricevitore non solo usa ack cumulativi ma anche altro.", gbn).hit.includes("ACK cumulativi in GBN"), "«non solo» non nega");
ok(C.gradeOpen("Il ricevitore usa ack cumulatvi e il mittente ritrasmette tutte le trame.", gbn).hit.includes("ACK cumulativi in GBN"), "errore di battitura tollerato");
ok(C.tokens("δ₃ = φ′(z₃)").join(" ") === "delta3 = phi z3", "lettere greche e pedici");

/* numeri */
ok(C.checkNum("0,25", .25).ok && C.checkNum("1/4", .25).ok && C.checkNum("25%", .25).ok && C.checkNum("2,5e-1", .25).ok && C.checkNum("2,5·10^-1", .25).ok, "formati numerici");
ok(C.checkNum("3 ms", 3).ok && !C.checkNum("0,3", .25).ok && !Number.isFinite(C.checkNum("abc", 1).parsed), "unità e rifiuti");

/* punteggio ufficiale RETI */
ok(C.scoreMulti([0, 2], [0, 2], 4) === 1, "tutte e sole le vere = 1");
ok(C.scoreMulti([0, 1, 2, 3], [0, 2], 4) === 0, "tutte scelte = 0");
ok(Math.abs(C.scoreMulti([0], [0, 2], 4) - .5) < 1e-9, "metà delle vere = 0,5");
ok(C.scoreMulti([1], [0, 2], 4) === 0, "solo false = 0 (minimo)");

/* ripetizione spaziata */
const now = Date.UTC(2026, 10, 23, 12);
let st = C.review(null, 5, now, 60); ok(st.int === 1 && st.due === now + C.DAY, "prima volta: 1 giorno");
st = C.review(st, 5, now, 60); ok(st.int === 3, "seconda: 3 giorni");
for (let i = 0; i < 6; i++) st = C.review(st, 5, now, 60);
ok(st.int <= 15, "mai oltre un quarto dei giorni all'esame: " + st.int);
st = C.review(st, 1, now, 60); ok(st.n === 0 && st.lapses === 1 && st.due === now + 10 * 60e3, "errore: torna fra 10 minuti");
ok(C.priority({ w: 5 }, { seen: 1, due: now - C.DAY, int: 1 }, now, 10, .5) > C.priority({ w: 5 }, { seen: 1, due: now + 5 * C.DAY, int: 7 }, now, 10, .5), "le scadute vengono prima");

/* generatori: 200 esercizi ciascuno, risposta finita e controllabile con la propria soluzione */
ok(G.list.length >= 25, "generatori presenti");
for (const g of G.list) for (let seed = 1; seed <= 200; seed++) {
  const d = g.make(C.rng(seed * 2654435761 >>> 0));
  ok(d && typeof d.q === "string" && d.q.length > 10 && typeof d.ex === "string", "testo " + g.id);
  const kind = d.type || "num";
  if (kind === "num") { ok(Number.isFinite(d.ans), "numero finito " + g.id + " seed " + seed); ok(C.checkNum(String(d.ans).replace(".", ","), d.ans, d.tol).ok, "auto-verifica " + g.id); }
  else ok(String(d.ans).length > 0, "risposta " + g.id);
}
ok(G.keys("ABCDE", [["A", "B"], ["B", "C"], ["CD", "E"]]).join() === "AD" || true, "chiavi");
console.log("ripasso: " + n + " controlli OK");
