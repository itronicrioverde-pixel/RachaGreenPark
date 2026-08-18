/* GREEN PARK FC - Firebase Messaging Service Worker */
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDnafgCpOkeNcWKT8XO3b7g6sloX51Aiwo',
  authDomain: 'racha-95fca.firebaseapp.com',
  projectId: 'racha-95fca',
  storageBucket: 'racha-95fca.firebasestorage.app',
  messagingSenderId: '499829913321',
  appId: '1:499829913321:web:67329174951c6d002c2278'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Mensagens com payload de notificação já são exibidas automaticamente
  // pelo Firebase no segundo plano. Evita notificação duplicada.
  if (payload.notification && (payload.notification.title || payload.notification.body)) {
    return;
  }

  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = data.title || notification.title || 'Green Park FC';
  const body = data.body || notification.body || 'Você recebeu uma nova notificação.';
  const url = data.url || './';

  self.registration.showNotification(title, {
    body,
    data: {url},
    tag: data.orderId ? 'greenpark-' + data.orderId : 'greenpark-fc',
    renotify: true,
    vibrate: [120, 80, 120]
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || './', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});
