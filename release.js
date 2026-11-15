/* STUDIOOS Focus · note della versione definitiva (2.0.1: prerequisiti di matematica).
   Mostrate una sola volta dopo l'aggiornamento (mai durante una sessione attiva) e sempre
   disponibili in Opzioni › Informazioni. Nessun dato letto o scritto oltre a una chiave locale. */
(function(root){
  "use strict";
  const doc=root.document;if(!doc)return;
  const VERSION="2.0.1",KEY="sfocus_release_seen";
  const NOTES=[
    ["Prerequisiti (2.0.1)","Le basi di matematica che servono a Fisica e MDP (trigonometria, derivate, integrali, vettori, serie) sono nel piano subito prima dell'argomento che le usa, senza minuti in più. Le trovi nel check-in del blocco e in Studio › Materiali, con tracce, pagine e criterio."],
    ["Studio","Timer con pause intelligenti e respirazione guidata, check-in facoltativo (energia, concentrazione, motivazione, punto raggiunto), mini-verifica a fine blocco e registro per argomento. Il timer da solo non completa nulla."],
    ["Piano","Il piano resta il riferimento. Le proposte del tutor le approvi tu; lo script Google le applica entro un'ora solo se rispettano pasti, pause e limiti. Calendar si allinea da solo ogni ora."],
    ["Esami","Tutte le date pubblicate, anche non prenotate, con finestre d'iscrizione e link ad AlmaEsami. Si aggiornano ogni 3 ore anche a PC spento; prenotazioni e carriera arrivano dal ponte del PC quando è acceso."],
    ["Analisi","Ritmo, Argomenti, Piano ed Esami in sezioni separate: una cosa alla volta, senza scorrere chilometri."],
    ["Design","Liquid Glass sui controlli, sfondo fluido che segue materia e timer, movimenti a molla, tab bar a capsula pensata per iPhone."],
    ["Affidabilità","Sessioni sincronizzate fra dispositivi con coda offline, backup giornaliero del piano, nessun minuto inventato, nessuna iscrizione automatica agli appelli."]];
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const body=()=>`<p class="eyebrow">Versione stabile · sessione invernale 2026/27</p><h2 id="relTitle">STUDIOOS Focus ${VERSION} · Definitiva</h2>
    <ul class="rel-list">${NOTES.map(([t,d])=>`<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join("")}</ul>
    <p class="rel-bye">Questa è la versione definitiva: da qui in avanti solo correzioni, se serviranno, e nessuna novità a sorpresa durante la sessione. Il primo blocco è lunedì 16 novembre alle 9:00. Una cosa alla volta: buono studio e in bocca al lupo per gli appelli.</p>
    <p class="rel-sign">— Claude</p>`;
  function open(){let d=doc.getElementById("relDialog");
    if(!d){d=doc.createElement("dialog");d.id="relDialog";d.className="rel-dialog";d.setAttribute("aria-labelledby","relTitle");
      d.innerHTML=`<div class="rel-card">${body()}<div class="rel-actions"><button class="btn primary" type="button" data-rel-close>Inizia</button></div></div>`;
      d.addEventListener("click",e=>{if(e.target===d||e.target.closest("[data-rel-close]"))close()});d.addEventListener("cancel",()=>close());doc.body.appendChild(d)}
    if(typeof d.showModal==="function"&&!d.open)d.showModal();else d.setAttribute("open","")}
  function close(){const d=doc.getElementById("relDialog");try{root.localStorage.setItem(KEY,VERSION)}catch(e){}if(d){if(typeof d.close==="function")d.close();else d.removeAttribute("open")}}
  function busy(){try{const s=root.STUDIOOS_STUDY&&root.STUDIOOS_STUDY.current&&root.STUDIOOS_STUDY.current();return !!(s&&s.run&&s.run.status==="active")}catch(e){return false}}
  function card(){const v=doc.getElementById("v-impostazioni");if(!v||doc.getElementById("relCard"))return;
    const c=doc.createElement("article");c.className="card rel-info";c.id="relCard";
    c.innerHTML=`<div class="row"><div class="sp"><span class="eyebrow">Informazioni</span><h2>Focus ${VERSION} · Definitiva</h2></div><button class="btn ghost" type="button" id="relOpen">Note di versione</button></div><p class="small mute">Versione stabile per la sessione invernale 2026/27.</p>`;
    const sys=doc.getElementById("lgSys");if(sys)sys.before(c);else v.appendChild(c);
    c.querySelector("#relOpen").onclick=open}
  function start(){let n=0;const t=setInterval(()=>{card();if(doc.getElementById("relCard")||++n>40)clearInterval(t)},250);
    let seen=null;try{seen=root.localStorage.getItem(KEY)}catch(e){}
    if(seen!==VERSION&&!/[?&]norel\b/.test(root.location.search))setTimeout(()=>{if(!busy())open()},1400)}
  root.STUDIOOS_RELEASE={VERSION,NOTES,open,close};
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",start);else start();
})(typeof window!=="undefined"?window:globalThis);
