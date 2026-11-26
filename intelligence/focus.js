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
   const x=Number(done(b));if(!Number.isFinite(x)||x<0){invalid++;continue}if(x>b.min)invalid++;const d=Math.min(b.min,x),end=minuteAt(b.date,b.to);
   if(!Number.isFinite(end)){invalid++;continue}if(b.date===day){planned+=b.min;recorded+=d;remaining+=Math.max(0,b.min-d);next++;}
   if(b.date===tomorrow)tomorrowNet+=b.min;if(end<=now)backlog+=Math.max(0,b.min-d);
  }
  if(invalid)messages.push(invalid+" record non validi/duplicati: controlla la fonte; conteggi parziali.");
  if(backlog)messages.push(backlog+" min da verificare dopo la fine dei blocchi; non ricollocati automaticamente.");
  if(Number.isFinite(dayCap)&&dayCap>0&&tomorrowNet>=dayCap*.9)messages.push("Domani vicino al limite base: verifica pause e vincoli particolari.");
  if(!next)messages.push("Nessun blocco attivo oggi nella copia Focus; non equivale a giorno libero.");
  return {planned,recorded,remaining,backlog,next,tomorrowNet,invalid,messages};
 }
 function contextInsights(view,blocks,day,now,done,minuteAt,summary){
 const usable=blocks.filter(b=>b&&ACTIVE.has(b.mat)&&b.stato!=="Rinviato"&&typeof b.id==="string"&&b.id&&Number.isFinite(b.min)&&b.min>=0);
 const seen=new Set(),valid=usable.filter(b=>!seen.has(b.id)&&(seen.add(b.id),true)),past=valid.filter(b=>Number.isFinite(minuteAt(b.date,b.to))&&minuteAt(b.date,b.to)<=now),recorded=past.filter(b=>Number.isFinite(Number(done(b)))&&Number(done(b))>0&&Number(done(b))<=b.min);
 const aiEligible=recorded.filter(b=>b.mat!=="OOP").length;
 const next=valid.filter(b=>b.date>=day&&minuteAt(b.date,b.to)>now).sort((a,b)=>minuteAt(a.date,a.from)-minuteAt(b.date,b.from))[0];
 const results={
 focus:{title:"Intelligence · prossima attività",body:next?next.mat+" · "+next.date+" "+next.from+"–"+next.to+" · "+String(next.topic||next.arg||"apri il blocco").slice(0,120):"Nessuna prossima attività nella copia locale.",link:"Tutor privato"},
 giorno:{title:"Intelligence · carico di oggi",body:summary.remaining+" min residui oggi · "+summary.tomorrowNet+" min previsti domani. Dati della copia Focus, non nuova lettura di Sheets.",link:"Controlla il piano"},
 piano:{title:"Intelligence · audit",body:summary.invalid+" anomalie nei conteggi locali · "+summary.backlog+" min terminati da verificare. Audit completo nel backend privato.",link:"Audit e Tutor"},
 registro:{title:"Intelligence · Knowledge Quest",body:aiEligible+" blocchi locali conclusi con minuti registrati, candidati alla verifica facoltativa. Idoneità effettiva e pagine verificate sul server.",link:"Apri arena"},
 settimana:{title:"Intelligence · progresso",body:recorded.length+" blocchi locali con minuti registrati. Le ore non sono un voto; consulta gli esiti formativi privati.",link:"Apri esiti"},
 impostazioni:{title:"Intelligence · connessione",body:"Il backend privato mantiene chiavi, quote, fonti e valutazioni. Nessuna chiave nel browser.",link:"Configura assistente"}
 };return results[view]||null;
 }
 if(typeof module!=="undefined")module.exports={validEndpoint,analyze,contextInsights};
 if(!root.document)return;const doc=root.document,$=id=>doc.getElementById(id),card=$("intelligenceFocus");if(!card)return;
 let lastEvent=0,lastSignature="",chartSignature="";
 function setup(){let url="";try{url=root.localStorage.getItem(KEY)||""}catch{}for(const id of ["intPrivate","ui-glass-intelligence-global","ui-glass-intelligence-quest"]){const link=$(id);if(!link)continue;if(validEndpoint(url)){link.href=url.trim()+(id==="ui-glass-intelligence-quest"?"#questSection":"");link.target="_blank";link.rel="noopener noreferrer"}else{link.href="intelligence/index.html";link.removeAttribute("target");link.removeAttribute("rel");}}}
 function contextCard(result){
 const view=doc.querySelector("#tabbar [aria-selected=true]")?.dataset.v||"focus",target=$("v-"+view);if(!target)return;const insight=contextInsights(view,Object.values(index),todayIso(),Date.now(),doneMin,at,result);if(!insight)return;
 let card=$("ui-glass-intelligence-context-"+view);if(!card){card=doc.createElement("details");card.id="ui-glass-intelligence-context-"+view;card.className="card";const summary=doc.createElement("summary");summary.className="small";summary.textContent=insight.title;const body=doc.createElement("p");body.className="small mute";const link=doc.createElement("a");link.className="btn";card.append(summary,body,link);target.append(card);card.addEventListener("toggle",()=>{if(card.open&&typeof card.animate==="function"&&!root.matchMedia("(prefers-reduced-motion: reduce)").matches)card.animate([{opacity:.65,transform:"translateY(2px)"},{opacity:1,transform:"none"}],{duration:170,easing:"ease-out"})})}const body=card.querySelector("p"),link=card.querySelector("a");if(body.textContent!==insight.body)body.textContent=insight.body;link.textContent=insight.link;let url="";try{url=root.localStorage.getItem(KEY)||""}catch{}if(validEndpoint(url)){link.href=url.trim()+(["registro","settimana"].includes(view)?"#questSection":"");link.target="_blank";link.rel="noopener noreferrer"}else{link.href="intelligence/index.html";link.removeAttribute("target");link.removeAttribute("rel");}
 }
 function chart(){
  const box=$("ui-glass-intelligence-chart");if(!box)return;const sums=Object.fromEntries([...ACTIVE].map(s=>[s,0])),seen=new Set();
  for(const b of Object.values(index)){if(!b||!ACTIVE.has(b.mat)||b.stato==="Rinviato"||!Number.isFinite(b.min)||b.min<0||!b.id||seen.has(b.id))continue;seen.add(b.id);const v=Number(doneMin(b));if(Number.isFinite(v)&&v>=0&&v<=b.min)sums[b.mat]+=v}
  const sig=JSON.stringify(sums);if(sig===chartSignature)return;chartSignature=sig;box.replaceChildren();const total=Object.values(sums).reduce((a,b)=>a+b,0),max=Math.max(1,...Object.values(sums));const label=doc.createElement("p");label.className="small";label.textContent="Totale registrato nella copia Focus: "+(total/60).toFixed(1)+" h";box.append(label);
  for(const [subject,min] of Object.entries(sums)){const row=doc.createElement("div");row.className="small";const label=doc.createElement("label");label.textContent=subject+" · "+(min/60).toFixed(1)+" h";const bar=doc.createElement("progress");bar.max=max;bar.value=min;bar.setAttribute("aria-label",label.textContent);row.append(label,bar);box.append(row)}
 }
 function render(){
  setup();try{
   if(typeof index==="undefined"||typeof todayIso!=="function"||typeof doneMin!=="function"||typeof at!=="function")return;
   if(!Object.keys(index).length){$("intFresh").textContent="Nessun dato locale disponibile; verifica il collegamento Sheets.";return;}
   const day=todayIso(),result=analyze(Object.values(index),day,addDays(day,1),Date.now(),typeof planLimit==="function"?planLimit("max_net_day_minutes",NaN):NaN,doneMin,at);
   $("intFresh").textContent=(root.navigator.onLine===false?"Offline · copia locale":lastEvent?"Ultimo evento di aggiornamento Focus: "+new Date(lastEvent).toLocaleTimeString("it-IT"):"Copia Focus caricata · freschezza non ancora osservata")+" · zero Groq";
   chart();contextCard(result);const signature=JSON.stringify(result);if(signature===lastSignature)return;lastSignature=signature;
   const metrics=$("intMetrics"),msg=$("intMessages");metrics.replaceChildren();msg.replaceChildren();
   for(const [k,v] of [["Previsti",result.planned],["Registrati",result.recorded],["Rimanenti",result.remaining],["Domani",result.tomorrowNet]]){const el=doc.createElement("p");el.className="small";const b=doc.createElement("b");b.textContent=v+"′";el.append(b,doc.createTextNode(" "+k));metrics.append(el);}
   for(const v of result.messages){const el=doc.createElement("p");el.className="small mute";el.textContent=v;msg.append(el);}
   if(typeof msg.animate==="function"&&!root.matchMedia("(prefers-reduced-motion: reduce)").matches)msg.animate([{opacity:.5,transform:"translateY(3px)"},{opacity:1,transform:"none"}],{duration:180,easing:"ease-out"});
  }catch{$("intFresh").textContent="Analisi locale non disponibile; nessuna modifica eseguita."}
 }
 root.addEventListener("studioos:data-refreshed",e=>{lastEvent=Number(e.detail?.at)||Date.now();render()});
 root.addEventListener("studioos:sync-status",render);doc.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("#tabbar"))root.requestAnimationFrame(render)});doc.addEventListener("keydown",e=>{if(e.target.closest&&e.target.closest("#tabbar"))root.requestAnimationFrame(render)});
 root.addEventListener("storage",e=>{if(e.key===KEY)render()});root.addEventListener("online",render);root.addEventListener("offline",render);
 doc.addEventListener("visibilitychange",()=>{if(!doc.hidden)render()});render();
})(typeof window!=="undefined"?window:globalThis);
