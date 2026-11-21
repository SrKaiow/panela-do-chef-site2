// Service worker da Panela do Chef: mostra o aviso do pedido mesmo com a página fechada ou a tela bloqueada.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    let msg = null;
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const r = await fetch("/api/push/mensagem?e=" + encodeURIComponent(sub ? sub.endpoint : ""), { cache: "no-store" });
      msg = await r.json();
    } catch (err) {}
    const titulo = (msg && msg.titulo) || "Panela do Chef";
    await self.registration.showNotification(titulo, {
      body: (msg && msg.corpo) || "Atualização do seu pedido.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "pedido",
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500, 200, 800],
      data: { url: (msg && msg.url) || "/" },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abas) if (c.url.includes(url) && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});
