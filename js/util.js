// DartEye · DOM helpers, saved settings and storage
'use strict';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));

/* ---------- storage ---------- */
const KEY='darteye.v1';
const saved=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}})();
const S=Object.assign({diffT:24,minPix:40,stableFrames:4,tipMode:'auto',voice:true,showCam:true,debug:false,boardStyle:'photo'},saved.settings||{});
// straightened photo of the player's own board, captured from the camera after calibration
const PHOTO={img:null};
try{const u=localStorage.getItem(KEY+'.photo');if(u){const im=new Image();im.onload=()=>{PHOTO.img=im;if(typeof G!=='undefined'&&G)render();};im.src=u;}}catch(e){}
const CALS=Object.assign({cam:[],sim:[]},saved.cals||{});
let lastCfg=saved.cfg||{mode:'x01',opts:{start:501,out:'double'},names:['Player 1','Player 2']};
function persist(){try{localStorage.setItem(KEY,JSON.stringify({settings:S,cals:CALS,cfg:lastCfg}))}catch(e){}}
