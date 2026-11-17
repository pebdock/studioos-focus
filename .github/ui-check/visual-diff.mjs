/* Review heatmaps, not a zero-difference assertion: this PR intentionally changes appearance. */
import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';
const {PNG}=pngjs;
const output=process.env.UI_AUDIT_OUTPUT||path.resolve('artifacts-ui');
const before=path.join(output,'screenshots','before');
const after=path.join(output,'screenshots','after');
const diffs=path.join(output,'screenshots','diff');
fs.mkdirSync(diffs,{recursive:true});
const report=[];
for(const name of fs.readdirSync(before).filter(name=>name.endsWith('.png')).sort()){
 const a=PNG.sync.read(fs.readFileSync(path.join(before,name)));
 const b=PNG.sync.read(fs.readFileSync(path.join(after,name)));
 if(a.width!==b.width||a.height!==b.height)throw Error(`Screenshot dimensions differ: ${name}`);
 const diff=new PNG({width:a.width,height:a.height});
 const pixels=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.1,includeAA:false});
 fs.writeFileSync(path.join(diffs,name),PNG.sync.write(diff));
 report.push({file:name,width:a.width,height:a.height,changedPixels:pixels,changedPercent:+(pixels/(a.width*a.height)*100).toFixed(3)});
}
if(report.length!==96)throw Error(`Expected 96 paired screenshots; found ${report.length}`);
fs.writeFileSync(path.join(output,'visual-diff.json'),JSON.stringify({purpose:'Intentional visual change review; not a pixel-identical gate',comparisons:report},null,2));
console.log(JSON.stringify({comparisons:report.length,heatmaps:report.length}));
