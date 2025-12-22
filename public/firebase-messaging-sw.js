self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}
  const title = data.notification?.title || 'Nova Licitação Encontrada! 🏛️'
  const body = data.notification?.body || 'Encontramos uma oportunidade baseada no seu perfil Premium.'
  event.waitUntil(self.registration.showNotification(title, { body }))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/'))
})
