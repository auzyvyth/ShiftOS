import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Download, Loader2, ChevronLeft, ChevronRight,
  Sparkles, Trash2, Image as ImageIcon, Plus,
  Palette, Tag, Shield, Layers, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─── roundRect polyfill ───────────────────────────────────────────────────────
(function(){
  if(typeof CanvasRenderingContext2D==='undefined') return;
  if(CanvasRenderingContext2D.prototype.roundRect) return;
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    r=Math.min(typeof r==='number'?r:0,Math.abs(w)/2,Math.abs(h)/2);
    this.moveTo(x+r,y);
    this.lineTo(x+w-r,y); this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r); this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h); this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r); this.quadraticCurveTo(x,y,x+r,y);
    this.closePath();
  };
})();

// ─── JSZip ────────────────────────────────────────────────────────────────────
let _zip=null;
function loadJSZip(){
  if(!_zip) _zip=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload=()=>res(window.JSZip); s.onerror=rej;
    document.head.appendChild(s);
  });
  return _zip;
}
function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}

const IMG_CACHE=new Map();
function loadImage(url){
  if(!url) return Promise.resolve(null);
  if(!IMG_CACHE.has(url)){
    const p=new Promise(res=>{
      const img=new Image(); img.crossOrigin='anonymous';
      img.onload=()=>res(img); img.onerror=()=>res(null); img.src=url;
    });
    IMG_CACHE.set(url,p);
  }
  return IMG_CACHE.get(url);
}

// ─── Fonts ────────────────────────────────────────────────────────────────────
export const FONTS=[
  {id:'dm',         label:'DM Sans',         stack:"'DM Sans',sans-serif",          weights:['400','700','800']},
  {id:'bebas',      label:'Bebas Neue',       stack:"'Bebas Neue',sans-serif",       weights:['400','400','400']},
  {id:'oswald',     label:'Oswald',           stack:"'Oswald',sans-serif",           weights:['400','600','700']},
  {id:'montserrat', label:'Montserrat',       stack:"'Montserrat',sans-serif",       weights:['400','700','800']},
  {id:'raleway',    label:'Raleway',          stack:"'Raleway',sans-serif",          weights:['400','700','800']},
  {id:'anton',      label:'Anton',            stack:"'Anton',sans-serif",            weights:['400','400','400']},
  {id:'barlow',     label:'Barlow Condensed', stack:"'Barlow Condensed',sans-serif", weights:['400','600','700']},
  {id:'russo',      label:'Russo One',        stack:"'Russo One',sans-serif",        weights:['400','400','400']},
];
const GFONTS_LOADED=new Set();
function ensureFont(fontId){
  if(GFONTS_LOADED.has(fontId)) return; GFONTS_LOADED.add(fontId);
  const urls={dm:'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800&display=swap',bebas:'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',oswald:'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap',montserrat:'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap',raleway:'https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;800&display=swap',anton:'https://fonts.googleapis.com/css2?family=Anton&display=swap',barlow:'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap',russo:'https://fonts.googleapis.com/css2?family=Russo+One&display=swap'};
  if(!urls[fontId]) return;
  const l=document.createElement('link'); l.rel='stylesheet'; l.href=urls[fontId]; document.head.appendChild(l);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function parseList(val){
  if(!val) return [];
  if(Array.isArray(val)) return val.filter(Boolean);
  try{const p=JSON.parse(val);if(Array.isArray(p)) return p.filter(Boolean);}catch(e){}
  return String(val).split(',').map(s=>s.trim()).filter(Boolean);
}
function calcMonthly(price){
  if(!price) return null;
  const loan=price*0.90; const interest=(3.5/100)*loan*9;
  return Math.round((loan+interest)/(9*12));
}

// ─── Templates ───────────────────────────────────────────────────────────────
export const SLIDE_TEMPLATES=[
  {id:'hero-hook',       label:'Hero Hook',   desc:'Impact opener with hook'},
  {id:'specs-breakdown', label:'Specs',       desc:'Features & specs checklist'},
  {id:'pricing',         label:'Pricing',     desc:'Monthly installment hero'},
  {id:'cta',             label:'CTA',         desc:'WhatsApp & dealership brand'},
  {id:'hype',            label:'Hype',        desc:'Bold price, full impact'},
  {id:'story',           label:'Story',       desc:'Lifestyle, soft vibe'},
  {id:'spec',            label:'Spec Sheet',  desc:'Data-driven, clean grid'},
  {id:'financing',       label:'Financing',   desc:'Monthly payment hero'},
  {id:'comparison',      label:'Comparison',  desc:'Side-by-side two details'},
];

function detectFitMode(img){
  if(!img) return 'blur';
  const ratio=img.width/img.height, target=9/16, diff=Math.abs(ratio-target)/target;
  if(diff<0.12) return 'fill'; if(ratio>1) return 'blur'; return 'fit-gradient';
}

const DEFAULT_THEME={
  bgMode:'blur',bgColor:'#0d1b2e',bgGradFrom:'#0d1b2e',bgGradTo:'#1a0a2e',
  overlayOpacity:0.45,textColor:'#ffffff',accentColor:'#e53935',
  textPosition:'bottom',textAlign:'left',
  headlineSize:112,line2Size:80,line3Size:52,
  watermarkText:'',watermarkOpacity:0.14,watermarkPos:'top-right',logoUrl:null,
  priceTagStyle:'plain',priceTagColor:'#e53935',
  showConditionBadge:false,showHotDealBadge:false,customBadgeText:'',badgeColor:'#e53935',
};

// ─── Canvas renderer ──────────────────────────────────────────────────────────
async function renderSlide(canvas,slide,theme,fontId='dm'){
  const ctx=canvas.getContext('2d'); const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const fontDef=FONTS.find(f=>f.id===fontId)||FONTS[0];
  const stack=fontDef.stack; const [w3,w2,w1]=fontDef.weights;
  const img=await loadImage(slide.imageUrl);
  const logoImg=theme.logoUrl?await loadImage(theme.logoUrl):null;

  function draw(text,x,y,weight,size,colour,maxW,align='left'){
    if(!text) return; ctx.save();
    ctx.font=`${weight} ${size}px ${stack}`; ctx.textAlign=align; ctx.textBaseline='top';
    while(ctx.measureText(text).width>maxW&&size>14){size-=2;ctx.font=`${weight} ${size}px ${stack}`;}
    ctx.lineWidth=Math.max(size*0.08,3); ctx.strokeStyle='rgba(0,0,0,0.95)'; ctx.lineJoin='round';
    ctx.strokeText(text,x,y); ctx.fillStyle=colour; ctx.fillText(text,x,y); ctx.restore();
  }
  function drawWM(){
    if(theme.watermarkText){
      ctx.save(); ctx.font=`600 ${Math.round(26*W/1080)}px ${stack}`;
      ctx.fillStyle=`rgba(255,255,255,${theme.watermarkOpacity})`;
      const iR=(theme.watermarkPos||'top-right').includes('right'),iB=(theme.watermarkPos||'top-right').includes('bottom');
      ctx.textAlign=iR?'right':'left'; ctx.textBaseline='top';
      ctx.fillText(theme.watermarkText.toUpperCase(),iR?W-Math.round(52*W/1080):Math.round(52*W/1080),iB?H-Math.round(80*H/1920):Math.round(52*H/1920));
      ctx.restore();
    }
    if(logoImg){
      const maxLH=Math.round(80*H/1920),lScale=maxLH/logoImg.height,lw=logoImg.width*lScale,lh=logoImg.height*lScale;
      const iR=(theme.watermarkPos||'top-right').includes('right'),iB=(theme.watermarkPos||'top-right').includes('bottom');
      ctx.save(); ctx.globalAlpha=Math.min(theme.watermarkOpacity*6,1);
      ctx.drawImage(logoImg,iR?W-Math.round(48*W/1080)-lw:Math.round(48*W/1080),iB?H-Math.round(60*H/1920)-lh:Math.round(40*H/1920),lw,lh);
      ctx.restore();
    }
  }
  function drawNum(){
    ctx.save(); ctx.font=`700 ${Math.round(22*W/1080)}px ${stack}`;
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.textAlign='right'; ctx.textBaseline='bottom';
    ctx.fillText(String((slide.index??0)+1).padStart(2,'0'),W-Math.round(48*W/1080),H-Math.round(48*H/1920)); ctx.restore();
  }
  function drawBar(){ctx.save();ctx.fillStyle=theme.accentColor||'#e53935';ctx.fillRect(0,0,W,Math.round(6*H/1920));ctx.restore();}

  const tpl=slide.template||'hype';
  const acc=theme.accentColor||'#e53935';

  // ── Unified hero-hook background for all templates ────────────────────────
  ctx.fillStyle='#060910'; ctx.fillRect(0,0,W,H);
  if(img){
    // blurred cover background (fills frame, no gaps)
    ctx.save();
    try{ctx.filter='blur(18px) brightness(0.45)';}catch(e){}
    const sc=Math.max(W/img.width,H/img.height);
    ctx.drawImage(img,(W-img.width*sc)/2,(H-img.height*sc)/2,img.width*sc,img.height*sc);
    ctx.restore();
    // full image centered, fit to full width (no side gaps, fully visible)
    const fitH=img.height*(W/img.width);
    ctx.globalAlpha=0.92;
    ctx.drawImage(img,0,(H-fitH)/2,W,fitH);
    ctx.globalAlpha=1;
  }
  const ov=ctx.createLinearGradient(0,0,0,H);
  ov.addColorStop(0,'rgba(6,9,16,0.95)'); ov.addColorStop(0.30,'rgba(6,9,16,0.10)');
  ov.addColorStop(0.50,'rgba(6,9,16,0.05)'); ov.addColorStop(0.68,'rgba(6,9,16,0.88)');
  ov.addColorStop(1,'rgba(6,9,16,1)');
  ctx.fillStyle=ov; ctx.fillRect(0,0,W,H);
  drawBar();
  if(slide.hookText){
    const hSz=Math.round(38*W/1080),hookTxt=slide.hookText;
    draw(hookTxt.toUpperCase(),W/2,Math.round(H*0.07),w1,hSz,'#fff',W*0.85,'center');
    ctx.save(); ctx.font=`${w1} ${hSz}px ${stack}`;
    const hw=Math.min(ctx.measureText(hookTxt.toUpperCase()).width,W*0.85);
    ctx.fillStyle=acc; ctx.fillRect((W-hw)/2,Math.round(H*0.07)+hSz+6,hw,4); ctx.restore();
  }
  drawWM();
  const pad=Math.round(64*W/1080);
  if(tpl==='specs-breakdown'||tpl==='spec'){
    const feats=Array.isArray(slide.features)?slide.features.slice(0,6):[];
    const nSz=Math.round(52*W/1080);
    draw(slide.carName||slide.headline||'',pad,H*0.62,w1,nSz,'#fff',W-pad*2);
    ctx.save(); ctx.fillStyle=acc; ctx.fillRect(pad,H*0.62+nSz+10,Math.round(100*W/1080),3); ctx.restore();
    const fSz=Math.round(34*W/1080),fGap=Math.round(fSz*1.7);
    let fy=H*0.62+nSz+32;
    for(let i=0;i<feats.length&&fy<H*0.93;i++){
      ctx.save();
      ctx.fillStyle=acc+'33'; ctx.beginPath(); ctx.arc(pad+fSz*0.5,fy+fSz*0.5,fSz*0.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=acc; ctx.font=`700 ${Math.round(fSz*0.6)}px ${stack}`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('✓',pad+fSz*0.5,fy+fSz*0.5); ctx.restore();
      draw(feats[i],pad+fSz*1.3,fy,w2,fSz,'rgba(255,255,255,0.88)',W-pad*2-fSz*1.4);
      fy+=fGap;
    }
  } else if(tpl==='pricing'||tpl==='financing'){
    const monthly=slide.monthly||calcMonthly(slide.priceNum);
    const mStr=monthly?`RM ${Number(monthly).toLocaleString()}`:slide.bottomLeft||'';
    draw('MONTHLY PAYMENT',W/2,H*0.40,'700',Math.round(28*W/1080),acc,W*0.9,'center');
    const mSz=Math.round(100*W/1080);
    draw(mStr,W/2,H*0.50,w1,mSz,'#fff',W*0.9,'center');
    draw('/month',W/2,H*0.50+mSz+10,'400',Math.round(28*W/1080),'rgba(255,255,255,0.4)',W*0.5,'center');
    const bxY=H*0.72,bxH=H*0.17;
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.roundRect(pad,bxY,W-pad*2,bxH,14); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(pad,bxY,W-pad*2,bxH,14); ctx.stroke(); ctx.restore();
    const bSz=Math.round(28*W/1080),bp=Math.round(40*W/1080);
    const downStr=slide.priceNum?'RM '+Number(slide.priceNum*0.1).toLocaleString():'';
    [{l:'Full Price',v:slide.priceStr||''},{l:'Down Payment (10%)',v:downStr},{l:'Rate / Tenure',v:'3.5% / 9 Years'}].forEach(({l,v},i)=>{
      const ly=bxY+bp+i*(bSz+16);
      draw(l,pad+bp,ly,w3,bSz,'rgba(255,255,255,0.38)',W/2-pad);
      draw(v,W-pad-bp,ly,w2,bSz,'rgba(255,255,255,0.78)',W/2-pad,'right');
    });
  } else if(tpl==='cta'){
    const dnSz=Math.round(52*W/1080);
    draw(slide.dealerName||theme.watermarkText||'',W/2,H*0.66,w1,dnSz,'#fff',W-pad*2,'center');
    draw(slide.carName||slide.headline||'',W/2,H*0.66+dnSz+16,'600',Math.round(38*W/1080),'rgba(255,255,255,0.5)',W-pad*2,'center');
    const waY=H*0.79,waH=Math.round(80*H/1920);
    ctx.save(); ctx.fillStyle=acc;
    ctx.beginPath(); ctx.roundRect(pad,waY,W-pad*2,waH,waH/2); ctx.fill(); ctx.restore();
    const waStr=slide.whatsapp?`WhatsApp: ${slide.whatsapp}`:'WhatsApp Us';
    draw(waStr,W/2,waY+waH/2-Math.round(36*W/1080)/2,'800',Math.round(36*W/1080),'#fff',W-pad*2-60,'center');
    draw('DM for Test Drive · Best Price Guaranteed',W/2,H*0.88,'600',Math.round(26*W/1080),'rgba(255,255,255,0.3)',W-pad*2,'center');
  } else {
    const bY=H*0.76,nSz=Math.round(72*W/1080),pSz=Math.round(52*W/1080),sSz=Math.round(34*W/1080);
    draw(slide.carName||slide.headline||'',pad,bY,w1,nSz,'#fff',W-pad*2);
    draw(slide.priceStr||slide.bottomLeft||'',pad,bY+nSz+10,w2,pSz,acc,W-pad*2);
    draw(slide.statsLine||slide.bottomRight||'',pad,bY+nSz+pSz+22,w3,sSz,'rgba(255,255,255,0.65)',W-pad*2);
  }
  drawNum();
}

// ─── buildDefaultSlides ───────────────────────────────────────────────────────
function buildDefaultSlides(listing,images,features,specs,dealerName,whatsapp){
  const brand=listing?.brand||'',model=listing?.model||'',variant=listing?.variant||'';
  const year=String(listing?.year||'');
  const price=listing?.selling_price||listing?.price;
  const priceStr=price?'RM '+Number(price).toLocaleString():'';
  const mileage=listing?.mileage?Number(listing.mileage).toLocaleString()+' km':'';
  const cond=listing?.condition||'';
  const condLabel={new:'Brand New',recon:'Recon',used:'Used'}[cond]||cond;
  const trans=listing?.transmission||'',fuel=listing?.fuel_type||listing?.fuel||'';
  const engine=listing?.engine_cc?listing.engine_cc+'cc':'';
  const carName=`${brand} ${model}${variant?' '+variant:''} ${year}`.trim();
  const statsLine=[year,condLabel,mileage].filter(Boolean).join(' · ');
  const monthly=calcMonthly(price);
  const img0=images[0]||null;
  const fallbackFeatures=features.length>0?features:[engine,trans,fuel,mileage,condLabel].filter(Boolean);
  const fallbackSpecs=specs.length>0?specs:[engine,trans,fuel].filter(Boolean);

  const structured=[
    {id:0,index:0,imageUrl:img0,condition:cond,template:'hero-hook',fitMode:'auto',enabled:true,carName,priceStr,priceNum:price||0,statsLine,monthly,hookText:`${brand} ${model} — Best Deal In Malaysia 🔥`.trim(),headline:carName,bottomLeft:priceStr,bottomRight:statsLine,features:fallbackFeatures,specs:fallbackSpecs,dealerName,whatsapp},
    {id:1,index:1,imageUrl:images[1]||img0,condition:cond,template:'specs-breakdown',fitMode:'auto',enabled:true,carName,priceStr,priceNum:price||0,statsLine,monthly,hookText:`Why Choose The ${model}?`,headline:carName,bottomLeft:priceStr,bottomRight:statsLine,features:fallbackFeatures,specs:fallbackSpecs,dealerName,whatsapp},
    {id:2,index:2,imageUrl:images[2]||img0,condition:cond,template:'pricing',fitMode:'auto',enabled:true,carName,priceStr,priceNum:price||0,statsLine,monthly,hookText:'Monthly Installment',headline:carName,bottomLeft:priceStr,bottomRight:statsLine,features:fallbackFeatures,specs:fallbackSpecs,dealerName,whatsapp},
    {id:3,index:3,imageUrl:images[3]||img0,condition:cond,template:'cta',fitMode:'auto',enabled:true,carName,priceStr,priceNum:price||0,statsLine,monthly,hookText:'Contact Us Today',headline:carName,bottomLeft:priceStr,bottomRight:statsLine,features:fallbackFeatures,specs:fallbackSpecs,dealerName,whatsapp},
  ];
  const tplCycle=['hype','story','spec','hype','story','financing','hype','story','spec','hype','story'];
  const extraImages=images.slice(0,11);
  const imageSlides=extraImages.map((img,i)=>({
    id:i+4,index:i+4,imageUrl:img,condition:cond,template:tplCycle[i%tplCycle.length],fitMode:'auto',enabled:true,
    carName,priceStr,priceNum:price||0,statsLine,monthly,hookText:'',
    headline:carName,bottomLeft:priceStr,bottomRight:statsLine,
    features:fallbackFeatures,specs:fallbackSpecs,dealerName,whatsapp,
  }));
  return [...structured,...imageSlides];
}

// ─── AI generation ────────────────────────────────────────────────────────────
async function generateWithClaude(listing,language,hookText,slideCount){
  const price=listing?.selling_price||listing?.price;
  const priceStr=price?'RM '+Number(price).toLocaleString():'Ask for Price';
  const lang=language==='bm'?'Bahasa Malaysia (casual dealer tone)':'English (punchy Malaysian car market)';
  const prompt=`Malaysian car dealer TikTok slide copywriter. Write ${slideCount} slides.\nCAR: ${listing?.year||''} ${listing?.brand||''} ${listing?.model||''} ${listing?.variant||''}\nPrice: ${priceStr} | Mileage: ${listing?.mileage?Number(listing.mileage).toLocaleString()+' km':'N/A'}\nCondition: ${listing?.condition||''} | Trans: ${listing?.transmission||''} | Fuel: ${listing?.fuel_type||listing?.fuel||''}\nEngine: ${listing?.engine_cc?listing.engine_cc+'cc':''} | Location: ${listing?.state||'Malaysia'}\n${hookText?'Seller hook: "'+hookText+'"':''}\nLanguage: ${lang}\nEach slide: headline (max 5 words), bottomLeft (max 3 words), bottomRight (max 3 words).\nReturn ONLY valid JSON array: [{"headline":"...","bottomLeft":"...","bottomRight":"..."},...]`;
  const res=await fetch(`${SERVER_URL}/ai/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
  if(!res.ok) throw new Error('API error');
  const data=await res.json();
  let text='';
  if(Array.isArray(data?.content)) text=data.content.map(b=>b.text||'').join('');
  else if(data?.completion) text=data.completion;
  else text=JSON.stringify(data);
  return JSON.parse(text.replace(/```json|```/g,'').trim());
}

// ─── SlideCanvas ──────────────────────────────────────────────────────────────
const SlideCanvas=React.memo(function SlideCanvas({slide,theme,fontId,width,height}){
  const ref=useRef(null);
  useEffect(()=>{const c=ref.current;if(!c) return;c.width=width;c.height=height;renderSlide(c,slide,theme,fontId).catch(()=>{});},[slide,theme,fontId,width,height]);
  return <canvas ref={ref} style={{width:'100%',height:'100%',display:'block'}}/>;
});

// ─── Thumb ────────────────────────────────────────────────────────────────────
const Thumb=React.memo(function Thumb({slide,fontId,theme,isActive,index,onClick,onDelete,showDelete}){
  return(
    <div onClick={onClick} style={{position:'relative',flexShrink:0,cursor:'pointer',width:48,height:85,borderRadius:7,border:isActive?'2px solid #e53935':'2px solid rgba(255,255,255,0.1)',overflow:'hidden',transition:'border-color 0.15s,transform 0.15s',transform:isActive?'scale(1.06)':'scale(1)',opacity:slide.enabled===false?0.35:1}}>
      <SlideCanvas slide={slide} theme={theme} fontId={fontId} width={96} height={171}/>
      <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.6)',fontSize:9,fontWeight:700,color:isActive?'#ff6b6b':'rgba(255,255,255,0.5)',textAlign:'center',padding:'2px 0',fontFamily:"'DM Sans',sans-serif"}}>{index+1}</div>
      {showDelete&&(<button onClick={e=>{e.stopPropagation();onDelete();}} style={{position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'rgba(239,68,68,0.85)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}><X size={9}/></button>)}
    </div>
  );
});

// ─── ListingImagePicker ───────────────────────────────────────────────────────
function ListingImagePicker({images,current,onSelect,onClose}){
  return(
    <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.92)',zIndex:30,display:'flex',flexDirection:'column',borderRadius:4}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Listing Photos ({images.length})</span>
        <button onClick={onClose} style={{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={12}/></button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:8,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
        {images.map((url,i)=>(
          <div key={i} onClick={()=>{onSelect(url);onClose();}} style={{position:'relative',aspectRatio:'4/3',borderRadius:6,overflow:'hidden',cursor:'pointer',border:current===url?'2px solid #e53935':'2px solid transparent',transition:'border-color 0.15s'}}>
            <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
            {current===url&&<div style={{position:'absolute',inset:0,background:'rgba(229,57,53,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:16}}>✓</span></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SlidePreviewHTML — unified hero-hook layout for all templates ────────────
function SlidePreviewHTML({slide,theme,animKey}){
  const outerRef=useRef(null);
  const [scale,setScale]=useState(0);
  const accent=theme.accentColor||'#e53935';
  const tpl=slide.template||'hype';
  const monthly=slide.monthly||calcMonthly(slide.priceNum);
  const mStr=monthly?`RM ${Number(monthly).toLocaleString()}`:slide.priceStr||'';
  const feats=Array.isArray(slide.features)?slide.features.slice(0,6):[];

  useEffect(()=>{
    if(!outerRef.current) return;
    const obs=new ResizeObserver(entries=>{
      const{width,height}=entries[0].contentRect;
      setScale(Math.min(width/1080,height/1920));
    });
    obs.observe(outerRef.current);
    return()=>obs.disconnect();
  },[]);

  let bottomContent;
  if(tpl==='specs-breakdown'||tpl==='spec'){
    bottomContent=(
      <div style={{position:'absolute',bottom:130,left:64,right:64,zIndex:5}}>
        <div style={{fontSize:52,fontWeight:800,color:'#fff',lineHeight:1.1,marginBottom:8}}>{slide.carName||slide.headline||''}</div>
        <div style={{width:100,height:3,background:accent,marginBottom:28}}/>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          {feats.map((f,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:24}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:accent+'33',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{color:accent,fontSize:22,fontWeight:700}}>✓</span>
              </div>
              <span style={{fontSize:34,fontWeight:600,color:'rgba(255,255,255,0.88)'}}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if(tpl==='pricing'||tpl==='financing'){
    const downStr=slide.priceNum?'RM '+Number(slide.priceNum*0.1).toLocaleString():'';
    bottomContent=(
      <div style={{position:'absolute',bottom:60,left:64,right:64,zIndex:5}}>
        <div style={{fontSize:28,fontWeight:700,color:accent,letterSpacing:'0.14em',textAlign:'center',marginBottom:10}}>MONTHLY PAYMENT</div>
        <div style={{fontSize:110,fontWeight:800,color:'#fff',lineHeight:1,textAlign:'center'}}>{mStr}</div>
        <div style={{fontSize:30,color:'rgba(255,255,255,0.4)',textAlign:'center',marginBottom:36}}>/month</div>
        <div style={{background:'rgba(0,0,0,0.45)',borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',padding:'36px 48px'}}>
          {[{l:'Full Price',v:slide.priceStr||''},{l:'Down Payment (10%)',v:downStr},{l:'Rate / Tenure',v:'3.5% / 9 Years'}].map(({l,v},i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'18px 0',borderTop:i>0?'1px solid rgba(255,255,255,0.06)':'none'}}>
              <span style={{fontSize:28,color:'rgba(255,255,255,0.38)',fontWeight:600}}>{l}</span>
              <span style={{fontSize:28,color:'rgba(255,255,255,0.78)',fontWeight:700}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if(tpl==='cta'){
    bottomContent=(
      <div style={{position:'absolute',bottom:100,left:64,right:64,zIndex:5}}>
        <div style={{fontSize:52,fontWeight:800,color:'#fff',textAlign:'center',marginBottom:16}}>{slide.dealerName||theme.watermarkText||''}</div>
        <div style={{fontSize:38,color:'rgba(255,255,255,0.5)',textAlign:'center',marginBottom:48}}>{slide.carName||slide.headline||''}</div>
        <div style={{background:accent,borderRadius:999,padding:'44px 60px',textAlign:'center',marginBottom:30}}>
          <span style={{color:'#fff',fontSize:42,fontWeight:800}}>📲 {slide.whatsapp||'WhatsApp Us'}</span>
        </div>
        <div style={{textAlign:'center',fontSize:26,color:'rgba(255,255,255,0.25)'}}>DM for Test Drive · Best Price Guaranteed</div>
      </div>
    );
  } else {
    bottomContent=(
      <div style={{position:'absolute',bottom:130,left:64,right:64,zIndex:5}}>
        <div style={{fontSize:72,fontWeight:800,color:'#fff',lineHeight:1.1,marginBottom:12}}>{slide.carName||slide.headline||''}</div>
        <div style={{fontSize:52,fontWeight:700,color:accent,marginBottom:12}}>{slide.priceStr||slide.bottomLeft||''}</div>
        <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
          {(slide.statsLine||slide.bottomRight||'').split(' · ').filter(Boolean).map((s,i)=>(
            <span key={i} style={{fontSize:32,color:'rgba(255,255,255,0.6)',fontWeight:600}}>{i>0&&<span style={{color:'rgba(255,255,255,0.2)',marginRight:8}}>·</span>}{s}</span>
          ))}
        </div>
      </div>
    );
  }

  return(
    <div ref={outerRef} style={{width:'100%',height:'100%',overflow:'hidden',position:'relative',background:'#060910'}}>
      {scale>0&&(
        <div key={animKey} style={{position:'absolute',top:0,left:0,width:1080,height:1920,transformOrigin:'top left',transform:`scale(${scale})`,fontFamily:"'DM Sans',sans-serif",overflow:'hidden',background:'#060910'}}>
          {slide.imageUrl&&<>
            <img src={slide.imageUrl} alt="" style={{position:'absolute',left:0,top:0,width:1080,height:1920,objectFit:'cover',filter:'blur(18px) brightness(0.45)',transform:'scale(1.06)',transformOrigin:'center'}}/>
            <img src={slide.imageUrl} alt="" style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:1080,height:'auto',objectFit:'contain',opacity:0.92,zIndex:1}}/>
          </>}
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(6,9,16,0.95) 0%,rgba(6,9,16,0.1) 30%,rgba(6,9,16,0.05) 50%,rgba(6,9,16,0.88) 68%,#060910 100%)'}}/>
          <div style={{position:'absolute',top:0,left:0,right:0,height:6,background:accent,zIndex:10}}/>
          {theme.logoUrl&&<img src={theme.logoUrl} alt="" style={{position:'absolute',top:50,right:52,height:80,objectFit:'contain',opacity:0.75,zIndex:5}}/>}
          {theme.watermarkText&&<div style={{position:'absolute',top:52,left:52,fontSize:26,fontWeight:700,color:`rgba(255,255,255,${theme.watermarkOpacity||0.14})`,letterSpacing:'0.12em',textTransform:'uppercase',zIndex:5}}>{theme.watermarkText}</div>}
          {slide.hookText&&(
            <div style={{position:'absolute',top:150,left:0,right:0,textAlign:'center',padding:'0 80px',zIndex:5}}>
              <div style={{color:'#fff',fontSize:38,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',lineHeight:1.3}}>{slide.hookText}</div>
              <div style={{width:120,height:4,background:accent,margin:'12px auto 0'}}/>
            </div>
          )}
          {bottomContent}
          <div style={{position:'absolute',bottom:48,right:48,fontSize:22,fontWeight:700,color:'rgba(255,255,255,0.18)',zIndex:5}}>{String((slide.index??0)+1).padStart(2,'0')}</div>
        </div>
      )}
    </div>
  );
}

// ─── UI primitives ────────────────────────────────────────────────────────────
function ColorRow({label,value,onChange}){return(<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}><span style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>{label}</span><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:11,color:'rgba(255,255,255,0.25)',fontFamily:'monospace'}}>{value}</span><input type="color" value={value} onChange={e=>onChange(e.target.value)} style={{width:28,height:28,border:'none',borderRadius:6,cursor:'pointer',padding:2,background:'transparent'}}/></div></div>);}
function SliderRow({label,value,min,max,step=1,onChange,fmt}){return(<div style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><span style={{fontSize:11,color:'rgba(255,255,255,0.35)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>{label}</span><span style={{fontSize:11,color:'rgba(255,255,255,0.45)',fontFamily:'monospace'}}>{fmt?fmt(value):value}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:'100%',accentColor:'#e53935'}}/></div>);}
function PillRow({options,value,onChange}){return(<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{options.map(o=>(<button key={o.value} onClick={()=>onChange(o.value)} style={{padding:'6px 12px',borderRadius:999,border:`1px solid ${value===o.value?'#e53935':'rgba(255,255,255,0.1)'}`,background:value===o.value?'rgba(229,57,53,0.15)':'transparent',color:value===o.value?'#e53935':'rgba(255,255,255,0.4)',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{o.label}</button>))}</div>);}
function Toggle({value,onChange,label}){return(<label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}><div onClick={()=>onChange(!value)} style={{width:36,height:20,borderRadius:999,background:value?'#e53935':'rgba(255,255,255,0.1)',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:value?18:2,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div><span style={{fontSize:12,color:'rgba(255,255,255,0.55)'}}>{label}</span></label>);}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TikTokGenerator({listing,onClose}){
  const rawImages=(listing?.images||[]).filter(Boolean);
  const dealership=listing?.dealership_name||'';

  const [features,setFeatures]=useState([]);
  const [specs,setSpecs]=useState([]);
  const [whatsappNum,setWhatsappNum]=useState('');
  const [dealerName,setDealerName]=useState(dealership);
  const [imagePageStart,setImagePageStart]=useState(11);
  const [showImagePicker,setShowImagePicker]=useState(false);

  const [slides,setSlides]=useState(()=>buildDefaultSlides(listing,rawImages,[],[],dealership,''));
  const [active,setActive]=useState(0);
  const [font,setFont]=useState('dm');
  const [lang,setLang]=useState('en');
  const [hookText,setHookText]=useState('');
  const [generating,setGenerating]=useState(false);
  const [genError,setGenError]=useState('');
  const [downloading,setDownloading]=useState(false);
  const [dlIdx,setDlIdx]=useState(null);
  const [activeTab,setActiveTab]=useState('slide');
  const [profileLoading,setProfileLoading]=useState(true);
  const [theme,setTheme]=useState(()=>({...DEFAULT_THEME,watermarkText:dealership}));
  const [animKey,setAnimKey]=useState(0);

  const slide=slides[active]||slides[0]||{};
  const total=slides.length;
  const filmRef=useRef(null);
  const logoInputRef=useRef(null);
  const patchTheme=(key,val)=>setTheme(t=>({...t,[key]:val}));
  const isStructured=['hero-hook','specs-breakdown','pricing','cta'].includes(slide.template);

  // ── Fetch features + specs ──
  useEffect(()=>{
    if(!listing?.id) return;
    supabase.from('car_listings').select('features,specs').eq('id',listing.id).single()
      .then(({data})=>{
        if(!data) return;
        const f=parseList(data.features),s=parseList(data.specs);
        setFeatures(f); setSpecs(s);
        setSlides(prev=>prev.map(sl=>({...sl,features:f.length>0?f:sl.features,specs:s.length>0?s:sl.specs})));
      });
  },[listing?.id]);

  // ── Load branding ──
  useEffect(()=>{
    async function loadProfile(){
      try{
        const{data:{user}}=await supabase.auth.getUser(); if(!user) return;
        const{data,error}=await supabase.from('profiles').select('brand_color,font_choice,watermark_text,logo_url,dealership_name,whatsapp_number').eq('id',user.id).single();
        if(error||!data) return;
        const dn=data.dealership_name||dealership,wa=data.whatsapp_number||'';
        setWhatsappNum(wa); setDealerName(dn);
        setTheme(t=>({...t,accentColor:data.brand_color||t.accentColor,priceTagColor:data.brand_color||t.priceTagColor,badgeColor:data.brand_color||t.badgeColor,watermarkText:data.watermark_text||dn||t.watermarkText,logoUrl:data.logo_url||t.logoUrl}));
        if(data.font_choice) setFont(data.font_choice);
        setSlides(prev=>prev.map(sl=>({...sl,dealerName:dn,whatsapp:wa})));
      }catch(e){console.error('Profile load:',e);}
      finally{setProfileLoading(false);}
    }
    loadProfile(); FONTS.forEach(f=>ensureFont(f.id));
  },[]);

  const saveBranding=useCallback(async()=>{
    try{const{data:{user}}=await supabase.auth.getUser();if(!user) return;await supabase.from('profiles').update({brand_color:theme.accentColor,font_choice:font,watermark_text:theme.watermarkText,logo_url:theme.logoUrl}).eq('id',user.id);}catch(e){console.error(e);}
  },[theme.accentColor,font,theme.watermarkText,theme.logoUrl]);

  useEffect(()=>{
    const el=filmRef.current; if(!el) return;
    const thumb=el.children[active]; if(!thumb) return;
    thumb.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    setAnimKey(k=>k+1);
  },[active]);

  useEffect(()=>{
    const h=e=>{if(e.key==='Escape') onClose();if(e.key==='ArrowLeft') setActive(i=>Math.max(0,i-1));if(e.key==='ArrowRight') setActive(i=>Math.min(total-1,i+1));};
    window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h);
  },[onClose,total]);

  const patch=(field,value)=>setSlides(prev=>prev.map((s,i)=>i===active?{...s,[field]:value}:s));

  const uploadImage=(idx,file)=>{const r=new FileReader();r.onload=e=>setSlides(prev=>prev.map((s,i)=>i===idx?{...s,imageUrl:e.target.result}:s));r.readAsDataURL(file);};
  const uploadLogo=(file)=>{const r=new FileReader();r.onload=e=>patchTheme('logoUrl',e.target.result);r.readAsDataURL(file);};

  const addSlide=()=>{
    const n={id:Date.now(),index:slides.length,imageUrl:rawImages[0]||null,condition:listing?.condition||'',template:'hype',fitMode:'auto',enabled:true,carName:`${listing?.brand||''} ${listing?.model||''}`.trim(),headline:`${listing?.brand||''} ${listing?.model||''}`.trim(),priceStr:'',bottomLeft:'',bottomRight:'',priceNum:0,statsLine:'',monthly:null,hookText:'',features,specs,dealerName,whatsapp:whatsappNum};
    setSlides(prev=>[...prev,n]); setTimeout(()=>setActive(slides.length),0);
  };

  const addMoreListingImages=()=>{
    const next=rawImages.slice(imagePageStart,imagePageStart+10);
    if(!next.length) return;
    const price=listing?.selling_price||listing?.price;
    const priceStr=price?'RM '+Number(price).toLocaleString():'';
    const mileage=listing?.mileage?Number(listing.mileage).toLocaleString()+' km':'';
    const cond=listing?.condition||'';
    const condLabel={new:'Brand New',recon:'Recon',used:'Used'}[cond]||cond;
    const carName=`${listing?.brand||''} ${listing?.model||''}${listing?.variant?' '+listing.variant:''} ${listing?.year||''}`.trim();
    const statsLine=[String(listing?.year||''),condLabel,mileage].filter(Boolean).join(' · ');
    const tplCycle=['hype','story','spec','hype','story'];
    const newSlides=next.map((img,i)=>({id:Date.now()+i,index:slides.length+i,imageUrl:img,condition:cond,template:tplCycle[i%tplCycle.length],fitMode:'auto',enabled:true,carName,headline:carName,priceStr,bottomLeft:priceStr,bottomRight:statsLine,priceNum:price||0,statsLine,monthly:calcMonthly(price),hookText:'',features,specs,dealerName,whatsapp:whatsappNum}));
    setSlides(prev=>[...prev,...newSlides.map((s,i)=>({...s,index:prev.length+i}))]);
    setImagePageStart(p=>p+10);
  };

  const removeSlide=idx=>{if(total<=1) return;setSlides(prev=>prev.filter((_,i)=>i!==idx).map((s,i)=>({...s,index:i})));setActive(i=>Math.min(i,total-2));};
  const generate=async()=>{setGenerating(true);setGenError('');try{const results=await generateWithClaude(listing,lang,hookText,total);setSlides(prev=>prev.map((s,i)=>({...s,headline:results[i]?.headline??s.headline,bottomLeft:results[i]?.bottomLeft??s.bottomLeft,bottomRight:results[i]?.bottomRight??s.bottomRight})));}catch{setGenError('AI failed — edit manually.');}setGenerating(false);};

  const toBlob=useCallback(async idx=>{
    const c=document.createElement('canvas'); c.width=1080; c.height=1920;
    try{await renderSlide(c,{...slides[idx],index:idx},theme,font);}catch(e){console.error('renderSlide error:',e);}
    return new Promise(res=>c.toBlob(res,'image/jpeg',0.93));
  },[slides,theme,font]);

  const exportName=(idx)=>{const d=(theme.watermarkText||'XDrive').replace(/\s+/g,''),c=`${listing?.brand||''}${listing?.model||''}`.replace(/\s+/g,''),dt=new Date().toISOString().slice(0,10).replace(/-/g,'');return `${d}_${c}_${dt}_${String(idx+1).padStart(2,'0')}.jpg`;};
  const saveSingle=async idx=>{setDlIdx(idx);const blob=await toBlob(idx),url=URL.createObjectURL(blob);if(isIOS()){window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),10000);}else{const a=document.createElement('a');a.download=exportName(idx);a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}setDlIdx(null);};
  const saveAll=async()=>{
    setDownloading(true);
    const d=(theme.watermarkText||'XDrive').replace(/\s+/g,''),c=`${listing?.brand||''}${listing?.model||''}`.replace(/\s+/g,''),dt=new Date().toISOString().slice(0,10).replace(/-/g,'');
    if(isIOS()){for(let i=0;i<total;i++){const blob=await toBlob(i);const url=URL.createObjectURL(blob);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),15000);await new Promise(r=>setTimeout(r,500));}setDownloading(false);return;}
    try{const JSZip=await loadJSZip(),zip=new JSZip(),folder=zip.folder(`${d}_${c}_${dt}`);for(let i=0;i<total;i++) folder.file(exportName(i),await toBlob(i));const zb=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(zb);const a=document.createElement('a');a.download=`${d}_${c}_${dt}.zip`;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
    catch{for(let i=0;i<total;i++){await saveSingle(i);await new Promise(r=>setTimeout(r,200));}}
    setDownloading(false);
  };

  const inp=(big)=>({width:'100%',padding:big?'11px 14px':'9px 14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'#fff',fontFamily:"'DM Sans',sans-serif",fontSize:big?15:13,fontWeight:big?700:400,outline:'none',boxSizing:'border-box',transition:'border-color 0.15s'});
  const fi=e=>e.target.style.borderColor='rgba(229,57,53,0.6)';
  const fo=e=>e.target.style.borderColor='rgba(255,255,255,0.1)';
  const lbl={fontSize:10,fontWeight:700,letterSpacing:'0.09em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',display:'block',marginBottom:5,fontFamily:'inherit'};
  const sHead=(t)=>(<p style={{fontSize:9,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.2)',margin:'20px 0 10px',paddingBottom:6,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>{t}</p>);
  const fitLabel=(m)=>({fill:'Fill',blur:'Blur BG','fit-gradient':'Gradient Fade'}[m]||m);

  const renderSlidePanel=()=>(
    <div style={{display:'flex',flexDirection:'column',gap:14,position:'relative'}}>
      {showImagePicker&&rawImages.length>0&&(
        <ListingImagePicker images={rawImages} current={slide.imageUrl} onSelect={url=>patch('imageUrl',url)} onClose={()=>setShowImagePicker(false)}/>
      )}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {rawImages.length>0&&(
          <button onClick={()=>setShowImagePicker(true)} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 0',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.65)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            <ImageIcon size={13}/>{slide.imageUrl?'Change Photo':'From Listing'}
          </button>
        )}
        <label style={{flex:rawImages.length>0?0:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'9px 10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.45)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
          Upload<input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadImage(active,e.target.files[0])}/>
        </label>
        {total>1&&(<button onClick={()=>removeSlide(active)} style={{padding:'9px 10px',borderRadius:10,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.06)',color:'#f87171',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:600,fontFamily:'inherit'}}><Trash2 size={13}/>Remove</button>)}
      </div>
      {sHead('Slide Template')}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {SLIDE_TEMPLATES.map(tpl=>(
          <button key={tpl.id} onClick={()=>patch('template',tpl.id)} style={{padding:'9px 10px',borderRadius:9,border:`1px solid ${slide.template===tpl.id?'#e53935':'rgba(255,255,255,0.08)'}`,background:slide.template===tpl.id?'rgba(229,57,53,0.12)':'rgba(255,255,255,0.03)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
            <p style={{color:slide.template===tpl.id?'#e53935':'rgba(255,255,255,0.7)',fontSize:12,fontWeight:700,margin:'0 0 2px 0'}}>{tpl.label}</p>
            <p style={{color:'rgba(255,255,255,0.25)',fontSize:10,margin:0}}>{tpl.desc}</p>
          </button>
        ))}
      </div>
      {isStructured?(
        <>
          {sHead('Hook Line')}
          <div><span style={lbl}>Hook text (top)</span><input value={slide.hookText||''} onChange={e=>patch('hookText',e.target.value)} placeholder="e.g. Best Deal In Malaysia 🔥" style={inp(false)} onFocus={fi} onBlur={fo}/></div>
          {sHead('Car Info')}
          <div><span style={lbl}>Car Name</span><input value={slide.carName||''} onChange={e=>patch('carName',e.target.value)} placeholder="Toyota Camry 2.5V 2022" style={inp(true)} onFocus={fi} onBlur={fo}/></div>
          <div><span style={lbl}>Price</span><input value={slide.priceStr||''} onChange={e=>patch('priceStr',e.target.value)} placeholder="RM 145,000" style={inp(false)} onFocus={fi} onBlur={fo}/></div>
          <div><span style={lbl}>Stats (Year · Mileage · Cond.)</span><input value={slide.statsLine||''} onChange={e=>patch('statsLine',e.target.value)} placeholder="2022 · 28,000 km · Recon" style={inp(false)} onFocus={fi} onBlur={fo}/></div>
        </>
      ):(
        <>
          {sHead('Image Fit')}
          <div style={{display:'flex',gap:6,alignItems:'center',padding:'8px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)'}}><RefreshCw size={11} style={{color:'rgba(255,255,255,0.3)',flexShrink:0}}/><span style={{fontSize:11,color:'rgba(255,255,255,0.3)',flex:1}}>Auto: <span style={{color:'rgba(255,255,255,0.6)',fontWeight:600}}>{fitLabel(slide.fitMode==='auto'||!slide.fitMode?'auto':slide.fitMode)}</span></span></div>
          <div style={{marginBottom:4}}><span style={lbl}>Override</span><PillRow options={[{label:'Auto',value:'auto'},{label:'Fill',value:'fill'},{label:'Blur',value:'blur'},{label:'Gradient',value:'fit-gradient'}]} value={slide.fitMode||'auto'} onChange={v=>patch('fitMode',v)}/></div>
          {sHead('Slide Text')}
          <div><span style={lbl}>Headline</span><input value={slide.headline||''} onChange={e=>patch('headline',e.target.value)} placeholder="BMW M4 Competition" style={inp(true)} onFocus={fi} onBlur={fo}/></div>
          <div><span style={lbl}>Price / Hook</span><input value={slide.bottomLeft||''} onChange={e=>patch('bottomLeft',e.target.value)} placeholder="RM 189,800" style={inp(false)} onFocus={fi} onBlur={fo}/></div>
          <div><span style={lbl}>Specs line</span><input value={slide.bottomRight||''} onChange={e=>patch('bottomRight',e.target.value)} placeholder="2023 · Recon · 28k km" style={inp(false)} onFocus={fi} onBlur={fo}/></div>
        </>
      )}
      <div style={{paddingTop:4}}><Toggle value={slide.enabled!==false} onChange={v=>patch('enabled',v)} label="Include in export"/></div>
    </div>
  );

  const renderDesignPanel=()=>(<div>
    {sHead('Background')}
    <div style={{marginBottom:12}}><span style={lbl}>Mode</span><PillRow options={[{label:'Blur',value:'blur'},{label:'Gradient',value:'gradient'},{label:'Solid',value:'solid'}]} value={theme.bgMode} onChange={v=>patchTheme('bgMode',v)}/></div>
    {theme.bgMode==='solid'&&<ColorRow label="Background" value={theme.bgColor} onChange={v=>patchTheme('bgColor',v)}/>}
    {theme.bgMode==='gradient'&&<><ColorRow label="Gradient top" value={theme.bgGradFrom} onChange={v=>patchTheme('bgGradFrom',v)}/><ColorRow label="Gradient bottom" value={theme.bgGradTo} onChange={v=>patchTheme('bgGradTo',v)}/></>}
    {theme.bgMode==='blur'&&<SliderRow label="Overlay opacity" value={theme.overlayOpacity} min={0} max={0.85} step={0.05} onChange={v=>patchTheme('overlayOpacity',v)} fmt={v=>Math.round(v*100)+'%'}/>}
    {sHead('Text')}
    <div style={{marginBottom:12}}><span style={lbl}>Position</span><PillRow options={[{label:'Top',value:'top'},{label:'Middle',value:'center'},{label:'Bottom',value:'bottom'}]} value={theme.textPosition} onChange={v=>patchTheme('textPosition',v)}/></div>
    <div style={{marginBottom:12}}><span style={lbl}>Alignment</span><PillRow options={[{label:'Left',value:'left'},{label:'Centre',value:'center'}]} value={theme.textAlign} onChange={v=>patchTheme('textAlign',v)}/></div>
    <ColorRow label="Text colour" value={theme.textColor} onChange={v=>patchTheme('textColor',v)}/>
    <ColorRow label="Accent colour" value={theme.accentColor} onChange={v=>patchTheme('accentColor',v)}/>
    <SliderRow label="Headline size" value={theme.headlineSize} min={60} max={160} step={4} onChange={v=>patchTheme('headlineSize',v)}/>
    <SliderRow label="Line 2 size" value={theme.line2Size} min={40} max={120} step={4} onChange={v=>patchTheme('line2Size',v)}/>
    <SliderRow label="Line 3 size" value={theme.line3Size} min={28} max={90} step={4} onChange={v=>patchTheme('line3Size',v)}/>
    {sHead('Font')}
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {FONTS.map(f=>(<button key={f.id} onClick={()=>{ensureFont(f.id);setFont(f.id);}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:10,cursor:'pointer',width:'100%',border:`1px solid ${font===f.id?'#e53935':'rgba(255,255,255,0.08)'}`,background:font===f.id?'rgba(229,57,53,0.1)':'rgba(255,255,255,0.03)',fontFamily:f.stack,transition:'all 0.15s'}}><span style={{fontSize:14,color:font===f.id?'#e53935':'rgba(255,255,255,0.7)',fontWeight:600}}>{f.label}</span><span style={{fontSize:11,color:'rgba(255,255,255,0.2)',fontFamily:"'DM Sans',sans-serif"}}>Aa</span></button>))}
    </div>
  </div>);

  const renderBrandPanel=()=>(<div>
    {profileLoading&&(<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:'rgba(229,57,53,0.07)',borderRadius:8,marginBottom:14,border:'1px solid rgba(229,57,53,0.15)'}}><Loader2 size={12} style={{animation:'spin 1s linear infinite',color:'#e53935'}}/><span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Loading branding…</span></div>)}
    {sHead('Watermark')}
    <div style={{marginBottom:12}}><span style={lbl}>Text</span><input value={theme.watermarkText} onChange={e=>patchTheme('watermarkText',e.target.value)} placeholder="Your dealership name" style={inp(false)} onFocus={fi} onBlur={fo}/></div>
    <div style={{marginBottom:12}}><span style={lbl}>Position</span><PillRow options={[{label:'↗ Top R',value:'top-right'},{label:'↖ Top L',value:'top-left'},{label:'↘ Bot R',value:'bottom-right'},{label:'↙ Bot L',value:'bottom-left'}]} value={theme.watermarkPos} onChange={v=>patchTheme('watermarkPos',v)}/></div>
    <SliderRow label="Opacity" value={theme.watermarkOpacity} min={0.04} max={0.6} step={0.02} onChange={v=>patchTheme('watermarkOpacity',v)} fmt={v=>Math.round(v*100)+'%'}/>
    {sHead('Logo')}
    <input ref={logoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadLogo(e.target.files[0])}/>
    <div style={{display:'flex',gap:8}}>
      <button onClick={()=>logoInputRef.current?.click()} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.65)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}><ImageIcon size={13}/>{theme.logoUrl?'Swap Logo':'Upload Logo'}</button>
      {theme.logoUrl&&(<button onClick={()=>patchTheme('logoUrl',null)} style={{padding:'10px 12px',borderRadius:10,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.06)',color:'#f87171',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>Remove</button>)}
    </div>
    {theme.logoUrl&&(<div style={{marginTop:10,padding:8,background:'rgba(255,255,255,0.03)',borderRadius:8,display:'flex',alignItems:'center',gap:8}}><img src={theme.logoUrl} alt="logo" style={{height:32,objectFit:'contain',borderRadius:4}}/><span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>Shown on all structured slides</span></div>)}
    {sHead('Save Branding')}
    <button onClick={saveBranding} style={{width:'100%',padding:'10px',borderRadius:10,border:'1px solid rgba(229,57,53,0.3)',background:'rgba(229,57,53,0.08)',color:'#e53935',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>Save as My Default Branding</button>
    <p style={{fontSize:10,color:'rgba(255,255,255,0.2)',marginTop:6,textAlign:'center'}}>Saves colour, font, watermark & logo to your profile</p>
  </div>);

  const renderBadgesPanel=()=>(<div>
    {sHead('Price Tag Style')}
    <div style={{marginBottom:14}}><PillRow options={[{label:'Plain',value:'plain'},{label:'Pill',value:'pill'},{label:'Boxed',value:'boxed'}]} value={theme.priceTagStyle} onChange={v=>patchTheme('priceTagStyle',v)}/></div>
    {(theme.priceTagStyle==='pill'||theme.priceTagStyle==='boxed')&&<ColorRow label="Price tag colour" value={theme.priceTagColor} onChange={v=>patchTheme('priceTagColor',v)}/>}
    {sHead('Sticker Badges')}
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <Toggle value={theme.showConditionBadge} onChange={v=>patchTheme('showConditionBadge',v)} label="Condition badge (NEW / RECON / USED)"/>
      <Toggle value={theme.showHotDealBadge} onChange={v=>patchTheme('showHotDealBadge',v)} label="🔥 Hot Deal badge"/>
    </div>
    {sHead('Custom Badge')}
    <div style={{marginBottom:10}}><span style={lbl}>Badge text</span><input value={theme.customBadgeText} onChange={e=>patchTheme('customBadgeText',e.target.value)} placeholder="e.g. NEGOTIABLE" style={inp(false)} onFocus={fi} onBlur={fo} maxLength={20}/></div>
    <ColorRow label="Badge colour" value={theme.badgeColor} onChange={v=>patchTheme('badgeColor',v)}/>
  </div>);

  const renderAIPanel=()=>(<div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',gap:6}}>
      {['en','bm'].map(l=>(<button key={l} onClick={()=>setLang(l)} style={{flex:1,padding:'9px',borderRadius:10,cursor:'pointer',border:`1px solid ${lang===l?'#e53935':'rgba(255,255,255,0.1)'}`,background:lang===l?'rgba(229,57,53,0.1)':'rgba(255,255,255,0.03)',color:lang===l?'#e53935':'rgba(255,255,255,0.45)',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>{l==='en'?'🇬🇧 English':'🇲🇾 Bahasa'}</button>))}
    </div>
    <input value={hookText} onChange={e=>setHookText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&generate()} placeholder={`Hook — e.g. Cleanest ${listing?.brand||'car'} in Malaysia`} style={inp(false)} onFocus={fi} onBlur={fo}/>
    <button onClick={generate} disabled={generating} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px',borderRadius:10,border:'none',background:'#e53935',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',opacity:generating?0.6:1,fontFamily:'inherit',width:'100%'}}>
      {generating?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Sparkles size={14}/>}
      {generating?`Writing ${total} slides…`:`Generate All ${total} Slides`}
    </button>
    {genError&&<p style={{fontSize:11,color:'#fbbf24',background:'rgba(251,191,36,0.07)',border:'1px solid rgba(251,191,36,0.15)',borderRadius:8,padding:'8px 12px',margin:0}}>{genError}</p>}
  </div>);

  const TABS=[{id:'slide',label:'Slide',icon:<Layers size={11}/>},{id:'design',label:'Design',icon:<Palette size={11}/>},{id:'brand',label:'Brand',icon:<Shield size={11}/>},{id:'badges',label:'Badges',icon:<Tag size={11}/>},{id:'ai',label:'AI',icon:<Sparkles size={11}/>}];
  const tabPanel=()=>{if(activeTab==='slide') return renderSlidePanel();if(activeTab==='design') return renderDesignPanel();if(activeTab==='brand') return renderBrandPanel();if(activeTab==='badges') return renderBadgesPanel();if(activeTab==='ai') return renderAIPanel();};

  const remainingImages=rawImages.length>imagePageStart?rawImages.length-imagePageStart:0;

  const FilmStrip=({horizontal})=>(
    <div ref={horizontal?filmRef:null} style={horizontal?{flexShrink:0,display:'flex',gap:8,overflowX:'auto',padding:'8px 14px',background:'#060610',borderBottom:'1px solid rgba(255,255,255,0.06)',scrollbarWidth:'none',alignItems:'center'}:{display:'flex',flexDirection:'column',gap:8,overflow:'auto',flex:1,scrollbarWidth:'none'}}>
      {!horizontal&&<div ref={filmRef} style={{display:'flex',flexDirection:'column',gap:8}}>{slides.map((s,i)=>(<Thumb key={s.id??i} slide={s} theme={theme} fontId={font} isActive={i===active} index={i} onClick={()=>setActive(i)} onDelete={()=>removeSlide(i)} showDelete={total>1}/>))}</div>}
      {horizontal&&slides.map((s,i)=>(<Thumb key={s.id??i} slide={s} theme={theme} fontId={font} isActive={i===active} index={i} onClick={()=>setActive(i)} onDelete={()=>removeSlide(i)} showDelete={total>1}/>))}
      {remainingImages>0&&(
        <button onClick={addMoreListingImages} style={{flexShrink:0,width:horizontal?60:48,height:horizontal?85:85,borderRadius:7,border:'2px dashed rgba(229,57,53,0.4)',background:'rgba(229,57,53,0.06)',color:'#e53935',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,padding:4}}>
          <Plus size={14}/>
          <span style={{fontSize:8,fontWeight:700,textAlign:'center',lineHeight:1.1}}>+{remainingImages}</span>
        </button>
      )}
      <button onClick={addSlide} style={{flexShrink:0,width:horizontal?48:48,height:85,borderRadius:7,border:'2px dashed rgba(255,255,255,0.14)',background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Plus size={16}/></button>
    </div>
  );

  const PreviewPane=()=>(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#070711',gap:14,padding:'24px 20px',position:'relative'}}>
      <div style={{aspectRatio:'9/16',height:'min(calc(100dvh - 200px), 520px)',borderRadius:14,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.8)',flexShrink:0}}>
        <SlidePreviewHTML slide={{...slide,index:active}} theme={theme} animKey={`${active}-${animKey}`}/>
      </div>
      <button onClick={()=>setActive(i=>Math.max(0,i-1))} disabled={active===0} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',width:34,height:34,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(0,0,0,0.55)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:active===0?0.15:0.7}}><ChevronLeft size={17}/></button>
      <button onClick={()=>setActive(i=>Math.min(total-1,i+1))} disabled={active===total-1} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:34,height:34,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(0,0,0,0.55)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:active===total-1?0.15:0.7}}><ChevronRight size={17}/></button>
      <div style={{fontSize:11,color:'rgba(255,255,255,0.25)',fontWeight:600}}>Slide {active+1} of {total} · {SLIDE_TEMPLATES.find(t=>t.id===slide.template)?.label||'Hype'}</div>
    </div>
  );

  return(
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes tgIn{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:none;}}
.tg *{box-sizing:border-box;}
        .tg ::-webkit-scrollbar{display:none;}
        .tg-d{display:none!important;}
        .tg-m{display:flex!important;}
        @media(min-width:768px){.tg-d{display:flex!important;}.tg-m{display:none!important;}}
        .tg-tab{padding:6px 10px;border-radius:7px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;transition:all 0.15s;border:none;display:flex;align-items:center;gap:4px;}
        input[type=range]{height:4px;border-radius:2px;}
      `}</style>

      <div className="tg" onClick={onClose} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(14px)',fontFamily:"'DM Sans',sans-serif"}}>

        {/* DESKTOP */}
        <div className="tg-d" onClick={e=>e.stopPropagation()} style={{position:'fixed',inset:0,flexDirection:'column',background:'#08080f',animation:'tgIn 0.25s ease'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 20px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0c0c16',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:27,height:27,borderRadius:7,background:'#e53935',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.77 0 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.12 8.72 6.34 6.34 0 0 0 11.65-3.42V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/></svg>
              </div>
              <span style={{color:'#fff',fontWeight:700,fontSize:13}}>Content Studio</span>
              <span style={{color:'rgba(255,255,255,0.3)',fontSize:11,marginLeft:4}}>{listing?.brand} {listing?.model} · {total} slides · 1080×1920</span>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>saveSingle(active)} disabled={dlIdx===active} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',opacity:dlIdx===active?0.5:1}}>
                {dlIdx===active?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Download size={12}/>} This slide
              </button>
              <button onClick={saveAll} disabled={downloading} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:8,border:'none',background:'#e53935',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:downloading?0.6:1}}>
                {downloading?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Download size={12}/>}
                {downloading?'Packing…':isIOS()?'Save All':`Export ZIP (${total})`}
              </button>
              <button onClick={onClose} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'#fff',cursor:'pointer'}}><X size={15}/></button>
            </div>
          </div>
          <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
            <div style={{width:82,background:'#060610',borderRight:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',padding:'12px 17px',overflowY:'auto',flexShrink:0}}>
              <p style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.18)',marginBottom:10,marginTop:0}}>Slides</p>
              <FilmStrip horizontal={false}/>
            </div>
            <PreviewPane/>
            <div style={{width:320,background:'#0c0c16',borderLeft:'1px solid rgba(255,255,255,0.07)',display:'flex',flexDirection:'column',flexShrink:0}}>
              <div style={{display:'flex',gap:3,padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0,flexWrap:'wrap'}}>
                {TABS.map(({id,label,icon})=>(<button key={id} className="tg-tab" onClick={()=>setActiveTab(id)} style={{background:activeTab===id?'rgba(229,57,53,0.12)':'rgba(255,255,255,0.03)',border:`1px solid ${activeTab===id?'rgba(229,57,53,0.4)':'rgba(255,255,255,0.07)'}`,color:activeTab===id?'#e53935':'rgba(255,255,255,0.38)'}}>{icon}{label}</button>))}
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'16px 14px'}}>{tabPanel()}</div>
            </div>
          </div>
        </div>

        {/* MOBILE */}
        <div className="tg-m" onClick={e=>e.stopPropagation()} style={{position:'fixed',inset:0,flexDirection:'column',background:'#08080f',animation:'tgIn 0.25s ease'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'#0c0c16',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={16}/></button>
            <span style={{color:'#fff',fontWeight:700,fontSize:13}}>Slide {active+1}/{total}</span>
            <button onClick={saveAll} disabled={downloading} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:8,border:'none',background:'#e53935',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:downloading?0.6:1}}>
              {downloading?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Download size={12}/>}{downloading?'…':isIOS()?'Save':'ZIP'}
            </button>
          </div>
          <div style={{flexShrink:0,display:'flex',justifyContent:'center',alignItems:'center',background:'#060610',padding:'12px 16px',position:'relative'}}>
            <div style={{position:'relative'}}>
              <div style={{width:138,height:245,borderRadius:10,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.7)'}}>
                {isStructured
                  ?<SlidePreviewHTML slide={{...slide,index:active}} theme={theme} animKey={`m-${active}-${animKey}`}/>
                  :<SlideCanvas slide={{...slide,index:active}} theme={theme} fontId={font} width={276} height={490}/>
                }
              </div>
              <button onClick={()=>saveSingle(active)} disabled={dlIdx===active} style={{position:'absolute',bottom:5,right:5,width:24,height:24,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {dlIdx===active?<Loader2 size={9} style={{animation:'spin 1s linear infinite'}}/>:<Download size={9}/>}
              </button>
            </div>
            <button onClick={()=>setActive(i=>Math.max(0,i-1))} disabled={active===0} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(0,0,0,0.55)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:active===0?0.15:0.7}}><ChevronLeft size={14}/></button>
            <button onClick={()=>setActive(i=>Math.min(total-1,i+1))} disabled={active===total-1} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.1)',background:'rgba(0,0,0,0.55)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:active===total-1?0.15:0.7}}><ChevronRight size={14}/></button>
          </div>
          <FilmStrip horizontal={true}/>
          <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0c0c16',flexShrink:0,overflowX:'auto'}}>
            {TABS.map(({id,label,icon})=>(<button key={id} onClick={()=>setActiveTab(id)} style={{flex:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'8px 12px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',borderBottom:activeTab===id?'2px solid #e53935':'2px solid transparent',color:activeTab===id?'#e53935':'rgba(255,255,255,0.28)',transition:'color 0.15s',whiteSpace:'nowrap'}}><span style={{fontSize:11,fontWeight:700,letterSpacing:'0.04em',display:'flex',alignItems:'center',gap:3}}>{icon}{label}</span></button>))}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'16px 14px',overscrollBehavior:'contain'}}>{tabPanel()}</div>
        </div>
      </div>
    </>
  );
}
