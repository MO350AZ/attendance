from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / 'www'
WWW.mkdir(exist_ok=True)

for name in [
    'index.html', 'manifest.json', 'sw.js',
    'icon-120.png', 'icon-152.png', 'icon-167.png',
    'icon-180.png', 'icon-192.png', 'icon-512.png',
    'apple-touch-icon.png', 'apple-touch-icon-precomposed.png'
]:
    src = ROOT / name
    if src.exists():
        shutil.copy2(src, WWW / name)

index = WWW / 'index.html'
s = index.read_text(encoding='utf-8')
s = s.replace(
    '<script src="https://unpkg.com/qr-scanner@1.4.2/qr-scanner.legacy.min.js"></script>',
    '<script src="./qr-scanner.legacy.min.js"></script><script src="./qrcode.min.js"></script>'
)
old = """async function showQR(id){let d=await data(),s=d.students.find(x=>x.id===id);if(!s)return;$(\'qrTitle\').textContent=`QR — ${s.name}`;$(\'qrValue\').textContent=`ID: ${s.id}`;$(\'qrModal\').classList.remove(\'hidden\');let img=document.getElementById(\'qrImage\');if(!img){img=document.createElement(\'img\');img.id=\'qrImage\';img.width=260;img.height=260;img.style.maxWidth=\'100%\';$(\'qrCanvas\').replaceWith(img)}let url=\'https://quickchart.io/qr?text=\'+encodeURIComponent(s.id)+\'&size=260&margin=2\';img.src=url;$(\'qrDownload\').onclick=()=>{let a=document.createElement(\'a\');a.href=url;a.target=\'_blank\';a.rel=\'noopener\';a.click()}}"""
new = """async function showQR(id){let d=await data(),s=d.students.find(x=>x.id===id);if(!s)return;$(\'qrTitle\').textContent=`QR — ${s.name}`;$(\'qrValue\').textContent=`ID: ${s.id}`;$(\'qrModal\').classList.remove(\'hidden\');let img=document.getElementById(\'qrImage\');if(!img){img=document.createElement(\'img\');img.id=\'qrImage\';img.width=260;img.height=260;img.style.maxWidth=\'100%\';$(\'qrCanvas\').replaceWith(img)}if(typeof qrcode!==\'function\'){img.alt=\'تعذر تحميل مولد QR\';$(\'qrValue\').textContent=`ID: ${s.id} — تعذر تحميل مولد QR`;return}let qr=qrcode(0,\'M\');qr.addData(String(s.id));qr.make();let url=qr.createDataURL(6,4);img.src=url;$(\'qrDownload\').onclick=()=>{let a=document.createElement(\'a\');a.href=url;a.download=`student-${s.id}-qr.png`;a.click()}}"""
if old not in s:
    raise SystemExit('Original showQR function not found; no files changed.')
s = s.replace(old, new, 1)
index.write_text(s, encoding='utf-8')

sw = WWW / 'sw.js'
if sw.exists():
    sw.write_text("""const CACHE='attendance-pwa-native-v1';
const CORE=['./','./index.html','./manifest.json','./icon-512.png','./qr-scanner.legacy.min.js','./qrcode.min.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return r;}).catch(()=>caches.match('./index.html'))));});
""", encoding='utf-8')
