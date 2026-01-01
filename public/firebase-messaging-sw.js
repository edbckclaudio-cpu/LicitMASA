self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}
  const n = data.notification || {}
  const title = n.title || 'Nova Licitação Encontrada! 🏛️'
  const body = n.body || 'Encontramos uma oportunidade baseada no seu perfil Premium.'
  const icon = n.icon || '/icons/icone_L_192.png'
  const image = n.image || '/icons/icone_L_512.png'
  const badge = n.badge || '/icons/icone_L_192.png'
  const vibrate = n.vibrate || [200, 100, 200, 100, 200]
  const tag = n.tag || 'licitmasa-alert'
  const url = (data.data && data.data.url) || n.click_action || '/'
  const actions = n.actions || [
    { action: 'abrir', title: 'Abrir', icon: '/icons/icone_L_192.png' },
  ]
  const requireInteraction = n.requireInteraction !== false
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      image,
      badge,
      vibrate,
      tag,
      actions,
      requireInteraction,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const target = (event.notification && event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.openWindow(target))
})
