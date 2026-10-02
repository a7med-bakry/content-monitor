const SUPABASE_URL="https://rwnesehhsblejmrbzzsu.supabase.co";
const SUPABASE_KEY="sb_publishable_3vG6klw0_89fiTeXRcFPdg_EmtjhDWi";
const API=SUPABASE_URL+"/functions/v1/reel-api";
const VAPID_PUBLIC_KEY="BI4nAWrPOT2kwAyN5LkddZ7plyg79egQg33pZrV6EuFE6SJ8ORy_2Da0Fbk7Lu7VHOp6uDXELzkhGLJcYBk9uOo";
let reelsData=[];
let lastAlertId=Number(localStorage.getItem("lastAlertId")||0);
let alertAudioContext=null;
let alertTone=localStorage.getItem('alertTone')||'bell';

function unlockAlertSound(){
 try{
  if(!alertAudioContext)alertAudioContext=new (window.AudioContext||window.webkitAudioContext)();
  if(alertAudioContext.state==="suspended")alertAudioContext.resume();
 }catch{}
}

function playAlertBell(){
 try{
  unlockAlertSound();
  if(!alertAudioContext)return;
  const ctx=alertAudioContext;
  const now=ctx.currentTime;
  const gain=ctx.createGain();
  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.exponentialRampToValueAtTime(0.32,now+0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+0.7);
  gain.connect(ctx.destination);
  const osc=ctx.createOscillator();
  osc.type="sine";
  osc.frequency.setValueAtTime(880,now);
  osc.frequency.exponentialRampToValueAtTime(660,now+0.7);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now+0.72);
  const gain2=ctx.createGain();
  gain2.gain.setValueAtTime(0.0001,now+0.22);
  gain2.gain.exponentialRampToValueAtTime(0.22,now+0.24);
  gain2.gain.exponentialRampToValueAtTime(0.0001,now+0.9);
  gain2.connect(ctx.destination);
  const osc2=ctx.createOscillator();
  osc2.type="sine";
  osc2.frequency.setValueAtTime(1175,now+0.22);
  osc2.frequency.exponentialRampToValueAtTime(880,now+0.9);
  osc2.connect(gain2);
  osc2.start(now+0.22);
  osc2.stop(now+0.92);
 }catch{}
}
const reels=document.querySelector("#reels"),modal=document.querySelector("#modal"),settingsModal=document.querySelector("#settingsModal");

function api(action,body={}){return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify({action,...body})});}
function fmt(ts){if(!ts)return "—";return new Date(ts).toLocaleString([], {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function localInput(ts){const d=new Date(ts),p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function mediaId(url,platform){if(platform==="tiktok")return String(url).match(/\/video\/(\d+)/i)?.[1]||"";return String(url).match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i)?.[1]||"";}
function detectPlatform(url){const u=String(url||"").toLowerCase();if(/(^|\.)tiktok\.com\//.test(u))return"tiktok";if(/(^|\.)instagram\.com\//.test(u))return"instagram";return"";}
function platformName(p){return p==="tiktok"?"TikTok":p==="instagram"?"Instagram":"";}
function state(r){return["MONITORED","ok"];}
function computeAlertAnchor(startMin,endMin,repeat){const now=new Date();let a=new Date(now);a.setSeconds(0,0);a.setMinutes(startMin);const duration=(endMin-startMin)*60000;if(now.getTime()<=a.getTime()+duration)return a.toISOString();const step=Math.max(1,repeat)*60000;while(a.getTime()+duration<=now.getTime())a=new Date(a.getTime()+step);return a.toISOString();}
function updateRulePreview(){const s=Number(document.querySelector("#alertStartMinute").value||1),e=Number(document.querySelector("#alertEndMinute").value||15),rep=Number(document.querySelector("#alertRepeatMinutes").value||60),min=Number(document.querySelector("#minViews").value||100);document.querySelector("#rulePreview").textContent="Check minutes "+s+"–"+e+" every "+rep+" minutes. Alert if views are below the required increase of "+min.toLocaleString()+" views.";}
function updateSummary(){document.querySelector("#total").textContent=reelsData.length;document.querySelector("#normal").textContent=reelsData.filter(r=>state(r)[0]!=="ENDED").length;}

async function loadReels(){try{const r=await api("list"),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load Reels");reelsData=Array.isArray(d)?d:[];render();}catch(e){reels.innerHTML="<div class='empty'>Could not load Reels.<br><br>"+esc(e.message||e)+"</div>";}}
function render(){updateSummary();if(!reelsData.length){reels.innerHTML="<div class='empty'>No Reels yet.<br><br>Tap ＋ to add your first Reel.</div>";return;}reels.innerHTML=reelsData.map(r=>{const[st]=state(r),p=r.platform;const icon=p==="tiktok"?"♪":"◎";const cls=p==="tiktok"?"tiktok":"instagram";const views=r.latest_views==null?"—":Number(r.latest_views).toLocaleString(),likes=r.latest_likes==null?"—":Number(r.latest_likes).toLocaleString();return "<button class='reel-row' onclick='showDetails("+JSON.stringify(String(r.id))+")'><div class='platform-icon "+cls+"'>"+icon+"</div><div class='reel-main'><div class='reel-name'>"+esc(r.title||"Untitled Reel")+"</div><div class='reel-platform'>"+(p==="tiktok"?"TikTok":"Instagram")+"</div></div><div class='reel-stats'><div class='mini-stat views-stat'><span class='mini-icon'>▶</span><div><strong>"+views+"</strong></div></div><div class='mini-stat likes-stat'><span class='mini-icon'>♥</span><div><strong>"+likes+"</strong></div></div></div><div class='status-dot "+(st==="MONITORED"?"good":"muted")+"'></div><div class='chev'>›</div></button>";}).join("");}
async function showDetails(id){const r=reelsData.find(x=>String(x.id)===String(id));if(!r)return;const overlay=document.createElement("div");overlay.className="detail-modal";overlay.innerHTML="<div class='detail-sheet'><button class='close' id='detailClose'>×</button><div class='detail-head'><div class='platform-icon "+(r.platform==="tiktok"?"tiktok":"instagram")+"'>"+(r.platform==="tiktok"?"♪":"◎")+"</div><div><h2>"+esc(r.title||"Untitled Reel")+"</h2><div class='reel-platform'>"+(r.platform==="tiktok"?"TikTok":"Instagram")+" · <span class='green-text'>"+(state(r)[0]==="MONITORED"?"Monitoring":"Waiting")+"</span></div></div></div><div id='detailBody'><div class='loading'>Loading stats...</div></div></div>";document.body.appendChild(overlay);overlay.querySelector("#detailClose").onclick=()=>overlay.remove();try{const q=await api("history",{content_id:id}),rows=await q.json();if(!q.ok)throw new Error(rows.error||"Failed to load history");rows.reverse();const last=rows[rows.length-1]||{},views=Number(last.views||0),likes=Number(last.likes||0);const maxV=Math.max(1,...rows.map(x=>Number(x.views||0))),maxL=Math.max(1,...rows.map(x=>Number(x.likes||0)));const points=(key,max)=>rows.map((x,i)=>{const px=12+(i/(Math.max(1,rows.length-1)))*376,py=100-(Number(x[key]||0)/max)*82;return px.toFixed(1)+","+py.toFixed(1)}).join(" ");const snaps=rows.slice().reverse().map((s,i,a)=>{const prev=a[i+1],dv=prev?Number(s.views||0)-Number(prev.views||0):0,dl=prev?Number(s.likes||0)-Number(prev.likes||0):0;return "<div class='snap'><span>"+esc(fmt(s.captured_at))+"</span><b>"+Number(s.views||0).toLocaleString()+"</b><em class='"+(dv>=0?"up":"down")+"'>"+(dv>=0?"+":"")+dv.toLocaleString()+" views</em><b>"+Number(s.likes||0).toLocaleString()+"</b><em class='"+(dl>=0?"up":"down")+"'>"+(dl>=0?"+":"")+dl.toLocaleString()+" likes</em></div>"}).join("");overlay.querySelector("#detailBody").innerHTML="<div class='totals'><div><span>Total views</span><strong>"+views.toLocaleString()+"</strong></div><div><span>Total likes</span><strong>"+likes.toLocaleString()+"</strong></div></div><div class='chart-card'><div class='chart-title'>Views</div><svg viewBox='0 0 400 110' preserveAspectRatio='none'><polyline points='"+points("views",maxV)+"' fill='none' stroke='currentColor' stroke-width='3'/></svg></div><div class='chart-card likes-chart'><div class='chart-title'>Likes</div><svg viewBox='0 0 400 110' preserveAspectRatio='none'><polyline points='"+points("likes",maxL)+"' fill='none' stroke='currentColor' stroke-width='3'/></svg></div><div class='detail-actions'><button class='secondary' onclick='editMonitoring("+JSON.stringify(String(r.id))+")'>Edit monitoring</button><a class='secondary' href='"+esc(r.url)+"' target='_blank' rel='noopener'>Open Reel</a></div><div class='alert-info'><b>How alerts work</b><br>After each window starts, the system waits the selected delay. If views did not increase by your minimum amount, an alert is created. The same check repeats using your selected repeat time.</div><h3 class='snap-title'>Snapshots</h3><div class='snapshots'>"+(snaps||"<div class='empty'>No snapshots yet.</div>")+"</div>";}catch(e){overlay.querySelector("#detailBody").innerHTML="<div class='empty'>Failed to load stats.<br><br>"+esc(e.message||e)+"</div>";}}
window.showDetails=showDetails;
async function editMonitoring(id){
 const r=reelsData.find(x=>String(x.id)===String(id));if(!r)return;
 const body=document.createElement("div");body.className="edit-box";
 body.innerHTML="<button class='close' id='editClose'>×</button><h3>Edit monitoring</h3><div class='current-hour'>Current hour: <b id='editHour'>—</b></div><div class='grid'><label>From minute<select id='editStartMinute'></select></label><label>To minute<select id='editEndMinute'></select></label></div><label>Repeat every (minutes)<input id='editRepeat' type='number' min='1' step='1'></label><label>Minimum views<input id='editMin' type='number' min='1'></label><label class='toggle-row'><span><b>Monitor drops</b><small>Alert on any decrease in views, likes, comments, or shares.</small></span><input id='editDrops' type='checkbox'></label><button class='primary' id='editSave'>Save changes</button>";
 document.body.appendChild(body);
 const sm=body.querySelector("#editStartMinute"),em=body.querySelector("#editEndMinute");
 sm.innerHTML=Array.from({length:59},(_,i)=>"<option value='"+i+"'>"+i+"</option>").join("");
 em.innerHTML=Array.from({length:59},(_,i)=>"<option value='"+(i+1)+"'>"+(i+1)+"</option>").join("");
 body.querySelector("#editHour").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",hour12:false}).slice(0,2);
 sm.value=String(r.alert_window_start_minute??1);em.value=String(r.alert_window_end_minute??15);
 body.querySelector("#editRepeat").value=String(Number(r.alert_repeat_minutes||60));body.querySelector("#editMin").value=String(Number(r.alert_min_views_increase||100));if(body.querySelector("#editDrops"))body.querySelector("#editDrops").checked=r.monitor_drops!==false;
 body.querySelector("#editClose").onclick=()=>body.remove();
 body.querySelector("#editSave").onclick=async()=>{
  const btn=body.querySelector("#editSave"),wmStart=Number(sm.value),wmEnd=Number(em.value),repeat=Number(body.querySelector("#editRepeat").value);
  if(repeat<1){alert("Repeat must be at least 1 minute.");return;}
  if(wmEnd<=wmStart){alert("The end minute must be after the start minute.");return;}
  btn.disabled=true;btn.textContent="Saving...";
  try{
   const q=await api("update",{content_id:id,alert_window_start_minute:wmStart,alert_window_end_minute:wmEnd,alert_repeat_minutes:repeat,alert_anchor_at:computeAlertAnchor(wmStart,wmEnd,repeat),alert_min_views_increase:Number(body.querySelector("#editMin").value),monitor_drops:body.querySelector("#editDrops")?.checked});
   const d=await q.json().catch(()=>({}));if(!q.ok)throw new Error(d.error||"Server rejected the update");
   const i=reelsData.findIndex(x=>String(x.id)===String(id));if(i>=0)reelsData[i]={...reelsData[i],...(d.reel||{})};
   body.remove();render();showDetails(id);
  }catch(err){btn.disabled=false;btn.textContent="Save changes";alert("Could not save changes: "+(err.message||err));}
 };
}
window.editMonitoring=editMonitoring;window.editMonitoring=editMonitoring;

async function addReel(){
 const url=document.querySelector("#url").value.trim(),platform=detectPlatform(url),title=document.querySelector("#title").value.trim()||"New Reel";

 const alertWindowStart=Number(document.querySelector("#alertStartMinute").value||1),alertWindowEnd=Number(document.querySelector("#alertEndMinute").value||15),alertRepeat=Number(document.querySelector("#alertRepeatMinutes").value||60),minViews=Number(document.querySelector("#minViews").value||100);
 if(!url){alert("Paste the Reel/Video URL first");return;}if(!platform){alert("Use an Instagram or TikTok link.");return;}if(alertWindowEnd<=alertWindowStart){alert("The end minute must be after the start minute.");return;}if(minViews<1){alert("Minimum views must be at least 1.");return;}
 
 const btn=document.querySelector("#saveBtn");btn.disabled=true;btn.textContent="Adding Reel + first snapshot...";
 try{const r=await api("add",{platform,url,title,platform_media_id:mediaId(url,platform),alert_window_start_minute:alertWindowStart,alert_window_end_minute:alertWindowEnd,alert_repeat_minutes:alertRepeat,alert_anchor_at:computeAlertAnchor(alertWindowStart,alertWindowEnd,alertRepeat),alert_min_views_increase:minViews,monitor_drops:document.querySelector("#monitorDrops")?.checked});const d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to add Reel");closeModal();await loadReels();const first=d.first_snapshot;if(first?.data?.ok||first?.ok){const m=first.data?.metrics||first.metrics||{};alert("Reel added successfully. First snapshot captured: " + "Views: " + Number(m.views||0).toLocaleString() + " | Likes: " + Number(m.likes||0).toLocaleString());}else alert("Reel added, but the first snapshot could not be read yet. Supabase will retry on the next 5-minute check.");}
 catch(e){alert("Could not add Reel: "+(e.message||e));}finally{btn.disabled=false;btn.textContent="Add Reel & Take First Snapshot";}
}
function closeModal(){modal.classList.add("hidden");}
function openModal(){document.querySelector("#currentHour").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",hour12:false}).slice(0,2);document.querySelector("#alertStartMinute").value="1";document.querySelector("#alertEndMinute").value="15";document.querySelector("#alertRepeatMinutes").value="60";document.querySelector("#minViews").value="100";document.querySelector("#url").value="";document.querySelector("#title").value="";document.querySelector("#platformDetected").classList.add("hidden");updateRulePreview();modal.classList.remove("hidden");}
async function showHistory(id,title){const overlay=document.createElement("div");overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:10000;overflow:auto;padding:20px";overlay.innerHTML="<div style='max-width:820px;margin:30px auto;background:#111;color:#fff;border-radius:18px;padding:18px'><div style='display:flex;justify-content:space-between;align-items:center;gap:10px'><div><h2 style='margin:0'>Snapshot History</h2><div style='opacity:.65;font-size:13px'>"+esc(title)+"</div></div><button id='closeHistory' class='secondary'>Close</button></div><div id='historyBody' style='margin-top:16px'>Loading...</div></div>";document.body.appendChild(overlay);overlay.querySelector("#closeHistory").onclick=()=>overlay.remove();try{const r=await api("history",{content_id:id}),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load history");const rows=Array.isArray(d)?d:[];overlay.querySelector("#historyBody").innerHTML=rows.length?rows.map((s,i)=>{const p=rows[i+1],dv=p?Number(s.views||0)-Number(p.views||0):null,dl=p?Number(s.likes||0)-Number(p.likes||0):null,delta=p?"Δ Views: "+(dv>=0?"+":"")+dv.toLocaleString()+" · Likes: "+(dl>=0?"+":"")+dl.toLocaleString():"First snapshot";return "<div style='padding:12px 0;border-bottom:1px solid #2b2b2b'><div style='font-size:12px;opacity:.6'>"+esc(fmt(s.captured_at))+"</div><div style='line-height:1.9'>Views <b>"+Number(s.views||0).toLocaleString()+"</b> · Likes <b>"+Number(s.likes||0).toLocaleString()+"</b> · Comments <b>"+Number(s.comments||0).toLocaleString()+"</b> · Shares <b>"+Number(s.shares||0).toLocaleString()+"</b></div><div style='font-size:12px;opacity:.7'>"+delta+"</div></div>";}).join(""):"<div class='empty'>No snapshots yet.</div>";}catch(e){overlay.querySelector("#historyBody").innerHTML="<div class='empty'>Failed to load history.<br><br>"+esc(e.message||e)+"</div>";}}
window.showHistory=showHistory;

function playTone(kind=alertTone){
 try{
  unlockAlertSound(); if(!alertAudioContext)return;
  const ctx=alertAudioContext,now=ctx.currentTime;
  const sets={bell:[880,660],double:[880,660,880],beep:[950],alarm:[900,650,900,650]};
  (sets[kind]||sets.bell).forEach((f,i)=>{const t=now+i*.18,g=ctx.createGain(),o=ctx.createOscillator();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.5);o.frequency.value=f;o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.52);});
 }catch{}
}
async function loadAlertHistory(){
 const box=document.querySelector("#alertList"); if(!box)return;
 try{
  const q=await api("alerts_history"),rows=await q.json(); if(!q.ok)throw new Error();
  if(!rows.length){box.innerHTML="<div class='empty'>No alerts yet.</div>";return;}
  box.innerHTML=rows.map(a=>{
   const metric=a.metric==="likes"?"Likes":a.metric==="comments"?"Comments":a.metric==="shares"?"Shares":"Views";
   const drop=a.alert_type==="metric_drop";
   const old=Number(drop?(a["previous_"+(a.metric||"views")]||0):a.previous_views||0);
   const cur=Number(drop?(a["current_"+(a.metric||"views")]||0):a.current_views||0);
   const msg=drop?metric+" dropped from "+old.toLocaleString()+" to "+cur.toLocaleString():"Views did not reach the required growth.";
   return "<button class='alert-item' onclick='window.open("+JSON.stringify(a.url||"#")+",\'_blank\')'><b>"+esc(a.title||"Clip")+"</b><span>"+esc(fmt(a.created_at))+"</span><small>"+esc(msg)+"</small></button>";
  }).join("");
 }catch{box.innerHTML="<div class='empty'>Could not load alerts.</div>";}
}
async function checkAlerts(){try{const r=await api("alerts",{after_id:lastAlertId}),d=await r.json();if(!r.ok)return;const rows=Array.isArray(d)?d:[];for(const a of rows){if(Number(a.id)<=lastAlertId)continue;playTone();lastAlertId=Number(a.id);localStorage.setItem("lastAlertId",String(lastAlertId));const reel=reelsData.find(x=>String(x.id)===String(a.content_id));const title=reel?.title||"Reel";const required=Number(reel?.alert_min_views_increase||100);const drop=a.alert_type==="metric_drop",metric=a.metric||"views",label=metric==="likes"?"Likes":metric==="comments"?"Comments":metric==="shares"?"Shares":"Views";const body=drop?(label+" dropped from "+Number(a["previous_"+metric]||0).toLocaleString()+" to "+Number(a["current_"+metric]||0).toLocaleString()):("Views increased by "+Number(Number(a.current_views||0)-Number(a.previous_views||0)).toLocaleString()+" (required "+required.toLocaleString()+")");if("Notification"in window&&Notification.permission==="granted")new Notification("⚠️ "+title,{body});else alert("⚠️ " + title + " | " + body);}if(rows.length)loadReels();}catch{}}

async function setupNotifications(){if(!("Notification"in window)){alert("Notifications are not supported here.");return;}const p=Notification.permission==="granted"?"granted":await Notification.requestPermission();if(p==="granted")alert("Notifications enabled. Android can deliver alerts even when the app is closed.");}

document.addEventListener("pointerdown",unlockAlertSound,{once:true});
document.querySelector("#addBtn").onclick=()=>{unlockAlertSound();openModal();};
const alertsBtn=document.querySelector("#alertsBtn");if(alertsBtn)alertsBtn.onclick=()=>{document.querySelector("#alertsModal")?.classList.remove("hidden");loadAlertHistory();};
const alertsClose=document.querySelector("#alertsClose");if(alertsClose)alertsClose.onclick=()=>document.querySelector("#alertsModal")?.classList.add("hidden");
document.querySelector("#newReel").onclick=openModal;
document.querySelector("#closeBtn").onclick=closeModal;
document.querySelector("#saveBtn").onclick=addReel;
document.querySelector("#refreshBtn").onclick=loadReels;
document.querySelector("#homeBtn").onclick=loadReels;
document.querySelector("#settingsBtn").onclick=()=>settingsModal.classList.remove("hidden");
document.querySelector("#settingsClose").onclick=()=>settingsModal.classList.add("hidden");
const tone=document.querySelector("#alarmTone");
if(tone){tone.value=alertTone;tone.onchange=()=>{alertTone=tone.value;localStorage.setItem("alertTone",alertTone);};}
const soundName=document.querySelector("#alarmToneName");
const chooseSound=document.querySelector("#chooseAlarmTone");
if(chooseSound)chooseSound.onclick=async()=>{
  if(window.contentMonitorNative?.chooseAlertSound){
    const r=await window.contentMonitorNative.chooseAlertSound();
    if(r&&soundName)soundName.textContent=r.name||"Default Android sound";
    else if(soundName)soundName.textContent="Default Android sound";
  }else{
    alert("Phone sound selection is available in the Android app.");
  }
};
if(window.contentMonitorNative?.getAlertSound)window.contentMonitorNative.getAlertSound().then(r=>{if(r&&soundName)soundName.textContent=r.name||"Default Android sound";});
const test=document.querySelector("#testAlarm");
if(test)test.onclick=async()=>{
  if(window.contentMonitorNative?.notify){
    await window.contentMonitorNative.notify("Content Monitor","Test alert sound");
  }else playTone();
};const ab=document.querySelector("#alertsBtn");if(ab)ab.onclick=()=>{document.querySelector("#alertsModal")?.classList.remove("hidden");loadAlertHistory();};const ac=document.querySelector("#alertsClose");if(ac)ac.onclick=()=>document.querySelector("#alertsModal")?.classList.add("hidden");
document.querySelector("#enableNotifications").onclick=()=>{unlockAlertSound();setupNotifications();};
document.querySelector("#url").addEventListener("input",()=>{const p=detectPlatform(document.querySelector("#url").value),el=document.querySelector("#platformDetected");el.classList.toggle("hidden",!p);el.textContent=p==="tiktok"?"✓ TikTok detected":"✓ Instagram detected";});
const minuteOptions=Array.from({length:59},(_,i)=>"<option value='"+i+"'>"+i+"</option>").join("");
document.querySelector("#alertStartMinute").innerHTML=minuteOptions;
document.querySelector("#alertEndMinute").innerHTML=Array.from({length:59},(_,i)=>"<option value='"+(i+1)+"'>"+(i+1)+"</option>").join("");
document.querySelector("#alertStartMinute").onchange=updateRulePreview;
document.querySelector("#alertEndMinute").onchange=updateRulePreview;

document.querySelector("#minViews").oninput=updateRulePreview;document.querySelector("#alertRepeatMinutes").oninput=updateRulePreview;
loadReels();checkAlerts();setInterval(()=>{loadReels();checkAlerts();},60000);