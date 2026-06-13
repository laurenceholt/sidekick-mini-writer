# Generic Lesson Writer Chat Panel Guide

Use this guide to ask another coding agent to build a reusable chat panel alongside a lesson-writing interface. The panel is a revision/planning assistant for a selected lesson artifact in a separate lesson-writing app.

## What Context To Send The Agent

Send enough context for the agent to understand four things:

1. The selected lesson artifact shape.
2. How edits are saved and versioned.
3. What domain guidance the assistant should follow.
4. Where chat messages and feedback logs should be stored.

Useful context to provide:

- The UI component or layout where the chat panel should live.
- The selected lesson artifact type, such as a lesson, activity, slide sequence, step table, problem set, or teacher guide section.
- The app's existing save/version model.
- The app's API style and deployment target.
- The app's domain instructions or skill file.
- A sample completed lesson artifact.
- A sample writer request and expected agent response.

Ask the receiving agent to inspect analogous files in its own codebase before implementing: the editor shell, current save/version APIs, existing message or comment components, server route conventions, and any model-calling utilities.

## Generic Data Types

Adapt these names to the target app.

```ts
type ChatMessage = {
  id: string;
  role: "writer" | "agent";
  content: string;
  createdAt: string;
};

type LessonPart = {
  id: string;
  title?: string;
  body?: string;
  prompt?: string;
  interaction?: string;
  targetResponse?: string;
  hint?: string;
  writerNotes?: string;
  agentNotes?: string;
};

type LessonArtifact = {
  id: string;
  parentId?: string;
  title: string;
  status?: "not_started" | "writing" | "ready_for_review" | "done";
  currentVersionId?: string;
  parts: LessonPart[];
  versions?: LessonVersion[];
};

type AgentRevisionResult = {
  updateArtifact: boolean;
  artifact: LessonArtifact;
  response: string;
  summary: string;
};
```

If the target app does not have `parts`, use whatever unit is editable: slides, cards, sections, pages, rows, scenes, questions, blocks, or document spans.

## Copyable Prompt For Another Coding Agent

```text
Build a right-side chat panel for a lesson-writing app.

The panel is for a revision/planning agent that helps a writer discuss or revise the currently selected lesson artifact.

UI requirements:

1. Place the panel alongside the editor, usually on the right.
2. Show a compact header with an eyebrow such as "Revision agent", title "Agent", and a message icon.
3. Show a scrollable chat log.
4. Render writer and agent messages with visually distinct bubble styles.
5. Render markdown in messages: paragraphs, bold, numbered lists, bullet lists, inline code, and line breaks.
6. Show empty-state text such as "Ask for revisions, ideas, or feedback."
7. Show a working indicator while the agent is running. Start with "Thinking..." and optionally cycle through other short status labels.
8. Keep the text-entry area fixed at the bottom of the panel.
9. Use one textarea for all writer requests. Do not create separate request boxes unless the product has a clear workflow reason.
10. Use a small send-icon button.
11. Disable the panel when there is no selected artifact, when the selected artifact is locked/done, or while a request is running.

Server/API requirements:

1. Keep model and database secrets server-side.
2. Browser sends a request with `{ requestId, prompt, history }`.
3. Server logs the request with status `started`.
4. Server starts model work in a background job or another long-running worker.
5. Browser receives `{ pending: true, requestId }` quickly.
6. Browser polls a status endpoint until it receives `{ artifact, response }` or a failure.
7. Background work updates the feedback log to `completed` or `failed`.
8. Create a new artifact version only if the agent actually changed the artifact.
9. Show only the agent's user-facing `response` in the chat, never raw model JSON.

Model requirements:

Use Claude through the Anthropic Messages API, or another model API with equivalent structured-output behavior. The model key must stay server-side.

Ask the model to return JSON with this shape:

{
  "updateArtifact": boolean,
  "artifact": LessonArtifact,
  "response": "short response to the writer",
  "summary": "version history summary"
}

Decision rules:

- If the writer asks for ideas, critique, explanation, options, clarification, or planning, do not update the artifact. Set `updateArtifact` to false, return the original artifact unchanged, and offer to make a change if the writer chooses an option.
- If the writer clearly asks to revise, apply, change, shorten, rewrite, add, remove, or otherwise alter the artifact, set `updateArtifact` to true and return the updated artifact.
- Use recent chat history to resolve follow-ups such as "use idea #4".
- When the writer asks for ideas/options, respond with a numbered list and concrete examples.
- Format the user-facing response as short paragraphs and lists, not one long block.
- Treat writer comments or inline annotations as requests from the writer.
- Treat any agent status/rationale field as the agent's brief completion note.
- If processing inline writer comments, clear processed comments and append a short `**Done:** ...` note to the agent status/rationale field when one exists.
- Preserve IDs and assessment targets unless the writer explicitly asks to change them.
- If `updateArtifact` is false, return the artifact exactly unchanged and set summary to "No lesson changes."

Persist every writer request, model response, before/after version IDs, and status in a feedback log so the product team can analyze writer feedback and improve future prompts.
```

## Recommended API Pattern

Use these generic routes, adapting names to the target app.

```ts
POST /api/artifacts/:artifactId/revise
body: {
  requestId: string;
  prompt: string;
  history: { role: "writer" | "agent"; content: string }[];
}

response:
  202 { pending: true, requestId }
  200 { artifact: LessonArtifact, response: string }
  500 { error: string }
```

```ts
GET /api/artifacts/:artifactId/revise-status?requestId=...

response:
  202 { pending: true, requestId }
  200 { artifact: LessonArtifact, response: string }
  500 { error: string }
```

```ts
GET /api/agent-messages?contextId=...

response:
  ChatMessage[]
```

Optional note-processing command:

```ts
POST /api/artifacts/:artifactId/process-notes

response:
  { artifact: LessonArtifact; response: string }
```

The UI can route a plain-text command such as `process notes` to the note-processing endpoint. This keeps the panel simple: one text box for both chat and commands.

## Model API

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

Optional web search:

```ts
tools: [
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 3,
  },
]
```

Use web search only for requests that benefit from outside examples, research, or current references. Make it optional and retry without tools if the tool call fails.

## Prompt Structure

Use a system prompt for role and domain rules:

```text
You are the revision agent for a lesson-writing tool. Return only valid JSON.

Preserve the writer's intent while applying this domain guidance:
{LESSON_WRITING_SKILL_OR_GUIDELINES}
```

Use a user prompt that includes:

- Decision rules.
- Current writer request.
- Recent chat history.
- Current selected artifact.
- Exact JSON schema.
- Preservation rules.

Generic user prompt template:

```text
Respond to the writer request.

Decision rules:
- If the writer is asking for ideas, critique, explanation, options, clarification, or planning, do not update the artifact. Set updateArtifact to false, return the original artifact unchanged, and offer to make a change if the writer chooses an option.
- When the writer asks for ideas, format the response as a numbered list so the writer can refer to each idea by number. Include concrete examples.
- If the writer clearly asks you to revise, apply, change, shorten, rewrite, add, remove, or otherwise alter the artifact, set updateArtifact to true and return the updated artifact.
- Use recent chat history to resolve follow-ups like "use idea #4".
- If web search is available and useful, you may use it. If you use web search, include source URLs or short source labels in response.
- Format your response as short paragraphs and lists with blank lines between sections.
- Treat writer comments or inline annotations as writer requests.
- Treat any agent status/rationale field as your brief completion note.
- If you process inline writer comments, clear them and append a short "**Done:** ..." note to the agent status/rationale field when one exists.
- Preserve stable IDs and assessment targets unless the request explicitly changes them.

Writer request:
{prompt}

Recent chat history:
{history as JSON}

Selected artifact:
{artifact as JSON}

Return JSON:
{
  "updateArtifact": boolean,
  "artifact": LessonArtifact,
  "response": "short response to writer",
  "summary": "version history summary"
}

If updateArtifact is false, artifact must be exactly the original artifact and summary should be "No lesson changes.".
```

## Should The Agent Use JSON, Tools, Or Skills?

Use all three, with clear boundaries:

- **JSON output:** Yes. Require structured JSON so the server can safely decide whether to update the lesson artifact and what message to show.
- **Tools:** Optional. Use web search or retrieval tools for research and examples. Do not require tools for normal revisions.
- **Skills/context:** Yes. Include the product's lesson-writing guidelines in the system prompt. Do not assume the model has access to local files unless you explicitly send them.

Do not expose raw JSON in the chat UI. Parse it server-side and display only the `response` field.

## Feedback Log Storage

Store every interaction in a feedback log table or collection.

Generic shape:

```ts
{
  context_id: string;             // lesson, unit, project, or authoring workspace
  artifact_id: string;
  before_version_id: string | null;
  after_version_id: string | null;
  event_type: "agent_revision" | "process_notes" | "generation" | string;
  writer_input: string;
  agent_response: string;
  payload: {
    requestId: string;
    status: "started" | "completed" | "failed";
    updateArtifact?: boolean;
    history?: { role: string; content: string }[];
    error?: string;
  };
  created_at: string;
}
```

Use the log for:

- Reconstructing chat history for the selected lesson context.
- Debugging model failures.
- Capturing writer feedback for future prompt/skill improvements.
- Idempotency by `requestId`.

When listing messages:

- Convert `writer_input` into writer messages.
- Convert `agent_response` into agent messages.
- Filter to the selected context/artifact.
- Keep chat history scoped to the current lesson context, not global app state.

## Versioning Rules

If the model returns `updateArtifact: true`:

- Validate the updated artifact.
- Preserve required IDs.
- Create an immutable version snapshot.
- Update the artifact's current version pointer.
- Store `after_version_id` in the feedback log.
- Return the updated artifact to the browser.

If the model returns `updateArtifact: false`:

- Do not create a new artifact version.
- Return the original artifact.
- Store `after_version_id: null`.

Add a parser fallback so malformed model output does not leak raw JSON. If parsing fails, extract a useful `response` string when possible and do not update the artifact.

## UI Behavior

Panel layout:

- Right-side panel or adjacent side panel.
- Header at top.
- Scrollable chat log in the middle.
- Fixed textarea/send row at bottom.
- One multiline textarea.
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
- `Reading the lesson...`
- `Checking the guidance...`
- `Researching sources...`
- `Drafting a response...`
- `Reconsidering...`
- `Checking the learning arc...`
- `Making sure the assessment target still works...`

Disable rules:

- Disable if no lesson artifact is selected.
- Disable if the selected artifact is locked or marked done.
- Disable while a request is running.

## Hardening Notes

Avoid long synchronous model calls from the browser request path.

Recommended pattern:

1. Browser sends request with `requestId`.
2. Server logs `started`.
3. Server starts background work and returns `202` quickly.
4. Browser polls status.
5. Background job updates the existing log row to `completed` or `failed`.
6. Browser displays only the parsed `response`.

Add:

- Network retries for polling.
- Idempotency by `requestId`.
- Failure status instead of indefinitely stuck `started` rows.
- Parser protection against raw JSON leaking into chat.
- A smoke test harness that sends no-update prompts and asserts:
  - no timeout;
  - no error message;
  - non-empty response;
  - no raw JSON leak;
  - no artifact version created;
  - no artifact changes.

## Minimal Implementation Checklist

- [ ] Build chat panel with header, markdown chat log, working state, textarea, and send icon.
- [ ] Store messages scoped to the selected lesson context.
- [ ] Add `POST /api/artifacts/:id/revise`.
- [ ] Add `GET /api/artifacts/:id/revise-status`.
- [ ] Add background function or worker for model calls.
- [ ] Require structured JSON output.
- [ ] Parse and validate JSON server-side.
- [ ] Create artifact versions only when `updateArtifact` is true.
- [ ] Store all feedback in a log.
- [ ] Render only the parsed `response` in the chat.
- [ ] Add no-update agent smoke tests.
