const CACHE='attendance-pwa-v26';
const CORE=['./','./index.html','./manifest.json','./version.json','./icon-512.png'];
const EXTERNAL=['https://unpkg.com/qr-scanner@1.4.2/qr-scanner.legacy.min.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(CORE.map(async url=>{try{const r=await fetch(url,{cache:'no-store'});if(r.ok)await cache.put(url,r.clone())}catch(e){}}));
  await Promise.all(EXTERNAL.map(async url=>{try{const r=await fetch(url,{mode:'no-cors',cache:'no-store'});if(r)await cache.put(url,r)}catch(e){}}));
  // Activate the new worker as soon as it is installed. The app data is in IndexedDB and is untouched.
  self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.pathname.endsWith('/version.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match('./version.json')));return;
  }
  if(EXTERNAL.includes(url.href)){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r})));return;
  }
  // HTML/app-shell must prefer the network so GitHub Pages changes are not trapped behind an old cache.
  const isNavigation=event.request.mode==='navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json') || url.pathname.endsWith('/manifest.json');
  if(isNavigation){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{
      if(r.ok)caches.open(CACHE).then(c=>c.put(event.request,r.clone()));
      return r;
    }).catch(()=>caches.match(event.request).then(c=>c||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(event.request,r.clone()));return r}).catch(()=>caches.match('./index.html'))));
});
