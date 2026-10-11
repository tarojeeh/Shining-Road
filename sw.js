/* Service worker: cài app ra màn hình chính, nhận thông báo đẩy, và lưu đệm cho app chạy nhanh. */
importScripts('firebase-config.js');
if (self.FIREBASE_CONFIG) {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp(self.FIREBASE_CONFIG);
  firebase.messaging();
}
const STATIC = 'sr-static-v1';   // ảnh Pokémon, font, thư viện Firebase: ít đổi, lấy từ bộ nhớ trước
const SHELL = 'sr-shell-v1';     // trang app: lấy bản mới trước, mất mạng thì dùng bản đã lưu
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const staticHost = url.host === 'raw.githubusercontent.com' || url.host === 'fonts.gstatic.com' ||
    url.host === 'fonts.googleapis.com' || (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
  if (staticHost) {
    e.respondWith(caches.open(STATIC).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin === location.origin && !url.pathname.endsWith('firebase-config.js')) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
