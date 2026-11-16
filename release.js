/* STUDIOOS Focus · note della versione definitiva (2.4.0: timer e lettura compatta).
   Mostrate una sola volta dopo l'aggiornamento (mai durante una sessione attiva) e sempre
   disponibili in Opzioni › Informazioni. Nessun dato letto o scritto oltre a una chiave locale. */
(function(root){
  "use strict";
  const doc=root.document;if(!doc)return;
  const VERSION="2.4.0",KEY="sfocus_release_seen";
  const NOTES=[
    ["Timer (2.4.0)","Il mini-timer in basso non copre più lo schermo e ha il suo tasto ❚❚ / ▶: metti in pausa o riprendi da qualsiasi sezione. Nel blocco vedi un solo comando principale (Avvia oppure Pausa); StandBy, OLED e gli altri sono in «Altre opzioni»."],
    ["Scaletta (2.4.0)","Un passo per riga: stato (○ ◐ ✓ ◑ ↺), orario, durata e tipo (Teoria, Esercizi, Esame, Prerequisito…). «Cosa fare» è su due righe: tocca il passo per il testo completo e per cambiare il tipo. Gli esercizi d'esame reali sono evidenziati."],
    ["Lettura (2.4.0)","Le spiegazioni lunghe sono chiuse dietro «ⓘ Come funziona»; i materiali del blocco non si ripetono più (stesso file, pagine unite)."],
    ["Versioni precedenti","Interfaccia più leggibile e controlli touch da 44 px (2.3.1), prerequisiti come passi veri della scaletta, basi usate ma non spiegate, file e pagine per ogni intervallo, sincronizzazione tra dispositivi con coda offline, nessun minuto inventato."]];
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const body=()=>`<p class="eyebrow">Versione stabile · sessione invernale 2026/27</p><h2 id="relTitle">STUDIOOS Focus ${VERSION} · Definitiva</h2>
    <ul class="rel-list">${NOTES.map(([t,d])=>`<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join("")}</ul>
    <p class="rel-bye">Questa è la versione definitiva: da qui in avanti solo correzioni, se serviranno, e nessuna novità a sorpresa durante la sessione. Una cosa alla volta: buono studio e in bocca al lupo per gli appelli.</p>
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
