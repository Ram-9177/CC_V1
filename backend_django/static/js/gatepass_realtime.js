(function () {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socketUrl = `${protocol}://${window.location.host}/ws/gatepass/`;

  let socket = null;
  let retryDelay = 1000;

  const pendingTable = document.getElementById('gatepass-table');
  const pendingCount = document.getElementById('pending-count');
  const approvedList = document.getElementById('approved-passes');
  const connBadge = document.getElementById('gatepass-live-status');

  function setConnectionStatus(isLive) {
    if (!connBadge) return;
    connBadge.textContent = isLive ? 'Live' : 'Reconnecting...';
    connBadge.classList.toggle('text-emerald-600', isLive);
    connBadge.classList.toggle('text-gray-400', !isLive);
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (err) {
      // Audio is optional; ignore failures.
    }
  }

  function flashRow(row) {
    row.style.transition = 'background-color 400ms ease';
    row.style.backgroundColor = '#fef9c3';
    setTimeout(() => {
      row.style.backgroundColor = '';
    }, 1600);
  }

  function showToast(text) {
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.position = 'fixed';
    toast.style.right = '16px';
    toast.style.bottom = '16px';
    toast.style.zIndex = '9999';
    toast.style.padding = '10px 14px';
    toast.style.borderRadius = '10px';
    toast.style.background = '#111827';
    toast.style.color = '#fff';
    toast.style.fontSize = '13px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.22)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  }

  function updatePendingCount(delta) {
    if (!pendingCount) return;
    const current = parseInt(pendingCount.textContent || '0', 10) || 0;
    pendingCount.textContent = Math.max(0, current + delta);
  }

  function newRowHtml(data) {
    return `
      <tr data-gatepass-id="${data.gatepass_id}">
        <td>${data.student_name || '-'}</td>
        <td>${data.student_room || '-'}</td>
        <td>${data.pass_type || '-'}</td>
        <td>${data.reason || '-'}</td>
        <td>${data.scheduled_exit || '-'}</td>
        <td><span class="badge badge-warning">Pending</span></td>
        <td>
          <button class="approve-btn" data-gatepass-id="${data.gatepass_id}">Approve</button>
          <button class="reject-btn" data-gatepass-id="${data.gatepass_id}">Reject</button>
        </td>
      </tr>
    `;
  }

  function statusBadge(status) {
    if (status === 'approved') {
      return '<span class="badge" style="background:#dcfce7;color:#166534;">Approved</span>';
    }
    if (status === 'rejected') {
      return '<span class="badge" style="background:#fee2e2;color:#991b1b;">Rejected</span>';
    }
    return `<span class="badge">${status}</span>`;
  }

  function handleNewRequest(data) {
    if (!pendingTable) return;
    const tbody = pendingTable.tBodies && pendingTable.tBodies.length ? pendingTable.tBodies[0] : pendingTable;
    const wrapper = document.createElement('tbody');
    wrapper.innerHTML = newRowHtml(data);
    const row = wrapper.firstElementChild;
    if (!row) return;
    if (tbody.firstChild) {
      tbody.insertBefore(row, tbody.firstChild);
    } else {
      tbody.appendChild(row);
    }
    flashRow(row);
    updatePendingCount(1);
    beep();
  }

  function handleStatusUpdate(data) {
    const row = document.querySelector(`[data-gatepass-id="${data.gatepass_id}"]`);
    if (!row) return;

    const statusCell = row.children[5] || row.querySelector('.status-cell');
    if (statusCell) {
      statusCell.innerHTML = statusBadge(data.status);
    }

    const approver = data.approved_by || 'staff';
    showToast(`Gate pass ${data.status} by ${approver}`);
  }

  function handleApprovedPass(data) {
    if (!approvedList) return;
    const item = document.createElement('li');
    item.style.padding = '8px 10px';
    item.style.borderBottom = '1px solid #e5e7eb';
    item.textContent = `${data.student_name || 'Student'} • valid until ${data.valid_until || '-'}`;
    approvedList.insertBefore(item, approvedList.firstChild);
  }

  function onMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (err) {
      return;
    }

    if (payload.type === 'new_request') handleNewRequest(payload);
    if (payload.type === 'status_update') handleStatusUpdate(payload);
    if (payload.type === 'approved_pass') handleApprovedPass(payload);
  }

  function connectWS() {
    socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      retryDelay = 1000;
      setConnectionStatus(true);
    };

    socket.onmessage = onMessage;

    socket.onclose = () => {
      setConnectionStatus(false);
      setTimeout(connectWS, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };

    socket.onerror = () => {
      setConnectionStatus(false);
    };
  }

  connectWS();
})();
