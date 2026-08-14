/* Green Park FC - Firebase Messaging Service Worker */
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDnafgCpOkeNcWKT8XO3b7g6sloX51Aiwo",
  authDomain: "racha-95fca.firebaseapp.com",
  projectId: "racha-95fca",
  storageBucket: "racha-95fca.firebasestorage.app",
  messagingSenderId: "499829913321",
  appId: "1:499829913321:web:67329174951c6d002c2278"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload.notification?.title ||
    payload.data?.title ||
    'Green Park FC';

  const options = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      'Você recebeu uma nova notificação.',
    data: {
      url: payload.data?.url || './'
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = event.notification?.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for(const client of windowClients){
        if('focus' in client){
          client.navigate(target);
          return client.focus();
        }
      }

      if(clients.openWindow){
        return clients.openWindow(target);
      }
    })
  );
});
