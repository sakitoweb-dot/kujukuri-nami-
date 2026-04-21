const SPOTS=[
  {name:"片貝新堤", lat:35.5350,lon:140.4680},
  {name:"作田",     lat:35.5200,lon:140.4900},
  {name:"豊海海岸", lat:35.4900,lon:140.5100},
  {name:"白子",     lat:35.4500,lon:140.5200},
  {name:"一松",     lat:35.4100,lon:140.5400},
  {name:"白里",     lat:35.3700,lon:140.5500},
  {name:"中里",     lat:35.4300,lon:140.5300},
  {name:"不動堂",   lat:35.5000,lon:140.5000},
  {name:"蓮沼",     lat:35.5600,lon:140.4500},
  {name:"片貝漁港", lat:35.5450,lon:140.4600},
];
let cur=0;
const favs=new Set();

const spotsEl=document.getElementById('spots');
SPOTS.forEach((s,i)=>{
  const b=document.createElement('button');
  b.className='stab'+(i===0?' active':'');
  b.textContent=s.name;
  b.onclick=()=>{cur=i;document.querySelectorAll('.stab').forEach((x,j)=>x.classList.toggle('active',j===i));loadData();};
  spotsEl.appendChild(b);
});

const favcEl=document.getElementById('favchips');
SPOTS.forEach((s,i)=>{
  const c=document.createElement('div');
  c.className='fchip';c.textContent=s.name;
  c.onclick=()=>{if(favs.has(i)){favs.delete(i);c.classList.remove('on');}else{favs.add(i);c.classList.add('on');}};
  favcEl.appendChild(c);
});

function windDir(d){const a=["北","北北東","北東","東北東","東","東南東","南東","南南東","南","南南西","南西","西南西","西","西北西","北西","北北西"];return a[Math.round(d/22.5)%16];}

function estimateWave(w,h){
  const base=w<10?0.3:w<20?0.4+(w-10)*0.03:w<30?0.7+(w-20)*0.05:w<40?1.2+(w-30)*0.07:Math.min(3.5,1.9+(w-40)*0.05);
  const tc=(h>=6&&h<=9)?0.85:(h>=14&&h<=18)?1.1:1.0;
  return Math.round(base*tc*10)/10;
}
function estimatePeriod(h){return Math.round(4.4*Math.sqrt(Math.max(0.1,h)));}
function surfScore(h,p,ws){
  let s=0;
  if(h>=0.5&&h<=2.0)s+=40;else if(h>2.0&&h<=3.0)s+=25;else if(h>0.3)s+=15;
  if(p>=8&&p<=14)s+=30;else if(p>=6)s+=18;else if(p>=4)s+=8;
  if(ws<15)s+=30;else if(ws<25)s+=20;else if(ws<35)s+=10;
  return Math.min(100,Math.round(s));
}
function condOf(sc){return sc>=70?{t:"グッド 🤙",c:"cg"}:sc>=40?{t:"まずまず",c:"cf"}:{t:"物足りない",c:"cp"};}
function dotOf(sc){return sc>=70?"dg":sc>=40?"df":"dp";}
function setArc(sc){
  const o=239-(239*sc/100);
  const a=document.getElementById('arc');
  a.style.strokeDashoffset=o;
  a.style.stroke=sc>=70?"#06D6A0":sc>=40?"#FFD166":"#EF476F";
}
function bestTime(heights,winds){
  let bi=-1,bs=-1;
  heights.slice(5,19).forEach((h,i)=>{
    const s=surfScore(h||0,estimatePeriod(h||0),winds[i+5]||15);
    if(s>bs){bs=s;bi=i+5;}
  });
  return bi<0?"--":`${bi}:00〜${bi+2}:00`;
}

async function loadData(){
  const sp=SPOTS[cur];
  const btn=document.getElementById('rbtn');
  btn.classList.add('loading');
  btn.innerHTML='<span class="spin">↻</span> 取得中...';

  let waveH=null,waveP=null,waveHourly=null,waveHmax=null,wavePmax=null,isReal=false;

  try{
    const mr=await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${sp.lat}&longitude=${sp.lon}&hourly=wave_height,wave_period&daily=wave_height_max,wave_period_max&timezone=Asia%2FTokyo&forecast_days=3`,{signal:AbortSignal.timeout(6000)});
    const md=await mr.json();
    if(!md.error&&md.hourly?.wave_height){
      const hi=new Date().getHours();
      waveH=md.hourly.wave_height[hi];
      waveP=md.hourly.wave_period[hi];
      waveHourly=md.hourly.wave_height;
      waveHmax=md.daily?.wave_height_max;
      wavePmax=md.daily?.wave_period_max;
      if(waveH!=null)isReal=true;
    }
  }catch(e){}

  let windH=[],windD=[],tempH=[],windHmax=[];
  try{
    const wr=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${sp.lat}&longitude=${sp.lon}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m&daily=wind_speed_10m_max&timezone=Asia%2FTokyo&forecast_days=3`,{signal:AbortSignal.timeout(6000)});
    const wd=await wr.json();
    windH=wd.hourly?.wind_speed_10m||[];
    windD=wd.hourly?.wind_direction_10m||[];
    tempH=wd.hourly?.temperature_2m||[];
    windHmax=wd.daily?.wind_speed_10m_max||[];
  }catch(e){}

  const hi=new Date().getHours();
  const ws=windH[hi]??15;
  const wdeg=windD[hi]??null;
  const tmp=tempH[hi]??null;

  if(waveH==null){
    waveH=estimateWave(ws,hi);
    waveP=estimatePeriod(waveH);
    waveHourly=windH.slice(0,24).map((w,i)=>estimateWave(w||15,i));
    waveHmax=windHmax.length>0?windHmax.map(w=>estimateWave(w||15,12)):[waveH,waveH*0.9,waveH*1.1];
    wavePmax=waveHmax.map(h=>estimatePeriod(h));
  }

  const sc=surfScore(waveH,waveP,ws);
  const cond=condOf(sc);
  document.getElementById('rval').textContent=sc;
  document.getElementById('hspot').textContent=sp.name;
  const hc=document.getElementById('hcond');hc.textContent=cond.t;hc.className=`hcond ${cond.c}`;
  setArc(sc);
  document.getElementById('hbt').innerHTML=`ベストタイム: <strong>${bestTime(waveHourly,windH)}</strong>`;

  document.getElementById('sv-h').textContent=waveH.toFixed(1);
  document.getElementById('sv-p').textContent=Math.round(waveP);
  document.getElementById('sv-w').textContent=Math.round(ws);
  document.getElementById('sv-wd').textContent=wdeg!=null?windDir(wdeg):'km/h';
  document.getElementById('sv-t').textContent=tmp!=null?tmp.toFixed(1):'--';

  const sh=document.getElementById('src-h'),sp2=document.getElementById('src-p');
  sh.className='src-badge '+(isReal?'src-real':'src-est');sh.textContent=isReal?'実測値':'推定値';
  sp2.className='src-badge '+(isReal?'src-real':'src-est');sp2.textContent=isReal?'実測値':'推定値';
  document.getElementById('src-note').textContent=isReal
    ?'✅ 波高・周期は海洋気象データの実測値です。'
    :'⚡ 波高・周期は風速・風向・時刻から推定した値です。実際と多少異なる場合があります。';

  renderBars(waveHourly.slice(0,24),windH,hi);
  renderForecast(waveHmax,wavePmax,windHmax);

  const now=new Date();
  document.getElementById('upd').textContent=`${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} 更新`;
  document.getElementById('credit').textContent=isReal?'データ: Open-Meteo Marine API（実測・無料）':'データ: Open-Meteo Weather API + 独自推定式';

  btn.classList.remove('loading');btn.textContent='最新データを取得 ↻';
}

function renderBars(heights,winds,nowIdx){
  const el=document.getElementById('hbars'),be=document.getElementById('bands');
  el.innerHTML='';be.innerHTML='';
  const max=Math.max(...heights.map(h=>Number(h)||0),0.1);
  heights.forEach((h,i)=>{
    const hv=Number(h)||0;
    const w=document.createElement('div');w.className='hbw';
    const b=document.createElement('div');b.className='hb'+(i===nowIdx?' now':'');
    b.style.height=Math.round((hv/max)*56+2)+'px';
    const l=document.createElement('div');l.className='hbl';l.textContent=i%6===0?i+'h':'';
    w.appendChild(b);w.appendChild(l);el.appendChild(w);
    const bd=document.createElement('div');
    const sc=surfScore(hv,estimatePeriod(hv),winds[i]||15);
    bd.className='band '+(sc>=70?'bg2':sc>=40?'bf2':'bp2');
    be.appendChild(bd);
  });
}

function renderForecast(hmax,pmax,wmax){
  const el=document.getElementById('fclist');el.innerHTML='';
  const days=['今日','明日','明後日'];
  (hmax||[]).slice(0,3).forEach((h,i)=>{
    const hv=Number(h)||0;
    const p=Number(pmax?.[i])||estimatePeriod(hv);
    const ws=Number(wmax?.[i])||15;
    const sc=surfScore(hv,p,ws);
    const row=document.createElement('div');row.className='fcrow';
    row.innerHTML=`<span class="fcd">${days[i]}</span><span class="fcdot ${dotOf(sc)}"></span><span class="fch">${hv.toFixed(1)} m</span><span class="fcp">周期 ${Math.round(p)}秒</span><span class="fcs">${sc}pt</span>`;
    el.appendChild(row);
  });
}

loadData();
setInterval(loadData,30*60*1000);
