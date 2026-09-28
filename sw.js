const CACHE='ledger-lab-v2-20260928';
const FILES=['./','./index.html','./styles.css?v=2','./app.js?v=2','./engine.js?v=2','./lessons.js?v=2','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('ledger-lab-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);
  try{const response=await fetch(request,{cache:'no-cache',signal:controller.signal});if(response.ok&&(/\.(js|css|png|webmanifest)$/.test(url.pathname)||request.mode==='navigate'))await cache.put(request,response.clone());return response}
  catch{const saved=await cache.match(request);if(saved)return saved;if(request.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell}return new Response('Unavailable offline',{status:503})}
  finally{clearTimeout(timer)}
 })());
});
