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
    requireInteraction: true,
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
