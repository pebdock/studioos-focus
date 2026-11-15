"use strict";
let CAL_ID=(window.STUDIOOS_CFG||{}).cal||"";
const SHEET_ID=(window.STUDIOOS_CFG||{}).sheet||"";
const ARCH_ID=(window.STUDIOOS_CFG||{}).arch||"";
const SUBJ=["MDP","BD","MN","FIS","OOP","RETI"];
let EXAMS=[["2027-01-11","MDP","Scritto"],["2027-01-13","MDP","Orale"],["2027-01-19","BD","Scritto"],["2027-02-15","MN","Scritto"],[null,"OOP","Data non pubblicata"],[null,"FIS","Data non pubblicata"],[null,"RETI","Data non pubblicata"]];
const VIEWS=["focus","giorno","piano","registro","settimana","impostazioni"];
const MIN=60000;
/*ENGINE*/
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function clone(o){return JSON.parse(JSON.stringify(o))}
function workSec(r,now){return (r.segments||[]).reduce((t,[s,e])=>t+((e||now)-s),0)/1000}
function romeMin(ms){const s=new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ms));const [h,m]=s.split(":").map(Number);return h*60+m}
function closeSegAt(x,t){const s=x.segments[x.segments.length-1];if(s&&!s[1])s[1]=Math.max(s[0],t)}
/* Pausa intelligente [Stima, regole euristiche dichiarate]:
   1 scaletta del blocco (pause pianificate, spostate del ritardo d'avvio); 2 stanchezza del giorno (oltre 300/450 min cicli più brevi);
   3 interruzioni (≥2 → cicli da 35'); 4 pausa ≈ 1/5 del ciclo (5–15'), lunga ogni 3 cicli, +5' oltre 6 h; 5 niente pause a cavallo dei pasti;
   6 pause entro il margine del blocco (durata del blocco − netto rimanente); 7 nessuna pausa se il blocco o il netto finiscono entro il ciclo. */
function planCycle(r,t){const c=r.cfg||{},net=workSec(r,t)/60,remain=Math.max(0,(r.plannedMin||0)-net);
  if(r.plannedMin&&remain<0.5)return {W:0,B:0,why:"Netto pianificato raggiunto"};
  const inBlock=r.hardEnd&&t<r.hardEnd,slack=inBlock?(r.hardEnd-t)/MIN-remain:Infinity,cont=Math.max(0,(t-(r.lastRest||r.startedAt||t))/MIN);
  let W=c.work||50,B=c.brk||10,why="Durata impostata",note="",last=false;
  if(c.smart){const nx=(r.sched||[]).find(([a])=>a>t+15*MIN);
    if(nx){W=clamp(Math.round((nx[0]-t)/MIN),20,80);B=clamp(Math.round((nx[1]-nx[0])/MIN),5,20);why="Allineata alla scaletta del blocco"}
    else{const cum=(r.dayBase||0)+net;
      if(cum>=450){W-=15;why="Cicli più brevi: oltre 7 h 30 di studio oggi"}else if(cum>=300){W-=10;why="Cicli più brevi: oltre 5 h di studio oggi"}else why="Ritmo standard";
      const ints=(r.interruptions||[]).length;if(ints>=2&&W>35){W=35;why="Cicli più brevi dopo "+ints+" interruzioni"}
      if(r.fatigue){W-=10*Math.min(2,r.fatigue);why="Cicli più brevi: stanchezza segnalata da te"}
      W=Math.max(25,W);B=clamp(Math.round(W/25)*5,5,15);if(r.fatigue)B=Math.min(20,B+5);if(((r.cycle||0)+1)%3===0){B=Math.max(B,15);note=" · pausa lunga (3° ciclo)"}if(cum>=360)B+=5}}
  if(r.plannedMin&&remain<=W+10){W=Math.max(1,Math.ceil(remain));B=0;why="Ultimo ciclo: completa il netto pianificato";note="";last=true}
  if(!last&&B>0&&slack<B){const nb=Math.floor(slack);B=nb>=3?nb:0;note=B?` · pausa ridotta a ${B}′ per restare nel blocco`:""}
  if(!last&&c.smart&&B<5&&cont+W>=50){B=5;note=" · 5′ minime di pausa dopo 50′ di fila: il netto può sforare il blocco"}
  if(c.smart){const lm=romeMin(t);for(const m of [780,1140])if(lm<m&&lm+W>m-3){const w2=Math.max(5,m-lm);if(last&&remain>w2+1)note=` · mancheranno ${Math.round(remain-w2)}′ di netto, da riprendere dopo il pasto`;W=w2;B=0;why="Il ciclo finisce all'ora del pasto"}}
  if(inBlock&&t+W*MIN>r.hardEnd){const w2=Math.max(5,Math.round((r.hardEnd-t)/MIN));note=remain>w2+1?` · mancheranno ${Math.round(remain-w2)}′ di netto`:"";W=w2;B=0;why="Ultimo ciclo prima della fine del blocco"}
  if(!inBlock&&r.hardEnd)note+=" · oltre la fine del blocco";
  return {W:Math.round(W),B:Math.round(B),why:why+note}}
function startCycle(x,t){const p=planCycle(x,t);x.lastPlan=p;
  if(p.W<=0){x.phase="await";x.phaseStart=t;x.phaseEnd=null;x.awaitWhy="target";return x}
  x.segments=(x.segments||[]).concat([[t,null]]);x.phase="work";x.phaseStart=t;x.phaseEnd=t+p.W*MIN;x.curBrk=p.B;x.ext=false;x.remain=null;return x}
/* Stato derivato e deterministico: ogni dispositivo calcola le stesse transizioni dagli stessi dati. */
function advance(r,now){let x=r,ch=false;
  for(let k=0;k<60&&x&&x.status==="active";k++){
    if(x.phase==="work"&&x.cfg.auto&&x.phaseEnd&&now>=x.phaseEnd){x=ch?x:clone(x);ch=true;const t=x.phaseEnd;closeSegAt(x,t);x.cycle=(x.cycle||0)+1;
      const B=x.curBrk||0,lm=romeMin(t),meal=(lm>=780&&lm<840)||(lm>=1140&&lm<1200);
      if(B>0){x.phase="break";x.phaseStart=t;x.phaseEnd=t+B*MIN;x.breaksDone=(x.breaksDone||0)+1}
      else if(x.plannedMin&&workSec(x,t)/60>=x.plannedMin-0.5){x.phase="await";x.phaseStart=t;x.phaseEnd=null;x.awaitWhy="target"}
      else if(meal){x.phase="await";x.phaseStart=t;x.phaseEnd=null;x.awaitWhy="meal"}
      else if(x.hardEnd&&t>=x.hardEnd-60000&&x.phaseStart<x.hardEnd){x.phase="await";x.phaseStart=t;x.phaseEnd=null;x.awaitWhy="end"}
      else startCycle(x,t);continue}
    if(x.phase==="break"&&now>=x.phaseEnd){x=ch?x:clone(x);ch=true;const t=x.phaseEnd;x.lastRest=t;if(x.cfg.resume)startCycle(x,t);else{x.phase="await";x.phaseStart=t;x.phaseEnd=null;x.awaitWhy="break"}continue}
    if(x.phase==="work"&&x.hardEnd&&x.phaseStart<x.hardEnd+30*MIN&&now>=x.hardEnd+30*MIN){x=ch?x:clone(x);ch=true;closeSegAt(x,x.hardEnd+30*MIN);x.phase="paused";x.phaseStart=x.hardEnd+30*MIN;x.remain=0;x.autoStop=true;continue}
    break}
  return x}
function actPause(x,t){if(x.phase!=="work")return x;closeSegAt(x,t);x.remain=x.phaseEnd?Math.max(0,x.phaseEnd-t):null;x.phase="paused";x.phaseStart=t;x.pauses=(x.pauses||0)+1;return x}
function actResume(x,t){if((x.phase==="paused"&&t-x.phaseStart>=5*MIN)||x.phase==="await"||x.phase==="break")x.lastRest=t;if(x.phase==="paused"&&x.remain&&x.remain>60000){x.segments=x.segments.concat([[t,null]]);x.phase="work";x.phaseStart=t;x.phaseEnd=t+x.remain;x.remain=null;return x}
  if(x.phase==="break"&&t<x.phaseEnd){x.skipped=(x.skipped||0)+1}
  return startCycle(x,t)}
function actExtend(x,t){if(x.phase!=="work"||x.ext||!x.phaseEnd)return x;x.phaseEnd+=10*MIN;x.ext=true;x.extCount=(x.extCount||0)+1;return x}
/*END ENGINE*/
const $=id=>document.getElementById(id);
const SYNC=window.STUDIOOS_SYNC;
const PROGRESS=window.STUDIOOS_PROGRESS;
const DATA_PREFIX=window.STUDIOOS_DATA_PREFIX||"sfocus.";
const storageKey=k=>(k==="device"||k==="settings"?"sfocus.":DATA_PREFIX)+k;
let localSaveFailed=false;
const LS={get(k,d){try{const v=localStorage.getItem(storageKey(k));return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(storageKey(k),JSON.stringify(v));return true}catch(e){localSaveFailed=true;return false}},remove(k){try{localStorage.removeItem(storageKey(k))}catch(e){localSaveFailed=true}}};
const deviceId=LS.get("device",null)||(()=>{const d="dev-"+Math.random().toString(36).slice(2,10);LS.set("device",d);return d})();
const settings=Object.assign({work:50,brk:10,auto:true,resume:false,smart:true,sound:"soft",vol:.6,rm:false,theme:"auto",look:"auto",atmosphere:"cozy",motion:"elastic",glass:50,breathe:true,haptic:true,wake:true,night:"auto",amb:"none",ambVol:.35},LS.get("settings",{}));
let mcp=null,db=null,index={},dayEvents=[],calDay={},curDay=todayIso(),wkRef=todayIso(),runs={},errors={},syncState={},cur=null,run=null,wake=null,actx=null,stars=0,liveOK=false,lastKey="",lastSec=-1,STEPS=[];
const UA=navigator.userAgent||"";
const isApple=/iPhone|iPad|iPod|Macintosh|Mac OS X/.test(UA)&&!/Windows|Android/.test(UA);
const isIOS=/iPhone|iPad|iPod/.test(UA)||(/Macintosh/.test(UA)&&navigator.maxTouchPoints>1);
const isAndroid=/Android/.test(UA),isWin=/Windows/.test(UA);
const devName=isIOS?"iPhone/iPad":isApple?"Mac":isWin?"Windows":isAndroid?"Android":"Altro";
const bc=(()=>{try{return new BroadcastChannel("sfocus:"+DATA_PREFIX)}catch(e){return null}})();
/* ---------- utils ---------- */
function todayIso(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function addDays(iso,n){const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function monday(iso){const d=new Date(iso+"T12:00:00Z");return addDays(iso,-((d.getUTCDay()+6)%7))}
function off(iso){const m=+iso.slice(5,7);return m>=4&&m<=10?"+02:00":"+01:00"}
function at(iso,hhmm){return Date.parse(iso+"T"+hhmm+":00"+off(iso))}
function hm(ms){return new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ms))}
function fmt(sec){sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return (h?h+":"+String(m).padStart(2,"0"):String(m).padStart(2,"0"))+":"+String(s).padStart(2,"0")}
function mins(hhmm){const [h,m]=(hhmm||"0:0").split(":").map(Number);return h*60+m}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function say(t){$("announce").textContent=t}
function chip(id,cls,txt){const c=$(id);c.className="pill "+(cls||"");c.textContent=txt}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function safeUrl(u){u=String(u||"").trim();return /^https:\/\/[^\s"<>]+$/i.test(u)?u:""}
function okDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||"")?s:""}function okHM(s){return /^\d{2}:\d{2}$/.test(s||"")?s:""}function okMat(s){return SUBJ.includes(s)?s:""}
function dayLabel(iso,opt={weekday:"long",day:"numeric",month:"long"}){return new Date(iso+"T12:00:00Z").toLocaleDateString("it-IT",Object.assign({timeZone:"UTC"},opt))}
function buzz(p){if(!settings.haptic)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
function setTint(mat){document.documentElement.style.setProperty("--tint",mat&&SUBJ.includes(mat)?`var(--${mat})`:"var(--acc)")}
function toast(t,ms=3200){const d=document.createElement("div");d.className="toast";d.textContent=t;$("toasts").appendChild(d);setTimeout(()=>{d.classList.add("out");setTimeout(()=>d.remove(),320)},ms)}
function applyLook(){const g=settings.look!=="std";document.documentElement.classList.toggle("glass",g);document.documentElement.classList.toggle("std",!g);requestAnimationFrame(moveInd)}
/* ---------- connectors ---------- */
function payload(r){let p=r&&("payload" in r)?r.payload:r;if(typeof p==="string"){try{p=JSON.parse(p)}catch(e){}}if(p&&p.content&&!p.values&&!p.events)p=p.content;return p}
async function call(server,tool,input){if(!mcp)throw new Error("connettori non disponibili");return payload(await mcp.callTool(server,tool,input))}
async function sheetGet(range){const p=await call("Google Sheets","get_values",{spreadsheetId:SHEET_ID,range});return (p&&p.values)||[]}
async function loadIndex(){
  // A single consistent snapshot replaces the previous five separate requests.
  const values=await sheetGet("PROGRAMMA!A6:L427"),idx={};
  for(let k=0;k<values.length;k++){const v=values[k]||[],id=v[11];
    if(!/^R20-\d{4}$/.test(id||"")||!okDate(v[0])||!okHM(v[1])||!okHM(v[2]))continue;
    idx[id]={id,row:k+6,date:v[0],from:v[1],to:v[2],mat:okMat(v[3]),arg:v[4]||"",cons:v[5]||"",min:Math.max(0,Math.min(900,Number(v[6]||0)||0)),mats:v[7]||"",apri:safeUrl(v[8]),stato:v[9]||"",fatti:Math.max(0,Number(v[10]||0)||0)};
  }
  const changed=SYNC.fingerprint(idx)!==SYNC.fingerprint(index);
  index=idx;LS.set("index",{at:Date.now(),idx});chip("cSh","ok","Sheets ✓");
  if($("cSh"))$("cSh").title="Aggiornamento automatico · "+hm(Date.now());
  return changed;
}
function calTip(t){const c=$("cCal");if(c)c.title=t}
let dayRequest=0,daySignature="";
async function loadDay(day){
  const request=++dayRequest;
  if(!dayEvents.length&&!daySignature)$("sessions").innerHTML='<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  let cal=null,calState="",calText="Calendar: non configurato",tip="Nessun calendario scelto: Impostazioni > Collega Google Calendar";
  const calendar=CAL_ID;
  if(calendar&&mcp){try{
    const p=await call("Google Calendar","list_events",{calendarId:calendar,startTime:day+"T00:00:00",endTime:addDays(day,1)+"T00:00:00",pageSize:80,orderBy:"startTime",timeZone:"Europe/Rome"});
    if(request!==dayRequest||calendar!==CAL_ID||day!==curDay)return false;
    cal={};for(const ev of ((p&&(p.events||p.items))||[])){if(ev.status==="cancelled")continue;const m=/\[R20:(R20-\d{4})\]/.exec((ev.summary||"")+" "+(ev.description||""));if(!m)continue;
      cal[m[1]]={start:Date.parse(ev.start&&(ev.start.dateTime||ev.start.date)),end:Date.parse(ev.end&&(ev.end.dateTime||ev.end.date)),title:ev.summary||""};}
    const n=Object.keys(cal).length;calState="ok";calText=n?`Calendar ✓ ${n} eventi`:"Calendar ✓ · nessun evento";
    tip=`Letto alle ${hm(Date.now())}: ${n} eventi STUDIOOS il ${day}`;LS.set("cal."+day,cal);
  }catch(err){const em=String(err&&err.message||err),auth=/\b(401|403)\b|non attivo|autorizz|scope|Collega/i.test(em);
    calState="bad";calText=auth?"Calendar: non autorizzato":"Calendar: errore";tip="Copia locale, lettura non aggiornata: "+em.slice(0,140);cal=LS.get("cal."+day,null);
  }}else if(calendar){calState="bad";calText="Calendar: non autorizzato";tip="Accesso Google da ricollegare";}
  if(request!==dayRequest||calendar!==CAL_ID||day!==curDay)return false;
  chip("cCal",calState,calText);calTip(tip);
  calDay=cal||{};const blocks=Object.values(index).filter(b=>b.date===day);
  const next=blocks.map(b=>{const start=at(day,b.from),end=at(day,b.to),c=calDay[b.id];let flag="";
    if(cal&&b.stato!=="Rinviato"){if(!c)flag="Non ancora in Calendar";else if(Math.abs(c.start-start)>60000||Math.abs(c.end-end)>60000)flag=`Calendar ${hm(c.start)}–${hm(c.end)}: vale PROGRAMMA`;}
    return {id:b.id,mat:b.mat,start,end,title:b.arg,rinv:b.stato==="Rinviato",flag};});
  for(const [id,c] of Object.entries(calDay))if(!blocks.some(b=>b.id===id)){const b=index[id];next.push({id,mat:(b&&b.mat)||(SUBJ.find(x=>c.title.includes(x))||""),start:c.start,end:c.end,title:c.title.replace(/\s*\[R20:[^\]]+\]/,""),rinv:true,flag:b?`In PROGRAMMA il ${dayLabel(b.date,{day:"numeric",month:"short"})}: evento da riallineare`:"Non presente in PROGRAMMA",ghost:true});}
  next.sort((a,b)=>a.start-b.start);const signature=day+SYNC.fingerprint(next);
  dayEvents=next;if(signature!==daySignature){daySignature=signature;renderDay();renderStats();renderNext();renderToday();}
  return true;
}
// Schedule/Calendar changes are independent from the live timer and its outbox.
let dataReady=false,dataRefreshing=null,lastDataRefresh=0,lastDataDay=todayIso();
async function refreshData(force=false){
  if(!dataReady||!mcp||document.hidden||navigator.onLine===false)return;
  if(dataRefreshing)return dataRefreshing;
  if(Date.now()-lastDataRefresh<(force?2000:25000))return;
  lastDataRefresh=Date.now();
  dataRefreshing=(async()=>{try{
    const today=todayIso();if(today!==lastDataDay){if(curDay===lastDataDay)curDay=today;lastDataDay=today;}
    $("todayLbl").textContent=dayLabel(today);
    const changed=await loadIndex();await loadDay(curDay);
    if(changed){
      if(cur){const b=index[cur.id];if(b){Object.assign(cur,{mat:b.mat,start:at(b.date,b.from),end:at(b.date,b.to),title:b.arg,rinv:b.stato==="Rinviato"});
        $("fTitle").textContent=b.arg||b.id;$("fTime").textContent=b.from+"–"+b.to+" · "+b.id;
        if(b.cons!==LS.get("cons."+b.id,"")){applyCons(b.cons,b);LS.set("cons."+b.id,b.cons);}
      }else{cur.rinv=true;$("fFlag").textContent="Blocco rimosso dal piano · la sessione in corso è conservata";}}
      renderNext();renderToday();renderWeek();renderAnalysis();renderPlanRules();renderStats();render();
      if(curView==="registro"&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement&&document.activeElement.tagName||""))renderMats();
    }
    await loadPlan();await loadPlanMeta();if(typeof loadCareer==="function")loadCareer();
    window.dispatchEvent(new CustomEvent("studioos:data-refreshed",{detail:{at:Date.now(),changed}}));
  }catch(error){chip("cSh",Object.keys(index).length?"warn":"bad",Object.keys(index).length?"Sheets: copia locale":"Sheets: errore");if($("cSh"))$("cSh").title="Aggiornamento non riuscito: "+String(error.message||error).slice(0,160);}})();
  try{return await dataRefreshing}finally{dataRefreshing=null}
}
function refreshAll(){return Promise.allSettled([refreshData(true),refreshSync()])}
setInterval(()=>{if(!document.hidden)refreshData()},30000);
/* ---------- archive (db) ---------- */
const memoryOutbox={};
function queue(){
  let result=LS.get("queue",[]);if(!Array.isArray(result))result=[];
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(DATA_PREFIX+"outbox.")){const item=JSON.parse(localStorage.getItem(key));if(item&&item[2])result=SYNC.enqueue(result,item)}}}catch(e){}
  for(const entry of Object.values(memoryOutbox))result=SYNC.enqueue(result,entry);
  return result;
}
const wq={};let flushing=null,flushTimer=null,lastCloudSave=LS.get("cloudSavedAt",0),syncPulling=null;
async function dbSet(path,obj){if(!db)throw new Error("no db");const prev=wq[path]||Promise.resolve();const p=prev.catch(()=>{}).then(()=>db.doc(path).set(obj));wq[path]=p;return p}
function storeOutbox(entry){const op=SYNC.operation(entry);memoryOutbox[op]=clone(entry);LS.set("outbox."+op,entry);showQ()}
function acknowledgeOutbox(entry){
  const path=entry[0]+"/"+entry[1];
  const obsolete=item=>item&&item[0]+"/"+item[1]===path&&SYNC.compare(path,item[2],entry[2])<=0;
  for(const [id,item] of Object.entries(memoryOutbox))if(obsolete(item))delete memoryOutbox[id];
  try{const remove=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(DATA_PREFIX+"outbox.")&&obsolete(JSON.parse(localStorage.getItem(key))))remove.push(key)}for(const key of remove)localStorage.removeItem(key)}catch(e){}
  const legacy=LS.get("queue",[]);LS.set("queue",Array.isArray(legacy)?legacy.filter(item=>!obsolete(item)):[]);
}
function scheduleFlush(){clearTimeout(flushTimer);flushTimer=setTimeout(()=>flush(),80)}
function saveCaches(){LS.set("cacheRuns",runs);LS.set("cacheErr",errors);LS.set("cacheState",syncState)}
async function put(col,id,obj){
  obj=clone(obj);obj.updatedAt=Date.now();obj.__opId=uid();
  (col==="runs"?runs:col==="errors"?errors:syncState)[id]=obj;saveCaches();
  storeOutbox([col,id,obj]);scheduleFlush();return obj;
}
function canCloudWrite(){return !window.STUDIOOS_ADAPTER||window.STUDIOOS_ADAPTER.canWrite()}
function reportSave(){
  const n=queue().length,local=window.STUDIOOS_ADAPTER&&!canCloudWrite();
  const readOnly=window.STUDIOOS_ADAPTER&&window.STUDIOOS_ADAPTER.cloudStatus().readOnly;
  const txt=localSaveFailed?"Memoria locale piena: esporta un backup":n?(navigator.onLine===false?"Salvato qui · in attesa della rete":local?(readOnly?"Salvato qui · sincronizzazione da attivare":"Salvato qui · ricollega Google"):flushing?"Salvataggio su Google…":"Salvato qui · in coda"):(local?(readOnly?"Sola lettura · copia locale":"Accesso scaduto · ricollega Google"):lastCloudSave?"Salvato su Google · "+hm(lastCloudSave):"Pronto per sincronizzare");
  const indicator=$("syncTxt");if(indicator){indicator.textContent=txt;const relog=!!(local&&!readOnly&&window.STUDIOOS_ADAPTER);if(indicator.classList)indicator.classList.toggle("relog",relog);indicator.title=relog?"Tocca per ricollegare Google: i dati in coda restano qui":"";indicator.onclick=relog?()=>window.STUDIOOS_ADAPTER.signIn():null;if(indicator.setAttribute)indicator.setAttribute("role",relog?"button":"status")}
  const dot=$("syncDot");if(dot)dot.className="syncdot"+(!local&&!n&&!localSaveFailed&&liveOK?" on":"");
  window.dispatchEvent(new CustomEvent("studioos:sync-status",{detail:{pending:n,savedAt:lastCloudSave,localOnly:!!local,busy:!!flushing,localSaveFailed,text:txt}}));
}
async function flush(){
  if(flushing)return flushing;
  if(!db||!canCloudWrite()||navigator.onLine===false){reportSave();return}
  flushing=(async()=>{
    /* Session snapshots are acknowledged before publishing their live pointer. */
    const batch=queue().slice().sort((a,b)=>(a[0]==="state"&&a[1]==="live"?1:0)-(b[0]==="state"&&b[1]==="live"?1:0));
    for(const entry of batch){
      const [col,id,obj]=entry;
      if(!queue().some(item=>SYNC.operation(item)===SYNC.operation(entry)))continue;
      try{
        const ack=await dbSet(col+"/"+id,obj);
        if(ack&&ack.accepted===false&&ack.current){
          if(col==="runs"){runs[id]=ack.current;if(run&&run.runId===id&&SYNC.terminal(ack.current))adopt({run:null,ended:id,endedRun:ack.current},"reconcile")}
          else if(col==="state"&&id==="live")adopt(ack.current,"reconcile");
          else (col==="errors"?errors:syncState)[id]=ack.current;
        }
        /* Re-read the queue: a newer edit may have arrived during the request. */
        acknowledgeOutbox(entry);lastCloudSave=Date.now();LS.set("cloudSavedAt",lastCloudSave);saveCaches();
      }catch(e){chip("cDb","warn","Archivio: salvataggio in attesa");break}
    }
    showQ();if(!queue().length)chip("cDb","ok","Archivio ✓");
  })();
  reportSave();try{await flushing}finally{flushing=null;reportSave()}
}
function showQ(){const n=queue().length,c=$("cQ");c.hidden=!n;c.textContent=n+" in attesa";reportSave()}
async function getAll(col){const res=await db.collection(col).get();const arr=Array.isArray(res)?res:(res&&(res.docs||res.items))||[];return arr.map(d=>typeof d.data==="function"?d.data():(d&&d.data&&typeof d.data==="object"?d.data:d)).filter(Boolean)}
async function loadArchive(){
  for(const [col,tgt,key] of [["runs",runs,"runId"],["errors",errors,"id"],["state",syncState,"key"]]){
    const list=await getAll(col);for(const o of list){const k=o[key];if(k&&(!tgt[k]||SYNC.compare(col+"/"+k,o,tgt[k])>=0))tgt[k]=o}
  }
  saveCaches();chip("cDb","ok","Archivio ✓");
}
/* ---------- live sync (tutti i dispositivi e le schede) ---------- */
function syncUI(on,txt){liveOK=on;reportSave();if(!on&&!queue().length&&canCloudWrite())$("syncTxt").textContent=txt}
async function commit(x,why){
  x=clone(x);x.rev=(x.rev||0)+1;x.at=x.updatedAt=Date.now();x.by=deviceId;x.byName=devName;x.__opId=uid();
  run=x;runs[x.runId]=clone(x);saveLocal();
  const live={key:"live",run:x.status==="active"?clone(x):null,ended:x.status!=="active"?x.runId:null,
    endedStatus:x.status!=="active"?x.status:null,endedRun:x.status!=="active"?clone(x):null,at:x.at,updatedAt:x.at,by:deviceId,__opId:uid()};
  syncState.live=live;saveCaches();
  storeOutbox(["runs",x.runId,clone(x)]);storeOutbox(["state","live",live]);
  try{bc&&bc.postMessage({t:"live",live})}catch(e){}
  scheduleFlush();logSoon();
}
function adopt(live,src){
  if(!live)return;live=SYNC.normalizeLive(live,runs);const r=live.run;
  if(!r){
    const closed=live.endedRun||(live.ended&&runs[live.ended]);
    if(closed&&SYNC.terminal(closed)&&(!runs[closed.runId]||SYNC.compare("runs/"+closed.runId,closed,runs[closed.runId])>=0))runs[closed.runId]=clone(closed);
    if(run&&run.status==="active"&&live.ended===run.runId){
      if(!closed||!SYNC.terminal(closed)){refreshSync();return}
      run=null;saveLocal();saveCaches();releaseWake();render();renderDay();renderToday();renderRuns();renderStats();
      toast(closed.status==="discarded"?"Sessione scartata sull'altro dispositivo: non conta":"Sessione confermata sull'altro dispositivo");
    }
    return;
  }
  if(SYNC.terminal(runs[r.runId]))return;
  const mine=run&&run.runId===r.runId;
  if(mine&&SYNC.compare("runs/"+r.runId,r,run)<=0)return;
  if(!mine&&run&&run.status==="active"&&(run.at||0)>(r.at||0))return;
  const first=!run||run.runId!==r.runId;run=clone(r);runs[r.runId]=clone(r);saveLocal();saveCaches();
  if(first||!cur||cur.id!==r.blockId){const b=index[r.blockId];openSession(r.blockId,b&&b.date,true)}
  if(document.activeElement!==$("notes")&&r.notes!=null)$("notes").value=r.notes;
  if(live.by!==deviceId&&src!=="init")toast(first?`Sessione ${r.materia||""} in corso su ${r.byName||"un altro dispositivo"}`:`Aggiornato da ${r.byName||"un altro dispositivo"}`,2200);
  lastKey=keyOf(advance(run,Date.now()));acquireWakeIf();render();if(first&&typeof renderToday==="function")renderToday();
}
function subscribeLive(){if(!db)return;let t=setTimeout(()=>syncUI(false,"Connessione in attesa"),10000);
  try{db.doc("state/live").onSnapshot(snap=>{clearTimeout(t);syncUI(true,snap.metadata&&snap.metadata.fromCache?"Copia locale":"Connesso");if(snap.exists)adopt(snap.data(),"snap")},
    e=>{clearTimeout(t);syncUI(false,"Salvato qui · collegamento da ripristinare")})}catch(e){syncUI(false,"Salvato su questo dispositivo")}}
async function refreshSync(){
  if(syncPulling)return syncPulling;
  syncPulling=(async()=>{if(!db)return;try{await loadArchive();const s=await db.doc("state/live").get();if(s.exists)adopt(s.data(),"refresh");await flush();renderRuns();renderStats();renderToday();renderAllErr();renderReviews();renderSims();paintSteps();renderProgress()}catch(e){reportSave()}})();
  try{await syncPulling}finally{syncPulling=null}
}
bc&&(bc.onmessage=e=>{if(e.data&&e.data.t==="live")adopt(e.data.live,"bc")});

/* ---------- sessione: azioni ---------- */
function saveLocal(){LS.set("active",run&&run.status==="active"?{run}:null);saveCaches()}
function planned(c){return (index[c.id]&&index[c.id].min)||Math.round((c.end-c.start)/60000)}
function dayConfirmedMin(day,exclude){return Math.round(Object.values(runs).filter(r=>r.date===day&&r.status==="confirmed"&&r.runId!==exclude).reduce((t,r)=>t+workSec(r,Date.now())+(r.declaredExtraSec||0),0)/60)}
function schedFor(c,startAt){const b=index[c.id];if(!b||!STEPS.length)return[];const shift=Math.max(0,startAt-at(b.date,b.from));
  return STEPS.filter(s=>s.pause).map(s=>[at(b.date,s.a)+shift,at(b.date,s.b)+shift])}
async function startRun(){if(!cur||cur.rinv)return;if(run&&run.status==="active"){toast("C'è già una sessione in corso");return}unlockAudio();const now=Date.now();
  let x={runId:uid(),blockId:cur.id,date:todayIso(),materia:cur.mat,plannedMin:planned(cur),startedAt:now,segments:[],phase:"await",status:"active",device:deviceId,
    cfg:{work:settings.work,brk:settings.brk,auto:settings.auto,resume:settings.resume,smart:settings.smart},planKey:index[cur.id]?PROGRESS.planKey(index[cur.id]):null,interruptions:[],pauses:0,cycle:0,breaksDone:0,skipped:0,extCount:0,declaredExtraSec:0,
    notes:$("notes").value||"",steps:LS.get("steps."+cur.id,[]),dayBase:dayConfirmedMin(todayIso()),hardEnd:cur.end&&cur.end>now?cur.end:null,sched:schedFor(cur,now),rev:0};
  startCycle(x,now);lastKey=keyOf(x);await commit(x,"start");acquireWakeIf();buzz(18);say("Sessione avviata");if(x.lastPlan)toast(`Ciclo di ${x.lastPlan.W}′ · ${x.lastPlan.why}`)}
function act(fn,label){if(!run||run.status!=="active")return;const now=Date.now();const x=clone(advance(run,now));fn(x,now);lastKey=keyOf(x);commit(x,label);buzz(12);render()}
function pauseRun(){if(!run)return;const d=advance(run,Date.now());if(d.phase==="work")act(actPause,"pause");else act(actResume,"resume")}
function extendRun(){act(actExtend,"extend");toast("+10 minuti a questo ciclo")}
function keyOf(x){return x?x.phase+"|"+x.phaseStart:""}
/* ---------- render (rAF, solo con pagina visibile) ---------- */
const C1=2*Math.PI*132,C2=2*Math.PI*114;
function frame(){frame.handle=null;frame.timer=null;const now=Date.now();let d=run&&run.status==="active"?advance(run,now):null;
  if(d&&d!==run){const k=keyOf(d);if(k!==lastKey){const fresh=now-(d.phaseStart||0)<15000;lastKey=k;if(fresh)onTransition(d)}
    if(!frame.pend&&(!run.by||run.by===deviceId)){frame.pend=setTimeout(()=>{frame.pend=null;if(!run||run.status!=="active")return;const dd=advance(run,Date.now());if(dd!==run&&document.visibilityState==="visible")commit(clone(dd),"auto")},400+Math.random()*2200)}}
  if(d&&d.phase==="work"&&d.phaseEnd&&d.cfg&&d.cfg.auto){const rem=d.phaseEnd-now;if(rem<=60000&&rem>50000&&frame.warn!==d.phaseEnd){frame.warn=d.phaseEnd;if(document.visibilityState==="visible")tone("soft");toast(d.curBrk?"Pausa tra 1 minuto: chiudi il passaggio":"Fine del ciclo tra 1 minuto")}}
  const sec=Math.floor(now/1000);if(sec!==lastSec||frame.lastRing==null||now-frame.lastRing>=1000/60-1){paintRing(d,now);frame.lastRing=now}if(sec!==lastSec){lastSec=sec;paintText(d,now)}
  if(document.visibilityState==="visible"){
    const smooth=d&&d.phase==="work"&&$("v-focus").classList.contains("on")&&!settings.rm&&!matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(smooth)frame.handle=requestAnimationFrame(frame);
    else frame.timer=setTimeout(()=>{frame.timer=null;frame.handle=requestAnimationFrame(frame)},1000-Date.now()%1000);
  }else frame.idle=true}
function onTransition(d){const msg=d.phase==="break"?`Pausa di ${Math.round((d.phaseEnd-d.phaseStart)/MIN)}′`:d.phase==="work"?"Si riparte":d.awaitWhy==="target"?"Netto pianificato raggiunto: concludi o continua":d.awaitWhy==="end"?"Fine del blocco":d.awaitWhy==="meal"?"Ora del pasto: riprendi dopo":"Pausa finita: premi Riprendi";
  alarm(msg);buzz([60,80,60]);toast(msg)}
function phaseInfo(d,now){if(!d)return {main:0,frac:0,ph:cur?(cur.rinv?"Blocco rinviato: non eseguire":"Pronto"):"Scegli una sessione",up:false};
  if(d.phase==="work"){if(d.phaseEnd&&d.cfg.auto){const tot=d.phaseEnd-d.phaseStart,el=now-d.phaseStart;return {main:Math.max(0,(d.phaseEnd-now)/1000),frac:clamp(el/tot,0,1),ph:"Studio"}}
    const tot=d.phaseEnd?d.phaseEnd-d.phaseStart:d.cfg.work*MIN,el=now-d.phaseStart;return {main:el/1000,frac:clamp(el/tot,0,1),ph:el>tot?"Studio · pausa consigliata":"Studio",up:true}}
  if(d.phase==="break"){const tot=d.phaseEnd-d.phaseStart;return {main:Math.max(0,(d.phaseEnd-now)/1000),frac:clamp((now-d.phaseStart)/tot,0,1),ph:"Pausa"}}
  if(d.phase==="paused")return {main:(d.remain||0)/1000,frac:0,ph:d.autoStop?"Fermato a fine blocco":"In pausa"};
  return {main:0,frac:1,ph:d.awaitWhy==="target"?"Netto raggiunto":d.awaitWhy==="end"?"Fine blocco":d.awaitWhy==="meal"?"Ora del pasto":"Pausa finita"}}
function paintRing(d,now){const p=phaseInfo(d,now),pl=cur?planned(cur):(d?d.plannedMin:0),net=d?workSec(d,now):0;
  $("ringPh").style.strokeDasharray=C1;$("ringPh").style.strokeDashoffset=C1*(1-p.frac);
  $("ringNet").style.strokeDasharray=C2;$("ringNet").style.strokeDashoffset=C2*(1-(pl?Math.min(1,net/60/pl):0));
}
function paintText(d,now){const p=phaseInfo(d,now),pl=cur?planned(cur):(d?d.plannedMin:0),net=d?workSec(d,now):0;
  if(window.STUDIOOS_LIQUID)window.STUDIOOS_LIQUID.update({subject:(d&&d.materia)||(cur&&cur.mat)||"",progress:pl?Math.min(1,net/60/pl):0,phase:d?(d.phase||"work"):"idle",active:!!d});
  $("timer").textContent=fmt(p.main);$("phase").textContent=p.ph;
  $("netInfo").textContent="Netto "+Math.floor(net/60)+" / "+pl+" min"+(d&&d.declaredExtraSec?" (+"+Math.round(d.declaredExtraSec/60)+" dichiarati)":"");
  $("breath").hidden=!(d&&d.phase==="break"&&settings.breathe);
  $("nextInfo").textContent=d?(d.phase==="work"&&d.phaseEnd?(d.cfg.auto?"pausa alle ":"pausa consigliata alle ")+hm(d.phaseEnd):d.phase==="break"?(settings.breathe?(Math.floor(now/4000)%2?"espira":"inspira")+" · ":"")+"riprendi alle "+hm(d.phaseEnd):"—"):(cur?"blocco "+hm(cur.start)+"–"+hm(cur.end):"—");
  const pln=d&&d.lastPlan;$("planInfo").innerHTML=d?(d.phase==="work"&&pln?`Ciclo <b>${pln.W}′</b>${pln.B?` → pausa <b>${pln.B}′</b>`:" senza pausa"} · ${esc(pln.why)}`:d.phase==="break"?"Alzati, bevi, guarda lontano: niente schermi":""):"";
  const active=!!d;$("bTired").disabled=!active;$("bStart").disabled=!cur||active||!!(cur&&cur.rinv);$("bPause").disabled=!active;$("bInt").disabled=!active;$("bDone").disabled=!active;
  $("bPause").textContent=active&&d.phase!=="work"?(d.phase==="break"?"Salta pausa":"Riprendi"):"Pausa";
  const ex=active&&d.phase==="work"&&!d.ext&&d.phaseEnd&&d.cfg.auto&&(d.phaseEnd-now)<5*MIN;$("bExt").hidden=!ex;$("bExt").disabled=!ex;
  document.title=(active?fmt(p.main)+" · ":"")+"STUDIOOS Focus";
  const isl=$("island"),showI=active&&(!$("v-focus").classList.contains("on")||window.scrollY>260)&&!$("standby").classList.contains("on");
  isl.classList.toggle("on",showI);isl.classList.toggle("brk",active&&d.phase==="break");if(showI){$("isPh").textContent=p.ph;$("isT").textContent=fmt(p.main)}
  if($("standby").classList.contains("on"))paintStandby(d,now,p,net,pl);
  if(sec30())markStep()}
function sec30(){return Math.floor(Date.now()/1000)%30===0}
function render(){lastSec=-1;paintRing(run&&run.status==="active"?advance(run,Date.now()):null,Date.now());paintText(run&&run.status==="active"?advance(run,Date.now()):null,Date.now())}
/* ---------- StandBy ---------- */
let sbFace=0,sbWid=0;
function nightOn(){if(settings.night==="on")return true;if(settings.night==="off")return false;const m=romeMin(Date.now());return m>=1320||m<420}
function openStandby(){const s=$("standby");s.classList.add("on");s.classList.toggle("night",nightOn());acquireWake();try{document.documentElement.requestFullscreen&&!document.fullscreenElement&&document.documentElement.requestFullscreen().catch(()=>{})}catch(e){}try{screen.orientation&&screen.orientation.lock&&screen.orientation.lock("landscape").catch(()=>{})}catch(e){}render()}
function closeStandby(){$("standby").classList.remove("on","ctl");try{document.fullscreenElement&&document.exitFullscreen()}catch(e){}if(!(run&&run.status==="active"))releaseWake()}
function paintStandby(d,now,p,net,pl){const big=$("sbBig");
  if(sbFace===1||!d){$("sbLblL").textContent="Ora";big.textContent=hm(now);$("sbSub").textContent=dayLabel(todayIso())}else{$("sbLblL").textContent=p.ph;big.textContent=fmt(p.main);$("sbSub").textContent=(cur?cur.mat+" · ":"")+(d.phaseEnd?(d.phase==="break"?"riprendi alle ":"pausa alle ")+hm(d.phaseEnd):"")}
  const mat=(d&&d.materia)||(cur&&cur.mat)||"",col=$("standby").classList.contains("night")?"#ff453a":`var(--${mat||"acc"},#0a84ff)`;
  const inner=$("sbInner");if(sbWid!==3)inner.dataset.h="";
  if(sbWid===0){$("sbLblR").textContent="Avanzamento";const r1=2*Math.PI*90,r2=2*Math.PI*70,f=p.frac,nf=pl?Math.min(1,net/60/pl):0;
    inner.innerHTML=`<svg id="sbRing" viewBox="0 0 220 220" style="transform:rotate(-90deg)"><circle cx="110" cy="110" r="90" stroke="#2c2c2e" stroke-width="16"/><circle cx="110" cy="110" r="90" stroke="${col}" stroke-width="16" stroke-dasharray="${r1}" stroke-dashoffset="${r1*(1-f)}"/><circle cx="110" cy="110" r="70" stroke="#1c1c1e" stroke-width="8"/><circle cx="110" cy="110" r="70" stroke="${col}" stroke-opacity=".55" stroke-width="8" stroke-dasharray="${r2}" stroke-dashoffset="${r2*(1-nf)}"/></svg><div class="big2">${Math.floor(net/60)}/${pl} min</div>`}
  else if(sbWid===1){$("sbLblR").textContent="Giornata";const act=dayEvents.filter(e=>!e.rinv);inner.innerHTML=act.map(e=>`<div style="display:flex;gap:10px;align-items:center;font-size:1.05rem;opacity:${e.end<now?.45:1}"><i style="width:10px;height:10px;border-radius:50%;background:${$("standby").classList.contains("night")?"#ff453a":`var(--${e.mat})`}"></i><b style="font-variant-numeric:tabular-nums">${hm(e.start)}</b> ${esc(e.mat)}</div>`).join("")||"Nessun blocco"}
  else if(sbWid===3){$("sbLblR").textContent="Checklist";const i=curStepIdx(),it=cur?ckGet(cur.id).items||[]:[],s=STEPS[i];const nx=STEPS.find((x,j)=>j>i&&!x.pause&&(it[j]||0)!==2);
    const h=s?`<div class="sbck"><div style="color:#8e8e93">${s.a?s.a+"–"+s.b:""} ${esc(s.k||"")} · ${CK[it[i]||0]}</div><div>${esc(s.t)}</div>${nx?`<div style="color:#8e8e93;margin-top:8px">Poi: ${esc(nx.t.slice(0,80))}</div>`:""}<button data-sbck="${i}">Fatto ✓</button></div>`:`<div class="sbck">${cur?"Checklist completata o assente":"Nessun blocco aperto"}</div>`;if(inner.dataset.h!==h){inner.innerHTML=h;inner.dataset.h=h}}
  else{$("sbLblR").textContent="Prossimo";const n=nextBlock();inner.innerHTML=n?`<div class="big2">${esc(n.b.from)}</div><div style="font-size:1.1rem">${esc(n.b.mat)} · ${n.b.min} min</div><div style="color:#8e8e93;max-width:28ch">${esc(n.b.arg)}</div>`:"Nessun blocco futuro"}
  $("sbPause").textContent=d&&d.phase!=="work"?(d.phase==="break"?"Salta pausa":"Riprendi"):"Pausa";$("sbExt").hidden=!(d&&d.phase==="work"&&!d.ext&&d.phaseEnd)}
setInterval(()=>{const g=$("sbGrid");if($("standby").classList.contains("on")){g.style.transform=`translate(${Math.round(Math.random()*12-6)}px,${Math.round(Math.random()*12-6)}px)`;$("standby").classList.toggle("night",nightOn())}},60000);
$("sbLeft").addEventListener("click",e=>{e.stopPropagation();sbFace=(sbFace+1)%2;render();buzz(6)});
$("sbRight").addEventListener("click",e=>{e.stopPropagation();const b=e.target.closest("[data-sbck]");if(b){cycleStep(+b.dataset.sbck,2);$("sbInner").dataset.h="";render();return}sbWid=(sbWid+1)%4;$("sbInner").dataset.h="";render();buzz(6)});
$("standby").addEventListener("click",()=>{$("standby").classList.toggle("ctl")});
$("sbPause").onclick=e=>{e.stopPropagation();pauseRun()};$("sbExt").onclick=e=>{e.stopPropagation();extendRun()};
$("sbNight").onclick=e=>{e.stopPropagation();$("standby").classList.toggle("night")};$("sbExit").onclick=e=>{e.stopPropagation();closeStandby()};
/* ---------- audio / notify / wake ---------- */
function unlockAudio(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume&&actx.resume()}catch(e){}}
function tone(kind){if(!actx||kind==="none"||settings.vol<=0)return;const seq=kind==="alarm"?[[880,.15,"square"],[0,.1],[880,.15,"square"],[0,.1],[880,.3,"square"]]:kind==="bell"?[[784,1.4,"triangle"]]:[[660,.25,"sine"],[880,.45,"sine"]];
  let t=actx.currentTime;for(const [f,d,w] of seq){if(f){const o=actx.createOscillator(),g=actx.createGain();o.type=w;o.frequency.value=f;g.gain.setValueAtTime(settings.vol*.4,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(actx.destination);o.start(t);o.stop(t+d)}t+=d}}
function alarm(msg){if(document.visibilityState==="visible")tone(settings.sound);say(msg);try{if(window.Notification&&Notification.permission==="granted")new Notification("STUDIOOS Focus",{body:msg,tag:"sfocus"})}catch(e){}}
async function acquireWake(){try{if(navigator.wakeLock&&!wake){wake=await navigator.wakeLock.request("screen");wake.addEventListener&&wake.addEventListener("release",()=>{wake=null})}}catch(e){wake=null}}
function acquireWakeIf(){if(settings.wake&&run&&run.status==="active")acquireWake()}
function releaseWake(){try{wake&&wake.release()}catch(e){}wake=null}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){acquireWakeIf();refreshAll();checkGap();renderNext();if(frame.idle){frame.idle=false;requestAnimationFrame(frame)}}else{if(frame.handle)cancelAnimationFrame(frame.handle);clearTimeout(frame.timer);frame.idle=true;persistSession();LS.set("seen",Date.now());logNow()}});
setInterval(()=>{if(document.visibilityState==="visible")LS.set("seen",Date.now())},20000);
function checkGap(){if(!run||run.status!=="active")return;const seen=LS.get("seen",0),d=advance(run,Date.now());if(!seen||d.phase!=="work")return;const gap=Date.now()-seen;
  if(gap<20*MIN||(run.at||0)>seen||run.by!==deviceId)return;const b=$("recover");b.hidden=false;
  b.innerHTML=`Nessun dispositivo ha usato Focus dalle ${hm(seen)} e il timer ha continuato a contare (${Math.round(gap/MIN)} min). <div class="row" style="margin-top:8px"><button class="btn primary" id="rgKeep">Stavo studiando: conta</button><button class="btn" id="rgCut">Conta solo fino alle ${hm(seen)}</button></div>`;
  $("rgKeep").onclick=()=>{b.hidden=true};$("rgCut").onclick=()=>{b.hidden=true;act((x)=>{actPause(x,seen)},"cut")}}
/* ---------- sessions ---------- */
function netForBlock(id){const iv=[];let extra=0;for(const r of Object.values(runs)){if(r.blockId!==id||r.status!=="confirmed")continue;extra+=r.declaredExtraSec||0;for(const [s,e] of r.segments||[])if(e)iv.push([s,e])}
  iv.sort((a,b)=>a[0]-b[0]);let tot=0,cs=null,ce=null;for(const [s,e] of iv){if(cs===null){cs=s;ce=e}else if(s<=ce)ce=Math.max(ce,e);else{tot+=ce-cs;cs=s;ce=e}}if(cs!==null)tot+=ce-cs;return tot/1000+extra}
function statusOf(id){const b=index[id]||{};return {sheet:b.stato||"",sheetMin:b.fatti||0,focusMin:Math.round(netForBlock(id)/60)}}
function sessHTML(e,compact){const st=statusOf(e.id),b=index[e.id]||{},now=Date.now(),isNow=now>=e.start&&now<e.end&&!e.rinv,done=/Verificato|Affrontato|Da consolidare/.test(st.sheet),live=run&&run.status==="active"&&run.blockId===e.id;
  return `<div class="sess${isNow||live?" now":""}${done||e.rinv?" done":""}"><span class="stripe" style="background:${e.rinv?"var(--line)":`var(--${esc(e.mat)},#888)`}"></span>
  <div><div><span class="t">${hm(e.start)}–${hm(e.end)}</span> · <b>${esc(e.mat)}</b> <span class="mute">${b.min?b.min+" min":""}${e.rinv&&!e.ghost?" · rinviato":""}${live?" · in corso":""}</span></div>
  <div class="${compact?"mute":""}">${esc(e.title||e.id)}</div>
  ${compact?"":`<div class="mute small">Registro: ${esc(st.sheet||"—")}${st.sheetMin?" ("+st.sheetMin+" min)":""} · Focus: ${st.focusMin} min confermati${st.focusMin&&st.focusMin!==st.sheetMin?` · <a href="#" data-reg="${e.id}">scrivi nel registro</a>`:""}</div>`}
  ${e.flag?`<div class="flag">${esc(e.flag)}</div>`:""}</div>
  <button class="btn" data-open="${e.id}" ${e.rinv?"disabled":""}>Apri</button></div>`}
function timeline(el,evs){const S=420,E=1350,span=E-S,p=x=>Math.max(0,Math.min(100,(x-S)/span*100));
  let h=[[780,840],[1140,1200]].map(([a,b])=>`<span class="meal" style="left:${p(a)}%;width:${p(b)-p(a)}%"></span>`).join("");
  for(const e of evs){if(e.rinv)continue;const a=mins(hm(e.start)),b=mins(hm(e.end));h+=`<b style="left:${p(a)}%;width:${Math.max(.6,p(b)-p(a))}%;background:var(--${e.mat},#888)" title="${hm(e.start)}–${hm(e.end)} ${esc(e.mat)}"></b>`}
  if(curDay===todayIso()){const n=romeMin(Date.now());if(n>=S&&n<=E)h+=`<span class="nowl" style="left:${p(n)}%"></span>`}el.innerHTML=h}
function renderDay(){const lbl=dayLabel(curDay);$("dLabel").textContent=lbl;$("miniLbl").textContent=curDay===todayIso()?"Oggi":lbl;
  const act=dayEvents.filter(e=>!e.rinv),pl=act.reduce((t,e)=>t+((index[e.id]||{}).min||0),0),reg=act.reduce((t,e)=>t+Math.max(statusOf(e.id).sheetMin,statusOf(e.id).focusMin),0);
  $("dayKpi").innerHTML=`<div class="kpi"><b>${act.length}</b><span>blocchi attivi</span></div><div class="kpi"><b>${Math.floor(pl/60)}h ${String(pl%60).padStart(2,"0")}</b><span>netti pianificati</span></div><div class="kpi"><b>${reg}</b><span>min registrati</span></div><div class="kpi"><b>${dayEvents.filter(e=>e.flag).length}</b><span>da controllare in Calendar</span></div>`;
  const historical=dayEvents.filter(e=>e.rinv);
  $("sessions").innerHTML=(act.length?act.map(e=>sessHTML(e,false)).join(""):'<p class="mute">Nessun blocco attivo in questo giorno.</p>')+(historical.length?`<details class="past-sessions"><summary>${historical.length} blocchi rinviati o da riallineare</summary><div>${historical.map(e=>sessHTML(e,false)).join("")}</div></details>`:"");
  $("mini").innerHTML=act.length?act.map(e=>sessHTML(e,true)).join(""):'<p class="mute">Nessun blocco attivo.</p>';
  timeline($("tlDay"),dayEvents);timeline($("tlMini"),dayEvents)}
function nextBlock(){const now=Date.now(),today=todayIso();return Object.values(index).filter(b=>b.stato!=="Rinviato"&&b.date>=today).map(b=>({b,s:at(b.date,b.from),e:at(b.date,b.to)})).filter(x=>x.e>now).sort((x,y)=>x.s-y.s)[0]}
function renderNext(){const now=Date.now(),today=todayIso(),x=nextBlock(),el=$("nextBody");if(!x){el.innerHTML='<p class="mute">Nessun blocco futuro in PROGRAMMA.</p>';return}const live=now>=x.s;
  const dt=Math.round((x.s-now)/60000),when=live?`in corso fino alle ${hm(x.e)}`:dt<120?`tra ${dt} min`:x.b.date===today?`alle ${x.b.from}`:`${dayLabel(x.b.date,{weekday:"short",day:"numeric",month:"short"})} alle ${x.b.from}`;
  el.innerHTML=`<div class="row"><span class="pill subj" style="background:var(--${x.b.mat})">${esc(x.b.mat)}</span><b class="sp">${esc(when)}</b><span class="mute">${x.b.min} min</span></div><div>${esc(x.b.arg)}</div><div class="row"><button class="btn primary" data-go="${x.b.id}" data-day="${x.b.date}">${live?"Apri e avvia":"Apri"}</button><span class="mute small">${x.b.from}–${x.b.to}</span></div>`}
async function openSession(id,dayHint,quiet){if(run&&run.status==="active"&&run.blockId!==id&&!quiet){toast("Concludi o interrompi prima la sessione in corso");return}
  if(dayHint&&dayHint!==curDay){curDay=dayHint;await loadDay(curDay)}
  const b=index[id]||{};cur=dayEvents.find(e=>e.id===id)||{id,mat:b.mat,start:b.date?at(b.date,b.from):Date.now(),end:b.date?at(b.date,b.to):Date.now(),title:b.arg};
  setTint(cur.mat);$("fSub").textContent=cur.mat||"—";$("fSub").className="pill subj";$("fSub").style.background=`var(--${cur.mat},#888)`;
  $("fTitle").textContent=cur.title||id;$("fTime").textContent=hm(cur.start)+"–"+hm(cur.end)+" · "+id;$("fFlag").textContent=cur.flag||"";
  $("detail").hidden=false;$("dCons").textContent="Caricamento della consegna da PROGRAMMA…";$("dCrit").textContent="";
  $("notes").value=run&&run.blockId===id&&run.notes?run.notes:LS.get("notes."+id,"");renderErrors();render();if(!quiet)show("focus");
  const fromSnapshot=typeof b.cons==="string",cached=fromSnapshot?b.cons:LS.get("cons."+id,"");
  if(fromSnapshot||cached){$("dMat").textContent=b.mats||"";applyCons(cached,b);LS.set("cons."+id,cached)}
  if(fromSnapshot)return; // The complete PROGRAMMA snapshot also works offline.
  if(b.row&&mcp){try{const [ef,h]=await Promise.all([sheetGet(`PROGRAMMA!E${b.row}:F${b.row}`),sheetGet(`PROGRAMMA!H${b.row}`)]);const arg=(ef[0]||[])[0]||"",cons=(ef[0]||[])[1]||"";
    if(!cur||cur.id!==id)return;
    $("fTitle").textContent=arg||id;$("dMat").textContent=(h[0]||[])[0]||"";applyCons(cons,b);LS.set("cons."+id,cons)}
  catch(e){if(!cached)$("dCons").textContent="Consegna non leggibile ora (Sheets non raggiungibile). Usa la descrizione dell'evento in Calendar."}}
  else if(!cached)$("dCons").textContent="Consegna non disponibile senza connessione a Sheets."}
function applyCons(cons,b){$("dCons").textContent=cons;renderDetailMats(b.mats||$("dMat").textContent||"",b);const a=$("dOpen"),u=safeUrl(b.apri);a.href=u||"#";a.hidden=!u;
  const crit=cons.split("\n").filter(l=>/^(Verifica|VERIFICA|SIMULAZIONE|REGOLA)/.test(l.trim())).join("\n");$("dCrit").textContent=crit||"Vedi la consegna completa.";cur.crit=$("dCrit").textContent;buildSteps(cons)}
/* ---------- scaletta ---------- */
const CK=["Da iniziare","In corso","Completato","Parziale","Da recuperare"];
let stepsPaintKey="";
function stepKind(t){return PROGRESS.kind(t)}
function ckGet(id){const s=syncState["chk_"+id],l=LS.get("chk."+id,null);let o=s&&l?((s.updatedAt||0)>=(l.updatedAt||0)?s:l):(s||l);
  if(!o){const old=LS.get("steps."+id,[]);o={key:"chk_"+id,id,items:old.map(v=>v?2:0),updatedAt:0}}return o}
function currentChecklist(){return PROGRESS.resolve(ckGet(cur.id),STEPS)}
async function ckSet(id,items,types){const list=cur&&cur.id===id?STEPS:PROGRESS.steps((index[id]||{}).cons,(index[id]||{}).min),previous=ckGet(id),old=PROGRESS.resolve(previous,list),o={key:"chk_"+id,id,items,types:types||old.types,taskKeys:PROGRESS.keys(list),by:deviceId};if(old.legacy)o.previousChecklist={items:previous.items,updatedAt:previous.updatedAt};else if(previous.previousChecklist)o.previousChecklist=previous.previousChecklist;o.updatedAt=Date.now();LS.set("chk."+id,o);try{await put("state","chk_"+id,o)}catch(e){syncState["chk_"+id]=o}
  if(run&&run.blockId===id&&run.status==="active"){const x=clone(run);x.steps=items.map(v=>v===2);commit(x,"steps")}}
function buildSteps(cons){STEPS=PROGRESS.steps(cons,cur&&(index[cur.id]||{}).min);
  $("scalettaCard").hidden=!STEPS.length;paintSteps()}
function paintSteps(){if(!cur)return;const record=currentChecklist(),it=record.items,signature=SYNC.fingerprint({id:cur.id,steps:STEPS,record});if(signature===stepsPaintKey){markStep();return}stepsPaintKey=signature;const active=document.activeElement,focusSelector=active&&$("steps").contains(active)?active.hasAttribute("data-ck")?`[data-ck="${active.dataset.ck}"]`:active.hasAttribute("data-type")?`[data-type="${active.dataset.type}"]`:null:null;
  $("steps").innerHTML=STEPS.map((s,i)=>{const st=it[i]||0,c=PROGRESS.category(s),select=s.pause||s.verify?"":`<label class="step-type">Tipo <select data-type="${i}" aria-label="Tipo del passaggio ${i+1}">${[["",`Automatico [Stima] · ${{theory:"teoria",practice:"pratica",exam:"esame"}[c]||"da classificare"}`],["theory","Teoria"],["practice","Pratica"],["exam","Esame · prova"]].map(([v,t])=>`<option value="${v}" ${record.types[i]===v?"selected":""}>${t}</option>`).join("")}</select></label>`;return `<li class="${s.pause?"pause":""}${st===2?" ck2":""}" data-i="${i}">${s.pause?"<span></span>":`<button class="ckb s${st}" data-ck="${i}" aria-label="Stato del passaggio: ${CK[st]}">${CK[st]}</button>`}<div><span class="tm">${s.a?s.a+"–"+s.b:(s.min?s.min+"′":"")}</span>${s.k?`<span class="kind">${s.k}</span>`:""}${esc(s.t)}${select}</div></li>`}).join("")+(record.legacy?'<li class="checklist-legacy"><p>Questa checklist precedente non identifica i contenuti. Controlla che corrisponda alla scaletta attuale prima di usarla nelle percentuali.</p><button class="btn" id="ckBind">Confermo la corrispondenza</button></li>':"");markStep();if(focusSelector)$("steps").querySelector(focusSelector)?.focus({preventScroll:true})}
function markStep(){if(!STEPS.length||!cur)return;const n=romeMin(Date.now()),today=cur.start&&todayIso(new Date(cur.start))===todayIso();const it=currentChecklist().items;let done=0,rec=0;
  const shift=run&&run.blockId===cur.id&&run.status==="active"?Math.max(0,Math.round((run.startedAt-cur.start)/MIN)):0;
  document.querySelectorAll("#steps li[data-i]").forEach(li=>{const i=+li.dataset.i,s=STEPS[i];li.classList.toggle("cur",!!(today&&s.a&&n>=mins(s.a)+shift&&n<mins(s.b)+shift));if(it[i]===2&&!s.pause)done++;if(it[i]===4&&!s.pause)rec++});
  $("stepCount").textContent=`${done}/${STEPS.filter(s=>!s.pause).length} completati${rec?` · ${rec} da recuperare`:""}${shift?` · scaletta spostata di ${shift}′`:""}`}
function curStepIdx(){if(!STEPS.length||!cur)return -1;const it=currentChecklist().items,li=document.querySelector("#steps li.cur");if(li&&!STEPS[+li.dataset.i].pause)return +li.dataset.i;return STEPS.findIndex((s,i)=>!s.pause&&(it[i]||0)!==2)}
async function cycleStep(i,to){if(!cur)return;const o=currentChecklist(),it=o.items.slice();while(it.length<STEPS.length)it.push(0);it[i]=to==null?((it[i]||0)+1)%5:to;await ckSet(cur.id,it,o.types);buzz(8);paintSteps();renderToday();renderProgress()}
$("steps").addEventListener("click",async e=>{const b=e.target.closest("[data-ck]");if(b)cycleStep(+b.dataset.ck);if(e.target.id==="ckBind"&&cur){const old=ckGet(cur.id);await ckSet(cur.id,STEPS.map((s,i)=>old.items?.[i]||0));paintSteps();renderProgress()}});
$("steps").addEventListener("change",async e=>{if(!e.target.matches("[data-type]")||!cur)return;const r=currentChecklist();r.types[+e.target.dataset.type]=e.target.value;await ckSet(cur.id,r.items,r.types);renderProgress()});
/* ---------- completion & register ---------- */
function openDone(){if(!run||run.status!=="active")return;const now=Date.now();let x=clone(advance(run,now));if(x.phase==="work"){actPause(x,now);commit(x,"pause")}const net=workSec(x,now);
  $("mdInfo").textContent=`Tempo netto misurato: ${Math.floor(net/60)} min su ${x.plannedMin} pianificati, ${x.cycle||0} cicli, ${x.breaksDone||0} pause. Il tempo da solo non completa il blocco: scegli l'esito in base alla prova.`;
  $("mdCrit").textContent=cur&&cur.crit||"";stars=0;drawStars();openSheet("mDone");$("mdOut").focus()}
function drawStars(){$("mdStars").innerHTML=[1,2,3,4,5].map(n=>`<button class="btn ${n<=stars?"primary":""}" role="radio" aria-checked="${n===stars}" data-s="${n}">${n}</button>`).join("")}
$("mdStars").addEventListener("click",e=>{const b=e.target.closest("[data-s]");if(b){stars=+b.dataset.s;drawStars();buzz(6)}});
async function confirmRun(){const out=$("mdOut").value,ev=$("mdEv").value.trim();
  if(out==="Verificato autonomamente"&&(!ev||!$("mdSelf").checked)){$("mdInfo").textContent="Per «Verificato autonomamente» servono la prova osservabile e la conferma di averla svolta senza aiuti.";return}
  if(!run||run.status!=="active")return;clearTimeout(window.__nt);const x=clone(advance(run,Date.now()));if(x.phase==="work")actPause(x,Date.now());
  const study={diff:$("mdDiff").value.trim(),redo:$("mdRedo").value.trim(),review:$("mdRev").value.trim()};
  Object.assign(x,{status:"confirmed",outcome:out,evidence:ev,selfCheck:$("mdSelf").checked,focusScore:stars||null,notes:$("notes").value,study,confirmedAt:Date.now(),phase:"done"});
  await commit(x,"confirm");closeSheet("mDone");releaseWake();const id=x.blockId;run=null;saveLocal();LS.set("notes."+id,"");
  $("mdEv").value="";$("mdSelf").checked=false;$("mdDiff").value="";$("mdRedo").value="";$("mdRev").value="";
  for(const [k,lab] of [["redo","Da rifare"],["review","Da ripassare"]])if(study[k]){const e={id:uid(),blockId:id,runId:x.runId,materia:x.materia,text:lab+": "+study[k],fix:study.diff||"",at:Date.now()};await put("errors",e.id,e)}
  buzz([20,40,20]);renderDay();renderStats();renderRuns();renderWeek();render();renderToday();renderProgress();toast("Sessione confermata");logNow();askRegister(id,out)}
async function dropRun(){if(!run||run.status!=="active")return;clearTimeout(window.__nt);const x=clone(run);if(cur&&cur.id===x.blockId)x.notes=$("notes").value;x.status="discarded";x.phase="done";await commit(x,"discard");closeSheet("mDone");releaseWake();run=null;saveLocal();render();renderDay();logNow()}
let regCtx=null;
async function askRegister(id,out){const b=index[id];if(!b)return;const focusMin=Math.round(netForBlock(id)/60);let sh;
  try{sh=await sheetGet(`PROGRAMMA!J${b.row}:L${b.row}`)}catch(e){$("mrInfo").textContent="Sheets non raggiungibile: la sessione resta nell'archivio Focus e potrai scriverla dopo.";regCtx=null;openSheet("mReg");return}
  const r=sh[0]||[];if(r[2]!==id){$("mrInfo").textContent="La riga del registro non corrisponde più all'ID: aggiorna i dati. Nessuna scrittura.";regCtx=null;openSheet("mReg");return}
  const sheetMin=Number(r[1]||0),last=(syncState["sync_"+id]||{}).min||0,conflict=sheetMin!==last;const st=out||lastOutcome(id)||r[0];regCtx={id,row:b.row,min:focusMin,st,sheetMin};
  $("mrInfo").innerHTML=`Blocco <b>${esc(id)}</b> (riga ${b.row}). Registro attuale: <b>${esc(r[0])}</b>, ${sheetMin} min. Focus: <b>${focusMin}</b> min netti confermati (unione degli intervalli, senza doppi conteggi), esito «${esc(st)}».`+
    (conflict?`<br><b style="color:var(--bad)">Conflitto:</b> il registro è cambiato fuori da Focus (ultima scrittura Focus: ${last} min). Scrivendo imposti ${focusMin} min; se quei minuti vengono da un'altra fonte, annulla e riconcilia a mano.`:"")+`<br>Scrittura: solo colonne J:K, valore assoluto, poi rilettura di verifica.`;
  openSheet("mReg")}
function lastOutcome(id){return Object.values(runs).filter(r=>r.blockId===id&&r.status==="confirmed").sort((a,b)=>b.confirmedAt-a.confirmedAt).map(r=>r.outcome)[0]}
const REG_STATES=["Da iniziare","Affrontato","Parziale","Da consolidare","Verificato autonomamente"];
async function writeRegister(){const c=regCtx;closeSheet("mReg");if(!c)return;
  if(!REG_STATES.includes(c.st)){toast("Stato non ammesso per il registro: nessuna scrittura",5000);return}
  if(c.min<(c.sheetMin||0)){toast(`Il registro ha già ${c.sheetMin} min, più dei ${c.min} confermati in Focus: nessuna scrittura (i minuti registrati non si riducono da Focus)`,7000);return}
  try{await call("Google Sheets","update_values",{spreadsheetId:SHEET_ID,range:`PROGRAMMA!J${c.row}:K${c.row}`,values:[[c.st,c.min]]});
    const chk=(await sheetGet(`PROGRAMMA!J${c.row}:L${c.row}`))[0]||[];const ok=chk[0]===c.st&&Number(chk[1])===c.min&&chk[2]===c.id;
    if(ok){await put("state","sync_"+c.id,{key:"sync_"+c.id,min:c.min,st:c.st,at:Date.now()});index[c.id].stato=c.st;index[c.id].fatti=c.min;toast("Registro aggiornato e verificato")}
    else toast("La rilettura dopo la scrittura non coincide: controlla PROGRAMMA",5000);
  }catch(e){toast("Scrittura nel registro non riuscita: "+(e.message||e),5000)}renderDay();renderWeek()}
/* ---------- FOCUS_LOG per l'audit serale ---------- */
function logRow(day){const rs=Object.values(runs).filter(r=>r.date===day&&r.status!=="discarded"),conf=rs.filter(r=>r.status==="confirmed"),open=rs.filter(r=>r.status==="active");
  const now=Date.now(),m=r=>Math.round((workSec(r,now)+(r.declaredExtraSec||0))/60);
  const plannedDay=Object.values(index).filter(b=>b.date===day&&b.stato!=="Rinviato").reduce((t,b)=>t+b.min,0);
  const reasons={};for(const r of rs)for(const i of r.interruptions||[])reasons[i.reason]=(reasons[i.reason]||0)+1;
  const fs=conf.map(r=>r.focusScore).filter(Boolean),errs=Object.values(errors).filter(e=>todayIso(new Date(e.at))===day).length;
  const per=SUBJ.map(s=>conf.filter(r=>r.materia===s).reduce((t,r)=>t+m(r),0));
  const det=rs.map(r=>`${r.blockId} ${r.materia} ${m(r)}′ ${r.status==="confirmed"?r.outcome:"in corso"}${r.focusScore?" c"+r.focusScore:""}${r.evidence?" prova: "+r.evidence.replace(/\s+/g," ").slice(0,60):""}${(()=>{const it=(ckGet(r.blockId).items||[]);const c=it.filter(v=>v===2).length,rc=it.filter(v=>v===4).length;return it.length?` ck ${c}/${it.length}${rc?" rec "+rc:""}`:""})()}${r.study&&(r.study.diff||r.study.redo||r.study.review)?" note: "+[r.study.diff&&"difficoltà "+r.study.diff,r.study.redo&&"rifare "+r.study.redo,r.study.review&&"ripassare "+r.study.review].filter(Boolean).join(" | ").replace(/\s+/g," ").slice(0,160):""}`).join("; ");
  return [day,new Date().toISOString(),devName+" "+deviceId,plannedDay,conf.reduce((t,r)=>t+m(r),0),open.reduce((t,r)=>t+m(r),0),conf.length,conf.filter(r=>r.outcome==="Verificato autonomamente").length,conf.filter(r=>/Parziale|Da consolidare/.test(r.outcome)).length,
    rs.reduce((t,r)=>t+(r.interruptions||[]).length,0),Object.entries(reasons).map(([k,v])=>k+" "+v).join("; "),rs.reduce((t,r)=>t+(r.cycle||0),0),rs.reduce((t,r)=>t+(r.breaksDone||0),0),rs.reduce((t,r)=>t+(r.skipped||0),0),rs.reduce((t,r)=>t+(r.extCount||0),0),
    fs.length?Math.round(fs.reduce((a,b)=>a+b,0)/fs.length*10)/10:"",errs,...per,det.slice(0,1800)]}
let logTimer=null;function logSoon(){clearTimeout(logTimer);logTimer=setTimeout(logNow,90000)}
async function logNow(day=todayIso()){if(!mcp)return;const row=3+Math.round((Date.parse(day+"T12:00:00Z")-Date.parse("2026-11-13T12:00:00Z"))/864e5);if(row<3||row>112)return;
  const v=logRow(day),sig=JSON.stringify(v.slice(3));if(LS.get("logsig."+day,"")===sig)return;
  if(!(v[4]||v[5]||v[6]||v[16]))return; /* nessuna attività registrata qui: non sovrascrivere la riga di un altro dispositivo */
  try{const ex=(await archGet(`FOCUS_LOG!C${row}:E${row}`))[0]||[];
    if(ex[0]&&!String(ex[0]).endsWith(deviceId)&&Number(ex[2]||0)>Number(v[4]||0)){LS.set("logskip."+day,{by:ex[0],min:ex[2],at:Date.now()});return}
    await call("Google Sheets","update_values",{spreadsheetId:ARCH_ID,range:`FOCUS_LOG!A${row}:X${row}`,values:[v]});LS.set("logsig."+day,sig)}catch(e){}}
/* ---------- errors, runs, stats, week ---------- */
function renderErrors(){if(!cur)return;const l=Object.values(errors).filter(e=>e.blockId===cur.id).sort((a,b)=>a.at-b.at);
  $("errList").innerHTML=l.length?l.map(e=>`<p>• ${esc(e.text)}${e.fix?" → <i>"+esc(e.fix)+"</i>":""} <span class="mute">${new Date(e.at).toLocaleDateString("it-IT")}</span></p>`).join(""):'<p class="mute">Nessun errore registrato per questo blocco.</p>'}
async function addError(){const t=$("eTxt").value.trim();if(!t||!cur)return;const e={id:uid(),blockId:cur.id,runId:run&&run.runId,materia:cur.mat,text:t,fix:$("eFix").value.trim(),at:Date.now()};
  await put("errors",e.id,e);$("eTxt").value="";$("eFix").value="";renderErrors();renderStats();renderAllErr();buzz(10);toast("Errore registrato");logSoon()}
function renderAllErr(){const f=$("eFilter").value,q=$("eSearch").value.trim().toLowerCase();
  const l=Object.values(errors).filter(e=>(!f||e.materia===f)&&(!q||(e.text+" "+(e.fix||"")).toLowerCase().includes(q))).sort((a,b)=>b.at-a.at);
  $("allErr").innerHTML=l.length?l.map(e=>`<div class="sess"><span class="stripe" style="background:var(--${esc(e.materia)},#888)"></span><div><b class="sel">${esc(e.text)}</b>${e.fix?`<div class="sel">→ ${esc(e.fix)}</div>`:""}<div class="mute">${esc(e.materia)} · ${esc(e.blockId)} · ${new Date(e.at).toLocaleDateString("it-IT")}</div></div><span></span></div>`).join(""):'<p class="mute">Nessun errore registrato in Focus. Il foglio ERRORI resta il registro ufficiale.</p>'}
function renderRuns(){const l=Object.values(runs).filter(r=>r.status==="confirmed").sort((a,b)=>b.confirmedAt-a.confirmedAt).slice(0,40);
  $("runList").innerHTML=l.length?l.map(r=>`<div class="sess"><span class="stripe" style="background:var(--${esc(r.materia)},#888)"></span><div><b>${esc(r.blockId)}</b> · ${esc(r.outcome)} · ${Math.round((workSec(r,Date.now())+(r.declaredExtraSec||0))/60)} min · ${r.cycle||0} cicli${r.focusScore?" · concentrazione "+r.focusScore+"/5":""}<div class="mute">${new Date(r.confirmedAt).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"})}${r.byName?" · "+esc(r.byName):""}${r.evidence?" · prova: "+esc(r.evidence.slice(0,90)):""}</div></div><span></span></div>`).join(""):'<p class="mute">Ancora nessuna sessione confermata.</p>'}
function renderStats(){const ids=new Set(dayEvents.filter(e=>!e.rinv).map(e=>e.id));const pl=[...ids].reduce((t,id)=>t+((index[id]||{}).min||0),0);
  const rs=Object.values(runs).filter(r=>ids.has(r.blockId)&&r.status!=="discarded");const conf=rs.filter(r=>r.status==="confirmed");
  const net=Math.round(conf.reduce((t,r)=>t+workSec(r,Date.now())+(r.declaredExtraSec||0),0)/60);const ints=rs.reduce((t,r)=>t+(r.interruptions||[]).length,0);
  const ver=conf.filter(r=>r.outcome==="Verificato autonomamente").length;const errs=Object.values(errors).filter(e=>ids.has(e.blockId)).length;
  $("statBody").innerHTML=`<div class="kpis"><div class="kpi"><b>${ver}</b><span>verifiche autonome</span></div><div class="kpi"><b>${errs}</b><span>errori registrati</span></div><div class="kpi"><b>${net}/${pl}</b><span>min netti confermati</span></div><div class="kpi"><b>${ints}</b><span>interruzioni</span></div></div><div class="meter" style="margin-top:10px"><i style="width:${pl?Math.min(100,net/pl*100):0}%"></i></div><p class="mute" style="margin:.5em 0 0">La preparazione si misura con le verifiche, non con i minuti.</p>`}
function renderWeek(){const m=monday(wkRef),days=[...Array(7)].map((_,i)=>addDays(m,i));$("wkLbl").textContent=`Settimana dal ${dayLabel(m,{day:"numeric",month:"long"})}`;
  const blocks=Object.values(index).filter(b=>days.includes(b.date)&&b.stato!=="Rinviato");const done=b=>Math.min(b.min,Math.max(b.fatti||0,Math.round(netForBlock(b.id)/60)));
  const pl=blocks.reduce((t,b)=>t+b.min,0),dn=blocks.reduce((t,b)=>t+done(b),0),ver=blocks.filter(b=>b.stato==="Verificato autonomamente").length;
  $("wkKpi").innerHTML=`<div class="kpi"><b>${Math.round(pl/60)} h</b><span>pianificate</span></div><div class="kpi"><b>${Math.round(dn/60)} h</b><span>registrate</span></div><div class="kpi"><b>${blocks.length}</b><span>blocchi</span></div><div class="kpi"><b>${ver}</b><span>verificati</span></div>`;
  const per=days.map(d=>blocks.filter(b=>b.date===d).reduce((t,b)=>t+b.min,0)),mx=Math.max(660,...per);
  $("days7").innerHTML=days.map((d,i)=>`<div title="${per[i]} min"><span>${per[i]?Math.round(per[i]/6)/10+" h":""}</span><i style="height:${per[i]/mx*84}px;${d===todayIso()?"opacity:1;outline:2px solid var(--ink)":""}"></i><span>${dayLabel(d,{weekday:"short"}).slice(0,3)}</span></div>`).join("");
  $("wkSubj").innerHTML=SUBJ.map(s=>{const bs=blocks.filter(b=>b.mat===s),p=bs.reduce((t,b)=>t+b.min,0),d=bs.reduce((t,b)=>t+done(b),0);if(!p)return"";
    return `<div class="wk"><b style="color:var(--${s})">${s}</b><div class="meter" style="background:color-mix(in srgb,var(--${s}) 16%,transparent)"><i style="width:${Math.min(100,d/p*100)}%;background:var(--${s})"></i></div><span class="v">${d}/${p} min</span></div>`}).join("")||'<p class="mute">Nessun blocco in questa settimana.</p>';
  renderExams()}
/* Date d'esame sempre visibili: appelli del piano (SCADENZE) e appelli pubblici letti dal ponte, anche se non prenotati. */
function renderExams(){const el=$("exams");if(!el)return;const t=todayIso(),S=career&&career.summary,has=!!(S&&S.appelli&&CAREER&&CAREER.appelli);
  const fmt=d=>dayLabel(d,{day:"numeric",month:"short"}),dd=d=>d?d.slice(8,10)+"/"+d.slice(5,7):"",AE=(CAREER&&CAREER.ALMAESAMI)||"https://almaesami.unibo.it/";
  const chip=a=>a.booked?'<span class="pill ok booked">✓ prenotato</span>':a.state==="aperta"?`<span class="pill warn">iscrizioni fino al ${dd(a.to)}</span>`:a.state==="non_aperta"?`<span class="pill">iscrizioni dal ${dd(a.from)}</span>`:a.state==="chiusa"?'<span class="pill">iscrizioni chiuse</span>':"";
  el.innerHTML=SUBJ.map(s=>{const plan=EXAMS.filter(x=>x[1]===s),list=has?CAREER.appelli(S,s,t):[];
    const planned=plan.filter(x=>x[0]).map(([d,,k])=>{const n=Math.round((Date.parse(d+"T12:00:00Z")-Date.parse(t+"T12:00:00Z"))/864e5),bk=bookingFor(s,d);
      return `<div class="exam"><span><b style="color:var(--${s})">${s}</b> · ${esc(k)} <span class="mute small">nel piano</span>${bk?` <span class="pill ok booked" title="Prenotazione letta da AlmaEsami">✓ prenotato ${esc(bk.at.slice(11,16))}</span>`:""}</span><b>${n>0?n+" giorni · "+fmt(d):n===0?"oggi":"svolto"}</b></div>`}).join("")
      ||`<div class="exam"><span><b style="color:var(--${s})">${s}</b> · ${esc((plan[0]||[])[2]||"Data non pubblicata")}</span><b>—</b></div>`;
    const rows=list.slice(0,5).map(a=>`<li class="${plan.some(x=>x[0]===a.date)?"inplan":""}"><span>${fmt(a.date)}${a.time?" "+a.time:""} · ${esc(a.type||"prova")}</span>${chip(a)}</li>`).join("");
    const more=list.length>5?`<li class="mute small">+${list.length-5} altre date sulla pagina del docente</li>`:"",empty=has&&!list.length?'<li class="mute small">Nessun appello futuro pubblicato finora</li>':"";
    return `<section class="exam-subj" style="--sc:var(--${s})">${planned}${rows||more||empty?`<ul class="appelli">${rows}${more}${empty}</ul>`:""}<div class="exam-links"><a href="${AE}" target="_blank" rel="noopener">AlmaEsami ↗</a>${CAREER&&CAREER.SOURCES&&CAREER.SOURCES[s]?`<a href="${CAREER.SOURCES[s]}" target="_blank" rel="noopener">Appelli del docente ↗</a>`:""}</div></section>`}).join("")
    +`<p class="mute small">${has?esc(CAREER.appelliStatus(S).label)+". ":"Appelli pubblici non ancora letti dal PC. "}Le date pubblicate non sono iscrizioni: ci si iscrive solo in AlmaEsami.</p>`}
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295}
/* ---------- navigation, sheets, gestures ---------- */
let navController=null;
function moveInd(){if(navController)return navController.sync();const t=document.querySelector('.tab[aria-selected="true"]'),i=$("tabInd");if(!t)return;i.style.transform=`translate3d(${t.offsetLeft}px,${t.offsetTop}px,0)`;i.style.width=t.offsetWidth+"px";i.style.height=t.offsetHeight+"px"}
window.addEventListener("resize",moveInd);
if(window.ResizeObserver)new ResizeObserver(moveInd).observe($("tabbar"));
let curView="focus";const viewScroll={};
function show(v,dir){if(window.__nt&&run&&run.status==="active")persistSession();if(!VIEWS.includes(v))v="focus";if(v===curView&&$("v-"+v).classList.contains("on"))return;const doIt=()=>{if(curView)viewScroll[curView]=window.scrollY;curView=v;VIEWS.forEach(x=>{$("v-"+x).classList.toggle("on",x===v);$("t-"+x).setAttribute("aria-selected",x===v);$("t-"+x).tabIndex=x===v?0:-1});moveInd();window.scrollTo({top:viewScroll[v]||0,behavior:"auto"});
  try{if(location.hash!=="#"+v)history.replaceState(null,"","#"+v)}catch(e){}if(v==="settimana"){renderWeek();renderAnalysis()}if(v==="registro"){renderAllErr();renderRuns();renderMats();renderReviews();renderSims()}if(v==="piano"){renderPlan();loadPlan()}render()};
  doIt()}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{show(t.dataset.v);buzz(6)});
navController=window.STUDIOOS_NAV.mount($("tabbar"),{select:v=>{show(v);buzz(6)},reducedMotion:()=>settings.rm||matchMedia("(prefers-reduced-motion: reduce)").matches,strength:()=>settings.motion==="soft"?.45:1});
window.addEventListener("hashchange",()=>{const h=location.hash.match(/b=(R20-\d{4})/);if(h&&index[h[1]]){openSession(h[1],index[h[1]].date);return}show(location.hash.slice(1))});
// Page changes use explicit tabs; horizontal swipes keep their native behavior.
$('tabbar').addEventListener('keydown',e=>{
  const tab=e.target.closest('.tab');if(!tab)return;let i=VIEWS.indexOf(tab.dataset.v),n=i;
  if(e.key==='ArrowRight')n=(i+1)%VIEWS.length;else if(e.key==='ArrowLeft')n=(i+VIEWS.length-1)%VIEWS.length;
  else if(e.key==='Home')n=0;else if(e.key==='End')n=VIEWS.length-1;else return;
  e.preventDefault();e.stopPropagation();show(VIEWS[n]);$('t-'+VIEWS[n]).focus();
});
function openSheet(id){$(id).classList.add("on");buzz(8)}
function closeSheet(id){const s=$(id),c=s.firstElementChild;c.style.transform="";s.classList.remove("on")}
document.querySelectorAll(".sheet").forEach(s=>{s.addEventListener("click",e=>{if(e.target===s)closeSheet(s.id)});const c=s.firstElementChild;let y0=null,dy=0;
  c.addEventListener("pointerdown",e=>{if(!e.target.closest(".grab"))return;if(e.target.closest("input,textarea,select,button"))return;y0=e.clientY;dy=0;c.style.transition="none";if(c.setPointerCapture)c.setPointerCapture(e.pointerId)});
  window.addEventListener("pointermove",e=>{if(y0===null)return;dy=Math.max(0,e.clientY-y0);c.style.transform=`translateY(${dy}px)`},{passive:true});
  window.addEventListener("pointerup",()=>{if(y0===null)return;c.style.transition="";if(dy>110)closeSheet(s.id);else c.style.transform="";y0=null});window.addEventListener("pointercancel",()=>{c.style.transition="";c.style.transform="";y0=null})});
window.addEventListener("scroll",()=>{document.querySelector(".top").classList.toggle("compact",window.scrollY>36)},{passive:true});
/* ---------- settings ---------- */
function applySettings(){LS.set("settings",settings);document.body.classList.toggle("rm",settings.rm);document.documentElement.dataset.atmosphere=settings.atmosphere==="essential"?"essential":"cozy";document.documentElement.dataset.motion=settings.motion==="soft"?"soft":"elastic";document.documentElement.style.setProperty("--glass-tint",String(Math.max(0,Math.min(100,Number(settings.glass)||0))/100));
  document.documentElement.classList.toggle("light",settings.theme==="light");document.documentElement.classList.toggle("dark",settings.theme==="dark");applyLook()}
function bindSettings(){const m={sWork:"work",sBreak:"brk",sSound:"sound",sVol:"vol",sTheme:"theme",sLook:"look",sAtmosphere:"atmosphere",sMotion:"motion",sGlass:"glass",sNight:"night",sAmb:"amb",sAmbVol:"ambVol"},c={sAuto:"auto",sResume:"resume",sRm:"rm",sBreathe:"breathe",sHaptic:"haptic",sSmart:"smart",sWake:"wake"};
  for(const [id,k] of Object.entries(m)){$(id).value=settings[k];$(id).onchange=()=>{settings[k]=$(id).type==="number"||$(id).type==="range"?Number($(id).value):$(id).value;applySettings()}}
  for(const [id,k] of Object.entries(c)){$(id).checked=!!settings[k];$(id).onchange=()=>{settings[k]=$(id).checked;applySettings();if(k==="wake")settings.wake?acquireWakeIf():releaseWake()}}}
function installHelp(){const ios=`<b>iPhone e iPad (Safari)</b><ol><li>Apri questa pagina in Safari ${window.STUDIOOS_PWA?"dal suo indirizzo":"dal suo link claude.ai"}.</li><li>Tocca Condividi, poi «Aggiungi alla schermata Home» e attiva «Apri come app web» se compare.</li><li>Per lo StandBy: metti il telefono in orizzontale sul supporto, apri Focus e tocca StandBy.</li></ol>`,
  mac=`<b>Mac (Safari)</b><ol><li>Menu File → «Aggiungi al Dock».</li><li>Si apre in una finestra a sé${window.STUDIOOS_PWA?"":" con il tuo accesso a claude.ai"}.</li></ol>`,
  win=`<b>Windows (Edge o Chrome)</b><ol><li>Edge: menu ⋯ → App → «Installa questo sito come app». Chrome: menu ⋮ → Trasmetti, salva e condividi → «Crea scorciatoia…» con «Apri come finestra».</li><li>Fissala alla barra delle applicazioni: si apre senza barra degli indirizzi e si aggiorna da sola a ogni nuova versione.</li></ol>`,
  and=`<b>Android (Chrome)</b><ol><li>Menu ⋮ → «Aggiungi a schermata Home».</li></ol>`;
  const first=isIOS?ios:isApple?mac:isWin?win:isAndroid?and:"";$("installTxt").innerHTML=first+[ios,mac,win,and].filter(x=>x!==first).map(x=>`<details><summary>${x.match(/<b>(.*?)<\/b>/)[1]}</summary>${x}</details>`).join("")+
  (window.STUDIOOS_PWA?`<p class="mute small">Versione autonoma (PWA): si apre anche senza connessione con l'ultima copia del piano; Sheets, Calendar e l'archivio si sincronizzano quando sei collegato a Google.</p>`:`<p class="mute small">Focus vive dentro claude.ai: il collegamento salvato si aggiorna da solo e resta sincronizzato con gli altri dispositivi, ma senza connessione non funziona, perché la pagina non può registrare un service worker.</p>`);
  $("platInfo").textContent=`Dispositivo: ${devName} (${deviceId}) · stile ${document.documentElement.classList.contains("glass")?"Vetro":"Standard"}.`}
/* ---------- wiring ---------- */
function toggleOled(){const on=document.body.classList.toggle("oled");$("bOled").setAttribute("aria-pressed",on)}
$("bStart").onclick=startRun;$("bPause").onclick=pauseRun;$("bExt").onclick=extendRun;$("bDone").onclick=openDone;$("bInt").onclick=()=>{if(run)openSheet("mInt")};
$("miNo").onclick=()=>closeSheet("mInt");$("miOk").onclick=()=>{const reason=$("miR").value;act((x,t)=>{if(x.phase==="work")actPause(x,t);x.interruptions=(x.interruptions||[]).concat([{at:t,reason}])},"interrupt");closeSheet("mInt");logSoon()};
$("mdOk").onclick=confirmRun;$("mdKeep").onclick=()=>closeSheet("mDone");$("mdDrop").onclick=dropRun;$("mrOk").onclick=writeRegister;$("mrNo").onclick=()=>closeSheet("mReg");
$("bOled").onclick=toggleOled;$("bTired").onclick=()=>{act((x,t)=>{x.fatigue=(x.fatigue||0)+1},"fatigue");toast("Ricevuto: dal prossimo ciclo studio più corto e pausa più lunga");buzz(10)};$("bHide").onclick=()=>{document.body.classList.add("oled");document.body.classList.remove("showctl")};$("bStandby").onclick=openStandby;$("island").onclick=()=>{show("focus");window.scrollTo({top:0,behavior:"smooth"})};
$("bFull").onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(e){toast("Schermo intero non disponibile in questa vista")}};
document.body.addEventListener("click",e=>{if(document.body.classList.contains("oled")&&!e.target.closest("button"))document.body.classList.toggle("showctl");
  const o=e.target.closest("[data-open]"),r=e.target.closest("[data-reg]"),g=e.target.closest("[data-go]");if(o)openSession(o.dataset.open);if(r){e.preventDefault();askRegister(r.dataset.reg)}if(g)openSession(g.dataset.go,g.dataset.day)});
$("goDay").onclick=()=>show("giorno");
$("dPrev").onclick=()=>{curDay=addDays(curDay,-1);loadDay(curDay)};$("dNext").onclick=()=>{curDay=addDays(curDay,1);loadDay(curDay)};$("dToday").onclick=()=>{curDay=todayIso();loadDay(curDay)};
$("wPrev").onclick=()=>{wkRef=addDays(wkRef,-7);renderWeek()};$("wNext").onclick=()=>{wkRef=addDays(wkRef,7);renderWeek()};
$("bReload").onclick=async()=>{lastDataRefresh=0;await refreshAll();toast("Controllo automatico dei dati eseguito")};
$("notes").addEventListener("change",()=>{if(window.__nt&&run&&run.status==="active")persistSession()});
$("notes").oninput=()=>{const notes=$("notes").value;if(cur)LS.set("notes."+cur.id,notes);if(run&&run.status==="active"&&cur&&cur.id===run.blockId){const id=run.runId;clearTimeout(window.__nt);window.__nt=setTimeout(()=>{if(!run||run.status!=="active"||run.runId!==id)return;const x=clone(run);x.notes=notes;commit(x,"notes")},2000)}};
$("bErr").onclick=addError;$("eFilter").onchange=renderAllErr;$("eSearch").oninput=renderAllErr;$("bTest").onclick=()=>{unlockAudio();tone(settings.sound);buzz(30)};
$("bNotif").onclick=async()=>{try{const p=await Notification.requestPermission();$("bNotif").textContent=p==="granted"?"Notifiche attive":"Notifiche non consentite"}catch(e){$("bNotif").textContent="Notifiche non disponibili in questa vista"}};
$("bExport").onclick=async()=>{const txt=JSON.stringify({app:"STUDIOOS Focus R13h.5 PWA",exportedAt:new Date().toISOString(),device:deviceId,runs:Object.values(runs),errors:Object.values(errors),state:Object.values(syncState).filter(s=>s&&s.key!=="live")});$("expTxt").value=txt;
  let dl=null;try{dl=await (window.claude&&window.claude.use?window.claude.use("downloads"):null)}catch(err){dl=null}
  if(dl){try{await dl.save({filename:"STUDIOOS_Focus_archivio_"+todayIso()+".json",data:txt});toast("Archivio salvato ("+Object.keys(runs).length+" sessioni, "+Object.keys(errors).length+" errori)")}catch(err){toast("Salvataggio non riuscito: copia il testo dal riquadro",5000)}}};
$("bCopy").onclick=async()=>{try{await navigator.clipboard.writeText($("expTxt").value);$("bCopy").textContent="Copiato"}catch(e){$("expTxt").select();$("bCopy").textContent="Seleziona e copia"}};
$("impFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());let n=0;for(const r of d.runs||[])if(r.runId&&(!runs[r.runId]||(r.updatedAt||0)>(runs[r.runId].updatedAt||0))){await put("runs",r.runId,r);n++}
  for(const x of d.errors||[])if(x.id&&(!errors[x.id]||(x.updatedAt||0)>(errors[x.id].updatedAt||0))){await put("errors",x.id,x);n++}
  for(const s of d.state||[])if(s&&s.key&&s.key!=="live"&&(!syncState[s.key]||(s.updatedAt||0)>(syncState[s.key].updatedAt||0))){await put("state",s.key,s);n++}
  toast(n+" record ripristinati");renderToday();renderReviews();renderSims();renderDay();renderStats();renderRuns();renderAllErr()}catch(err){toast("File di backup non valido")}};
document.addEventListener("keydown",e=>{if(e.defaultPrevented||e.target.closest("input,textarea,select,button,a,[contenteditable=true],[role=tab]"))return;const k=e.key.toLowerCase();
  if(e.key===" "){e.preventDefault();run&&run.status==="active"?pauseRun():(cur&&startRun())}else if(k==="c")openDone();else if(k==="o")toggleOled();else if(k==="s")$("standby").classList.contains("on")?closeStandby():openStandby();else if(k==="e")extendRun();
  else if(k==="h")document.body.classList.toggle("showctl");else if(k==="f")$("bFull").click();else if(/^[1-6]$/.test(k))show(VIEWS[+k-1]);
  else if(e.key==="Escape"){document.querySelectorAll(".sheet.on").forEach(m=>closeSheet(m.id));document.body.classList.remove("oled");closeStandby()}});
function persistSession(){
  clearTimeout(window.__nt);
  if(run&&run.status==="active"){
    const x=clone(run);if(cur&&cur.id===x.blockId)x.notes=$("notes").value;
    if(x.notes!==run.notes)commit(x,"notes");else{runs[x.runId]=x;saveLocal();storeOutbox(["runs",x.runId,x]);const live=syncState.live;if(live&&live.run&&live.run.runId===x.runId)storeOutbox(["state","live",live])}
  }else saveCaches();
}
window.addEventListener("pagehide",persistSession);window.addEventListener("pageshow",refreshAll);window.addEventListener("focus",refreshAll);
window.addEventListener("online",refreshAll);window.addEventListener("offline",reportSave);
window.addEventListener("studioos:sync-now",refreshAll);
window.addEventListener("studioos:archive-update",()=>{if(document.visibilityState==="visible"){clearTimeout(window.__archiveRefresh);window.__archiveRefresh=setTimeout(refreshSync,150)}});
window.addEventListener("studioos:calendar-config",e=>{CAL_ID=e.detail.id||"";if(mcp)loadDay(curDay)});
window.addEventListener("storage",e=>{if(e.key&&e.key.startsWith(DATA_PREFIX+"outbox.")&&e.newValue===null)delete memoryOutbox[e.key.slice((DATA_PREFIX+"outbox.").length)];if(e.key&&e.key.startsWith(DATA_PREFIX))reportSave()});
setInterval(flush,30000);setInterval(()=>{renderNext();renderToday();timeline($("tlMini"),dayEvents);timeline($("tlDay"),dayEvents)},60000);
window.addEventListener("resize",()=>{moveInd()});

/* ---------- R13g · canale con le attività pianificate (PIANO_PROPOSTE) ---------- */
let plan=LS.get("plan",{rows:[],at:0}),planBusy=false;
const PCOL=["id","creata","autore","tipo","titolo","motivo","modifiche","effetto","stato","decisoIl","dispositivo","nota","applicataIl","esito"];
async function archGet(range){const p=await call("Google Sheets","get_values",{spreadsheetId:ARCH_ID,range});return (p&&p.values)||[]}
async function archSet(range,values){return call("Google Sheets","update_values",{spreadsheetId:ARCH_ID,range,values})}
async function loadPlan(){if(!mcp||planBusy)return;planBusy=true;try{const v=await archGet("PIANO_PROPOSTE!A3:N400");const rows=[];
    v.forEach((r,i)=>{if(!r||!r[0])return;const o={row:i+3};PCOL.forEach((k,j)=>o[k]=r[j]||"");rows.push(o)});
    const before=plan.rows.filter(pend).map(r=>r.id).join("|");plan={rows,at:Date.now()};LS.set("plan",plan);renderPlan();renderToday();
    const nowPend=rows.filter(pend);if(before&&nowPend.some(r=>!before.includes(r.id)))toast(nowPend.length+" elementi del tutor da vedere in Piano",4500)}
  catch(e){$("pInfo").dataset.err="1"}finally{planBusy=false}}
function pend(r){return (r.tipo==="PROPOSTA"||r.tipo==="DOMANDA")&&r.stato==="IN_ATTESA"}
function parseChg(t){try{const j=JSON.parse(t||"[]");return Array.isArray(j)?j:[]}catch(e){return null}}
function fmtWhen(iso){const t=Date.parse(iso);return isNaN(t)?esc(iso||""):new Date(t).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Rome"})}
function renderPlan(){const rows=plan.rows||[],np=rows.filter(pend).length,b=$("pBadge");b.hidden=!np;b.textContent=np;
  const notes=rows.filter(r=>r.tipo==="NOTA").sort((x,y)=>(y.creata||"").localeCompare(x.creata||"")).slice(0,3);
  $("pNotes").innerHTML=notes.length?notes.map(r=>`<div class="note-t"><b>${esc(r.titolo)}</b> <span class="mute small">${fmtWhen(r.creata)} · ${esc(r.autore)}</span><div class="small sel">${esc(r.motivo)}</div></div>`).join(""):'<p class="small mute">Nessun messaggio del tutor per ora.</p>';
  const qs=rows.filter(r=>r.tipo==="DOMANDA"&&r.stato==="IN_ATTESA");
  $("pQ").innerHTML=qs.length?qs.map(r=>`<div class="prop"><h4>${esc(r.titolo)}</h4>${r.motivo?`<div class="small mute sel">${esc(r.motivo)}</div>`:""}<div class="qbox"><input id="qa-${r.row}" type="text" placeholder="Risposta breve (sì / parziale / no, minuti, dove ti sei fermato)" aria-label="Risposta"><button class="btn primary" data-ans="${r.row}">Rispondi</button></div></div>`).join(""):'<p class="small mute">Nessuna domanda aperta.</p>';
  const ps=rows.filter(r=>r.tipo==="PROPOSTA"&&r.stato==="IN_ATTESA");
  $("pProp").innerHTML=ps.length?ps.map(r=>{const c=parseChg(r.modifiche);const lines=c===null?"Modifiche non leggibili: non approvare, chiedi al tutor di riscriverle.":c.map(x=>`${x.id} · ${x.campo}: ${String(x.da??"").slice(0,70)} → ${String(x.a??"").slice(0,70)}`).join("\n");
    return `<div class="prop"><h4>${esc(r.titolo)}</h4><div class="small mute">${fmtWhen(r.creata)} · ${esc(r.autore)}</div><div class="small sel" style="margin-top:6px">${esc(r.motivo)}</div>${r.effetto?`<div class="small"><b>Effetto:</b> ${esc(r.effetto)}</div>`:""}
      <details><summary class="small">${c?c.length:0} modifiche</summary><div class="chg sel">${esc(lines)}</div></details>
      <input id="pn-${r.row}" type="text" placeholder="Nota per il tutor (facoltativa)" aria-label="Nota"><div class="row" style="margin-top:6px"><button class="btn primary" data-appr="${r.row}" ${c===null?"disabled":""}>Approva</button><button class="btn" data-rej="${r.row}">Rifiuta</button></div></div>`}).join(""):'<p class="small mute">Nessuna proposta in attesa.</p>';
  const hist=rows.filter(r=>!pend(r)&&r.tipo!=="NOTA").sort((x,y)=>(y.creata||"").localeCompare(x.creata||"")).slice(0,12);
  $("pHist").innerHTML=hist.length?hist.map(r=>`<div class="sess"><span class="stripe" style="background:var(--acc)"></span><div><b>${esc(r.tipo)}</b> · ${esc(r.titolo)}<div class="mute">${esc(r.stato)}${r.esito?" · "+esc(r.esito.slice(0,120)):""} · ${fmtWhen(r.creata)}</div></div><span></span></div>`).join(""):'<p class="mute">Ancora vuoto.</p>';
  $("pInfo").textContent=(mcp?"Collegato al foglio PIANO_PROPOSTE":"Connettori non disponibili: vedi l'ultima copia salvata")+(plan.at?" · aggiornato "+new Date(plan.at).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}):"")+". Le modifiche al piano si applicano solo dopo il tuo «Approva»."}
async function decide(row,stato,nota){const r=(plan.rows||[]).find(x=>x.row===row);if(!r||!mcp){toast("Connettori non disponibili: riprova più tardi");return}
  try{const cur=(await archGet(`PIANO_PROPOSTE!A${row}:I${row}`))[0]||[];if(cur[0]!==r.id||cur[8]!=="IN_ATTESA"){toast("La proposta è cambiata nel foglio: ricarico",4000);return loadPlan()}
    await archSet(`PIANO_PROPOSTE!I${row}:L${row}`,[[stato,new Date().toISOString(),devName+" "+deviceId,nota||""]]);
    const chk=(await archGet(`PIANO_PROPOSTE!I${row}`))[0]||[];if(chk[0]===stato){buzz([12,30,12]);toast(stato==="APPROVATA"?"Approvata: verrà applicata alla prossima esecuzione della ridistribuzione":stato==="RIFIUTATA"?"Rifiutata":"Risposta inviata al tutor",4500)}else toast("Rilettura non coincidente: controlla il foglio",5000)}
  catch(e){toast("Scrittura non riuscita: "+(e.message||e),5000)}loadPlan()}
async function sendReq(){const t=$("pReq").value.trim();if(!t){toast("Scrivi prima cosa ti serve");return}if(!mcp){toast("Connettori non disponibili: la richiesta resta nel campo");return}
  try{const col=await archGet("PIANO_PROPOSTE!A3:A400");let row=3;while(col[row-3]&&col[row-3][0])row++;
    const d=new Date(),day=todayIso(),hhmm=hm(d.getTime()).replace(":",""),id="R-"+day.replace(/-/g,"")+"-"+hhmm+"-"+Math.random().toString(36).slice(2,4);
    const plannedDay=Object.values(index).filter(b=>b.date===day&&b.stato!=="Rinviato").reduce((s,b)=>s+b.min,0);
    const conf=Object.values(runs).filter(r=>r.date===day&&r.status==="confirmed").reduce((s,r)=>s+Math.round(workSec(r,Date.now())/60),0);
    const ctx=`Oggi ${day}: pianificati ${plannedDay} min, confermati in Focus ${conf} min${run&&run.status==="active"?", sessione in corso su "+run.blockId:""}${cur?", blocco aperto "+cur.id:""}.`;
    await archSet(`PIANO_PROPOSTE!A${row}:I${row}`,[[id,d.toISOString(),"Focus "+devName+" "+deviceId,"RICHIESTA",t.slice(0,90),t,"",ctx,"IN_ATTESA"]]);
    const chk=(await archGet(`PIANO_PROPOSTE!A${row}`))[0]||[];if(chk[0]===id){$("pReq").value="";toast("Richiesta inviata: risposta alla prossima ridistribuzione",4500)}else toast("Rilettura non coincidente",4000)}
  catch(e){toast("Invio non riuscito: "+(e.message||e),5000)}loadPlan()}
$("pReload").onclick=loadPlan;$("pSend").onclick=sendReq;
$("pChips").addEventListener("click",e=>{const b=e.target.closest(".chipbtn");if(!b)return;const v=$("pReq");v.value=(v.value?v.value.trim()+" ":"")+b.textContent+": ";v.focus()});
document.addEventListener("click",e=>{const a=e.target.closest("[data-appr]"),j=e.target.closest("[data-rej]"),q=e.target.closest("[data-ans]");
  if(a){const r=+a.dataset.appr;decide(r,"APPROVATA",($("pn-"+r)||{}).value||"")}
  if(j){const r=+j.dataset.rej;decide(r,"RIFIUTATA",($("pn-"+r)||{}).value||"")}
  if(q){const r=+q.dataset.ans,v=(($("qa-"+r)||{}).value||"").trim();if(!v){toast("Scrivi una risposta");return}decide(r,"RISPOSTA",v)}});
/* ---------- R13g · suono ambientale generato (nessun file audio) ---------- */
const AMB={rain:{type:"lowpass",f:1450,g:.55,rate:1.3,a:.74},wind:{type:"lowpass",f:380,g:.44,rate:.85,a:.93},water:{type:"bandpass",f:470,g:.64,rate:.72,a:.68},night:{type:"lowpass",f:270,g:.4,rate:.56,a:.9},pink:{type:"lowpass",f:8000,g:.45,rate:1,a:.83}};
let amb=null;
function ambStop(){if(!amb)return;const a=amb;amb=null;try{a.gain.gain.setTargetAtTime(0,actx.currentTime,.3);setTimeout(()=>{try{a.src.stop()}catch(e){}},900)}catch(e){}}
function ambPlay(kind){const p=AMB[kind];if(!p||!actx)return;ambStop();try{const n=actx.sampleRate*3,buf=actx.createBuffer(1,n,actx.sampleRate),d=buf.getChannelData(0);let s=0;
    for(let i=0;i<n;i++){s=s*p.a+(Math.random()*2-1)*(1-p.a);d[i]=s*Math.min(1,i/120,(n-i-1)/120)}
    const src=actx.createBufferSource(),f=actx.createBiquadFilter(),g=actx.createGain();src.buffer=buf;src.loop=true;src.playbackRate.value=p.rate;f.type=p.type;f.frequency.value=p.f;g.gain.value=0;
    src.connect(f).connect(g).connect(actx.destination);src.start();g.gain.setTargetAtTime(Math.max(0,Math.min(1,settings.ambVol))*p.g*.6,actx.currentTime,.5);amb={src,gain:g,kind,p}}catch(e){amb=null}}
function ambSync(){const live=run&&run.status==="active"&&advance(run,Date.now()).phase==="work"&&document.visibilityState==="visible";const want=live&&settings.amb&&settings.amb!=="none"&&settings.ambVol>0;
  if(want&&(!amb||amb.kind!==settings.amb))ambPlay(settings.amb);else if(!want&&amb)ambStop();else if(amb){try{amb.gain.gain.setTargetAtTime(settings.ambVol*amb.p.g*.6,actx.currentTime,.3)}catch(e){}}}
setInterval(ambSync,1500);document.addEventListener("visibilitychange",ambSync);
/* ---------- R13g · piano per la versione offline ---------- */
$("bPlanOff").onclick=async()=>{if(!mcp){toast("Serve la connessione a Sheets");return}toast("Preparo il piano…");
  try{const [a,e,f,g,h,i]=await Promise.all([sheetGet("PROGRAMMA!A6:D427"),sheetGet("PROGRAMMA!E6:E427"),sheetGet("PROGRAMMA!F6:F427"),sheetGet("PROGRAMMA!G6:G427"),sheetGet("PROGRAMMA!H6:H427"),sheetGet("PROGRAMMA!I6:L427")]);
    const blocks=[];for(let k=0;k<i.length;k++){const id=(i[k]||[])[3];if(!/^R20-\d{4}$/.test(id||""))continue;const A=a[k]||[];
      blocks.push({id,date:A[0],from:A[1],to:A[2],mat:A[3],arg:(e[k]||[])[0]||"",cons:(f[k]||[])[0]||"",min:Number((g[k]||[])[0]||0),mats:(h[k]||[])[0]||"",apri:(i[k]||[])[0]||"",stato:(i[k]||[])[1]||"",fatti:Number((i[k]||[])[2]||0)})}
    const txt=JSON.stringify({app:"STUDIOOS Focus R13g · piano",exportedAt:new Date().toISOString(),source:SHEET_ID,blocks});
    let dl=null;try{dl=await (window.claude&&window.claude.use?window.claude.use("downloads"):null)}catch(err){dl=null}
    if(dl){try{await dl.save({filename:"STUDIOOS_piano_"+todayIso()+".json",data:txt});toast(blocks.length+" blocchi esportati")}catch(err){$("expTxt").value=txt;toast("Salvataggio annullato o non consentito: il testo è nel riquadro qui sotto",5000)}}
    else{$("expTxt").value=txt;toast("Download non disponibile qui: copia il testo dal riquadro",5000)}}
  catch(err){toast("Esportazione non riuscita: "+(err.message||err),5000)}};
/* ---------- R13h · Oggi ---------- */
function confMin(id){return Math.round(netForBlock(id)/60)}
function doneMin(b){return Math.max(b.fatti||0,confMin(b.id))}
function pickStudyBlock(){const now=Date.now(),today=todayIso();const L=Object.values(index).filter(b=>b.date===today&&b.stato!=="Rinviato").sort((x,y)=>x.from.localeCompare(y.from));
  const cur0=L.find(b=>at(today,b.from)<=now&&now<at(today,b.to));if(cur0)return {b:cur0,why:"in corso"};
  const nx=L.find(b=>at(today,b.from)>now);if(nx&&at(today,nx.from)-now<=30*MIN)return {b:nx,why:"tra poco"};
  const missed=L.filter(b=>at(today,b.to)<=now&&doneMin(b)<b.min*.5&&!Object.values(runs).some(r=>r.blockId===b.id&&r.status==="confirmed"));if(missed.length)return {b:missed[missed.length-1],why:"da recuperare"};
  if(nx)return {b:nx,why:"prossimo"};return null}
function renderToday(){if(!$("todayCard"))return;const now=Date.now(),today=todayIso();const L=Object.values(index).filter(b=>b.date===today&&b.stato!=="Rinviato").sort((x,y)=>x.from.localeCompare(y.from));
  const plannedDay=L.reduce((s,b)=>s+b.min,0),conf=Object.values(runs).filter(r=>r.date===today&&r.status==="confirmed").reduce((s,r)=>s+Math.round(workSec(r,now)/60),0),reg=L.reduce((s,b)=>s+(b.fatti||0),0);
  $("tdDate").textContent=dayLabel(today);$("tdHead").textContent=L.length?`${L.length} blocchi · ${Math.floor(plannedDay/60)} h ${plannedDay%60} min`:"Nessun blocco oggi";
  const hour=Math.floor(romeMin(now)/60);$("dailyGreeting").textContent=hour<12?"Buongiorno. Un passo alla volta.":hour<18?"Un po’ di spazio per concentrarti.":"Una cosa alla volta, anche stasera.";
  $("tdKpi").innerHTML=`<div><b>${plannedDay}′</b><span>previsti</span></div><div><b>${Math.max(conf,reg)}′</b><span>confermati</span></div><div><b>${Math.max(0,plannedDay-Math.max(conf,reg))}′</b><span>rimanenti</span></div>`;
  const pk=pickStudyBlock(),act=run&&run.status==="active";const bs=$("bStudy");
  bs.textContent=act?`Torna alla sessione · ${(index[run.blockId]||{}).mat||""}`:pk?`Inizia a studiare · ${pk.b.mat} ${pk.b.from}${pk.why==="da recuperare"?" (da recuperare)":""}`:"Nessun blocco da iniziare: apri il Calendario";bs.disabled=!act&&!pk;
  $("tdNext").innerHTML=L.map(b=>{const st=at(today,b.from),en=at(today,b.to),d=doneMin(b),c=Object.values(runs).some(r=>r.blockId===b.id&&r.status==="confirmed");
    const tag=c?"✓":en<=now?(d?"parziale":"da recuperare"):st<=now?"in corso":"";return `<div class="sess" data-go="${b.id}" data-day="${today}" style="cursor:pointer"><span class="stripe" style="background:var(--${b.mat},#888)"></span><div><b>${b.from}–${b.to} ${esc(b.mat)}</b> · ${b.min}′ ${tag?`<span class="pill">${tag}</span>`:""}<div class="mute">${esc((b.arg||"").slice(0,90))}</div></div><span></span></div>`}).join("");
  const rec=[];for(const [k,o] of Object.entries(Object.assign({},syncState))){if(!k.startsWith("chk_"))continue;const b=index[o.id];if(!b||b.date>today)continue;(o.items||[]).forEach((v,i)=>{if(v===4)rec.push(b)})}
  const recB=[...new Set(rec.map(b=>b.id))].map(id=>index[id]),dueN=dueErrors().length,nPend=(plan.rows||[]).filter(pend).length;
  $("tdTodo").innerHTML=(recB.length?`<p><b>Da recuperare:</b> ${recB.slice(0,5).map(b=>`<a href="#" data-go="${b.id}" data-day="${b.date}">${esc(b.mat)} ${b.date.slice(8)}/${b.date.slice(5,7)}</a>`).join(" · ")} <span class="mute">(chiedi una ridistribuzione in Piano)</span></p>`:"")+(dueN?`<p><b>Ripassi di oggi:</b> ${dueN} ${dueN===1?"errore":"errori"} da rifare · <a href="#" id="goRv">apri Studio</a></p>`:"");
  const tp=$("tdPend");tp.hidden=!nPend;tp.textContent=nPend+" dal tutor";
  const S=career&&career.summary,open=S&&CAREER&&CAREER.appelli?CAREER.appelli(S,null,today).filter(a=>a.state==="aperta"&&!a.booked):[],seen=new Set();
  $("tdExams").innerHTML=EXAMS.filter(x=>x[0]&&x[0]>=today).slice(0,4).map(([d,m,t])=>`<span class="pill${bookingFor(m,d)?" booked":""}" style="border-color:var(--${m})">${bookingFor(m,d)?"✓ ":""}${m} ${t} · ${Math.round((Date.parse(d+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/864e5)} g</span>`).join("")
    +open.filter(a=>!seen.has(a.subject)&&seen.add(a.subject)).map(a=>`<a class="pill warn" href="${CAREER.ALMAESAMI}" target="_blank" rel="noopener" title="Appello del ${a.date.split("-").reverse().join("/")}: iscrizioni aperte, non risulti prenotato">${a.subject} iscrizioni aperte · fino al ${a.to.slice(8,10)}/${a.to.slice(5,7)}</a>`).join("");
  renderNews()}
/* Novità appelli dal ponte (nuove date, iscrizioni aperte o in chiusura): restano visibili 14 giorni o fino a «Visto». */
function renderNews(){const host=$("tdExams");if(!host||!CAREER||!CAREER.news)return;let box=$("tdNews");if(!box){box=document.createElement("div");box.id="tdNews";box.className="td-news";host.after(box)}
  const seen=new Set(LS.get("newsSeen",[])),list=career?CAREER.news(career.summary,Date.now(),14).filter(e=>!seen.has(e.id)):[];
  box.innerHTML=list.slice(0,4).map(e=>`<div class="td-new"><span>🔔 ${esc(e.msg)}</span><button class="chipbtn" data-news="${esc(e.id)}">Visto</button></div>`).join("");
  box.querySelectorAll("[data-news]").forEach(b=>b.onclick=()=>{const v=LS.get("newsSeen",[]);v.push(b.dataset.news);LS.set("newsSeen",v.slice(-200));renderNews()})}
async function startStudy(){unlockAudio();if(run&&run.status==="active"){const b=index[run.blockId];await openSession(run.blockId,b&&b.date,true);show("focus");$("focusCard").scrollIntoView({behavior:settings.rm||matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});return}
  const pk=pickStudyBlock();if(!pk)return show("giorno");await openSession(pk.b.id,pk.b.date);if(cur&&!cur.rinv){await startRun();$("focusCard").scrollIntoView({behavior:settings.rm||matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}}
$("bStudy").onclick=startStudy;$("tdPend").onclick=()=>show("piano");
document.addEventListener("click",e=>{if(e.target.id==="goRv"){e.preventDefault();show("registro")}});
/* ---------- R13h · materiali ---------- */
function parseMats(s){const out=[];for(const raw of String(s||"").split(/\s*\|\s*|\n——\n|\s---\s|;\s+|\n/)){const t=raw.trim();if(!t||/^Archivio del corso/i.test(t))continue;
    const m=/^(.*?\.(?:pdf|ipynb|py|java|sql|ddl|md|txt|lun|xls|xlsx|c|zip))\b(.*)$/i.exec(t)||/^((?:oop-lab|lab)\S*\/\S+)(.*)$/i.exec(t);if(!m)continue;
    const name=m[1].split("/").pop().trim(),pp=(/pp?\.\s*([\d–\-, e]+)/.exec(m[2])||[])[1]||"";out.push({name,path:m[1].trim(),pp:pp.trim()})}return out}
function posKey(n){return "pos_"+Math.floor(hash(n)*2**31).toString(36)}
function posGet(n){const o=syncState[posKey(n)]||LS.get(posKey(n),null);return o?o.at:""}
async function posSet(n,v){const o={key:posKey(n),name:n,at:v,by:deviceId};LS.set(posKey(n),o);try{await put("state",posKey(n),o)}catch(e){}}
function matRow(m,extra){return `<div class="matl"><b class="sel">${esc(m.name)}</b>${m.pp?` <span class="mute">pp. ${esc(m.pp)}</span>`:""}${extra||""}<div class="row" style="margin-top:4px"><label class="small mute" style="margin:0">Ultima posizione</label><input data-pos="${esc(m.name)}" value="${esc(posGet(m.name))}" placeholder="p. / es." aria-label="Ultima posizione di lettura di ${esc(m.name)}"></div></div>`}
function renderDetailMats(s,b){const L=parseMats(s);$("dMatList").innerHTML=L.length?L.map(m=>matRow(m,m.path!==m.name?`<div class="mute small">${esc(m.path)}</div>`:"")).join(""):`<pre class="cons">${esc(s||"Nessun materiale indicato")}</pre>`}
function renderMats(){const q=$("mSearch").value.trim().toLowerCase(),f=$("mFilter").value,map={};
  for(const b of Object.values(index)){if(b.stato==="Rinviato"||(f&&b.mat!==f))continue;for(const m of parseMats(b.mats)){const k=m.name;(map[k]=map[k]||{m,mats:new Set(),blocks:[],pp:new Set(),args:new Set()});map[k].mats.add(b.mat);map[k].blocks.push(b);if(m.pp)map[k].pp.add(m.pp);map[k].args.add(b.arg)}}
  let L=Object.values(map);if(q)L=L.filter(x=>(x.m.name+" "+[...x.args].join(" ")).toLowerCase().includes(q));
  const today=todayIso();L.sort((x,y)=>{const nx=x.blocks.filter(b=>b.date>=today).map(b=>b.date).sort()[0]||"9",ny=y.blocks.filter(b=>b.date>=today).map(b=>b.date).sort()[0]||"9";return nx.localeCompare(ny)});
  $("mList").innerHTML=L.length?L.slice(0,60).map(x=>{const nb=x.blocks.filter(b=>b.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
    return matRow({name:x.m.name,pp:[...x.pp].slice(0,3).join(", ")},`<div class="mute small">${[...x.mats].join(", ")} · ${x.blocks.length} blocchi${nb?` · prossimo <a href="#" data-go="${nb.id}" data-day="${nb.date}">${nb.date.slice(8)}/${nb.date.slice(5,7)} ${nb.from}</a>`:""}${nb&&safeUrl(nb.apri)?` · <a href="${esc(safeUrl(nb.apri))}" target="_blank" rel="noopener noreferrer">Drive</a>`:""}</div>`)}).join("")+(L.length>60?`<p class="mute">Altri ${L.length-60}: affina la ricerca.</p>`:""):'<p class="mute">Nessun materiale trovato. I materiali arrivano dalla colonna Materiali di PROGRAMMA.</p>'}
$("mSearch").oninput=renderMats;$("mFilter").onchange=renderMats;
document.addEventListener("change",e=>{const p=e.target.closest("[data-pos]");if(p){posSet(p.dataset.pos,p.value.trim());toast("Posizione salvata")}});
/* ---------- R13h · ripassi distanziati sugli errori ---------- */
const BOX=[1,3,7,14,30];
function dueErrors(){const t=todayIso();return Object.values(errors).filter(e=>!e.resolved&&(e.due||addDays(todayIso(new Date(e.at)),1))<=t).sort((a,b)=>(a.due||"").localeCompare(b.due||""))}
function renderReviews(){const L=dueErrors();$("rvList").innerHTML=L.length?L.slice(0,30).map(e=>`<div class="prop"><div class="mute small">${esc(e.materia)} · ${esc(e.blockId)} · tentativi ${(e.tries||[]).length}</div><b class="sel">${esc(e.text)}</b><details><summary class="small">Mostra la correzione (dopo aver risposto)</summary><div class="sel">${esc(e.fix||"—")}</div></details><div class="row" style="margin-top:6px"><button class="btn primary" data-rv="${esc(e.id)}" data-ok="1">Rifatto giusto</button><button class="btn" data-rv="${esc(e.id)}" data-ok="0">Ancora sbagliato</button></div></div>`).join(""):'<p class="mute">Nessun ripasso in scadenza oggi.</p>'}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-rv]");if(!b)return;const x=Object.assign({},errors[b.dataset.rv]);if(!x.id)return;const ok=b.dataset.ok==="1";
  x.box=ok?Math.min(BOX.length,(x.box||0)+1):0;x.tries=(x.tries||[]).concat([{at:Date.now(),ok}]);if(x.box>=BOX.length){x.resolved=true;x.due=""}else x.due=addDays(todayIso(),BOX[ok?x.box-1:0]);
  await put("errors",x.id,x);toast(ok?(x.resolved?"Errore recuperato":"Prossimo ripasso il "+x.due.slice(8)+"/"+x.due.slice(5,7)):"Riprova domani");renderReviews();renderToday();logSoon()});
/* ---------- R13h · simulazioni ---------- */
function sims(){return Object.values(syncState).filter(o=>o&&o.type==="sim").sort((a,b)=>(a.at||0)-(b.at||0))}
function renderSims(){const L=sims().slice().reverse();$("smList").innerHTML=L.length?L.slice(0,20).map(s=>`<div class="sess"><span class="stripe" style="background:var(--${okMat(s.materia)||"acc"},#888)"></span><div><b>${esc(s.materia)} · ${esc(s.name||"Simulazione")}</b> · ${s.score}/${s.max}${s.min?` · ${s.min}′`:""}<div class="mute">${new Date(s.at).toLocaleDateString("it-IT")}${s.err?" · "+esc(s.err):""}</div></div><span></span></div>`).join(""):'<p class="mute">Nessuna simulazione registrata.</p>'}
$("bSim").onclick=async()=>{const score=Number($("smScore").value),max=Number($("smMax").value||30);if(!(score>=0)||!(max>0)||score>max){toast("Inserisci punti e massimo validi");return}
  const id="sim_"+uid(),s={key:id,type:"sim",materia:$("smMat").value,name:$("smName").value.trim(),score,max,min:Number($("smMin").value)||null,err:$("smErr").value.trim(),at:Date.now()};await put("state",id,s);
  ["smName","smScore","smMin","smErr"].forEach(k=>$(k).value="");renderSims();renderAnalysis();toast("Simulazione registrata")};
/* ---------- R13h · analisi ---------- */
const EXAMDAYS=new Set(["2027-01-11","2027-01-13","2027-01-19","2027-02-15"]);
let planMeta=LS.get("planMeta",{rules:{},exams:null,at:0}),metaBusy=null,lastMetaAttempt=0;
function planLimit(key,fallback){const n=Number((planMeta.rules||{})[key]);return Number.isFinite(n)&&n>0&&n<=(key.includes("week")?10080:1440)?n:fallback}
function applyPlanMeta(){if(Array.isArray(planMeta.exams)){EXAMS=planMeta.exams;EXAMDAYS.clear();for(const [d]of EXAMS)if(d)EXAMDAYS.add(d)}renderPlanRules()}
async function loadPlanMeta(force=false){
  if(!mcp||navigator.onLine===false)return;if(metaBusy)return metaBusy;if(!force&&Date.now()-lastMetaAttempt<180000)return;lastMetaAttempt=Date.now();
  metaBusy=(async()=>{const results=await Promise.allSettled([sheetGet("SISTEMA!A1:D70"),sheetGet("SCADENZE!A1:Q30")]);let changed=false;
    if(results[0].status==="fulfilled"){const rows=results[0].value,head=rows.findIndex(r=>r[0]==="CHIAVE"&&r[1]==="VALORE");if(head>=0){const keys=["max_net_day_minutes","max_net_week_minutes","start_iso","cutoff_iso","end_iso","versione_piano","planning_frozen_from","baseline_weight_tab","auto_sync_d035","auto_sync_last"],rules={};for(const r of rows.slice(head+1))if(keys.includes(r[0]))rules[r[0]]=String(r[1]||"");planMeta.rules=rules;planMeta.rulesAt=Date.now();changed=true}}
    if(results[1].status==="fulfilled"){const rows=results[1].value;if(rows[0]?.[0]==="Materia"&&rows[0]?.[1]==="Prova"){const exams=[];for(const r of rows.slice(1)){if(!SUBJ.includes(r[0]))continue;const date=r[7]==="UFFICIALE"?okDate(r[8]):"";exams.push([date||null,r[0],date?String(r[1]||"Appello"):"Data non pubblicata"])}for(const s of SUBJ)if(!exams.some(e=>e[1]===s))exams.push([null,s,"Data non pubblicata"]);planMeta.exams=exams.sort((a,b)=>(a[0]||"9999").localeCompare(b[0]||"9999"));planMeta.examsAt=Date.now();changed=true}}
    if(changed){planMeta.at=Date.now();LS.set("planMeta",planMeta);applyPlanMeta();renderToday();renderStats();renderWeek();renderAnalysis()}
    renderPlanRules();
  })();try{await metaBusy}finally{metaBusy=null}
}
function renderPlanRules(){const el=$("planRules");if(!el)return;const rules=planMeta.rules||{},A=analysisData(),total=Math.max(1,A.total);
  el.innerHTML=`<div class="rule-chips"><span class="pill">${planLimit("max_net_day_minutes",660)}′ / giorno</span><span class="pill">${planLimit("max_net_week_minutes",4410)}′ / settimana</span>${rules.start_iso?`<span class="pill">Avvio ${esc(rules.start_iso)}</span>`:""}</div><p>${rules.planning_frozen_from?"Ripianificazione automatica sospesa dal "+esc(rules.planning_frozen_from)+". ":""}${rules.auto_sync_d035?"Allineamento Calendar: "+esc(rules.auto_sync_d035)+".":""}</p>${rules.auto_sync_last?`<p class="mute">Ultimo esito riportato dal foglio: ${esc(rules.auto_sync_last)}</p>`:""}<p class="mute">${planMeta.rulesAt?"SISTEMA letto "+new Date(planMeta.rulesAt).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"})+(Date.now()-planMeta.rulesAt>240000?" · copia precedente, aggiornamento da verificare":" · controllo automatico ogni 3 minuti a pagina visibile"):"SISTEMA non ancora letto: limiti predefiniti, da verificare."}</p><p><b>Quote del piano attuale</b> ${SUBJ.map(s=>`${s} ${(100*A.per[s].plan/total).toFixed(1)}%`).join(" · ")}</p><p class="mute">Quote = minuti pianificati per materia / minuti del piano. Non sostituiscono i pesi didattici ${rules.baseline_weight_tab?"di "+esc(rules.baseline_weight_tab):"approvati"}.</p>`;
}
function draftRecovery(){const B=Object.values(index).filter(b=>b.stato!=="Rinviato"&&b.stato!=="Verificato autonomamente"&&at(b.date,b.to)<Date.now()&&b.min>doneMin(b)).sort((a,b)=>(a.date+a.from).localeCompare(b.date+b.from));
  if(!B.length){toast("Non risultano minuti arretrati nei blocchi attivi passati");return}const per={};for(const b of B)per[b.mat]=(per[b.mat]||0)+Math.max(0,b.min-doneMin(b));
  const total=Object.values(per).reduce((n,v)=>n+v,0),text=`Richiesta di recupero preparata il ${todayIso()}.\nResiduo misurato dei blocchi attivi passati: ${total} min (${Object.entries(per).map(([s,v])=>`${s} ${v} min`).join("; ")}). Per ciascun blocco: massimo(0, netto PROGRAMMA − massimo(minuti registro, minuti Focus confermati senza sovrapposizioni)).\nBlocchi: ${B.map(b=>`${b.id} ${b.mat} ${Math.max(0,b.min-doneMin(b))} min`).join("; ")}.\nPrepara una proposta con confronto prima/dopo. Conserva verifiche, prerequisiti, pasti, riposo, appelli e pesi M-R13; rispetta ${planLimit("max_net_day_minutes",660)} min/giorno e ${planLimit("max_net_week_minutes",4410)} min/settimana. Non applicare cambiamenti prima della mia approvazione.`;
  const field=$("pReq");field.value=(field.value.trim()?field.value.trim()+"\n\n":"")+text;field.focus({preventScroll:true});field.scrollIntoView({behavior:settings.rm||matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});toast("Bozza pronta: controllala e inviala quando vuoi");
}
$("pDraft").onclick=draftRecovery;
function renderProgress(){if(!$("prMetrics"))return;const calc=PROGRESS.calculate(Object.values(index),ckGet,Object.values(runs)),s=$("prSubject").value,a=s?(calc.subjects[s]||PROGRESS.calculate([]).all):calc.all;
  const names={preparation:"Preparazione",theory:"Teoria",practice:"Pratica",exam:"Esame · prove"},num=n=>Number(n.toFixed(1)).toLocaleString("it-IT");
  $("prMetrics").innerHTML=Object.entries(names).map(([k,label])=>{const m=a[k],pct=m.pct==null?"N/D":num(m.pct)+"%";return `<div class="coverage-metric"><span>${label}</span><strong>${pct}</strong><progress max="100" value="${m.pct||0}" aria-label="${label}${s?" "+s:""}: ${pct}"></progress><small>${m.total?num(m.done)+" / "+num(m.total)+" min ponderati":"Nessuna attività classificata"}</small></div>`}).join("");
  $("prQuality").textContent=`${a.blocks} blocchi attivi. Tipi attribuiti al ${a.preparation.total?num(100*(a.theory.total+a.practice.total+a.exam.total)/a.preparation.total):"0"}% del piano: teoria, pratica ed esame si riferiscono a questa quota. ${a.unclassified?num(a.unclassified)+" min con tipo misto o da classificare. ":""}${a.unparsed?num(a.unparsed)+" min con verifica a livello di blocco. ":""}${a.legacy?a.legacy+" checklist precedenti da riconfermare. ":""}100% indica copertura del piano, non superamento dell’esame. Appelli: ${planMeta.examsAt?"SCADENZE letto "+hm(planMeta.examsAt):"date predefinite da verificare"}.`;
}
$("prSubject").onchange=renderProgress;
function bar(lbl,col,full,part,max,txt){return `<div class="hbar"><b>${esc(lbl)}</b><div class="tr"><i class="b" style="width:${max?100*full/max:0}%;background:${col}"></i><i style="width:${max?100*part/max:0}%;background:${col}"></i></div><span class="mute">${txt}</span></div>`}
function analysisData(){const now=Date.now(),today=todayIso(),B=Object.values(index).filter(b=>b.stato!=="Rinviato"&&b.min>0);
  const per={};for(const s of SUBJ)per[s]={plan:0,done:0,backlog:0,future:0,ver:0,blocks:0,sims:0};
  let backlog=0,future=0,total=0;const dayPlan={},wk={};
  for(const b of B){const p=per[b.mat]||(per[b.mat]={plan:0,done:0,backlog:0,future:0,ver:0,blocks:0,sims:0});const d=doneMin(b),st=at(b.date,b.from),en=at(b.date,b.to);
    p.plan+=b.min;p.done+=Math.min(d,b.min);p.blocks++;total+=b.min;if(b.stato==="Verificato autonomamente")p.ver++;if(/simulazion|eol completa|prova mista|prova pratica/i.test(b.arg))p.sims++;
    if(en<=now){const miss=Math.max(0,b.min-d);p.backlog+=miss;backlog+=miss}else{const rem=st>=now?b.min:Math.max(0,b.min-d);p.future+=rem;future+=rem;dayPlan[b.date]=(dayPlan[b.date]||0)+b.min}
    const w=monday(b.date);wk[w]=(wk[w]||0)+b.min}
  const last=B.map(b=>b.date).sort().pop()||today;let slack=0,days=0;const wkFree={};
  for(let d=today;d<=last;d=addDays(d,1)){if(EXAMDAYS.has(d))continue;days++;const free=Math.max(0,planLimit("max_net_day_minutes",660)-(dayPlan[d]||0)-(d===today?Math.max(0,romeMin(now)-420):0));const w=monday(d);wkFree[w]=(wkFree[w]||0)+free}
  for(const [w,f] of Object.entries(wkFree))slack+=Math.max(0,Math.min(f,planLimit("max_net_week_minutes",4410)-(wk[w]||0)));
  return {per,backlog,future,total,slack,days,wk,last,today}}
/* ---------- carriera UniBo: scheda UNIBO_STATO scritta dal ponte sul PC, letta anche da iPhone ---------- */
const CAREER=window.STUDIOOS_CAREER;let career=LS.get("career",null),careerBusy=null,lastCareerAttempt=0,careerErr="";
function localIso(){const d=new Date(),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function fmtWhen(v){const d=/Z$/.test(v)?new Date(v):new Date(String(v).slice(0,16)+":00");return Number.isFinite(d.getTime())?d.toLocaleString("it-IT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(","," "):"—"}
function bookingFor(subject,date){return career&&CAREER&&date?CAREER.bookedOn(career.summary,subject,date):null}
async function loadCareer(force=false){if(!mcp||!CAREER||navigator.onLine===false){renderCareer();return}if(careerBusy)return careerBusy;if(!force&&Date.now()-lastCareerAttempt<180000)return;lastCareerAttempt=Date.now();
  careerBusy=(async()=>{try{const st=CAREER.parse(await archGet("UNIBO_STATO!A1:J2"));careerErr="";if(st){career=Object.assign(st,{readAt:Date.now()});LS.set("career",career)}else if(!career)careerErr="Il ponte non ha ancora scritto dati"}
    catch(e){careerErr=/range|400|not found/i.test(String(e&&e.message||e))?"Scheda UNIBO_STATO non trovata nell'archivio":"Lettura non riuscita: resta l'ultima copia"}
    renderCareer();renderExamsOnly()})();try{await careerBusy}finally{careerBusy=null}}
function renderExamsOnly(){try{renderWeek()}catch(e){}try{renderToday()}catch(e){}}
function renderCareer(){const el=$("crBody");if(!el||!CAREER)return;const f=CAREER.freshness(career,Date.now()),fr=$("crFresh");
  fr.className="small career-fresh lvl-"+f.level;fr.textContent=[careerErr,f.label,career&&career.readAt?"letto qui alle "+new Date(career.readAt).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}):""].filter(Boolean).join(" · ");
  if(!career){el.innerHTML='<p class="small mute">Ancora nessun riepilogo. Sul PC il ponte UniBoh scrive la scheda nascosta UNIBO_STATO dell\'archivio: da lì i dati arrivano qui e sull\'iPhone.</p>';$("crAll").innerHTML="";return}
  const S=career.summary,plan=(S.plan&&S.plan.data)||[],st=CAREER.stats(plan),pct=st.cfuTotali?Math.round(st.cfuAcquisiti/st.cfuTotali*1000)/10:0,subj=CAREER.bySubject(S,localIso()),num=v=>v==null?"n.d.":String(v).replace(".",",");
  $("crProg").textContent=(S.programme&&S.programme.data&&S.programme.data.name)||"Università di Bologna";
  const names={plan:"piano esami",history:"cronologia",bookable:"prenotabilità",programme:"corso di studio"},bad=Object.keys(names).filter(k=>S[k]&&S[k].status!=="ok");
  el.innerHTML=`<div class="career-head"><div class="career-ring" style="--p:${pct}" role="img" aria-label="${st.cfuAcquisiti} CFU su ${st.cfuTotali}"><b>${st.cfuAcquisiti}</b><span>/${st.cfuTotali} CFU</span></div>
    <div class="kpis career-kpis"><div class="kpi"><b>${num(st.mediaPonderata)}</b><span>media ponderata</span></div><div class="kpi"><b>${num(st.mediaAritmetica)}</b><span>media aritmetica</span></div><div class="kpi"><b>${st.verbalizzati}/${st.esamiTotali}</b><span>verbalizzati</span></div>${st.lodi?`<div class="kpi"><b>${st.lodi}</b><span>${st.lodi===1?"lode":"lodi"}</span></div>`:""}</div></div>
    <h3>Le materie della sessione</h3><ul class="career-subj">${SUBJ.map(s=>{const x=subj[s]||{},it=x.item,b=x.booking;
      const tag=b?`<span class="pill ok">Prenotato · ${fmtWhen(b.at)} · ${esc(b.mode)}</span>`:it&&it.state==="verbalizzato"?`<span class="pill ok">${esc(it.grade||"verbalizzato")}</span>`:it&&it.bookable?'<span class="pill warn">Prenotabile ora</span>':`<span class="small mute">${esc(it?it.state:"non nel piano esami")}</span>`;
      return `<li><span class="dot" style="background:var(--${s})"></span><span class="sp"><b>${s}</b> <span class="small mute">${esc(it?it.name.toLowerCase():"")}</span></span>${tag}</li>`}).join("")}</ul>
    ${bad.length?`<p class="small warn-text">Non aggiornati all'ultimo controllo: ${bad.map(k=>names[k]+(S[k].at?" (ultima lettura riuscita "+fmtWhen(S[k].at)+")":" (mai letto)")).join(", ")}.</p>`:""}`;
  $("crAll").innerHTML=`<table class="career-table"><thead><tr><th>Insegnamento</th><th>CFU</th><th>Esito</th></tr></thead><tbody>${plan.map(x=>`<tr><td>${esc(x.name.toLowerCase())}<span class="small mute"> · ${x.year||"?"}° anno</span></td><td>${x.cfu}</td><td>${x.state==="verbalizzato"?esc(x.grade||"✓"):x.state==="prenotato"?"prenotato":x.bookable?"prenotabile":"—"}</td></tr>`).join("")}</tbody></table>`}
$("crAsk").onclick=async()=>{if(!mcp){toast("Collega Google per chiedere un aggiornamento");return}
  try{await archSet("UNIBO_STATO!B1",[[new Date().toISOString()]]);buzz(8);toast("Richiesta inviata: con il PC acceso il ponte aggiorna entro pochi minuti",4500);setTimeout(()=>loadCareer(true),180000)}
  catch(e){toast(/Sola lettura/.test(String(e.message||e))?"Registrazione nei fogli spenta qui: rileggo l'ultima copia":"Richiesta non inviata: "+String(e.message||e).slice(0,70),4500)}loadCareer(true)};
setTimeout(renderCareer,0);
function renderAnalysis(){renderProgress();if(!$("anHours"))return;const A=analysisData(),now=Date.now(),weekLimit=planLimit("max_net_week_minutes",4410),dayLimit=planLimit("max_net_day_minutes",660);
  $("anInfo").textContent=`Dati: PROGRAMMA (${Object.keys(index).length} righe, ultimo caricamento ${(LS.get("index",{}).at?new Date(LS.get("index",{}).at).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"}):"—")}), registro K e sessioni confermate in Focus. Aggiornato ${new Date(now).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}.`;
  const mx=Math.max(...SUBJ.map(s=>A.per[s].plan),1);
  $("anHours").innerHTML=SUBJ.map(s=>{const p=A.per[s];return bar(s,`var(--${s})`,p.plan,p.done,mx,`${Math.round(p.done/60)}/${Math.round(p.plan/60)} h · ${p.plan?Math.round(100*p.done/p.plan):0}%`)}).join("")+
    bar("Tot.","var(--acc)",A.total,SUBJ.reduce((t,s)=>t+A.per[s].done,0),A.total,`${Math.round(SUBJ.reduce((t,s)=>t+A.per[s].done,0)/60)}/${Math.round(A.total/60)} h`);
  const W=Object.entries(A.wk).sort(),wmx=Math.max(weekLimit,...W.map(([,v])=>v));
  $("anWeeks").innerHTML=W.map(([w,v])=>`<div class="c" title="Settimana dal ${w}: ${v} min"><i style="height:${100*v/wmx}%;background:${v>weekLimit?"var(--bad,#e5484d)":"var(--acc)"};opacity:${w<monday(A.today)?.45:1}"></i></div>`).join("")+`<div class="cap" style="bottom:${100*weekLimit/wmx}%"></div>`;$("anLimit").textContent=`Linea tratteggiata: ${weekLimit.toLocaleString("it-IT")} min/settimana. Colonne: piano da lunedì a domenica. ${planMeta.rulesAt?"Limite da SISTEMA.":"Limite predefinito, da verificare."}`;
  const pct=x=>Math.max(0,Math.min(100,Math.round(100*x)));const sc=[["Attuale",A.backlog,"il recupero non viene ripianificato"],["Ottimizzato",A.backlog,"recupero negli spazi liberi"],["Prudente",A.backlog+Math.round(.15*A.future),"+15% di imprevisti sul futuro"]];
  const rows=sc.map(([n,need,why],i)=>{const lost=i===0?need:Math.max(0,need-A.slack),cov=pct((A.total-lost)/Math.max(1,A.total)),marg=i===0?A.slack:A.slack-need;
    return `<tr><td><b>${n}</b><div class="mute">${why}</div></td><td>${Math.round((A.future+(i?need:0))/60)} h</td><td>${Math.round(A.slack/60)} h</td><td>${marg<0?`<b style="color:var(--bad)">${Math.round(marg/60)} h</b>`:Math.round(marg/60)+" h"}</td><td>${cov}%</td></tr>`}).join("");
  const risk=SUBJ.filter(s=>A.per[s].backlog>60).map(s=>`${s} (${A.per[s].backlog}′ arretrati)`);
  $("anFeas").innerHTML=`<p>[Stima] ${A.days} giorni di studio fino al ${A.last.slice(8)}/${A.last.slice(5,7)} (esami esclusi) · residuo pianificato <b>${Math.round(A.future/60)} h</b> · arretrato <b>${Math.round(A.backlog/60)} h</b> · capacità teorica entro ${dayLimit}/giorno e ${weekLimit}/settimana <b>${Math.round(A.slack/60)} h</b>. La capacità va verificata con i vincoli personali prima di una ridistribuzione.</p>
    <table class="scen"><tr><th>Scenario</th><th>Ore necessarie</th><th>Spazio</th><th>Margine</th><th>Copertura</th></tr>${rows}</table>
    <p class="mute">Copertura = quota del piano svolta o recuperabile; non misura la preparazione. ${risk.length?"A rischio: "+risk.join(", ")+".":"Nessuna materia con più di 60′ di arretrato."}</p>`;
  const conf=Object.values(runs).filter(r=>r.status==="confirmed"),by=k=>conf.filter(r=>r.outcome===k).length,errs=Object.values(errors);
  $("anEx").innerHTML=`<p>Sessioni confermate ${conf.length} · verificate autonomamente ${by("Verificato autonomamente")} · parziali o da consolidare ${by("Parziale")+by("Da consolidare")} · errori registrati ${errs.length} (recuperati ${errs.filter(e=>e.resolved).length}, da ripassare oggi ${dueErrors().length}).</p>
    <p>${SUBJ.map(s=>`${s}: ${A.per[s].sims} prove a tempo nel piano, ${sims().filter(x=>x.materia===s).length} registrate`).join(" · ")}</p>`;
  $("anGrade").innerHTML=SUBJ.map(s=>{const L=sims().filter(x=>x.materia===s).map(x=>30*x.score/x.max);let t;
    if(L.length>=2){const l=L.slice(-2),m=(l[0]+l[1])/2,h=Math.max(1.5,Math.abs(l[0]-l[1])/2);t=`≈ <b>${m.toFixed(1)}/30</b> (fascia ${Math.max(0,m-h).toFixed(0)}–${Math.min(30,m+h).toFixed(0)}) [Stima sulle ultime 2 simulazioni]`}
    else if(L.length===1)t=`1 simulazione: ${L[0].toFixed(1)}/30 — serve almeno una seconda prova per una stima`;else t="Dati insufficienti per stimare il voto";
    return `<p><b>${s}</b>: ${t}<br><span class="mute">Scenario con programma completato: ${A.per[s].sims} prove a tempo previste; la stima si basa solo sui punteggi che registri, non sulle ore.</span></p>`}).join("")}
/* ---------- boot ---------- */
const BOOT_HASH=location.hash;
(async function boot(){applySettings();bindSettings();installHelp();applyPlanMeta();curView="";show(location.hash.slice(1)||"focus");
  runs=LS.get("cacheRuns",{});errors=LS.get("cacheErr",{});syncState=Object.assign(LS.get("cacheState",{}),syncState);for(const [col,id,obj] of queue()){const target=col==="runs"?runs:col==="errors"?errors:syncState;if(!target[id]||SYNC.compare(col+"/"+id,obj,target[id])>=0)target[id]=obj}const ci=LS.get("index",null);if(ci){index=ci.idx;if(curView==="settimana"){renderWeek();renderAnalysis()}else renderProgress()}
  $("todayLbl").textContent=dayLabel(todayIso());const loc=LS.get("active",null);if(loc&&loc.run&&loc.run.status==="active"&&!SYNC.terminal(runs[loc.run.runId])){const cached=runs[loc.run.runId];run=cached&&SYNC.compare("runs/"+cached.runId,cached,loc.run)>0?cached:loc.run;lastKey=keyOf(advance(run,Date.now()))}
  requestAnimationFrame(frame);if(Object.keys(index).length)await loadDay(curDay);
  const to=ms=>new Promise(r=>setTimeout(()=>r(null),ms));
  try{mcp=await Promise.race([window.claude&&window.claude.use?window.claude.use("mcp"):null,to(10000)])}catch(e){mcp=null}
  try{db=await Promise.race([window.claude&&window.claude.use?window.claude.use("db"):null,to(10000)])}catch(e){db=null}
  if(!mcp){chip("cCal","bad",CAL_ID?"Calendar: non autorizzato":"Calendar: non configurato");calTip(CAL_ID?"Google non collegato o accesso scaduto: Impostazioni › Collega Google":"Nessun calendario scelto");chip("cSh",Object.keys(index).length?"warn":"bad",Object.keys(index).length?"Sheets: copia locale":"Sheets ✗")}
  if(db){try{await loadArchive();await flush()}catch(e){chip("cDb","warn","Archivio: solo locale")}
    try{const s=await db.doc("state/live").get();if(s.exists)adopt(s.data(),"init")}catch(e){}subscribeLive()}
  else{chip("cDb","bad","Archivio ✗ (solo locale)");syncUI(false,bc?"Sync tra schede":"Sync assente")}
  if(mcp){try{await loadIndex()}catch(e){const k=Object.keys(index).length;chip("cSh",k?"warn":"bad",k?"Sheets: copia locale":"Sheets ✗")}}
  await loadDay(curDay);renderStats();renderWeek();renderRuns();renderAllErr();renderPlan();renderToday();renderProgress();renderPlanRules();dataReady=true;lastDataRefresh=Date.now();if(mcp){loadPlan();loadPlanMeta();loadCareer()}
  try{const h=BOOT_HASH.match(/b=(R20-\d{4})/);if(h&&index[h[1]]){openSession(h[1],index[h[1]].date)}}catch(e){}
  if(run&&run.status==="active"){const b=index[run.blockId];openSession(run.blockId,b&&b.date,true);acquireWakeIf();checkGap()}
  setTimeout(()=>logNow(addDays(todayIso(),-1)),8000)})();

