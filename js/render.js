// DartEye · Scoreboard, board view and camera preview drawing
'use strict';

/* ---------- rendering ---------- */
function render(){renderPlayers();renderTurn();drawBoardView();renderHint();}
function tScore(g){const M=MODE(g);return M.turnScore?M.turnScore(g):sum(g.turn.darts.map(h=>h.value));}
function tText(g){const M=MODE(g);return g.turn.bust?'BUST':M.turnText?M.turnText(g):tScore(g);}
function peekNext(g){const n=g.players.length;for(let k=1;k<=n;k++){const p=g.players[(g.cur+k)%n];if(!p.out&&!p.done)return p;}return null;}
// the player whose turn it is gets the big brown card; everyone else, in throwing order, sits on the grey panel
function renderPlayers(){
  const M=MODE(G),el=$('#players'),n=G.players.length,act=G.result&&G.winner>=0?G.winner:G.cur,p=G.players[act];
  const last=p.turns.length?p.turns[p.turns.length-1]:'–',st=(M.stats?M.stats(G,p):[])[0]||['Darts',p.darts];
  const prev=G.mode==='x01'&&!G.result&&G.turn.darts.length&&G.turn.startScore!==p.score?G.turn.startScore:'';
  const rest=[...Array(n-1)].map((_,k)=>G.players[(act+1+k)%n]);
  const badge=q=>q.legs?`<span class="badge">${q.legs} W</span>`:'';
  el.classList.toggle('solo',n===1);
  el.innerHTML=`<div class="pc ${p.out||p.done?'out':''} ${M.sub&&M.sub(G,p,act)?'hasSub':''}">
      <div class="ph"><span class="avatar">${esc(initials(p.name)||'?')}</span><span class="pname">${esc(p.name)}</span>${badge(p)}</div>
      <div class="prev">${prev}</div>
      <div class="stats"><div><small>Last score:</small><b>${last}</b></div><div><small>${st[0]}:</small><b>${st[1]}</b></div></div>
      <div class="big">${M.big(G,p)}</div>
      ${M.sub?`<div class="psubs">${M.sub(G,p,act)}</div>`:''}
    </div>
    ${rest.length?`<div class="others ${rest.length>2?'many':''}">${rest.map(o=>`<div class="po ${o.out||o.done?'out':''}">
      <div class="pn"><span>${esc(o.name)}</span>${badge(o)}</div><b>${M.big(G,o)}</b></div>`).join('')}</div>`:''}`;
}
function renderTurn(){
  const d=G.turn.darts,over=turnOver(G);
  $$('.slot').forEach((el,i)=>{const h=d[i];
    el.classList.toggle('sel',sel===i);el.classList.toggle('empty',!h);
    el.textContent=h?(h.bo?'B/O':h.label):'';
    el.title=h?'Tap to correct this dart':i===d.length&&!over?'Tap to record a miss':'';});
  const tt=$('#turnTotal');tt.textContent=tText(G);tt.className='ttotal'+(G.turn.bust?' bust':'');
  const next=peekNext(G),btn=$('#btnNext');
  $('#turnMsg').textContent=G.result?'Game over':sel!==null?`Tap the board where dart ${sel+1} landed`
    :over?(next&&n2(next)?`Pull darts · ${next.name} next ▶`:'Pull darts · Next ▶'):`${cur(G).name}'s turn`;
  btn.classList.toggle('ready',over&&!G.result);
  function n2(q){return G.players.length>1&&q!==cur(G);}
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
    c.strokeStyle='#f58220';c.lineWidth=tg.length>3?2:3.2;c.shadowColor='#f58220';c.shadowBlur=tg.length>3?6:12;c.stroke();c.shadowBlur=0;
    c.fillStyle='rgba(245,130,32,.16)';c.fill();
  }
  if(M.draw)M.draw(c,G);
  // darts lean up and back towards the viewer, so a lower dart's flight covers the darts above it: draw top first
  G.turn.darts.map((d,i)=>({d,i})).filter(o=>o.d.pos).sort((a,b)=>b.d.pos.y-a.d.pos.y)
    .forEach(({d,i})=>drawDartMarker(c,d.pos.x,-d.pos.y,i+1,sel===i,sel!==null));
}
function renderHint(){
  const el=$('#checkout'),M=MODE(G);
  if(G.result){el.innerHTML='';return;}
  el.innerHTML=turnOver(G)?'':M.hint?M.hint(G):''; // "who's next" now lives on the bottom bar
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
