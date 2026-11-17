/* Audit only: public local assets, synthetic cached plan, real UI actions. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const cp=require('node:child_process'),os=require('node:os');

const {chromium, webkit} = require('playwright');
const {AxeBuilder} = require('@axe-core/playwright');
const variant=process.env.AUDIT_VARIANT||'before';
const artifactRoot=process.env.UI_AUDIT_OUTPUT||path.resolve('artifacts-ui');
let root=process.env.AUDIT_ROOT||process.cwd();
if(variant==='before'&&!process.env.AUDIT_ROOT){
 const base=cp.execFileSync('git',['rev-parse',process.env.UI_BASE||'origin/main'],{encoding:'utf8'}).trim();
 root=fs.mkdtempSync(path.join(os.tmpdir(),'focus-design-baseline-'));
 const manifest=JSON.parse(cp.execFileSync('git',['show',base+':BUILD.json'],{encoding:'utf8'}));
 for(const name of [...new Set([...Object.keys(manifest.files),'BUILD.json','appelli.json'])]){
  const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,cp.execFileSync('git',['show',base+':'+name],{maxBuffer:8*1024*1024}));
 }
}
const out=path.join(artifactRoot,'screenshots',variant);
fs.mkdirSync(out, {recursive:true});
const report = {variant,root,fixture:'synthetic local-only cached plan; no Google account; existing app actions; glass=50; application motion enabled',screenshots:[],errors:[],limitations:['Altre opzioni is an existing native details element, not a sheet. The before image preserves this actual state.','WebKit automation is not certification on physical Safari/iPhone.','Screenshots use viewport clipping at the documented scroll position; full page content remains unmodified.','Axe incomplete color-contrast cases are retained as manual-review requirements, not counted as passes.']};
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server = http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html';
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
async function seed(context,theme) {
 await context.addInitScript(({theme})=>{
  if(localStorage.getItem('liquid-glass-audit-seeded')) return;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const block={id:'R20-9001',row:2,mat:'MDP',date:day,from:'00:00',to:'23:59',min:90,arg:'Sessione sintetica di studio',stato:'Da iniziare',fatti:0,mats:'demo.pdf · pp. 1–4',cons:'SCALETTA: 09:00–09:35 Teoria — Apri: demo.pdf — Fai: Leggi le definizioni; pausa 09:35–09:40; 09:40–10:30 Esercizi — Apri: demo.pdf — Fai: Risolvi due esercizi\nVerifica finale: spiega il risultato senza consultare la soluzione.'};
  localStorage.setItem('sfocus.unlinked.index',JSON.stringify({at:Date.now(),idx:{[block.id]:block}}));
  localStorage.setItem('sfocus.device',JSON.stringify('liquid-glass-audit-device'));
  localStorage.setItem('sfocus.settings',JSON.stringify({theme,look:'glass',glass:50,rm:false,smart:false,auto:false,work:50,brk:10,wake:false,haptic:false,sound:'none',amb:'none'}));
  localStorage.setItem('liquid-glass-audit-seeded','1');
 },{theme});
}
async function capture(page,engine,viewport,theme,state,target) {
 if(target) await page.locator(target).scrollIntoViewIfNeeded();
 await page.waitForTimeout(450);
 // This matrix compares steady screens. Let live feedback dismiss naturally;
 // fading transient text is covered separately by the touch/overlap journey.
 await page.waitForFunction(()=>!document.querySelector('#toasts .toast'),null,{timeout:7000});
 const name=`${engine}-${viewport.width}x${viewport.height}-${theme}-${state}.png`;
 const file=path.join(out,name);
 await page.screenshot({path:file,animations:'disabled',caret:'hide'});
 const detail=await page.evaluate(()=>({route:location.hash,scrollY,phase:window.STUDIOOS_STUDY?.current()?.run?.phase||'idle',look:document.getElementById('sLook').value,htmlClass:document.documentElement.className,buttons:['bStart','bPause','bDone','isPause'].map(id=>{const e=document.getElementById(id),r=e?.getBoundingClientRect();return {id,text:e?.textContent.trim(),hidden:e?.hidden,disabled:e?.disabled,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null};}),openRows:[...document.querySelectorAll('#steps li.open')].length,moreOptionsOpen:document.querySelector('details.more-ctl')?.open}));
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 const issues=list=>list.map(x=>({id:x.id,impact:x.impact,help:x.help,helpUrl:x.helpUrl,nodes:x.nodes.map(n=>({target:n.target,html:n.html,failureSummary:n.failureSummary,any:n.any,all:n.all,none:n.none}))}));
 report.screenshots.push({engine,viewport,theme,state,file:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),...detail,axe:{violations:issues(axe.violations),incomplete:issues(axe.incomplete),passes:axe.passes.map(x=>x.id)}});
 fs.writeFileSync(path.join(artifactRoot,`screenshots-${variant}.json`),JSON.stringify(report,null,2));
 console.log(name);
}
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try {
 for(const [engine,launcher] of Object.entries({chromium,webkit})){
  const executablePath=process.env[engine==='chromium'?'UI_CHROMIUM_EXECUTABLE':'UI_WEBKIT_EXECUTABLE'];
  const browser=await launcher.launch({headless:true,executablePath});
  try {for(const viewport of [{width:375,height:812},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport,colorScheme:theme,hasTouch:viewport.width<1024,isMobile:viewport.width<1024,serviceWorkers:'block'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await seed(context,theme);
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push({engine,viewport,theme,error:String(e)}));
   try{
    await page.goto(origin+'/?norel#giorno',{waitUntil:'load'});
    await page.waitForFunction(()=>window.STUDIOOS_STUDY?.snapshot().blocks.some(b=>b.id==='R20-9001'));
    await page.locator('#t-giorno').click();
    await page.locator('#sessions [data-open="R20-9001"]').waitFor();
    await capture(page,engine,viewport,theme,'block-list','#sessions');
    await page.locator('#sessions [data-open="R20-9001"]').click();
    await page.locator('#bStart').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.getElementById('bStart').disabled&&document.querySelectorAll('#steps li').length>0);
    await capture(page,engine,viewport,theme,'block-open','#focusCard');
    await page.locator('#bStart').click();
    await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='work');
    await page.waitForTimeout(1100);
    await capture(page,engine,viewport,theme,'timer-active','#focusCard');
    await page.locator('#bPause').click();
    await page.waitForFunction(()=>window.STUDIOOS_STUDY.current().run?.phase==='paused');
    await capture(page,engine,viewport,theme,'timer-paused','#focusCard');
    await page.locator('#steps li:not(.pause) .st-title').first().click();
    await page.waitForFunction(()=>!!document.querySelector('#steps li.open'));
    await capture(page,engine,viewport,theme,'steps-expanded','#scalettaCard');
    await page.locator('details.more-ctl > summary').click();
    await page.waitForFunction(()=>document.querySelector('details.more-ctl').open);
    await capture(page,engine,viewport,theme,'other-options','details.more-ctl');
   }catch(e){report.errors.push({engine,viewport,theme,error:String(e)});console.error(engine,viewport,theme,String(e));}
   finally{await context.close();}
  }} finally{await browser.close();}
 }
 } finally{server.close();fs.writeFileSync(path.join(artifactRoot,`screenshots-${variant}.json`),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({screenshots:report.screenshots.length,errors:report.errors.length,out}));
 if(report.errors.length||report.screenshots.some(item=>item.axe.violations.some(v=>['serious','critical'].includes(v.impact))))process.exitCode=1;
}
module.exports={seed,server,root};
if(require.main===module)run().catch(e=>{console.error(e);server.close();process.exitCode=1});
