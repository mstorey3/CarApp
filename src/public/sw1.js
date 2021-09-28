const cacheName = 'static-cache';

const staticAssets = [
  '/',
  '/css/styles.css',
  '/index.html',
  '/images/mylogo.png',
  '/js/script.js',
  '/fallback.json'
];

const cacheFirstRequests = staticAssets.map(function(val,index){
  return location.origin + val
})

const noCacheRequests = [(location.origin + '/ping')]


// starts the static cache on install of the service worker
self.addEventListener('install', async function () {
  console.log('Attempting to install service worker and cache static assets');
  const cache = await caches.open(cacheName);
  cache.addAll(staticAssets);
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// intercepts all fetch events
self.addEventListener('fetch', event => {
  const request = event.request;
  if (noCacheRequests.includes(request.url)){
    event.respondWith(networkOnly(request));
  }
  else if (cacheFirstRequests.includes(request.url)){
    event.respondWith(cacheFirst(request));
  }
  else {
    event.respondWith(networkFirst(request));
  }
});

// attempts to retrieve the request from the cache first
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  return cachedResponse || fetch(request);
}

// attempts to retrieve the request from the network first
async function networkFirst(request) {
  const dynamicCache = await caches.open('cache-dynamic');
  try {
    const networkResponse = await fetch(request);
    dynamicCache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    const cachedResponse = await dynamicCache.match(request);
    return cachedResponse || await caches.match('./fallback.json');
  }
}

// for use with the network pings - ensures that the responses are never cached, nor are the responses loaded from the cache
async function networkOnly(request){
  const networkResponse = await fetch(request);
  return networkResponse;
}