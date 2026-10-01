import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { Browser } from "@capacitor/browser";

const accounts = JSON.parse(localStorage.getItem("cm_accounts") || "[]");
const SUPABASE_URL = "https://rwnesehhsblejmrbzzsu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3vG6klw0_89fiTeXRcFPdg_EmtjhDWi";
const VAPID_PUBLIC_KEY = "BI4nAWrPOT2kwAyN5LkddZ7plyg79egQg33pZrV6EuFE6SJ8ORy_2Da0Fbk7Lu7VHOp6uDXELzkhGLJcYBk9uOo";
let reelsData = JSON.parse(localStorage.getItem("cm_reels") || "[]");
let currentScreen = "home";
let testAccountIndex = null;

const reels = document.querySelector("#reels");
const modal = document.querySelector("#modal");
const accountModal = document.querySelector("#accountModal");

function urlBase64ToUint8Array(base64String){const padding="=".repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}

async function setupNotifications(){
  if (Capacitor.isNativePlatform()) {
    try {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== "granted") perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") {
        alert("Notifications permission was not granted.");
        return;
      }

      await PushNotifications.createChannel({
        id: "metric-alerts",
        name: "Metric Alerts",
        description: "Views and Likes drop alerts",
        importance: 5,
        visibility: 1,
        sound: "default"
      }).catch(() => {});

      await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await fetch(SUPABASE_URL + "/functions/v1/tiktok-snapshots", {
            method: "POST",
            headers: {"Content-Type":"application/json", "apikey": SUPABASE_PUBLISHABLE_KEY},
            body: JSON.stringify({action:"native_subscribe", token:value, platform:"android"})
          });
          localStorage.setItem("cm_native_push_token", value);
        } catch (e) {
          console.warn("Native push token save failed", e);
        }
      });

      await PushNotifications.addListener("registrationError", e => {
        console.error("Native push registration failed", e);
      });

      await PushNotifications.addListener("pushNotificationReceived", notification => {
        console.log("Metric alert received", notification);
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", action => {
        console.log("Metric alert opened", action);
      });

      await PushNotifications.register();
      alert("Native notifications are ready.");
      return;
    } catch (e) {
      console.error("Native push setup failed", e);
      alert("Could not enable Android notifications: " + (e?.message || e));
      return;
    }
  }

  if(!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)){
    alert("Push notifications are not supported in this browser.");
    return;
  }
  if(!window.isSecureContext){
    alert("Notifications require HTTPS.");
    return;
  }

  try{
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if(permission !== "granted"){
      localStorage.removeItem("cm_notifications_enabled");
      alert("Notifications are disabled. Allow notifications for this site in Chrome settings, then try again.");
      return;
    }

    // Register from the real site base path. This avoids relative-path issues on GitHub Pages.
    const swUrl = new URL("service-worker.js", document.baseURI).href;
    const swScope = new URL("./", document.baseURI).pathname;
    let reg = await navigator.serviceWorker.register(swUrl, {
      scope: swScope,
      updateViaCache: "none"
    });
    await reg.update().catch(()=>{});
    reg = await navigator.serviceWorker.ready;

    const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    if(currentKey.length !== 65 || currentKey[0] !== 4){
      throw new Error("Invalid VAPID public key");
    }

    let sub = await reg.pushManager.getSubscription();

    if(sub){
      try{
        const existingKey = sub.options && sub.options.applicationServerKey;
        if(existingKey){
          const a = new Uint8Array(existingKey);
          const b = new Uint8Array(currentKey);
          const same = a.length === b.length && a.every((v,i)=>v===b[i]);
          if(!same){
            await sub.unsubscribe().catch(()=>{});
            sub = null;
          }
        }
      }catch(e){}
    }

    if(!sub){
      // BufferSource compatibility: try ArrayBuffer first, then Uint8Array.
      try{
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:currentKey.buffer
        });
      }catch(firstError){
        console.warn("Push subscribe (ArrayBuffer) failed:", firstError);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:currentKey
        });
      }
    }

    const save=await fetch(SUPABASE_URL+"/functions/v1/tiktok-snapshots",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":SUPABASE_PUBLISHABLE_KEY
      },
      body:JSON.stringify({action:"subscribe",subscription:sub.toJSON()})
    });

    if(!save.ok){
      const data=await save.json().catch(()=>({}));
      throw new Error(data.error || "Push subscription could not be saved");
    }

    localStorage.setItem("cm_notifications_enabled","1");
    alert("Notifications enabled. Push alerts are ready.");
  }catch(e){
    const name=e?.name ? " ("+e.name+")" : "";
    const msg=e?.message || String(e);
    alert("Could not enable notifications"+name+": "+msg+"\n\nIf Chrome still shows 'push service error', the phone's Chrome/Google push service is refusing the subscription, not the Content Monitor server.");
  }
}
window.setupNotifications=setupNotifications;


function saveAccounts(){ localStorage.setItem("cm_accounts", JSON.stringify(accounts)); }
function saveReels(){ localStorage.setItem("cm_reels", JSON.stringify(reelsData)); }

function getHomeSnapshot(videoId){
  try{
    const data=JSON.parse(localStorage.getItem("cm_tiktok_snapshots")||"{}");
    const h=data[String(videoId)]||[];
    return h.length?h[h.length-1]:null;
  }catch(e){return null;}
}
function getHomeGrowth(videoId){
  try{
    const data=JSON.parse(localStorage.getItem("cm_tiktok_snapshots")||"{}");
    const h=data[String(videoId)]||[];
    if(h.length<2)return {views:0,likes:0,at:null};
    const a=h[h.length-2],b=h[h.length-1];
    return {views:Number(b.views||0)-Number(a.views||0),likes:Number(b.likes||0)-Number(a.likes||0),at:b.capturedAt};
  }catch(e){return {views:0,likes:0,at:null};}
}
async function refreshRemoteSnapshots(){
  try{
    const res=await fetch(SUPABASE_URL+"/functions/v1/tiktok-snapshots",{headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});
    const data=await res.json();
    if(res.ok && data.snapshots) saveTikTokSnapshots(data.snapshots);
  }catch(e){ console.warn("Remote snapshot sync failed",e); }
}

function renderHome(){
  currentScreen = "home";
  document.querySelector("#section-head").textContent = "Reels";
  const all = reelsData;
  reels.innerHTML = all.length ? all.map(r => {
    const snap=r.platform==="TikTok"&&r.videoId?getHomeSnapshot(r.videoId):null;
    const growth=r.platform==="TikTok"&&r.videoId?getHomeGrowth(r.videoId):{views:r.viewDelta||0,likes:r.likeDelta||0};
    const views=snap?Number(snap.views||0):Number(r.views||0);
    const likes=snap?Number(snap.likes||0):Number(r.likes||0);
    const monitor=r.platform==="TikTok"&&r.videoId&&loadTikTokMonitors()[String(r.videoId)];
    const last=snap&&snap.capturedAt?" · Last snapshot "+formatSnapshotTime(snap.capturedAt):"";
    return `<article class="card">
      <div class="card-top"><div><div class="title">${r.name}</div><div class="platform">${r.platform}${r.accountUsername?" · "+r.accountUsername:""}</div></div>
      <span class="status ${monitor?(r.status==="alert"?"alert":"ok"):r.status}">${monitor?(r.status==="alert"?"ALERT":"MONITORED"):(r.status==="ok"?"NORMAL":"ALERT")}</span></div>
      <div class="metrics">
        <div class="metric"><span>Views</span><b>${views.toLocaleString()}</b><small> +${growth.views.toLocaleString()} / 5m</small></div>
        <div class="metric"><span>Likes</span><b>${likes.toLocaleString()}</b><small> +${growth.likes.toLocaleString()} / 5m</small></div>
      </div>
      <div class="expected">${monitor?"Monitoring: <b>Every 5 minutes</b>":"Expected: <b>"+r.expected+"</b>"}${last}</div>
    </article>`;
  }).join("") : '<div class="empty">No reels added yet.</div>';
  updateSummary();
}

function updateSummary(){
  document.querySelector("#total").textContent = reelsData.length;
  document.querySelector("#normal").textContent = reelsData.filter(x=>x.status==="ok").length;
  document.querySelector("#alerts").textContent = reelsData.filter(x=>x.status==="alert").length;
}

function showAccounts(){
  currentScreen = "accounts";
  document.querySelector("#section-head").innerHTML = `Accounts <button class="secondary small" onclick="connectTikTok()" style="float:right">＋ Add TikTok</button>`;
  if(!accounts.length){
    reels.innerHTML = '<div class="empty">No accounts connected yet.<br><br><button class="primary" onclick="openAccountModal()">Connect Instagram</button><br><br><button class="secondary" onclick="connectTikTok()">Connect TikTok</button></div>';
    return;
  }
  reels.innerHTML = accounts.map((a,i) => {
    const isTikTok = a.platform === "TikTok";
    return `
    <article class="card">
      <div class="card-top">
        <div style="display:flex;gap:10px;align-items:center">
          ${isTikTok && a.avatar ? `<img src="${a.avatar}" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover">` : ""}
          <div>
            <div class="title">${a.username}</div>
            <div class="platform">${a.platform}${isTikTok ? " · Connected" : " · Test account"}</div>
          </div>
        </div>
        <span class="status ok">CONNECTED</span>
      </div>
      <div class="expected">${isTikTok ? "TikTok profile connected successfully." : `Test Reel: <b>${a.testReel ? "Added" : "Not added"}</b>`}</div>
      <div class="account-actions">
        ${isTikTok ? `<button class="primary small" onclick="viewTikTokVideos(${i})">View Videos</button>` : `<button class="primary small" onclick="addTestReel(${i})">${a.testReel ? "Change Test Reel" : "Add Test Reel"}</button>`}
        <button class="secondary" onclick="removeAccount(${i})">Remove</button>
      </div>
    </article>`;
  }).join("");
}

function openModal(){ modal.classList.remove("hidden"); }
function closeModal(){ modal.classList.add("hidden"); testAccountIndex = null; }
function openAccountModal(){ accountModal.classList.remove("hidden"); }
window.openAccountModal = openAccountModal;

document.querySelector("#addBtn").onclick = openModal;
document.querySelector("#notifyBtn").onclick = setupNotifications;
document.querySelector("#newReel").onclick = openModal;
document.querySelector("#closeBtn").onclick = closeModal;
document.querySelector("#accountsBtn").addEventListener("click", showAccounts);
// Native Android deep-link bridge for TikTok OAuth.
// Register this at app startup, not on a button click.
if (Capacitor.isNativePlatform()) {
  const handleNativeUrl = (rawUrl) => {
    try {
      const u = new URL(rawUrl);
      if (u.searchParams.get("tiktok")) {
        const qs = u.searchParams.toString();
        history.replaceState({}, document.title, window.location.pathname + (qs ? "?" + qs : ""));
        window.dispatchEvent(new Event("tiktok-oauth-return"));
      }
    } catch (e) {
      console.warn("Native URL handling failed", e);
    }
  };
  App.addListener("appUrlOpen", ({ url }) => handleNativeUrl(url));
  App.getLaunchUrl().then(result => {
    if (result?.url) handleNativeUrl(result.url);
  }).catch(() => {});
}
refreshRemoteSnapshots().finally(renderHome);
document.querySelector("#accountClose").addEventListener("click", () => accountModal.classList.add("hidden"));

document.querySelector("#connectIg").addEventListener("click", () => {
  const u = document.querySelector("#igUsername").value.trim().replace(/^@/,"");
  if(!u){ alert("Add the Instagram username first"); return; }
  const username = "@" + u;
  if(!accounts.some(a => a.username.toLowerCase() === username.toLowerCase())){
    accounts.push({platform:"Instagram", username, testReel:null});
    saveAccounts();
  }
  document.querySelector("#igUsername").value = "";
  accountModal.classList.add("hidden");
  showAccounts();
});

window.addTestReel = function(index){
  testAccountIndex = index;
  document.querySelector("#platform").value = "Instagram";
  document.querySelector("#url").value = accounts[index].testReel?.url || "";
  document.querySelector("#url").placeholder = "Paste Instagram Reel URL";
  openModal();
};

window.removeAccount = function(index){
  accounts.splice(index,1);
  saveAccounts();
  showAccounts();
};

document.querySelector("#saveBtn").onclick = () => {
  const url = document.querySelector("#url").value.trim();
  if(!url){ alert("Paste the Reel URL first"); return; }

  if(testAccountIndex !== null){
    const account = accounts[testAccountIndex];
    account.testReel = {url, addedAt: Date.now()};
    saveAccounts();

    const existingIndex = reelsData.findIndex(r => r.accountUsername === account.username);
    const reel = {
      name: "Instagram Test Reel",
      platform: "Instagram",
      url,
      accountUsername: account.username,
      views: 0, viewDelta: 0, likes: 0, likeDelta: 0,
      expected: `${document.querySelector("#views").value} views / hour · ${document.querySelector("#likes").value} likes / 3 hours`,
      status: "alert"
    };
    if(existingIndex >= 0) reelsData[existingIndex] = reel; else reelsData.unshift(reel);
    saveReels();
    closeModal();
    showAccounts();
    return;
  }

  reelsData.unshift({
    name:"New Reel", platform:document.querySelector("#platform").value, url,
    views:0, viewDelta:0, likes:0, likeDelta:0,
    expected:`${document.querySelector("#views").value} views / hour · ${document.querySelector("#likes").value} likes / 3 hours`,
    status:"alert"
  });
  saveReels();
  document.querySelector("#url").value = "";
  closeModal();
  refreshRemoteSnapshots().finally(renderHome);
};


function loadTikTokSnapshots(){
  try { return JSON.parse(localStorage.getItem("cm_tiktok_snapshots") || "{}"); }
  catch(e){ return {}; }
}

function saveTikTokSnapshots(data){
  localStorage.setItem("cm_tiktok_snapshots", JSON.stringify(data));
}

function recordTikTokSnapshots(videos){
  const all = loadTikTokSnapshots();
  const monitors = loadTikTokMonitors();
  const now = Date.now();
  const drops = [];

  videos.forEach(v => {
    const id = String(v.id || "");
    if(!id || !monitors[id]) return;

    if(!Array.isArray(all[id])) all[id] = [];
    const previous = all[id][all[id].length - 1];
    const current = {
      capturedAt: now,
      views: Number(v.view_count || 0),
      likes: Number(v.like_count || 0),
      comments: Number(v.comment_count || 0),
      shares: Number(v.share_count || 0)
    };

    const sameStats = previous &&
      Number(previous.views) === current.views &&
      Number(previous.likes) === current.likes &&
      Number(previous.comments) === current.comments &&
      Number(previous.shares) === current.shares;

    if(!sameStats){
      if(previous){
        const viewsDrop = current.views < Number(previous.views || 0);
        const likesDrop = current.likes < Number(previous.likes || 0);
        if(viewsDrop || likesDrop){
          drops.push({
            id,
            title: monitors[id].title || "TikTok Video",
            viewsDrop: viewsDrop ? [Number(previous.views || 0), current.views] : null,
            likesDrop: likesDrop ? [Number(previous.likes || 0), current.likes] : null
          });
        }
      }
      all[id].push(current);
    }

    if(all[id].length > 100) all[id] = all[id].slice(-100);
  });

  saveTikTokSnapshots(all);

  if(drops.length && "serviceWorker" in navigator && Notification.permission === "granted"){
    navigator.serviceWorker.ready.then(reg => {
      drops.forEach(d => {
        const parts = [];
        if(d.viewsDrop) parts.push("Views "+d.viewsDrop[0].toLocaleString()+" → "+d.viewsDrop[1].toLocaleString());
        if(d.likesDrop) parts.push("Likes "+d.likesDrop[0].toLocaleString()+" → "+d.likesDrop[1].toLocaleString());
        reg.showNotification("⚠️ Metric drop detected", {
          body: d.title + " · " + parts.join(" · "),
          tag: "drop-" + d.id,
          data: {videoId:d.id}
        });
      });
    }).catch(()=>{});
  }

  return all;
}

function formatSnapshotTime(ts){
  return new Date(ts).toLocaleString([], {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  });
}

function snapshotDelta(current, previous){
  if(!previous) return null;
  return {
    views: current.views - previous.views,
    likes: current.likes - previous.likes,
    comments: current.comments - previous.comments,
    shares: current.shares - previous.shares
  };
}

window.showTikTokHistory = function(videoId, title){
  const all = loadTikTokSnapshots();
  const history = all[String(videoId)] || [];

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:10000;overflow:auto;padding:20px;";
  overlay.innerHTML = "<div style='max-width:820px;margin:30px auto;background:#111;color:#fff;border-radius:18px;padding:18px;'>" +
    "<div style='display:flex;justify-content:space-between;align-items:center;gap:12px;'>" +
    "<div><h2 style='margin:0 0 5px;'>History</h2><div style='opacity:.7;font-size:13px;'>" + title + "</div></div>" +
    "<button id='closeHistory' class='secondary'>Close</button></div>" +
    "<div style='margin-top:16px;'>" +
    (history.length ? history.slice().reverse().map((s, i, arr) => {
      const previous = arr[i + 1];
      const d = snapshotDelta(s, previous);
      const deltaText = d ? "Δ Views: " + (d.views >= 0 ? "+" : "") + d.views.toLocaleString() +
        " · Likes: " + (d.likes >= 0 ? "+" : "") + d.likes.toLocaleString() +
        " · Comments: " + (d.comments >= 0 ? "+" : "") + d.comments.toLocaleString() +
        " · Shares: " + (d.shares >= 0 ? "+" : "") + d.shares.toLocaleString() : "First snapshot";

      return "<div style='padding:12px 0;border-bottom:1px solid #2b2b2b;'>" +
        "<div style='font-size:12px;opacity:.65;margin-bottom:6px;'>" + formatSnapshotTime(s.capturedAt) + "</div>" +
        "<div style='font-size:14px;line-height:1.8;'>Views <b>" + s.views.toLocaleString() + "</b> · Likes <b>" + s.likes.toLocaleString() +
        "</b> · Comments <b>" + s.comments.toLocaleString() + "</b> · Shares <b>" + s.shares.toLocaleString() + "</b></div>" +
        "<div style='font-size:12px;opacity:.75;margin-top:4px;'>" + deltaText + "</div></div>";
    }).join("") : "<div class='empty'>No snapshots yet. Refresh the videos later to start building history.</div>") +
    "</div></div>";

  document.body.appendChild(overlay);
  overlay.querySelector("#closeHistory").onclick = () => overlay.remove();
};

function loadTikTokMonitors(){try{return JSON.parse(localStorage.getItem("cm_tiktok_monitors")||"{}");}catch(e){return {};}}
function saveTikTokMonitors(data){localStorage.setItem("cm_tiktok_monitors",JSON.stringify(data));}
function formatLocalDateTime(ts){const d=new Date(ts),p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());}

window.openTikTokMonitor=function(video,account){
 const id=String(video.id),monitors=loadTikTokMonitors(),old=monitors[id]||{},now=Date.now(),o=document.createElement("div");
 o.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.86);z-index:11000;overflow:auto;padding:14px;";
 const title=String(video.title||video.video_description||"TikTok Video").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 o.innerHTML=`<div style="max-width:680px;margin:18px auto;background:#111;color:#fff;border-radius:20px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.45)">
  <button id="closeMonitor" class="secondary" style="float:right">Close</button>
  <h2 style="margin:0 0 5px">Growth Monitoring</h2>
  <div style="opacity:.65;font-size:13px;margin-bottom:18px">${title}</div>

  <div style="padding:15px;border:1px solid #343434;border-radius:16px;margin-bottom:14px;background:#151515">
   <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
    <div><h3 style="margin:0">Views</h3><div style="font-size:12px;opacity:.6;margin-top:3px">Independent repeating check</div></div>
    <span style="font-size:12px;padding:5px 8px;border-radius:8px;background:#222">PER WINDOW</span>
   </div>
   <label>Start date & time<input id="viewStart" type="datetime-local" value="${formatLocalDateTime(old.viewStart||now)}"></label>
   <div class="grid">
    <label>Window duration (min)<input id="viewWindow" type="number" min="1" value="${old.viewWindow||15}"></label>
    <label>Repeat every (min)<input id="viewRepeat" type="number" min="1" value="${old.viewRepeat||60}"></label>
   </div>
   <label>Minimum views gained per window<input id="viewTarget" type="number" min="0" value="${old.viewTarget??100}"></label>
   <div id="viewPreview" style="margin-top:12px;padding:11px;border-radius:11px;background:#0d0d0d;border:1px solid #292929;font-size:13px;line-height:1.8"></div>
  </div>

  <div style="padding:15px;border:1px solid #343434;border-radius:16px;margin-bottom:14px;background:#151515">
   <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
    <div><h3 style="margin:0">Likes</h3><div style="font-size:12px;opacity:.6;margin-top:3px">Independent repeating check</div></div>
    <span style="font-size:12px;padding:5px 8px;border-radius:8px;background:#222">PER WINDOW</span>
   </div>
   <label>Start date & time<input id="likeStart" type="datetime-local" value="${formatLocalDateTime(old.likeStart||now)}"></label>
   <div class="grid">
    <label>Window duration (min)<input id="likeWindow" type="number" min="1" value="${old.likeWindow||360}"></label>
    <label>Repeat every (min)<input id="likeRepeat" type="number" min="1" value="${old.likeRepeat||360}"></label>
   </div>
   <label>Minimum likes gained per window<input id="likeTarget" type="number" min="0" value="${old.likeTarget??10}"></label>
   <div id="likePreview" style="margin-top:12px;padding:11px;border-radius:11px;background:#0d0d0d;border:1px solid #292929;font-size:13px;line-height:1.8"></div>
  </div>

  <div style="padding:12px 13px;border-radius:12px;background:#1b1608;border:1px solid #4a3b16;font-size:12px;line-height:1.7;margin-bottom:14px">
   <b>How it works:</b> every window has its own baseline at the exact window start. If the required growth is not reached by the window end, that window becomes <b>ALERT</b>. The next window starts only at the configured repeat time.
  </div>
  <button id="saveMonitor" class="primary" style="width:100%;font-size:15px;padding:13px">Save Monitoring</button>
 </div>`;

 document.body.appendChild(o);

 function preview(prefix,targetId){
   const startValue=o.querySelector("#"+prefix+"Start").value;
   const s=new Date(startValue).getTime();
   const win=Math.max(1,Number(o.querySelector("#"+prefix+"Window").value||1));
   const rep=Math.max(1,Number(o.querySelector("#"+prefix+"Repeat").value||1));
   const target=Number(o.querySelector("#"+targetId).value||0);
   const box=o.querySelector("#"+prefix+"Preview");
   if(!Number.isFinite(s)){box.innerHTML="<b>Preview:</b> choose a valid start date/time.";return;}
   const fmt=ts=>new Date(ts).toLocaleString([], {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
   const lines=[];
   for(let i=0;i<3;i++){
     const ws=s+i*rep*60000,we=ws+win*60000;
     lines.push("<div><b>"+(i+1)+".</b> "+fmt(ws)+" → "+fmt(we)+" · target <b>"+target.toLocaleString()+"</b></div>");
   }
   box.innerHTML="<b>Next windows:</b>"+lines.join("")+"<div style='opacity:.55;margin-top:4px'>Window "+(win<60?win+" min":Math.floor(win/60)+"h"+(win%60?" "+win%60+"m":""))+" · repeats every "+(rep<60?rep+" min":Math.floor(rep/60)+"h"+(rep%60?" "+rep%60+"m":""))+"</div>";
 }

 function refreshPreviews(){
   preview("view","viewTarget");
   preview("like","likeTarget");
 }
 ["viewStart","viewWindow","viewRepeat","viewTarget","likeStart","likeWindow","likeRepeat","likeTarget"].forEach(x=>{
   o.querySelector("#"+x).addEventListener("input",refreshPreviews);
   o.querySelector("#"+x).addEventListener("change",refreshPreviews);
 });
 refreshPreviews();

 o.querySelector("#closeMonitor").onclick=()=>o.remove();
 o.querySelector("#saveMonitor").onclick=()=>{
  const vs=new Date(o.querySelector("#viewStart").value).getTime(),ls=new Date(o.querySelector("#likeStart").value).getTime();
  const vw=Number(o.querySelector("#viewWindow").value),vr=Number(o.querySelector("#viewRepeat").value),vt=Number(o.querySelector("#viewTarget").value);
  const lw=Number(o.querySelector("#likeWindow").value),lr=Number(o.querySelector("#likeRepeat").value),lt=Number(o.querySelector("#likeTarget").value);
  if(!Number.isFinite(vs)||!Number.isFinite(ls)||vw<1||vr<1||lw<1||lr<1||vt<0||lt<0){alert("Please enter valid monitoring settings.");return;}
  monitors[id]={
   videoId:id,title:video.title||video.video_description||"TikTok Video",accountUsername:account.username,
   viewStart:vs,viewWindow:vw,viewRepeat:vr,viewTarget:vt,
   likeStart:ls,likeWindow:lw,likeRepeat:lr,likeTarget:lt,updatedAt:Date.now()
  };
  saveTikTokMonitors(monitors);
  fetch(SUPABASE_URL+"/functions/v1/tiktok-snapshots",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action:"monitor",open_id:account.openId,platform_media_id:id,url:video.share_url||"",title:video.title||video.video_description||"TikTok Video"})}).then(async r=>{if(!r.ok){const x=await r.json().catch(()=>({}));throw new Error(x.error||"Monitor save failed");}}).catch(e=>alert("Monitoring saved locally, but server monitoring failed: "+e.message));
  const existingReel = reelsData.findIndex(r => r.platform === "TikTok" && String(r.videoId) === id);
  const card = {
    videoId:id,
    name:video.title||video.video_description||"TikTok Video",
    platform:"TikTok",
    url:video.share_url||"",
    accountUsername:account.username,
    views:Number(video.view_count||0),
    viewDelta:0,
    likes:Number(video.like_count||0),
    likeDelta:0,
    expected:"Monitoring every 5 minutes",
    status:"ok"
  };
  if(existingReel >= 0) reelsData[existingReel] = {...reelsData[existingReel], ...card};
  else reelsData.unshift(card);
  saveReels();
  o.remove();
  renderHome();
  alert("Monitoring saved. Snapshots are taken every 5 minutes for monitored clips only.");
 };
};

// Repeating growth windows: each cycle gets its own baseline at window start.
function getGrowthWindow(m,type,now){
 const prefix=type==="views"?"view":"like",start=Number(m[prefix+"Start"]),windowMin=Number(m[prefix+"Window"]),repeatMin=Number(m[prefix+"Repeat"]);
 if(!start||!windowMin||!repeatMin||now<start)return {state:"WAIT",growth:0,target:Number(m[prefix+"Target"]||0),windowStart:start,windowEnd:start+windowMin*60000};
 const elapsed=now-start,cycle=Math.floor(elapsed/(repeatMin*60000)),windowStart=start+cycle*repeatMin*60000,windowEnd=windowStart+windowMin*60000;
 if(elapsed>=cycle*repeatMin*60000+windowMin*60000)return {state:"ALERT",growth:0,target:Number(m[prefix+"Target"]||0),windowStart,windowEnd};
 return {state:"ACTIVE",growth:0,target:Number(m[prefix+"Target"]||0),windowStart,windowEnd};
}

function monitorStatus(video){
 const m=loadTikTokMonitors()[String(video.id)];if(!m)return null;
 const now=Date.now(),views=Number(video.view_count||0),likes=Number(video.like_count||0);
 const all=loadTikTokSnapshots(),history=all[String(video.id)]||[];
 function calc(type,current){
  const w=getGrowthWindow(m,type,now),prefix=type==="views"?"view":"like";
  if(w.state==="WAIT")return {...w,growth:0};
  let baseline=current;
  for(let i=history.length-1;i>=0;i--){
   const s=history[i],t=Number(s.capturedAt);
   if(t<=w.windowStart){baseline=Number(s[type==="views"?"views":"likes"]||current);break;}
  }
  const growth=current-baseline;
  if(w.state==="ACTIVE")w.state=growth>=w.target?"PASS":"ACTIVE";
  else w.state=growth>=w.target?"PASS":"ALERT";
  w.growth=growth;return w;
 }
 return {m,views:calc("views",views),likes:calc("likes",likes)};
}

window.viewTikTokVideos = async function(index){
  const account = accounts[index];
  if(!account || account.platform !== "TikTok"){ alert("TikTok account not found"); return; }
  const openId = account.openId || "";
  if(!openId){ alert("This TikTok account is missing its open_id. Reconnect TikTok first."); return; }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;overflow:auto;padding:20px;";
  overlay.innerHTML = "<div style='max-width:820px;margin:30px auto;background:#111;color:#fff;border-radius:18px;padding:18px;'>" +
    "<div style='display:flex;justify-content:space-between;align-items:center;gap:12px;'>" +
    "<h2 style='margin:0;'>" + account.username + " · Videos</h2>" +
    "<div style='display:flex;gap:8px;'><button id='refreshTikTokVideos' class='primary small'>Refresh</button><button id='closeTikTokVideos' class='secondary'>Close</button></div></div>" +
    "<div id='tiktokSnapshotStatus' style='margin-top:10px;font-size:12px;opacity:.65;'></div>" +
    "<div id='tiktokVideoBody' style='margin-top:16px;'>Loading videos...</div></div>";
  document.body.appendChild(overlay);

  overlay.querySelector("#closeTikTokVideos").onclick = () => overlay.remove();
  overlay.querySelector("#refreshTikTokVideos").onclick = () => loadVideos();

  async function loadVideos(){
    const body = overlay.querySelector("#tiktokVideoBody");
    const status = overlay.querySelector("#tiktokSnapshotStatus");
    const refresh = overlay.querySelector("#refreshTikTokVideos");
    if(!body) return;

    refresh.disabled = true;
    body.innerHTML = "Loading videos...";
    status.textContent = "Fetching latest stats...";

    try{
      const res = await fetch("https://rwnesehhsblejmrbzzsu.supabase.co/functions/v1/tiktok-videos", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({open_id:openId})
      });

      const data = await res.json();
      if(!res.ok) throw new Error(data?.details?.message || data?.error || "Failed to load TikTok videos");

      const videos = data.videos || [];
      if(!videos.length){
        body.innerHTML = "<div class='empty'>No public videos returned by TikTok.</div>";
        status.textContent = "No videos returned.";
        return;
      }

      const monitoredVideos = videos.filter(v => loadTikTokMonitors()[String(v.id)]);
      const snapshots = recordTikTokSnapshots(monitoredVideos);
      let savedCount = 0;
      videos.forEach(v => {
        const h = snapshots[String(v.id)] || [];
        if(h.length) savedCount++;
      });

      status.textContent = "Snapshot captured for " + savedCount + " monitored videos · " + new Date().toLocaleTimeString();

      body.innerHTML = videos.map(v => {
        const title = v.title || v.video_description || "TikTok Video";
        const cover = v.cover_image_url ? "<img src='" + v.cover_image_url + "' alt='' style='width:110px;height:150px;object-fit:cover;border-radius:10px;background:#222;'>" : "";
        const link = v.share_url ? "<a href='" + v.share_url + "' target='_blank' rel='noopener' style='display:inline-block;margin-top:8px;'>Open on TikTok</a>" : "";
        const historyCount = (snapshots[String(v.id)] || []).length;
        const safeTitle = String(title).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
        const mon = monitorStatus(v);
        const monitorButton = mon ? "<button class='primary small' onclick='openTikTokMonitor(" + JSON.stringify(v) + "," + JSON.stringify(account) + ")'>Edit Monitoring</button>" : "<button class='primary small' onclick='openTikTokMonitor(" + JSON.stringify(v) + "," + JSON.stringify(account) + ")'>Monitor Growth</button>";
        const monitorInfo = mon ? "<div style='margin-top:10px;padding:9px;border-radius:10px;background:#191919;font-size:12px;line-height:1.7;'>Views: <b>" + mon.views.growth.toLocaleString() + "</b> / " + mon.views.target.toLocaleString() + " · " + mon.views.state + " · " + formatSnapshotTime(mon.views.windowStart) + " → " + formatSnapshotTime(mon.views.windowEnd) + "<br>Likes: <b>" + mon.likes.growth.toLocaleString() + "</b> / " + mon.likes.target.toLocaleString() + " · " + mon.likes.state + " · " + formatSnapshotTime(mon.likes.windowStart) + " → " + formatSnapshotTime(mon.likes.windowEnd) + "</div>" : "";

        return "<article style='display:flex;gap:14px;padding:12px 0;border-bottom:1px solid #2b2b2b;'>" +
          cover +
          "<div style='flex:1;min-width:0;'>" +
          "<div style='font-weight:700;margin-bottom:8px;'>" + title + "</div>" +
          "<div style='font-size:14px;line-height:1.8;'>Views: <b>" + Number(v.view_count || 0).toLocaleString() +
          "</b><br>Likes: <b>" + Number(v.like_count || 0).toLocaleString() +
          "</b><br>Comments: <b>" + Number(v.comment_count || 0).toLocaleString() +
          "</b><br>Shares: <b>" + Number(v.share_count || 0).toLocaleString() + "</b></div>" +
          "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;'>" +
          "<button class='secondary small' onclick='showTikTokHistory(" + JSON.stringify(String(v.id)) + "," + JSON.stringify(String(title)) + ")'>History (" + historyCount + ")</button>" +
          monitorButton + link + monitorInfo +
          "</div></div></article>";
      }).join("");
    }catch(err){
      body.innerHTML = "<div class='empty'>Failed to load videos.<br><br>" + String(err.message || err) + "</div>";
      status.textContent = "Snapshot not saved.";
    }finally{
      refresh.disabled = false;
    }
  }

  loadVideos();
};
async function connectTikTok(){
  const native = Capacitor.isNativePlatform();
  const url = "https://rwnesehhsblejmrbzzsu.supabase.co/functions/v1/tiktok-start" + (native ? "?return=app" : "");
  if (native) {
    try {
      await Browser.open({ url, presentationStyle: "fullscreen" });
      return;
    } catch (e) {
      console.warn("In-app TikTok OAuth browser failed, falling back:", e);
    }
  }
  window.location.href = url;
}
window.connectTikTok = connectTikTok;

(function handleTikTokResult(){
  const p = new URLSearchParams(window.location.search);
  if(p.get("tiktok") === "connected"){
    const name = p.get("name") || "TikTok User";
    const avatar = p.get("avatar") || "";
    const openId = p.get("open_id") || "";
    const existing = accounts.findIndex(a => a.platform === "TikTok" && a.openId === openId);
    const account = {platform:"TikTok", username:name, displayName:name, avatar, openId, connectedAt:Date.now()};
    if(existing >= 0) accounts[existing] = {...accounts[existing], ...account};
    else accounts.push(account);
    saveAccounts();
    history.replaceState({}, document.title, window.location.pathname);
    showAccounts();
    alert("TikTok connected: " + name);
  } else if(p.get("tiktok") === "error"){
    const reason = p.get("reason");
    alert("TikTok authorization failed." + (reason ? "\\n\\n" + reason : ""));
    history.replaceState({}, document.title, window.location.pathname);
  }
})();

refreshRemoteSnapshots().finally(renderHome);
