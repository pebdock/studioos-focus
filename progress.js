/* Plan coverage, not an estimate of mastery or the probability of passing. */
(function(root){
  "use strict";
  function kind(t){t=t.toLowerCase();return /simulaz|prova (a tempo|mista)|eol completa/.test(t)?"Simulazione":/correz|errori|confronta/.test(t)?"Correzione":/ripass|richiamo|riprova/.test(t)?"Ripasso":/eserciz|problem|tentativ|laborat|notebook|query|schema|implementa|test/.test(t)?"Esercizi":/teoria|leggi|studia|slide|pp\.|definiz|ricostruisci/.test(t)?"Teoria":/verifica/.test(t)?"Verifica":""}
  function steps(cons,budget=0){cons=String(cons||"");let out=[];const m=/SCALETTA:\s*([^\n]+)/.exec(cons);
    if(m)for(const part of m[1].split(/;\s*/)){const p=/^pausa\s+(\d\d:\d\d)[–-](\d\d:\d\d)/i.exec(part),w=/^(\d\d:\d\d)[–-](\d\d:\d\d)\s*(.*)$/.exec(part);
      if(p)out.push({a:p[1],b:p[2],t:"Pausa",pause:true});else if(w){const t=w[3].replace(/\s*quota \[[^\]]+\)/,"");out.push({a:w[1],b:w[2],t,k:kind(t),source:w[3]})}}
    if(!out.filter(s=>!s.pause).length){out=[];const ord=cons.split(/ORDINE OPERATIVO:/)[1]||"";
      for(const l of ord.split("\n")){const w=/^\s*\d+\.\s*(\d+)\s*min(?:\s*netti)?\s*[—–-]\s*(.+)$/.exec(l);if(w)out.push({a:"",b:"",t:w[2].replace(/,?\s*quota \[[^\]]+\) di \d+ min\.?/,"").slice(0,160),min:+w[1],k:kind(w[2]),source:w[2]})}}
    if(!out.length)for(const l of cons.split("\n")){const w=/^-\s*(?:Pausa\s+)?(\d\d:\d\d)[–-](\d\d:\d\d)[.,:]?\s*(.*)$/.exec(l.trim());if(w)out.push({a:w[1],b:w[2],t:w[3]||"Pausa",pause:/^-\s*Pausa/i.test(l.trim()),k:kind(w[3]||""),source:w[3]})}
    // Older plans describe quotas without clock times. Keep existing pauses intact.
    if(!out.some(s=>minutes(s)>0)){
      const legacy=cons.split(/ATTIVITÀ NELL'ORDINE[^\n]*:\s*\n/i)[1]?.split(/\nMATERIALI ESATTI/i)[0]||"";
      for(const l of legacy.split("\n")){const w=/^-\s*(\d+)\s*min,\s*provenienza\s+(R20-\d+)\s+\(«(.+?)»\):\s*(.+)$/.exec(l.trim());if(w)out.push({a:"",b:"",t:w[3],min:+w[1],source:l.trim(),k:kind(w[4])})}
      if(!out.some(s=>minutes(s)>0)){const units=cons.matchAll(/(?:^|\n)Unità «([^»]+)»\. In questo blocco dedica (\d+) minuti netti alla quota[^\n]+(?:\n|$)([\s\S]*?)(?=\nUnità «|\nVerifica finale:|\nNota D-|$)/g);
        for(const w of units)out.push({a:"",b:"",t:w[1],min:+w[2],source:w[0].trim(),k:kind(w[1])})}
      if(!out.some(s=>minutes(s)>0)&&budget>0&&cons.trim()){
        const task=(/Come lavorare:\s*([\s\S]*?)(?=\n(?:Verifica finale:|VERIFICA FINALE:|Nota D-)|$)/i.exec(cons)||[])[1]||cons;
        out.push({a:"",b:"",t:(/Obiettivo:\s*([^\n]+)/i.exec(cons)||[])[1]||"Attività previste nella consegna del blocco",min:budget,source:task.trim(),coarse:true,k:"Blocco intero"})}
    }
    if(out.length)out.push({a:"",b:"",t:"Verifica finale: criterio di completamento (vedi sotto)",k:"Verifica",verify:true,source:criterion(cons)});
    return out;
  }
  function criterion(cons){return String(cons||"").split("\n").filter(l=>/^(Verifica|VERIFICA|SIMULAZIONE|REGOLA)/.test(l.trim())).join("\n")}
  function minutes(s){if(s.pause||s.verify||/^pausa\b/i.test(s.t))return 0;if(s.min>0)return s.min;const hm=t=>{const a=String(t).split(":").map(Number);return a[0]*60+a[1]};const d=hm(s.b)-hm(s.a);return Number.isFinite(d)&&d>0?d:0}
  function normalized(t){return String(t||"").normalize("NFKC").toLowerCase().replace(/\d{2}:\d{2}/g,"").replace(/\s+/g," ").trim()}
  // Full text keys avoid hash collisions and keep quota intervals and duration.
  function keys(list){const seen=new Map();return list.map(s=>{const base=JSON.stringify([s.pause?"pause":s.verify?"verify":"task",normalized(s.source||s.t),minutes(s)]),n=seen.get(base)||0;seen.set(base,n+1);return base+":"+n})}
  function planKey(b,list=steps(b.cons,b.min)){return JSON.stringify([Number(b.min)||0,keys(list),normalized(criterion(b.cons))])}
  function resolve(record,list){const ks=keys(list),r=record||{},map=new Map();
    if(Array.isArray(r.taskKeys))r.taskKeys.forEach((k,i)=>map.set(k,{state:r.items?.[i]||0,type:r.types?.[i]||""}));
    const bound=ks.map(k=>map.get(k)||{state:0,type:""});
    return {items:bound.map(x=>x.state),types:bound.map(x=>x.type),taskKeys:ks,legacy:!Array.isArray(r.taskKeys)&&(r.items||[]).some(Boolean)};
  }
  function category(s){if(s.coarse)return "";const t=String(s.source||s.t||"").toLowerCase();
    if(/simulaz|prova (a tempo|mista|d.esame)|eol completa/.test(t))return "exam";
    const th=/teoria|leggi|lettura|studia|slide|pp\.|definiz|ricostruisci|ripass|richiamo/.test(t),pr=/correz|errori|confronta|eserciz|problem|tentativ|laborat|notebook|query|schema|implementa|test/.test(t);
    return th&&!pr?"theory":pr&&!th?"practice":"";
  }
  const metric=()=>({done:0,total:0,pct:null});
  function empty(){return {preparation:metric(),theory:metric(),practice:metric(),exam:metric(),unclassified:0,unparsed:0,legacy:0,blocks:0}}
  function finish(a){for(const k of ["preparation","theory","practice","exam"]){const m=a[k];m.done=Math.min(m.total,Math.max(0,m.done));m.pct=m.total>0?(m.done>=m.total-1e-8?100:Math.floor(1000*m.done/m.total)/10):null}return a}
  function calculate(blocks,checklist=()=>null,runs=[]){const all=empty(),subjects={};const verified=new Map();
    for(const r of runs)if(r.status==="confirmed"&&r.outcome==="Verificato autonomamente"&&String(r.evidence||"").trim()&&r.selfCheck&&r.planKey){if(!verified.has(r.blockId))verified.set(r.blockId,new Set());verified.get(r.blockId).add(r.planKey)}
    for(const b of blocks){if(b.stato==="Rinviato"||!(b.min>0))continue;const a=subjects[b.mat]||(subjects[b.mat]=empty()),list=steps(b.cons,b.min),r=resolve(checklist(b.id),list),pk=planKey(b,list);
      const v=b.stato==="Verificato autonomamente"||verified.get(b.id)?.has(pk),den=list.reduce((n,s)=>n+minutes(s),0),final=list.findIndex(s=>s.verify),checkedFinal=final>=0&&r.items[final]===2;
      a.blocks++;a.preparation.total+=b.min;if(r.legacy)a.legacy++;if(!den){a.unparsed+=b.min;if(v)a.preparation.done+=b.min;continue}if(list.some(s=>s.coarse))a.unparsed+=b.min;
      list.forEach((s,i)=>{const d=minutes(s);if(!d)return;const w=b.min*d/den,c=["theory","practice","exam"].includes(r.types[i])?r.types[i]:category(s),complete=v||(r.items[i]===2&&((c!=="exam"&&!s.coarse)||checkedFinal));
        if(complete)a.preparation.done+=w;if(c){a[c].total+=w;if(complete)a[c].done+=w}else a.unclassified+=w});
    }
    for(const a of Object.values(subjects)){for(const k of ["preparation","theory","practice","exam"]){all[k].done+=a[k].done;all[k].total+=a[k].total}for(const k of ["unclassified","unparsed","legacy","blocks"])all[k]+=a[k];finish(a)}
    return {all:finish(all),subjects};
  }
  const api={kind,steps,minutes,keys,planKey,resolve,category,calculate};root.STUDIOOS_PROGRESS=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
