// DartEye · Camera & calibration screen: camera tabs, calibration points, pinch zoom, detection settings
'use strict';

/* ---------- calibration screen (always shows the selected camera, CUR) ---------- */
let calOpen=false,drag=-1,calRect=null,loupe=null;
function openCal(){calOpen=true;$('#calView').hidden=false;fillDevices();syncSettingsUI();renderCamTabs();}
function closeCal(){calOpen=false;$('#calView').hidden=true;updatePill();render();}
function calHint(){
  const h=$('#calHint');
  if(!CUR){h.innerHTML='Pick a camera above and press <b>+ Add camera</b>. Add more cameras from different angles for better accuracy. On iPad, use a phone as a helper camera for extra angles.';return;}
  const n=CUR.cal.pts.length,which=CAMS.length>1?`Camera ${CAMS.indexOf(CUR)+1}: `:'';
  if(CUR.state==='lost'){h.innerHTML=`${which}this camera stopped. iPad Safari can only run one camera at a time: remove it, or use a phone as a helper camera.`;return;}
  h.innerHTML=n<4?`${which}press <b>✨ Auto-align</b>, or tap point <b>${n+1} of 4</b> yourself: the outer edge of the double ring <b>${CAL_NAMES[n]}</b>.`
    :`${which}calibrated ✓ Press <b>🎯 Frame board</b> to zoom in for sharper detection. Check the green wires sit on the real wires (drag a point to fine-tune). If the <b>20</b> label is on the wrong segment, use <b>⟲ 20 / 20 ⟳</b>. Then pull all darts and press <b>Board is empty ✓</b>: this also takes the photo of your board shown on the TV.`;
}
function drawCal(){
  const cv=$('#calCanvas'),r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  const c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.fillStyle='#000';c.fillRect(0,0,w,h);
  calHint();calRect=CUR?drawSourceInto(CUR,c,w,h):null;if(!calRect)return;
  drawWire(CUR,c,calRect,1.6*dpr);drawDetection(CUR,c,calRect);
  CUR.cal.pts.forEach(([u,v],i)=>{const x=calRect.x+u*calRect.w,y=calRect.y+v*calRect.h;
    c.strokeStyle='#ffc24b';c.lineWidth=2*dpr;c.beginPath();c.arc(x,y,12*dpr,0,Math.PI*2);c.stroke();
    c.beginPath();c.moveTo(x-5*dpr,y);c.lineTo(x+5*dpr,y);c.moveTo(x,y-5*dpr);c.lineTo(x,y+5*dpr);c.stroke();
    c.fillStyle='#ffc24b';c.font=`bold ${14*dpr}px system-ui`;c.fillText(i+1,x+16*dpr,y-12*dpr);});
  if(loupe!==null&&CUR.cal.pts[loupe]){ // magnifier while dragging, for sub-pixel placement
    const[u,v]=CUR.cal.pts[loupe],x=calRect.x+u*calRect.w,y=calRect.y+v*calRect.h,R0=70*dpr,z=4;
    const lx=Math.min(w-R0-8,Math.max(R0+8,x)),ly=y-R0*1.9<R0?y+R0*1.9:y-R0*1.9;
    c.save();c.beginPath();c.arc(lx,ly,R0,0,Math.PI*2);c.clip();
    c.drawImage(cv,x-R0/z,y-R0/z,2*R0/z,2*R0/z,lx-R0,ly-R0,2*R0,2*R0);
    c.strokeStyle='#ff3b4f';c.lineWidth=1.5*dpr;c.beginPath();c.moveTo(lx-R0,ly);c.lineTo(lx+R0,ly);c.moveTo(lx,ly-R0);c.lineTo(lx,ly+R0);c.stroke();
    c.restore();c.strokeStyle='#fff';c.lineWidth=2*dpr;c.beginPath();c.arc(lx,ly,R0,0,Math.PI*2);c.stroke();
  }
}
function calPointer(e){
  const cv=$('#calCanvas'),r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  const x=(e.clientX-r.left)*dpr,y=(e.clientY-r.top)*dpr;
  return calRect?[(x-calRect.x)/calRect.w,(y-calRect.y)/calRect.h,x,y]:null;
}
// one finger: tap/drag calibration points. Two fingers: pinch-zoom and pan. Wheel: zoom at the cursor.
const touches=new Map();let pinch=null,addedByTap=false,gestureLock=false;
const fullAt=(mx,my)=>{const o=cropRect(CUR);return[(o.x+(mx-calRect.x)/calRect.w*o.w)/o.W,(o.y+(my-calRect.y)/calRect.h*o.h)/o.H];};
function zoomKeeping(z,F,mx,my){ // zoom to z with full-frame point F staying under canvas point (mx,my)
  z=Math.max(1,Math.min(5,z));
  setZoom(CUR,z,F[0]-(mx-calRect.x)/calRect.w/z+.5/z,F[1]-(my-calRect.y)/calRect.h/z+.5/z);
}
const pinchInfo=()=>{const[a,b]=[...touches.values()];return{d:Math.hypot(a[0]-b[0],a[1]-b[1]),m:[(a[0]+b[0])/2,(a[1]+b[1])/2]};};
$('#calCanvas').addEventListener('pointerdown',e=>{
  const p=calPointer(e);if(!p||!CUR)return;
  e.target.setPointerCapture(e.pointerId);
  touches.set(e.pointerId,[p[2],p[3]]);
  if(touches.size===2){ // second finger: this is a pinch, undo anything the first finger started
    if(addedByTap)CUR.cal.pts.pop();
    drag=-1;loupe=null;addedByTap=false;gestureLock=true;
    const pi=pinchInfo();pinch={d:pi.d,z:CUR.zoom.z,F:fullAt(...pi.m)};
    return;
  }
  if(touches.size>2||gestureLock)return;
  const dpr=window.devicePixelRatio||1,pts=CUR.cal.pts;
  drag=pts.findIndex(([u,v])=>Math.hypot(calRect.x+u*calRect.w-p[2],calRect.y+v*calRect.h-p[3])<30*dpr);
  addedByTap=false;
  if(drag<0&&pts.length<4){pts.push([p[0],p[1]]);drag=pts.length-1;addedByTap=true;}
  if(drag>=0)loupe=drag;
});
$('#calCanvas').addEventListener('pointermove',e=>{
  if(!touches.has(e.pointerId)||!CUR)return;
  const p=calPointer(e);if(!p)return;
  touches.set(e.pointerId,[p[2],p[3]]);
  if(pinch&&touches.size>=2){const pi=pinchInfo();zoomKeeping(pinch.z*pi.d/Math.max(1,pinch.d),pinch.F,...pi.m);return;}
  if(drag>=0)CUR.cal.pts[drag]=[p[0],p[1]];
});
const endTouch=e=>{
  touches.delete(e.pointerId);
  if(pinch&&touches.size<2)pinch=null;
  if(drag>=0&&CUR){drag=-1;loupe=null;setCal(CUR,CUR.cal.pts.slice());}
  if(!touches.size){gestureLock=false;addedByTap=false;}
};
$('#calCanvas').addEventListener('pointerup',endTouch);
$('#calCanvas').addEventListener('pointercancel',endTouch);
$('#calCanvas').addEventListener('wheel',e=>{
  if(!CUR||!calRect)return;e.preventDefault();
  const cv=$('#calCanvas'),r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,mx=(e.clientX-r.left)*dpr,my=(e.clientY-r.top)*dpr;
  zoomKeeping(CUR.zoom.z*Math.exp(-e.deltaY*.0015),fullAt(mx,my),mx,my);
},{passive:false});
$('#sZoom').oninput=e=>{if(CUR)setZoom(CUR,+e.target.value);};
$('#btnFrame').onclick=()=>frameBoard(CUR);
$('#btnZoomReset').onclick=()=>{if(CUR)setZoom(CUR,1,.5,.5);};
$('#camTabs').onclick=e=>{const b=e.target.closest('[data-cam]');if(b)selectCam(CAMS.find(c=>String(c.id)===b.dataset.cam));};

function syncSettingsUI(){
  $('#sDiff').value=70-S.diffT;$('#vDiff').textContent=`(${70-S.diffT})`;
  $('#sMin').value=S.minPix;$('#vMin').textContent=`(${S.minPix})`;
  $('#sStable').value=S.stableFrames;$('#vStable').textContent=`(${S.stableFrames})`;
  $('#sTip').value=S.tipMode;$('#sDebug').checked=S.debug;$('#sBoard').value=S.boardStyle;syncZoomUI();
}
$('#sDiff').oninput=e=>{S.diffT=70-+e.target.value;syncSettingsUI();persist();};
$('#sMin').oninput=e=>{S.minPix=+e.target.value;syncSettingsUI();persist();};
$('#sStable').oninput=e=>{S.stableFrames=+e.target.value;syncSettingsUI();persist();};
$('#sTip').onchange=e=>{S.tipMode=e.target.value;persist();};
$('#sDebug').onchange=e=>{S.debug=e.target.checked;persist();};
