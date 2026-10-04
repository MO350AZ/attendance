const CACHE='attendance-pwa-v23';
const CORE=['./','./index.html','./manifest.json','./icon-512.png'];
const EXTERNAL=[
  'https://unpkg.com/qr-scanner@1.4.2/qr-scanner.legacy.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(CORE);
  await Promise.all(EXTERNAL.map(async url=>{
    try { const r=await fetch(url,{mode:'no-cors',cache:'no-store'}); if(r) await cache.put(url,r); } catch(e) {}
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(EXTERNAL.includes(url.href)){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{
      const copy=r.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)); return r;
    })));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{
    if(r.ok){const copy=r.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy));}
    return r;
  }).catch(()=>caches.match('./index.html'))));
});
