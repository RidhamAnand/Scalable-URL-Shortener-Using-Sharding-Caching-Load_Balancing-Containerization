# Goal-Oriented Load Tests (k6)

These tests are written to answer:

- "Did I achieve **X** using **Y**?"

Set:

- `GOAL_LABEL` = what you want to achieve (X)
- `METHOD_LABEL` = the approach/architecture you used (Y)

Every test prints one clear final line:

- `ACHIEVED: <GOAL_LABEL> using <METHOD_LABEL>`
- or `NOT ACHIEVED: <GOAL_LABEL> using <METHOD_LABEL>`

## 1) End-to-end objective test

File: `stress.js`

Validates create + resolve + redirect under fixed load.

### Example

```powershell
docker run --rm -i --network urlshortener_default -v "${PWD}:/work" -w /work grafana/k6 run stress.js `
  -e BASE_URL=http://load_balancer `
  -e SEED_URL=https://example.com `
  -e GOAL_LABEL="p95 below 500ms with <2% failure" `
  -e METHOD_LABEL="redis cache + 2 app replicas" `
  -e TEST_VUS=100 `
  -e TEST_DURATION=2m `
  -e MAX_FAIL_RATE=0.02 `
  -e MAX_P95_MS=500
```

## 2) Redirect-focused objective test

File: `redirect-stress.js`

Validates redirect performance specifically.

### Example

```powershell
docker run --rm -i --network urlshortener_default -v "${PWD}:/work" -w /work grafana/k6 run redirect-stress.js `
  -e BASE_URL=http://load_balancer `
  -e SEED_URL=https://example.com `
  -e GOAL_LABEL="redirect p95 below 300ms" `
  -e METHOD_LABEL="in-memory hot key cache" `
  -e TEST_VUS=200 `
  -e TEST_DURATION=90s `
  -e MAX_FAIL_RATE=0.01 `
  -e MAX_REDIRECT_P95_MS=300
```

## 3) Baseline vs candidate comparison

File: `architecture-compare.js`

Compares two deployments/services and checks if candidate improves p95 by target %.

### Example

```powershell
docker run --rm -i --network urlshortener_default -v "${PWD}:/work" -w /work grafana/k6 run architecture-compare.js `
  -e BASELINE_URL=http://baseline_service `
  -e CANDIDATE_URL=http://load_balancer `
  -e SEED_URL=https://example.com `
  -e GOAL_LABEL="at least 20% p95 improvement" `
  -e METHOD_LABEL="new routing + redis" `
  -e TEST_VUS=50 `
  -e TEST_DURATION=60s `
  -e MIN_IMPROVEMENT_PCT=20
```

## Notes

- Keep labels human-readable. They are printed in final verdict.
- Tune thresholds to match your SLO/SLA.
- If a threshold fails, verdict becomes `NOT ACHIEVED`.
