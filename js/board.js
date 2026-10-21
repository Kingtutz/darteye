// DartEye · Board geometry and scoring, realistic board rendering, homography and calibration state
'use strict';

/* ---------- board geometry (mm, y up, angles clockwise from 20) ---------- */
const SEGS=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const R={DB:6.35,SB:15.9,TI:99,TO:107,DI:162,DO:170};
function mk(seg,mult){
  const value=seg*mult;
  const label=mult===0?'MISS':seg===25?(mult===2?'BULL':'25'):(['','','D','T'][mult]+seg);
  return {seg,mult,value,label};
}
function hitAt(x,y){
  const r=Math.hypot(x,y);
  if(r<=R.DB)return mk(25,2);
  if(r<=R.SB)return mk(25,1);
  if(r>R.DO)return mk(0,0);
  const a=(Math.atan2(x,y)*180/Math.PI+369)%360;
  const seg=SEGS[Math.floor(a/18)%20];
  return mk(seg,r>=R.DI?2:(r>=R.TI&&r<=R.TO)?3:1);
}
const rad=d=>d*Math.PI/180;
// draw board in "canvas mm": board point (x, yUp) lives at (x, -yUp)
const TAU=Math.PI*2;
// Realistic board, rendered once per size into an offscreen texture (sisal grain, metal spider, silver numbers, lighting)
const TEX={};
function boardTex(px){
  px=Math.max(256,Math.min(2048,Math.round(px/64)*64));
  if(TEX[px])return TEX[px];
  if(Object.keys(TEX).length>3)for(const k in TEX)delete TEX[k];
  const cv=document.createElement('canvas');cv.width=cv.height=px;
  const c=cv.getContext('2d'),s=px/460;
  c.setTransform(s,0,0,s,px/2,px/2);
  // black surround with a soft bevel at the rim
  let g=c.createRadialGradient(-50,-70,30,0,0,230);g.addColorStop(0,'#262626');g.addColorStop(.75,'#141414');g.addColorStop(1,'#060606');
  c.fillStyle=g;c.beginPath();c.arc(0,0,229.5,0,TAU);c.fill();
  // playing area beds
  const dark='#1e1d1b',light='#ecdfbd',red='#cc1f2a',green='#13874a';
  const wedge=(r0,r1,a0,a1,col)=>{c.beginPath();c.arc(0,0,r1,a0,a1);c.arc(0,0,r0,a1,a0,true);c.closePath();c.fillStyle=col;c.fill();};
  for(let i=0;i<20;i++){
    const a0=rad(i*18-9-90)-.002,a1=rad(i*18+9-90)+.002,ev=i%2===0,sg=ev?dark:light,ring=ev?red:green;
    wedge(R.SB,R.TI,a0,a1,sg);wedge(R.TI,R.TO,a0,a1,ring);wedge(R.TO,R.DI,a0,a1,sg);wedge(R.DI,R.DO,a0,a1,ring);
  }
  c.fillStyle=green;c.beginPath();c.arc(0,0,R.SB,0,TAU);c.fill();
  c.fillStyle=red;c.beginPath();c.arc(0,0,R.DB,0,TAU);c.fill();
  sisalGrain(c,px,s);
  // spider: cast shadow, metal body, specular highlight
  const spider=()=>{
    for(const r of [R.DB,R.SB,R.TI,R.TO,R.DI,R.DO]){c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}
    for(let i=0;i<20;i++){const a=rad(i*18+9);c.beginPath();c.moveTo(R.SB*Math.sin(a),-R.SB*Math.cos(a));c.lineTo(R.DO*Math.sin(a),-R.DO*Math.cos(a));c.stroke();}
  };
  c.save();c.translate(.55,.75);c.strokeStyle='rgba(0,0,0,.55)';c.lineWidth=1.25;spider();c.restore();
  g=c.createLinearGradient(-170,-170,170,170);
  g.addColorStop(0,'#f7f9fb');g.addColorStop(.35,'#b4bac0');g.addColorStop(.6,'#e8ebee');g.addColorStop(1,'#80868d');
  c.strokeStyle=g;c.lineWidth=.95;spider();
  c.save();c.translate(-.18,-.24);c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.3;spider();c.restore();
  // outer wire ring that carries the numbers
  c.strokeStyle=g;c.lineWidth=1.1;c.beginPath();c.arc(0,0,182,0,TAU);c.stroke();
  // silver numbers with a drop shadow
  c.font='900 23px "Arial Black","Helvetica Neue",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<20;i++){
    const a=rad(i*18),x=200*Math.sin(a),y=-200*Math.cos(a);
    c.fillStyle='rgba(0,0,0,.75)';c.fillText(SEGS[i],x+.9,y+1.2);
    const ng=c.createLinearGradient(x,y-11,x,y+11);ng.addColorStop(0,'#ffffff');ng.addColorStop(.5,'#c9ced3');ng.addColorStop(.55,'#9aa1a8');ng.addColorStop(1,'#e9ecef');
    c.fillStyle=ng;c.fillText(SEGS[i],x,y);
  }
  // studio lighting: warm key light top-left, vignette to the rim
  c.save();c.beginPath();c.arc(0,0,229.5,0,TAU);c.clip();
  g=c.createRadialGradient(-90,-120,0,-90,-120,300);g.addColorStop(0,'rgba(255,248,230,.14)');g.addColorStop(1,'rgba(255,248,230,0)');
  c.fillStyle=g;c.fillRect(-230,-230,460,460);
  g=c.createRadialGradient(0,0,150,0,0,230);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.45)');
  c.fillStyle=g;c.fillRect(-230,-230,460,460);
  c.restore();
  g=c.createLinearGradient(-230,-230,230,230);g.addColorStop(0,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(0,0,0,.6)');
  c.strokeStyle=g;c.lineWidth=2;c.beginPath();c.arc(0,0,228.5,0,TAU);c.stroke();
  return TEX[px]=cv;
}
// fibre grain: fine per-pixel speckle plus low-frequency mottling, only inside the scoring area
function sisalGrain(c,px,s){
  let seed=1234567;const rr=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const cell=Math.max(2,Math.round(3*s)),gw=Math.ceil(px/cell)+2,grid=new Float32Array(gw*gw);
  for(let i=0;i<grid.length;i++)grid[i]=rr()-.5;
  const id=c.getImageData(0,0,px,px),d=id.data,h=px/2,lim=(R.DO+.6)*s;
  for(let y=0;y<px;y++){
    const dy=y-h,gy=y/cell,y0=gy|0,fy=gy-y0;
    for(let x=0;x<px;x++){
      const dx=x-h;if(dx*dx+dy*dy>lim*lim)continue;
      const gx=x/cell,x0=gx|0,fx=gx-x0,k=y0*gw+x0;
      const m=(grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+gw]*(1-fx)+grid[k+gw+1]*fx)*fy;
      const j=(y*px+x)*4,lum=d[j]+d[j+1]+d[j+2];
      const n=(rr()-.5)*(lum>360?34:24)+m*20;
      d[j]=Math.max(0,Math.min(255,d[j]+n));d[j+1]=Math.max(0,Math.min(255,d[j+1]+n));d[j+2]=Math.max(0,Math.min(255,d[j+2]+n*.9));
    }
  }
  c.save();c.setTransform(1,0,0,1,0,0);c.putImageData(id,0,0);c.restore();
}
// draw the board in "canvas mm"; the texture resolution follows the current zoom
function drawBoardMM(c){
  const m=c.getTransform(),px=460*Math.hypot(m.a,m.b)*1.25;
  c.imageSmoothingQuality='high';c.drawImage(boardTex(px),-230,-230,460,460);
}
// the board face shown to players: a straightened photo of their own board when we have one
function drawBoardFace(c){
  if(S.boardStyle==='photo'&&PHOTO.img){
    c.save();c.beginPath();c.arc(0,0,229,0,TAU);c.clip();
    c.imageSmoothingQuality='high';c.drawImage(PHOTO.img,-230,-230,460,460);
    const g=c.createRadialGradient(0,0,170,0,0,230);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.4)');
    c.fillStyle=g;c.fillRect(-230,-230,460,460);c.restore();
  }else drawBoardMM(c);
}
function targetPath(c,h){ // outline a target bed in canvas-mm; mult 0 = the whole number
  c.beginPath();
  if(h.seg===25){c.arc(0,0,h.mult===2?R.DB:R.SB,0,Math.PI*2);return;}
  const i=SEGS.indexOf(h.seg),a0=rad(i*18-9-90),a1=rad(i*18+9-90);
  const [r0,r1]=h.mult===0?[R.SB,R.DO]:h.mult===3?[R.TI,R.TO]:h.mult===2?[R.DI,R.DO]:[R.TO,R.DI];
  c.arc(0,0,r1,a0,a1);c.arc(0,0,r0,a1,a0,true);c.closePath();
}

/* ---------- homography ---------- */
function solve(A,b){
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let col=0;col<n;col++){
    let p=col;for(let r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[p][col]))p=r;
    if(Math.abs(M[p][col])<1e-12)return null;
    [M[col],M[p]]=[M[p],M[col]];
    for(let r=0;r<n;r++){if(r===col)continue;const f=M[r][col]/M[col][col];for(let k=col;k<=n;k++)M[r][k]-=f*M[col][k];}
  }
  return M.map((r,i)=>r[n]/r[i]);
}
function homog(src,dst){
  const A=[],b=[];
  for(let i=0;i<4;i++){const[x,y]=src[i],[u,v]=dst[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
  const h=solve(A,b);return h?[...h,1]:null;
}
function applyH(H,x,y){const w=H[6]*x+H[7]*y+H[8];return[(H[0]*x+H[1]*y+H[2])/w,(H[3]*x+H[4]*y+H[5])/w];}
// calibration targets: outer double edge on the 20|1, 6|10, 3|19, 11|14 wires
const CAL_MM=[9,99,189,279].map(a=>[R.DO*Math.sin(rad(a)),R.DO*Math.cos(rad(a))]);
const CAL_NAMES=['where 20 meets 1 (top)','where 6 meets 10 (right)','where 3 meets 19 (bottom)','where 11 meets 14 (left)'];
// each camera keeps its own calibration: see setCal() in camera.js
