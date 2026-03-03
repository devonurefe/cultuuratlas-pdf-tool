const CACHE_NAME = 'museum-pdf-tool-v3';

// All assets to cache for offline use
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './guide.html',
    './js/wasm_engine.js',
    './css/style.css',
    './manifest.json',
    './sound/notification.mp3',
    './icons/icon-192.png',
    './icons/icon-512.png',
    // CDN Libraries — cached after first load
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
    // Google Fonts CSS
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install: cache all critical assets (individually so one failure doesn't block all)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Installing and caching assets...');
            // Cache each asset individually so a single CDN failure doesn't break everything
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url =>
                    cache.add(url).catch(err => {
                        console.warn('[SW] Failed to cache:', url, err);
                    })
                )
            );
        })
    );
    self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: cache-first, network fallback, then cache any new responses
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Cache dynamic font files and any other successful responses
                if (networkResponse && networkResponse.status === 200) {
                    const url = event.request.url;
                    const shouldCache =
                        url.includes('fonts.gstatic.com') ||
                        url.includes('fonts.googleapis.com') ||
                        url.includes('cdnjs.cloudflare.com');

                    if (shouldCache) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                }
                return networkResponse;
            }).catch(() => {
                // Offline fallback: return index.html for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
