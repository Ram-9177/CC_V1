(function () {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socketUrl = `${protocol}://${window.location.host}/ws/dashboard/`;

  const liveDot = document.getElementById('dashboard-live-status');

  function pulseLive() {
    if (!liveDot) return;
    liveDot.classList.add('animate-pulse');
    liveDot.classList.remove('text-gray-400');
    liveDot.classList.add('text-emerald-600');
  }

  function animateCount(el, newVal) {
    if (!el) return;
    let current = parseInt(el.textContent || '0', 10) || 0;
    const target = parseInt(newVal || 0, 10) || 0;
    const step = (target - current) / 20;
    const timer = setInterval(() => {
      current += step;
      const rounded = Math.round(current);
      el.textContent = String(rounded);
      if (rounded === target) {
        clearInterval(timer);
      }
    }, 30);
  }

  function updateRecentNotifications(items) {
    const list = document.getElementById('recent-notifications');
    if (!list) return;
    list.innerHTML = '';
    (items || []).forEach((item) => {
      const li = document.createElement('li');
      li.style.padding = '8px 10px';
      li.style.borderBottom = '1px solid #e5e7eb';
      li.innerHTML = `<strong>${item.title || ''}</strong><br><small>${item.notif_type || ''} • ${item.created_at || ''}</small>`;
      list.appendChild(li);
    });
  }

  function onMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (err) {
      return;
    }

    if (payload.type !== 'dashboard_update') return;

    animateCount(document.getElementById('active-gatepasses'), payload.active_gatepasses);
    animateCount(document.getElementById('students-outside'), payload.students_outside);
    animateCount(document.getElementById('pending-gatepasses'), payload.pending_gatepasses);
    animateCount(document.getElementById('pending-leaves'), payload.pending_leaves);
    animateCount(document.getElementById('active-visitors'), payload.active_visitors);
    animateCount(document.getElementById('sports-bookings-today'), payload.sports_bookings_today);

    updateRecentNotifications(payload.recent_notifications);
    pulseLive();
  }

  function connect() {
    const socket = new WebSocket(socketUrl);

    socket.onopen = pulseLive;
    socket.onmessage = onMessage;

    socket.onclose = () => {
      if (liveDot) {
        liveDot.classList.remove('text-emerald-600');
        liveDot.classList.add('text-gray-400');
        liveDot.classList.remove('animate-pulse');
      }
      setTimeout(connect, 2000);
    };
  }

  connect();
})();
