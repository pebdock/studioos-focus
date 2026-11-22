/* Misure di studio e argomenti: funzioni pure condivise fra PWA e Apps Script.
 * Copertura, tempo, autovalutazione e verifica restano indicatori distinti.
 * Nessuna rete, nessuna generazione di voti o di minuti mancanti.
 */
(function(root){
  'use strict';
  const VERSION='learning/1', TYPES=['theory','practice','exam'];
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[«»“”"']/g,'').replace(/\s+/g,' ').trim();
  const rating=x=>x!==''&&x!=null&&Number.isInteger(+x)&&+x>=1&&+x<=5?+x:null;
  const median=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2:null};
  const round=n=>Math.round(n*10)/10;
  function hash(s){let a=2166136261,b=5381;for(const ch of String(s)){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b,33)^ch.charCodeAt(0)}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')}
  function day(ms){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date(ms))}
  function clock(ms){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(' ','T')}
  function at(iso,hhmm){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm||''))return NaN;
    const [y,m,d]=iso.split('-').map(Number),[h,n]=hhmm.split(':').map(Number),utc=Date.UTC(y,m-1,d,h,n);
    if(new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==iso)return NaN;
    let value=utc;
    for(let i=0;i<3;i++){const shown=clock(value),[dt,tm]=shown.split('T'),[yy,mm,dd]=dt.split('-').map(Number),[hh,nn]=tm.split(':').map(Number);value+=utc-Date.UTC(yy,mm-1,dd,hh,nn)}
    return clock(value)===iso+'T'+hhmm?value:NaN;
  }
  function addDays(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  function canonicalBlock(b){return {id:b.id,mat:b.mat||b.materia||'',arg:b.arg||b.argomento||'',cons:b.cons||b.consegna||'',min:+(b.min??b.minNetti)||0,date:b.date||b.data||'',from:b.from||b.dalle||'',to:b.to||b.alle||'',mats:b.mats||b.materiali||'',stato:b.stato||'',fatti:+(b.fatti??b.minFatti)||0}}
  function units(input){
    const b=canonicalBlock(input),found=[];
    const re=/(\d+)\s*min(?:uti)?(?:\s*netti)?\s*[—–-]\s*origine\s+(R\d+-\d+),\s*unità\s*«([^»]+)»,\s*quota\s*\[\s*(\d+),\s*(\d+)\)\s*di\s*(\d+)\s*min/gi;
    for(const m of b.cons.matchAll(re))found.push({name:m[3],origin:m[2],minutes:+m[1],range:[+m[4],+m[5]],whole:+m[6],precision:'unità'});
    if(!found.length){
      const old=/(?:^|\n)Unità «([^»]+)»\. In questo blocco dedica (\d+) minuti netti alla quota\s*(\d+)\s*[–-]\s*(\d+)\s+di\s*(\d+)/g;
      for(const m of b.cons.matchAll(old))found.push({name:m[1],origin:null,minutes:+m[2],range:[Math.max(0,+m[3]-1),+m[4]],whole:+m[5],precision:'unità'});
    }
    if(!found.length)found.push({name:b.arg||b.id,origin:null,minutes:b.min,range:null,whole:b.min,precision:'blocco'});
    const sum=found.reduce((s,x)=>s+x.minutes,0);
    return found.map((u,i)=>{const key=b.mat+'|'+(u.origin?u.origin+'|':'')+norm(u.name);return {...u,id:'topic_'+hash(key),key,subject:b.mat,blockId:b.id,ordinal:i,plannedMin:sum?b.min*u.minutes/sum:0,materials:b.mats}});
  }
  function mergeIntervals(list){const sorted=list.filter(x=>Number.isFinite(x[0])&&Number.isFinite(x[1])&&x[1]>x[0]).map(x=>[x[0],x[1]]).sort((a,b)=>a[0]-b[0]),out=[];for(const [s,e]of sorted){const last=out[out.length-1];if(last&&s<=last[1])last[1]=Math.max(last[1],e);else out.push([s,e])}return out}
  function segments(r){if(r.status!=='confirmed'||!Number.isFinite(+r.confirmedAt))return [];return mergeIntervals((r.segments||[]).map(x=>[+x[0],Math.min(+x[1]||+r.confirmedAt,+r.confirmedAt)]).filter(x=>x[0]>=+r.startedAt&&x[1]<=+r.confirmedAt))}
  function samples(r){const ls=(r.learning?.samples||[]).filter(x=>Number.isFinite(+x.at)&&+x.at>=+r.startedAt&&+x.at<=+r.confirmedAt).map(x=>({...x,at:+x.at,energy:rating(x.energy),focus:rating(x.focus),confidence:rating(x.confidence),motivation:rating(x.motivation)})).sort((a,b)=>a.at-b.at);return ls}
  function observedParts(r,b){
    const list=units(b),ls=samples(r),parts=[];
    for(const [start,end]of segments(r)){
      const cuts=[start,...ls.filter(x=>x.at>start&&x.at<end).map(x=>x.at),end];
      for(let i=0;i<cuts.length-1;i++){
        const s=cuts[i],e=cuts[i+1],sample=ls.filter(x=>x.at<=s&&x.stage!=='end').at(-1)||{},chosen=list.find(u=>u.id===sample.topicId);
        const topic=chosen||(list.length===1?list[0]:null);
        parts.push({s,e,runId:r.runId,blockId:r.blockId,subject:r.materia||b.mat,topicId:topic?.id||null,type:TYPES.includes(sample.activity)?sample.activity:'',sample,rank:+r.confirmedAt||0});
      }
    }
    return parts;
  }
  // Una sovrapposizione confermata da due dispositivi viene contata una sola volta.
  // Nei tratti sovrapposti prevale la conferma più recente; i minuti non sono duplicati.
  function dedupeParts(parts){
    const cuts=[...new Set(parts.flatMap(p=>[p.s,p.e]))].sort((a,b)=>a-b),out=[];
    for(let i=0;i<cuts.length-1;i++){const s=cuts[i],e=cuts[i+1],active=parts.filter(p=>p.s<=s&&p.e>=e).sort((a,b)=>b.rank-a.rank||String(a.runId).localeCompare(String(b.runId)));if(!active.length)continue;const p={...active[0],s,e};const last=out.at(-1);if(last&&last.e===s&&last.runId===p.runId&&last.topicId===p.topicId&&last.type===p.type&&last.sample===p.sample)last.e=e;else out.push(p)}
    return out;
  }
  function verified(r,b,progress){return r.status==='confirmed'&&r.outcome==='Verificato autonomamente'&&r.selfCheck===true&&String(r.evidence||'').trim()!==''&&!!r.planKey&&r.planKey===progress.planKey(b)}
  function stepTopic(step,list){
    if(list.length===1)return list[0];
    const t=norm(step.t).replace(/….*$/,'').replace(/\.\.\..*$/,'').trim();
    const matches=list.filter(u=>t.length>=12&&(norm(u.name).startsWith(t)||t.includes(norm(u.name))||norm(u.name).includes(t)));
    return matches.length===1?matches[0]:null;
  }
  function calculate(inputs,runList=[],state={},errorList=[],progress,now=Date.now()){
    if(!progress)throw Error('Modulo copertura non disponibile');
    const blocks=inputs.map(canonicalBlock).filter(b=>b.min>0&&b.stato!=='Rinviato'),byId=Object.fromEntries(blocks.map(b=>[b.id,b])),topics=new Map();
    for(const b of blocks){
      const list=units(b),steps=progress.steps(b.cons,b.min),check=progress.resolve(state['chk_'+b.id],steps),den=steps.reduce((n,s)=>n+progress.minutes(s),0),proof=runList.some(r=>r.blockId===b.id&&verified(r,b,progress)),full=b.stato==='Verificato autonomamente'||proof,final=steps.findIndex(s=>s.verify);
      for(const u of list){let t=topics.get(u.key);if(!t){t={...u,blockId:undefined,ordinal:undefined,plannedMin:0,coveredMin:0,verifiedMin:0,measuredMin:0,confidence:null,confidenceAt:0,blocks:[],errors:0,due:null};topics.set(u.key,t)}t.plannedMin+=u.plannedMin;t.blocks.push({id:b.id,date:b.date,from:b.from,to:b.to,plannedMin:round(u.plannedMin),range:u.range,planKey:progress.planKey(b)});if(full)t.coveredMin+=u.plannedMin;if(proof)t.verifiedMin+=u.plannedMin}
      if(!full&&den>0){for(let i=0;i<steps.length;i++){const s=steps[i],u=stepTopic(s,list),d=progress.minutes(s),type=check.types[i]||progress.category(s);if(!u||!d||check.items[i]!==2||((s.coarse||type==='exam')&&check.items[final]!==2))continue;topics.get(u.key).coveredMin+=Math.min(u.plannedMin,b.min*d/den)}}
    }
    const topicById=new Map([...topics.values()].map(t=>[t.id,t])),confirmed=runList.filter(r=>r.status==='confirmed'&&byId[r.blockId]),parts=dedupeParts(confirmed.flatMap(r=>observedParts(r,byId[r.blockId]))),daily={},heat={},activity={theory:0,practice:0,exam:0,unclassified:0},ratings=[],interruptions={};
    let totalMin=0,unassignedMin=0;
    for(const p of parts){const min=(p.e-p.s)/60000;totalMin+=min;const t=topicById.get(p.topicId);if(t)t.measuredMin+=min;else unassignedMin+=min;activity[p.type||'unclassified']+=min;
      for(let s=p.s;s<p.e;){const end=Math.min(p.e,(Math.floor(s/3600000)+1)*3600000),d=day(s),h=+clock(s).slice(11,13),n=(end-s)/60000;daily[d]=(daily[d]||0)+n;const key=p.subject+'|'+h;if(!heat[key])heat[key]={subject:p.subject,hour:h,min:0,focus:[],days:new Set(),runs:new Set()};heat[key].min+=n;heat[key].days.add(d);heat[key].runs.add(p.runId);if(p.sample.focus)heat[key].focus.push(p.sample.focus);s=end}
    }
    for(const r of confirmed){
      const b=byId[r.blockId],ls=samples(r);
      for(const s of ls){ratings.push({runId:r.runId,at:s.at,subject:b.mat,stage:s.stage||'interval',energy:s.energy,focus:s.focus,motivation:s.motivation,confidence:s.confidence});const t=topicById.get(s.topicId);if(t&&s.confidence&&s.at>=t.confidenceAt){t.confidence=s.confidence;t.confidenceAt=s.at}}
      if(!ls.length&&rating(r.focusScore))ratings.push({runId:r.runId,at:r.confirmedAt,subject:b.mat,stage:'end',energy:null,focus:rating(r.focusScore),motivation:null,confidence:null});
      for(const x of r.interruptions||[]){const k=String(x.reason||'Altro'),next=(r.segments||[]).map(s=>+s[0]).filter(s=>s>+x.at).sort((a,b)=>a-b)[0],end=next||+r.confirmedAt;const q=interruptions[k]||(interruptions[k]={reason:k,count:0,pausedMin:0});q.count++;if(end>+x.at)q.pausedMin+=(end-x.at)/60000}
    }
    for(const e of errorList){if(e.resolved)continue;const b=byId[e.blockId],list=b?units(b):[];const t=topicById.get(e.topicId)||(list.length===1?topicById.get(list[0].id):null);if(t){t.errors++;if(e.due&&(!t.due||e.due<t.due))t.due=e.due}}
    const today=day(now);let streak=0,d=daily[today]>0?today:addDays(today,-1);while(daily[d]>0){streak++;d=addDays(d,-1)}
    const weights={};for(const s of new Set(blocks.map(b=>b.mat))){const observations=[];
      for(const b of blocks.filter(b=>b.mat===s)){const current=confirmed.filter(r=>r.blockId===b.id&&r.planKey===progress.planKey(b)&&r.plannedMin===b.min);if(!current.some(r=>verified(r,b,progress)))continue;const net=mergeIntervals(current.flatMap(segments)).reduce((n,[a,z])=>n+(z-a)/60000,0),ratio=net/b.min;if(ratio>=.25&&ratio<=4)observations.push({ratio,day:day(Math.min(...current.map(r=>r.startedAt)))})}
      const days=new Set(observations.map(x=>x.day)),ratios=observations.map(x=>x.ratio),enough=ratios.length>=5&&days.size>=3,ratio=enough?median(ratios):null;weights[s]={samples:ratios.length,days:days.size,minimumSamples:5,minimumDays:3,status:enough?'proposta':'dati insufficienti',ratio,coefficient:enough?Math.min(1.2,Math.max(.8,ratio)):null,applied:false}}
    return {schema:VERSION,at:new Date(now).toISOString(),topics:[...topics.values()].map(t=>({...t,plannedMin:round(t.plannedMin),coveredMin:round(Math.min(t.plannedMin,t.coveredMin)),verifiedMin:round(Math.min(t.plannedMin,t.verifiedMin)),measuredMin:round(t.measuredMin),coverage:t.plannedMin?Math.floor(1000*Math.min(t.coveredMin,t.plannedMin)/t.plannedMin)/10:null})),totalMin:round(totalMin),unassignedMin:round(unassignedMin),activity:Object.fromEntries(Object.entries(activity).map(([k,v])=>[k,round(v)])),daily:Object.fromEntries(Object.entries(daily).map(([k,v])=>[k,round(v)])),heat:[...Object.values(heat)].map(h=>({subject:h.subject,hour:h.hour,min:round(h.min),focus:median(h.focus),samples:h.runs.size,days:h.days.size,suggestible:h.runs.size>=5&&h.days.size>=3&&h.focus.length>=5})),ratings,interruptions:Object.values(interruptions).map(x=>({...x,pausedMin:round(x.pausedMin)})),streak,weights};
  }
  function quiz(b,topic){const c=canonicalBlock(b),name=topic?.name||c.arg,criterion=progressCriterion(c.cons);return {id:'quiz_'+hash(c.id+'|'+c.cons),source:{blockId:c.id,materials:c.mats,criterion},questions:[{id:'recall',text:'Senza appunti, ricostruisci una regola o un procedimento di «'+name+'» e spiega quando si usa.'},{id:'apply',text:'Esegui il tentativo autonomo indicato nella consegna. Riporta pagina, esercizio e risultato osservabile.'},{id:'check',text:'Confronta il tentativo con il materiale solo dopo averlo finito: quale errore o caso limite hai controllato?'}],grading:'Autovalutazione documentata: nessuna correzione automatica o voto inventato.'}}
  function progressCriterion(cons){return String(cons||'').split('\n').filter(s=>/^\s*(verifica|criterio|regola)/i.test(s)).join('\n').slice(0,2000)}
  function validQuiz(q){return Array.isArray(q?.answers)&&q.answers.length>=2&&q.answers.every(a=>String(a.text||'').trim().length>=3&&a.checked===true)&&q.selfAssessed===true}
  function simulateAverage(plan,code,grade){
    if(!Number.isInteger(+grade)||+grade<18||+grade>30)return {ok:false,error:'Inserisci un voto fra 18 e 30'};
    const target=plan.find(x=>x.code===code);if(!target||target.state==='verbalizzato'||!(target.cfu>0))return {ok:false,error:'Scegli un esame da sostenere con CFU noti'};
    const graded=plan.filter(x=>x.state==='verbalizzato'&&x.gradeNum>=18&&x.gradeNum<=30&&x.cfu>0),cfu=graded.reduce((n,x)=>n+x.cfu,0),sum=graded.reduce((n,x)=>n+x.cfu*x.gradeNum,0),result=(sum+target.cfu*+grade)/(cfu+target.cfu);
    return {ok:true,hypothetical:true,before:cfu?round(sum/cfu):null,after:round(result),cfuAdded:target.cfu,grade:+grade,code};
  }
  function health(input,now=Date.now()){
    const item=(id,label,t,max,detail)=>({id,label,at:t||null,level:!t?'unknown':now-Date.parse(t)>max?'warning':'ok',detail:detail||''});
    const s=input.system||{},out=[item('bridge','Ponte UniBoh',input.career?.checkedAt,3*3600e3,input.career?.outcome),item('tutor','Tutor',s.tutorAt,30*3600e3,s.tutorStatus),item('backup','Backup',s.backupAt,30*3600e3,s.backupStatus)];
    if(input.outbox>0)out.push({id:'outbox',label:'Salvataggi in attesa',at:null,level:'warning',detail:String(input.outbox)});
    for(const x of out)if(/errore|error|failed|sospeso|conflitto/i.test(x.detail))x.level='error';
    return out;
  }
  function safeContext({blocks,runs,errors,state,career,analysis,now=Date.now()}){return {schema:'studioos.context/3',exportedAt:new Date(now).toISOString(),rules:['Nessun minuto inventato','Il tempo non dimostra la padronanza','Nessun completamento senza prova','Solo PIANO_PROPOSTE per modifiche da approvare','Nessuna iscrizione automatica agli esami'],blocks:blocks.map(canonicalBlock),runs:runs.filter(r=>r.status==='confirmed'),errors,state:Object.values(state||{}).filter(s=>s&&s.key!=='live'&&!/^push_|^secret_|^credential_/i.test(s.key)),career:career?.summary||career||null,analysis};}
  const api={VERSION,TYPES,norm,hash,rating,median,round,day,clock,at,addDays,canonicalBlock,units,mergeIntervals,segments,samples,observedParts,dedupeParts,verified,calculate,quiz,validQuiz,simulateAverage,health,safeContext};
  root.STUDIOOS_LEARNING=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
