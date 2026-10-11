/* Service worker: cài app ra màn hình chính, nhận thông báo đẩy, lưu đệm để mở app tức thì. */
importScripts('firebase-config.js');
if (self.FIREBASE_CONFIG) {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp(self.FIREBASE_CONFIG);
  firebase.messaging();
}
const STATIC = 'sr-static-v2';   // ảnh Pokémon, font, thư viện Firebase: lấy từ bộ nhớ, không tải lại
const SHELL = 'sr-shell-v2';     // trang app: mở ngay bản đã lưu, đồng thời tải bản mới cho lần mở sau
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== STATIC && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));
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
    e.respondWith(caches.open(SHELL).then(async c => {
      const hit = await c.match(req, {ignoreSearch: true});
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => caches.match(req, {ignoreSearch: true}));
    }));
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
