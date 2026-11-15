/* One pointer gesture, confined to the tab bar. No page swipe handlers. */
(function(root){
  "use strict";
  function mount(bar,{select,reducedMotion=()=>false,raf=requestAnimationFrame,caf=cancelAnimationFrame}={}){
    const tabs=Array.from(bar.querySelectorAll(".tab")),indicator=bar.querySelector("#tabInd");let gesture=null,pending=0,suppressUntil=0,lastSelected=null;
    const hit=(x,y)=>tabs.find(t=>{const r=t.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});
    function place(t,drag=false){if(!t||!indicator)return;const g=gesture,dx=drag&&!reducedMotion()?Math.max(-9,Math.min(9,(g.x-g.lastX)*.28)):0;
      indicator.style.transform=`translate3d(${t.offsetLeft+dx}px,${t.offsetTop}px,0)`;indicator.style.width=t.offsetWidth+"px";indicator.style.height=t.offsetHeight+"px";
      indicator.style.setProperty("--bubble-stretch",String(drag&&!reducedMotion()?1+Math.min(.075,Math.abs(dx)/100):1));
      if(drag){indicator.style.setProperty("--bubble-light",`${Math.max(15,Math.min(85,50+(g.x-(t.getBoundingClientRect().left+t.offsetWidth/2))*.6))}%`);g.lastX=g.x}
    }
    function sync(){if(gesture)return;const t=tabs.find(t=>t.getAttribute("aria-selected")==="true");place(t);if(t&&t!==lastSelected){bar.classList.remove("nav-settle");if(!reducedMotion()){void indicator?.offsetWidth;bar.classList.add("nav-settle")}lastSelected=t}}
    function preview(){pending=0;if(!gesture)return;const t=hit(gesture.x,gesture.y);gesture.target=t;tabs.forEach(b=>b.classList.toggle("nav-preview",b===t));place(t||tabs.find(b=>b.getAttribute("aria-selected")==="true"),!!t)}
    function end(e,cancel=false){if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;if(pending)caf(pending);pending=0;
      const t=cancel?null:hit(e.clientX,e.clientY);bar.classList.remove("nav-scrub");tabs.forEach(b=>b.classList.remove("nav-preview"));
      if(bar.hasPointerCapture?.(g.id))bar.releasePointerCapture(g.id);suppressUntil=Date.now()+500;
      if(t){select(t.dataset.v);if(g.type==="mouse")t.focus({preventScroll:true})}sync();
    }
    const down=e=>{if(gesture){end({pointerId:gesture.id},true);return}if(e.isPrimary===false||(e.pointerType==="mouse"&&e.button!==0)||!e.target.closest(".tab"))return;
      const t=hit(e.clientX,e.clientY);if(!t)return;gesture={id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,lastX:e.clientX,target:t};
      bar.classList.remove("nav-settle");bar.classList.add("nav-scrub");bar.setPointerCapture?.(e.pointerId);preview();
    };
    const move=e=>{if(!gesture||e.pointerId!==gesture.id)return;gesture.x=e.clientX;gesture.y=e.clientY;if(!pending)pending=raf(preview)};
    const up=e=>end(e),cancel=e=>end(e,true),click=e=>{if(e.detail>0&&Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}};
    const settle=()=>bar.classList.remove("nav-settle");
    bar.addEventListener("pointerdown",down);bar.addEventListener("pointermove",move);bar.addEventListener("pointerup",up);bar.addEventListener("pointercancel",cancel);bar.addEventListener("lostpointercapture",cancel);bar.addEventListener("click",click,true);indicator?.addEventListener("animationend",settle);
    sync();return {sync,destroy(){if(pending)caf(pending);gesture=null;for(const [name,fn]of Object.entries({pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel}))bar.removeEventListener(name,fn);bar.removeEventListener("click",click,true);indicator?.removeEventListener("animationend",settle)}};
  }
  const api={mount};root.STUDIOOS_NAV=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
