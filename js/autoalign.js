// DartEye · Auto-align: finds the board in the camera picture and calibrates
'use strict';

/* ---------- auto-align: find the board in the camera picture ---------- */
// classes: 0 dark bed, 1 light bed, 2 red, 3 green
function classifyFrame(cam,W,H){
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const cx=cv.getContext('2d',{willReadFrequently:true});drawSrc(cam,cx,0,0,W,H);
  const d=cx.getImageData(0,0,W,H).data,n=W*H,cls=new Uint8Array(n),val=new Float32Array(n);
  for(let i=0,j=0;i<n;i++,j+=4){
    const r=d[j],g=d[j+1],b=d[j+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),c=mx-mn,v=mx/255,s=mx?c/mx:0;
    val[i]=v;cls[i]=255;
    if(s>.38&&v>.2&&c>40){
      let h=mx===r?((g-b)/c)%6:mx===g?(b-r)/c+2:(r-g)/c+4;h*=60;if(h<0)h+=360;
      if(h<22||h>330)cls[i]=2;else if(h>80&&h<185)cls[i]=3;
    }
  }
  return{cls,val};
}
function findRing(cls,W,H){
  const n=W*H,col=new Uint8Array(n);
  for(let i=0;i<n;i++)if(cls[i]===2||cls[i]===3){const x=i%W,y=(i/W)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<W&&yy<H)col[yy*W+xx]=1;}}
  const lab=new Int32Array(n);let id=0,best=null;
  for(let i=0;i<n;i++){
    if(!col[i]||lab[i])continue;id++;
    const st=[i];lab[i]=id;let cnt=0,sx=0,sy=0,x0=W,x1=0,y0=H,y1=0;const pix=[];
    while(st.length){const k=st.pop(),x=k%W,y=(k/W)|0;cnt++;sx+=x;sy+=y;pix.push(k);
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const q=yy*W+xx;if(col[q]&&!lab[q]){lab[q]=id;st.push(q);}}}
    if(x1-x0<W*.1||y1-y0<H*.08)continue;
    const mx=sx/cnt,my=sy/cnt,ci=Math.round(my)*W+Math.round(mx);
    if(lab[ci]===id)continue; // a ring has a hole in the middle
    const area=(x1-x0)*(y1-y0);
    if(!best||area>best.area)best={id,pix,mx,my,area};
  }
  if(!best)return null;
  let sxx=0,syy=0,sxy=0;
  for(const k of best.pix){const dx=k%W-best.mx,dy=((k/W)|0)-best.my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}
  const c=best.pix.length;sxx/=c;syy/=c;sxy/=c;
  const tr=sxx+syy,det=sxx*syy-sxy*sxy,disc=Math.sqrt(Math.max(0,tr*tr/4-det)),l1=tr/2+disc,l2=Math.max(1,tr/2-disc);
  const th=.5*Math.atan2(2*sxy,sxx-syy);
  return{cx:best.mx,cy:best.my,a:Math.sqrt(2*l1),b:Math.sqrt(2*l2),ux:Math.cos(th),uy:Math.sin(th)};
}
let ALIGN_SAMPLES=null;
function alignSamples(){
  if(ALIGN_SAMPLES)return ALIGN_SAMPLES;
  const S2=[],add=(r,a,e)=>S2.push([r*Math.sin(rad(a)),r*Math.cos(rad(a)),e]);
  for(let i=0;i<20;i++){
    const ev=i%2===0,sg=ev?0:1,ring=ev?2:3;
    for(const da of[-7,-4,0,4,7]){const a=i*18+da;
      for(const r of[28,50,72,90,118,138,152])add(r,a,sg);
      for(const r of[100.6,103,105.4])add(r,a,ring);
      for(const r of[95.5,111])add(r,a,sg);
      for(const r of[163,166,169])add(r,a,ring);
      add(157.5,a,sg);for(const r of[174,179])add(r,a,4);
    }
  }
  for(let a=0;a<360;a+=30){add(3,a,2);add(11.5,a,3);}
  return ALIGN_SAMPLES=S2;
}
// smoothed per-class probability maps make the fit score continuous, so the optimiser can settle sub-pixel
function classMaps(cls,W,H){
  const maps=[0,1,2,3].map(c=>{let m=new Float32Array(W*H);for(let i=0;i<m.length;i++)m[i]=cls[i]===c?1:0;
    for(let pass=0;pass<2;pass++){const t=new Float32Array(W*H);
      for(let y=0;y<H;y++)for(let x=1;x<W-1;x++){const i=y*W+x;t[i]=(m[i-1]+m[i]+m[i+1])/3;}
      for(let y=1;y<H-1;y++)for(let x=0;x<W;x++){const i=y*W+x;m[i]=(t[i-W]+t[i]+t[i+W])/3;}}
    return m;});
  return{maps,W,H};
}
function alignScore(pts,CM){
  const Hm=homog(CAL_MM,pts);if(!Hm)return-1;
  const{maps,W,H}=CM;let s=0;
  for(const[x,y,e]of alignSamples()){
    const[u,v]=applyH(Hm,x,y);
    if(u<0||v<0||u>=W-1||v>=H-1)continue;
    const x0=u|0,y0=v|0,fx=u-x0,fy=v-y0,i=y0*W+x0;
    const at=m=>(m[i]*(1-fx)+m[i+1]*fx)*(1-fy)+(m[i+W]*(1-fx)+m[i+W+1]*fx)*fy;
    if(e===4)s+=1-at(maps[2])-at(maps[3]);
    else s+=at(maps[e])*(e>=2?2:1);
  }
  return s;
}
function alignMax(){return sum(alignSamples().map(([, ,e])=>e===2||e===3?2:1));}
async function autoAlign(cam,quiet){
  const[w,h]=srcSize(cam);if(!w){if(!quiet)toast('Start a camera first');return false;}
  const W=640,H=Math.round(640*h/w);
  if(cam===CUR)$('#calHint').innerHTML='Looking for the board…';
  await new Promise(r=>setTimeout(r,30));
  if(!CAMS.includes(cam))return false;
  const{cls,val}=classifyFrame(cam,W,H),ring=findRing(cls,W,H);
  if(!ring){if(!quiet)toast('Couldn’t find the board: is it in view and well lit?');return false;}
  // split the remaining pixels inside the board into dark / light beds (Otsu threshold)
  const hist=new Float64Array(64);let tot=0;
  for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const i=y*W+x;if(cls[i]!==255)continue;
    const dx=x-ring.cx,dy=y-ring.cy,p=(dx*ring.ux+dy*ring.uy)/ring.a,q=(-dx*ring.uy+dy*ring.ux)/ring.b;
    if(p*p+q*q<1){hist[Math.min(63,val[i]*64|0)]++;tot++;}}
  let best=0,thr=.5,wB=0,sB=0;const sAll=sum([...hist].map((c,i)=>c*i));
  for(let t=0;t<64;t++){wB+=hist[t];if(!wB||wB===tot)continue;sB+=t*hist[t];const mB=sB/wB,mF=(sAll-sB)/(tot-wB),v=wB*(tot-wB)*(mB-mF)**2;if(v>best){best=v;thr=(t+.5)/64;}}
  for(let i=0;i<cls.length;i++)if(cls[i]===255)cls[i]=val[i]>thr?1:0;
  // the ring's ellipse (radius ≈ 166 mm), tried at every rotation; keep image handedness (board y-up -> image y-down)
  let E=[ring.ux*ring.a/166,-ring.uy*ring.b/166,ring.uy*ring.a/166,ring.ux*ring.b/166];
  if(E[0]*E[3]-E[1]*E[2]>0)E=[E[0],-E[1],E[2],-E[3]];
  const ptsFor=phi=>{const c=Math.cos(phi),s=Math.sin(phi);const M=[E[0]*c+E[1]*s,-E[0]*s+E[1]*c,E[2]*c+E[3]*s,-E[2]*s+E[3]*c];
    return CAL_MM.map(([x,y])=>[ring.cx+M[0]*x+M[1]*y,ring.cy+M[2]*x+M[3]*y]);};
  const CM=classMaps(cls,W,H),cands=[];
  for(let k=0;k<180;k++){const phi=rad(k*2),p=ptsFor(phi);cands.push({p,s:alignScore(p,CM)});}
  const top=Math.max(...cands.map(c=>c.s));
  // the colour pattern repeats every 36°: among equally good fits, put 20 where it was last time
  // (remembered per camera, including any ⟲/⟳ correction), or nearest the top of the picture the first time
  const dir20=p=>{const Hm=homog(CAL_MM,p),[x0,y0]=applyH(Hm,0,0),[x1,y1]=applyH(Hm,0,170);return Math.atan2(x1-x0,-(y1-y0));};
  const ref=(CALS.up||{})[cam.key]||0,off=a=>Math.abs(Math.atan2(Math.sin(a-ref),Math.cos(a-ref)));
  const good=cands.filter(c=>c.s>=top*.93).sort((a,b)=>off(dir20(a.p))-off(dir20(b.p)));
  let pts=good[0].p,sc=alignScore(pts,CM);
  for(const step of[8,4,2,1,.5,.25,.12]){
    for(let it=0,imp=true;imp&&it<30;it++){imp=false;
      for(let k=0;k<8;k++)for(const dlt of[step,-step]){
        const p2=pts.map(q=>q.slice());p2[k>>1][k&1]+=dlt;const s2=alignScore(p2,CM);
        if(s2>sc){sc=s2;pts=p2;imp=true;}
      }
    }
  }
  const conf=sc/alignMax();
  if(conf<.55){if(!quiet)toast(`Board found, but the fit is weak (${Math.round(conf*100)}%) – tap the 4 points instead`);return false;}
  setCal(cam,pts.map(([x,y])=>[x/W,y/H]));
  setDet(cam,'ready','Ready · throw!');
  toast(`${CAMS.length>1?`Camera ${CAMS.indexOf(cam)+1} a`:'A'}uto-aligned ✓ (${Math.round(conf*100)}% match)`);
  return true;
}
// turn the numbering by two segments (the colour pattern can't tell these apart)
function rotateCal(cam,dir){
  if(!cam||!cam.cal.Hinv)return;const a=rad(36*dir),c=Math.cos(a),s=Math.sin(a);
  setCal(cam,CAL_MM.map(([x,y])=>applyH(cam.cal.Hinv,x*c+y*s,-x*s+y*c)));
}
