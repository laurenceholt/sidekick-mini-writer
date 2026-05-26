#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://sidekick-mini-writer.netlify.app";
const DEFAULT_WRITER = "Laurence";
const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = Number(process.env.AGENT_HARDENING_TIMEOUT_MS ?? 240_000);
const REQUEST_TIMEOUT_MS = Number(process.env.AGENT_HARDENING_REQUEST_TIMEOUT_MS ?? 45_000);
const NETWORK_RETRIES = Number(process.env.AGENT_HARDENING_NETWORK_RETRIES ?? 3);

const baseUrl = (process.env.MINI_WRITER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
const writer = process.env.MINI_WRITER_WRITER ?? DEFAULT_WRITER;

const prompts = [
  "Without changing the mini, suggest several real-world hooks for introducing this concept. Use a numbered list with examples.",
  "Without changing the mini, critique the current learning arc. What is strong and what might confuse a grade 6 learner?",
  "Without changing the mini, research online interesting ways teachers introduce truth-of-equation and list several numbered ideas with source labels or URLs if available.",
  "Without changing the mini, suggest concise concept-stamping lines that could appear after the first few steps. Use a numbered list.",
  "Without changing the mini, identify places where the vocabulary may be above grade level and suggest simpler alternatives.",
  "Without changing the mini, propose several cartoon or illustration ideas that would make the interactions clearer. Number the ideas.",
  "Without changing the mini, explain whether the hints give away too much. Give specific step references where helpful.",
  "Without changing the mini, suggest ways to make the final two steps feel more like synthesis rather than more practice.",
  "Without changing the mini, list possible misconceptions students may have and which step could address each one.",
  "Without changing the mini, suggest how a reviewer should evaluate this mini before marking it Done.",
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request(path, init) {
  let lastError;
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt += 1) {
    try {
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
        const detail = parsed?.error ?? body ?? `${response.status} ${response.statusText}`;
        throw new Error(detail);
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt >= NETWORK_RETRIES) break;
      await wait(1_000 * (attempt + 1));
    }
  }
  throw lastError;
}

function looksLikeErrorMessage(response) {
  return /i couldn't|inactivity timeout|load failed|failed to fetch|claude is still|request failed|unexpected error/i.test(response);
}

function leaksRawJson(response) {
  return /```json|"\s*updateMini\s*"|"\s*steps\s*"\s*:\s*\[|"\s*summary\s*"\s*:/i.test(response);
}

function normalizeSteps(steps) {
  return JSON.stringify(steps ?? []);
}

function validateAgentResult(result, originalMini) {
  if (!result || typeof result !== "object") throw new Error("Response was not JSON.");
  if (!result.mini || typeof result.mini.id !== "string") throw new Error("Missing mini object.");
  if (typeof result.response !== "string" || !result.response.trim()) throw new Error("Missing agent response text.");
  if (looksLikeErrorMessage(result.response)) throw new Error(`Agent returned an error message: ${result.response.slice(0, 180)}`);
  if (leaksRawJson(result.response)) throw new Error(`Agent leaked raw JSON: ${result.response.slice(0, 180)}`);
  if (result.mini.currentVersionId !== originalMini.currentVersionId) {
    throw new Error("Agent created a new mini version for a no-update prompt.");
  }
  if (normalizeSteps(result.mini.steps) !== normalizeSteps(originalMini.steps)) {
    throw new Error("Agent changed mini steps for a no-update prompt.");
  }
}

async function findTargetMini() {
  const kcs = await request(`/api/kcs?writer=${encodeURIComponent(writer)}`);
  if (!Array.isArray(kcs) || kcs.length === 0) throw new Error(`No KCs found for writer ${writer}.`);

  for (const kc of kcs) {
    const minis = await request(`/api/minis?kcId=${encodeURIComponent(kc.id)}`);
    if (Array.isArray(minis) && minis.length > 0) {
      return { kc, mini: minis[0] };
    }
  }
  throw new Error(`No minis found for writer ${writer}.`);
}

async function pollRevision(miniId, id) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    await wait(POLL_INTERVAL_MS);
    const status = await request(`/api/minis/${miniId}/revise-status?requestId=${encodeURIComponent(id)}`);
    if (!status?.pending) return status;
  }
  throw new Error(`Timed out after ${Math.round(TIMEOUT_MS / 1000)} seconds.`);
}

async function runPrompt(originalMini, prompt, index) {
  const id = requestId();
  const started = await request(`/api/minis/${originalMini.id}/revise`, {
    method: "POST",
    body: JSON.stringify({ requestId: id, prompt, history: [] }),
  });
  const result = started?.pending ? await pollRevision(originalMini.id, started.requestId) : started;
  validateAgentResult(result, originalMini);
  return {
    index,
    prompt,
    responsePreview: result.response.replace(/\s+/g, " ").trim().slice(0, 180),
  };
}

const { kc, mini } = await findTargetMini();
console.log(`Agent hardening target: ${kc.grade}-${kc.topic}-${kc.kcNumber} · ${kc.title} · Mini ${mini.miniIndex}`);
console.log(`Endpoint: ${baseUrl}`);

const results = [];
for (const [index, prompt] of prompts.entries()) {
  const label = `${index + 1}/${prompts.length}`;
  process.stdout.write(`Running ${label}... `);
  try {
    const result = await runPrompt(mini, prompt, index + 1);
    results.push({ ...result, passed: true });
    console.log("PASS");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ index: index + 1, prompt, passed: false, error: message });
    console.log("FAIL");
    console.error(message);
  }
}

const passed = results.filter((result) => result.passed).length;
console.log(`\nResult: ${passed}/${prompts.length} passed`);
for (const result of results) {
  if (result.passed) {
    console.log(`PASS ${result.index}: ${result.responsePreview}`);
  } else {
    console.log(`FAIL ${result.index}: ${result.error}`);
  }
}

if (passed !== prompts.length) {
  process.exitCode = 1;
}
