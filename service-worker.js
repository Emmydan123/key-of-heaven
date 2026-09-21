const CACHE_NAME = "key-of-heaven-v2";

const FILES_TO_CACHE = [
    "/",
    "/index.html",
    "/css/style.css",
    "/js/main.js",
    "/manifest.json",

    "/pages/about.html",
    "/pages/prayer-room.html",
    "/pages/prayer-request.html",
    "/pages/past-prayers.html",
    "/pages/teachings.html",
    "/pages/events.html",
    "/pages/members.html",
    "/pages/contact.html",
    "/pages/login.html",
    "/pages/signup.html",
    "/dashboard.html",
    "/admin.html",
    "/images/avatar-sun.svg",
    "/images/avatar-leaf.svg",
    "/images/avatar-wave.svg",
    "/images/avatar-star.svg"
];

/* INSTALL */
self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(FILES_TO_CACHE);
            })
    );

    self.skipWaiting();
});

/* ACTIVATE */
self.addEventListener("activate", event => {

    event.waitUntil(
        caches.keys().then(cacheNames => {

            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );

        })
    );

    self.clients.claim();
});

/* FETCH */
self.addEventListener("fetch", event => {

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request);

            })
    );

});

