/*
 * 서비스 워커: 앱 파일을 캐시해 두고 오프라인에서도 열리게 한다.
 * 전략: 캐시 먼저 보여주고, 온라인이면 뒤에서 새 파일로 캐시를 갱신(stale-while-revalidate).
 * 파일 구성을 바꾸면 CACHE 이름의 버전을 올린다.
 */
var CACHE = 'visual-countdown-v1';
var ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/timer.js',
  './js/alerts.js',
  './js/settings.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isPage = req.mode === 'navigate';
  var cacheKey = isPage ? './index.html' : req;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(cacheKey, { ignoreSearch: isPage }).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.ok && res.type === 'basic') {
            cache.put(isPage ? './index.html' : req, res.clone());
          }
          return res;
        }).catch(function () { return cached; });
        if (cached) {
          event.waitUntil(network.catch(function () {}));
          return cached;
        }
        return network;
      });
    })
  );
});
