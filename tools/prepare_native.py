
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / "www"
WWW.mkdir(exist_ok=True)

for name in [
    "index.html",
    "manifest.json",
    "sw.js",
    "version.json",
    "icon-120.png",
    "icon-152.png",
    "icon-167.png",
    "icon-180.png",
    "icon-192.png",
    "icon-512.png",
    "apple-touch-icon.png",
    "apple-touch-icon-precomposed.png",
    "qr-scanner.legacy.min.js",
    "qrcode.min.js",
]:
    src = ROOT / name
    if src.exists():
        shutil.copy2(src, WWW / name)

index = WWW / "index.html"
if index.exists():
    s = index.read_text(encoding="utf-8")
    s = s.replace(
        "https://unpkg.com/qr-scanner@1.4.2/qr-scanner.legacy.min.js",
        "./qr-scanner.legacy.min.js",
    )
    s = s.replace(
        "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
        "./qrcode.min.js",
    )
    index.write_text(s, encoding="utf-8")

sw = WWW / "sw.js"
if sw.exists():
    sw.write_text(
        """const CACHE='dar-alhafez-native-v2';
const CORE=[
  './',
  './index.html',
  './manifest.json',
  './version.json',
  './icon-512.png',
  './qr-scanner.legacy.min.js',
  './qrcode.min.js'
];

self.addEventListener('install', event =>
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', event =>
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached ||
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache =>
              cache.put(event.request, copy)
            );
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    )
  );
});
""",
        encoding="utf-8",
    )
