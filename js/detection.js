// DartEye · Dart detection: frame differencing, dart blob, tip finding
'use strict';

/* ---------- detection ---------- */
const proc=document.createElement('canvas'),pctx=proc.getContext('2d',{willReadFrequently:true});
let PW=0,PH=0;
const D={ref:null,base:null,prev:null,still:0,armed:false,onBoard:0,blockedSince:0,roi:null,roiCount:0,last:null,state:'idle'};
function resetDetector(){D.ref=D.base=D.prev=null;D.still=0;D.armed=false;D.onBoard=0;D.blockedSince=0;D.last=null;}
function grabGray(){
  const[w,h]=srcSize();if(!w)return null;
  const pw=400,ph=Math.round(400*h/w);
  if(pw!==PW||ph!==PH){PW=pw;PH=ph;proc.width=PW;proc.height=PH;D.roi=null;resetDetector();}
  drawSrc(pctx,0,0,PW,PH);
  const d=pctx.getImageData(0,0,PW,PH).data,n=PW*PH,Y=new Uint8Array(n),C1=new Uint8Array(n),C2=new Uint8Array(n);
  // luma plus two chroma channels: a silver tip on a cream bed barely differs in brightness, but clearly in colour
  for(let i=0,j=0;i<n;i++,j+=4){const r=d[j],g=d[j+1],b=d[j+2];
    Y[i]=(r*77+g*150+b*29)>>8;C1[i]=128+((b-r)>>1);C2[i]=128+((2*g-r-b)>>2);}
  return{y:blur(Y),c1:blur(C1),c2:blur(C2)};
}
function blur(g){ // 3x3 box blur (separable) to suppress sensor noise
  const n=g.length,t=new Uint8Array(n),o=new Uint8Array(n);
  for(let y=0;y<PH;y++){const r=y*PW;for(let x=0;x<PW;x++){const a=x>0?x-1:x,b=x<PW-1?x+1:x;t[r+x]=(g[r+a]+g[r+x]+g[r+b])/3;}}
  for(let y=0;y<PH;y++){const a=(y>0?y-1:y)*PW,b=(y<PH-1?y+1:y)*PW,r=y*PW;for(let x=0;x<PW;x++)o[r+x]=(t[a+x]+t[r+x]+t[b+x])/3;}
  return o;
}
function buildRoi(){
  const roi=new Uint8Array(PW*PH);let c=0;
  for(let y=0;y<PH;y++)for(let x=0;x<PW;x++){
    let ok=1;
    if(CAL.H){const[bx,by]=applyH(CAL.H,(x+.5)/PW,(y+.5)/PH);ok=Math.hypot(bx,by)<300?1:0;}
    roi[y*PW+x]=ok;c+=ok;
  }
  D.roi=roi;D.roiCount=c;
}
function pxDiff(a,b,i){return Math.max(Math.abs(a.y[i]-b.y[i]),Math.abs(a.c1[i]-b.c1[i])*1.6,Math.abs(a.c2[i]-b.c2[i])*1.6);}
function countDiff(a,b,T){const roi=D.roi,n=a.y.length;let c=0;for(let i=0;i<n;i++)if(roi[i]&&pxDiff(a,b,i)>T)c++;return c;}
function diffMask(a,b,T){const roi=D.roi,n=a.y.length,m=new Uint8Array(n);let c=0;for(let i=0;i<n;i++)if(roi[i]&&pxDiff(a,b,i)>T){m[i]=1;c++;}return[m,c];}
// one dart lands per stable event, so gather every nearby fragment (barrel, shaft, flight split by same-coloured background)
function dartBlob(comps){
  const big=comps[0];if(!big)return null;
  const cen=p=>{let x=0,y=0;for(const i of p){x+=i%PW;y+=(i/PW)|0;}return[x/p.length,y/p.length];};
  const[bx,by]=cen(big),lim=PW*.16,out=big.slice();
  for(let k=1;k<comps.length;k++){const p=comps[k];if(p.length<4)break;const[x,y]=cen(p);if(Math.hypot(x-bx,y-by)<lim)for(const i of p)out.push(i);}
  return out;
}
// walk past the detected end while there is still a faint change: recovers thin steel points
function refineTip(tip,g,ref){
  if(!tip.ends)return tip;
  const[A,B]=tip.ends,from=tip.tipMin?B:A,to=tip.tipMin?A:B,L=Math.hypot(to[0]-from[0],to[1]-from[1]);
  const ux=(to[0]-from[0])/L,uy=(to[1]-from[1])/L;let good=0;
  for(let s=1;s<=14;s++){let hit=false;
    for(let o=-1;o<=1&&!hit;o++){const x=Math.round(tip.x+ux*s-uy*o-.5),y=Math.round(tip.y+uy*s+ux*o-.5);
      if(x>=0&&y>=0&&x<PW&&y<PH&&pxDiff(g,ref,y*PW+x)>S.diffT*.45)hit=true;}
    if(hit)good=s;else if(s-good>2)break;}
  return Object.assign({},tip,{x:tip.x+ux*good,y:tip.y+uy*good});
}
function components(mask){
  const W=PW,H=PH,n=W*H,dil=new Uint8Array(n),rr=2;
  for(let i=0;i<n;i++)if(mask[i]){const x=i%W,y=(i/W)|0;
    for(let dy=-rr;dy<=rr;dy++){const yy=y+dy;if(yy<0||yy>=H)continue;for(let dx=-rr;dx<=rr;dx++){const xx=x+dx;if(xx>=0&&xx<W)dil[yy*W+xx]=1;}}}
  const lab=new Int32Array(n),comps=[];let id=0;
  for(let i=0;i<n;i++){if(!dil[i]||lab[i])continue;id++;const st=[i],pix=[];lab[i]=id;
    while(st.length){const k=st.pop();if(mask[k])pix.push(k);const x=k%W,y=(k/W)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const q=yy*W+xx;if(dil[q]&&!lab[q]){lab[q]=id;st.push(q);}}}
    comps.push(pix);}
  return comps.sort((a,b)=>b.length-a.length);
}
function findTip(pix){
  const n=pix.length;let mx=0,my=0;
  for(const i of pix){mx+=i%PW+.5;my+=((i/PW)|0)+.5;}mx/=n;my/=n;
  let sxx=0,syy=0,sxy=0;
  for(const i of pix){const dx=i%PW+.5-mx,dy=((i/PW)|0)+.5-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}
  const th=.5*Math.atan2(2*sxy,sxx-syy),ux=Math.cos(th),uy=Math.sin(th);
  const T=new Float32Array(n),P=new Float32Array(n);let tmin=1e9,tmax=-1e9;
  pix.forEach((i,k)=>{const dx=i%PW+.5-mx,dy=((i/PW)|0)+.5-my;T[k]=dx*ux+dy*uy;P[k]=-dx*uy+dy*ux;if(T[k]<tmin)tmin=T[k];if(T[k]>tmax)tmax=T[k];});
  const len=tmax-tmin;
  if(len<5)return{x:mx,y:my,ends:null};
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
  return{x:ax/c,y:ay/c,ends:[A,B],tipMin:useMin};
}
function setDet(state,text){D.state=state;$('#detDot').className='dot '+({ready:'ok',motion:'mv',blocked:'bad',idle:''}[state]||'');$('#detText').textContent=text;}
function detectStep(g){
  if(!D.roi)buildRoi();
  if(!D.ref){D.ref=D.base=D.prev=g;return;}
  const motion=countDiff(g,D.prev,S.diffT);D.prev=g;
  const motionLimit=Math.max(15,D.roiCount*.0012);
  if(motion>motionLimit){D.still=0;D.armed=true;if(D.state!=='blocked')setDet('motion','Movement…');return;}
  D.still++;
  if(!D.armed||D.still<S.stableFrames)return;
  D.armed=false;analyzeStable(g);
}
function analyzeStable(g){
  const maxPix=D.roiCount*.07,now=performance.now();
  // board back to how it looked empty -> darts were pulled
  if(D.onBoard>0&&countDiff(g,D.base,S.diffT)<S.minPix*1.5){
    D.ref=D.base=g;D.onBoard=0;D.blockedSince=0;D.last=null;setDet('ready','Darts pulled · ready');onTakeout();return;}
  const[mask,cnt]=diffMask(g,D.ref,S.diffT);
  if(cnt<S.minPix){D.ref=g;D.blockedSince=0;if(D.onBoard===0)D.base=g;setDet('ready','Ready · throw!');return;}
  if(cnt>maxPix){
    if(!D.blockedSince)D.blockedSince=now;
    if(now-D.blockedSince>4000){D.ref=D.base=g;D.onBoard=0;D.blockedSince=0;setDet('ready','View reset · ready');onTakeout();}
    else{setDet('blocked','View blocked / big change');D.armed=true;D.still=0;}
    return;
  }
  D.blockedSince=0;
  const comp=dartBlob(components(mask));
  if(!comp||comp.length<S.minPix){D.ref=g;return;}
  const tip=refineTip(findTip(comp),g,D.ref);
  D.ref=g;D.onBoard++;
  D.last={pix:comp,tip,ends:tip.ends,t:now};
  if(!CAL.H){setDet('ready','Dart seen, but not calibrated');return;}
  const[bx,by]=applyH(CAL.H,tip.x/PW,tip.y/PH);
  const h=hitAt(bx,by);
  setDet('ready','Dart: '+h.label);
  onAutoDart(h,{x:bx,y:by});
}
