const CACHE_NAME = 'trip-schedule-cache-v1.0.2'; // Increment version for updates

// List of static assets that are part of your app's "shell"
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/images/icon1.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                // Pre-cache the app shell (static files)
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to cache during install:', error);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Determine the caching strategy based on the request URL
    if (event.request.url.includes('/schedule.json')) {
        // --- Strategy for schedule.json: Network First, then Cache Fallback ---
        event.respondWith(
            fetch(event.request) // Try to fetch from the network first
                .then(async (networkResponse) => {
                    // If network successful, put the fresh response in cache
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(event.request, networkResponse.clone()); // Store a clone of the response
                    return networkResponse; // Return the network response to the page
                })
                .catch(async () => {
                    // If network fails (e.g., offline), try to get from cache
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse; // Return the cached response
                    }
                    // Optional: If offline and no cache, return a fallback or error
                    // For schedule, you might just let script.js handle the display of "no schedule"
                    // return new Response('{"error": "Offline and no schedule available"}', {
                    //     headers: { 'Content-Type': 'application/json' }
                    // });
                })
        );
    } else {
        // --- Default Strategy for other static assets: Cache First, then Network ---
        event.respondWith(
            caches.match(event.request) // Try cache first
                .then((response) => {
                    if (response) {
                        return response; // Return cached if found
                    }
                    // If not in cache, go to network
                    return fetch(event.request).then(
                        (response) => {
                            // Ensure valid response before caching
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                            return response;
                        }
                    );
                })
                .catch(error => {
                    console.error('Fetch failed for non-schedule asset:', event.request.url, error);
                    // Optionally, return a fallback for offline images or other assets
                })
        );
    }
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Claiming clients.');
            return self.clients.claim(); // Make the new SW control existing clients
        })
        .then(() => {
            console.log('[Service Worker] Skipping waiting and activating immediately.');
            return self.skipWaiting(); // Make the new SW activate immediately
        })
    );
});
