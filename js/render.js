// DartEye · Scoreboard, board view and camera preview drawing
'use strict';

/* ---------- rendering ---------- */
function render(){renderPlayers();renderTurn();drawBoardView();renderHint();}
function tScore(g){const M=MODE(g);return M.turnScore?M.turnScore(g):sum(g.turn.darts.map(h=>h.value));}
function tText(g){const M=MODE(g);return g.turn.bust?'BUST':M.turnText?M.turnText(g):tScore(g);}
function peekNext(g){const n=g.players.length;for(let k=1;k<=n;k++){const p=g.players[(g.cur+k)%n];if(!p.out&&!p.done)return p;}return null;}
function renderPlayers(){
  const M=MODE(G),el=$('#players');
  el.classList.toggle('many',G.players.length>3);
  el.innerHTML=G.players.map((p,i)=>{
    const last=p.turns.length?p.turns[p.turns.length-1]:'–';
    const st=(M.stats?M.stats(G,p):[]).concat([['Last',last],['Darts',p.darts]]);
    return `<div class="pcard ${i===G.cur&&!G.result?'active':''} ${p.out||p.done?'out':''}">
      <div class="pname"><span>${esc(p.name)}</span>${p.legs?`<span class="legs">${p.legs} win${p.legs>1?'s':''}</span>`:''}</div>
      <div class="pscore">${M.big(G,p)}</div>${M.sub?M.sub(G,p,i):''}
      <div class="pstats">${st.map(([k,v])=>`<span>${k} <b>${v}</b></span>`).join('')}</div>
    </div>`;}).join('');
  const a=el.querySelector('.active');if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest'});
}
function renderTurn(){
  const d=G.turn.darts;
  $$('.slot').forEach((el,i)=>{const h=d[i];
    el.classList.toggle('sel',sel===i);el.classList.toggle('filled',!!h);el.classList.toggle('auto',!!(h&&h.auto));
    el.innerHTML=h?`<b>${h.bo?'B/O':h.label}</b><small>${h.value}</small>`:'<b>–</b><small>&nbsp;</small>';});
  const tt=$('#turnTotal');tt.textContent=tText(G);tt.className='ttotal'+(G.turn.bust?' bust':'');
  const over=turnOver(G)&&!G.result;
  $('#turnMsg').textContent=sel!==null?`Tap the board where dart ${sel+1} really landed (or press Miss)`:over?'Pull your darts, then Next ▶':'';
  $('#btnNext').classList.toggle('pulse',over);
}
let BV={cx:0,cy:0,sc:1};
function drawBoardView(){
  const cv=$('#board'),r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  const c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);
  const sc=Math.min(w,h)/2/230;BV={cx:r.width/2,cy:r.height/2,sc:sc/dpr};
  c.setTransform(sc,0,0,sc,w/2,h/2);drawBoardFace(c);
  const M=MODE(G),tg=G.result?[]:(M.targets?M.targets(G):[]);
  for(const t of tg){
    targetPath(c,t);
    c.strokeStyle='#ffc24b';c.lineWidth=tg.length>3?2:3.2;c.shadowColor='#ffc24b';c.shadowBlur=tg.length>3?6:12;c.stroke();c.shadowBlur=0;
    c.fillStyle='rgba(255,194,75,.14)';c.fill();
  }
  if(M.draw)M.draw(c,G);
  G.turn.darts.forEach((d,i)=>{if(d.pos)drawDartMarker(c,d.pos.x,-d.pos.y,i+1,sel===i?'#ffc24b':d.auto?'#16c0e8':'#ff4d5e',sel===i);});
}
function renderHint(){
  const el=$('#checkout'),M=MODE(G);
  if(G.result){el.innerHTML='';return;}
  if(turnOver(G)){const n=peekNext(G);el.innerHTML=n&&G.players.length>1?`${lbl('Up next')} <b>${esc(n.name)}</b>`:lbl('Pull your darts');return;}
  el.innerHTML=M.hint?M.hint(G):'';
}
function logTurn(){
  const p=cur(G);
  const line=`<div><span>${esc(p.name)}: ${G.turn.darts.map(h=>h.bo?'B/O':h.label).join(' · ')}</span><b>${tText(G)}</b></div>`;
  const el=$('#log');
  if(G.turn.darts.length===1)el.insertAdjacentHTML('afterbegin',line);else if(el.firstElementChild)el.firstElementChild.outerHTML=line;
  while(el.children.length>30)el.lastElementChild.remove();
}
function drawSourceInto(cam,c,cw,ch){
  const[w,h]=srcSize(cam);if(!w)return null;
  const s=Math.min(cw/w,ch/h),dw=w*s,dh=h*s,rect={x:(cw-dw)/2,y:(ch-dh)/2,w:dw,h:dh};
  drawSrc(cam,c,rect.x,rect.y,dw,dh);return rect;
}
function drawWire(cam,c,rect,lw){
  if(!cam.cal.Hinv)return;
  const m=(x,y)=>{const[u,v]=applyH(cam.cal.Hinv,x,y);return[rect.x+u*rect.w,rect.y+v*rect.h];};
  c.strokeStyle='rgba(47,212,163,.9)';c.lineWidth=lw;
  for(const r of [R.DB,R.SB,R.TI,R.TO,R.DI,R.DO]){c.beginPath();for(let k=0;k<=96;k++){const a=k/96*Math.PI*2,[x,y]=m(r*Math.sin(a),r*Math.cos(a));k?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
  for(let i=0;i<20;i++){const a=rad(i*18+9);c.beginPath();c.moveTo(...m(R.SB*Math.sin(a),R.SB*Math.cos(a)));c.lineTo(...m(R.DO*Math.sin(a),R.DO*Math.cos(a)));c.stroke();}
  const[tx,ty]=m(0,198);c.fillStyle='#2fd4a3';c.font=`bold ${lw*9}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('20',tx,ty);
}
function drawDetection(cam,c,rect){
  const L=cam.det.last;if(!L||performance.now()-L.t>60000)return;
  const{PW,PH}=cam,sx=rect.w/PW,sy=rect.h/PH;
  if(S.debug){c.fillStyle='rgba(255,60,200,.55)';for(const i of L.pix)c.fillRect(rect.x+(i%PW)*sx,rect.y+((i/PW)|0)*sy,sx,sy);}
  if(L.ends){c.strokeStyle='rgba(255,194,75,.9)';c.lineWidth=1.5;c.beginPath();c.moveTo(rect.x+L.ends[0][0]*sx,rect.y+L.ends[0][1]*sy);c.lineTo(rect.x+L.ends[1][0]*sx,rect.y+L.ends[1][1]*sy);c.stroke();}
  const x=rect.x+L.tip.x*sx,y=rect.y+L.tip.y*sy;
  c.strokeStyle='#ff3b4f';c.lineWidth=2;c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.moveTo(x-12,y);c.lineTo(x+12,y);c.moveTo(x,y-12);c.lineTo(x,y+12);c.stroke();
  // where all cameras together put the tip, drawn in this camera's view (green): shows whether they agree
  const F=FUSE.last;
  if(F&&F.reports.length>1&&cam.cal.Hinv&&Math.abs(F.t-L.t)<2000){
    const[u,v]=applyH(cam.cal.Hinv,F.pt[0],F.pt[1]),fx=rect.x+u*rect.w,fy=rect.y+v*rect.h;
    c.fillStyle='#2fd4a3';c.beginPath();c.arc(fx,fy,4,0,Math.PI*2);c.fill();
  }
}
// one preview tile per camera; tap a tile to open that camera's settings
function drawPreview(){
  const grid=$('#camGrid');
  const helpers=typeof HELPERS!=='undefined'?HELPERS:[],keep=CAMS.map(c=>String(c.id)).concat(helpers.map(h=>h.key));
  for(const el of [...grid.querySelectorAll('canvas')])if(!keep.includes(el.dataset.cam))el.remove();
  grid.classList.toggle('multi',CAMS.length+helpers.length>1);
  if(!S.showCam)return;
  for(const h of helpers){ // phones send a small preview picture now and then
    let cv=grid.querySelector(`canvas[data-cam="${h.key}"]`);
    if(!cv){cv=document.createElement('canvas');cv.width=320;cv.height=240;cv.dataset.cam=h.key;cv.onclick=()=>openPairing();grid.appendChild(cv);}
    const c=cv.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,320,240);
    if(h.img)c.drawImage(h.img,0,0,320,240);
    c.fillStyle='rgba(0,0,0,.65)';c.fillRect(0,0,320,24);c.fillStyle=h.ready?'#2fd4a3':'#ffc24b';
    c.font='bold 13px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText(`📱 ${h.label}${h.ready?'':' · not calibrated'}`,8,12);
  }
  for(const cam of CAMS){
    let cv=grid.querySelector(`canvas[data-cam="${cam.id}"]`);
    if(!cv){cv=document.createElement('canvas');cv.width=640;cv.height=480;cv.dataset.cam=cam.id;
      cv.onclick=()=>{openCal();selectCam(cam);};grid.appendChild(cv);}
    const c=cv.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,cv.width,cv.height);
    const rect=drawSourceInto(cam,c,cv.width,cv.height);if(!rect)continue;
    drawWire(cam,c,rect,1.2);drawDetection(cam,c,rect);
    if(CAMS.length>1){c.fillStyle='rgba(0,0,0,.6)';c.fillRect(6,6,34,26);c.fillStyle=cam.state==='lost'?'#ff4d5e':'#fff';
      c.font='bold 18px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(CAMS.indexOf(cam)+1,23,20);}
  }
}
