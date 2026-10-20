// DartEye · Caller voice
'use strict';

/* ---------- caller voice ---------- */
let voiceReady=false;
// Our own queue: Safari (especially on iPad) drops phrases queued back-to-back, and can garbage-collect an
// utterance before it plays. So speak one at a time, keep a reference until it ends, with a timeout fallback.
const sayQ=[];let sayNow=null,sayTimer=0;
function say(t,important=true){
  if(!S.voice||!t||!window.speechSynthesis)return;
  sayQ.push({t,important});
  // fast play shouldn't build a backlog: drop single-dart calls first, never totals or "you require"
  while(sayQ.length>3){const i=sayQ.findIndex(x=>!x.important);if(i<0)break;sayQ.splice(i,1);}
  sayNext();
}
function sayNext(){
  if(sayNow||!sayQ.length)return;
  const u=new SpeechSynthesisUtterance(sayQ.shift().t);
  u.lang='en-GB';u.rate=1.05;sayNow=u;
  const done=()=>{if(sayNow!==u)return;sayNow=null;clearTimeout(sayTimer);setTimeout(sayNext,120);};
  u.onend=done;u.onerror=done;
  sayTimer=setTimeout(done,2500+u.text.length*90);
  try{speechSynthesis.speak(u);}catch(e){done();}
}
function dartWords(h){
  if(h.mult===0)return h.bo?'bounce out':'miss';
  if(h.seg===25)return h.mult===2?'bullseye':'twenty five';
  return(['','','double ','treble '][h.mult])+h.seg;
}
function turnWords(n){return n===180?'One hundred and eighty!':n===0?'No score':String(n);}
