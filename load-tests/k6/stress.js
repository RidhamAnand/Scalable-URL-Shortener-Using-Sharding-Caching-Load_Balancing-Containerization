import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const SEED_URL = __ENV.SEED_URL || 'https://example.com';

const GOAL_LABEL = __ENV.GOAL_LABEL || 'goal-x';
const METHOD_LABEL = __ENV.METHOD_LABEL || 'method-y';

const TEST_DURATION = __ENV.TEST_DURATION || '2m';
const TEST_VUS = Number(__ENV.TEST_VUS || '100');

const MAX_FAIL_RATE = Number(__ENV.MAX_FAIL_RATE || '0.02');
const MAX_P95_MS = Number(__ENV.MAX_P95_MS || '500');

const createErrorRate = new Rate('create_error_rate');
const resolveErrorRate = new Rate('resolve_error_rate');
const redirectErrorRate = new Rate('redirect_error_rate');

const createdUrls = new Counter('created_urls_total');
const resolvedUrls = new Counter('resolved_urls_total');
const redirectedUrls = new Counter('redirected_urls_total');

const createLatency = new Trend('create_latency_ms', true);
const resolveLatency = new Trend('resolve_latency_ms', true);
const redirectLatency = new Trend('redirect_latency_ms', true);

export const options = {
  discardResponseBodies: true,
  scenarios: {
    objective_validation: {
      executor: 'constant-vus',
      vus: TEST_VUS,
      duration: TEST_DURATION,
    },
  },
  thresholds: {
    http_req_failed: [`rate<${MAX_FAIL_RATE}`],
    http_req_duration: [`p(95)<${MAX_P95_MS}`],
    create_error_rate: [`rate<${MAX_FAIL_RATE}`],
    resolve_error_rate: [`rate<${MAX_FAIL_RATE}`],
    redirect_error_rate: [`rate<${MAX_FAIL_RATE}`],
    create_latency_ms: [`p(95)<${MAX_P95_MS}`],
    resolve_latency_ms: [`p(95)<${MAX_P95_MS}`],
    redirect_latency_ms: [`p(95)<${MAX_P95_MS}`],
  },
};

function createShortUrl() {
  const payload = JSON.stringify({
    long_url: `${SEED_URL}/vu-${__VU}/iter-${__ITER}-${Date.now()}`,
  });

  const res = http.post(`${BASE_URL}/create/`, payload, {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text',
    tags: { endpoint: 'create' },
  });

  createLatency.add(res.timings.duration);

  const ok = check(res, {
    'create status is 201': (r) => r.status === 201,
    'create body has short_url': (r) => {
      if (!r.body) return false;
      try {
        const data = JSON.parse(r.body);
        return typeof data.short_url === 'string' && data.short_url.length > 0;
      } catch (_e) {
        return false;
      }
    },
  });

  createErrorRate.add(!ok);
  if (!ok) return null;

  createdUrls.add(1);

  try {
    return JSON.parse(res.body).short_url;
  } catch (_e) {
    return null;
  }
}

function resolveShortUrl(shortUrl) {
  const res = http.get(`${BASE_URL}/resolve/${shortUrl}`, {
    tags: { endpoint: 'resolve' },
  });

  resolveLatency.add(res.timings.duration);

  const ok = check(res, {
    'resolve status is 200': (r) => r.status === 200,
  });

  resolveErrorRate.add(!ok);
  if (ok) resolvedUrls.add(1);
}

function redirectShortUrl(shortUrl) {
  const res = http.get(`${BASE_URL}/${shortUrl}`, {
    redirects: 0,
    tags: { endpoint: 'redirect' },
  });

  redirectLatency.add(res.timings.duration);

  const ok = check(res, {
    'redirect status is 301': (r) => r.status === 301,
    'redirect location header exists': (r) => !!r.headers.Location,
  });

  redirectErrorRate.add(!ok);
  if (ok) redirectedUrls.add(1);
}

export default function () {
  const shortUrl = createShortUrl();

  if (shortUrl) {
    resolveShortUrl(shortUrl);
    resolveShortUrl(shortUrl);
    redirectShortUrl(shortUrl);
  }

  sleep(0.1);
}

function thresholdStatus(summary, metricName) {
  const metric = summary.metrics[metricName];
  if (!metric || !metric.thresholds) {
    return false;
  }

  return Object.values(metric.thresholds).every((t) => t.ok === true);
}

function metricValue(summary, metricName, statName) {
  const metric = summary.metrics[metricName];
  if (!metric || !metric.values) {
    return 'n/a';
  }

  const value = metric.values[statName];
  if (typeof value !== 'number') {
    return 'n/a';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function handleSummary(summary) {
  const passed = summary.root_group.checks && summary.root_group.checks.fails === 0;
  const thresholdsPassed =
    thresholdStatus(summary, 'http_req_failed') &&
    thresholdStatus(summary, 'http_req_duration') &&
    thresholdStatus(summary, 'create_error_rate') &&
    thresholdStatus(summary, 'resolve_error_rate') &&
    thresholdStatus(summary, 'redirect_error_rate') &&
    thresholdStatus(summary, 'create_latency_ms') &&
    thresholdStatus(summary, 'resolve_latency_ms') &&
    thresholdStatus(summary, 'redirect_latency_ms');

  const achieved = passed && thresholdsPassed;
  const verdict = achieved
    ? `ACHIEVED: ${GOAL_LABEL} using ${METHOD_LABEL}`
    : `NOT ACHIEVED: ${GOAL_LABEL} using ${METHOD_LABEL}`;

  const lines = [
    '========================================',
    'OBJECTIVE TEST RESULT',
    verdict,
    `BASE_URL=${BASE_URL}`,
    `VUS=${TEST_VUS}, DURATION=${TEST_DURATION}`,
    `Target: fail_rate<${MAX_FAIL_RATE}, p95<${MAX_P95_MS}ms`,
    `Actual: fail_rate=${metricValue(summary, 'http_req_failed', 'rate')}, p95=${metricValue(summary, 'http_req_duration', 'p(95)')}ms`,
    `Created=${metricValue(summary, 'created_urls_total', 'count')}, Resolved=${metricValue(summary, 'resolved_urls_total', 'count')}, Redirected=${metricValue(summary, 'redirected_urls_total', 'count')}`,
    '========================================',
  ];

  return {
    stdout: `${lines.join('\n')}\n`,
  };
}
