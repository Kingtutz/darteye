// DartEye · Cameras: several at once (USB webcams, simulator views), each with its own zoom and calibration
'use strict';

/* ---------- cameras ---------- */
const CAMS=[];let CUR=null; // CUR = the camera shown on the camera screen
let camSeq=0;
// calibrations saved before multi-camera support were stored under 'cam' / 'sim'
if(CALS.cam&&!CALS['cam:default'])CALS['cam:default']=CALS.cam;
if(CALS.sim&&!CALS.sim0)CALS.sim0=CALS.sim;

function makeCam(kind,{deviceId=null,simIndex=null,label=''}={}){
  const proc=document.createElement('canvas');
  return{id:++camSeq,key:kind==='sim'?'sim'+simIndex:'cam:'+(deviceId||'default'),kind,deviceId,simIndex,label,
    video:null,stream:null,zoom:{z:1,cx:.5,cy:.5},cal:{pts:[],H:null,Hinv:null},
    det:newDetState(),PW:0,PH:0,proc,pctx:proc.getContext('2d',{willReadFrequently:true}),state:'idle',text:''};
}
function srcEl(cam){return cam.kind==='sim'?SIM.view(cam.simIndex).canvas:cam.video;}
function fullSize(cam){
  if(!cam)return[0,0];
  if(cam.kind==='sim')return[SIM.W,SIM.H];
  return cam.video&&cam.video.readyState>=2?[cam.video.videoWidth,cam.video.videoHeight]:[0,0];
}
/* digital zoom: everything (detection, calibration, preview, board photo) sees only this crop of the frame.
   The crop keeps the frame's aspect ratio; cx/cy is its centre as a fraction of the full frame. */
function cropRect(cam){
  const[W,H]=fullSize(cam),Z=cam?cam.zoom:{z:1,cx:.5,cy:.5},w=W/Z.z,h=H/Z.z;
  return{x:Math.max(0,Math.min(W-w,Z.cx*W-w/2)),y:Math.max(0,Math.min(H-h,Z.cy*H-h/2)),w,h,W,H};
}
function srcSize(cam){const r=cropRect(cam);return r.W?[r.w,r.h]:[0,0];}
function drawSrc(cam,c,dx,dy,dw,dh){const r=cropRect(cam);c.drawImage(srcEl(cam),r.x,r.y,r.w,r.h,dx,dy,dw,dh);}

function setCal(cam,pts){
  const K=cam.cal;K.pts=pts;
  if(pts.length===4){K.H=homog(pts,CAL_MM);K.Hinv=homog(CAL_MM,pts);if(!K.H||!K.Hinv)K.H=K.Hinv=null;}
  else K.H=K.Hinv=null;
  CALS[cam.key]=pts;
  const[fw,fh]=srcSize(cam);
  if(K.Hinv&&fw){const[x0,y0]=applyH(K.Hinv,0,0),[x1,y1]=applyH(K.Hinv,0,170);CALS.up=Object.assign({},CALS.up,{[cam.key]:Math.atan2((x1-x0)*fw,-(y1-y0)*fh)});}
  persist();
  cam.det.roi=null;resetDetector(cam);updatePill();
}
// change zoom and carry the calibration across exactly, so the board stays aligned
function setZoom(cam,z,cx,cy){
  const o=cropRect(cam);if(!o.W)return;
  const Z=cam.zoom,full=cam.cal.pts.map(([u,v])=>[(o.x+u*o.w)/o.W,(o.y+v*o.h)/o.H]);
  Z.z=Math.max(1,Math.min(5,z));
  const hw=.5/Z.z;Z.cx=Math.max(hw,Math.min(1-hw,cx??Z.cx));Z.cy=Math.max(hw,Math.min(1-hw,cy??Z.cy));
  const n=cropRect(cam);
  S.zooms=Object.assign({},S.zooms,{[cam.key]:{...Z}});
  setCal(cam,full.map(([u,v])=>[(u*n.W-n.x)/n.w,(v*n.H-n.y)/n.h]));
  syncZoomUI();
}
// zoom so the whole board (plus a margin) fills the picture
function frameBoard(cam){
  if(!cam||!cam.cal.Hinv){toast('Align the board first');return;}
  const o=cropRect(cam);let x0=1,y0=1,x1=0,y1=0;
  for(let k=0;k<48;k++){const a=k/48*TAU,[u,v]=applyH(cam.cal.Hinv,232*Math.sin(a),232*Math.cos(a));
    const fx=(o.x+u*o.w)/o.W,fy=(o.y+v*o.h)/o.H;x0=Math.min(x0,fx);x1=Math.max(x1,fx);y0=Math.min(y0,fy);y1=Math.max(y1,fy);}
  const z=Math.min(1/((x1-x0)*1.1),1/((y1-y0)*1.1));
  setZoom(cam,z,(x0+x1)/2,(y0+y1)/2);
  // re-run the alignment on the sharper, zoomed picture; keep the carried-over one if that fails
  setTimeout(()=>{if(CAMS.includes(cam))autoAlign(cam,true);},400);
  toast(`Zoomed ${cam.zoom.z.toFixed(1)}× onto the board`);
}
function syncZoomUI(){const el=$('#sZoom');if(!el)return;const z=CUR?CUR.zoom.z:1;el.value=z;$('#vZoom').textContent=`(${z.toFixed(1)}×)`;}

// add a camera: 'sim' (next free simulator view), 'default', or a deviceId
async function addCamera(value){
  let cam;
  if(value==='sim'){
    const used=CAMS.filter(c=>c.kind==='sim').map(c=>c.simIndex),i=[0,1,2].find(k=>!used.includes(k));
    if(i===undefined){toast('All three simulator views are in use');return null;}
    cam=makeCam('sim',{simIndex:i,label:SIM_VIEWS[i].name});
  }else{
    const existing=CAMS.find(c=>c.key==='cam:'+(value||'default'));
    if(existing){selectCam(existing);return existing;}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Camera needs HTTPS (or localhost)');return null;}
    const vc={width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}}; // extra pixels keep a zoomed-in crop sharp
    if(value&&value!=='default')vc.deviceId={exact:value};else vc.facingMode='environment';
    let stream;
    try{stream=await navigator.mediaDevices.getUserMedia({video:vc,audio:false});}
    catch(e){toast('Camera blocked: '+e.name);return null;}
    const track=stream.getVideoTracks()[0],settings=track.getSettings?track.getSettings():{};
    cam=makeCam('cam',{deviceId:value==='default'?'default':(settings.deviceId||value),label:track.label||'Camera'});
    cam.stream=stream;cam.video=document.createElement('video');
    cam.video.muted=true;cam.video.playsInline=true;cam.video.setAttribute('playsinline','');
    $('#videos').appendChild(cam.video);cam.video.srcObject=stream;try{await cam.video.play();}catch(e){}
    // iPad Safari runs one camera at a time: starting another silently stops this one
    const lost=()=>{if(cam.state==='lost'||!CAMS.includes(cam))return;setDet(cam,'lost','Camera stopped');
      toast('This device stopped a camera: iPad Safari can only run one at a time. Use a phone as a helper camera.');updatePill();};
    track.addEventListener('ended',lost);track.addEventListener('mute',lost);
  }
  CAMS.push(cam);
  Object.assign(cam.zoom,(S.zooms||{})[cam.key]);
  setCal(cam,(CALS[cam.key]||[]).slice());
  setDet(cam,cam.cal.H?'ready':'idle',cam.cal.H?'Ready · throw!':'Not calibrated yet');
  selectCam(cam);
  if(!cam.cal.H)setTimeout(()=>{if(CAMS.includes(cam)&&!cam.cal.H)autoAlign(cam,true);},1500);
  return cam;
}
function removeCamera(cam){
  if(!cam)return;
  if(cam.stream)cam.stream.getTracks().forEach(t=>t.stop());
  if(cam.video)cam.video.remove();
  CAMS.splice(CAMS.indexOf(cam),1);
  selectCam(CAMS[0]||null);
}
function selectCam(cam){CUR=cam;renderCamTabs();syncZoomUI();updatePill();$('#simCtl').hidden=!CAMS.some(c=>c.kind==='sim');}

// warp a calibrated camera's frame into a face-on board image (each output pixel is a board mm position)
function captureBoardPhoto(cam){
  if(!cam||!cam.cal.Hinv)return false;
  let[w,h]=srcSize(cam);if(!w)return false;
  w=Math.round(w);h=Math.round(h);
  const sc=document.createElement('canvas');sc.width=w;sc.height=h;
  const sx=sc.getContext('2d',{willReadFrequently:true});drawSrc(cam,sx,0,0,w,h);
  const sd=sx.getImageData(0,0,w,h).data;
  const N=720,out=document.createElement('canvas');out.width=out.height=N;
  const oc=out.getContext('2d'),od=oc.createImageData(N,N),o=od.data,mm=460/N;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const bx=(x+.5)*mm-230,by=230-(y+.5)*mm,j=(y*N+x)*4;
    if(bx*bx+by*by>230*230){o[j+3]=255;continue;}
    const[u,v]=applyH(cam.cal.Hinv,bx,by),px=u*w-.5,py=v*h-.5,x0=Math.floor(px),y0=Math.floor(py);
    if(x0<0||y0<0||x0>=w-1||y0>=h-1){o[j+3]=255;continue;}
    const fx=px-x0,fy=py-y0,i00=(y0*w+x0)*4,i10=i00+4,i01=i00+w*4,i11=i01+4;
    for(let k=0;k<3;k++)o[j+k]=(sd[i00+k]*(1-fx)+sd[i10+k]*fx)*(1-fy)+(sd[i01+k]*(1-fx)+sd[i11+k]*fx)*fy;
    o[j+3]=255;
  }
  oc.putImageData(od,0,0);
  PHOTO.img=out;
  try{localStorage.setItem(KEY+'.photo',out.toDataURL('image/jpeg',.88));}catch(e){}
  if(G)render();
  return true;
}
// the most face-on calibrated camera gives the best board photo (its view of the double ring is the roundest)
function bestPhotoCam(){
  let best=null,bs=0;
  for(const cam of CAMS){
    if(!cam.cal.Hinv)continue;const[w,h]=srcSize(cam);if(!w)continue;
    const p=[...Array(24)].map((_,k)=>{const a=k/24*TAU,[u,v]=applyH(cam.cal.Hinv,170*Math.sin(a),170*Math.cos(a));return[u*w,v*h];});
    const mx=sum(p.map(q=>q[0]))/24,my=sum(p.map(q=>q[1]))/24;let sxx=0,syy=0,sxy=0;
    for(const[x,y]of p){sxx+=(x-mx)**2;syy+=(y-my)**2;sxy+=(x-mx)*(y-my);}
    const tr=sxx+syy,dt=sxx*syy-sxy*sxy,disc=Math.sqrt(Math.max(0,tr*tr/4-dt)),round=Math.sqrt(Math.max(0,tr/2-disc)/(tr/2+disc));
    if(round>bs){bs=round;best=cam;}
  }
  return best;
}

async function fillDevices(){
  const sel=$('#srcSel');let cams=[];
  try{cams=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');}catch(e){}
  sel.innerHTML='<option value="default">Default camera</option>'+
    cams.map((d,i)=>`<option value="${esc(d.deviceId)}">${esc(d.label||('Camera '+(i+1)))}</option>`).join('')+
    '<option value="sim">Simulator view (test without a camera)</option>';
}
function renderCamTabs(){
  const el=$('#camTabs');if(!el)return;
  el.innerHTML=CAMS.map((c,i)=>`<button type="button" class="camtab ${c===CUR?'on':''} ${c.state==='lost'?'lost':''}" data-cam="${c.id}">
    <span class="dot ${c.cal.H?'ok':'bad'}"></span>${c.kind==='sim'?'🧪':'📷'} ${i+1} · ${esc(c.label.slice(0,22))}</button>`).join('')||'<span class="muted">No cameras yet</span>';
  $('#btnRemoveCam').hidden=!CUR;
}
function updatePill(){
  const p=$('#camPill'),n=CAMS.length+(typeof HELPERS!=='undefined'?HELPERS.length:0),ok=liveSources().length;
  if(!n){p.textContent='Camera off';p.className='pill';}
  else if(!ok){p.textContent=(n>1?`${n} cameras`:'Camera')+' · not calibrated';p.className='pill warn';}
  else{p.textContent=(ok>1?`${ok} cameras`:'Camera')+' · auto-scoring';p.className='pill ok';}
  $('#nocam').hidden=CAMS.length>0;
  $('#btnCam').dataset.state=!n?'off':ok?'ok':'warn'; // status dot on the camera button
  renderCamTabs();
}
