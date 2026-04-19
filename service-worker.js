const CACHE_NAME = 'museum-pdf-tool-v9';

// All assets to cache for offline use
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './guide.html',
    './js/wasm_engine.js',
    './manifest.json',
    './sound/notification.mp3',
    './icons/icon-192.png',
    './icons/icon-512.png',
    // CDN Libraries
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
    // Google Fonts CSS
    'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800;900&display=swap'
];

// Install: cache all assets individually (one failure doesn't block others)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Installing v9 — caching assets...');
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url =>
                    cache.add(url).catch(err => {
                        console.warn('[SW] Failed to cache:', url, err);
                    })
                )
            );
        })
    );
    // Activate immediately — don't wait for old tabs to close
    self.skipWaiting();
});

// Activate: remove old caches and take control of all pages immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Removing old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    // Take control of all open pages immediately (auto-update)
    self.clients.claim();
});

// Fetch: cache-first, network fallback, dynamic caching for fonts
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Dynamically cache font files and CDN resources
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
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// Listen for messages from the page (e.g. force update)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
