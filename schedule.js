/* Shining Road — lịch chia việc dùng chung cho app và Cloud Functions.
   Cùng input (ngày, số người) luôn ra cùng kết quả trên mọi máy. */
(function(root){
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=(g,h,e)=>({g,h:h||0,e:e||0});
const EPOCH=Date.UTC(2024,0,1); // một ngày thứ Hai
function dayNum(key){const[y,m,d]=key.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-EPOCH)/864e5)}
const DAILY_REST=[{t:"Quét nhà",i:"broom",r:R(15)},{t:"Vứt rác & thay túi",i:"trash",r:R(5)},{t:"Xếp bát đĩa lên kệ",i:"plates",r:R(5)}];
function genDay(key,N){N=Math.max(1,N);const rnd=rng(+key.replace(/-/g,''));
  const cook=Math.floor(rnd()*N),laundry=Math.floor(rnd()*N),wash=N>1?(cook+1+Math.floor(rnd()*(N-1)))%N:0;
  const q=Array.from({length:N},()=>[]),load=Array(N).fill(0);
  const add=(p,o)=>{o.id=key+'-'+o.t;q[p].push(o);load[p]+=o.r.g};
  add(cook,{t:"Nấu bữa tối",i:"pot",cook:true,r:R(15)});
  add(wash,{t:"Rửa bát & dọn bếp",i:"dish",r:R(25)});
  add(laundry,{t:"Giặt quần áo",i:"shirt",r:R(10)});add(laundry,{t:"Phơi quần áo",i:"hanger",r:R(10)});
  const rest=DAILY_REST.map(o=>({...o,r:{...o.r}}));
  if(dayNum(key)%3===0)rest.unshift({t:"Lau sàn thật thơm",boss:"dust",r:R(30,1),hp:1});
  rest.forEach(o=>add(load.indexOf(Math.min(...load)),o));
  return q}
const weekOwner=(mondayKey,N)=>((Math.floor(dayNum(mondayKey)/7))%N+N)%N;
const monthOwner=(y,m,N)=>((y*12+m)%N+N)%N;
const api={rng,R,genDay,dayNum,weekOwner,monthOwner};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SCHED=api;
})(typeof self!=='undefined'?self:this);
