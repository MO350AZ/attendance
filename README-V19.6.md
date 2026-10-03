# Attendance LocalFirst V19.6 — iOS Manifest-Only Icon Test

This is a diagnostic PWA build for iOS 27 icon handling.

- No `apple-touch-icon` declarations are present.
- The Web App Manifest is the only declared PWA icon source.
- Manifest contains one PNG icon: `icon-512.png`.
- Service Worker cache version: v23.
- QR and the rest of the app are unchanged.

## Test
1. Delete the previously installed Home Screen app.
2. Start `python lan-server.py`.
3. Open the HTTPS LAN URL in Safari.
4. Reload once.
5. Share → Add to Home Screen → Open as Web App → Add.

If iOS 27 still shows the first-letter fallback with this build, the test strongly points away from the `apple-touch-icon` declarations and toward iOS/WebKit handling of the local HTTPS origin/icon during installation.
