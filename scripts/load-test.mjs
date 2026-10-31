#!/usr/bin/env node
/**
 * Read-only DEQANT load-test utility.
 * Uses built-in Node.js fetch; no packages, credentials, carts, messages or orders.
 * Run only against infrastructure you are authorized to test.
 */

const baseUrl = (process.env.LOAD_TEST_URL || "http://localhost:3000").replace(/\/$/, "");
const concurrency = positiveInteger(process.env.LOAD_TEST_CONCURRENCY, 10, "LOAD_TEST_CONCURRENCY");
const durationSeconds = positiveInteger(process.env.LOAD_TEST_DURATION, 15, "LOAD_TEST_DURATION");
const paths = (process.env.LOAD_TEST_PATHS || "/,/shop,/api/trpc/store.catalog,/product/rouge-amber,/sitemap.xml")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean)
  .map((path) => path.startsWith("/") ? path : `/${path}`);

if (new URL(baseUrl).protocol === "http:" && !["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname)) {
  console.warn("Warning: plain HTTP is intended only for an authorized local test environment.");
}

const latencies = [];
const statuses = new Map();
let completed = 0;
let transportErrors = 0;
let sequence = 0;
const startedAt = performance.now();
const stopAt = startedAt + durationSeconds * 1000;

function positiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

async function worker() {
  while (performance.now() < stopAt) {
    const path = paths[sequence++ % paths.length];
    const requestStarted = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Accept: "text/html,application/json,application/xml,text/plain,*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      await response.arrayBuffer();
      const elapsed = performance.now() - requestStarted;
      latencies.push(elapsed);
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
      completed += 1;
    } catch {
      transportErrors += 1;
      completed += 1;
    }
  }
}

console.log(JSON.stringify({
  mode: "read-only",
  baseUrl,
  concurrency,
  durationSeconds,
  paths,
  note: "Observed measurements only; this is not a capacity certification.",
}, null, 2));

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const elapsedSeconds = (performance.now() - startedAt) / 1000;
latencies.sort((a, b) => a - b);
const successful = [...statuses.entries()]
  .filter(([status]) => status >= 200 && status < 400)
  .reduce((sum, [, count]) => sum + count, 0);

function percentile(fraction) {
  if (!latencies.length) return null;
  const index = Math.min(latencies.length - 1, Math.ceil(latencies.length * fraction) - 1);
  return Math.round(latencies[index] * 10) / 10;
}

const result = {
  elapsedSeconds: Math.round(elapsedSeconds * 100) / 100,
  completed,
  successful,
  httpErrors: completed - successful - transportErrors,
  transportErrors,
  requestsPerSecond: Math.round((completed / elapsedSeconds) * 100) / 100,
  latencyMs: {
    min: latencies.length ? Math.round(latencies[0] * 10) / 10 : null,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: latencies.length ? Math.round(latencies.at(-1) * 10) / 10 : null,
  },
  statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => a - b)),
};

console.log(JSON.stringify(result, null, 2));
if (!successful) process.exitCode = 1;
