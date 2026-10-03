const SUPABASE_URL="https://rwnesehhsblejmrbzzsu.supabase.co";
const SUPABASE_KEY="sb_publishable_3vG6klw0_89fiTeXRcFPdg_EmtjhDWi";
const API=SUPABASE_URL+"/functions/v1/reel-api";
const VAPID_PUBLIC_KEY="BI4nAWrPOT2kwAyN5LkddZ7plyg79egQg33pZrV6EuFE6SJ8ORy_2Da0Fbk7Lu7VHOp6uDXELzkhGLJcYBk9uOo";
let reelsData=[];
let lastAlertId=Number(localStorage.getItem("lastAlertId")||0);
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
function updateSummary(){document.querySelector("#total").textContent=reelsData.length;document.querySelector("#normal").textContent=reelsData.filter(r=>r.active!==false).length;}
function hourlyTargets(r){return r.hourly_targets&&typeof r.hourly_targets==="object"?r.hourly_targets:{};}

async function loadReels(){try{const r=await api("list"),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load Reels");reelsData=Array.isArray(d)?d:[];render();}catch(e){reels.innerHTML="<div class='empty'>Could not load Reels.<br><br>"+esc(e.message||e)+"</div>";}}
function render(){updateSummary();if(!reelsData.length){reels.innerHTML="<div class='empty'>No Reels yet.<br><br>Tap ＋ to add your first Reel.</div>";return;}reels.innerHTML=reelsData.map(r=>{const[st]=state(r),p=r.platform,paused=r.active===false;const icon=p==="tiktok"?"♪":"◎";const cls=p==="tiktok"?"tiktok":"instagram";const views=r.latest_views==null?"—":Number(r.latest_views).toLocaleString(),likes=r.latest_likes==null?"—":Number(r.latest_likes).toLocaleString();return "<button class='reel-row' onclick='showDetails("+JSON.stringify(String(r.id))+")'><div class='platform-icon "+cls+"'>"+icon+"</div><div class='reel-main'><div class='reel-name'>"+esc(r.title||"Untitled Reel")+"</div><div class='reel-platform'>"+(p==="tiktok"?"TikTok":"Instagram")+"</div></div><div class='reel-stats'><div class='mini-stat views-stat'><span class='mini-icon'>▶</span><div><strong>"+views+"</strong></div></div><div class='mini-stat likes-stat'><span class='mini-icon'>♥</span><div><strong>"+likes+"</strong></div></div></div><div class='status-dot "+(paused?"muted":(st==="MONITORED"?"good":"muted"))+"'></div><div class='chev'>›</div></button>";}).join("");}
async function showDetails(id,fromRoute=false){
 const r=reelsData.find(x=>String(x.id)===String(id));if(!r)return;
 if(!fromRoute)history.pushState({clipId:String(id)},"",location.origin+"/clip/"+encodeURIComponent(String(id)));
 const overlay=document.createElement("div");overlay.className="detail-modal";
 overlay.innerHTML="<div class='detail-sheet'><button class='close' id='detailClose'>×</button><div class='detail-head'><div class='platform-icon "+(r.platform==="tiktok"?"tiktok":"instagram")+"'>"+(r.platform==="tiktok"?"♪":"◎")+"</div><div><h2>"+esc(r.title||"Untitled Reel")+"</h2><div class='reel-platform'>"+(r.platform==="tiktok"?"TikTok":"Instagram")+" · <span class='green-text'>"+(r.active===false?"Monitoring paused":"Monitoring active")+"</span></div></div></div><div id='detailBody'><div class='loading'>Loading stats...</div></div></div>";
 document.body.appendChild(overlay);overlay.querySelector("#detailClose").onclick=()=>{overlay.remove();goHome();};
 try{
  const q=await api("history",{content_id:id}),rows=await q.json();if(!q.ok)throw new Error(rows.error||"Failed to load history");
  rows.reverse();const last=rows[rows.length-1]||{},views=Number(last.views||0),likes=Number(last.likes||0);
  const maxV=Math.max(1,...rows.map(x=>Number(x.views||0))),maxL=Math.max(1,...rows.map(x=>Number(x.likes||0)));
  const points=(key,max)=>rows.map((x,i)=>{const px=12+(i/(Math.max(1,rows.length-1)))*376,py=100-(Number(x[key]||0)/max)*82;return px.toFixed(1)+","+py.toFixed(1)}).join(" ");
  const snaps=rows.slice().reverse().map((s,i,a)=>{const prev=a[i+1],dv=prev?Number(s.views||0)-Number(prev.views||0):0,dl=prev?Number(s.likes||0)-Number(prev.likes||0):0,dc=prev?Number(s.comments||0)-Number(prev.comments||0):0,ds=prev?Number(s.shares||0)-Number(prev.shares||0):0,save=prev?Number(s.saves||0)-Number(prev.saves||0):0,drop=dv<0||dl<0||dc<0||ds<0||save<0;return "<div class='snap"+(drop?" snap-drop":"")+"'><span>"+esc(fmt(s.captured_at))+"</span><b>"+Number(s.views||0).toLocaleString()+"</b><em class='"+(dv>=0?"up":"down")+"'>"+(dv>=0?"+":"")+dv.toLocaleString()+" views</em><b>"+Number(s.likes||0).toLocaleString()+"</b><em class='"+(dl>=0?"up":"down")+"'>"+(dl>=0?"+":"")+dl.toLocaleString()+" likes</em></div>"}).join("");
  overlay.querySelector("#detailBody").innerHTML="<div class='totals'><div><span>Total views</span><strong>"+views.toLocaleString()+"</strong></div><div><span>Total likes</span><strong>"+likes.toLocaleString()+"</strong></div></div><div class='chart-card'><div class='chart-title'>Views</div><svg viewBox='0 0 400 110' preserveAspectRatio='none'><polyline points='"+points("views",maxV)+"' fill='none' stroke='currentColor' stroke-width='3'/></svg></div><div class='chart-card likes-chart'><div class='chart-title'>Likes</div><svg viewBox='0 0 400 110' preserveAspectRatio='none'><polyline points='"+points("likes",maxL)+"' fill='none' stroke='currentColor' stroke-width='3'/></svg></div><div class='detail-actions'><button class='primary' id='snapshotNow'>Take Snapshot Now</button><button class='secondary' onclick='showMonitoring(" + JSON.stringify(String(r.id)) + ")'>Monitoring</button><a class='secondary' href='" + esc(r.url) + "' target='_blank' rel='noopener'>Open Reel</a><button class='secondary' onclick='copyClipLink(" + JSON.stringify(String(r.id)) + ")'>Copy Link</button></div><div class='clip-management'><button class='secondary' id='toggleAlerts'>" + (r.notifications_enabled===false?"Resume Alerts":"Stop Alerts") + "</button><button class='secondary' id='toggleMonitor'>" + (r.active===false?"Resume Monitoring":"Stop Monitoring") + "</button><button class='danger' id='deleteClipBtn'>Delete Reel</button></div><div class='alert-info'><b>Monitoring</b><br>Hourly targets are fixed to each clock hour. Drop monitoring checks views, likes, comments, shares and saves after every snapshot.</div><h3 class='snap-title'>Snapshots</h3><div class='snapshots'>"+(snaps||"<div class='empty'>No snapshots yet.</div>")+"</div>";
  overlay.querySelector("#snapshotNow").onclick=async()=>{const btn=overlay.querySelector("#snapshotNow"),old=btn.textContent;btn.disabled=true;btn.textContent="Taking snapshot...";try{const q=await api("snapshot_now",{content_id:id}),d=await q.json();if(!q.ok||d.ok===false)throw new Error(d.error||"Snapshot failed");const m=d.metrics||{};alert("Snapshot captured now. Views: "+Number(m.views||0).toLocaleString()+" | Likes: "+Number(m.likes||0).toLocaleString()+" | Comments: "+Number(m.comments||0).toLocaleString()+" | Shares: "+Number(m.shares||0).toLocaleString()+" | Saves: "+Number(m.saves||0).toLocaleString());await loadReels();showDetails(id,true);}catch(e){alert("Could not take snapshot: "+(e.message||e));btn.disabled=false;btn.textContent=old;}};
  overlay.querySelector("#toggleAlerts").onclick=()=>toggleNotifications(id,r.notifications_enabled!==false);
  overlay.querySelector("#toggleMonitor").onclick=()=>toggleMonitoring(id,r.active===false);
  overlay.querySelector("#deleteClipBtn").onclick=()=>deleteClip(id);
 }catch(e){overlay.querySelector("#detailBody").innerHTML="<div class='empty'>Failed to load stats.<br><br>"+esc(e.message||e)+"</div>";}
}
window.showDetails=showDetails;
function routeClipId(){const m=location.pathname.match(/^\/clip\/([^/]+)\/?$/);return m?decodeURIComponent(m[1]):null;}
function goHome(replace=false){const fn=replace?"replaceState":"pushState";history[fn]({route:"home"},"",location.origin+"/");document.querySelector(".detail-modal")?.remove();}
function openRoute(route,replace=false){
 const fn=replace?"replaceState":"pushState";
 history[fn]({route},"",location.origin+route);
 document.querySelector(".detail-modal")?.remove();
 if(route==="/")return;
 if(route==="/add"){openModal();return;}
 if(route==="/settings"){settingsModal.classList.remove("hidden");return;}
 if(route==="/alerts"){document.querySelector("#alertsModal")?.classList.remove("hidden");loadAlertHistory();return;}
 const id=routeClipId();
 if(id){showDetails(id,true);return;}
 goHome(true);
}
window.addEventListener("popstate",()=>{
 document.querySelector(".detail-modal")?.remove();
 document.querySelector("#modal")?.classList.add("hidden");
 settingsModal?.classList.add("hidden");
 document.querySelector("#alertsModal")?.classList.add("hidden");
 if(location.pathname==="/")return;
 if(location.pathname==="/add"){openModal();return;}
 if(location.pathname==="/settings"){settingsModal?.classList.remove("hidden");return;}
 if(location.pathname==="/alerts"){document.querySelector("#alertsModal")?.classList.remove("hidden");loadAlertHistory();return;}
 const id=routeClipId();
 if(id){if(reelsData.length)showDetails(id,true);else loadReels().then(()=>showDetails(id,true));}
 else goHome(true);
});
async function openClipRoute(){
 const p=location.pathname.replace(/\/$/,"")||"/";
 if(p==="/")return;
 if(p==="/add"){openModal();return;}
 if(p==="/settings"){settingsModal.classList.remove("hidden");return;}
 if(p==="/alerts"){document.querySelector("#alertsModal")?.classList.remove("hidden");loadAlertHistory();return;}
 const id=routeClipId();
 if(id){
  if(reelsData.length)showDetails(id,true);
  else {await loadReels();showDetails(id,true);}
  if(!reelsData.some(x=>String(x.id)===String(id)))goHome(true);
 }else goHome(true);
}

async function showMonitoring(id){
 const r=reelsData.find(x=>String(x.id)===String(id)); if(!r)return;
 const overlay=document.createElement("div"); overlay.className="monitor-modal";
 overlay.innerHTML="<div class='monitor-sheet'><button class='close' id='monitorClose'>×</button><div class='monitor-head'><div><h2>Monitoring</h2><div class='monitor-sub'>"+esc(r.title||"Untitled Reel")+"</div></div></div><div class='monitor-tabs'><button class='monitor-tab active' data-tab='growth'>View Growth</button><button class='monitor-tab' data-tab='drops'>Drops</button></div><div id='monitorBody' class='monitor-body'></div><div class='monitor-bottom-actions'><button class='secondary' id='monitorStop'>"+(r.active===false?"Resume monitoring":"Stop monitoring")+"</button><button class='secondary' id='monitorEdit'>Edit monitoring</button></div></div>";
 document.body.appendChild(overlay);
 overlay.querySelector("#monitorClose").onclick=()=>overlay.remove();
 const body=overlay.querySelector("#monitorBody");
 let history=[];
 const renderGrowth=()=>{
  const startMin=Number(r.alert_window_start_minute??1),endMin=Number(r.alert_window_end_minute??15),repeat=Math.max(1,Number(r.alert_repeat_minutes||60)),minViews=Math.max(1,Number(r.alert_min_views_increase||100));
  const snaps=history.slice().sort((a,b)=>new Date(a.captured_at)-new Date(b.captured_at));
  if(!snaps.length){body.innerHTML="<div class='empty'>No snapshots yet.</div>";return;}
  const latestMs=new Date(snaps[snaps.length-1].captured_at).getTime();
  const duration=(endMin-startMin)*60000;
  let first=r.alert_anchor_at?new Date(r.alert_anchor_at):null;
  if(!first||!Number.isFinite(first.getTime())){
    first=new Date(r.monitor_start_at||snaps[0].captured_at);
    first.setSeconds(0,0);first.setMinutes(startMin);
    if(first.getTime()<new Date(r.monitor_start_at||snaps[0].captured_at).getTime())first=new Date(first.getTime()+3600000);
  }
  const windows=[];let ws=new Date(first),guard=0;
  while(ws.getTime()<=latestMs&&guard++<500){
    const we=new Date(ws.getTime()+duration);
    const inside=snaps.filter(s=>{const t=new Date(s.captured_at).getTime();return t>=ws.getTime()&&t<=we.getTime();});
    const baseline=[...snaps].reverse().find(s=>new Date(s.captured_at).getTime()<=ws.getTime());
    const finish=[...snaps].reverse().find(s=>new Date(s.captured_at).getTime()<=we.getTime()&&new Date(s.captured_at).getTime()>=ws.getTime());
    const complete=latestMs>=we.getTime();
    const hasResult=complete&&baseline&&finish&&baseline.views!=null&&finish.views!=null;
    const delta=hasResult?Number(finish.views)-Number(baseline.views):null;
    const status=!complete?"pending":hasResult?(delta>=minViews?"pass":"fail"):"nodata";
    windows.push({ws,we,inside,baseline,finish,complete,hasResult,delta,status});
    ws=new Date(ws.getTime()+repeat*60000);
  }
  if(!windows.length){body.innerHTML="<div class='empty'>No monitoring window has started yet.</div>";return;}
  body.innerHTML="<div class='monitor-summary'><span>Window "+startMin+"–"+endMin+" · every "+repeat+" min</span><b>Minimum increase: "+minViews.toLocaleString()+" views</b></div>"+windows.reverse().map((w,i)=>{
   const snapsHtml=w.inside.map((s,j)=>{const prev=w.inside[j-1],d=prev?Number(s.views||0)-Number(prev.views||0):0;return "<div class='monitor-snap'><span>"+esc(fmt(s.captured_at))+"</span><b>"+Number(s.views||0).toLocaleString()+"</b><em class='"+(d>=0?"up":"down")+"'>"+(prev?(d>=0?"+":"")+d.toLocaleString()+" views":"start")+"</em></div>"}).join("");
   const label=w.status==="pass"?"PASS":w.status==="fail"?"NOT MET":w.status==="pending"?"IN PROGRESS":"NO DATA";
   const result=w.hasResult?(w.delta>=0?"+":"")+w.delta.toLocaleString():"—";
   const help=w.hasResult?"required ≥ "+minViews.toLocaleString():(w.complete?"No usable snapshot inside this window yet":"Waiting for the window to finish");
   return "<div class='monitor-row'><div class='monitor-row-top'><div class='monitor-number'>"+(windows.length-i)+"</div><div class='monitor-period'><b>"+esc(fmt(w.ws))+" → "+esc(fmt(w.we))+"</b><small>"+w.inside.length+" snapshots</small></div><div class='monitor-status "+w.status+"'>"+label+"</div></div><div class='monitor-result'><span>Views increase</span><strong>"+result+"</strong><small>"+help+"</small></div><div class='monitor-snaps'>"+(snapsHtml||"<div class='empty' style='padding:16px'>No snapshots in this window yet.</div>")+"</div></div>";
  }).join("");
 };
 const renderDrops=()=>{
  const snaps=history.slice().sort((a,b)=>new Date(a.captured_at)-new Date(b.captured_at)),drops=[];
  for(let i=1;i<snaps.length;i++){const p=snaps[i-1],s=snaps[i],dv=Number(s.views||0)-Number(p.views||0),dl=Number(s.likes||0)-Number(p.likes||0);if(dv<0||dl<0)drops.push({s,p,dv,dl});}
  if(!drops.length){body.innerHTML="<div class='empty'>No drops detected yet.</div>";return;}
  body.innerHTML="<div class='drop-monitor-summary'>Any snapshot with a decrease in views or likes appears here.</div>"+drops.reverse().map((d,i)=>"<div class='drop-row'><div class='drop-row-head'><div class='monitor-number'>"+(drops.length-i)+"</div><b>"+esc(fmt(d.s.captured_at))+"</b><span class='drop-badge'>DROP</span></div><div class='drop-metrics'>"+(d.dv<0?"<div><span>Views</span><b class='down'>"+Number(d.p.views||0).toLocaleString()+" → "+Number(d.s.views||0).toLocaleString()+" ("+d.dv.toLocaleString()+")</b></div>":"")+" "+(d.dl<0?"<div><span>Likes</span><b class='down'>"+Number(d.p.likes||0).toLocaleString()+" → "+Number(d.s.likes||0).toLocaleString()+" ("+d.dl.toLocaleString()+")</b></div>":"")+"</div></div>").join("");
 };
 body.innerHTML="<div class='loading'>Loading monitoring...</div>";
 try{const q=await api("history",{content_id:id}),rows=await q.json();if(!q.ok)throw new Error(rows.error||"Failed to load history");history=Array.isArray(rows)?rows:[];renderGrowth();}catch(e){body.innerHTML="<div class='empty'>Failed to load monitoring.<br><br>"+esc(e.message||e)+"</div>";}
 overlay.querySelectorAll(".monitor-tab").forEach(btn=>btn.onclick=()=>{overlay.querySelectorAll(".monitor-tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");btn.dataset.tab==="drops"?renderDrops():renderGrowth();});
 overlay.querySelector("#monitorStop").onclick=async()=>{overlay.remove();await toggleMonitoring(id,r.active!==false);};
 overlay.querySelector("#monitorEdit").onclick=async()=>{overlay.remove();await editMonitoring(id);};
}
window.showMonitoring=showMonitoring;

async function editMonitoring(id){
 const r=reelsData.find(x=>String(x.id)===String(id));if(!r)return;
 const body=document.createElement("div");body.className="edit-box hourly-editor";const targets=hourlyTargets(r);
 body.innerHTML="<button class='close' id='editClose'>×</button><h3>Hourly monitoring</h3><p class='hint'>Each clock hour is fixed: 07:00–07:59, 08:00–08:59, etc. Enter the minimum views and likes required during that hour.</p><div class='hourly-head'><span>Hour</span><span>Min views</span><span>Min likes</span></div><div id='hourlyRows'></div><label class='toggle-row'><span><b>Drop monitoring</b><small>Alert immediately if views, likes, comments, shares or saves decrease.</small></span><input id='editDrops' type='checkbox'></label><label class='toggle-row'><span><b>Notifications</b><small>Turn alert generation and push notifications on or off.</small></span><input id='editNotifications' type='checkbox'></label><button class='primary' id='editSave'>Save changes</button>";
 document.body.appendChild(body);body.querySelector("#editDrops").checked=r.monitor_drops!==false;body.querySelector("#editNotifications").checked=r.notifications_enabled!==false;
 const rows=body.querySelector("#hourlyRows");rows.innerHTML=Array.from({length:24},(_,h)=>{const t=targets[String(h)]||targets[String(h).padStart(2,"0")]||{};return "<div class='hourly-row'><b>"+String(h).padStart(2,"0")+":00–"+String(h).padStart(2,"0")+":59</b><input data-hour='"+h+"' data-kind='views' type='number' min='0' value='"+Number(t.views||0)+"' placeholder='0'><input data-hour='"+h+"' data-kind='likes' type='number' min='0' value='"+Number(t.likes||0)+"' placeholder='0'></div>";}).join("");
 body.querySelector("#editClose").onclick=()=>body.remove();
 body.querySelector("#editSave").onclick=async()=>{const btn=body.querySelector("#editSave");btn.disabled=true;btn.textContent="Saving...";try{const ht={};rows.querySelectorAll(".hourly-row").forEach(row=>{const h=row.querySelector("[data-hour]").dataset.hour,v=Number(row.querySelector("[data-kind=views]").value||0),l=Number(row.querySelector("[data-kind=likes]").value||0);if(v>0||l>0)ht[String(Number(h))]={views:v,likes:l};});const q=await api("update",{content_id:id,hourly_targets:ht,monitor_drops:body.querySelector("#editDrops").checked,notifications_enabled:body.querySelector("#editNotifications").checked});const d=await q.json();if(!q.ok)throw new Error(d.error||"Server rejected the update");const i=reelsData.findIndex(x=>String(x.id)===String(id));if(i>=0)reelsData[i]={...reelsData[i],...(d.reel||{})};body.remove();render();showDetails(id);}catch(err){btn.disabled=false;btn.textContent="Save changes";alert("Could not save changes: "+(err.message||err));}};
}
async function toggleMonitoring(id,isActive){if(!confirm(isActive?"Stop monitoring this clip? Snapshots will pause, but its history will stay.":"Resume monitoring this clip?"))return;try{const q=await api("update",{content_id:id,active:!isActive});const d=await q.json();if(!q.ok)throw new Error(d.error||"Update failed");const i=reelsData.findIndex(x=>String(x.id)===String(id));if(i>=0)reelsData[i]={...reelsData[i],active:!isActive};document.querySelector(".detail-modal")?.remove();render();}catch(e){alert("Could not change monitoring: "+(e.message||e));}}
async function toggleNotifications(id,isEnabled){try{const q=await api("update",{content_id:id,notifications_enabled:!isEnabled});const d=await q.json();if(!q.ok)throw new Error(d.error||"Update failed");const i=reelsData.findIndex(x=>String(x.id)===String(id));if(i>=0)reelsData[i]={...reelsData[i],...(d.reel||{})};document.querySelector(".detail-modal")?.remove();render();showDetails(id);}catch(e){alert("Could not change alerts: "+(e.message||e));}}
window.toggleNotifications=toggleNotifications;
async function deleteClip(id){if(!confirm("Delete this clip and all its snapshot/alert history? This cannot be undone."))return;try{const q=await api("delete",{content_id:id});const d=await q.json();if(!q.ok)throw new Error(d.error||"Delete failed");reelsData=reelsData.filter(x=>String(x.id)!==String(id));document.querySelector(".detail-modal")?.remove();render();}catch(e){alert("Could not delete clip: "+(e.message||e));}}
async function copyClipLink(id){const u=location.origin+"/clip/"+encodeURIComponent(String(id));try{await navigator.clipboard.writeText(u);alert("Clip link copied");}catch{prompt("Copy this clip link:",u);}}
window.copyClipLink=copyClipLink;
window.toggleMonitoring=toggleMonitoring;window.deleteClip=deleteClip;
window.editMonitoring=editMonitoring;window.editMonitoring=editMonitoring;

async function addReel(){
 const url=document.querySelector("#url").value.trim(),platform=detectPlatform(url),title=document.querySelector("#title").value.trim()||"New Reel";

 const alertWindowStart=Number(document.querySelector("#alertStartMinute").value||1),alertWindowEnd=Number(document.querySelector("#alertEndMinute").value||15),alertRepeat=Number(document.querySelector("#alertRepeatMinutes").value||60),minViews=Number(document.querySelector("#minViews").value||100);
 if(!url){alert("Paste the Reel/Video URL first");return;}if(!platform){alert("Use an Instagram or TikTok link.");return;}if(alertWindowEnd<=alertWindowStart){alert("The end minute must be after the start minute.");return;}if(minViews<1){alert("Minimum views must be at least 1.");return;}
 
 const btn=document.querySelector("#saveBtn");btn.disabled=true;btn.textContent="Adding Reel + first snapshot...";
 try{const r=await api("add",{platform,url,title,platform_media_id:mediaId(url,platform),alert_window_start_minute:alertWindowStart,alert_window_end_minute:alertWindowEnd,alert_repeat_minutes:alertRepeat,alert_anchor_at:computeAlertAnchor(alertWindowStart,alertWindowEnd,alertRepeat),alert_min_views_increase:minViews,monitor_drops:document.querySelector("#monitorDrops") ? document.querySelector("#monitorDrops").checked : true});const d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to add Reel");closeModal();await loadReels();const first=d.first_snapshot;if(first?.data?.ok||first?.ok){const m=first.data?.metrics||first.metrics||{};alert("Reel added successfully. First snapshot captured: " + "Views: " + Number(m.views||0).toLocaleString() + " | Likes: " + Number(m.likes||0).toLocaleString());}else alert("Reel added, but the first snapshot could not be read yet. Supabase will retry on the next 5-minute check.");}
 catch(e){alert("Could not add Reel: "+(e.message||e));}finally{btn.disabled=false;btn.textContent="Add Reel & Take First Snapshot";}
}
function closeModal(){modal.classList.add("hidden");}
function openModal(){document.querySelector("#currentHour").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",hour12:false}).slice(0,2);document.querySelector("#alertStartMinute").value="1";document.querySelector("#alertEndMinute").value="15";document.querySelector("#alertRepeatMinutes").value="60";document.querySelector("#minViews").value="100";document.querySelector("#url").value="";document.querySelector("#title").value="";document.querySelector("#platformDetected").classList.add("hidden");updateRulePreview();modal.classList.remove("hidden");}
async function showHistory(id,title){const overlay=document.createElement("div");overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:10000;overflow:auto;padding:20px";overlay.innerHTML="<div style='max-width:820px;margin:30px auto;background:#111;color:#fff;border-radius:18px;padding:18px'><div style='display:flex;justify-content:space-between;align-items:center;gap:10px'><div><h2 style='margin:0'>Snapshot History</h2><div style='opacity:.65;font-size:13px'>"+esc(title)+"</div></div><button id='closeHistory' class='secondary'>Close</button></div><div id='historyBody' style='margin-top:16px'>Loading...</div></div>";document.body.appendChild(overlay);overlay.querySelector("#closeHistory").onclick=()=>overlay.remove();try{const r=await api("history",{content_id:id}),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load history");const rows=Array.isArray(d)?d:[];overlay.querySelector("#historyBody").innerHTML=rows.length?rows.map((s,i)=>{const p=rows[i+1],dv=p?Number(s.views||0)-Number(p.views||0):null,dl=p?Number(s.likes||0)-Number(p.likes||0):null,delta=p?"Δ Views: "+(dv>=0?"+":"")+dv.toLocaleString()+" · Likes: "+(dl>=0?"+":"")+dl.toLocaleString():"First snapshot";return "<div style='padding:12px 0;border-bottom:1px solid #2b2b2b'><div style='font-size:12px;opacity:.6'>"+esc(fmt(s.captured_at))+"</div><div style='line-height:1.9'>Views <b>"+Number(s.views||0).toLocaleString()+"</b> · Likes <b>"+Number(s.likes||0).toLocaleString()+"</b> · Comments <b>"+Number(s.comments||0).toLocaleString()+"</b> · Shares <b>"+Number(s.shares||0).toLocaleString()+"</b></div><div style='font-size:12px;opacity:.7'>"+delta+"</div></div>";}).join(""):"<div class='empty'>No snapshots yet.</div>";}catch(e){overlay.querySelector("#historyBody").innerHTML="<div class='empty'>Failed to load history.<br><br>"+esc(e.message||e)+"</div>";}}
window.showHistory=showHistory;

function showInAppAlert(title,body,type="alert",contentId=""){
 const old=document.querySelector(".in-app-alert");if(old)old.remove();
 const el=document.createElement("button");
 el.className="in-app-alert "+(type==="metric_drop"?"drop":type==="metric_spike"?"spike":"warning");
 el.innerHTML="<span class='alert-symbol'>"+(type==="metric_drop"?"↓":type==="metric_spike"?"⚡":"!")+"</span><span class='alert-copy'><b>"+esc(title)+"</b><small>"+esc(body)+"</small></span><span class='alert-open'>›</span>";
 el.onclick=()=>{el.remove();if(contentId){document.querySelector(".detail-modal")?.remove();showDetails(contentId);}};
 document.body.appendChild(el);
 requestAnimationFrame(()=>el.classList.add("show"));
 setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),250)},9000);
}
async function loadAlertHistory(){
 const box=document.querySelector("#alertList"); if(!box)return;
 try{
  const q=await api("alerts_history"),rows=await q.json(); if(!q.ok)throw new Error();
  if(!rows.length){box.innerHTML="<div class='empty'>No alerts yet.</div>";return;}
  box.innerHTML=rows.map(a=>{
   const metric=a.metric==="likes"?"Likes":a.metric==="comments"?"Comments":a.metric==="shares"?"Shares":"Views";
   const drop=a.alert_type==="metric_drop",spike=a.alert_type==="metric_spike",growth=a.alert_type==="low_views_growth";
   const old=Number((drop||spike)?(a["previous_"+(a.metric||"views")]||0):a.previous_views||0);
   const cur=Number((drop||spike)?(a["current_"+(a.metric||"views")]||0):a.current_views||0);
   const msg=drop?metric+" dropped from "+old.toLocaleString()+" to "+cur.toLocaleString():spike?metric+" jumped unexpectedly from "+old.toLocaleString()+" to "+cur.toLocaleString():"Views increased by "+(cur-old).toLocaleString()+" (required growth was not met).";
   const label=drop?"DROP":spike?"SPIKE":growth?"NOT MET":"ALERT";
   const cls=drop?"drop":spike?"spike":growth?"growth":"warning";
   return "<div class='alert-item "+cls+"'><button class='alert-main' onclick='showDetails("+JSON.stringify(String(a.content_id))+")'><span class='alert-item-copy'><b>"+esc(a.title||"Clip")+"</b><span>"+esc(fmt(a.created_at))+" · "+label+"</span><small>"+esc(msg)+"</small></span></button><button class='alert-delete' title='Delete alert' aria-label='Delete alert' onclick='event.stopPropagation();deleteAlert("+Number(a.id)+")'>Delete</button></div>";
  }).join("");
 }catch{box.innerHTML="<div class='empty'>Could not load alerts.</div>";}
}
async function deleteAlert(id){
 try{
  const q=await api("delete_alert",{id:Number(id)});
  const d=await q.json().catch(()=>({}));
  if(!q.ok)throw new Error(d.error||"Delete alert failed");
  await loadAlertHistory();
 }catch(e){alert("Could not delete alert: "+(e.message||e));}
}
window.deleteAlert=deleteAlert;
async function deleteAllAlerts(){
 if(!confirm("Delete all alert notifications? This cannot be undone."))return;
 try{
  const q=await api("delete_alerts",{});
  const d=await q.json().catch(()=>({}));
  if(!q.ok)throw new Error(d.error||"Delete alerts failed");
  lastAlertId=0;
  localStorage.setItem("lastAlertId","0");
  await loadAlertHistory();
 }catch(e){alert("Could not delete notifications: "+(e.message||e));}
}
window.deleteAllAlerts=deleteAllAlerts;

async function checkAlerts(){try{const r=await api("alerts",{after_id:lastAlertId}),d=await r.json();if(!r.ok)return;const rows=Array.isArray(d)?d:[];for(const a of rows){if(Number(a.id)<=lastAlertId)continue;lastAlertId=Number(a.id);localStorage.setItem("lastAlertId",String(lastAlertId));const reel=reelsData.find(x=>String(x.id)===String(a.content_id));const title=reel?.title||"Reel";const required=Number(reel?.alert_min_views_increase||100);const drop=a.alert_type==="metric_drop",spike=a.alert_type==="metric_spike",growth=a.alert_type==="low_views_growth",metric=a.metric||"views",label=metric==="likes"?"Likes":metric==="comments"?"Comments":metric==="shares"?"Shares":"Views";const old=Number(a["previous_"+metric]||0),cur=Number(a["current_"+metric]||0);const body=drop?(label+" dropped from "+old.toLocaleString()+" to "+cur.toLocaleString()):spike?(label+" jumped unexpectedly from "+old.toLocaleString()+" to "+cur.toLocaleString()):("Views increased by "+Number(cur-old).toLocaleString()+" (required "+required.toLocaleString()+")");showInAppAlert((drop?"DROP · ":spike?"SPIKE · ":growth?"NOT MET · ":"ALERT · ")+title,body,drop?"metric_drop":spike?"metric_spike":"low_views_growth",a.content_id);if("Notification"in window&&Notification.permission==="granted")new Notification((drop?"⚠️ ":spike?"⚡ ":"⚠️ ")+title,{body});}if(rows.length){loadReels();loadAlertHistory();}}catch{}}

async function ensureNotificationWorker(){if(!("serviceWorker"in navigator))throw new Error("Service Worker is not supported in this browser.");const reg=await navigator.serviceWorker.register("/service-worker.js?v=36",{scope:"/"});await navigator.serviceWorker.ready;return reg;}
async function setupNotifications(){try{const p=Notification.permission==="granted"?"granted":await Notification.requestPermission();if(p==="granted")alert("Notifications enabled. You can control the notification sound from your phone settings.");else alert("Please allow notifications in your phone settings.");}catch(e){alert("Could not enable notifications. Please try again.");}}

document.querySelector("#addBtn").onclick=()=>openRoute("/add");
const alertsBtn=document.querySelector("#alertsBtn");if(alertsBtn)alertsBtn.onclick=()=>openRoute("/alerts");
const alertsClose=document.querySelector("#alertsClose");if(alertsClose)alertsClose.onclick=()=>{document.querySelector("#alertsModal")?.classList.add("hidden");goHome();};
document.querySelector("#newReel").onclick=()=>openRoute("/add");
document.querySelector("#closeBtn").onclick=()=>{closeModal();goHome();};
document.querySelector("#saveBtn").onclick=addReel;
document.querySelector("#refreshBtn").onclick=loadReels;
document.querySelector("#homeBtn").onclick=()=>{closeModal();settingsModal.classList.add("hidden");document.querySelector("#alertsModal")?.classList.add("hidden");goHome();loadReels();};
document.querySelector("#settingsBtn").onclick=()=>openRoute("/settings");
document.querySelector("#settingsClose").onclick=()=>{settingsModal.classList.add("hidden");goHome();};
const test=document.querySelector("#testAlarm");
if(test)test.onclick=async()=>{
  test.disabled=true;
  const oldText=test.textContent;
  test.textContent="Sending...";
  try{
    if(window.contentMonitorNative?.testNotification){
      const ok=await window.contentMonitorNative.testNotification();
      if(!ok)throw new Error("Native notification permission was not granted");
      alert("Test notification sent to your phone.");
    }else{
      throw new Error("Native notification bridge is not loaded");
    }
  }catch(e){
    console.error("Test notification failed",e);
    alert("Could not send the test notification. Please allow notifications in Android settings and try again.");
  }finally{
    test.disabled=false;
    test.textContent=oldText;
  }
};
document.querySelector("#enableNotifications").onclick=()=>setupNotifications();
document.querySelector("#url").addEventListener("input",()=>{const p=detectPlatform(document.querySelector("#url").value),el=document.querySelector("#platformDetected");el.classList.toggle("hidden",!p);el.textContent=p==="tiktok"?"✓ TikTok detected":"✓ Instagram detected";});
const minuteOptions=Array.from({length:59},(_,i)=>"<option value='"+i+"'>"+i+"</option>").join("");
document.querySelector("#alertStartMinute").innerHTML=minuteOptions;
document.querySelector("#alertEndMinute").innerHTML=Array.from({length:59},(_,i)=>"<option value='"+(i+1)+"'>"+(i+1)+"</option>").join("");
document.querySelector("#alertStartMinute").onchange=updateRulePreview;
document.querySelector("#alertEndMinute").onchange=updateRulePreview;

document.querySelector("#minViews").oninput=updateRulePreview;document.querySelector("#alertRepeatMinutes").oninput=updateRulePreview;
loadReels().then(()=>openClipRoute());checkAlerts();setInterval(()=>{checkAlerts();},15000);setInterval(()=>{loadReels();},60000);