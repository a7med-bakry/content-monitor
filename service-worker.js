const CACHE_NAME = "content-monitor-v11";
const ASSETS = ["./","./index.html","./styles.css?v=2","./app.js?v=22","./manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>cached))
  );
});

self.addEventListener("push", event => {
  let data={};
  try{ data=event.data ? event.data.json() : {}; }catch(e){ data={body:event.data?.text()||"Content Monitor Alert"}; }
  const title=data.title || "Content Monitor";
  const options={
    body:data.body || "A monitored clip needs your attention.",
    tag:data.tag || "content-monitor-alert",
    renotify:true,
    data:{url:data.url || "./"}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url=event.notification.data?.url || "./";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){ if("focus" in client) return client.focus(); }
    if(clients.openWindow) return clients.openWindow(url);
  }));
});