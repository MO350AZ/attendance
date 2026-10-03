# Attendance LocalFirst V19.4 — iOS Icon Fix

This build keeps the working QR scanner and LAN HTTPS server from V19.3 and makes the iOS Home Screen icon configuration explicit.

Changes:
- `apple-touch-icon.png` is explicitly referenced with an absolute root path.
- The manifest declares the 180px Apple icon plus 192px and 512px PNG icons.
- Manifest icon `purpose` is `any` for broad iOS compatibility.
- Service Worker cache is bumped to v21 and includes `apple-touch-icon.png`.

On iOS 26/27, Safari can add any site to the Home Screen as a web app; the manifest and icons still customize the installed web app. WebKit documents that `apple-touch-icon` takes precedence when both it and manifest icons are provided.


V19.5: added explicit iOS apple-touch-icon-precomposed and additional iOS icon sizes; cache v22.
