#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://sidekick-mini-writer.netlify.app";
const DEFAULT_WRITER = "Laurence";
const REQUEST_TIMEOUT_MS = Number(process.env.MINI_EVAL_REQUEST_TIMEOUT_MS ?? 180_000);
const POLL_INTERVAL_MS = Number(process.env.MINI_EVAL_POLL_INTERVAL_MS ?? 2_000);
const TIMEOUT_MS = Number(process.env.MINI_EVAL_TIMEOUT_MS ?? 300_000);

const baseUrl = (process.env.MINI_WRITER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
const writer = process.env.MINI_WRITER_WRITER ?? DEFAULT_WRITER;
const limit = Number(process.env.MINI_EVAL_LIMIT ?? 3);

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.text();
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    throw new Error(parsed?.error ?? body ?? `${response.status} ${response.statusText}`);
  }
  return parsed;
}

async function findMinis() {
  const kcs = await request(`/api/kcs?writer=${encodeURIComponent(writer)}`);
  if (!Array.isArray(kcs)) throw new Error("KCs response was not an array.");
  const found = [];
  for (const kc of kcs) {
    const minis = await request(`/api/minis?kcId=${encodeURIComponent(kc.id)}`);
    for (const mini of minis ?? []) {
      found.push({ kc, mini });
      if (found.length >= limit) return found;
    }
  }
  return found;
}

function requestId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollEval(miniId, id) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    await wait(POLL_INTERVAL_MS);
    const status = await request(`/api/minis/${miniId}/eval-status?requestId=${encodeURIComponent(id)}`);
    if (status?.failed) throw new Error(status.error ?? "Mini eval failed.");
    if (!status?.pending) return status;
  }
  throw new Error(`Timed out after ${Math.round(TIMEOUT_MS / 1000)} seconds.`);
}

async function runEval(miniId) {
  const id = requestId();
  const started = await request(`/api/minis/${miniId}/eval`, {
    method: "POST",
    body: JSON.stringify({ requestId: id }),
  });
  if (started?.failed) throw new Error(started.error ?? "Mini eval failed.");
  return started?.pending ? pollEval(miniId, started.requestId) : started;
}

function printReport(index, kc, mini, report) {
  console.log(`\n# Eval ${index}: ${kc.grade}-${kc.topic}-${kc.kcNumber} ${kc.title} · Mini ${mini.miniIndex}`);
  console.log(`Mini title: ${mini.title}`);
  console.log(`Overall: ${report.overallRating}`);
  console.log(`Ready for review: ${report.readyForReview ? "yes" : "no"}`);
  console.log(`\n${report.summary}`);
  console.log("\n## Dimensions");
  for (const dimension of report.dimensions ?? []) {
    console.log(`- ${dimension.label}: ${dimension.rating}. ${dimension.evidence}`);
  }
  console.log("\n## Suggestions");
  for (const suggestion of report.suggestions ?? []) {
    const steps = suggestion.steps?.length ? ` (${suggestion.steps.join(", ")})` : "";
    console.log(`${suggestion.number}. [${suggestion.priority}] ${suggestion.title}${steps}`);
    console.log(`   Issue: ${suggestion.issue}`);
    console.log(`   Suggestion: ${suggestion.suggestion}`);
    console.log(`   Implementation prompt: ${suggestion.implementationPrompt}`);
  }
}

console.log(`Endpoint: ${baseUrl}`);
console.log(`Writer: ${writer}`);
console.log(`Limit: ${limit}`);

const targets = await findMinis();
if (targets.length < limit) {
  throw new Error(`Found only ${targets.length} minis for writer ${writer}.`);
}

for (const [index, { kc, mini }] of targets.entries()) {
  process.stderr.write(`Evaluating ${index + 1}/${targets.length}: ${kc.title} mini ${mini.miniIndex}... `);
  const startedAt = Date.now();
  const result = await runEval(mini.id);
  process.stderr.write(`${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`);
  printReport(index + 1, kc, mini, result.report);
}
