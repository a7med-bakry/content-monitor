const accounts = JSON.parse(localStorage.getItem("cm_accounts") || "[]");
let reelsData = JSON.parse(localStorage.getItem("cm_reels") || "[]");
let currentScreen = "home";
let testAccountIndex = null;

const reels = document.querySelector("#reels");
const modal = document.querySelector("#modal");
const accountModal = document.querySelector("#accountModal");

function saveAccounts(){ localStorage.setItem("cm_accounts", JSON.stringify(accounts)); }
function saveReels(){ localStorage.setItem("cm_reels", JSON.stringify(reelsData)); }

function renderHome(){
  currentScreen = "home";
  document.querySelector("#section-head").textContent = "Reels";
  const all = reelsData;
  reels.innerHTML = all.length ? all.map(r => `
    <article class="card">
      <div class="card-top"><div><div class="title">${r.name}</div><div class="platform">${r.platform}</div></div>
      <span class="status ${r.status}">${r.status==="ok"?"NORMAL":"ALERT"}</span></div>
      <div class="metrics">
        <div class="metric"><span>Views</span><b>${Number(r.views).toLocaleString()}</b><small> +${r.viewDelta}/h</small></div>
        <div class="metric"><span>Likes</span><b>${Number(r.likes).toLocaleString()}</b><small> +${r.likeDelta}</small></div>
      </div>
      <div class="expected">Expected: <b>${r.expected}</b></div>
    </article>`).join("") : '<div class="empty">No reels added yet.</div>';
  updateSummary();
}

function updateSummary(){
  document.querySelector("#total").textContent = reelsData.length;
  document.querySelector("#normal").textContent = reelsData.filter(x=>x.status==="ok").length;
  document.querySelector("#alerts").textContent = reelsData.filter(x=>x.status==="alert").length;
}

function showAccounts(){
  currentScreen = "accounts";
  document.querySelector("#section-head").textContent = "Accounts";
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
document.querySelector("#newReel").onclick = openModal;
document.querySelector("#closeBtn").onclick = closeModal;
document.querySelector("#accountsBtn").addEventListener("click", showAccounts);
document.querySelector(".bottom button:first-child").addEventListener("click", renderHome);
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
  renderHome();
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
  const now = Date.now();

  videos.forEach(v => {
    const id = String(v.id || "");
    if(!id) return;

    if(!Array.isArray(all[id])) all[id] = [];
    const previous = all[id][all[id].length - 1];

    const sameStats = previous &&
      Number(previous.views) === Number(v.view_count || 0) &&
      Number(previous.likes) === Number(v.like_count || 0) &&
      Number(previous.comments) === Number(v.comment_count || 0) &&
      Number(previous.shares) === Number(v.share_count || 0);

    if(!sameStats){
      all[id].push({
        capturedAt: now,
        views: Number(v.view_count || 0),
        likes: Number(v.like_count || 0),
        comments: Number(v.comment_count || 0),
        shares: Number(v.share_count || 0)
      });
    }

    // Keep the browser storage small: last 100 snapshots per video.
    if(all[id].length > 100) all[id] = all[id].slice(-100);
  });

  saveTikTokSnapshots(all);
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

      const snapshots = recordTikTokSnapshots(videos);
      let savedCount = 0;
      videos.forEach(v => {
        const h = snapshots[String(v.id)] || [];
        if(h.length) savedCount++;
      });

      status.textContent = "Snapshot captured for " + savedCount + " videos · " + new Date().toLocaleTimeString();

      body.innerHTML = videos.map(v => {
        const title = v.title || v.video_description || "TikTok Video";
        const cover = v.cover_image_url ? "<img src='" + v.cover_image_url + "' alt='' style='width:110px;height:150px;object-fit:cover;border-radius:10px;background:#222;'>" : "";
        const link = v.share_url ? "<a href='" + v.share_url + "' target='_blank' rel='noopener' style='display:inline-block;margin-top:8px;'>Open on TikTok</a>" : "";
        const historyCount = (snapshots[String(v.id)] || []).length;
        const safeTitle = String(title).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

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
          link +
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
function connectTikTok(){
  window.location.href = "https://rwnesehhsblejmrbzzsu.supabase.co/functions/v1/tiktok-start";
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

renderHome();
