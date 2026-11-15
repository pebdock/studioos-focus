/* Finite damped spring. Pointer motion is confined to the navigation bar.
   Only transforms animate; geometry is measured at gesture/layout boundaries. */
(function(root){
  "use strict";
  const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
  function mount(bar,{select,reducedMotion=()=>false,strength=()=>1,raf=requestAnimationFrame,caf=cancelAnimationFrame,now=()=>performance.now()}={}){
    const tabs=Array.from(bar.querySelectorAll(".tab")),indicator=bar.querySelector("#tabInd");
    let gesture=null,pending=0,suppressUntil=0,destroyed=false,geometry=[],lastAt=0,deadline=0,ready=false;
    const state={x:0,y:0,vx:0,vy:0,sx:1,sy:1,vsx:0,vsy:0},target={x:0,y:0,sx:1,sy:1};
    function measure(){geometry=tabs.map(t=>({t,r:t.getBoundingClientRect(),x:t.offsetLeft,y:t.offsetTop,w:t.offsetWidth,h:t.offsetHeight}))}
    const selected=()=>geometry.find(g=>g.t.getAttribute("aria-selected")==="true");
    const hit=(x,y)=>geometry.find(g=>x>=g.r.left&&x<=g.r.right&&y>=g.r.top&&y<=g.r.bottom);
    function size(g){if(!g||!indicator)return;const w=g.w+"px",h=g.h+"px";if(indicator.style.width!==w)indicator.style.width=w;if(indicator.style.height!==h)indicator.style.height=h}
    function paint(){if(!indicator)return;indicator.style.transform=`translate3d(${state.x.toFixed(3)}px,${state.y.toFixed(3)}px,0) scale(${state.sx.toFixed(4)},${state.sy.toFixed(4)})`}
    function stop(snap=true){if(pending)caf(pending);pending=0;lastAt=0;bar.classList.remove("nav-moving");if(snap){for(const k of ["x","y","sx","sy"])state[k]=target[k];state.vx=state.vy=state.vsx=state.vsy=0;paint()}}
    function frame(stamp){pending=0;if(destroyed)return;if(reducedMotion()){stop();return}const t=Number.isFinite(stamp)?stamp:now(),dt=bound((t-(lastAt||t-16))/1000,.001,.032);lastAt=t;
      // Semi-implicit integration with a bounded step remains stable after a dropped frame.
      const amount=bound(strength(),.2,1),stiffness=400,damping=gesture?29:22+5*(1-amount);
      for(const [p,v]of [["x","vx"],["y","vy"],["sx","vsx"],["sy","vsy"]]){state[v]+=(stiffness*(target[p]-state[p])-damping*state[v])*dt;state[p]+=state[v]*dt}
      const minX=Math.min(...geometry.map(g=>g.x)),maxX=Math.max(...geometry.map(g=>g.x)),minY=Math.min(...geometry.map(g=>g.y)),maxY=Math.max(...geometry.map(g=>g.y));
      state.x=bound(state.x,minX-2,maxX+2);state.y=bound(state.y,minY-2,maxY+2);state.sx=bound(state.sx,.94,1.10);state.sy=bound(state.sy,.94,1.10);paint();
      const rest=Math.abs(target.x-state.x)+Math.abs(target.y-state.y)<.08&&Math.abs(state.vx)+Math.abs(state.vy)<.7&&Math.abs(target.sx-state.sx)+Math.abs(target.sy-state.sy)<.001&&Math.abs(state.vsx)+Math.abs(state.vsy)<.008;
      if(rest||t>=deadline)stop();else pending=raf(frame);
    }
    function animate(){if(destroyed)return;if(reducedMotion()){stop();return}deadline=now()+900;bar.classList.add("nav-moving");if(!pending){lastAt=0;pending=raf(frame)}}
    function sync({immediate=false}={}){if(destroyed||gesture)return;measure();const g=selected();if(!g)return;size(g);target.x=g.x;target.y=g.y;target.sx=target.sy=1;
      if(!ready||immediate){ready=true;stop()}else animate();
    }
    function preview(e){const g=gesture;if(!g)return;const h=hit(e.clientX,e.clientY);tabs.forEach(t=>t.classList.toggle("nav-preview",t===h?.t));
      const dx=e.clientX-g.downX,dy=e.clientY-g.downY,amount=bound(strength(),.2,1),stamp=Number.isFinite(e.timeStamp)?e.timeStamp:now(),elapsed=Math.max(8,stamp-g.lastAt);
      g.vx=bound((e.clientX-g.lastX)/elapsed*1000,-900,900);g.vy=bound((e.clientY-g.lastY)/elapsed*1000,-900,900);g.lastX=e.clientX;g.lastY=e.clientY;g.lastAt=stamp;
      target.x=bound(g.origin.x+dx,Math.min(...geometry.map(x=>x.x)),Math.max(...geometry.map(x=>x.x)));
      target.y=bound(g.origin.y+dy,Math.min(...geometry.map(x=>x.y)),Math.max(...geometry.map(x=>x.y)));
      target.sx=1+(.025+Math.min(.05,Math.abs(g.vx)/15000))*amount;target.sy=1+(.025+Math.min(.04,Math.abs(g.vy)/16000))*amount;
      if(reducedMotion()){target.x=(h||selected()||g.origin).x;target.y=(h||selected()||g.origin).y;target.sx=target.sy=1}animate();
    }
    function end(e,cancel=false){if(!gesture||e.pointerId!==gesture.id)return;const g=gesture,h=cancel?null:hit(e.clientX,e.clientY);gesture=null;
      bar.classList.remove("nav-scrub");tabs.forEach(t=>t.classList.remove("nav-preview"));if(bar.hasPointerCapture?.(g.id))bar.releasePointerCapture(g.id);suppressUntil=Date.now()+500;
      if(h){select(h.t.dataset.v);if(g.type==="mouse")h.t.focus({preventScroll:true})}
      if(!reducedMotion()){const amount=bound(strength(),.2,1);state.vx=bound(state.vx+g.vx*.14*amount,-450,450);state.vy=bound(state.vy+g.vy*.12*amount,-300,300);state.vsx+=.45*amount;state.vsy-=.28*amount}sync();
    }
    const down=e=>{if(gesture){end({pointerId:gesture.id},true);return}if(e.isPrimary===false||(e.pointerType==="mouse"&&e.button!==0)||!e.target.closest(".tab"))return;measure();const h=hit(e.clientX,e.clientY);if(!h)return;
      size(h);gesture={id:e.pointerId,type:e.pointerType,origin:h,downX:e.clientX,downY:e.clientY,lastX:e.clientX,lastY:e.clientY,lastAt:Number.isFinite(e.timeStamp)?e.timeStamp:now(),vx:0,vy:0};bar.classList.add("nav-scrub");bar.setPointerCapture?.(e.pointerId);preview(e)};
    const move=e=>{if(gesture&&e.pointerId===gesture.id)preview(e)},up=e=>end(e),cancel=e=>end(e,true),click=e=>{if(e.detail>0&&Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}};
    const cancelAll=()=>{if(gesture)end({pointerId:gesture.id},true);sync({immediate:true})};
    for(const [n,f]of Object.entries({pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel}))bar.addEventListener(n,f);bar.addEventListener("click",click,true);
    const doc=bar.ownerDocument,visibility=()=>{if(doc.hidden)cancelAll()};doc?.addEventListener("visibilitychange",visibility);
    sync({immediate:true});return {sync,cancel:cancelAll,destroy(){cancelAll();destroyed=true;for(const [n,f]of Object.entries({pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel}))bar.removeEventListener(n,f);bar.removeEventListener("click",click,true);doc?.removeEventListener("visibilitychange",visibility)}};
  }
  const api={mount};root.STUDIOOS_NAV=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
