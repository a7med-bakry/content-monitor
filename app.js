const SUPABASE_URL="https://rwnesehhsblejmrbzzsu.supabase.co";
const SUPABASE_KEY="sb_publishable_3vG6klw0_89fiTeXRcFPdg_EmtjhDWi";
const API=SUPABASE_URL+"/functions/v1/reel-api";
const VAPID_PUBLIC_KEY="BI4nAWrPOT2kwAyN5LkddZ7plyg79egQg33pZrV6EuFE6SJ8ORy_2Da0Fbk7Lu7VHOp6uDXELzkhGLJcYBk9uOo";
let reelsData=[];\nlet lastAlertId=Number(localStorage.getItem("lastAlertId")||0);
const reels=document.querySelector("#reels");
const modal=document.querySelector("#modal");
const settingsModal=document.querySelector("#settingsModal");

function api(action,body={}) {
  return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify({action,...body})});
}
function fmt(ts){
  if(!ts)return "—";
  return new Date(ts).toLocaleString([], {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function localInput(ts){
  const d=new Date(ts),p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());
}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function mediaId(url,platform){
  const u=String(url||"");
  if(platform==="tiktok"){const m=u.match(/\/video\/(\d+)/i);return m?m[1]:"";}
  const m=u.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i);return m?m[1]:"";
}
function state(r){
  const now=Date.now(),s=r.monitor_start_at?new Date(r.monitor_start_at).getTime():0,e=r.monitor_end_at?new Date(r.monitor_end_at).getTime():Infinity;
  if(now<s)return ["WAITING","ok"];
  if(now>=e)return ["ENDED","alert"];
  return ["MONITORED","ok"];
}
function detectPlatform(url){
  const u=String(url||"").toLowerCase();
  if(/(^|\.)tiktok\.com\//.test(u)) return "tiktok";
  if(/(^|\.)instagram\.com\//.test(u)) return "instagram";
  return "";
}
function platformName(p){return p==="tiktok"?"TikTok":p==="instagram"?"Instagram":"";}
function updateRulePreview(){
  const d=Number(document.querySelector("#alertDelay").value||15);
  const rep=Number(document.querySelector("#alertRepeat").value||60);
  const min=Number(document.querySelector("#minViews").value||100);
  const repeatText=rep<60?rep+" min":rep===60?"60 min":(rep/60)+" hr";
  document.querySelector("#rulePreview").textContent="Check "+d+" min after each "+repeatText+" window. Minimum increase: "+min.toLocaleString()+" views.";
}
function updateSummary(){
  document.querySelector("#total").textContent=reelsData.length;
  document.querySelector("#normal").textContent=reelsData.filter(r=>state(r)[0]!=="ENDED").length;
  document.querySelector("#alerts").textContent=0;
}
async function loadReels(){
  try{
    const r=await api("list"),d=await r.json();
    if(!r.ok)throw new Error(d.error||"Failed to load Reels");
    reelsData=Array.isArray(d)?d:[];
    render();
  }catch(e){
    reels.innerHTML="<div class='empty'>Could not load Reels.<br><br>"+esc(e.message||e)+"</div>";
  }
}
function render(){
  updateSummary();
  if(!reelsData.length){reels.innerHTML="<div class='empty'>No Reels yet.<br><br>Tap ＋ to add your first Reel.</div>";return;}
  reels.innerHTML=reelsData.map(r=>{
    const [st,cls]=state(r);
    const title=esc(r.title||"Reel");
    const platform=platformName(r.platform)||String(r.platform||"").toUpperCase();
    return "<article class='card'>"+
      "<div class='card-top'><div><div class='title'>"+title+"</div><div class='platform'>"+platform+"</div></div><span class='status "+cls+"'>"+st+"</span></div>"+
      "<div class='metrics'><div class='metric'><span>Interval</span><b>"+Number(r.snapshot_interval_minutes||15)+"m</b></div><div class='metric'><span>Last snapshot</span><b style='font-size:13px'>"+esc(fmt(r.last_snapshot_at))+"</b></div></div>"+
      "<div class='expected'>Start: <b>"+esc(fmt(r.monitor_start_at))+"</b><br>End: <b>"+esc(fmt(r.monitor_end_at))+"</b></div>"+
      "<div class='account-actions'><button class='primary small' onclick='showHistory("+JSON.stringify(String(r.id))+","+JSON.stringify(String(r.title||"Reel"))+")'>History</button><a class='secondary' href='"+esc(r.url)+"' target='_blank' rel='noopener'>Open Reel</a></div>"+
    "</article>";
  }).join("");
}
async function addReel(){
  const url=document.querySelector("#url").value.trim();
  const platform=detectPlatform(url);
  const title=document.querySelector("#title").value.trim()||"New Reel";
  const startValue=document.querySelector("#start").value;
  const endValue=document.querySelector("#end").value;
  const alertDelay=Number(document.querySelector("#alertDelay").value||15);
  const alertRepeat=Number(document.querySelector("#alertRepeat").value||60);
  const minViews=Number(document.querySelector("#minViews").value||100);
  if(!url){alert("Paste the Reel/Video URL first");return;}
  if(!platform){alert("Use an Instagram or TikTok link.");return;}
  if(minViews<1){alert("Minimum views increase must be at least 1.");return;}
  const start=new Date(startValue),end=new Date(endValue);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){alert("Choose a valid start and end time.");return;}
  const btn=document.querySelector("#saveBtn");
  btn.disabled=true;btn.textContent="Adding Reel + first snapshot...";
  try{
    const r=await api("add",{platform,url,title,platform_media_id:mediaId(url,platform),monitor_start_at:start.toISOString(),monitor_end_at:end.toISOString(),alert_delay_minutes:alertDelay,alert_repeat_minutes:alertRepeat,alert_min_views_increase:minViews});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||"Failed to add Reel");
    closeModal(); await loadReels();
    const first=d.first_snapshot;
    if(first?.ok){
      alert("Reel added successfully. First snapshot captured:\n\nViews: "+Number(first.data?.metrics?.views||first.metrics?.views||0).toLocaleString()+"\nLikes: "+Number(first.data?.metrics?.likes||first.metrics?.likes||0).toLocaleString());
    }else alert("Reel added, but the first snapshot could not be read yet. The Supabase collector will retry on the next scheduled check.");
  }catch(e){alert("Could not add Reel: "+(e.message||e));}
  finally{btn.disabled=false;btn.textContent="Add Reel & Take First Snapshot";}
}
function openModal(){
  const now=Date.now(),end=now+24*60*60*1000;
  document.querySelector("#start").value=localInput(now);
  document.querySelector("#end").value=localInput(end);
  document.querySelector("#alertDelay").value="15";
  document.querySelector("#alertRepeat").value="60";
  document.querySelector("#minViews").value="100";
  updateRulePreview();
  modal.classList.remove("hidden");
}
function closeModal(){modal.classList.add("hidden");document.querySelector("#url").value="";document.querySelector("#title").value="";}
async function showHistory(id,title){
  const overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:10000;overflow:auto;padding:20px";
  overlay.innerHTML="<div style='max-width:820px;margin:30px auto;background:#111;color:#fff;border-radius:18px;padding:18px'><div style='display:flex;justify-content:space-between;align-items:center;gap:10px'><div><h2 style='margin:0'>Snapshot History</h2><div style='opacity:.65;font-size:13px'>"+esc(title)+"</div></div><button id='closeHistory' class='secondary'>Close</button></div><div id='historyBody' style='margin-top:16px'>Loading...</div></div>";
  document.body.appendChild(overlay);
  overlay.querySelector("#closeHistory").onclick=()=>overlay.remove();
  try{
    const r=await api("history",{content_id:id}),d=await r.json();
    if(!r.ok)throw new Error(d.error||"Failed to load history");
    const rows=Array.isArray(d)?d:[];
    overlay.querySelector("#historyBody").innerHTML=rows.length?rows.map((s,i)=>{
      const p=rows[i+1],dv=p?Number(s.views||0)-Number(p.views||0):null,dl=p?Number(s.likes||0)-Number(p.likes||0):null;
      const delta=p?"Δ Views: "+(dv>=0?"+":"")+dv.toLocaleString()+" · Likes: "+(dl>=0?"+":"")+dl.toLocaleString():"First snapshot";
      return "<div style='padding:12px 0;border-bottom:1px solid #2b2b2b'><div style='font-size:12px;opacity:.6'>"+esc(fmt(s.captured_at))+"</div><div style='line-height:1.9'>Views <b>"+Number(s.views||0).toLocaleString()+"</b> · Likes <b>"+Number(s.likes||0).toLocaleString()+"</b> · Comments <b>"+Number(s.comments||0).toLocaleString()+"</b> · Shares <b>"+Number(s.shares||0).toLocaleString()+"</b></div><div style='font-size:12px;opacity:.7'>"+delta+"</div></div>";
    }).join(""):"<div class='empty'>No snapshots yet.</div>";
  }catch(e){overlay.querySelector("#historyBody").innerHTML="<div class='empty'>Failed to load history.<br><br>"+esc(e.message||e)+"</div>";}
}
window.showHistory=showHistory;

function urlBase64ToUint8Array(s){const p="=".repeat((4-s.length%4)%4),b=(s+p).replace(/-/g,"+").replace(/_/g,"/"),r=atob(b);return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));}
async function setupNotifications(){
  let Capacitor, PushNotifications;
  try{
    const cap=await import("@capacitor/core");
    const push=await import("@capacitor/push-notifications");
    Capacitor=cap.Capacitor;
    PushNotifications=push.PushNotifications;
  }catch(e){
    Capacitor={isNativePlatform:()=>false};
  }
  if(Capacitor.isNativePlatform()){
    try{
      let p=await PushNotifications.checkPermissions();if(p.receive!=="granted")p=await PushNotifications.requestPermissions();if(p.receive!=="granted")return;
      await PushNotifications.createChannel({id:"metric-alerts",name:"Metric Alerts",description:"Content Monitor alerts",importance:5,visibility:1,sound:"default"}).catch(()=>{});
      await PushNotifications.register();
      alert("Android notifications are ready.");
    }catch(e){alert("Could not enable notifications: "+(e.message||e));}
    return;
  }
  if(!("Notification"in window)||!("serviceWorker"in navigator)||!("PushManager"in window)){alert("Push notifications are not supported here.");return;}
  try{
    const p=Notification.permission==="granted"?"granted":await Notification.requestPermission();if(p!=="granted")return;
    const reg=await navigator.serviceWorker.register(new URL("service-worker.js",document.baseURI).href,{scope:new URL("./",document.baseURI).pathname,updateViaCache:"none"});
    await reg.update().catch(()=>{});
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
    const r=await fetch(SUPABASE_URL+"/functions/v1/tiktok-snapshots",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({action:"subscribe",subscription:sub.toJSON()})});
    if(!r.ok)throw new Error("Subscription could not be saved");
    alert("Notifications enabled.");
  }catch(e){alert("Could not enable notifications: "+(e.message||e));}
}

document.querySelector("#addBtn").onclick=openModal;
document.querySelector("#newReel").onclick=openModal;
document.querySelector("#closeBtn").onclick=closeModal;
document.querySelector("#saveBtn").onclick=addReel;\ndocument.querySelector("#url").addEventListener("input",()=>{const p=detectPlatform(document.querySelector("#url").value);const el=document.querySelector("#platformDetected");el.classList.toggle("hidden",!p);el.textContent=p==="tiktok"?"✓ TikTok detected":"✓ Instagram detected";});\ndocument.querySelector("#alertDelay").onchange=updateRulePreview;\ndocument.querySelector("#alertRepeat").onchange=updateRulePreview;\ndocument.querySelector("#minViews").oninput=updateRulePreview;
document.querySelector("#refreshBtn").onclick=loadReels;
document.querySelector("#homeBtn").onclick=loadReels;
document.querySelector("#settingsBtn").onclick=()=>settingsModal.classList.remove("hidden");
document.querySelector("#settingsClose").onclick=()=>settingsModal.classList.add("hidden");
document.querySelector("#enableNotifications").onclick=setupNotifications;
loadReels();
setInterval(loadReels,60000);