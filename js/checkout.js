// DartEye · Checkout suggestions
'use strict';

/* ---------- checkout suggestions ---------- */
const ORDER=[20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
const THROWS=[...ORDER.map(s=>mk(s,3)),mk(25,1),...ORDER.map(s=>mk(s,1)),mk(25,2),...ORDER.map(s=>mk(s,2))];
const DOUBLES=[20,16,18,12,10,8,14,6,4,2,19,17,15,13,11,9,7,5,3,1].map(s=>mk(s,2)).concat([mk(25,2)]);
function anyRoute(s,k){
  if(k===0)return s===0?[]:null;
  for(const t of THROWS){if(t.value>s)continue;const r=anyRoute(s-t.value,k-1);if(r)return[t,...r];}
  return null;
}
const coCache=new Map();
function checkout(score,left,dbl){
  const key=score+'|'+left+'|'+dbl;if(coCache.has(key))return coCache.get(key);
  let res=null;
  // finish on the preferred double, set up with as few darts as possible; with 3 darts, lead with the heaviest scoring dart
  const two=(s,n)=>{for(const f of(dbl?DOUBLES:THROWS)){if(f.value>s)continue;const r=anyRoute(s-f.value,n-1);if(r)return[...r,f];}return null;};
  if(score<=170&&left>0&&!(dbl&&score<2)){
    res=two(score,1)||(left>=2&&two(score,2));
    if(!res&&left>=3)for(const t of THROWS){if(t.value>=score)continue;const r=two(score-t.value,2);if(r){res=[t,...r];break;}}
    res=res||null;
  }
  coCache.set(key,res);return res;
}
