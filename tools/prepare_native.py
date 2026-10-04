from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / "www"
WWW.mkdir(exist_ok=True)

for name in [
    "index.html", "manifest.json", "sw.js",
    "icon-120.png", "icon-152.png", "icon-167.png",
    "icon-180.png", "icon-192.png", "icon-512.png",
    "apple-touch-icon.png", "apple-touch-icon-precomposed.png",
    "qr-scanner.legacy.min.js", "qrcode.min.js"
]:
    src = ROOT / name
    if src.exists(): shutil.copy2(src, WWW / name)

index = WWW / "index.html"
s = index.read_text(encoding="utf-8")
s = s.replace("https://unpkg.com/qr-scanner@1.4.2/qr-scanner.legacy.min.js", "./qr-scanner.legacy.min.js")
s = s.replace("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js", "./qrcode.min.js")
index.write_text(s, encoding="utf-8")

sw = WWW / "sw.js"
if sw.exists():
    sw.write_text("""const CACHE='dar-alhafez-native-v1';
const CORE=['./','./index.html','./manifest.json','./icon-512.png','./qr-scanner.legacy.min.js','./qrcode.min.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return r;}).catch(()=>caches.match('./index.html'))));});
""",encoding="utf-8")
