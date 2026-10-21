// DartEye · Phones as helper cameras: QR pairing, and sending dart readings to the main screen (PeerJS / WebRTC)
'use strict';

/* ---------- helper cameras ---------- */
// The main screen (host) listens for helpers. A phone opens the same page with ?helper=<host id>, runs its own
// camera, calibration and detection, and sends only what it saw: the dart's tip and line in board mm, plus a small
// preview picture every couple of seconds. Video never leaves the phone. PeerJS's free server only introduces the
// two devices; after that they talk directly over the local network.
const PEER_JS='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const QR_JS='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const HELPERS=[];                       // on the host: connected phones
const HOST={peer:null,id:null};
const HELPER={on:false,hostId:null,peer:null,conn:null}; // on a phone in helper mode

function loadScript(src){
  return new Promise((ok,fail)=>{
    const have=[...document.scripts].find(s=>s.src===src);
    if(have){if(have.dataset.loaded)ok();else{have.addEventListener('load',ok);have.addEventListener('error',fail);}return;}
    const s=document.createElement('script');s.src=src;s.crossOrigin='anonymous';
    s.onload=()=>{s.dataset.loaded='1';ok();};s.onerror=()=>fail(new Error('could not load '+src.split('/')[2]));
    document.head.appendChild(s);
  });
}
const okNum=v=>typeof v==='number'&&isFinite(v)&&Math.abs(v)<1e6;
const okPt=p=>Array.isArray(p)&&p.length===2&&okNum(p[0])&&okNum(p[1]);

/* ----- host (main screen) ----- */
async function startHosting(){
  if(HOST.peer&&!HOST.peer.destroyed&&HOST.id)return HOST.id;
  await loadScript(PEER_JS);
  const id=S.hostId||('darteye-'+Math.random().toString(36).slice(2,10));
  return new Promise((ok,fail)=>{
    const peer=new Peer(id);
    peer.on('open',pid=>{HOST.peer=peer;HOST.id=pid;S.hostId=pid;persist();ok(pid);});
    peer.on('connection',acceptHelper);
    peer.on('disconnected',()=>{if(!peer.destroyed)try{peer.reconnect();}catch(e){}});
    peer.on('error',e=>{
      if(e.type==='unavailable-id'&&!HOST.id){S.hostId=null;persist();peer.destroy();startHosting().then(ok,fail);}
      else if(!HOST.id)fail(e);
    });
  });
}
function acceptHelper(conn){
  const h={key:'helper:'+conn.peer,kind:'helper',label:'Phone',conn,ready:false,img:null,state:'idle',text:''};
  conn.on('open',()=>{
    const old=HELPERS.findIndex(x=>x.key===h.key);if(old>=0)HELPERS.splice(old,1);
    HELPERS.push(h);updatePill();renderHelperList();toast('📱 Helper camera connected');
  });
  conn.on('data',m=>onHelperMsg(h,m));
  conn.on('close',()=>{const i=HELPERS.indexOf(h);if(i<0)return;HELPERS.splice(i,1);updatePill();renderHelperList();toast('📱 Helper camera disconnected');});
}
function onHelperMsg(h,m){
  if(!m||typeof m!=='object')return;
  if(m.t==='status'){
    h.label=String(m.label||'Phone').slice(0,30);h.ready=!!m.ready;h.state=String(m.state||'');h.text=String(m.text||'').slice(0,60);
    updatePill();renderHelperList();
  }else if(m.t==='dart'){
    if(h.ready&&okPt(m.tip)&&okNum(m.w)&&(m.dir===null||okPt(m.dir)))reportDart(h,{tip:m.tip,dir:m.dir,w:m.w,wl:okNum(m.wl)?m.wl:0});
  }else if(m.t==='takeout')reportTakeout(h);
  else if(m.t==='thumb'&&typeof m.jpg==='string'&&m.jpg.startsWith('data:image/jpeg')&&m.jpg.length<200000){
    const im=new Image();im.onload=()=>{h.img=im;};im.src=m.jpg;
  }
}
function broadcastHelpers(m){for(const h of HELPERS)if(h.conn.open)h.conn.send(m);}
const helperUrl=id=>location.origin+location.pathname+'?helper='+encodeURIComponent(id);
async function openPairing(){
  $('#dlgPair').showModal();renderHelperList();
  if(HOST.id&&$('#pairQr svg'))return;
  $('#pairQr').textContent='Getting a pairing code…';$('#pairLink').textContent='';
  try{
    const id=await startHosting();await loadScript(QR_JS);
    const url=helperUrl(id),qr=qrcode(0,'M');qr.addData(url);qr.make();
    $('#pairQr').innerHTML=qr.createSvgTag({cellSize:5,margin:2,scalable:true});
    $('#pairLink').textContent=url;
  }catch(e){$('#pairQr').textContent=`Couldn't start pairing (${e.type||e.message}). Pairing needs an internet connection for the first handshake.`;}
}
function renderHelperList(){
  const el=$('#helperList');if(!el)return;
  el.innerHTML=HELPERS.length?HELPERS.map(h=>`<div class="hrow"><span class="dot ${h.ready?'ok':'bad'}"></span><b>📱 ${esc(h.label)}</b>
    <span class="muted">${h.ready?esc(h.text||'Ready'):'Connected, not calibrated yet: press Auto-align on the phone'}</span></div>`).join('')
    :'<p class="muted">No phones connected yet.</p>';
}

/* ----- helper (a phone acting as an extra camera) ----- */
const setHelperStatus=t=>{$('#helperStatus').textContent=t;};
function helperSend(m){if(HELPER.conn&&HELPER.conn.open)HELPER.conn.send(m);}
function helperStatus(){
  const cam=CAMS[0];
  helperSend({t:'status',label:(cam?cam.label:'Phone')+'',ready:!!(cam&&cam.cal.H&&cam.state!=='lost'),state:cam?cam.state:'',text:cam?cam.text:''});
}
function helperThumb(){ // small preview for the main screen's camera tiles
  const cam=CAMS[0];if(!cam||!HELPER.conn||!HELPER.conn.open)return;
  const cv=helperThumb.cv||(helperThumb.cv=Object.assign(document.createElement('canvas'),{width:320,height:240}));
  const c=cv.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,320,240);
  const rect=drawSourceInto(cam,c,320,240);if(!rect)return;
  drawWire(cam,c,rect,1);drawDetection(cam,c,rect);
  helperSend({t:'thumb',jpg:cv.toDataURL('image/jpeg',.55)});
}
async function startHelper(hostId){
  HELPER.on=true;HELPER.hostId=hostId;
  document.body.classList.add('helper-mode');$('#helperBar').hidden=false;openCal();
  setHelperStatus('Connecting to the main screen…');
  try{await loadScript(PEER_JS);}catch(e){setHelperStatus('Could not load the connection library: check the internet connection');return;}
  const peer=new Peer();HELPER.peer=peer;
  peer.on('open',connectHelper);
  peer.on('disconnected',()=>{if(!peer.destroyed)try{peer.reconnect();}catch(e){}});
  peer.on('error',e=>{
    if(e.type==='peer-unavailable'){setHelperStatus('Main screen not found: is DartEye open there? Retrying…');setTimeout(connectHelper,4000);}
    else setHelperStatus('Connection problem ('+e.type+'), retrying…');
  });
  setInterval(()=>{helperStatus();helperThumb();},1500);
  if(!CAMS.length)addCamera('default'); // phones: the back camera
}
function connectHelper(){
  const peer=HELPER.peer;if(!peer||peer.destroyed||!peer.open)return;
  const conn=peer.connect(HELPER.hostId,{reliable:true});HELPER.conn=conn;
  conn.on('open',()=>{setHelperStatus('Connected ✓ Sending darts to the main screen');helperStatus();});
  conn.on('data',m=>{if(m&&m.t==='reset'){CAMS.forEach(resetDetector);toast('Board is empty ✓');}});
  conn.on('close',()=>{if(HELPER.conn!==conn)return;HELPER.conn=null;setHelperStatus('Disconnected: retrying…');setTimeout(connectHelper,3000);});
}

$('#btnPair').onclick=openPairing;
{const hostId=new URLSearchParams(location.search).get('helper');if(hostId)startHelper(hostId);}
