/* Carriera UniBo letta dalla scheda UNIBO_STATO dell'archivio (scritta dal ponte sul PC).
   Funzioni pure: nessun accesso alla rete, nessun dato inventato. */
(function(root){
  "use strict";
  const CODES={MDP:"77776",BD:"10906",MN:"B2561",FIS:"00405",OOP:"70219",RETI:"70226"};
  const STALE_MS=3*3600e3;
  function parse(rows){
    const r1=(rows&&rows[0])||[],r2=(rows&&rows[1])||[],n=Number(r2[0])||0;if(!n)return null;
    let summary=null;try{summary=JSON.parse(r2.slice(1,1+n).join(""))}catch(e){return null}
    if(!summary||summary.v!==1||!summary.plan)return null;
    return {summary,request:String(r1[1]||""),checkedAt:String(r1[2]||""),outcome:String(r1[3]||""),bridge:String(r1[4]||"")};
  }
  /* Le medie si ricalcolano qui dagli stessi dati, così un riepilogo vecchio non mostra numeri incoerenti. */
  function stats(plan){
    const done=plan.filter(x=>x.state==="verbalizzato"),graded=done.filter(x=>typeof x.gradeNum==="number"&&x.gradeNum>=18&&x.gradeNum<=30);
    const cfuG=graded.reduce((a,x)=>a+(+x.cfu||0),0),r2=v=>Math.round(v*100)/100;
    return {cfuTotali:plan.reduce((a,x)=>a+(+x.cfu||0),0),cfuAcquisiti:done.reduce((a,x)=>a+(+x.cfu||0),0),esamiTotali:plan.length,verbalizzati:done.length,
      conVoto:graded.length,lodi:graded.filter(x=>x.lode).length,idoneita:done.length-graded.length,
      mediaPonderata:cfuG?r2(graded.reduce((a,x)=>a+x.gradeNum*(+x.cfu||0),0)/cfuG):null,mediaAritmetica:graded.length?r2(graded.reduce((a,x)=>a+x.gradeNum,0)/graded.length):null};
  }
  function freshness(state,now){
    if(!state)return {level:"none",label:"Nessun dato UniBoh"};
    const t=Date.parse(state.checkedAt);if(!Number.isFinite(t))return {level:"none",label:"Orario del controllo non leggibile"};
    if(now-t>STALE_MS)return {level:"stale",label:"Ultimo controllo dal PC "+ago(now-t)+" fa"};
    if(state.outcome&&state.outcome!=="ok")return {level:"partial",label:"Controllo parziale: "+state.outcome.replace(/^parziale ·\s*/,"")};
    return {level:"ok",label:"Controllato dal PC "+ago(now-t)+" fa"};
  }
  function ago(ms){const m=Math.max(0,Math.round(ms/60000));return m<1?"meno di un minuto":m<60?m+" min":m<2880?Math.round(m/60)+" h":Math.round(m/1440)+" giorni"}
  function bySubject(summary,nowIso){
    const plan=(summary&&summary.plan&&summary.plan.data)||[],hist=(summary&&summary.history&&summary.history.data)||[],out={};
    for(const [s,code] of Object.entries(CODES)){
      const p=plan.find(x=>x.code===code)||null;
      const next=hist.filter(h=>h.code===code&&h.status==="prenotato"&&h.at>=nowIso).sort((a,b)=>a.at<b.at?-1:1)[0]||null;
      out[s]={code,item:p,booking:next};
    }
    return out;
  }
  /* Una data d'esame del piano risulta prenotata solo se esiste una prenotazione AlmaEsami nello stesso giorno. */
  function bookedOn(summary,subject,date){
    const code=CODES[subject];if(!code||!date)return null;
    const hist=(summary&&summary.history&&summary.history.data)||[];
    return hist.find(h=>h.code===code&&h.status==="prenotato"&&String(h.at).slice(0,10)===date)||null;
  }
  const api={CODES,parse,stats,freshness,bySubject,bookedOn,ago,STALE_MS};
  root.STUDIOOS_CAREER=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
