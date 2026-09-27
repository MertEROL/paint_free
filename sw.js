self.addEventListener('install', (e) => {
    e.waitUntil(
      caches.open('cizim-oyunu-store').then((cache) => cache.addAll([
        './',
        './index.html',
        './script.js',
        './style.css'
      ])),
    );
  });
  
  self.addEventListener('fetch', (e) => {
    e.respondWith(
      caches.match(e.request).then((response) => response || fetch(e.request)),
    );
  });
