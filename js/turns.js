// DartEye · Turn flow shared by every game: new game, darts, corrections, undo, wins
'use strict';

/* ---------- turn flow (shared by every game) ---------- */
function normCfg(c){
  if(c&&MODES[c.mode])return{mode:c.mode,opts:c.opts||{},names:c.names&&c.names.length?c.names:['Player 1']};
  if(c&&/^\d+$/.test(c.mode))return{mode:'x01',opts:{start:+c.mode,out:c.doubleOut?'double':'single'},names:c.names};
  return{mode:'x01',opts:{},names:(c&&c.names)||['Player 1','Player 2']};
}
function newGame(cfg,legs,starter=0){
  cfg=normCfg(cfg);lastCfg=cfg;persist();
  const M=MODES[cfg.mode],o={};
  (M.opts||[]).forEach(op=>o[op.k]=cfg.opts[op.k]!==undefined?cfg.opts[op.k]:op.def);
  G={mode:cfg.mode,o,seed:(Math.random()*2147483647)|0,starter:starter%cfg.names.length,round:0,winner:-1,result:null,turn:null,
    players:cfg.names.map((n,i)=>({name:n,darts:0,turns:[],legs:legs?legs[i]||0:0,out:false,done:false}))};
  G.cur=G.starter;M.init(G);startTurn(G);
  turnStart=clone(G);history=[];sel=null;$('#win').hidden=true;$('#log').innerHTML='';
  $('#modeLabel').textContent=M.label?M.label(G):M.name;
  render();
}
function startTurn(g){g.turn={darts:[],bust:false,end:false,ok:false};const M=MODE(g);if(M.start)M.start(g,cur(g));}
const turnOver=g=>!!g.result||g.turn.bust||g.turn.end||g.turn.darts.length>=3;
function applyDart(g,h){const p=cur(g);g.turn.darts.push(h);p.darts++;MODE(g).apply(g,p,h);}
function addDart(h,auto){
  if(G.result)return;
  if(turnOver(G)){nextTurn();if(G.result)return;}
  h=Object.assign({},h,{auto:!!auto});
  if(sel!==null&&sel<G.turn.darts.length&&!auto){const ds=G.turn.darts.slice();ds[sel]=h;sel=null;editTurn(ds);return;}
  sel=null;applyDart(G,h);
  // like a real caller: the dart that ends the visit is announced as the visit total
  const M=MODE(G),endCall=G.result?'':turnOver(G)?(G.turn.bust?'Bust':M.call?M.call(G):turnWords(tScore(G))):'';
  if(!G.result)say(endCall||dartWords(h),!!endCall);
  if(G.result)onWin();
  logTurn();render();
}
function editTurn(darts){
  const g=clone(turnStart);
  for(const d of darts){if(turnOver(g))break;applyDart(g,d);}
  G=g;if(G.result)onWin();else $('#win').hidden=true;render();
}
function nextTurn(){
  if(G.result)return;
  const M=MODE(G),p=cur(G);
  p.turns.push(tScore(G));
  history.push({snap:turnStart,darts:G.turn.darts.slice()});
  if(M.endTurn)M.endTurn(G,p);
  if(!G.result)advance(G);
  turnStart=clone(G);sel=null;
  if(G.result)onWin();
  else{const n=cur(G);say(M.nextCall?M.nextCall(G,n):G.players.length>1?n.name:'');}
  render();
}
function advance(g){
  const M=MODE(g),n=g.players.length;
  for(let k=1;k<=n;k++){
    const i=(g.cur+k)%n;
    if(i===g.starter){g.round++;if(M.roundEnd)M.roundEnd(g);if(g.result)return;}
    const p=g.players[i];
    if(!p.out&&!p.done){g.cur=i;startTurn(g);return;}
  }
  if(M.allDone)M.allDone(g);else finishBy(g,'score');
}
function undo(){
  sel=null;
  if(G.turn.darts.length)editTurn(G.turn.darts.slice(0,-1));
  else if(history.length){const h=history.pop();turnStart=h.snap;editTurn(h.darts.slice(0,-1));}
  toast('Undone');
}
function onWin(){
  $('#winName').textContent=G.result.title;
  $('#winStats').textContent=G.result.sub||'';
  $('#win').hidden=false;
  say(G.result.say||G.result.title);
}
function rematch(){
  const legs=G.players.map((p,i)=>p.legs+(i===G.winner?1:0));
  newGame(lastCfg,legs,(G.starter+1)%G.players.length);
}
