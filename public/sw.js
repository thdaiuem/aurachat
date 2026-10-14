/* =========================================================
   AuraChat - Service Worker for PWA & Push Notifications
   ========================================================= */

const CACHE_NAME = 'aurachat-pwa-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/badge-72.png',
    '/icons/icon.svg'
];

// Install: Cache initial assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Stale-While-Revalidate for static assets, network-first for others
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass socket.io and API requests from cache
    if (url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/api/')) {
        return;
    }

    // Only cache GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});

// Notification Click: Focus existing window or open app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Push Event: Handle server push notifications (FCM / Web Push)
self.addEventListener('push', (event) => {
    let payload = {
        title: 'AuraChat',
        body: 'Bạn có tin nhắn mới!',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'aurachat-msg',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            const json = event.data.json();
            payload = { ...payload, ...json };
        } catch (e) {
            payload.body = event.data.text() || payload.body;
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/badge-72.png',
        tag: payload.tag || 'aurachat-notification',
        vibrate: [200, 100, 200],
        renotify: true,
        data: payload.data || { url: '/' }
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// Message Event: Allow web client to request notification through Service Worker
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        self.registration.showNotification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            vibrate: [200, 100, 200],
            ...options
        });
    }
});
