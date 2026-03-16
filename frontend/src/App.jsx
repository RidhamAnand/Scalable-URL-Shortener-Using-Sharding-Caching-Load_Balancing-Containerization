import { useState } from "react";
import {
  ArrowUpRight,
  Database,
  ExternalLink,
  Gauge,
  Link2,
  Rocket,
  Timer,
  WandSparkles
} from "lucide-react";
import { createShortUrl, getApiBaseUrl, redirectUrl, resolveShortUrl } from "./api";

function App() {
  const [longUrl, setLongUrl] = useState("");
  const [shortInput, setShortInput] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [error, setError] = useState("");

  const apiBaseUrl = getApiBaseUrl();
  const normalizedResultCode = result?.short_url ? extractShortCode(result.short_url, apiBaseUrl) : "";
  const fullShortUrl = normalizedResultCode ? redirectUrl(normalizedResultCode) : "-";
  const selectedCode = extractShortCode(shortInput, apiBaseUrl);
  const selectedSamples = history
    .filter((item) => item.code === selectedCode)
    .slice()
    .reverse();
  const firstLatency = selectedSamples[0]?.total_latency_ms ?? null;
  const secondLatency = selectedSamples[1]?.total_latency_ms ?? null;
  const latencyMax = Math.max(firstLatency || 0, secondLatency || 0, 1);

  async function onCreate(event) {
    event.preventDefault();
    setError("");
    setLoadingCreate(true);

    try {
      const payload = await createShortUrl(longUrl);
      const createdCode = extractShortCode(payload.short_url, apiBaseUrl);
      setShortInput(redirectUrl(createdCode));
      setResult((previous) => ({
        short_url: createdCode,
        long_url: previous?.long_url || longUrl,
        source: previous?.source || "new",
        redis_lookup_ms: previous?.redis_lookup_ms || null,
        db_lookup_ms: previous?.db_lookup_ms || null,
        total_latency_ms: previous?.total_latency_ms || null
      }));
    } catch (createError) {
      setError(createError.message);
    } finally {
      setLoadingCreate(false);
    }
  }

  async function onResolve(event) {
    event.preventDefault();
    setError("");
    setLoadingResolve(true);

    try {
      const code = extractShortCode(shortInput, apiBaseUrl);
      if (!code) {
        throw new Error("Paste a valid short URL to fetch the original link");
      }

      const payload = await resolveShortUrl(code);
      const resolvedCode = extractShortCode(payload.short_url, apiBaseUrl);
      setResult({
        ...payload,
        short_url: resolvedCode
      });
      setHistory((previous) => [
        {
          code: resolvedCode,
          short_url: redirectUrl(resolvedCode),
          source: payload.source,
          total_latency_ms: payload.total_latency_ms,
          timestamp: new Date().toLocaleTimeString()
        },
        ...previous
      ].slice(0, 8));
    } catch (resolveError) {
      setError(resolveError.message);
    } finally {
      setLoadingResolve(false);
    }
  }

  function openRedirect() {
    const code = extractShortCode(shortInput, apiBaseUrl);
    if (!code) {
      setError("Paste or generate a short URL first");
      return;
    }

    window.open(redirectUrl(code), "_blank", "noopener,noreferrer");
  }

  async function copyValue(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Clipboard unavailable in this browser context");
    }
  }

  return (
    <main className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <header className="mb-8 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-glow backdrop-blur-xl md:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-700">
              <WandSparkles size={14} />
              Welcome
            </p>
            <h1 className="title-font text-4xl leading-none text-slate-900 md:text-6xl">
              Your URL Assistant
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-600 md:text-base">
              Create short links, check lookup speed, and open redirects from one simple dashboard.
            </p>
            <p className="mt-2 text-xs uppercase tracking-wider text-slate-500">
              Connected to {apiBaseUrl}
            </p>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <form onSubmit={onCreate} className="panel">
            <div className="mb-5 flex items-center gap-2">
              <Rocket size={18} className="text-ember" />
              <h2 className="panel-title">Create a Short Link</h2>
            </div>

            <label className="text-sm text-slate-600">Long URL</label>
            <textarea
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-skyglass"
              placeholder="https://example.com/some/deep/path"
              value={longUrl}
              onChange={(event) => setLongUrl(event.target.value)}
              required
            />

            <button
              disabled={loadingCreate}
              className="btn-primary mt-5"
              type="submit"
            >
              {loadingCreate ? "Creating..." : "Shorten URL"}
            </button>
          </form>

          <form onSubmit={onResolve} className="panel">
            <div className="mb-5 flex items-center gap-2">
              <Gauge size={18} className="text-sky-300" />
              <h2 className="panel-title">Get Original URL</h2>
            </div>

            <label className="text-sm text-slate-600">Short URL</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-mint"
              placeholder="Paste full short URL (example: http://localhost/abc123)"
              value={shortInput}
              onChange={(event) => setShortInput(event.target.value)}
              required
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                disabled={loadingResolve}
                className="btn-primary"
                type="submit"
              >
                {loadingResolve ? "Finding..." : "Find Original URL"}
              </button>

              <button type="button" className="btn-secondary" onClick={openRedirect}>
                Open Redirect
                <ExternalLink size={14} />
              </button>
            </div>
          </form>
        </section>

        {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="panel-title">Result</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="icon-chip"
                  onClick={() => result?.short_url && copyValue(fullShortUrl)}
                  disabled={!result?.short_url}
                  title="Copy full short URL"
                >
                  <Link2 size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <Row icon={<ExternalLink size={14} />} label="Full Short URL" value={fullShortUrl} />
              <Row icon={<ArrowUpRight size={14} />} label="Long URL" value={result?.long_url || "-"} />
              <Row
                icon={<Database size={14} />}
                label="Data Source"
                value={result?.source ? result.source.toUpperCase() : "-"}
                badge={result?.source === "redis" ? "badge-cache" : "badge-db"}
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Metric label="Redis" value={result?.redis_lookup_ms} unit="ms" />
              <Metric label="DB" value={result?.db_lookup_ms} unit="ms" />
              <Metric label="Total" value={result?.total_latency_ms} unit="ms" />
            </div>

            <div className="mt-6">
              <a className="link" href={`${apiBaseUrl}/create/docs`} target="_blank" rel="noreferrer">Create API Docs</a>
              <a className="link ml-5" href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">Redirect API Docs</a>
            </div>
          </article>

          <article className="panel">
            <div className="mb-4 flex items-center gap-2">
              <Timer size={18} className="text-mint" />
              <h3 className="panel-title">Recent Lookups</h3>
            </div>

            <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">First vs Second Response Latency</p>
              <p className="mb-3 text-xs text-slate-500">Run resolve twice on the same short code to compare cache improvement.</p>

              <LatencyComparisonChart
                firstLatency={firstLatency}
                secondLatency={secondLatency}
                maxLatency={latencyMax}
              />
              {firstLatency !== null && secondLatency !== null ? (
                <p className="mt-3 text-xs text-slate-600">
                  Improvement: {formatMetric(firstLatency - secondLatency)} ms
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Resolve the same short URL twice to compare first vs second response.</p>
              )}
            </div>

            <ul className="space-y-3">
              {history.length === 0 && (
                <li className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  Resolve the same short code multiple times to visualize cache impact.
                </li>
              )}

              {history.map((item, index) => (
                <li key={`${item.timestamp}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                    <span>{item.timestamp}</span>
                    <span className={item.source === "redis" ? "badge-cache" : "badge-db"}>{item.source}</span>
                  </div>
                  <div className="mb-2 truncate text-sm text-slate-800">{item.short_url}</div>
                  <p className="mt-2 text-xs text-slate-600">Total: {formatMetric(item.total_latency_ms)} ms</p>
                </li>
              ))}
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}

function Row({ icon, label, value, badge = "" }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-slate-600">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <span className={`max-w-[65%] truncate text-right text-sm text-slate-900 ${badge}`}>{value}</span>
    </div>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className="mb-1 text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{formatMetric(value)} <span className="text-sm text-slate-500">{unit}</span></p>
    </div>
  );
}

function LatencyComparisonChart({ firstLatency, secondLatency, maxLatency }) {
  const hasFirst = firstLatency !== null && firstLatency !== undefined;
  const hasSecond = secondLatency !== null && secondLatency !== undefined;
  const firstValue = hasFirst ? firstLatency : 0;
  const secondValue = hasSecond ? secondLatency : 0;
  const chartHeight = 120;
  const firstHeight = hasFirst ? Math.max(8, (firstValue / maxLatency) * chartHeight) : 8;
  const secondHeight = hasSecond ? Math.max(8, (secondValue / maxLatency) * chartHeight) : 8;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <svg viewBox="0 0 220 170" className="h-40 w-full" role="img" aria-label="Latency comparison chart">
        <line x1="30" y1="12" x2="30" y2="132" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="30" y1="132" x2="205" y2="132" stroke="#cbd5e1" strokeWidth="1.5" />

        <rect x="65" y={132 - firstHeight} width="38" height={firstHeight} rx="7" fill={hasFirst ? "#38bdf8" : "#cbd5e1"} />
        <rect x="130" y={132 - secondHeight} width="38" height={secondHeight} rx="7" fill={hasSecond ? "#34d399" : "#cbd5e1"} />

        <text x="84" y="148" textAnchor="middle" fontSize="10" fill="#475569">First</text>
        <text x="149" y="148" textAnchor="middle" fontSize="10" fill="#475569">Second</text>

        <text x="84" y={122 - firstHeight} textAnchor="middle" fontSize="9" fill="#0f172a">
          {hasFirst ? `${formatMetric(firstValue)} ms` : "-"}
        </text>
        <text x="149" y={122 - secondHeight} textAnchor="middle" fontSize="9" fill="#0f172a">
          {hasSecond ? `${formatMetric(secondValue)} ms` : "-"}
        </text>
      </svg>

      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" />
          First response
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          Second response
        </span>
      </div>
    </div>
  );
}

function formatMetric(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return Number(value).toFixed(3);
}

function extractShortCode(value, baseUrl) {
  const input = (value || "").trim();
  if (!input) {
    return "";
  }

  try {
    const base = new URL(baseUrl);
    const parsed = new URL(input, `${base.protocol}//${base.host}`);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  } catch {
    const sanitized = input.replace(/^\/+/, "");
    const parts = sanitized.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
}

export default App;
