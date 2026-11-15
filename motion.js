/* Molle nel modello di Apple (SwiftUI Spring(duration:bounce:)): massa 1, rigidità k = (2π/d)²,
   smorzamento c = 4π(1 − bounce)/d. La stessa molla guida la bolla della navbar (integrazione per
   fotogramma) e le transizioni CSS, tradotte in una curva linear() campionata una volta all'avvio:
   nessun lavoro JavaScript durante le animazioni CSS. Dove linear() non è supportata restano le curve
   cubic-bezier di ios.css. */
(function(root){
  "use strict";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function params(duration=.5,bounce=0){
    const d=clamp(duration,.05,5),b=clamp(bounce,0,.9);
    return {stiffness:Math.pow(2*Math.PI/d,2),damping:4*Math.PI*(1-b)/d,mass:1,duration:d,bounce:b};
  }
  /* Risposta a un gradino 0 → 1 con velocità iniziale nulla, in forma chiusa. */
  function value(p,t){
    const w0=Math.sqrt(p.stiffness),z=p.damping/(2*w0);
    if(z<1){const wd=w0*Math.sqrt(1-z*z);return 1-Math.exp(-z*w0*t)*(Math.cos(wd*t)+z*w0/wd*Math.sin(wd*t))}
    if(z===1)return 1-Math.exp(-w0*t)*(1+w0*t);
    const r1=-w0*(z-Math.sqrt(z*z-1)),r2=-w0*(z+Math.sqrt(z*z-1));return 1+(r2*Math.exp(r1*t)-r1*Math.exp(r2*t))/(r1-r2);
  }
  /* Tempo dopo il quale lo scarto resta sotto la soglia (0,1% della corsa). */
  function settle(p,eps=.001){let last=0;for(let t=0;t<=6;t+=.004)if(Math.abs(1-value(p,t))>eps)last=t;return Math.max(.05,last+.004)}
  function overshoot(p){let m=0;for(let t=0;t<=settle(p);t+=.002)m=Math.max(m,value(p,t)-1);return m}
  function linear(duration,bounce,points=48){
    const p=params(duration,bounce),T=settle(p),out=[];
    for(let i=0;i<=points;i++){const t=T*i/points;let v=i===points?1:value(p,t);out.push(i===0||i===points?String(+v.toFixed(4)):`${+v.toFixed(4)} ${+(i/points*100).toFixed(2)}%`)}
    return {easing:`linear(${out.join(", ")})`,ms:Math.round(T*1000)};
  }
  /* Preset coerenti con .smooth, .snappy e .bouncy di Apple (durata percepita, rimbalzo). */
  const PRESETS={smooth:[.42,0],snappy:[.32,.12],bouncy:[.46,.26],sheet:[.5,0],press:[.22,0]};
  function install(doc){
    if(!doc||!doc.documentElement||typeof CSS==="undefined"||!CSS.supports||!CSS.supports("transition-timing-function","linear(0, 1)"))return false;
    const s=doc.documentElement.style;
    for(const [name,[d,b]] of Object.entries(PRESETS)){const l=linear(d,b);s.setProperty("--spring-"+name,l.easing);s.setProperty("--dur-"+name,l.ms+"ms")}
    doc.documentElement.classList.add("springs");return true;
  }
  const api={params,value,settle,overshoot,linear,install,PRESETS};
  root.STUDIOOS_MOTION=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(typeof document!=="undefined")install(document);
})(typeof window!=="undefined"?window:globalThis);

