/* global firebase, clients */
// Firebase Cloud Messaging service worker — displays push notifications while
// the site is closed or in the background. The Firebase web config is passed
// as query parameters when the app registers this worker, so no keys are
// hard-coded here.
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// Messages are sent data-only from the server so this handler fully controls
// how the notification is displayed (avoids duplicate auto-notifications).
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "GT Grounds", {
    body: data.body || "",
    icon: "/gt-logo.png",
    badge: "/gt-logo.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/admin/dashboard" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ("focus" in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
