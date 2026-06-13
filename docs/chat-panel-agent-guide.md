# Mini Writer Chat Panel Agent Guide

Use this guide when asking another coding agent to recreate the `mini-writer` chat panel: a right-side revision agent for editing or discussing one selected mini lesson.

## What To Send The Agent

Send the agent these files or equivalent context:

- `src/components/AgentPanel.tsx` for the chat UI shape.
- `src/App.tsx` sections for `messages`, `agentBusyLabel`, `appendKcMessage`, `handleAgentSend`, `handleProcessNotes`, and `replaceMini`.
- `src/lib/api.ts` for browser API calls, polling, retries, and request IDs.
- `netlify/functions/minis-revise.ts` and `netlify/functions/minis-revise-background.ts` for the background request pattern.
- `netlify/functions/_shared/reviseAgent.ts` for the Claude prompt, JSON contract, parser, and version creation.
- `netlify/functions/_shared/db.ts` functions for `logFeedback`, `updateFeedbackLog`, `listAgentMessages`, `findFeedbackByRequestId`, `getMini`, and `replaceMiniSteps`.
- `SKILL.md` or `netlify/functions/_shared/miniLessonSkill.ts`; this is the domain skill the agent must follow when revising minis.

Also tell the agent the main data types:

```ts
type AgentMessage = {
  id: string;
  role: "writer" | "agent";
  content: string;
  createdAt: string;
};

type MiniStep = {
  id: string;
  instruction: string;
  interaction: string;
  targetResponse: string;
  hint: string;
  writerNotes?: string;
  agentNotes: string;
};

type Mini = {
  id: string;
  kcId: string;
  miniIndex: number;
  title: string;
  status: "not_started" | "writing" | "ready_for_review" | "done";
  currentVersionId: string;
  steps: MiniStep[];
  versions: MiniVersion[];
};
```

## Copyable Prompt For Another Coding Agent

```text
Build a right-side chat panel for a lesson-authoring app.

The panel is for a "revision agent" that helps a writer revise or discuss a selected mini lesson. It should:

1. Show a compact header: eyebrow "Revision agent", title "Agent", and a message icon.
2. Show a scrollable chat log.
3. Render writer messages and agent messages with different bubble styles.
4. Render markdown in messages, including bold, paragraphs, lists, inline code, and line breaks.
5. Show empty-state text: "Ask for revisions, ideas, or type “process notes”."
6. Show a working indicator while the agent is running. The first label should be "Thinking..." and the app may cycle through other short labels.
7. Keep the text-entry area fixed at the bottom of the panel.
8. Use one 4-line textarea for all writer requests. Do not create separate "chat" and "agent notes" request boxes.
9. Use a small send-icon button.
10. Disable the panel when there is no selected mini, when the selected mini status is Done, or while a request is running.
11. When disabled because the mini is Done, use this placeholder/reason: "Mini is Done. Change status back to Writing to edit."

Implement the server side with a background-job pattern:

- Browser POSTs to `/api/minis/:id/revise` with `{ requestId, prompt, history }`.
- Server creates a `feedback_log` row with status `started`, then starts a Netlify background function.
- Browser receives `{ pending: true, requestId }` quickly and polls `/api/minis/:id/revise-status?requestId=...`.
- Background function calls Claude, stores completed result in the same feedback row, and creates a mini version only if the mini changed.
- Browser stops polling when it receives `{ mini, response }`.

Use Claude through the Anthropic Messages API. The model can be configured with `ANTHROPIC_MODEL`, defaulting to an Opus model. The key must stay server-side in `ANTHROPIC_API_KEY`.

Claude must return only JSON:

{
  "updateMini": boolean,
  "steps": MiniStep[],
  "response": "short response to writer",
  "summary": "version history summary"
}

Important behavior:

- If the writer asks for ideas, critique, explanation, options, clarification, or planning, do not update the mini. Set `updateMini` to false, return the original steps unchanged, and offer to make a change if the writer chooses an option.
- If the writer clearly asks to revise, use, apply, change, shorten, rewrite, add, remove, or otherwise alter the mini, set `updateMini` to true and return updated steps.
- Use recent chat history to resolve follow-ups like "use idea #4".
- When the writer asks for ideas or options, respond with a numbered list and concrete examples.
- Format the user-facing response as short paragraphs/lists, not one long block.
- Treat `writerNotes` as the writer's per-step requests.
- Treat `agentNotes` as the agent's brief status/rationale field.
- If processing `writerNotes`, clear processed `writerNotes` and append a short `**Done:** ...` note to `agentNotes`.
- Do not use `agentNotes` for new writer requests.
- Preserve step IDs and target responses unless the request explicitly changes them.
- If `updateMini` is false, `steps` must be exactly the original steps and `summary` should be "No mini changes."

Persist every request and response in a feedback log so future agent behavior can be analyzed.
```

## Recommended API

Use Netlify Functions or an equivalent server-side API. Keep model and database secrets off the client.

### Browser API

```ts
POST /api/minis/:miniId/revise
body: {
  requestId: string;
  prompt: string;
  history: { role: "writer" | "agent"; content: string }[];
}

response:
  202 { pending: true, requestId }
  200 { mini: Mini, response: string }
```

```ts
GET /api/minis/:miniId/revise-status?requestId=...

response:
  202 { pending: true, requestId }
  200 { mini: Mini, response: string }
```

```ts
GET /api/agent-messages?kcId=...

response:
  AgentMessage[]
```

Optional command route:

```ts
POST /api/minis/:miniId/process-notes

response:
  { mini: Mini; response: string }
```

In `mini-writer`, typing `process notes` in the same chat box calls the notes-processing endpoint instead of the normal revise endpoint.

## Claude API Shape

Use Anthropic Messages API server-side:

```ts
client.messages.create({
  model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
  max_tokens: 4000,
  system,
  messages: [{ role: "user", content: prompt }],
  tools, // optional
});
```

Use the web search tool only when available and useful:

```ts
tools: [
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 3,
  },
]
```

Make web search optional. If tool use fails, retry without tools. The panel should still work when web search is unavailable.

## Prompt Structure

Use a system prompt for role and skill:

```text
You are the revision agent for Sidekick mini lessons. Return only valid JSON.

Preserve the writer's intent while applying this skill:
{MINI_LESSON_SKILL}
```

Use a user prompt that contains:

- Decision rules.
- Current writer request.
- Recent chat history.
- Current mini steps.
- Exact JSON schema.
- Preservation rules.

The current implementation sends:

```text
Respond to the writer request.

Important decision rule:
- If the writer is asking for ideas, critique, explanation, options, clarification, or a planning response, do not update the mini. Set updateMini to false, return the original steps unchanged, and offer to make a change if the writer chooses an option.
- When the writer asks for ideas, format the response as a numbered list so the writer can refer to each idea by number. Include concrete examples, not shorthand narrative.
- When any response includes a list of options, recommendations, hooks, examples, or possible revisions, use a numbered list so the writer can refer to items by number.
- If the writer clearly asks you to revise, use, apply, change, shorten, rewrite, add, remove, or otherwise alter the mini, set updateMini to true and return updated steps.
- Use recent chat history to resolve follow-ups like "use idea #4".
- If web search is available and useful, you may use it. If you use web search, include source URLs or short source labels in response.
- Format your response as short paragraphs and lists with blank lines between sections. Do not return one long narrative block.
- Treat writerNotes as the writer's per-step requests. Treat agentNotes as your brief status/rationale field.
- If you process a writerNotes request, clear writerNotes and append a short "**Done:** ..." note to agentNotes for that step.
- Do not use agentNotes for new writer requests.

Writer request: {prompt}

Recent chat history:
{history as JSON}

Steps:
{mini.steps as JSON}

Return JSON:
{
  "updateMini": boolean,
  "steps": MiniStep[],
  "response": "short response to writer",
  "summary": "version history summary"
}

If updateMini is false, steps must be exactly the original steps and summary should be "No mini changes.".
Preserve step ids and math targets unless the request explicitly changes them.
```

## Should The Agent Use JSON, Tools, Or Skills?

Use all three, but for different jobs:

- **JSON output:** Yes. Require JSON from Claude so the server can decide whether to update the mini and what response to show.
- **Tools:** Optional. Use Anthropic web search for research/ideas requests. Do not require it for normal revision.
- **Skills/context:** Yes. Include the mini-writing domain guidance (`SKILL.md` / `MINI_LESSON_SKILL`) in the system prompt. Do not expect the model to know the local skill file exists.

Do not expose Claude's raw JSON in the chat UI. Parse JSON server-side and show only the `response` string.

## Storage Model

Use a feedback log table. In `mini-writer`, it is `mini_writer_feedback_log`.

For every agent request:

```ts
{
  kc_id: string;
  mini_id: string;
  before_version_id: string | null;
  after_version_id: string | null;
  event_type: "agent_revision" | "process_agent_notes" | "generate_mini";
  writer_input: string;
  agent_response: string;
  payload: {
    requestId: string;
    status: "started" | "completed" | "failed";
    updateMini?: boolean;
    history?: { role: string; content: string }[];
  };
}
```

Use the log for:

- Reconstructing KC-specific chat history.
- Debugging agent failures.
- Capturing writer feedback for future skill improvements.
- Idempotency by `requestId`.

When listing messages:

- Convert `writer_input` rows into writer messages.
- Convert `agent_response` rows into agent messages.
- Filter to the selected KC.
- Keep chat history scoped by KC, not global app state.

## Versioning Rules

If Claude returns `updateMini: true`:

- Validate `steps`.
- Create an immutable mini version.
- Update `mini.currentVersionId`.
- Store `after_version_id`.
- Return the updated mini to the browser.

If Claude returns `updateMini: false`:

- Do not create a new mini version.
- Return the original mini.
- Store `after_version_id: null`.

Add a parser fallback so malformed Claude output does not leak raw JSON. If parsing fails, extract a useful `response` string when possible and do not update the mini.

## UI Behavior

Panel layout:

- Right-side panel.
- Header at top.
- Scrollable chat log in the middle.
- Fixed textarea/send row at bottom.
- Four-line textarea.
- Small icon send button.

Busy behavior:

- On send, immediately append the writer message locally.
- Set busy label to `Thinking...`.
- Disable textarea and send button while polling.
- Show a small animated working chip in the chat log.
- After completion, append the agent response.
- On failure, append a user-facing error message.

Suggested busy labels:

- `Thinking...`
- `Reading the mini...`
- `Checking the skill guidance...`
- `Researching sources...`
- `Drafting a response...`
- `Reconsidering...`
- `Making sure the math still works...`

Disable rules:

- Disable if no mini is selected.
- Disable if the mini status is `done`.
- Disable while a request is running.

## Hardening Notes

The important production lesson is to avoid long synchronous Claude calls from the browser request path.

Recommended pattern:

1. Browser sends request with `requestId`.
2. Server logs `started`.
3. Server starts background work and returns `202` quickly.
4. Browser polls status.
5. Background job updates the existing log row to `completed` or `failed`.
6. Browser displays only the parsed `response`.

Also add:

- Network retries for polling.
- Idempotency by `requestId`.
- Parser protection against raw JSON leaking into chat.
- A test harness that sends no-update prompts and asserts:
  - no timeout;
  - no error message;
  - non-empty response;
  - no raw JSON leak;
  - no mini version created;
  - no step changes.

## Minimal Implementation Checklist

- [ ] Build `AgentPanel` with header, markdown chat log, working state, textarea, send icon.
- [ ] Store messages per KC.
- [ ] Add `POST /api/minis/:id/revise`.
- [ ] Add `GET /api/minis/:id/revise-status`.
- [ ] Add background function for Claude calls.
- [ ] Require Claude JSON output.
- [ ] Parse and validate JSON server-side.
- [ ] Create mini versions only when `updateMini` is true.
- [ ] Store all feedback in a log.
- [ ] Render only `response` in the chat.
- [ ] Add no-update agent smoke tests.
