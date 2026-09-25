Bundled browser dependencies used by the classroom entry flow:

- Firebase JavaScript SDK 12.19.0 (`firebase-app.js`, `firebase-auth.js`, `firebase-database.js`) from `https://www.gstatic.com/firebasejs/12.19.0/`. In the Auth and Database files, the import of `firebase-app.js` was changed from the CDN URL to `./firebase-app.js` so all three modules load from this site. License: `firebase-12.19.0/LICENSE` (Apache-2.0 and bundled BSD-3-Clause notices).
- QR Code Generator from `kazuhikoarase/qrcode-generator` commit `64f5976e5f9256348d0f5417ceff934bb43cf279`, `js/dist/qrcode.mjs` renamed to `qrcode.js` for this static server's JavaScript MIME type. License: `qrcode-generator/LICENSE` (MIT).

These are pinned copies. Review upstream changes and licenses before updating them.
