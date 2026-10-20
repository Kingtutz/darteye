// DartEye · Simulated camera: renders a board at an angle and throws virtual darts (testing without hardware)
'use strict';

/* ---------- simulator camera (for testing without a board) ---------- */
const SIM={
  W:640,H:480,a:.95,b:-.16,c:.07,d:.70,cx:322,cy:246,darts:[],hand:0,
  init(){this.canvas=document.createElement('canvas');this.canvas.width=this.W;this.canvas.height=this.H;this.ctx=this.canvas.getContext('2d');},
  map(x,y){return[this.a*x-this.b*y+this.cx,this.c*x-this.d*y+this.cy];},
  calPts(){return CAL_MM.map(([x,y])=>{const[u,v]=this.map(x,y);return[u/this.W,v/this.H];});},
  throwAt(x,y){this.darts.push({x,y,wob:9});return{x,y};},
  pull(){this.hand=30;},
  render(){
    const c=this.ctx;c.setTransform(1,0,0,1,0,0);
    const g=c.createLinearGradient(0,0,0,this.H);g.addColorStop(0,'#3d4650');g.addColorStop(1,'#2a3038');
    c.fillStyle=g;c.fillRect(0,0,this.W,this.H);
    c.setTransform(this.a,this.c,this.b,this.d,this.cx,this.cy);drawBoardMM(c);
    c.setTransform(1,0,0,1,0,0);
    for(const d of this.darts)this.drawDart(c,d);
    if(this.hand>0){
      const t=this.hand/30,x=120+420*(1-t),y=230+40*Math.sin(t*6);
      c.fillStyle='#c79b7c';c.beginPath();c.ellipse(x,y,90,60,-.4,0,Math.PI*2);c.fill();
      c.fillRect(x+40,y,260,70);
      if(this.hand===14)this.darts=[];
      this.hand--;
    }
    for(let i=0;i<40;i++){c.fillStyle=Math.random()<.5?'#000':'#fff';c.fillRect(Math.random()*this.W,Math.random()*this.H,1,1);}
  },
  drawDart(c,d){
    const[tx,ty]=this.map(d.x,d.y);
    let ang=Math.atan2(-.9,.42);
    if(d.wob>0){ang+=Math.sin(d.wob*1.9)*.16;d.wob--;}
    const ux=Math.cos(ang),uy=Math.sin(ang),px=-uy,py=ux,P=(t,s=0)=>[tx+ux*t+px*s,ty+uy*t+py*s];
    const seg=(t0,t1,w,col)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(...P(t0));c.lineTo(...P(t1));c.stroke();};
    seg(0,8,1.8,'#d8dde2');seg(8,34,5.5,'#6b7178');seg(34,56,2.6,'#101215');
    c.fillStyle='#16c0e8';c.beginPath();c.moveTo(...P(52));c.lineTo(...P(64,10));c.lineTo(...P(84,10));c.lineTo(...P(84,-10));c.lineTo(...P(64,-10));c.closePath();c.fill();
  }
};
SIM.init();
