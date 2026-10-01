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
function state(r){const now=Date.now(),s=r.monitor_start_at?new Date(r.monitor_start_at).getTime():0,e=r.monitor_end_at?new Date(r.monitor_end_at).getTime():Infinity;if(now<s)return["WAITING","ok"];if(now>=e)return["ENDED","alert"];return["MONITORED","ok"];}
function updateRulePreview(){const d=Number(document.querySelector("#alertDelay").value||15),rep=Number(document.querySelector("#alertRepeat").value||60),min=Number(document.querySelector("#minViews").value||100);const rt=rep<60?rep+" minutes":rep===60?"60 minutes":(rep/60)+" hours";document.querySelector("#rulePreview").textContent="Check "+d+" minutes after each "+rt+" window. Minimum increase: "+min.toLocaleString()+" views.";}
function updateSummary(){document.querySelector("#total").textContent=reelsData.length;document.querySelector("#normal").textContent=reelsData.filter(r=>state(r)[0]!=="ENDED").length;}

async function loadReels(){try{const r=await api("list"),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load Reels");reelsData=Array.isArray(d)?d:[];render();}catch(e){reels.innerHTML="<div class='empty'>Could not load Reels.<br><br>"+esc(e.message||e)+"</div>";}}
function render(){updateSummary();if(!reelsData.length){reels.innerHTML="<div class='empty'>No Reels yet.<br><br>Tap ＋ to add your first Reel.</div>";return;}reels.innerHTML=reelsData.map(r=>{const[st,cls]=state(r),title=esc(r.title||"Reel"),platform=platformName(r.platform)||String(r.platform||"").toUpperCase();return "<article class='card'><div class='card-top'><div><div class='title'>"+title+"</div><div class='platform'>"+platform+"</div></div><span class='status "+cls+"'>"+st+"</span></div><div class='metrics'><div class='metric'><span>Snapshot</span><b>5m</b></div><div class='metric'><span>Last snapshot</span><b style='font-size:13px'>"+esc(fmt(r.last_snapshot_at))+"</b></div></div><div class='expected'>Start: <b>"+esc(fmt(r.monitor_start_at))+"</b><br>End: <b>"+esc(fmt(r.monitor_end_at))+"</b><br>Alert: <b>"+Number(r.alert_min_views_increase||100).toLocaleString()+" views</b> · check after <b>"+Number(r.alert_delay_minutes||15)+"m</b> · repeat <b>"+Number(r.alert_repeat_minutes||60)+"m</b></div><div class='account-actions'><button class='primary small' onclick='showHistory("+JSON.stringify(String(r.id))+","+JSON.stringify(String(r.title||"Reel"))+")'>History</button><a class='secondary' href='"+esc(r.url)+"' target='_blank' rel='noopener'>Open Reel</a></div></article>";}).join("");}

async function addReel(){
  const url=document.querySelector("#url").value.trim(),platform=detectPlatform(url),title=document.querySelector("#title").value.trim()||"New Reel";
  const startValue=document.querySelector("#start").value,endValue=document.querySelector("#end").value;
  const alertDelay=Number(document.querySelector("#alertDelay").value||15),alertRepeat=Number(document.querySelector("#alertRepeat").value||60),minViews=Number(document.querySelector("#minViews").value||100);
  if(!url){alert("Paste the Reel/Video URL first");return;}if(!platform){alert("Use an Instagram or TikTok link.");return;}if(minViews<1){alert("Minimum views increase must be at least 1.");return;}
  const start=new Date(startValue),end=new Date(endValue);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){alert("Choose a valid start and end time.");return;}
  const btn=document.querySelector("#saveBtn");btn.disabled=true;btn.textContent="Adding Reel + first snapshot...";
  try{const r=await api("add",{platform,url,title,platform_media_id:mediaId(url,platform),monitor_start_at:start.toISOString(),monitor_end_at:end.toISOString(),alert_delay_minutes:alertDelay,alert_repeat_minutes:alertRepeat,alert_min_views_increase:minViews});const d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to add Reel");closeModal();await loadReels();const first=d.first_snapshot;if(first?.data?.ok||first?.ok){const m=first.data?.metrics||first.metrics||{};alert("Reel added successfully. First snapshot captured:\n\nViews: "+Number(m.views||0).toLocaleString()+"\nLikes: "+Number(m.likes||0).toLocaleString());}else alert("Reel added, but the first snapshot could not be read yet. Supabase will retry on the next 5-minute check.");}
  catch(e){alert("Could not add Reel: "+(e.message||e));}finally{btn.disabled=false;btn.textContent="Add Reel & Take First Snapshot";}
}
function openModal(){const now=Date.now(),end=now+24*60*60*1000;document.querySelector("#start").value=localInput(now);document.querySelector("#end").value=localInput(end);document.querySelector("#alertDelay").value="15";document.querySelector("#alertRepeat").value="60";document.querySelector("#minViews").value="100";document.querySelector("#url").value="";document.querySelector("#title").value="";document.querySelector("#platformDetected").classList.add("hidden");updateRulePreview();modal.classList.remove("hidden");}
function closeModal(){modal.classList.add("hidden");}
async function showHistory(id,title){const overlay=document.createElement("div");overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:10000;overflow:auto;padding:20px";overlay.innerHTML="<div style='max-width:820px;margin:30px auto;background:#111;color:#fff;border-radius:18px;padding:18px'><div style='display:flex;justify-content:space-between;align-items:center;gap:10px'><div><h2 style='margin:0'>Snapshot History</h2><div style='opacity:.65;font-size:13px'>"+esc(title)+"</div></div><button id='closeHistory' class='secondary'>Close</button></div><div id='historyBody' style='margin-top:16px'>Loading...</div></div>";document.body.appendChild(overlay);overlay.querySelector("#closeHistory").onclick=()=>overlay.remove();try{const r=await api("history",{content_id:id}),d=await r.json();if(!r.ok)throw new Error(d.error||"Failed to load history");const rows=Array.isArray(d)?d:[];overlay.querySelector("#historyBody").innerHTML=rows.length?rows.map((s,i)=>{const p=rows[i+1],dv=p?Number(s.views||0)-Number(p.views||0):null,dl=p?Number(s.likes||0)-Number(p.likes||0):null,delta=p?"Δ Views: "+(dv>=0?"+":"")+dv.toLocaleString()+" · Likes: "+(dl>=0?"+":"")+dl.toLocaleString():"First snapshot";return "<div style='padding:12px 0;border-bottom:1px solid #2b2b2b'><div style='font-size:12px;opacity:.6'>"+esc(fmt(s.captured_at))+"</div><div style='line-height:1.9'>Views <b>"+Number(s.views||0).toLocaleString()+"</b> · Likes <b>"+Number(s.likes||0).toLocaleString()+"</b> · Comments <b>"+Number(s.comments||0).toLocaleString()+"</b> · Shares <b>"+Number(s.shares||0).toLocaleString()+"</b></div><div style='font-size:12px;opacity:.7'>"+delta+"</div></div>";}).join(""):"<div class='empty'>No snapshots yet.</div>";}catch(e){overlay.querySelector("#historyBody").innerHTML="<div class='empty'>Failed to load history.<br><br>"+esc(e.message||e)+"</div>";}}
window.showHistory=showHistory;

async function checkAlerts(){try{const r=await api("alerts",{after_id:lastAlertId}),d=await r.json();if(!r.ok)return;const rows=Array.isArray(d)?d:[];for(const a of rows){if(Number(a.id)<=lastAlertId)continue;lastAlertId=Number(a.id);localStorage.setItem("lastAlertId",String(lastAlertId));const title=a.title||"Reel";const body="Views increased by "+Number(a.view_delta||0).toLocaleString()+" (required "+Number(a.min_views_increase||0).toLocaleString()+")";if("Notification"in window&&Notification.permission==="granted")new Notification("⚠️ "+title,{body});else alert("⚠️ "+title+"\n\n"+body);}if(rows.length)loadReels();}catch{}}

async function setupNotifications(){if(!("Notification"in window)){alert("Notifications are not supported here.");return;}const p=Notification.permission==="granted"?"granted":await Notification.requestPermission();if(p==="granted")alert("Notifications enabled. Keep this app open to receive live alerts.");}

document.querySelector("#addBtn").onclick=openModal;
document.querySelector("#newReel").onclick=openModal;
document.querySelector("#closeBtn").onclick=closeModal;
document.querySelector("#saveBtn").onclick=addReel;
document.querySelector("#refreshBtn").onclick=loadReels;
document.querySelector("#homeBtn").onclick=loadReels;
document.querySelector("#settingsBtn").onclick=()=>settingsModal.classList.remove("hidden");
document.querySelector("#settingsClose").onclick=()=>settingsModal.classList.add("hidden");
document.querySelector("#enableNotifications").onclick=setupNotifications;
document.querySelector("#url").addEventListener("input",()=>{const p=detectPlatform(document.querySelector("#url").value),el=document.querySelector("#platformDetected");el.classList.toggle("hidden",!p);el.textContent=p==="tiktok"?"✓ TikTok detected":"✓ Instagram detected";});
document.querySelector("#alertDelay").onchange=updateRulePreview;
document.querySelector("#alertRepeat").onchange=updateRulePreview;
document.querySelector("#minViews").oninput=updateRulePreview;
loadReels();checkAlerts();setInterval(()=>{loadReels();checkAlerts();},60000);