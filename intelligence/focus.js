"use strict";
(function(root){
 const ACTIVE=new Set(["MDP","BD","MN","OOP","RETI"]);
 const KEY="sfocus.intelligence.endpoint.v1";
 function validEndpoint(s){return typeof s==="string"&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,180}\/exec$/.test(s.trim());}
 function analyze(blocks,day,tomorrow,now,dayCap,done,minuteAt){
  if(!Array.isArray(blocks))throw Error("invalid blocks");
  let planned=0,recorded=0,remaining=0,backlog=0,next=0,tomorrowNet=0;const messages=[],seen=new Set();let invalid=0;
  for(const b of blocks){if(!b||!ACTIVE.has(b.mat)||b.stato==="Rinviato")continue;
   if(typeof b.id!=="string"||!b.id||seen.has(b.id)||!Number.isFinite(b.min)||b.min<0||!(/^\d{4}-\d{2}-\d{2}$/.test(b.date))||!(/^\d{2}:\d{2}$/.test(b.to))){invalid++;continue}seen.add(b.id);
   const x=Number(done(b));if(!Number.isFinite(x)||x<0){invalid++;continue}const d=Math.min(b.min,x),end=minuteAt(b.date,b.to);
   if(!Number.isFinite(end)){invalid++;continue}if(b.date===day){planned+=b.min;recorded+=d;remaining+=Math.max(0,b.min-d);next++;}
   if(b.date===tomorrow)tomorrowNet+=b.min;if(end<=now)backlog+=Math.max(0,b.min-d);
  }
  if(invalid)messages.push(invalid+" record non validi/duplicati: controlla la fonte; conteggi parziali.");
  if(backlog)messages.push(backlog+" min da verificare dopo la fine dei blocchi; non ricollocati automaticamente.");
  if(Number.isFinite(dayCap)&&dayCap>0&&tomorrowNet>=dayCap*.9)messages.push("Domani vicino al limite base: verifica pause e vincoli particolari.");
  if(!next)messages.push("Nessun blocco attivo oggi nella copia Focus; non equivale a giorno libero.");
  return {planned,recorded,remaining,backlog,next,tomorrowNet,invalid,messages};
 }
 if(typeof module!=="undefined")module.exports={validEndpoint,analyze};
 if(!root.document)return;const doc=root.document,$=id=>doc.getElementById(id),card=$("intelligenceFocus");if(!card)return;
 let lastEvent=0,lastSignature="";
 function setup(){const link=$("intPrivate");let url="";try{url=root.localStorage.getItem(KEY)||""}catch{}if(validEndpoint(url)){link.href=url.trim();link.target="_blank";link.rel="noopener noreferrer"}else{link.href="intelligence/index.html";link.removeAttribute("target");link.removeAttribute("rel");}}
 function render(){
  setup();try{
   if(typeof index==="undefined"||typeof todayIso!=="function"||typeof doneMin!=="function"||typeof at!=="function")return;
   if(!Object.keys(index).length){$("intFresh").textContent="Nessun dato locale disponibile; verifica il collegamento Sheets.";return;}
   const day=todayIso(),result=analyze(Object.values(index),day,addDays(day,1),Date.now(),typeof planLimit==="function"?planLimit("max_net_day_minutes",NaN):NaN,doneMin,at);
   $("intFresh").textContent=(root.navigator.onLine===false?"Offline · copia locale":lastEvent?"Ultimo evento di aggiornamento Focus: "+new Date(lastEvent).toLocaleTimeString("it-IT"):"Copia Focus caricata · freschezza non ancora osservata")+" · zero Groq";
   const signature=JSON.stringify(result);if(signature===lastSignature)return;lastSignature=signature;
   const metrics=$("intMetrics"),msg=$("intMessages");metrics.replaceChildren();msg.replaceChildren();
   for(const [k,v] of [["Previsti",result.planned],["Registrati",result.recorded],["Rimanenti",result.remaining],["Domani",result.tomorrowNet]]){const el=doc.createElement("p");el.className="small";const b=doc.createElement("b");b.textContent=v+"′";el.append(b,doc.createTextNode(" "+k));metrics.append(el);}
   for(const v of result.messages){const el=doc.createElement("p");el.className="small mute";el.textContent=v;msg.append(el);}
   if(typeof msg.animate==="function"&&!root.matchMedia("(prefers-reduced-motion: reduce)").matches)msg.animate([{opacity:.5,transform:"translateY(3px)"},{opacity:1,transform:"none"}],{duration:180,easing:"ease-out"});
  }catch{$("intFresh").textContent="Analisi locale non disponibile; nessuna modifica eseguita."}
 }
 root.addEventListener("studioos:data-refreshed",e=>{lastEvent=Number(e.detail?.at)||Date.now();render()});
 root.addEventListener("studioos:sync-status",render);
 root.addEventListener("storage",e=>{if(e.key===KEY)setup()});root.addEventListener("online",render);root.addEventListener("offline",render);
 doc.addEventListener("visibilitychange",()=>{if(!doc.hidden)render()});render();
})(typeof window!=="undefined"?window:globalThis);
