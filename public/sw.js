// Voyce for Paws — service worker for browser push notifications.
self.addEventListener("push", function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: "Voyce for Paws", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Voyce for Paws";
  const options = {
    body: data.body || "",
    icon: "/apple-touch-icon.png",
    badge: "/apple-touch-icon.png",
    // requireInteraction keeps the banner up until tapped on Android/desktop.
    // (iOS ignores it and auto-hides the banner, but the alert still lands in
    // the iPhone Notification Center with the timestamp below.)
    requireInteraction: true,
    // Stamp each alert with when it was sent so the OS shows the time/day.
    timestamp: data.ts || Date.now(),
    // Tag per dog so a newer update replaces the old one instead of stacking
    // ambiguously; renotify re-alerts when the status actually changes.
    tag: data.tag || "voyce-alert",
    renotify: true,
    data: { url: data.url || "https://app.voyceforpaws.org" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "https://app.voyceforpaws.org";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const c of list) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
