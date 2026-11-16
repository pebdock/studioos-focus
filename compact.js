/* STUDIOOS Focus · lettura compatta (2.4.0)
   Le spiegazioni statiche lunghe restano nella pagina, ma chiuse dietro «ⓘ Come funziona»:
   stesso testo, un tocco per leggerlo. Nessun dato letto o scritto; i testi aggiornati dal
   codice (con id) e quelli con comandi dentro restano sempre visibili. */
(function(root){
  "use strict";
  const doc=root.document;if(!doc)return;
  const MIN=90;
  function fold(p){
    if(p.id||p.closest("details,#toasts,.sheet,#standby")||p.querySelector("button,input,select,textarea,a,[id]"))return;
    if((p.textContent||"").trim().length<MIN)return;
    const d=doc.createElement("details");d.className="hint";
    const s=doc.createElement("summary");s.innerHTML='<span aria-hidden="true">ⓘ</span> Come funziona';
    p.parentNode.insertBefore(d,p);d.appendChild(s);d.appendChild(p);
  }
  function run(){doc.querySelectorAll(".view p.mute.small,.view p.small.mute").forEach(fold)}
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",run);else run();
  if(typeof module!=="undefined"&&module.exports)module.exports={fold};
})(typeof window!=="undefined"?window:globalThis);
