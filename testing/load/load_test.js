import http from 'k6/http';
import { check, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:8000/api';

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const res = http.get(`${API_URL}/health/`, {
    tags: { name: 'health-check' },
    timeout: '10s',
  });

  check(res, {
    'health endpoint returns 200': (r) => r.status === 200,
  });

  sleep(1);
}
