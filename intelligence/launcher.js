"use strict";
(function(root){
 const KEY="sfocus.intelligence.endpoint.v1";
 function validEndpoint(s){return typeof s==="string"&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,180}\/exec$/.test(s.trim());}
 if(typeof module!=="undefined")module.exports={validEndpoint};
 if(!root.document)return;
 const doc=root.document,$=id=>doc.getElementById(id),open=$("open"),status=$("status"),input=$("endpoint");
 function stored(){try{return root.localStorage.getItem(KEY)||""}catch{return ""}}
 function render(value){const ok=validEndpoint(value);open.hidden=!ok;if(ok){open.href=value.trim();input.value=value.trim();status.textContent="Collegamento configurato. L’autenticazione e lo stato effettivo si verificano nella web app."}else{open.removeAttribute("href");status.textContent="Backend non configurato."}}
 $("save").addEventListener("click",()=>{const v=input.value.trim();if(!validEndpoint(v)){status.textContent="URL non valido: usa solo script.google.com/macros/s/…/exec.";return}try{root.localStorage.setItem(KEY,v)}catch{status.textContent="Memoria locale non disponibile.";return}render(v)});
 $("clear").addEventListener("click",()=>{try{root.localStorage.removeItem(KEY)}catch{status.textContent="Impossibile rimuovere la configurazione.";return}input.value="";render("")});
 render(stored());
})(typeof window!=="undefined"?window:globalThis);
