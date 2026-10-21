// DartEye · Simulated cameras: one virtual board and its darts, seen from up to three angles (testing without hardware)
'use strict';

/* ---------- simulator (for testing without a board) ---------- */
// Each view is an affine camera: board mm (x, y up) -> image px, plus zx/zy = image px per mm a point stands off the
// board. Darts are real 3D lines, so each view sees them leaning a different way, like real cameras would.
const SIM_VIEWS=[
  {name:'Simulator · right',a:.95,b:-.16,c:.07,d:.70,cx:322,cy:246,zx:.42,zy:-.91},
  {name:'Simulator · left',a:.90,b:.20,c:-.10,d:.68,cx:318,cy:240,zx:-.55,zy:-.80},
  {name:'Simulator · below',a:1.02,b:.02,c:.01,d:.58,cx:320,cy:225,zx:.06,zy:.92},
];
const SIM={
  W:640,H:480,darts:[],hand:0,
  view(i){
    const v=SIM_VIEWS[i];
    if(!v.canvas){v.canvas=document.createElement('canvas');v.canvas.width=this.W;v.canvas.height=this.H;v.ctx=v.canvas.getContext('2d');}
    return v;
  },
  map(v,x,y,z=0){return[v.a*x-v.b*y+v.cx+v.zx*z,v.c*x-v.d*y+v.cy+v.zy*z];},
  calPts(v){return CAL_MM.map(([x,y])=>{const[u,w]=this.map(v,x,y);return[u/this.W,w/this.H];});},
  // a dart leans a little: tail slightly up and to a random side
  throwAt(x,y){this.darts.push({x,y,lx:(Math.random()-.5)*.3,ly:.05+Math.random()*.15,wob:9});return{x,y};},
  pull(){this.hand=30;},
  tick(){ // shared animation state, advanced once per frame for all views
    for(const d of this.darts)if(d.wob>0)d.wob--;
    if(this.hand>0){if(this.hand===14)this.darts=[];this.hand--;}
  },
  render(v){
    const c=v.ctx;c.setTransform(1,0,0,1,0,0);
    const g=c.createLinearGradient(0,0,0,this.H);g.addColorStop(0,'#3d4650');g.addColorStop(1,'#2a3038');
    c.fillStyle=g;c.fillRect(0,0,this.W,this.H);
    c.setTransform(v.a,v.c,v.b,v.d,v.cx,v.cy);drawBoardMM(c);
    c.setTransform(1,0,0,1,0,0);
    for(const d of this.darts)this.drawDart(c,v,d);
    if(this.hand>0){ // a hand sweeping across in front of the board
      const t=this.hand/30,[x,y]=this.map(v,-220+440*(1-t),30*Math.sin(t*6),160);
      c.fillStyle='#c79b7c';c.beginPath();c.ellipse(x,y,90,60,-.4,0,Math.PI*2);c.fill();
      c.fillRect(x+40,y,260,70);
    }
    for(let i=0;i<40;i++){c.fillStyle=Math.random()<.5?'#000':'#fff';c.fillRect(Math.random()*this.W,Math.random()*this.H,1,1);}
  },
  drawDart(c,v,d){
    const lx=d.lx+(d.wob>0?Math.sin(d.wob*1.9)*.16:0),ly=d.ly;
    const at=t=>this.map(v,d.x+lx*t,d.y+ly*t,t);
    const[tx,ty]=at(0),[ex,ey]=at(84),L=Math.hypot(ex-tx,ey-ty)||1,ux=(ex-tx)/L,uy=(ey-ty)/L,px=-uy,py=ux;
    const P=(t,s=0)=>{const[x,y]=at(t);return[x+px*s,y+py*s];};
    const seg=(t0,t1,w,col)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(...P(t0));c.lineTo(...P(t1));c.stroke();};
    seg(0,8,1.8,'#d8dde2');seg(8,34,5.5,'#6b7178');seg(34,56,2.6,'#101215');
    c.fillStyle='#16c0e8';c.beginPath();c.moveTo(...P(52));c.lineTo(...P(64,10));c.lineTo(...P(84,10));c.lineTo(...P(84,-10));c.lineTo(...P(64,-10));c.closePath();c.fill();
  }
};
