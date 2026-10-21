// DartEye · Dart detection per camera: frame differencing, dart blob, tip finding; reports go to fusion.js
'use strict';

/* ---------- detection ---------- */
function newDetState(){return{ref:null,base:null,prev:null,still:0,armed:false,onBoard:0,blockedSince:0,roi:null,roiCount:0,last:null};}
function resetDetector(cam){const d=cam.det;Object.assign(d,newDetState(),{roi:d.roi,roiCount:d.roiCount});}
function grabGray(cam){
  const[w,h]=srcSize(cam);if(!w)return null;
  const pw=400,ph=Math.round(400*h/w);
  if(pw!==cam.PW||ph!==cam.PH){cam.PW=pw;cam.PH=ph;cam.proc.width=pw;cam.proc.height=ph;cam.det.roi=null;resetDetector(cam);}
  const PW=cam.PW,PH=cam.PH;
  drawSrc(cam,cam.pctx,0,0,PW,PH);
  const d=cam.pctx.getImageData(0,0,PW,PH).data,n=PW*PH,Y=new Uint8Array(n),C1=new Uint8Array(n),C2=new Uint8Array(n);
  // luma plus two chroma channels: a silver tip on a cream bed barely differs in brightness, but clearly in colour
  for(let i=0,j=0;i<n;i++,j+=4){const r=d[j],g=d[j+1],b=d[j+2];
    Y[i]=(r*77+g*150+b*29)>>8;C1[i]=128+((b-r)>>1);C2[i]=128+((2*g-r-b)>>2);}
  return{y:blur(Y,PW,PH),c1:blur(C1,PW,PH),c2:blur(C2,PW,PH)};
}
function blur(g,PW,PH){ // 3x3 box blur (separable) to suppress sensor noise
  const n=g.length,t=new Uint8Array(n),o=new Uint8Array(n);
  for(let y=0;y<PH;y++){const r=y*PW;for(let x=0;x<PW;x++){const a=x>0?x-1:x,b=x<PW-1?x+1:x;t[r+x]=(g[r+a]+g[r+x]+g[r+b])/3;}}
  for(let y=0;y<PH;y++){const a=(y>0?y-1:y)*PW,b=(y<PH-1?y+1:y)*PW,r=y*PW;for(let x=0;x<PW;x++)o[r+x]=(t[a+x]+t[r+x]+t[b+x])/3;}
  return o;
}
function buildRoi(cam){
  const{PW,PH}=cam,roi=new Uint8Array(PW*PH);let c=0;
  for(let y=0;y<PH;y++)for(let x=0;x<PW;x++){
    let ok=1;
    if(cam.cal.H){const[bx,by]=applyH(cam.cal.H,(x+.5)/PW,(y+.5)/PH);ok=Math.hypot(bx,by)<380?1:0;} // wide enough that a flight sticking out past the board isn't cut off
    roi[y*PW+x]=ok;c+=ok;
  }
  cam.det.roi=roi;cam.det.roiCount=c;
}
function pxDiff(a,b,i){return Math.max(Math.abs(a.y[i]-b.y[i]),Math.abs(a.c1[i]-b.c1[i])*1.6,Math.abs(a.c2[i]-b.c2[i])*1.6);}
function countDiff(cam,a,b,T){const roi=cam.det.roi,n=a.y.length;let c=0;for(let i=0;i<n;i++)if(roi[i]&&pxDiff(a,b,i)>T)c++;return c;}
function diffMask(cam,a,b,T){const roi=cam.det.roi,n=a.y.length,m=new Uint8Array(n);let c=0;for(let i=0;i<n;i++)if(roi[i]&&pxDiff(a,b,i)>T){m[i]=1;c++;}return[m,c];}
// one dart lands per stable event, so gather every nearby fragment (barrel, shaft, flight split by same-coloured background)
function dartBlob(comps,PW){
  const big=comps[0];if(!big)return null;
  const cen=p=>{let x=0,y=0;for(const i of p){x+=i%PW;y+=(i/PW)|0;}return[x/p.length,y/p.length];};
  const[bx,by]=cen(big),lim=PW*.16,out=big.slice();
  for(let k=1;k<comps.length;k++){const p=comps[k];if(p.length<4)break;const[x,y]=cen(p);if(Math.hypot(x-bx,y-by)<lim)for(const i of p)out.push(i);}
  return out;
}
// walk past the detected end while there is still a faint change: recovers thin steel points
function refineTip(cam,tip,g,ref){
  if(!tip.ends)return tip;
  const{PW,PH}=cam,[A,B]=tip.ends,from=tip.tipMin?B:A,to=tip.tipMin?A:B,L=Math.hypot(to[0]-from[0],to[1]-from[1]);
  const ux=(to[0]-from[0])/L,uy=(to[1]-from[1])/L;let good=0;
  for(let s=1;s<=14;s++){let hit=false;
    for(let o=-1;o<=1&&!hit;o++){const x=Math.round(tip.x+ux*s-uy*o-.5),y=Math.round(tip.y+uy*s+ux*o-.5);
      if(x>=0&&y>=0&&x<PW&&y<PH&&pxDiff(g,ref,y*PW+x)>S.diffT*.45)hit=true;}
    if(hit)good=s;else if(s-good>2)break;}
  return Object.assign({},tip,{x:tip.x+ux*good,y:tip.y+uy*good});
}
function components(mask,W,H){
  const n=W*H,dil=new Uint8Array(n),rr=2;
  for(let i=0;i<n;i++)if(mask[i]){const x=i%W,y=(i/W)|0;
    for(let dy=-rr;dy<=rr;dy++){const yy=y+dy;if(yy<0||yy>=H)continue;for(let dx=-rr;dx<=rr;dx++){const xx=x+dx;if(xx>=0&&xx<W)dil[yy*W+xx]=1;}}}
  const lab=new Int32Array(n),comps=[];let id=0;
  for(let i=0;i<n;i++){if(!dil[i]||lab[i])continue;id++;const st=[i],pix=[];lab[i]=id;
    while(st.length){const k=st.pop();if(mask[k])pix.push(k);const x=k%W,y=(k/W)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const q=yy*W+xx;if(dil[q]&&!lab[q]){lab[q]=id;st.push(q);}}}
    comps.push(pix);}
  return comps.sort((a,b)=>b.length-a.length);
}
function findTip(pix,PW){
  const n=pix.length;let mx=0,my=0;
  for(const i of pix){mx+=i%PW+.5;my+=((i/PW)|0)+.5;}mx/=n;my/=n;
  let sxx=0,syy=0,sxy=0;
  for(const i of pix){const dx=i%PW+.5-mx,dy=((i/PW)|0)+.5-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}
  const th=.5*Math.atan2(2*sxy,sxx-syy),ux=Math.cos(th),uy=Math.sin(th);
  const T=new Float32Array(n),P=new Float32Array(n);let tmin=1e9,tmax=-1e9;
  pix.forEach((i,k)=>{const dx=i%PW+.5-mx,dy=((i/PW)|0)+.5-my;T[k]=dx*ux+dy*uy;P[k]=-dx*uy+dy*ux;if(T[k]<tmin)tmin=T[k];if(T[k]>tmax)tmax=T[k];});
  const len=tmax-tmin;
  if(len<5)return{x:mx,y:my,ends:null,len};
  const A=[mx+ux*tmin,my+uy*tmin],B=[mx+ux*tmax,my+uy*tmax];
  const spread=lo=>{let s=0,s2=0,c=0;const z=.22*len;for(let k=0;k<n;k++){if(lo?T[k]<tmin+z:T[k]>tmax-z){s+=P[k];s2+=P[k]*P[k];c++;}}if(c<2)return 0;const m=s/c;return Math.sqrt(Math.max(0,s2/c-m*m));};
  const lowerIsMin=A[1]>B[1];
  let useMin;
  if(S.tipMode==='lower')useMin=lowerIsMin;
  else if(S.tipMode==='upper')useMin=!lowerIsMin;
  else{const wa=spread(true),wb=spread(false);
    useMin=Math.max(wa,wb)/Math.max(.01,Math.min(wa,wb))<1.25?lowerIsMin:wa<wb;}
  const e=Math.max(1.5,.03*len);let ax=0,ay=0,c=0;
  pix.forEach((i,k)=>{if(useMin?T[k]<tmin+e:T[k]>tmax-e){ax+=i%PW+.5;ay+=((i/PW)|0)+.5;c++;}});
  return{x:ax/c,y:ay/c,ends:[A,B],tipMin:useMin,len};
}
// per-camera state; the status line under the preview shows the most recent message
function setDet(cam,state,text){
  cam.state=state;cam.text=text;
  const states=CAMS.map(c=>c.state);
  const agg=states.includes('blocked')?'bad':states.includes('motion')?'mv':states.some(s=>s==='ready')?'ok':'';
  $('#detDot').className='dot '+agg;
  $('#detText').textContent=CAMS.length>1?`Cam ${CAMS.indexOf(cam)+1}: ${text}`:text;
}
function detectStep(cam,g){
  const D=cam.det;
  if(!D.roi)buildRoi(cam);
  if(!D.ref){D.ref=D.base=D.prev=g;return;}
  const motion=countDiff(cam,g,D.prev,S.diffT);D.prev=g;
  const motionLimit=Math.max(15,D.roiCount*.0012);
  if(motion>motionLimit){D.still=0;D.armed=true;if(cam.state!=='blocked'&&cam.state!=='motion')setDet(cam,'motion','Movement…');return;}
  D.still++;
  if(!D.armed||D.still<S.stableFrames)return;
  D.armed=false;analyzeStable(cam,g);
}
function analyzeStable(cam,g){
  const D=cam.det,maxPix=D.roiCount*.07,now=performance.now();
  // board back to how it looked empty -> darts were pulled
  if(D.onBoard>0&&countDiff(cam,g,D.base,S.diffT)<S.minPix*1.5){
    D.ref=D.base=g;D.onBoard=0;D.blockedSince=0;D.last=null;setDet(cam,'ready','Darts pulled · ready');reportTakeout(cam);return;}
  const[mask,cnt]=diffMask(cam,g,D.ref,S.diffT);
  if(cnt<S.minPix){D.ref=g;D.blockedSince=0;if(D.onBoard===0)D.base=g;setDet(cam,'ready','Ready · throw!');return;}
  if(cnt>maxPix){
    if(!D.blockedSince)D.blockedSince=now;
    if(now-D.blockedSince>4000){D.ref=D.base=g;D.onBoard=0;D.blockedSince=0;setDet(cam,'ready','View reset · ready');reportTakeout(cam);}
    else{setDet(cam,'blocked','View blocked / big change');D.armed=true;D.still=0;}
    return;
  }
  D.blockedSince=0;
  const comp=dartBlob(components(mask,cam.PW,cam.PH),cam.PW);
  if(!comp||comp.length<S.minPix){D.ref=g;return;}
  const tip=refineTip(cam,findTip(comp,cam.PW),g,D.ref);
  D.ref=g;D.onBoard++;
  D.last={pix:comp,tip,ends:tip.ends,t:now};
  if(!cam.cal.H){setDet(cam,'ready','Dart seen, but not calibrated');return;}
  setDet(cam,'ready','Dart seen');
  reportDart(cam,dartReport(cam,tip));
}
// what this camera knows about the dart, in board mm: its tip, and the dart's line on the board
function dartReport(cam,tip){
  const H=cam.cal.H,{PW,PH}=cam,toB=(x,y)=>applyH(H,x/PW,y/PH);
  const t=toB(tip.x,tip.y),dx=toB(tip.x+1,tip.y),dy=toB(tip.x,tip.y+1);
  const mmPerPx=(Math.hypot(dx[0]-t[0],dx[1]-t[1])+Math.hypot(dy[0]-t[0],dy[1]-t[1]))/2;
  const r={tip:t,w:1/(mmPerPx*mmPerPx),dir:null,wl:0};
  if(tip.ends&&tip.len>12){
    const a=toB(...tip.ends[0]),b=toB(...tip.ends[1]),L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    // the projected dart must be long enough on the board for its direction to mean anything
    if(L>15){r.dir=[(b[0]-a[0])/L,(b[1]-a[1])/L];r.wl=r.w*Math.min(2,tip.len/40);}
  }
  return r;
}
