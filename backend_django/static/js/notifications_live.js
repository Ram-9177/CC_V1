(function () {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socketUrl = `${protocol}://${window.location.host}/ws/notifications/`;

  const badge = document.getElementById('notif-badge');
  const dropdown = document.getElementById('notif-dropdown');
  const bell = document.getElementById('notif-bell');

  function pulseBell() {
    if (!bell) return;
    bell.classList.add('animate-pulse');
    setTimeout(() => bell.classList.remove('animate-pulse'), 1200);
  }

  function updateBadge(count) {
    if (!badge) return;
    badge.textContent = String(count || 0);
  }

  function prependNotification(item) {
    if (!dropdown || !item.title) return;
    const row = document.createElement('li');
    row.style.padding = '8px 10px';
    row.style.borderBottom = '1px solid #e5e7eb';
    row.innerHTML = `<strong>${item.title}</strong><br><small>${item.message || ''}</small>`;
    dropdown.insertBefore(row, dropdown.firstChild);
  }

  function tryBrowserNotify(item) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted' && item.title) {
      new Notification(item.title, { body: item.message || '' });
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function onMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (err) {
      return;
    }

    if (payload.type !== 'notification') return;

    updateBadge(payload.unread_count);
    prependNotification(payload);
    pulseBell();
    tryBrowserNotify(payload);
  }

  function connect() {
    const socket = new WebSocket(socketUrl);
    socket.onmessage = onMessage;
    socket.onclose = () => setTimeout(connect, 2000);
  }

  connect();
})();
