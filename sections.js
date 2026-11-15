/* STUDIOOS Focus · sezioni interne (1.8.1)
   Analisi e Studio contenevano 6–9 schede una sotto l'altra (fino a 11.000 px su iPhone).
   Qui le schede restano le stesse, con gli stessi id e gli stessi renderer: vengono solo
   raggruppate e mostrate un gruppo alla volta, con un selettore a capsula in alto.
   Nessun dato viene letto o scritto: è soltanto organizzazione dell'interfaccia. */
(function(root){
  "use strict";
  const doc=root.document;if(!doc)return;
  const LS={get(k,d){try{const v=root.localStorage.getItem("sfocus_sec_"+k);return v==null?d:v}catch(e){return d}},set(k,v){try{root.localStorage.setItem("sfocus_sec_"+k,v)}catch(e){}}};
  const card=(view,sel)=>{const el=view.querySelector(sel);return el&&el.closest("article")};
  const byTitle=(view,re)=>[...view.querySelectorAll("article")].find(a=>{const h=a.querySelector("h2,h3");return h&&re.test(h.textContent.trim())});
  const CONFIG={
    "v-settimana":{label:"Sezioni di Analisi",def:"ritmo",groups:[
      ["ritmo","Ritmo",v=>[card(v,"#learningTitle")]],
      ["prep","Argomenti",v=>[card(v,"#prTitle"),card(v,"#topicTitle")]],
      ["piano","Piano",v=>[card(v,"#wkLbl"),card(v,"#anInfo")]],
      ["esami","Esami",v=>[card(v,"#exams"),card(v,"#crTitle"),card(v,"#averageExam")]]]},
    "v-registro":{label:"Sezioni di Studio",def:"materiali",groups:[
      ["materiali","Materiali",v=>[card(v,"#mList")]],
      ["ripasso","Ripasso",v=>[card(v,"#rvList"),byTitle(v,/^Errori/)]],
      ["registro","Registro",v=>[card(v,"#smList"),card(v,"#runList"),card(v,"#expTxt")]]]}
  };
  const api={views:{},show,current:id=>(api.views[id]||{}).cur||null};
  function build(id){
    const view=doc.getElementById(id),cfg=CONFIG[id];if(!view||!cfg||view.dataset.sections)return false;
    const groups=cfg.groups.map(([key,label,fn])=>({key,label,cards:fn(view).filter(Boolean)}));
    if(groups.some(g=>!g.cards.length))return false;               // markup diverso: non toccare nulla
    const assigned=new Set(groups.flatMap(g=>g.cards));
    const rest=[...view.querySelectorAll(":scope > article")].filter(a=>!assigned.has(a));
    if(rest.length)groups[groups.length-1].cards.push(...rest);      // schede nuove: mai perse
    view.dataset.sections="1";
    const nav=doc.createElement("div");nav.className="sec-nav";
    nav.innerHTML=`<div class="lg-seg" role="tablist" aria-label="${cfg.label}" style="--n:${groups.length}"><i class="lg-seg-ind" aria-hidden="true"></i>${groups.map(g=>`<button type="button" role="tab" id="${id}-${g.key}" data-sec="${g.key}">${g.label}</button>`).join("")}</div>`;
    const first=view.querySelector(":scope > article");view.insertBefore(nav,first);
    let anchor=nav;for(const g of groups)for(const c of g.cards){c.dataset.sec=g.key;c.setAttribute("role","tabpanel");c.setAttribute("aria-labelledby",id+"-"+g.key);anchor.after(c);anchor=c}
    const seg=nav.firstElementChild;
    seg.addEventListener("click",e=>{const b=e.target.closest("button[data-sec]");if(b)show(id,b.dataset.sec,true)});
    seg.addEventListener("keydown",e=>{const d=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(!d)return;e.preventDefault();const bs=[...seg.querySelectorAll("button")],i=bs.findIndex(b=>b.getAttribute("aria-selected")==="true");const n=bs[(i+d+bs.length)%bs.length];show(id,n.dataset.sec,true);n.focus()});
    api.views[id]={groups,seg,cur:null};
    const saved=LS.get(id,cfg.def);show(id,groups.some(g=>g.key===saved)?saved:cfg.def,false);
    return true;
  }
  function show(id,key,user){
    const v=api.views[id];if(!v)return;const idx=Math.max(0,v.groups.findIndex(g=>g.key===key));key=v.groups[idx].key;
    for(const g of v.groups)for(const c of g.cards)c.hidden=g.key!==key;
    [...v.seg.querySelectorAll("button")].forEach((b,i)=>{const on=i===idx;b.setAttribute("aria-selected",String(on));b.tabIndex=on?0:-1});
    v.seg.style.setProperty("--i",idx);v.cur=key;
    if(user){LS.set(id,key);const top=v.seg.getBoundingClientRect().top;if(top<0)v.seg.scrollIntoView({block:"start",behavior:"instant"});
      root.dispatchEvent(new CustomEvent("studioos:view",{detail:{view:id,section:key}}))}
  }
  function start(){let n=0;const t=setInterval(()=>{const a=build("v-settimana"),b=build("v-registro");if((a||api.views["v-settimana"])&&(b||api.views["v-registro"])||++n>40)clearInterval(t)},120)}
  root.STUDIOOS_SECTIONS=api;
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",start);else start();
})(typeof window!=="undefined"?window:globalThis);
