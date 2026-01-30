const API_BASE = 'http://127.0.0.1:8000/api';

function hcSetStatus(text, ok) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'status ' + (ok ? 'ok' : 'bad');
}

function hcAuthHeader() {
  const token = localStorage.getItem('hc_access');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function hcFetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function hcPing() {
  try {
    const res = await hcFetchWithTimeout(`${API_BASE}/health/`, {}, 4000);
    if (!res.ok) throw new Error('Bad response');
    hcSetStatus('Online', true);
    return true;
  } catch (e) {
    hcSetStatus('Offline', false);
    return false;
  }
}

async function hcRefresh() {
  await hcPing();
}

async function hcLoadHealth() {
  const target = document.getElementById('health-status');
  if (!target) return;
  try {
    const res = await hcFetchWithTimeout(`${API_BASE}/health/`, {}, 5000);
    const data = await res.json();
    target.textContent = JSON.stringify(data);
  } catch (e) {
    target.textContent = 'Offline or API unreachable.';
  }
}

async function hcLogin() {
  const username = document.getElementById('login-username')?.value || '';
  const password = document.getElementById('login-password')?.value || '';
  try {
    const res = await hcFetchWithTimeout(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }, 8000);
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    localStorage.setItem('hc_access', data.tokens.access);
    localStorage.setItem('hc_refresh', data.tokens.refresh);
    alert('Login successful');
  } catch (e) {
    alert('Login failed. Check credentials.');
  }
}

async function hcRegister() {
  const username = document.getElementById('reg-username')?.value || '';
  const email = document.getElementById('reg-email')?.value || '';
  const password = document.getElementById('reg-password')?.value || '';
  const registration_number = document.getElementById('reg-number')?.value || '';
  try {
    const res = await hcFetchWithTimeout(`${API_BASE}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, registration_number }),
    }, 8000);
    if (!res.ok) throw new Error('Register failed');
    alert('Registration successful');
  } catch (e) {
    alert('Registration failed.');
  }
}

async function hcLoadList(resource) {
  const el = document.getElementById(`${resource}-output`);
  if (!el) return;
  const cacheKey = `hc_cache_${resource}`;
  try {
    const res = await hcFetchWithTimeout(`${API_BASE}/${resource}/`, {
      headers: { 'Content-Type': 'application/json', ...hcAuthHeader() },
    }, 8000);
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    el.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      el.textContent = cached;
    } else {
      el.textContent = 'Offline or unauthorized. Login required.';
    }
  }
}

async function hcLoadProfile() {
  const el = document.getElementById('profile-output');
  if (!el) return;
  const cacheKey = 'hc_cache_profile';
  try {
    const res = await hcFetchWithTimeout(`${API_BASE}/auth/users/me/`, {
      headers: { 'Content-Type': 'application/json', ...hcAuthHeader() },
    }, 8000);
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    el.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      el.textContent = cached;
    } else {
      el.textContent = 'Offline or unauthorized.';
    }
  }
}

window.addEventListener('online', () => hcSetStatus('Online', true));
window.addEventListener('offline', () => hcSetStatus('Offline', false));

hcPing();
