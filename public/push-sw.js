// Push notification handler for SplitEasy PWA

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title ?? "SplitEasy", {
      body: data.body ?? "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      vibrate: [100, 50, 100],
      data: { url: data.url ?? "/" },
      actions: data.actions ?? [],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(url);
        } else {
          clients.openWindow(url);
        }
      })
  );
});
