// DartEye · Buttons and keys, new-game dialog, main loop, start-up
'use strict';

/* ---------- events ---------- */
function onAutoDart(h,pos){addDart(Object.assign({},h,{pos}),true);toast(h.label);}
function onTakeout(){if(G.turn.darts.length&&turnOver(G)&&!G.result)nextTurn();}
$('#board').addEventListener('pointerdown',e=>{
  const r=e.currentTarget.getBoundingClientRect();
  const x=(e.clientX-r.left-BV.cx)/BV.sc,y=-(e.clientY-r.top-BV.cy)/BV.sc;
  if(Math.hypot(x,y)>228)return;
  addDart(Object.assign(hitAt(x,y),{pos:{x,y}}),false);
});
$$('.slot').forEach(el=>el.onclick=()=>{const i=+el.dataset.i;if(i>=G.turn.darts.length)return;sel=sel===i?null:i;render();});
$('#btnMiss').onclick=()=>addDart(mk(0,0),false);
$('#btnBounce').onclick=()=>addDart(Object.assign(mk(0,0),{bo:true}),false);
$('#btnUndo').onclick=undo;
$('#btnNext').onclick=()=>{if(!G.turn.darts.length&&!G.result){toast('No darts this turn yet');return;}nextTurn();};
$('#btnCam').onclick=openCal;
$('#btnCalDone').onclick=closeCal;
$('#btnStartSrc').onclick=()=>startSource($('#srcSel').value);
$('#btnCalReset').onclick=()=>setCal([]);
$('#btnAuto').onclick=()=>autoAlign(false);
$('#btnRotL').onclick=()=>rotateCal(1);
$('#btnRotR').onclick=()=>rotateCal(-1);
$('#btnEmpty').onclick=()=>{resetDetector();toast(captureBoardPhoto()?'Empty board captured · photo saved':'Empty board captured');};
$('#sBoard').onchange=e=>{S.boardStyle=e.target.value;persist();render();};
$('#btnVoice').onclick=()=>{S.voice=!S.voice;persist();
  if(!S.voice){sayQ.length=0;try{speechSynthesis.cancel();}catch(e){}}$('#btnVoice').textContent=S.voice?'🔊':'🔇';toast(S.voice?'Caller on':'Caller off');};
$('#btnView').onclick=()=>{S.showCam=!S.showCam;persist();document.body.classList.toggle('nocamview',!S.showCam);setTimeout(render,50);};
$('#btnFull').onclick=()=>{const el=document.documentElement;try{if(document.fullscreenElement||document.webkitFullscreenElement)(document.exitFullscreen||document.webkitExitFullscreen).call(document);else(el.requestFullscreen||el.webkitRequestFullscreen).call(el);}catch(e){toast('Use Share → Add to Home Screen for full screen');}};
$('#btnRematch').onclick=rematch;
$('#btnWinUndo').onclick=undo;
$('#btnNewGame2').onclick=()=>openNew();
$('#btnNew').onclick=()=>openNew();
$('#simCtl').onclick=e=>{
  const a=e.target.dataset.sim;if(!a)return;
  if(a==='pull'){SIM.pull();return;}
  if(a==='bo'){toast('Dart bounced out: press Bounce-out');return;}
  let x,y;
  if(a==='t20'){const g=()=>(Math.random()+Math.random()+Math.random()-1.5)*22;x=g();y=103+g();}
  else{const r=Math.sqrt(Math.random())*175,t=Math.random()*Math.PI*2;x=r*Math.sin(t);y=r*Math.cos(t);}
  SIM.throwAt(x,y);SIMLOG.push({truth:hitAt(x,y).label,x,y});
};
const SIMLOG=[];
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||$('#dlgNew').open)return;
  if(e.key==='Backspace'){e.preventDefault();undo();}
  else if(e.key==='Enter'){$('#btnNext').click();}
  else if(e.key==='m'||e.key==='M'){addDart(mk(0,0),false);}
});
// first interaction: unlock speech on iOS + keep the screen awake
let wake=null;
document.addEventListener('pointerdown',async()=>{
  if(!voiceReady&&window.speechSynthesis){voiceReady=true;try{speechSynthesis.speak(new SpeechSynthesisUtterance(''));}catch(e){}}
  if(!wake&&navigator.wakeLock){try{wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>wake=null);}catch(e){}}
},{capture:true});

/* new-game dialog */
let pick={mode:'x01',opts:{}};
function openNew(){
  const c=normCfg(lastCfg);pick={mode:c.mode,opts:Object.assign({},c.opts)};
  for(let i=0;i<8;i++)$('#p'+i).value=c.names[i]||'';
  renderPicker();$('#dlgNew').showModal();
}
function renderPicker(){
  const groups=['Classic','Practice','Arcade'];
  $('#gamePick').innerHTML=groups.map(gr=>`<div class="ggroup">${gr}</div><div class="ggrid">${
    Object.entries(MODES).filter(([,m])=>m.group===gr).map(([k,m])=>`<button type="button" class="gcard ${k===pick.mode?'on':''}" data-m="${k}"><span class="gi">${m.icon}</span><b>${m.name}</b></button>`).join('')}</div>`).join('');
  const M=MODES[pick.mode];
  $('#gameDesc').textContent=M.desc+(M.min?` (needs ${M.min}+ players)`:'');
  $('#gameOpts').innerHTML=(M.opts||[]).map(op=>{const v=pick.opts[op.k]!==undefined?pick.opts[op.k]:op.def;
    return `<div class="field">${op.label}<div class="seg" data-k="${op.k}">${op.ch.map(([cv,l])=>`<button type="button" data-v="${cv}" class="${String(cv)===String(v)?'on':''}">${l}</button>`).join('')}</div></div>`;}).join('');
}
$('#gamePick').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;if(b.dataset.m!==pick.mode){pick={mode:b.dataset.m,opts:{}};}renderPicker();};
$('#gameOpts').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;
  const k=b.parentElement.dataset.k,op=MODES[pick.mode].opts.find(o=>o.k===k);
  pick.opts[k]=typeof op.def==='number'?+b.dataset.v:b.dataset.v;renderPicker();};
$('#dlgNew').addEventListener('close',()=>{
  if($('#dlgNew').returnValue!=='ok')return;
  const names=[...Array(8)].map((_,i)=>$('#p'+i).value.trim()).filter(Boolean);
  const M=MODES[pick.mode];
  while(names.length<(M.min||1))names.push('Player '+(names.length+1));
  newGame({mode:pick.mode,opts:pick.opts,names});
});

let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1400);}
window.addEventListener('resize',()=>render());

/* ---------- main loop ---------- */
let lastProc=0;
function loop(t){
  requestAnimationFrame(loop);
  if(SRC==='sim')SIM.render();
  if(SRC!=='none'&&t-lastProc>=55){lastProc=t;const g=grabGray();if(g)detectStep(g);}
  drawPreview();if(calOpen)drawCal();
}

/* ---------- boot ---------- */
$('#btnVoice').textContent=S.voice?'🔊':'🔇';
document.body.classList.toggle('nocamview',!S.showCam);
newGame(lastCfg);updatePill();requestAnimationFrame(loop);
window.DE={SIM,D,CAL,get G(){return G},SIMLOG,startSource,setCal,hitAt,MODES,newGame,addDart,nextTurn,undo,mk};
