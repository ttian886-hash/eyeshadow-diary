// v178: cache local app files for offline use; never return HTML as JavaScript.
const CACHE='eyes-diary-pwa-v212';
const FILES=['./','./index.html','./firebase-cloud.js','./product-lookup.js','./vendor/zxing-browser-0.2.1.min.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png','./assets/powder-0.png','./assets/powder-1.png','./assets/powder-2.png','./assets/powder-3.png','./assets/kevyn-unblinking-24k.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('eyes-diary-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;
 const script=url.pathname.endsWith('.js'),html=req.mode==='navigate'||url.pathname.endsWith('/index.html');
 if(script||html){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}return res;}).catch(async()=>{
   const cache=await caches.open(CACHE),cached=await cache.match(req,{ignoreSearch:true});
   if(cached)return cached;
   if(html){const fallback=await cache.match('./index.html');if(fallback)return fallback;}
   return Response.error();
  }));return;
 }
 event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(req);if(cached)return cached;const res=await fetch(req);if(res.ok){const copy=res.clone();event.waitUntil(cache.put(req,copy));}return res;}));
});
