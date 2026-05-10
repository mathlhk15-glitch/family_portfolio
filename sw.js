const CACHE_NAME = 'family-portfolio-v16r3';
const ASSETS = [
  './',
  './index.html',
  './sw.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 캐시 가능한 요청인지 확인
// - GET만 캐시 가능 (POST는 Cache API가 지원하지 않음)
// - http/https 스킴만 허용 (chrome-extension:// 등 제외)
// - Google Apps Script 동적 요청은 캐시 제외
function isCacheable(request) {
  if (request.method !== 'GET') return false;
  const url = request.url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (url.includes('script.google.com')) return false;
  return true;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // 캐시 불가 요청은 서비스워커가 개입하지 않고 브라우저에 위임
  if (!isCacheable(event.request)) return;

  const url = new URL(event.request.url);
  const isAppShell = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
