// DartEye · Game state helpers and every game mode (MODES)
'use strict';

/* ---------- game engine ---------- */
let G,turnStart,history=[],sel=null;
const MODE=g=>MODES[g.mode],cur=g=>g.players[g.cur],sum=a=>a.reduce((x,y)=>x+y,0);
const others=(g,p)=>g.players.filter(o=>o!==p),active=g=>g.players.filter(p=>!p.out&&!p.done);
const dbl=s=>s===25?50:s*2,tname=s=>s===25?'Bull':String(s);
const pct=(a,b)=>b?Math.round(a/b*100)+'%':'–';
const bar=f=>`<div class="bar"><i style="width:${Math.max(0,Math.min(100,f*100))}%"></i></div>`;
const hearts=(n,max)=>`<div class="psub">${'❤️'.repeat(Math.max(0,n))}${'🖤'.repeat(Math.max(0,max-n))}</div>`;
const chip=t=>`<span class="chip">${t}</span>`,lbl=t=>`<span class="lbl">${t}</span>`;
const initials=n=>n.split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
// seeded RNG kept in game state, so undo/correction replays give the same random targets
function rnd(g){let t=(g.seed=(g.seed+0x6D2B79F5)|0);t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
function finishBy(g,key,sub){
  const alive=g.players.filter(p=>!p.out),pool=alive.length?alive:g.players;
  const best=pool.reduce((a,b)=>b[key]>a[key]?b:a);
  g.winner=g.players.indexOf(best);
  g.result={title:g.players.length>1?`${best.name} wins!`:`Well played, ${best.name}!`,sub:sub?sub(best):''};
}
// shared X01-style subtraction: returns 'bust', 'out' or null
function x01hit(g,p,key,h,dout){
  const ns=p[key]-h.value;
  if(ns<0||(dout&&ns===1)||(ns===0&&dout&&h.mult!==2)){g.turn.bust=true;p[key]=g.turn.startScore;return'bust';}
  p[key]=ns;return ns===0?'out':null;
}
const coFor=(g,v,dout)=>turnOver(g)?null:checkout(v,3-g.turn.darts.length,dout);
const coHint=co=>co?`${lbl('Checkout')} ${co.map(h=>chip(h.label)).join('')}`:'';
function randCo(g){for(;;){const n=2+Math.floor(rnd(g)*169);if(checkout(n,3,true))return n;}}

const MODES={
/* ===== Classic ===== */
x01:{name:'X01',icon:'🎯',group:'Classic',desc:'301 / 501 / 701, first to exactly zero',
  opts:[{k:'start',label:'Start score',ch:[[301,'301'],[501,'501'],[701,'701']],def:501},
        {k:'out',label:'Finish',ch:[['double','Double out'],['single','Straight out']],def:'double'},
        {k:'in',label:'Begin',ch:[['single','Straight in'],['double','Double in']],def:'single'}],
  label:g=>`${g.o.start} · ${g.o.out==='double'?'double out':'straight out'}${g.o.in==='double'?' · double in':''}`,
  init(g){g.players.forEach(p=>{p.score=g.o.start;p.opened=g.o.in!=='double';});},
  start(g,p){g.turn.startScore=p.score;g.turn.startOpened=p.opened;},
  apply(g,p,h){
    if(!p.opened){if(h.mult!==2)return;p.opened=true;}
    const r=x01hit(g,p,'score',h,g.o.out==='double');
    if(r==='bust')p.opened=g.turn.startOpened;
    if(r==='out'){g.winner=g.cur;g.result={title:`${p.name} wins!`,sub:`${p.darts} darts · ${x01avg(g,p)} average`,say:`Game shot, and the leg, ${p.name}!`};}
  },
  turnScore:g=>g.turn.bust?0:g.turn.startScore-cur(g).score,
  big:(g,p)=>p.score,
  sub:(g,p)=>p.opened?'':'<div class="psub">Needs a double to start</div>',
  stats:(g,p)=>[['Avg',x01avg(g,p)]],
  hint:g=>cur(g).opened?coHint(coFor(g,cur(g).score,g.o.out==='double')):`${lbl('Start on')} ${chip('any double')}`,
  targets(g){const p=cur(g);const co=p.opened&&coFor(g,p.score,g.o.out==='double');return co?[co[0]]:[];},
  call:g=>g.turn.bust?'Bust':turnWords(g.turn.startScore-cur(g).score),
  nextCall:(g,p)=>p.score<=170&&checkout(p.score,3,g.o.out==='double')?`${p.name}, you require ${p.score}`:p.name},
cricket:{name:'Cricket',icon:'🦗',group:'Classic',desc:'Close your numbers and score on the ones others still have open',
  opts:[{k:'var',label:'Numbers',ch:[['std','15–20 + Bull'],['random','Random'],['hidden','Hidden']],def:'std'}],
  label:g=>({std:'Cricket',random:'Random Cricket',hidden:'Hidden Cricket'})[g.o.var],
  init(g){
    let t=[20,19,18,17,16,15];
    if(g.o.var!=='std'){const pool=SEGS.slice();t=[];while(t.length<6)t.push(pool.splice(Math.floor(rnd(g)*pool.length),1)[0]);t.sort((a,b)=>b-a);}
    g.targets=[...t,25];g.revealed={25:1};
    g.players.forEach(p=>{p.pts=0;p.mk=0;p.marks={};g.targets.forEach(s=>p.marks[s]=0);});
  },
  apply(g,p,h){
    if(!g.targets.includes(h.seg))return;
    g.revealed[h.seg]=1;
    for(let k=0;k<h.mult;k++){p.mk++;
      if(p.marks[h.seg]<3)p.marks[h.seg]++;
      else if(others(g,p).some(o=>o.marks[h.seg]<3))p.pts+=h.seg;}
    if(g.targets.every(s=>p.marks[s]>=3)&&others(g,p).every(o=>p.pts>=o.pts)){g.winner=g.cur;g.result={title:`${p.name} wins!`,sub:`${p.pts} points · ${(p.mk/p.darts*3).toFixed(2)} marks per round`};}
  },
  turnScore:g=>sum(g.turn.darts.map(h=>g.targets.includes(h.seg)?h.mult:0)),
  turnText:g=>MODES.cricket.turnScore(g)+'✕',
  big:(g,p)=>p.pts,
  sub:(g,p)=>`<div class="cr" style="grid-template-columns:repeat(${g.targets.length},1fr)">${g.targets.map(s=>`<span class="h">${g.o.var==='hidden'&&!g.revealed[s]?'?':s===25?'B':s}</span>`).join('')}${g.targets.map(s=>`<span class="${p.marks[s]>=3?'m3':''}">${['','/','✕','⊗'][p.marks[s]]}</span>`).join('')}</div>`,
  stats:(g,p)=>[['MPR',p.darts?(p.mk/p.darts*3).toFixed(2):'0.00']],
  hint:g=>g.o.var==='hidden'?`${lbl('Hidden numbers')} ${chip(g.targets.filter(s=>!g.revealed[s]).length+' still secret')}`:'',
  targets:g=>g.targets.filter(s=>g.revealed[s]||g.o.var!=='hidden').filter(s=>g.players.some(o=>o.marks[s]<3)).map(s=>({seg:s,mult:0})),
  call:g=>{const m=MODES.cricket.turnScore(g);return m?`${m} mark${m>1?'s':''}`:'No score';}},
atc:{name:'Around the Clock',icon:'🕐',group:'Classic',desc:'Hit 1 through 20 in order, then the bull',
  opts:[{k:'skip',label:'Doubles & trebles',ch:[['no','Count as one'],['yes','Jump ahead 2 / 3']],def:'no'}],
  init(g){g.seq=[...SEGS].sort((a,b)=>a-b).concat(25);g.players.forEach(p=>{p.idx=0;p.hits=0;});},
  start(g,p){g.turn.startIdx=p.idx;},
  apply(g,p,h){
    if(h.seg!==g.seq[p.idx])return;
    p.hits++;
    p.idx=h.seg===25?21:Math.min(20,p.idx+(g.o.skip==='yes'?h.mult:1));
    if(p.idx>=21){g.winner=g.cur;g.result={title:`${p.name} wins!`,sub:`Around the clock in ${p.darts} darts`};}
  },
  turnScore:g=>cur(g).idx-g.turn.startIdx,
  turnText:g=>'+'+MODES.atc.turnScore(g),
  big:(g,p)=>p.idx>=21?'✓':tname(g.seq[p.idx]),
  sub:(g,p)=>bar(p.idx/21),
  stats:(g,p)=>[['Hit rate',pct(p.hits,p.darts)]],
  hint:g=>`${lbl('Aim for')} ${chip(tname(g.seq[cur(g).idx]))}`,
  targets:g=>cur(g).idx<21?[{seg:g.seq[cur(g).idx],mult:0}]:[],
  call:g=>{const n=MODES.atc.turnScore(g);return n?`${n} up`:'No hits';},
  nextCall:(g,p)=>`${p.name}, ${tname(g.seq[p.idx])}`},
shanghai:{name:'Shanghai',icon:'🏮',group:'Classic',desc:'Score on the round number. Single + double + treble in one visit wins instantly',
  opts:[{k:'rounds',label:'Rounds',ch:[[7,'1 – 7'],[20,'1 – 20']],def:7}],
  init(g){g.players.forEach(p=>p.score=0);},
  apply(g,p,h){
    const t=g.round+1;if(h.seg!==t)return;
    p.score+=h.value;
    const ms=new Set(g.turn.darts.filter(d=>d.seg===t).map(d=>d.mult));
    if(ms.has(1)&&ms.has(2)&&ms.has(3)){g.winner=g.cur;g.result={title:'SHANGHAI!',sub:`${p.name} wins on ${t}`,say:`Shanghai! ${p.name} wins!`};}
  },
  roundEnd(g){if(g.round>=g.o.rounds)finishBy(g,'score',p=>`${p.score} points`);},
  turnScore:g=>sum(g.turn.darts.filter(h=>h.seg===g.round+1).map(h=>h.value)),
  big:(g,p)=>p.score,
  stats:()=>[],
  hint:g=>`${lbl(`Round ${g.round+1} / ${g.o.rounds}`)} ${chip(g.round+1)}`,
  targets:g=>[{seg:g.round+1,mult:0}],
  nextCall:(g,p)=>`${p.name}, ${g.round+1}`},
killer:{name:'Killer',icon:'🤠',group:'Classic',desc:'Hit your own double to become a killer, then shoot everyone else out',min:2,
  opts:[{k:'lives',label:'Lives',ch:[[3,'3'],[5,'5']],def:3}],
  init(g){const pool=SEGS.slice();g.players.forEach(p=>{p.num=pool.splice(Math.floor(rnd(g)*pool.length),1)[0];p.lives=g.o.lives;p.killer=false;p.kills=0;});},
  apply(g,p,h){
    if(h.mult!==2||h.seg===25)return;
    const o=g.players.find(q=>q.num===h.seg&&!q.out);if(!o)return;
    if(o===p){if(!p.killer)p.killer=true;else if(--p.lives<=0){p.out=true;g.turn.end=true;}}
    else if(p.killer&&--o.lives<=0){o.out=true;p.kills++;}
    const a=g.players.filter(q=>!q.out);
    if(a.length===1){g.winner=g.players.indexOf(a[0]);g.result={title:`${a[0].name} wins!`,sub:'Last one standing'};}
  },
  turnScore:g=>g.turn.darts.filter(h=>h.mult===2).length,
  turnText:g=>MODES.killer.turnScore(g)+' D',
  big:(g,p)=>p.num,
  sub:(g,p)=>`${hearts(p.lives,g.o.lives)}${p.killer?'<div class="psub killer">🔫 KILLER</div>':''}`,
  stats:(g,p)=>[['Kills',p.kills]],
  hint:g=>cur(g).killer?`${lbl('Killer')} ${chip('hit their doubles')}`:`${lbl('Become a killer')} ${chip('D'+cur(g).num)}`,
  targets(g){const p=cur(g);return p.killer?g.players.filter(o=>o!==p&&!o.out).map(o=>({seg:o.num,mult:2})):[{seg:p.num,mult:2}];},
  draw(c,g){
    g.players.forEach(p=>{if(p.out)return;const a=rad(SEGS.indexOf(p.num)*18);
      drawBadge(c,135*Math.sin(a),-135*Math.cos(a),15,initials(p.name),p.killer,p===cur(g));});
  },
  call:()=>'',nextCall:(g,p)=>p.name},

/* ===== Practice ===== */
bobs27:{name:"Bob's 27",icon:'🎲',group:'Practice',desc:'Start on 27. Doubles 1–20 then bull: hits add, a blank visit subtracts the double',
  init(g){g.players.forEach(p=>{p.score=27;p.dh=0;});},
  apply(g,p,h){const t=bobT(g);if(h.seg===t&&h.mult===2){p.score+=dbl(t);p.dh++;}},
  endTurn(g,p){const t=bobT(g);if(!g.turn.darts.some(h=>h.seg===t&&h.mult===2)){p.score-=dbl(t);if(p.score<=0)p.out=true;}},
  roundEnd(g){if(g.round>=21)finishBy(g,'score',p=>`${p.score} points · ${pct(p.dh,p.darts)} doubles`);},
  allDone(g){finishBy(g,'score',p=>`Knocked out on ${tname(bobT(g))}`);},
  turnScore(g){const t=bobT(g),n=g.turn.darts.filter(h=>h.seg===t&&h.mult===2).length;return n?n*dbl(t):turnOver(g)?-dbl(t):0;},
  turnText:g=>{const s=MODES.bobs27.turnScore(g);return(s>0?'+':'')+s;},
  big:(g,p)=>p.score,
  sub:(g,p)=>p.out?'<div class="psub bad">Out</div>':'',
  stats:(g,p)=>[['Doubles',pct(p.dh,p.darts)]],
  hint:g=>`${lbl(`Round ${g.round+1} / 21`)} ${chip(bobT(g)===25?'Bull':'D'+bobT(g))}`,
  targets:g=>[{seg:bobT(g),mult:2}],
  call:g=>{const s=MODES.bobs27.turnScore(g);return s>0?`plus ${s}`:`minus ${-s}`;}},
o121:{name:'121',icon:'✅',group:'Practice',desc:'Check out 121 in 9 darts. Make it and the target goes up, miss and it drops',
  opts:[{k:'att',label:'Attempts',ch:[[10,'10'],[20,'20']],def:10}],
  init(g){g.players.forEach(p=>{p.target=121;p.left=121;p.inA=0;p.att=0;p.succ=0;p.best=0;});},
  start(g,p){g.turn.startScore=p.left;},
  apply(g,p,h){if(x01hit(g,p,'left',h,true)==='out'){p.succ++;p.best=Math.max(p.best,p.target);p.target++;g.turn.ok=true;g.turn.end=true;}},
  endTurn(g,p){
    if(g.turn.ok){p.att++;p.inA=0;}
    else if(++p.inA>=3){p.att++;p.inA=0;p.target=Math.max(121,p.target-1);}
    if(!p.inA)p.left=p.target;
    if(p.att>=g.o.att)p.done=true;
  },
  allDone(g){finishBy(g,'best',p=>`Highest checkout ${p.best||'–'} · ${p.succ}/${p.att} made`);},
  turnText:g=>g.turn.ok?'✓':sum(g.turn.darts.map(h=>h.value)),
  big:(g,p)=>p.left,
  sub:(g,p)=>`<div class="psub">Target ${p.target} · try ${Math.min(p.att+1,g.o.att)}/${g.o.att} · visit ${p.inA+1}/3</div>`,
  stats:(g,p)=>[['Made',`${p.succ}/${p.att}`]],
  hint:g=>coHint(coFor(g,cur(g).left,true)),
  targets(g){const co=coFor(g,cur(g).left,true);return co?[co[0]]:[];},
  call:g=>g.turn.ok?'Checked out!':g.turn.bust?'Bust':'',
  nextCall:(g,p)=>`${p.name}, you require ${p.left}`},
streak:{name:'Checkout Streak',icon:'🔥',group:'Practice',desc:'A random finish every visit. Keep the streak alive',
  opts:[{k:'lives',label:'Lives',ch:[[1,'1'],[3,'3']],def:3}],
  init(g){g.players.forEach(p=>{p.left=p.goal=randCo(g);p.lives=g.o.lives;p.succ=0;p.streak=0;p.best=0;});},
  start(g,p){g.turn.startScore=p.left;},
  apply(g,p,h){if(x01hit(g,p,'left',h,true)==='out'){g.turn.ok=true;g.turn.end=true;}},
  endTurn(g,p){
    if(g.turn.ok){p.succ++;p.streak++;p.best=Math.max(p.best,p.streak);}
    else{p.streak=0;if(--p.lives<=0)p.done=true;}
    p.left=p.goal=randCo(g);
  },
  allDone(g){finishBy(g,'succ',p=>`${p.succ} checkout${p.succ===1?'':'s'} · best streak ${p.best}`);},
  turnText:g=>g.turn.ok?'✓':sum(g.turn.darts.map(h=>h.value)),
  big:(g,p)=>p.left,
  sub:(g,p)=>hearts(p.lives,g.o.lives),
  stats:(g,p)=>[['Streak',p.streak],['Best',p.best]],
  hint:g=>coHint(coFor(g,cur(g).left,true)),
  targets(g){const co=coFor(g,cur(g).left,true);return co?[co[0]]:[];},
  call:g=>g.turn.ok?'Checked out!':'Missed',
  nextCall:(g,p)=>`${p.name}, ${p.left}`},
power:{name:'Power Scoring',icon:'💪',group:'Practice',desc:'Score as much as you can in a fixed number of visits',
  opts:[{k:'rounds',label:'Visits',ch:[[10,'10'],[20,'20']],def:10}],
  init(g){g.players.forEach(p=>p.score=0);},
  apply(g,p,h){p.score+=h.value;},
  roundEnd(g){if(g.round>=g.o.rounds)finishBy(g,'score',p=>`${p.score} points · ${(p.score/p.darts*3).toFixed(1)} average`);},
  big:(g,p)=>p.score,
  stats:(g,p)=>[['Avg',p.darts?(p.score/p.darts*3).toFixed(1):'0.0']],
  hint:g=>`${lbl(`Visit ${g.round+1} / ${g.o.rounds}`)} ${chip('T20')}`,
  targets:()=>[{seg:20,mult:3}]},

/* ===== Arcade ===== */
zombies:defense({key:'zombies',name:'Zombie Shooter',icon:'🧟',mob:'🧟',hp:()=>1,
  desc:'Zombies shuffle in toward the bull. Hit their number to drop them, hit their exact bed for a headshot',
  lose:'Overrun!',win:'You survived the night!'}),
asteroids:defense({key:'asteroids',name:'Asteroid',icon:'☄️',mob:'🪨',rock:true,
  hp:(g,lvl)=>1+Math.floor(rnd(g)*Math.min(3,lvl)),
  desc:'Co-op: blast asteroids before they reach Earth. Doubles do 2 damage, trebles 3, bull is a shockwave',
  lose:'Earth destroyed!',win:'Earth is safe!'}),
lumber:{name:'Lumberjack',icon:'🪓',group:'Arcade',desc:'Chop the glowing number: single 1, double 2, treble 3 chops. The number moves after every hit',
  opts:[{k:'goal',label:'Tree',ch:[[15,'Small (15)'],[25,'Big (25)'],[40,'Giant (40)']],def:25}],
  init(g){g.players.forEach(p=>{p.chops=0;p.target=SEGS[Math.floor(rnd(g)*20)];});},
  apply(g,p,h){
    if(h.seg!==p.target)return;
    p.chops+=h.mult;
    let n;do n=SEGS[Math.floor(rnd(g)*20)];while(n===p.target);p.target=n;
    if(p.chops>=g.o.goal){g.winner=g.cur;g.result={title:'TIMBER!',sub:`${p.name} felled the tree in ${p.darts} darts`,say:`Timber! ${p.name} wins!`};}
  },
  start(g,p){g.turn.s0=p.chops;},
  turnScore:g=>cur(g).chops-g.turn.s0,
  turnText:g=>'🪓 +'+MODES.lumber.turnScore(g),
  big:(g,p)=>`🌲 ${Math.max(0,g.o.goal-p.chops)}`,
  sub:(g,p)=>bar(p.chops/g.o.goal),
  stats:(g,p)=>[['Chops',p.chops]],
  hint:g=>`${lbl('Chop')} ${chip(cur(g).target)}`,
  targets:g=>[{seg:cur(g).target,mult:0}],
  draw(c,g){const p=cur(g),a=rad(SEGS.indexOf(p.target)*18);drawTree(c,135*Math.sin(a),-135*Math.cos(a),20,p.chops/g.o.goal);},
  call:()=>'',nextCall:(g,p)=>`${p.name}, chop ${p.target}`},
};
function bobT(g){return g.round<20?g.round+1:25;}
function x01avg(g,p){return p.darts?((g.o.start-p.score)/p.darts*3).toFixed(1):'0.0';}

// shared engine for the co-op invader games: mobs step one ring closer to the bull each round
const RING_R=[166,135,103,60];
const EMOJI='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function defense(T){return{
  name:T.name,icon:T.icon,group:'Arcade',desc:T.desc,
  opts:[{k:'diff',label:'Difficulty',ch:[['easy','Easy'],['normal','Normal'],['hard','Hard']],def:'normal'}],
  label:g=>`${T.name} · ${g.o.diff}`,
  init(g){g.mobs=[];g.lives=3;g.goal={easy:10,normal:15,hard:20}[g.o.diff];g.spawn=0;
    g.players.forEach(p=>{p.score=0;p.kills=0;});spawnMobs(g,T,3);},
  apply(g,p,h){
    if(!h.seg)return;
    const dmg=T.rock?h.mult:1;
    let hit;
    if(h.seg===25)hit=g.mobs.filter(m=>m.ring>=(h.mult===2?2:3));          // bull = shockwave on the inner rings
    else{const ms=g.mobs.filter(m=>m.seg===h.seg).sort((a,b)=>b.ring-a.ring);hit=ms.slice(0,1);}
    for(const m of hit){
      const head=h.seg!==25&&bedRing(h)===m.ring;
      m.hp-=dmg*(head&&!T.rock?2:1);p.score+=10*dmg*(head?2:1);
      if(m.hp<=0){g.mobs.splice(g.mobs.indexOf(m),1);p.kills++;}
    }
  },
  roundEnd(g){
    for(const m of g.mobs)m.ring++;
    const inn=g.mobs.filter(m=>m.ring>=4);g.lives-=inn.length;g.mobs=g.mobs.filter(m=>m.ring<4);
    const kills=sum(g.players.map(p=>p.kills));
    if(g.lives<=0){g.lives=0;g.winner=-1;g.result={title:T.lose,sub:`Survived ${g.round-1} rounds · ${kills} ${T.rock?'asteroids':'zombies'} down`};return;}
    if(g.round>=g.goal){const best=g.players.reduce((a,b)=>b.score>a.score?b:a);g.winner=g.players.indexOf(best);
      g.result={title:T.win,sub:g.players.length>1?`Top gun: ${best.name} (${best.score})`:`${best.score} points · ${kills} down`};return;}
    g.spawn+={easy:.7,normal:1,hard:1.4}[g.o.diff]*(1+g.round/8);
    const n=Math.floor(g.spawn);g.spawn-=n;spawnMobs(g,T,n);
  },
  start(g,p){g.turn.s0=p.score;},
  turnScore:g=>cur(g).score-g.turn.s0,
  turnText:g=>'💥 +'+(cur(g).score-g.turn.s0),
  big:(g,p)=>p.score,
  stats:(g,p)=>[['Kills',p.kills]],
  hint:g=>`${lbl(`Round ${g.round+1} / ${g.goal}`)} ${chip((T.rock?'🌍 ':'🏠 ')+'❤️'.repeat(g.lives))} ${chip(g.mobs.length+' incoming')}`,
  targets:()=>[],
  draw(c,g){
    if(T.rock)drawEarth(c,15);else drawCabin(c,15);
    for(const m of g.mobs){
      const a=rad(SEGS.indexOf(m.seg)*18),r=RING_R[m.ring],x=r*Math.sin(a),y=-r*Math.cos(a),danger=m.ring>=3;
      if(T.rock)drawAsteroid(c,x,y,15,m.id||m.seg,danger);else drawZombie(c,x,y,15,danger);
      if(m.hp>1)hpBadge(c,x+14,y-15,m.hp);
    }
  },
  call:()=>'',nextCall:(g,p)=>g.players.length>1?p.name:''
};}
function spawnMobs(g,T,n){
  for(let k=0;k<n;k++){
    const free=SEGS.filter(s=>!g.mobs.some(m=>m.seg===s&&m.ring===0));if(!free.length)return;
    g.mobId=(g.mobId||0)+1;
    g.mobs.push({id:g.mobId,seg:free[Math.floor(rnd(g)*free.length)],ring:0,hp:T.hp(g,1+Math.floor(g.round/4))});
  }
}
function bedRing(h){ // which ring bed a hit landed in: 0 double, 1 outer single, 2 treble, 3 inner single
  if(h.mult===2)return 0;if(h.mult===3)return 2;
  return h.pos?(Math.hypot(h.pos.x,h.pos.y)>R.TO?1:3):-1;
}
