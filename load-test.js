// Load test with k6
// Run: k6 run load-test.js --vus 100 --duration 2m

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://luxury-shield-crm.vercel.app';
const AGENT_ID = __ENV.AGENT_ID || 'test-agent-id';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const successRate = new Rate('success');
const requestCount = new Counter('requests');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up
    { duration: '1m30s', target: 50 }, // Sustained load
    { duration: '30s', target: 100 },  // Peak
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.1'],
    'errors': ['rate<0.05'],
  },
};

export default function () {
  // Test 1: Rate limit check
  group('Rate Limiting', function () {
    const rateCheckUrl = `${BASE_URL}/api/rate-check`;
    const payload = JSON.stringify({
      agentId: AGENT_ID,
      estimatedTokens: 1000,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      timeout: '10s',
    };

    const response = http.post(rateCheckUrl, payload, params);
    const isSuccess = response.status === 200;

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 50ms': (r) => r.timings.duration < 50,
      'body contains allowed': (r) => r.body.includes('allowed'),
    });

    apiLatency.add(response.timings.duration, { api: 'rate-check' });
    errorRate.add(!isSuccess);
    successRate.add(isSuccess);
    requestCount.add(1);

    sleep(0.1);
  });

  // Test 2: Leads API with pagination
  group('Leads API', function () {
    const leadsUrl = `${BASE_URL}/api/leads?agent_id=${AGENT_ID}&page=1&limit=100`;

    const params = {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      timeout: '10s',
    };

    const response = http.get(leadsUrl, params);
    const isSuccess = response.status === 200;

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
      'has pagination': (r) => r.body.includes('pagination'),
      'has leads array': (r) => r.body.includes('leads'),
    });

    apiLatency.add(response.timings.duration, { api: 'leads-get' });
    errorRate.add(!isSuccess);
    successRate.add(isSuccess);
    requestCount.add(1);

    sleep(0.5);
  });

  // Test 3: Create lead
  group('Create Lead', function () {
    const createLeadUrl = `${BASE_URL}/api/leads`;
    const leadPayload = JSON.stringify({
      name: `Test Lead ${Date.now()}`,
      phone: '+1234567890',
      email: 'test@example.com',
      state: 'TX',
      insurance_type: 'Dental',
      agent_id: AGENT_ID,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      timeout: '10s',
    };

    const response = http.post(createLeadUrl, leadPayload, params);
    const isSuccess = response.status === 200;

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
      'success in response': (r) => r.body.includes('success'),
    });

    apiLatency.add(response.timings.duration, { api: 'create-lead' });
    errorRate.add(!isSuccess);
    successRate.add(isSuccess);
    requestCount.add(1);

    sleep(1);
  });

  // Test 4: Business health check
  group('Business Health', function () {
    const healthUrl = `${BASE_URL}/api/business-health`;

    const params = {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      timeout: '10s',
    };

    const response = http.get(healthUrl, params);
    const isSuccess = response.status === 200;

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 100ms': (r) => r.timings.duration < 100,
      'has metrics': (r) => r.body.includes('metrics'),
    });

    apiLatency.add(response.timings.duration, { api: 'health' });
    errorRate.add(!isSuccess);
    successRate.add(isSuccess);
    requestCount.add(1);

    sleep(0.2);
  });

  // Random sleep between iterations
  sleep(__VU % 5);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

// Helper function for text summary
function textSummary(data, options = {}) {
  const { indent = '', enableColors = false } = options;

  const summary = `
========= LOAD TEST SUMMARY =========
Total Requests: ${data.metrics.requests.values.count}
Error Rate: ${((data.metrics.errors.values.rate || 0) * 100).toFixed(2)}%
Success Rate: ${((data.metrics.success.values.rate || 0) * 100).toFixed(2)}%

API Latency (p95): ${data.metrics.api_latency?.values?.p95?.toFixed(0) || 'N/A'}ms
API Latency (p99): ${data.metrics.api_latency?.values?.p99?.toFixed(0) || 'N/A'}ms

HTTP Requests Failed: ${data.metrics.http_req_failed?.values?.rate || 0}
HTTP Duration (p95): ${data.metrics.http_req_duration?.values?.p95?.toFixed(0) || 'N/A'}ms

=====================================
`;

  return summary;
}
