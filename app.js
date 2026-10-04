const SUPABASE_URL="https://rwnesehhsblejmrbzzsu.supabase.co";
const SUPABASE_KEY="sb_publishable_3vG6klw0_89fiTeXRcFPdg_EmtjhDWi";
const API=SUPABASE_URL+"/functions/v1/reel-api";
const VAPID_PUBLIC_KEY="BI4nAWrPOT2kwAyN5LkddZ7plyg79egQg33pZrV6EuFE6SJ8ORy_2Da0Fbk7Lu7VHOp6uDXELzkhGLJcYBk9uOo";
let reelsData=[];
let lastAlertId=Number(localStorage.getItem("lastAlertId")||0);
const reels=document.querySelector("#reels"),modal=document.querySelector("#modal"),settingsModal=document.querySelector("#settingsModal");

function api(action,body={}){
 return fetch(API,{
  method:"POST",
  headers:{
   "Content-Type":"application/json",
   "apikey":SUPABASE_KEY,
   "Authorization":"Bearer "+SUPABASE_KEY
  },
  body:JSON.stringify({action,...body})
 });
}
function fmt(ts){if(!ts)return "—";return new Date(ts).toLocaleString([], {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function localInput(ts){const d=new Date(ts),p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function mediaId(url,platform){if(platform==="tiktok")return String(url).match(/\/video\/(\d+)/i)?.[1]||"";return String(url).match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i)?.[1]||"";}
function detectPlatform(url){const u=String(url||"").toLowerCase();if(/(^|\.)tiktok\.com\//.test(u))return"tiktok";if(/(^|\.)instagram\.com\//.test(u))return"instagram";return"";}
function platformName(p){return p==="tiktok"?"TikTok":p==="instagram"?"Instagram":"";}
function hourlyTargets(r){
 const raw=r?.hourly_targets;
 if(!raw||typeof raw!=="object")return {};
 return raw;
}
function localHour(ts=Date.now()){
 return Number(new Date(ts).toLocaleTimeString("en-US",{hour:"2-digit",hour12:false,timeZone:"Africa/Cairo"}));
}
function state(r){return["MONITORED","ok"];}
function computeAlertAnchor(startMin,endMin,repeat){const now=new Date();let a=new Date(now);a.setSeconds(0,0);a.setMinutes(startMin);const duration=(endMin-startMin)*60000;if(now.getTime()<=a.getTime()+duration)return a.toISOString();const step=Math.max(1,repeat)*60000;while(a.getTime()+duration<=now.getTime())a=new Date(a.getTime()+step);return a.toISOString();}
function updateRulePreview(){const s=Number(document.querySelector("#alertStartMinute").value||1),e=Number(document.querySelector("#alertEndMinute").value||15),rep=Number(document.querySelector("#alertRepeatMinutes").value||60),min=Number(document.querySelector("#minViews").value||100);document.querySelector("#rulePreview").textContent="Check minutes "+s+"–"+e+" every "+rep+" minutes. Alert if views are below the required increase of "+min.toLocaleString()+" views.";}
function updateSummary(){document.querySelector("#total").textContent=reelsData.length;document.querySelector("#normal").textContent=reelsData.filter(r=>r.active!==false).length;document.querySelector("#alerts").textContent=reelsData.filter(r=>r.notifications_enabled!==false).length;}
let reelFilter="all";
function setReelFilter(filter){reelFilter=filter;document.querySelectorAll(".summary>div").forEach((x,i)=>x.classList.toggle("selected",["all","active","alerts"][i]===filter));render();}
async function loadReels(){try{const r=await api("list"),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load Reels");reelsData=Array.isArray(d)?d:[];render();}catch(e){reels.innerHTML="<div class='empty'>Could not load Reels.<br><br>"+esc(e.message||e)+"</div>";}}
function render(){updateSummary();const list=reelFilter==="active"?reelsData.filter(r=>r.active!==false):reelFilter==="alerts"?reelsData.filter(r=>r.notifications_enabled!==false):reelsData;if(!list.length){reels.innerHTML="<div class='empty'>No Reels in this filter.</div>";return;}reels.innerHTML=list.map(r=>{const[st]=state(r),p=r.platform,paused=r.active===false;const icon=p==="tiktok"?"♪":"◎";const cls=p==="tiktok"?"tiktok":"instagram";const views=r.latest_views==null?"—":Number(r.latest_views).toLocaleString(),likes=r.latest_likes==null?"—":Number(r.latest_likes).toLocaleString();return "<button class='reel-row' onclick='showDetails("+JSON.stringify(String(r.id))+")'><div class='platform-icon "+cls+"'>"+icon+"</div><div class='reel-main'><div class='reel-name'>"+esc(r.title||"Untitled Reel")+"</div><div class='reel-platform'>"+(p==="tiktok"?"TikTok":"Instagram")+"</div></div><div class='reel-stats'><div class='mini-stat views-stat'><span class='mini-icon'>▶</span><div><strong>"+views+"</strong></div></div><div class='mini-stat likes-stat'><span class='mini-icon'>♥</span><div><strong>"+likes+"</strong></div></div></div><div class='status-dot "+(paused?"muted":(st==="MONITORED"?"good":"muted"))+"'></div><div class='chev'>›</div></button>";}).join("");}
async function showDetails(id,fromRoute=false){
 const r=reelsData.find(x=>String(x.id)===String(id));if(!r)return;
 if(!fromRoute)history.pushState({clipId:String(id)},"",location.origin+"/clip/"+encodeURIComponent(String(id)));
 const overlay=document.createElement("div");overlay.className="detail-modal";
 overlay.innerHTML="<div class='detail-sheet'><button class='close' id='detailClose'>×</button><div class='detail-head'><div class='platform-icon "+(r.platform==="tiktok"?"tiktok":"instagram")+"'>"+(r.platform==="tiktok"?"♪":"◎")+"</div><div><h2>"+esc(r.title||"Untitled Reel")+"</h2><div class='reel-platform'>"+(r.platform==="tiktok"?"TikTok":"Instagram")+" · <span class='green-text'>"+(r.active===false?"Monitoring paused":"Monitoring active")+"</span></div></div></div><div id='detailBody'><div class='loading'>Loading stats...</div></div></div>";
 document.body.appendChild(overlay);overlay.querySelector("#detailClose").onclick=()=>{overlay.remove();goHome();};
 try{
  const q=await api("history",{content_id:id}),rows=await q.json();if(!q.ok)throw new Error(rows.error||"Failed to load history");
  rows.reverse();const last=rows[rows.length-1]||{},views=Number(last.views||0),likes=Number(last.likes||0),comments=Number(last.comments||0),shares=Number(last.shares||0),saves=Number(last.saves||0),reposts=Number(last.reposts||0);
  const maxV=Math.max(1,...rows.map(x=>Number(x.views||0))),maxL=Math.max(1,...rows.map(x=>Number(x.likes||0)));
  const points=(key,max)=>rows.map((x,i)=>{const px=12+(i/(Math.max(1,rows.length-1)))*376,py=100-(Number(x[key]||0)/max)*82;return px.toFixed(1)+","+py.toFixed(1)}).join(" ");
  const snaps=rows.slice().reverse().map((s,i,a)=>{const prev=a[i+1],dv=prev?Number(s.views||0)-Number(prev.views||0):0,dl=prev?Number(s.likes||0)-Number(prev.likes||0):0,dc=prev?Number(s.comments||0)-Number(prev.comments||0):0,ds=prev?Number(s.shares||0)-Number(prev.shares||0):0,save=prev?Number(s.saves||0)-Number(prev.saves||0):0,drop=dv<0||dl<0||dc<0||ds<0||save<0;return "<div class='snap"+(drop?" snap-drop":"")+"'><span>"+esc(fmt(s.captured_at))+"</span><b>"+Number(s.views||0).toLocaleString()+"</b><em class='"+(dv>0?"up":dv<0?"down":"neutral")+"'>"+(dv>=0?"+":"")+dv.toLocaleString()+" views</em><b>"+Number(s.likes||0).toLocaleString()+"</b><em class='"+(dl>0?"up":dl<0?"down":"neutral")+"'>"+(dl>=0?"+":"")+dl.toLocaleString()+" likes</em></div>"}).join("");
  overlay.querySelector("#detailBody").innerHTML="<div class='totals'><div><span>Total views</span><strong>"+views.toLocaleString()+"</strong></div><div><span>Total likes</span><strong>"+likes.toLocaleString()+"</strong></div></div><div class='totals totals-small'><div><span>Total comments</span><strong>"+comments.toLocaleString()+"</strong></div><div><span>Total saves</span><strong>"+saves.toLocaleString()+"</strong></div><div><span>Total shares</span><strong>"+shares.toLocaleString()+"</strong></div><div><span>Total reposts</span><strong>"+reposts.toLocaleString()+"</strong></div></div><div class='chart-card'><div class='chart-title'>Views</div><svg viewBox='0 0 400 110' preserveAspectRatio='none'><polyline points='"+points("views",maxV)+"' fill='none' stroke='currentColor' stroke-width='3'/></svg></div><div class='chart-card likes-chart'><div class='chart-title'>Likes</div><svg viewBox='0 0 400 110' preserveAspectRatio='none'><polyline points='"+points("likes",maxL)+"' fill='none' stroke='currentColor' stroke-width='3'/></svg></div><div class='detail-actions'><button class='primary' id='snapshotNow'>Take Snapshot Now</button><button class='secondary' onclick='showMonitoring(" + JSON.stringify(String(r.id)) + ")'>Monitoring</button><a class='secondary' href='" + esc(r.url) + "' target='_blank' rel='noopener'>Open Reel</a><button class='secondary' onclick='copyClipLink(" + JSON.stringify(String(r.id)) + ")'>Copy Link</button></div><div class='clip-management'><button class='secondary' id='toggleAlerts'>" + (r.notifications_enabled===false?"Resume Alerts":"Stop Alerts") + "</button><button class='secondary' id='toggleMonitor'>" + (r.active===false?"Resume Monitoring":"Stop Monitoring") + "</button><button class='danger' id='deleteClipBtn'>Delete Reel</button></div><div class='alert-info'><b>Monitoring</b><br>Hourly targets are fixed to each clock hour. Drop monitoring checks views, likes, comments, shares and saves after every snapshot.</div><h3 class='snap-title'>Snapshots</h3><div class='snapshots'>"+(snaps||"<div class='empty'>No snapshots yet.</div>")+"</div>";
  overlay.querySelector("#snapshotNow").onclick=async()=>{const btn=overlay.querySelector("#snapshotNow"),old=btn.textContent;btn.disabled=true;btn.textContent="Taking snapshot...";try{const q=await api("snapshot_now",{content_id:id}),d=await q.json();if(!q.ok||d.ok===false)throw new Error(d.error||"Snapshot failed");const m=d.metrics||{};alert("Snapshot captured now. Views: "+Number(m.views||0).toLocaleString()+" | Likes: "+Number(m.likes||0).toLocaleString()+" | Comments: "+Number(m.comments||0).toLocaleString()+" | Shares: "+Number(m.shares||0).toLocaleString()+" | Saves: "+Number(m.saves||0).toLocaleString());await loadReels();showDetails(id,true);}catch(e){alert("Could not take snapshot: "+(e.message||e));btn.disabled=false;btn.textContent=old;}};
  overlay.querySelector("#toggleAlerts").onclick=()=>toggleNotifications(id,r.notifications_enabled!==false);
  overlay.querySelector("#toggleMonitor").onclick=()=>toggleMonitoring(id,r.active!==false);
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
 overlay.innerHTML="<div class='monitor-sheet'><button class='close' id='monitorClose'>×</button><div class='monitor-head'><div><h2>Monitoring</h2><div class='monitor-sub'>"+esc(r.title||"Untitled Reel")+"</div></div><button class='monitor-edit-icon' id='monitorEdit' title='Edit monitoring' aria-label='Edit monitoring'>✎</button></div><div class='monitor-tabs'><button class='monitor-tab active' data-tab='growth'>View Growth</button><button class='monitor-tab' data-tab='drops'>Drops</button></div><div id='monitorBody' class='monitor-body'></div></div>";
 document.body.appendChild(overlay);
 overlay.querySelector("#monitorClose").onclick=()=>overlay.remove();
 const body=overlay.querySelector("#monitorBody");
 let history=[];
 const renderGrowth=()=>{
  const targets=hourlyTargets(r),snaps=history.slice().sort((a,b)=>new Date(a.captured_at)-new Date(b.captured_at));
  const cairoParts=(ts)=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hour12:false}).formatToParts(new Date(ts));const o={};for(const p of parts)if(p.type!=="literal")o[p.type]=p.value;return o;};
  const dayKey=(ts)=>{const p=cairoParts(ts);return p.year+"-"+p.month+"-"+p.day;};
  const dayLabel=(key)=>{const d=new Date(key+"T12:00:00Z");return new Intl.DateTimeFormat("en-US",{timeZone:"Africa/Cairo",day:"numeric",month:"long",year:"numeric"}).format(d);};
  const hourOf=(ts)=>Number(cairoParts(ts).hour);

  // Every snapshot belongs to exactly one clock-hour chain.
  // For snapshot N, its delta covers previous_snapshot -> snapshot_N, so assign
  // it by the midpoint of that interval. This keeps boundary snapshots from
  // disappearing: 19:50->20:00 belongs to hour 19; 19:55->20:05 belongs to hour 20.
  const entries=snaps.map((snap,i)=>{
    const prev=i>0?snaps[i-1]:null;
    const at=new Date(snap.captured_at).getTime();
    const pt=prev?new Date(prev.captured_at).getTime():NaN;
    const assignedMs=prev&&Number.isFinite(pt)&&Number.isFinite(at)&&at>pt ? pt+(at-pt)/2 : at;
    return {
      snap,prev,assigned_at:new Date(assignedMs).toISOString(),
      dv:prev?Number(snap.views||0)-Number(prev.views||0):0,
      dl:prev?Number(snap.likes||0)-Number(prev.likes||0):0
    };
  });

  const days={};for(const e of entries){const k=dayKey(e.assigned_at);(days[k]||(days[k]=[])).push(e);}
  const dayKeys=Object.keys(days).sort((a,b)=>b.localeCompare(a));if(!dayKeys.length){body.innerHTML="<div class='empty'>No snapshot data yet.</div>";return;}
  const todayKey=dayKey(Date.now());
  const dayHtml=dayKeys.map((dateKey,dayIndex)=>{
    const dayEntries=days[dateKey]||[],byHour={};for(const e of dayEntries){const h=hourOf(e.assigned_at);(byHour[h]||(byHour[h]=[])).push(e);}
    const hours=Array.from({length:24},(_,h)=>{
      const t=targets[String(h)]||targets[String(h).padStart(2,"0")]||{},minV=Number(t.views||0),minL=Number(t.likes||0),arr=(byHour[h]||[]).slice().sort((a,b)=>new Date(a.assigned_at)-new Date(b.assigned_at));
      const complete=dateKey!==todayKey||h<localHour(),hasTarget=minV>0||minL>0;let status=hasTarget?"nodata":"no-target",result="—";
      const growthRows=arr.filter(e=>e.prev);
      const dv=growthRows.reduce((n,e)=>n+Number(e.dv||0),0),dl=growthRows.reduce((n,e)=>n+Number(e.dl||0),0);
      if(growthRows.length&&hasTarget&&complete){const pass=(minV<=0||dv>=minV)&&(minL<=0||dl>=minL);status=pass?"pass":"fail";result=(dv>=0?"+":"")+dv.toLocaleString()+" views · "+(dl>=0?"+":"")+dl.toLocaleString()+" likes";}
      else if(hasTarget&&dateKey===todayKey&&h===localHour())status="pending";
      const label=status==="pass"?"PASS":status==="fail"?"NOT MET":status==="pending"?"IN PROGRESS":status==="nodata"?"NO DATA":"—";
      const snapshotList=arr.length?arr.slice().reverse().map(e=>{const snap=e.snap,dv=Number(e.dv||0),dl=Number(e.dl||0);return "<div class='monitor-snap'><span>"+esc(fmt(snap.captured_at))+"</span><b>"+Number(snap.views||0).toLocaleString()+" views</b><em class='"+(dv>0?"up":dv<0?"down":"neutral")+"'>"+(dv>=0?"+":"")+dv.toLocaleString()+"</em><b>"+Number(snap.likes||0).toLocaleString()+" likes</b><em class='"+(dl>0?"up":dl<0?"down":"neutral")+"'>"+(dl>=0?"+":"")+dl.toLocaleString()+"</em></div>";}).join(""):"<div class='monitor-snaps-empty'>No data yet for this hour.</div>";
      const resultBox=growthRows.length&&hasTarget&&complete?"<div class='monitor-growth'><span>Actual growth</span><strong>"+result+"</strong></div>":"";
      return "<div class='monitor-row'><div class='monitor-row-top'><div class='monitor-number'>"+String(h).padStart(2,"0")+"</div><div class='monitor-period'><b>"+String(h).padStart(2,"0")+":00 – "+String(h).padStart(2,"0")+":59</b><small>Min views: "+(minV||0).toLocaleString()+" · Min likes: "+(minL||0).toLocaleString()+" · "+arr.length+" snapshots</small></div><div class='monitor-status "+status+"'>"+label+"</div></div><button class='monitor-expand' aria-expanded='false'>↓</button><div class='monitor-result collapsed'><div class='monitor-snaps'>"+resultBox+snapshotList+"</div></div></div>";
    }).join("");
    const open=dayIndex===0;return "<div class='monitor-day'><button class='monitor-day-toggle' aria-expanded='"+open+"'><span>"+esc(dayLabel(dateKey))+"</span><b>"+dayEntries.length+" snapshots</b><i>"+(open?"↑":"↓")+"</i></button><div class='monitor-day-body "+(open?"":"collapsed")+"'>"+hours+"</div></div>";
  }).join("");
  body.innerHTML="<div class='monitor-summary'><span>Fixed clock hours · Cairo time</span><b>Boundary snapshots are assigned by interval midpoint so no snapshot is lost</b></div>"+dayHtml;
  body.querySelectorAll(".monitor-day-toggle").forEach(btn=>btn.onclick=()=>{const d=btn.nextElementSibling,open=d.classList.contains("collapsed");d.classList.toggle("collapsed",!open);btn.setAttribute("aria-expanded",String(open));btn.querySelector("i").textContent=open?"↑":"↓";});
  body.querySelectorAll(".monitor-expand").forEach(btn=>btn.onclick=()=>{const row=btn.closest(".monitor-row"),d=row?.querySelector(".monitor-result");if(!d)return;const open=d.classList.contains("collapsed");d.classList.toggle("collapsed",!open);d.classList.toggle("open",open);btn.textContent=open?"↑":"↓";btn.setAttribute("aria-expanded",String(open));});
 };
 const renderDrops=()=>{
  const snaps=history.slice().sort((a,b)=>new Date(a.captured_at)-new Date(b.captured_at)),drops=[];
  for(let i=1;i<snaps.length;i++){const p=snaps[i-1],s=snaps[i],m=[["views",p.views,s.views],["likes",p.likes,s.likes],["comments",p.comments,s.comments],["shares",p.shares,s.shares],["saves",p.saves,s.saves]].filter(x=>x[1]!=null&&x[2]!=null&&Number(x[2])<Number(x[1]));if(m.length)drops.push({s,p,m});}
  if(!drops.length){body.innerHTML="<div class='empty'>No drops detected yet.</div>";return;}
  body.innerHTML="<div class='drop-monitor-summary'>Any snapshot with a decrease in views, likes, comments, shares or saves appears here.</div>"+drops.reverse().map((d,i)=>"<div class='drop-row'><div class='drop-row-head'><div class='monitor-number'>"+(drops.length-i)+"</div><b>"+esc(fmt(d.s.captured_at))+"</b><span class='drop-badge'>DROP</span><button class='monitor-expand' aria-expanded='false'>↓</button></div><div class='drop-metrics collapsed'>"+d.m.map(x=>"<div><span>"+x[0].toUpperCase()+"</span><b class='down'>"+Number(x[1]).toLocaleString()+" → "+Number(x[2]).toLocaleString()+" ("+(Number(x[2])-Number(x[1])).toLocaleString()+")</b></div>").join("")+"</div></div>").join("");
 body.querySelectorAll('.drop-row .monitor-expand').forEach(btn=>btn.onclick=()=>{const row=btn.closest('.drop-row');const d=row?.querySelector('.drop-metrics');if(!d)return;const o=d.classList.contains('collapsed');d.classList.toggle('collapsed',!o);btn.textContent=o?'↑':'↓';btn.setAttribute('aria-expanded',String(o));});
 };

 body.innerHTML="<div class='loading'>Loading monitoring...</div>";
 try{const q=await api("history",{content_id:id}),rows=await q.json();if(!q.ok)throw new Error(rows.error||"Failed to load history");history=Array.isArray(rows)?rows:[];renderGrowth();}catch(e){body.innerHTML="<div class='empty'>Failed to load monitoring.<br><br>"+esc(e.message||e)+"</div>";}
 overlay.querySelectorAll(".monitor-tab").forEach(btn=>btn.onclick=()=>{overlay.querySelectorAll(".monitor-tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");btn.dataset.tab==="drops"?renderDrops():renderGrowth();});
 overlay.querySelector("#monitorEdit").onclick=async()=>{overlay.remove();await editMonitoring(id);};
}
window.showMonitoring=showMonitoring;

async function editMonitoring(id){
 const r=reelsData.find(x=>String(x.id)===String(id));if(!r)return;
 const overlay=document.createElement("div");
 overlay.className="edit-monitor-modal";
 overlay.innerHTML="<div class='edit-monitor-sheet'><button class='close' id='editClose'>×</button><div class='modal-icon'>⚙</div><h2>Edit Monitoring</h2><p class='hint'>Set the minimum views and likes for each fixed clock hour.</p><div class='apply-all-card'><b>Apply to all hours</b><small>Set one minimum for Views and Likes and apply it to every hour.</small><div class='apply-all-fields'><input id='allMinViews' type='number' min='0' placeholder='Min views'><input id='allMinLikes' type='number' min='0' placeholder='Min likes'><button class='secondary' id='applyAll' type='button'>Apply to all</button></div></div><div class='hourly-head'><span>Hour</span><span>Min views</span><span>Min likes</span></div><div id='hourlyRows'></div><label class='toggle-row'><span><b>Drop monitoring</b><small>Alert immediately if views, likes, comments, shares or saves decrease.</small></span><input id='editDrops' type='checkbox'></label><label class='toggle-row'><span><b>Notifications</b><small>Turn alert generation and push notifications on or off.</small></span><input id='editNotifications' type='checkbox'></label><button class='primary' id='editSave' type='button'>Save changes</button></div>";
 document.body.appendChild(overlay);
 const sheet=overlay.querySelector(".edit-monitor-sheet"),targets=hourlyTargets(r),rows=overlay.querySelector("#hourlyRows");
 overlay.querySelector("#editDrops").checked=r.monitor_drops!==false;
 overlay.querySelector("#editNotifications").checked=r.notifications_enabled!==false;
 rows.innerHTML=Array.from({length:24},(_,h)=>{
  const t=targets[String(h)]||targets[String(h).padStart(2,"0")]||{};
  return "<div class='hourly-row'><b>"+String(h).padStart(2,"0")+":00–"+String(h).padStart(2,"0")+":59</b><input data-hour='"+h+"' data-kind='views' type='number' min='0' value='"+Number(t.views||0)+"' placeholder='0'><input data-hour='"+h+"' data-kind='likes' type='number' min='0' value='"+Number(t.likes||0)+"' placeholder='0'></div>";
 }).join("");
 overlay.querySelector("#applyAll").onclick=()=>{
  const v=Math.max(0,Number(overlay.querySelector("#allMinViews").value||0)),l=Math.max(0,Number(overlay.querySelector("#allMinLikes").value||0));
  rows.querySelectorAll(".hourly-row").forEach(x=>{x.querySelector("[data-kind=views]").value=v;x.querySelector("[data-kind=likes]").value=l;});
 };
 const close=()=>overlay.remove();
 overlay.querySelector("#editClose").onclick=close;
 overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
 overlay.querySelector("#editSave").onclick=async()=>{
  const btn=overlay.querySelector("#editSave");btn.disabled=true;btn.textContent="Saving...";
  try{
   const ht={};
   rows.querySelectorAll(".hourly-row").forEach(row=>{
    const h=row.querySelector("[data-hour]").dataset.hour,v=Number(row.querySelector("[data-kind=views]").value||0),l=Number(row.querySelector("[data-kind=likes]").value||0);
    if(v>0||l>0)ht[String(Number(h))]={views:v,likes:l};
   });
   const q=await api("update",{content_id:id,hourly_targets:ht,monitor_drops:overlay.querySelector("#editDrops").checked,notifications_enabled:overlay.querySelector("#editNotifications").checked});
   const raw=await q.text();
   let d={};try{d=raw?JSON.parse(raw):{};}catch{throw new Error("Invalid server response");}
   if(!q.ok)throw new Error(d.error||("Server rejected the update ("+q.status+")"));
   const i=reelsData.findIndex(x=>String(x.id)===String(id));if(i>=0)reelsData[i]={...reelsData[i],...(d.reel||{})};
   close();render();
   const detail=document.querySelector(".detail-modal");if(detail)detail.remove();
   showDetails(id);
  }catch(err){
   btn.disabled=false;btn.textContent="Save changes";
   const oldErr=overlay.querySelector(".edit-save-error");if(oldErr)oldErr.remove();
   const e=document.createElement("div");e.className="edit-save-error";e.textContent="Could not save changes: "+(err.message||err);
   btn.insertAdjacentElement("beforebegin",e);
 }
 };
 sheet.scrollTop=0;
}
async function toggleMonitoring(id,isActive){if(!confirm(isActive?"Stop monitoring this clip? Snapshots will pause, but its history will stay.":"Resume monitoring this clip?"))return;try{const q=await api("update",{content_id:id,active:!isActive});const d=await q.json();if(!q.ok)throw new Error(d.error||"Update failed");const i=reelsData.findIndex(x=>String(x.id)===String(id));if(i>=0)reelsData[i]={...reelsData[i],active:!isActive};document.querySelector(".detail-modal")?.remove();render();}catch(e){alert("Could not change monitoring: "+(e.message||e));}}
async function toggleNotifications(id,isEnabled){try{const q=await api("update",{content_id:id,notifications_enabled:!isEnabled});const d=await q.json();if(!q.ok)throw new Error(d.error||"Update failed");const i=reelsData.findIndex(x=>String(x.id)===String(id));if(i>=0)reelsData[i]={...reelsData[i],...(d.reel||{})};document.querySelector(".detail-modal")?.remove();render();showDetails(id);}catch(e){alert("Could not change alerts: "+(e.message||e));}}
window.toggleNotifications=toggleNotifications;
async function deleteClip(id){if(!confirm("Delete this clip and all its snapshot/alert history? This cannot be undone."))return;try{const q=await api("delete",{content_id:id});const d=await q.json();if(!q.ok)throw new Error(d.error||"Delete failed");reelsData=reelsData.filter(x=>String(x.id)!==String(id));document.querySelector(".detail-modal")?.remove();render();}catch(e){alert("Could not delete clip: "+(e.message||e));}}
async function copyClipLink(id){const r=reelsData.find(x=>String(x.id)===String(id));const u=r?.url||location.origin+"/clip/"+encodeURIComponent(String(id));try{await navigator.clipboard.writeText(u);alert("Reel link copied");}catch{prompt("Copy this Reel link:",u);}}
window.copyClipLink=copyClipLink;
window.toggleMonitoring=toggleMonitoring;window.deleteClip=deleteClip;
window.editMonitoring=editMonitoring;window.editMonitoring=editMonitoring;

async function addReel(){
 const url=document.querySelector("#url").value.trim(),platform=detectPlatform(url),title=document.querySelector("#title").value.trim()||"New Reel";
 if(!url){alert("Paste the Reel/Video URL first");return;}if(!platform){alert("Use an Instagram or TikTok link.");return;}
 const hourly_targets={};document.querySelectorAll("#addHourlyRows .hourly-row").forEach(row=>{const h=row.querySelector("[data-hour]").dataset.hour,v=Number(row.querySelector("[data-kind=views]").value||0),l=Number(row.querySelector("[data-kind=likes]").value||0);if(v>0||l>0)hourly_targets[String(Number(h))]={views:v,likes:l};});
 const btn=document.querySelector("#saveBtn");btn.disabled=true;btn.textContent="Adding Reel + first snapshot...";
 try{const r=await api("add",{platform,url,title,platform_media_id:mediaId(url,platform),snapshot_interval_minutes:5,hourly_targets,monitor_drops:document.querySelector("#monitorDrops")?.checked!==false,notifications_enabled:document.querySelector("#monitorNotifications")?.checked!==false});const d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to add Reel");closeModal();await loadReels();const first=d.first_snapshot;if(first?.ok){const m=first.metrics||{};alert("Reel added. First snapshot: Views "+Number(m.views||0).toLocaleString()+" | Likes "+Number(m.likes||0).toLocaleString());}else alert("Reel added, but the first snapshot could not be read yet. Supabase will retry on the next check.");}
 catch(e){alert("Could not add Reel: "+(e.message||e));}finally{btn.disabled=false;btn.textContent="Add Reel & Take First Snapshot";}
}
function closeModal(){modal.classList.add("hidden");}
function fillAddHourlyRows(){const box=document.querySelector("#addHourlyRows");if(!box)return;box.innerHTML=Array.from({length:24},(_,h)=>"<div class='hourly-row'><b>"+String(h).padStart(2,"0")+":00–"+String(h).padStart(2,"0")+":59</b><input data-hour='"+h+"' data-kind='views' type='number' min='0' value='' placeholder='0'><input data-hour='"+h+"' data-kind='likes' type='number' min='0' value='' placeholder='0'></div>").join("");}
function openModal(){document.querySelector("#url").value="";document.querySelector("#title").value="";document.querySelector("#platformDetected").classList.add("hidden");document.querySelector("#monitorDrops").checked=true;document.querySelector("#monitorNotifications").checked=true;fillAddHourlyRows();modal.classList.remove("hidden");}
async function showHistory(id,title){const overlay=document.createElement("div");overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:10000;overflow:auto;padding:20px";overlay.innerHTML="<div style='max-width:820px;margin:30px auto;background:#111;color:#fff;border-radius:18px;padding:18px'><div style='display:flex;justify-content:space-between;align-items:center;gap:10px'><div><h2 style='margin:0'>Snapshot History</h2><div style='opacity:.65;font-size:13px'>"+esc(title)+"</div></div><button id='closeHistory' class='secondary'>Close</button></div><div id='historyBody' style='margin-top:16px'>Loading...</div></div>";document.body.appendChild(overlay);overlay.querySelector("#closeHistory").onclick=()=>overlay.remove();try{const r=await api("history",{content_id:id}),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load history");const rows=Array.isArray(d)?d:[];overlay.querySelector("#historyBody").innerHTML=rows.length?rows.map((s,i)=>{const p=rows[i+1],dv=p?Number(s.views||0)-Number(p.views||0):null,dl=p?Number(s.likes||0)-Number(p.likes||0):null,delta=p?"Δ Views: "+(dv>=0?"+":"")+dv.toLocaleString()+" · Likes: "+(dl>=0?"+":"")+dl.toLocaleString():"First snapshot";return "<div style='padding:12px 0;border-bottom:1px solid #2b2b2b'><div style='font-size:12px;opacity:.6'>"+esc(fmt(s.captured_at))+"</div><div style='line-height:1.9'>Views <b>"+Number(s.views||0).toLocaleString()+"</b> · Likes <b>"+Number(s.likes||0).toLocaleString()+"</b> · Comments <b>"+Number(s.comments||0).toLocaleString()+"</b> · Shares <b>"+Number(s.shares||0).toLocaleString()+"</b></div><div style='font-size:12px;opacity:.7'>"+delta+"</div></div>";}).join(""):"<div class='empty'>No snapshots yet.</div>";}catch(e){overlay.querySelector("#historyBody").innerHTML="<div class='empty'>Failed to load history.<br><br>"+esc(e.message||e)+"</div>";}}
window.showHistory=showHistory;

async function loadAlertHistory(){
 const box=document.querySelector("#alertList"); if(!box)return;
 try{
  const q=await api("alerts_history"),rawRows=await q.json(); if(!q.ok)throw new Error();
  const rows=Array.isArray(rawRows)?rawRows:[];
  const seen=new Set();
  const uniqueRows=rows.filter(a=>{
    const key=a.alert_key||[a.content_id,a.alert_type,a.metric,a.previous_views,a.current_views,a.previous_likes,a.current_likes,a.previous_comments,a.current_comments,a.previous_shares,a.current_shares,a.previous_saves,a.current_saves].join("|");
    if(seen.has(key))return false; seen.add(key); return true;
  });
  if(!uniqueRows.length){box.innerHTML="<div class='empty'>No alerts yet.</div>";updateAlertBadge(0);return;}updateAlertBadge(uniqueRows.length);
  box.innerHTML=uniqueRows.map(a=>{
   const metric=a.metric==="likes"?"Likes":a.metric==="comments"?"Comments":a.metric==="shares"?"Shares":"Views";
   const drop=a.alert_type==="metric_drop",spike=a.alert_type==="metric_spike",growth=a.alert_type==="low_views_growth";
   const old=Number((drop||spike)?(a["previous_"+(a.metric||"views")]||0):a.previous_views||0);
   const cur=Number((drop||spike)?(a["current_"+(a.metric||"views")]||0):a.current_views||0);
   const msg=drop?metric+" dropped from "+old.toLocaleString()+" to "+cur.toLocaleString():spike?metric+" jumped unexpectedly from "+old.toLocaleString()+" to "+cur.toLocaleString():"Views increased by "+(cur-old).toLocaleString()+" (required growth was not met).";
   const label=drop?"DROP":spike?"SPIKE":growth?"NOT MET":"ALERT";
   const cls=drop?"drop":spike?"spike":growth?"growth":"warning";
   return "<div class='alert-item "+cls+"'><button class='alert-main' onclick='showDetails("+JSON.stringify(String(a.content_id))+")'><span class='alert-item-copy'><b class='alert-reel-title'>"+esc(a.title||"Clip")+"</b><span class='alert-message'>"+label+" · "+esc(msg)+"</span><small class='alert-time'>"+esc(fmt(a.created_at))+"</small></span></button><button class='alert-delete' title='Delete alert' aria-label='Delete alert' onclick='event.stopPropagation();deleteAlert("+Number(a.id)+")'>Delete</button></div>";
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

function updateAlertBadge(n){const e=document.querySelector("#alertBadge");if(!e)return;e.textContent=n>99?"99+":String(n);e.classList.toggle("hidden",n<=0)}
async function checkAlerts(){try{const r=await api("alerts",{after_id:lastAlertId}),d=await r.json();if(!r.ok)return;const rows=Array.isArray(d)?d:[];for(const a of rows){if(Number(a.id)<=lastAlertId)continue;lastAlertId=Number(a.id);localStorage.setItem("lastAlertId",String(lastAlertId));}if(rows.length){await loadReels();await loadAlertHistory();}}catch{}}
async function ensureNotificationWorker(){if(!("serviceWorker"in navigator))throw new Error("Service Worker is not supported in this browser.");const reg=await navigator.serviceWorker.register("/service-worker.js?v=41",{scope:"/"});await navigator.serviceWorker.ready;return reg;}
async function setupNotifications(){try{const p=Notification.permission==="granted"?"granted":await Notification.requestPermission();if(p==="granted")alert("Notifications enabled. You can control the notification sound from your phone settings.");else alert("Please allow notifications in your phone settings.");}catch(e){alert("Could not enable notifications. Please try again.");}}

document.querySelectorAll(".summary>div").forEach((el,i)=>el.onclick=()=>setReelFilter(["all","active","alerts"][i]));
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
document.querySelector("#addApplyAll")?.addEventListener("click",()=>{
  const v=Math.max(0,Number(document.querySelector("#addAllMinViews")?.value||0));
  const l=Math.max(0,Number(document.querySelector("#addAllMinLikes")?.value||0));
  document.querySelectorAll("#addHourlyRows .hourly-row").forEach(row=>{
    row.querySelector("[data-kind=views]").value=v;
    row.querySelector("[data-kind=likes]").value=l;
});
});
document.querySelector("#url").addEventListener("input",()=>{
  const p=detectPlatform(document.querySelector("#url").value),el=document.querySelector("#platformDetected");
  el.classList.toggle("hidden",!p);
  el.textContent=p==="tiktok"?"✓ TikTok detected":"✓ Instagram detected";
});

/* Startup: load the dashboard and alert badge immediately on every open. */
async function startup(){
  await Promise.all([
    loadReels(),
    loadAlertHistory()
  ]);
  await checkAlerts();
  await openClipRoute();
}
startup();
setInterval(()=>{checkAlerts();},15000);
setInterval(()=>{loadReels();loadAlertHistory();},60000);