// DartEye · Combines what every camera saw of a dart into one tip position
'use strict';

/* ---------- multi-camera fusion ---------- */
// Each camera reports the tip it found plus the dart's line projected onto the board. The dart body stands off the
// board, so that line runs from the tip away from the camera; lines from different angles cross at the tip. That
// removes one camera's main error: not knowing exactly where the thin point ends along the dart.
const FUSE={pending:null,last:null,log:[]};
const FUSE_WAIT=650;   // ms to wait for the other cameras to settle after the first one reports
const TIP_PULL=.06;    // how strongly each camera's own tip estimate pulls on the crossing point

function liveSources(){
  return CAMS.filter(c=>c.cal.H&&c.state!=='lost').concat(typeof HELPERS!=='undefined'?HELPERS.filter(h=>h.ready):[]);
}
const helperMode=()=>typeof HELPER!=='undefined'&&HELPER.on;
function reportDart(src,r){
  if(helperMode()){helperSend({t:'dart',tip:r.tip,dir:r.dir,w:r.w,wl:r.wl});return;} // a phone passes it on
  const P=FUSE.pending||(FUSE.pending={reports:new Map(),timer:setTimeout(fuseNow,FUSE_WAIT)});
  P.reports.set(src.key,Object.assign({},r,{src}));
  if(P.reports.size>=liveSources().length)fuseNow();
}
function reportTakeout(src){if(helperMode()){helperSend({t:'takeout'});return;}fuseNow();onTakeout();}
function fuseNow(){
  const P=FUSE.pending;if(!P)return;
  clearTimeout(P.timer);FUSE.pending=null;
  const R=[...P.reports.values()];if(!R.length)return;
  const pt=fusePoint(R);
  FUSE.last={pt,reports:R,t:performance.now()};
  FUSE.seq=(FUSE.seq||0)+1;FUSE.log.push(FUSE.last);if(FUSE.log.length>20)FUSE.log.shift();
  const h=hitAt(pt[0],pt[1]);
  $('#detText').textContent=`Dart: ${h.label}${R.length>1?` · ${R.length} cameras`:''}`;
  onAutoDart(h,{x:pt[0],y:pt[1]});
}
const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
function offLine(x,r){ // distance from x to the camera's dart line (or its tip, if it has no line)
  if(!r.dir)return dist(x,r.tip);
  return Math.abs(-r.dir[1]*(x[0]-r.tip[0])+r.dir[0]*(x[1]-r.tip[1]));
}
// weighted least squares: the point closest to these cameras' lines, pulled gently toward the tips that are
// near it (a camera that picked the wrong end of the dart still has the right line, but its tip mustn't pull)
function crossLines(R,near){
  let a=0,b=0,c=0,u=0,v=0;
  for(const r of R){
    if(r.dir){const nx=-r.dir[1],ny=r.dir[0],w=r.wl,k=w*(nx*r.tip[0]+ny*r.tip[1]);
      a+=w*nx*nx;b+=w*nx*ny;c+=w*ny*ny;u+=k*nx;v+=k*ny;}
    if(!near||dist(near,r.tip)<15){const wt=r.w*(r.dir?TIP_PULL:1);a+=wt;c+=wt;u+=wt*r.tip[0];v+=wt*r.tip[1];}
  }
  const det=a*c-b*b;
  return Math.abs(det)<1e-12?null:[(c*u-b*v)/det,(a*v-b*u)/det];
}
function meet(p,q){ // where two cameras' lines cross, if they cross at a useful angle (≥ 20°)
  const s=p.dir[0]*q.dir[1]-p.dir[1]*q.dir[0];if(Math.abs(s)<.34)return null;
  const t=((q.tip[0]-p.tip[0])*q.dir[1]-(q.tip[1]-p.tip[1])*q.dir[0])/s;
  return[p.tip[0]+t*p.dir[0],p.tip[1]+t*p.dir[1]];
}
// Vote: every camera's tip and every crossing of two lines is a candidate. A candidate earns a vote for each camera
// whose line passes within 5 mm of it, and another for each camera whose own tip is within 12 mm. (Two lines
// always cross somewhere, so a crossing needs tips nearby too.) The winner is refined on the cameras that agree.
// This shrugs off a camera that picked the wrong end of the dart or saw a shadow.
function fusePoint(R){
  if(R.length===1)return R[0].tip;
  const cands=R.map(r=>r.tip),L=R.filter(r=>r.dir);
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const x=meet(L[i],L[j]);if(x&&Math.hypot(...x)<240)cands.push(x);}
  let best=null;
  for(const x of cands){
    const agree=R.filter(r=>offLine(x,r)<(r.dir?5:10)),tips=R.filter(r=>dist(x,r.tip)<12).length;
    const votes=agree.length+tips,err=sum(agree.map(r=>offLine(x,r)));
    if(!best||votes>best.votes||(votes===best.votes&&err<best.err))best={x,agree,votes,err};
  }
  if(best.agree.length<2){ // nobody agrees: trust the camera with the sharpest view
    return R.reduce((p,q)=>q.w*(1+q.wl)>p.w*(1+p.wl)?q:p).tip;
  }
  return crossLines(best.agree,best.x)||best.x;
}
