// DartEye · Camera / simulator source, digital zoom, board photo capture, camera picker
'use strict';

/* ---------- frame source ---------- */
const video=$('#video');let SRC='none',stream=null;
function srcEl(){return SRC==='cam'?video:SRC==='sim'?SIM.canvas:null;}
function fullSize(){
  if(SRC==='cam')return video.readyState>=2?[video.videoWidth,video.videoHeight]:[0,0];
  if(SRC==='sim')return[SIM.W,SIM.H];return[0,0];
}
/* digital zoom: everything (detection, calibration, preview, board photo) sees only this crop of the frame.
   The crop keeps the frame's aspect ratio; cx/cy is its centre as a fraction of the full frame. */
const ZOOM={z:1,cx:.5,cy:.5};
function cropRect(){
  const[W,H]=fullSize(),w=W/ZOOM.z,h=H/ZOOM.z;
  return{x:Math.max(0,Math.min(W-w,ZOOM.cx*W-w/2)),y:Math.max(0,Math.min(H-h,ZOOM.cy*H-h/2)),w,h,W,H};
}
function srcSize(){const r=cropRect();return r.W?[r.w,r.h]:[0,0];}
function drawSrc(c,dx,dy,dw,dh){const r=cropRect();c.drawImage(srcEl(),r.x,r.y,r.w,r.h,dx,dy,dw,dh);}
// change zoom and carry the calibration across exactly, so the board stays aligned
function setZoom(z,cx,cy){
  const o=cropRect();if(!o.W)return;
  const full=CAL.pts.map(([u,v])=>[(o.x+u*o.w)/o.W,(o.y+v*o.h)/o.H]);
  ZOOM.z=Math.max(1,Math.min(5,z));
  const hw=.5/ZOOM.z;ZOOM.cx=Math.max(hw,Math.min(1-hw,cx??ZOOM.cx));ZOOM.cy=Math.max(hw,Math.min(1-hw,cy??ZOOM.cy));
  const n=cropRect();
  S.zooms=Object.assign({},S.zooms,{[SRC]:{...ZOOM}});
  setCal(full.map(([u,v])=>[(u*n.W-n.x)/n.w,(v*n.H-n.y)/n.h]));
  syncZoomUI();
}
// zoom so the whole board (plus a margin) fills the picture
function frameBoard(){
  if(!CAL.Hinv){toast('Align the board first');return;}
  const o=cropRect();let x0=1,y0=1,x1=0,y1=0;
  for(let k=0;k<48;k++){const a=k/48*TAU,[u,v]=applyH(CAL.Hinv,232*Math.sin(a),232*Math.cos(a));
    const fx=(o.x+u*o.w)/o.W,fy=(o.y+v*o.h)/o.H;x0=Math.min(x0,fx);x1=Math.max(x1,fx);y0=Math.min(y0,fy);y1=Math.max(y1,fy);}
  const z=Math.min(1/((x1-x0)*1.1),1/((y1-y0)*1.1));
  setZoom(z,(x0+x1)/2,(y0+y1)/2);
  // re-run the alignment on the sharper, zoomed picture; keep the carried-over one if that fails
  setTimeout(()=>autoAlign(true),400);
  toast(`Zoomed ${ZOOM.z.toFixed(1)}× onto the board`);
}
function syncZoomUI(){const el=$('#sZoom');if(!el)return;el.value=ZOOM.z;$('#vZoom').textContent=`(${ZOOM.z.toFixed(1)}×)`;}
async function startSource(v){
  stopCamera();
  if(v==='sim'){SRC='sim';}
  else{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Camera needs HTTPS (or localhost)');return;}
    const vc={width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}}; // extra pixels keep a zoomed-in crop sharp
    if(v&&v!=='default')vc.deviceId={exact:v};else vc.facingMode='environment';
    try{stream=await navigator.mediaDevices.getUserMedia({video:vc,audio:false});}
    catch(e){toast('Camera blocked: '+e.name);return;}
    video.srcObject=stream;try{await video.play();}catch(e){}
    SRC='cam';fillDevices(v);
  }
  Object.assign(ZOOM,{z:1,cx:.5,cy:.5},(S.zooms||{})[SRC]);syncZoomUI();
  setCal((CALS[SRC]||[]).slice());
  $('#simCtl').hidden=SRC!=='sim';
  setDet(CAL.H?'ready':'idle',CAL.H?'Ready · throw!':'Calibrate the camera to start auto-scoring');
  updatePill();
  if(!CAL.H)setTimeout(()=>{if(!CAL.H&&SRC!=='none')autoAlign(true).then(ok=>{if(ok)updatePill();});},1500);
}
// warp the calibrated camera frame into a face-on board image (each output pixel is a board mm position)
function captureBoardPhoto(){
  if(SRC==='none'||!CAL.Hinv)return false;
  let[w,h]=srcSize();if(!w)return false;
  w=Math.round(w);h=Math.round(h);
  const sc=document.createElement('canvas');sc.width=w;sc.height=h;
  const sx=sc.getContext('2d',{willReadFrequently:true});drawSrc(sx,0,0,w,h);
  const sd=sx.getImageData(0,0,w,h).data;
  const N=720,out=document.createElement('canvas');out.width=out.height=N;
  const oc=out.getContext('2d'),od=oc.createImageData(N,N),o=od.data,mm=460/N;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const bx=(x+.5)*mm-230,by=230-(y+.5)*mm,j=(y*N+x)*4;
    if(bx*bx+by*by>230*230){o[j+3]=255;continue;}
    const[u,v]=applyH(CAL.Hinv,bx,by),px=u*w-.5,py=v*h-.5,x0=Math.floor(px),y0=Math.floor(py);
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

function stopCamera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}video.srcObject=null;SRC='none';updatePill();}
async function fillDevices(selected){
  const sel=$('#srcSel');let cams=[];
  try{cams=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');}catch(e){}
  sel.innerHTML='<option value="default">Default camera</option>'+
    cams.map((d,i)=>`<option value="${esc(d.deviceId)}">${esc(d.label||('Camera '+(i+1)))}</option>`).join('')+
    '<option value="sim">Simulator (test without a camera)</option>';
  if(selected)sel.value=selected;else if(SRC==='sim')sel.value='sim';
}
function updatePill(){
  const p=$('#camPill');
  if(SRC==='none'){p.textContent='Camera off';p.className='pill';}
  else if(!CAL.H){p.textContent=(SRC==='sim'?'Simulator':'Camera')+' · not calibrated';p.className='pill warn';}
  else{p.textContent=(SRC==='sim'?'Simulator':'Camera')+' · auto-scoring';p.className='pill ok';}
  $('#nocam').hidden=SRC!=='none';
}
