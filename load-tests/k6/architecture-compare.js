import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASELINE_URL = __ENV.BASELINE_URL || 'http://baseline';
const CANDIDATE_URL = __ENV.CANDIDATE_URL || 'http://candidate';
const SEED_URL = __ENV.SEED_URL || 'https://example.com';

const GOAL_LABEL = __ENV.GOAL_LABEL || 'latency-improvement-goal';
const METHOD_LABEL = __ENV.METHOD_LABEL || 'new-architecture-y';

const TEST_VUS = Number(__ENV.TEST_VUS || '50');
const TEST_DURATION = __ENV.TEST_DURATION || '60s';
const MIN_IMPROVEMENT_PCT = Number(__ENV.MIN_IMPROVEMENT_PCT || '20');

const baselineRedirectLatency = new Trend('baseline_redirect_latency_ms', true);
const candidateRedirectLatency = new Trend('candidate_redirect_latency_ms', true);

export const options = {
	discardResponseBodies: true,
	scenarios: {
		compare_architecture: {
			executor: 'constant-vus',
			vus: TEST_VUS,
			duration: TEST_DURATION,
		},
	},
};

function createShortUrl(baseUrl, suffix) {
	const payload = JSON.stringify({
		long_url: `${SEED_URL}/${suffix}/vu-${__VU}/iter-${__ITER}-${Date.now()}`,
	});

	const res = http.post(`${baseUrl}/create/`, payload, {
		headers: { 'Content-Type': 'application/json' },
		responseType: 'text',
	});

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

	if (!ok) return null;

	try {
		return JSON.parse(res.body).short_url;
	} catch (_e) {
		return null;
	}
}

function redirect(baseUrl, shortUrl, latencyTrend) {
	const res = http.get(`${baseUrl}/${shortUrl}`, {
		redirects: 0,
	});

	latencyTrend.add(res.timings.duration);

	check(res, {
		'redirect status is 301': (r) => r.status === 301,
	});
}

export default function () {
	const baselineShort = createShortUrl(BASELINE_URL, 'baseline');
	if (baselineShort) {
		redirect(BASELINE_URL, baselineShort, baselineRedirectLatency);
	}

	const candidateShort = createShortUrl(CANDIDATE_URL, 'candidate');
	if (candidateShort) {
		redirect(CANDIDATE_URL, candidateShort, candidateRedirectLatency);
	}

	sleep(0.1);
}

function metricValue(summary, metricName, statName) {
	const metric = summary.metrics[metricName];
	if (!metric || !metric.values) {
		return null;
	}

	const value = metric.values[statName];
	return typeof value === 'number' ? value : null;
}

export function handleSummary(summary) {
	const baselineP95 = metricValue(summary, 'baseline_redirect_latency_ms', 'p(95)');
	const candidateP95 = metricValue(summary, 'candidate_redirect_latency_ms', 'p(95)');

	let improvementPct = null;
	if (baselineP95 && candidateP95 && baselineP95 > 0) {
		improvementPct = ((baselineP95 - candidateP95) / baselineP95) * 100;
	}

	const achieved =
		typeof improvementPct === 'number' && improvementPct >= MIN_IMPROVEMENT_PCT;

	const verdict = achieved
		? `ACHIEVED: ${GOAL_LABEL} using ${METHOD_LABEL}`
		: `NOT ACHIEVED: ${GOAL_LABEL} using ${METHOD_LABEL}`;

	const baselineP95Text = baselineP95 === null ? 'n/a' : baselineP95.toFixed(2);
	const candidateP95Text = candidateP95 === null ? 'n/a' : candidateP95.toFixed(2);
	const improvementText =
		improvementPct === null ? 'n/a' : `${improvementPct.toFixed(2)}%`;

	const lines = [
		'========================================',
		'ARCHITECTURE COMPARISON RESULT',
		verdict,
		`Baseline=${BASELINE_URL}`,
		`Candidate=${CANDIDATE_URL}`,
		`VUS=${TEST_VUS}, DURATION=${TEST_DURATION}`,
		`Target: candidate p95 is at least ${MIN_IMPROVEMENT_PCT}% better than baseline p95`,
		`Actual: baseline_p95=${baselineP95Text}ms, candidate_p95=${candidateP95Text}ms, improvement=${improvementText}`,
		'========================================',
	];

	return {
		stdout: `${lines.join('\n')}\n`,
	};
}
