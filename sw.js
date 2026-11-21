/* Independent static offline shell. Cross-origin weather API is never intercepted. */
const CACHE='kairos-shell-v2-visual-alignment';
const SHELL=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith('kairos-shell-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url),scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(async response=>{
      if(response.ok){const cache=await caches.open(CACHE);cache.put('./index.html',response.clone()).catch(()=>{});}return response;
    }).catch(async()=>await (await caches.open(CACHE)).match('./index.html')||Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>{});}return response;
  })));
});
