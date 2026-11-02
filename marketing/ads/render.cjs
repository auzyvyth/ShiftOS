const { chromium } = require('playwright');
const path=require('path'), fs=require('fs');
(async()=>{
  const [,,dir,lang,mode]=process.argv;
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}});
  await p.goto('file://'+path.join(dir,'ad.html')+'?static&lang='+lang);
  await p.evaluate(()=>document.fonts.ready);
  const times = mode==='keys' ? [1.6,4.0,6.2,7.3,10.0,14.5] : Array.from({length:15*30},(_,i)=>i/30);
  const out=path.join(dir,'frames_'+lang+(mode==='keys'?'_keys':'')); fs.mkdirSync(out,{recursive:true});
  for(let i=0;i<times.length;i++){
    await p.evaluate(t=>render(t),times[i]);
    await p.screenshot({path:path.join(out,String(i).padStart(4,'0')+'.jpg'),type:'jpeg',quality:93});
  }
  await b.close();
})();
