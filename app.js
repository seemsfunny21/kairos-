(()=>{
  'use strict';
  const PLACE_KEY='kairos-place-v1';
  const CACHE_PREFIX='kairos-forecast-v1-';
  const DEFAULT_PLACE={name:'Ιωάννινα',region:'Ήπειρος',country:'Ελλάδα',latitude:39.665,longitude:20.8537};
  const MAX_CACHE_AGE_MS=15*60*1000;
  const FORECAST_URL='https://api.open-meteo.com/v1/forecast';
  const SEARCH_URL='https://geocoding-api.open-meteo.com/v1/search';
  const $=id=>document.getElementById(id);
  const state={place:loadPlace(),data:null,updated:0,loading:false,requestVersion:0,abort:null,searchAbort:null,searchTimer:null};

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>Number.isFinite(Number(value))&&value!==null?Number(value):null;
  const rounded=(v,fallback='--')=>num(v)===null?fallback:Math.round(Number(v));
  const timeShort=t=>typeof t==='string'&&t.length>=16?t.slice(11,16):'--:--';
  const dateTimeShort=t=>typeof t==='string'&&t.length>=16?t.slice(8,10)+'/'+t.slice(5,7)+' '+t.slice(11,16):'--';
  const dayName=(date,index=-1)=>{
    if(index===0)return 'Σήμερα';
    if(index===1)return 'Αύριο';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '—';
    return new Intl.DateTimeFormat('el-GR',{weekday:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  };
  const dateDay=date=>new Intl.DateTimeFormat('el-GR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const hourNow=()=>new Date().toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'});
  const safeNumber=(n,defaultNumber)=>Number.isFinite(n)?n:defaultNumber;
  const findHourlyIndex=hourly=>{
    if(!hourly||!Array.isArray(hourly.time))return 0;
    const current=state.data?.current?.time||'';
    const key=current.slice(0,13);
    const idx=hourly.time.findIndex(t=>t.slice(0,13)>=key);
    return idx<0?0:idx;
  };
  function loadPlace(){
    try{const item=JSON.parse(localStorage.getItem(PLACE_KEY)||'null');if(item&&typeof item.name==='string'&&Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)&&Math.abs(item.latitude)<=90&&Math.abs(item.longitude)<=180)return item;}catch(_){}
    return {...DEFAULT_PLACE};
  }
  function cacheKey(place=state.place){return CACHE_PREFIX+Number(place.latitude).toFixed(3)+','+Number(place.longitude).toFixed(3)}
  function loadCache(){
    try{const entry=JSON.parse(localStorage.getItem(cacheKey())||'null');if(entry&&entry.data&&entry.data.current&&entry.data.hourly&&entry.data.daily){state.data=entry.data;state.updated=entry.updated||0;return true;}}catch(_){}
    return false;
  }
  function storeCache(){
    try{localStorage.setItem(cacheKey(),JSON.stringify({updated:state.updated,data:state.data}));}catch(_){}
  }
  const codeType=c=>{
    const code=num(c);
    if(code===0)return {label:'Αίθριος καιρός',icon:'☀️',kind:'sun'};
    if(code===1)return {label:'Κυρίως αίθριος',icon:'🌤️',kind:'sun'};
    if(code===2)return {label:'Λίγα σύννεφα',icon:'⛅',kind:'cloud'};
    if(code===3)return {label:'Συννεφιά',icon:'☁️',kind:'cloud'};
    if(code===45||code===48)return {label:'Ομίχλη',icon:'🌫️',kind:'fog'};
    if(code!==null&&code>=51&&code<=57)return {label:'Ψιχάλα',icon:'🌦️',kind:'rain'};
    if(code!==null&&code>=61&&code<=67)return {label:'Βροχή',icon:'🌧️',kind:'rain'};
    if(code!==null&&code>=71&&code<=77)return {label:'Χιονόπτωση',icon:'🌨️',kind:'snow'};
    if(code!==null&&code>=80&&code<=82)return {label:'Μπόρες',icon:'🌦️',kind:'rain'};
    if(code!==null&&code>=85&&code<=86)return {label:'Χιονομπόρες',icon:'🌨️',kind:'snow'};
    if(code!==null&&code>=95)return {label:'Καταιγίδα',icon:'⛈️',kind:'storm'};
    return {label:'Καιρικές συνθήκες',icon:'🌥️',kind:'cloud'};
  };
  function bigIcon(code,isDay){
    const {kind}=codeType(code);
    const sun=(isDay===0)?'<path d="M47 10a17 17 0 1 0 18 26 21 21 0 1 1-18-26" fill="#dbebff"/>':'<circle cx="60" cy="30" r="19" fill="#ffd37b"/><g stroke="#ffdf97" stroke-width="3" stroke-linecap="round"><path d="M60 2v7M60 52v7M88 30h-7M38 30h-7M81 9l-6 6M45 45l-6 6M80 51l-5-6M45 15l-6-6"/></g>';
    if(kind==='sun')return `<svg viewBox="0 0 100 100" aria-hidden="true">${sun}</svg>`;
    const cloud='<path d="M27 73h49c12 0 18-10 16-20-2-11-12-17-24-14-6-12-24-15-35-6-6 5-8 11-8 16-11-3-22 4-22 14 0 8 7 10 24 10" fill="#e2f4ff" stroke="#9dcff0" stroke-width="1.5"/>';
    const base=`<svg viewBox="0 0 100 100" aria-hidden="true">${isDay===0?sun:kind==='cloud'?sun:''}${cloud}`;
    if(kind==='rain'||kind==='storm')return `${base}<path d="M32 83l-4 8M51 83l-4 8M70 83l-4 8" stroke="#66c8ff" stroke-width="4" stroke-linecap="round"/>${kind==='storm'?'<path d="M61 72l-8 15h8l-7 11" stroke="#ffd98b" stroke-width="4" fill="none"/>':''}</svg>`;
    if(kind==='snow')return `${base}<g fill="#9bdfff"><circle cx="32" cy="87" r="3"/><circle cx="53" cy="89" r="3"/><circle cx="73" cy="87" r="3"/></g></svg>`;
    return base+'</svg>';
  }
  function setStatus(message,isFresh=false){
    $('updateStatus').textContent=message;
    $('liveDot').classList.toggle('stale',!isFresh);
  }
  function uiLoading(busy){
    state.loading=busy;
    $('refreshBtn').disabled=busy;
    $('refreshBtn').classList.toggle('busy',busy);
  }
  function render(){
    const data=state.data; if(!data?.current||!data.daily||!data.hourly)return;
    const current=data.current,day=data.daily,hour=data.hourly;
    const currentIdx=findHourlyIndex(hour);
    const info=codeType(current.weather_code);
    $('locationName').textContent=state.place.name;
    $('locationRegion').textContent=[state.place.region,state.place.country].filter(Boolean).join(' · ').toUpperCase()||'ΤΟΠΟΘΕΣΙΑ';
    $('dateLine').textContent=dateDay((current.time||'').slice(0,10));
    $('currentTemp').textContent=rounded(current.temperature_2m);
    $('weatherDescription').textContent=info.label;
    $('heroWeatherIcon').innerHTML=bigIcon(current.weather_code,current.is_day);
    $('hero').classList.toggle('night',current.is_day===0);
    $('feelsLike').textContent='Αίσθηση '+rounded(current.apparent_temperature)+'°';
    $('dayRange').textContent='Μέγιστη '+rounded(day.temperature_2m_max?.[0])+'° · Ελάχιστη '+rounded(day.temperature_2m_min?.[0])+'°';
    const hourlyRain=hour.precipitation_probability?.[currentIdx];
    $('rainChance').textContent=rounded(hourlyRain)+'%';
    $('rainInfo').textContent='Πρόγνωση για '+timeShort(hour.time?.[currentIdx]);
    $('windSpeed').innerHTML=rounded(current.wind_speed_10m)+' <em>km/h</em>';
    $('gustInfo').textContent='Ριπές '+rounded(current.wind_gusts_10m)+' km/h';
    $('humidity').textContent=rounded(current.relative_humidity_2m)+'%';
    const uv=hour.uv_index?.[currentIdx];
    $('uvValue').textContent=uv==null?'--':Number(uv).toFixed(1);
    $('uvInfo').textContent=num(uv)==null?'Τρέχουσα ώρα':Number(uv)>=6?'Υψηλή έκθεση':Number(uv)>=3?'Μέτρια έκθεση':'Χαμηλή έκθεση';
    $('sunrise').textContent=timeShort(day.sunrise?.[0]);
    $('sunset').textContent=timeShort(day.sunset?.[0]);
    renderHourly(hour,currentIdx);renderDaily(day);renderCycling(hour,currentIdx);
    setStatus('Ενημέρωση '+hourNowFromTimestamp(state.updated)+' · Open-Meteo',Date.now()-state.updated<60*60*1000);
  }
  function hourNowFromTimestamp(ms){return ms?new Date(ms).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'}):'--:--'}
  function renderHourly(hour,start){
    const count=Math.min(12,Math.max(0,(hour.time||[]).length-start));
    if(!count){$('hourlyRows').innerHTML='<p class="placeholder">Δεν υπάρχουν διαθέσιμα ωριαία δεδομένα.</p>';return;}
    let markup='';
    for(let j=0;j<count;j++){
      const i=start+j;
      const code=codeType(hour.weather_code?.[i]);
      markup+=`<div class="hour-card ${j===0?'current':''}" title="${esc(code.label)}"><div class="hour-label">${j===0?'Τώρα':esc(timeShort(hour.time?.[i]))}</div><span class="hour-icon" aria-hidden="true">${code.icon}</span><strong>${rounded(hour.temperature_2m?.[i])}°</strong><span class="rain-tiny">☔ ${rounded(hour.precipitation_probability?.[i])}%</span></div>`;
    }
    $('hourlyRows').innerHTML=markup;
  }
  function renderDaily(day){
    const dates=day.time||[];
    if(!dates.length){$('dailyRows').innerHTML='<p class="placeholder">Δεν υπάρχουν διαθέσιμες ημέρες.</p>';return;}
    let markup='';
    for(let i=0;i<Math.min(7,dates.length);i++){
      const icon=codeType(day.weather_code?.[i]);
      markup+=`<div class="day-row" title="${esc(icon.label)}"><span class="day-name">${esc(dayName(dates[i],i))}</span><span class="day-icon" aria-hidden="true">${icon.icon}</span><span class="minmax">${rounded(day.temperature_2m_max?.[i])}° <span>${rounded(day.temperature_2m_min?.[i])}°</span></span><span class="day-rain">☔${rounded(day.precipitation_probability_max?.[i])}%</span><span class="day-wind">${rounded(day.wind_speed_10m_max?.[i])} km/h</span></div>`;
    }
    $('dailyRows').innerHTML=markup;
  }
  function scoreHour(hour,i){
    const temp=num(hour.temperature_2m?.[i]);
    const rain=num(hour.precipitation_probability?.[i]);
    const mm=num(hour.precipitation?.[i]);
    const wind=num(hour.wind_speed_10m?.[i]);
    const gust=num(hour.wind_gusts_10m?.[i]);
    if(temp==null||rain==null||wind==null)return null;
    if(hour.is_day&&hour.is_day[i]===0)return null;
    let score=100;
    score-=Math.max(0,rain-10)*.62;
    if((mm||0)>.2)score-=18;
    score-=Math.max(0,wind-12)*1.3;
    score-=Math.max(0,(gust??wind)-23)*.72;
    if(temp<12)score-=(12-temp)*2.2;
    if(temp>26)score-=(temp-26)*3;
    const code=num(hour.weather_code?.[i]);
    if(code!=null&&code>=95)score-=40;
    if(code!=null&&code>=71&&code<=86)score-=28;
    return Math.max(0,Math.round(score));
  }
  function cyclingLabel(score){return score>=78?['Πολύ καλό','pill-good']:score>=57?['Καλό','pill-blue']:score>=37?['Μέτριο','pill-mid']:['Δύσκολο','pill-bad']}
  function renderCycling(hour,start){
    const quality=$('rideQuality');
    const currentScore=scoreHour(hour,start);
    const nowLabel=currentScore===null?'Εκτός ημέρας':cyclingLabel(currentScore)[0];
    const nowClass=currentScore===null?'pill-blue':cyclingLabel(currentScore)[1];
    quality.className='pill '+nowClass;quality.textContent=nowLabel;
    const all=[];
    for(let i=start;i<Math.min(hour.time?.length||0,start+48)-1;i++){
      const a=scoreHour(hour,i),b=scoreHour(hour,i+1);
      if(a==null||b==null)continue;
      const low=Math.min(a,b),high=Math.max(a,b);
      const score=Math.max(0,Math.round(low*.65+high*.35));
      all.push({i,score});
    }
    const selected=[];
    all.sort((a,b)=>b.score-a.score||a.i-b.i);
    for(const item of all){
      if(selected.every(s=>Math.abs(s.i-item.i)>=3)){selected.push(item);if(selected.length===3)break;}
    }
    selected.sort((a,b)=>a.i-b.i);
    if(!selected.length){
      $('rideWindows').innerHTML='<div class="placeholder">Δεν υπάρχουν αρκετά δεδομένα για προτεινόμενες ώρες.</div>';
      $('cyclingMessage').textContent='Η αξιολόγηση θα γίνει όταν υπάρχουν επαρκή δεδομένα φωτός ημέρας και πρόγνωσης.';
      return;
    }
    const today=(state.data?.current?.time||'').slice(0,10);
    const tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
    const tomorrowISO=tomorrow.toISOString().slice(0,10);
    const readableDay=t=>t===today?'Σήμερα':t===tomorrowISO?'Αύριο':dayName(t);
    $('rideWindows').innerHTML=selected.map(item=>{
      const t=hour.time[item.i],t2=hour.time[item.i+2]||hour.time[item.i+1];
      const label=cyclingLabel(item.score)[0];
      return `<div class="ride-window"><span class="ride-day">${esc(readableDay(t.slice(0,10)))}</span><strong>${esc(timeShort(t))}–${esc(timeShort(t2))}</strong><small>${esc(label)}</small><div class="ride-score">${item.score}/100</div></div>`;
    }).join('');
    const best=selected.reduce((x,y)=>x.score>y.score?x:y);
    const msg=best.score>=78?'Υπάρχουν ώρες με ευνοϊκή πρόγνωση για ποδήλατο.':best.score>=57?'Υπάρχουν σχετικά καλές ώρες, αλλά έλεγξε άνεμο και βροχή.':'Η πρόγνωση δείχνει δυσκολότερες συνθήκες για ποδηλασία.';
    $('cyclingMessage').textContent=msg+' Καλύτερα δίωρα των επόμενων 48 ωρών:';
  }
  async function refresh(force=false){
    if(state.loading&&!force)return;
    if(!force&&state.data&&Date.now()-state.updated<MAX_CACHE_AGE_MS)return;
    if(state.abort)state.abort.abort();
    const version=++state.requestVersion;
    const controller=new AbortController();state.abort=controller;
    const timeout=setTimeout(()=>controller.abort(),10000);
    uiLoading(true);
    if(!state.data)setStatus('Λήψη πρόγνωσης…');
    try{
      const url=new URL(FORECAST_URL);
      const params={latitude:state.place.latitude,longitude:state.place.longitude,timezone:'auto',forecast_days:7,wind_speed_unit:'kmh',temperature_unit:'celsius',precipitation_unit:'mm',current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover',hourly:'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index,is_day',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset'};
      for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
      const res=await fetch(url,{signal:controller.signal,cache:'no-store'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const data=await res.json();
      if(!data.current||!data.hourly?.time?.length||!data.daily?.time?.length)throw Error('Ελλιπής πρόγνωση');
      if(version!==state.requestVersion)return;
      state.data=data;state.updated=Date.now();storeCache();render();
    }catch(e){
      if(version!==state.requestVersion)return;
      if(e.name==='AbortError'&&!state.data)setStatus('Η ενημέρωση άργησε. Δοκίμασε ανανέωση.');
      else if(state.data)setStatus('Αποθηκευμένη πρόγνωση · Δεν έγινε νέα ενημέρωση');
      else {setStatus('Χωρίς δεδομένα. Πάτησε ανανέωση.');$('weatherDescription').textContent='Δεν ήταν δυνατή η φόρτωση';}
      $('liveDot').classList.add('stale');
    }finally{
      clearTimeout(timeout);
      if(version===state.requestVersion){state.abort=null;uiLoading(false);}
    }
  }
  function changePlace(place){
    if(!place||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))return;
    state.requestVersion++;
    if(state.abort)state.abort.abort();
    state.loading=false;
    state.place={...place};
    try{localStorage.setItem(PLACE_KEY,JSON.stringify(state.place));}catch(_){}
    state.data=null;state.updated=0;
    $('locationName').textContent=state.place.name;
    $('currentTemp').textContent='--';
    $('weatherDescription').textContent='Φόρτωση πρόγνωσης…';
    $('hourlyRows').innerHTML='<div class="placeholder">Αναμονή πρόγνωσης…</div>';
    $('dailyRows').innerHTML='<div class="placeholder">Αναμονή πρόγνωσης…</div>';
    $('rideWindows').innerHTML='<div class="placeholder">Αναμονή πρόγνωσης…</div>';
    closeDialog();
    if(loadCache())render();
    refresh(!state.data);
  }
  const dialog=$('cityDialog');
  function openDialog(){dialog.hidden=false;$('citySearch').value='';$('searchResults').innerHTML='<p>Πληκτρολόγησε τουλάχιστον 2 γράμματα.</p>';window.setTimeout(()=>$('citySearch').focus(),30);}
  function closeDialog(){dialog.hidden=true;if(state.searchAbort)state.searchAbort.abort();clearTimeout(state.searchTimer);$('locationBtn').focus();}
  async function searchCities(q){
    if(state.searchAbort)state.searchAbort.abort();
    const controller=new AbortController();state.searchAbort=controller;
    $('searchResults').innerHTML='<p>Αναζήτηση…</p>';
    try{
      const url=new URL(SEARCH_URL);url.searchParams.set('name',q);url.searchParams.set('count','8');url.searchParams.set('language','el');url.searchParams.set('format','json');
      const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Αποτυχία αναζήτησης');
      const data=await response.json();
      if(controller!==state.searchAbort||dialog.hidden)return;
      const results=(data.results||[]).filter(r=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude));
      if(!results.length){$('searchResults').innerHTML='<p>Δεν βρέθηκαν πόλεις. Δοκίμασε άλλη γραφή.</p>';return;}
      const holder=$('searchResults');holder.replaceChildren();
      for(const r of results){
        const button=document.createElement('button');button.className='search-result';button.type='button';
        const details=document.createElement('span');const name=document.createElement('strong');name.textContent=r.name||'Πόλη';
        const desc=document.createElement('small');desc.textContent=[r.admin1,r.country].filter(Boolean).join(' · ');
        details.append(name,desc);const arrow=document.createElement('span');arrow.className='arrow';arrow.textContent='›';button.append(details,arrow);
        button.addEventListener('click',()=>changePlace({name:r.name,region:r.admin1||'',country:r.country||'',latitude:r.latitude,longitude:r.longitude}));holder.appendChild(button);
      }
    }catch(e){if(e.name!=='AbortError'&&controller===state.searchAbort)$('searchResults').innerHTML='<p>Δεν έγινε αναζήτηση. Έλεγξε τη σύνδεση.</p>';}
  }
  $('citySearch').addEventListener('input',()=>{
    clearTimeout(state.searchTimer);
    const q=$('citySearch').value.trim();
    if(q.length<2){if(state.searchAbort)state.searchAbort.abort();$('searchResults').innerHTML='<p>Πληκτρολόγησε τουλάχιστον 2 γράμματα.</p>';return;}
    state.searchTimer=setTimeout(()=>searchCities(q),350);
  });
  $('gpsBtn').addEventListener('click',()=>{
    const btn=$('gpsBtn');
    if(!('geolocation' in navigator)){btn.textContent='Η συσκευή δεν υποστηρίζει GPS';return;}
    btn.disabled=true;btn.textContent='Εντοπισμός…';
    navigator.geolocation.getCurrentPosition(
      pos=>{btn.disabled=false;btn.textContent='Χρήση τοποθεσίας συσκευής';changePlace({name:'Η τοποθεσία μου',region:'GPS',country:'',latitude:Math.round(pos.coords.latitude*10000)/10000,longitude:Math.round(pos.coords.longitude*10000)/10000});},
      ()=>{btn.disabled=false;btn.textContent='Δεν δόθηκε πρόσβαση · Δοκίμασε ξανά';},
      {enableHighAccuracy:false,timeout:10000,maximumAge:120000}
    );
  });
  $('locationBtn').addEventListener('click',openDialog);
  $('closeDialog').addEventListener('click',closeDialog);
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.hidden)closeDialog();});
  $('refreshBtn').addEventListener('click',()=>refresh(true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.data&&Date.now()-state.updated>MAX_CACHE_AGE_MS)refresh();});
  $('locationName').textContent=state.place.name;
  if(loadCache())render();
  refresh();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}),{once:true});
})();
