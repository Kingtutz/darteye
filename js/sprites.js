// DartEye · Vector sprites: darts, zombies, asteroids, badges, trees
'use strict';

/* ---------- sprites (vector art in board mm, so they stay sharp on a big TV) ---------- */
function softShadow(c,x,y,rx,ry){c.fillStyle='rgba(0,0,0,.45)';c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function glow(c,x,y,r,col){const g=c.createRadialGradient(x,y,r*.4,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
function drawZombie(c,x,y,r,danger){
  c.save();c.translate(x,y);
  if(danger)glow(c,0,0,r*1.8,'rgba(255,40,60,.55)');
  softShadow(c,r*.15,r*1.02,r*.75,r*.22);
  // ragged shirt collar
  c.fillStyle='#4a3b2c';c.beginPath();c.moveTo(-r*.75,r*.95);c.quadraticCurveTo(0,r*.55,r*.75,r*.95);c.lineTo(r*.55,r*1.1);c.lineTo(-r*.55,r*1.1);c.closePath();c.fill();
  // head
  let g=c.createRadialGradient(-r*.3,-r*.45,r*.1,0,0,r*1.05);g.addColorStop(0,'#b9e09a');g.addColorStop(.55,'#73a35b');g.addColorStop(1,'#33532b');
  c.fillStyle=g;c.beginPath();c.ellipse(0,0,r*.8,r*.98,0,0,TAU);c.fill();
  c.lineWidth=r*.07;c.strokeStyle='#1a2a15';c.stroke();
  // rot patches + stitched scar
  c.fillStyle='rgba(70,100,45,.75)';c.beginPath();c.ellipse(r*.38,-r*.42,r*.2,r*.13,.5,0,TAU);c.fill();
  c.beginPath();c.ellipse(-r*.42,r*.3,r*.13,r*.09,-.3,0,TAU);c.fill();
  c.strokeStyle='#2b1a12';c.lineWidth=r*.05;c.beginPath();c.moveTo(-r*.5,-r*.6);c.lineTo(r*.05,-r*.72);c.stroke();
  for(let i=0;i<4;i++){const t=i/3,sx=-r*.5+t*r*.55,sy=-r*.6-t*r*.12;c.beginPath();c.moveTo(sx,sy-r*.08);c.lineTo(sx,sy+r*.08);c.stroke();}
  // messy hair
  c.strokeStyle='#2a1f14';c.lineWidth=r*.09;c.lineCap='round';
  for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*r*.17,-r*.9);c.quadraticCurveTo(i*r*.25,-r*1.1,i*r*.2+r*.08,-r*1.18);c.stroke();}
  // eyes: sunken sockets, mismatched eyeballs
  for(const[ex,er]of[[-r*.3,r*.21],[r*.29,r*.16]]){
    c.fillStyle='#1b2614';c.beginPath();c.arc(ex,-r*.12,er*1.3,0,TAU);c.fill();
    c.fillStyle='#f1ecd0';c.beginPath();c.arc(ex,-r*.12,er,0,TAU);c.fill();
    c.fillStyle=danger?'#ff1f3a':'#b8282b';c.beginPath();c.arc(ex+er*.25,-r*.09,er*.45,0,TAU);c.fill();
  }
  // gaping mouth with teeth
  c.fillStyle='#2b0d0d';c.beginPath();c.ellipse(0,r*.46,r*.36,r*.2,0,0,TAU);c.fill();
  c.fillStyle='#e9e2c2';for(let i=-2;i<=2;i++)if(i!==1)c.fillRect(i*r*.12-r*.045,r*.3,r*.09,r*.11);
  c.restore();
}
function drawAsteroid(c,x,y,r,seed,danger){
  c.save();c.translate(x,y);
  let s=seed*9301+49297;const rr=()=>{s=(s*9301+49297)%233280;return s/233280;};
  if(danger){ // burning up: flame trail pointing outward
    const a=Math.atan2(y,x);c.save();c.rotate(a);
    const fg=c.createLinearGradient(0,0,r*2.6,0);fg.addColorStop(0,'rgba(255,200,60,.9)');fg.addColorStop(.5,'rgba(255,90,30,.6)');fg.addColorStop(1,'rgba(255,40,20,0)');
    c.fillStyle=fg;c.beginPath();c.moveTo(0,-r*.8);c.quadraticCurveTo(r*1.6,-r*.5,r*2.6,0);c.quadraticCurveTo(r*1.6,r*.5,0,r*.8);c.fill();c.restore();
    glow(c,0,0,r*1.6,'rgba(255,120,40,.55)');
  }
  softShadow(c,r*.25,r*.3,r,r*.85);
  c.beginPath();
  for(let i=0;i<12;i++){const a=i/12*TAU,k=r*(.78+rr()*.27);i?c.lineTo(k*Math.cos(a),k*Math.sin(a)):c.moveTo(k*Math.cos(a),k*Math.sin(a));}
  c.closePath();
  const g=c.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r*1.1);g.addColorStop(0,'#b7aa9c');g.addColorStop(.5,'#7a6e62');g.addColorStop(1,'#3a332d');
  c.fillStyle=g;c.fill();c.lineWidth=r*.06;c.strokeStyle='#241f1b';c.stroke();
  for(let i=0;i<4;i++){
    const a=rr()*TAU,d=rr()*r*.5,cx=d*Math.cos(a),cy=d*Math.sin(a),cr=r*(.12+rr()*.14);
    c.fillStyle='rgba(30,25,20,.55)';c.beginPath();c.arc(cx,cy,cr,0,TAU);c.fill();
    c.strokeStyle='rgba(220,210,195,.45)';c.lineWidth=r*.04;c.beginPath();c.arc(cx,cy,cr,Math.PI*.9,Math.PI*1.7);c.stroke();
  }
  c.restore();
}
function drawEarth(c,r){
  glow(c,0,0,r*1.55,'rgba(90,170,255,.55)');
  c.save();c.beginPath();c.arc(0,0,r,0,TAU);c.clip();
  let g=c.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r);g.addColorStop(0,'#5fb6ff');g.addColorStop(.7,'#1f5fbf');g.addColorStop(1,'#0b2a66');
  c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);
  c.fillStyle='#3f9a4a';
  for(const[px,py,rx,ry,t]of[[-.35,-.25,.35,.22,.4],[.3,.15,.28,.4,-.3],[-.1,.5,.25,.14,.1],[.45,-.5,.18,.12,.8]]){c.beginPath();c.ellipse(px*r,py*r,rx*r,ry*r,t,0,TAU);c.fill();}
  c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.ellipse(-r*.1,-r*.6,r*.5,r*.08,.2,0,TAU);c.fill();
  g=c.createRadialGradient(r*.4,r*.4,r*.2,0,0,r*1.2);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,20,.55)');c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);
  c.restore();
}
function drawCabin(c,r){
  c.save();
  glow(c,0,0,r*1.6,'rgba(255,200,90,.35)');
  softShadow(c,r*.1,r*.75,r*.95,r*.2);
  c.fillStyle='#6b4628';c.fillRect(-r*.75,-r*.1,r*1.5,r*.85);
  c.strokeStyle='rgba(30,18,8,.6)';c.lineWidth=r*.05;for(let i=0;i<4;i++){c.beginPath();c.moveTo(-r*.75,r*(.1+i*.2));c.lineTo(r*.75,r*(.1+i*.2));c.stroke();}
  c.fillStyle='#4a4f57';c.fillRect(r*.3,-r*.85,r*.2,r*.45);
  c.fillStyle='#a8322d';c.beginPath();c.moveTo(-r*.95,-r*.05);c.lineTo(0,-r*.85);c.lineTo(r*.95,-r*.05);c.closePath();c.fill();
  c.fillStyle='#ffd86b';c.fillRect(-r*.5,r*.1,r*.32,r*.28);
  c.fillStyle='#3a2414';c.fillRect(r*.12,r*.2,r*.32,r*.55);
  c.restore();
}
function drawBadge(c,x,y,r,text,killer,active){
  c.save();c.translate(x,y);
  if(active)glow(c,0,0,r*1.7,'rgba(255,194,75,.5)');
  softShadow(c,r*.12,r*.18,r,r);
  if(killer){ // sheriff star
    c.beginPath();for(let i=0;i<12;i++){const a=i/12*TAU-Math.PI/2,k=i%2?r*.55:r;i?c.lineTo(k*Math.cos(a),k*Math.sin(a)):c.moveTo(k*Math.cos(a),k*Math.sin(a));}c.closePath();
    const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#fff1a8');g.addColorStop(.5,'#e3a922');g.addColorStop(1,'#8a5a0a');
    c.fillStyle=g;c.fill();c.lineWidth=r*.06;c.strokeStyle='#5a3a06';c.stroke();
    for(let i=0;i<6;i++){const a=i/6*TAU-Math.PI/2;c.fillStyle='#ffe27a';c.beginPath();c.arc(r*Math.cos(a),r*Math.sin(a),r*.13,0,TAU);c.fill();}
    c.fillStyle='#3d2604';
  }else{ // wooden token
    const g=c.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);g.addColorStop(0,'#c8925a');g.addColorStop(1,'#6b3f1d');
    c.fillStyle=g;c.beginPath();c.arc(0,0,r*.85,0,TAU);c.fill();c.lineWidth=r*.08;c.strokeStyle='#3b2210';c.stroke();
    c.fillStyle='#fff';
  }
  c.font=`900 ${r*.62}px system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,0,r*.04);
  c.restore();
}
function drawTree(c,x,y,r,cut){
  c.save();c.translate(x,y);
  glow(c,0,0,r*1.5,'rgba(255,194,75,.35)');
  softShadow(c,r*.1,r*.85,r*.6,r*.15);
  c.fillStyle='#5a3a1e';c.fillRect(-r*.12,r*.35,r*.24,r*.5);
  const tiers=[[r*.55,r*.7,r*.2],[r*.45,r*.3,-r*.2],[r*.33,-r*.08,-r*.6],[r*.2,-r*.45,-r*.95]];
  tiers.forEach(([w,base,top],i)=>{
    const g=c.createLinearGradient(-w,0,w,0);g.addColorStop(0,'#2f7d3a');g.addColorStop(1,'#14481f');
    c.fillStyle=g;c.beginPath();c.moveTo(-w,base);c.lineTo(0,top);c.lineTo(w,base);c.closePath();c.fill();
  });
  // axe stuck in the trunk shows progress
  c.strokeStyle='#7a4b22';c.lineWidth=r*.08;c.beginPath();c.moveTo(r*.15,r*.55);c.lineTo(r*.75,r*.05);c.stroke();
  c.fillStyle='#cfd5da';c.beginPath();c.moveTo(r*.65,-r*.1);c.lineTo(r*.95,r*.05);c.lineTo(r*.8,r*.25);c.closePath();c.fill();
  if(cut>0){c.fillStyle='rgba(0,0,0,.6)';c.fillRect(-r*.5,r*1.0,r,r*.12);c.fillStyle='#ffc24b';c.fillRect(-r*.5,r*1.0,r*Math.min(1,cut),r*.12);}
  c.restore();
}
function hpBadge(c,x,y,n){
  c.beginPath();c.arc(x,y,6.5,0,TAU);c.fillStyle='#ffc24b';c.fill();c.lineWidth=1;c.strokeStyle='#5a3a06';c.stroke();
  c.font='900 9px system-ui';c.fillStyle='#000';c.textAlign='center';c.textBaseline='middle';c.fillText(n,x,y+.5);
}
// a dart stuck in the board, seen from the front: it leans up and to the left towards the viewer, with its
// shadow falling on the board. The steel point sits exactly on the hit (0,0).
function drawDartMarker(c,x,y,n,selected,showNum){
  const ux=-.42,uy=-.91,px=-uy,py=ux;          // along the dart (towards the flight), and across it
  const P=(t,s=0)=>[ux*t+px*s,uy*t+py*s];
  const quad=(pts,fill)=>{c.beginPath();pts.forEach((q,k)=>k?c.lineTo(...q):c.moveTo(...q));c.closePath();c.fillStyle=fill;c.fill();};
  const seg=(t0,t1,w,col)=>{c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(...P(t0));c.lineTo(...P(t1));c.stroke();};
  c.save();c.translate(x,y);c.scale(1.35,1.35); // about a quarter of the board long, like a real dart
  if(selected)glow(c,0,0,12,'rgba(245,130,32,.75)');
  // shadow on the board, cast down and to the right
  c.save();c.translate(5,6);c.globalAlpha=.32;
  seg(4,32,4,'#000');quad([P(36,0),P(44,-8),P(60,-9),P(60,9),P(44,8)],'#000');
  c.restore();
  seg(0,10,1.3,'#c9ced3');                     // steel point
  const bg=c.createLinearGradient(...P(10,-2),...P(10,2));bg.addColorStop(0,'#9aa0a6');bg.addColorStop(.45,'#4a4f55');bg.addColorStop(1,'#1f2226');
  seg(10,30,4.2,bg);                           // tungsten barrel
  for(const t of[13,15.5,18])seg(t,t+.6,4.4,'#14171a'); // grip rings
  seg(23,25,4.4,'#f58220');                    // orange band
  seg(30,40,2,'#111');                         // shaft
  // flights: two wings seen at an angle, black with orange trim
  quad([P(36,0),P(43,-7.5),P(58,-8.5),P(58,0)],'#111');
  quad([P(36,0),P(43,7.5),P(58,8.5),P(58,0)],'#1b1b1b');
  quad([P(43,-7.5),P(58,-8.5),P(58,-6.8),P(44.5,-6)],'#f58220');
  quad([P(43,7.5),P(58,8.5),P(58,6.8),P(44.5,6)],'#f58220');
  c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=.4;c.beginPath();c.moveTo(...P(36,0));c.lineTo(...P(58,0));c.stroke();
  if(showNum){ // while correcting, number the darts so you can see which tile is which
    const[bx,by]=P(62,0);c.beginPath();c.arc(bx,by,5.5,0,TAU);c.fillStyle=selected?'#f58220':'rgba(0,0,0,.85)';c.fill();
    c.fillStyle='#fff';c.font='700 8px "Barlow Condensed",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(n,bx,by+.5);
  }
  c.restore();
}
