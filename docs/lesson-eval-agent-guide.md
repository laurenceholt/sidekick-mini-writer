# Generic Lesson Evaluation Agent Guide

Use this guide to ask another coding agent to build an AI evaluation feature for a lesson-writing app. The evaluator is not the same as the generation agent or the revision chat agent: it judges an existing lesson artifact and returns a structured report with actionable suggestions.

The current app evaluates short, step-based grades 3-8 math lessons, but the pattern can be adapted to other lesson types such as slide decks, worked-example sequences, problem sets, teacher guides, simulations, readings, or projects.

## What The Eval Does

The eval agent should:

1. Read the lesson source context, such as objective, standard, knowledge component, or lesson brief.
2. Read the current lesson artifact.
3. Judge the artifact against a fixed set of quality dimensions.
4. Return ratings, evidence, and labeled suggestions.
5. Avoid editing the lesson directly.
6. Produce suggestions that can later be sent to a revision agent.

The eval report should appear in the same place writers already look for agent feedback. In this app, the eval is shown as a purple agent-chat message. Other products can show it in a review drawer, checklist, modal, comments panel, or status report.

## Server Flow

Use a background-job pattern so long model calls do not block the browser request.

```ts
POST /api/artifacts/:artifactId/eval
body: {
  requestId: string;
}

response:
  202 { pending: true, requestId }
  200 { report: LessonEvalReport }
  500 { error: string }
```

```ts
GET /api/artifacts/:artifactId/eval-status?requestId=...

response:
  202 { pending: true, requestId }
  200 { report: LessonEvalReport }
  500 { error: string }
```

Server responsibilities:

- Load the selected lesson artifact.
- Load its source context.
- Log an eval request with status `started`.
- Run the model call in a background function or worker.
- Ask for structured JSON only.
- Validate and normalize the report.
- Store the report in the feedback log with status `completed`.
- Store failures with status `failed`.
- Return the parsed report to the browser.

The eval should not create a new artifact version because it does not change lesson content.

## Generic Data Types

Adapt these names to the target app.

```ts
type EvalRating = "strong" | "mostly_strong" | "mixed" | "needs_work";
type EvalPriority = "high" | "medium" | "low";

type LessonEvalDimension = {
  key: string;
  label: string;
  rating: EvalRating;
  evidence: string;
};

type LessonEvalSuggestion = {
  label: "A" | "B" | "C" | string;
  number: number;
  priority: EvalPriority;
  title: string;
  locations: string[];
  issue: string;
  suggestion: string;
  implementationPrompt: string;
};

type LessonEvalReport = {
  artifactId: string;
  sourceContextId: string;
  title: string;
  overallRating: EvalRating;
  summary: string;
  dimensions: LessonEvalDimension[];
  suggestions: LessonEvalSuggestion[];
  readyForReview: boolean;
};
```

Use `locations` for whatever the lesson artifact uses: step IDs, slide IDs, card numbers, section headings, scene IDs, problem numbers, or paragraph anchors.

## Current Eval Dimensions

The current app uses these dimensions, in this priority order.

### 1. Math Accuracy

Judge whether the math is correct, whether target responses match the prompts, and whether examples or explanations are valid.

This is a core dimension for any math lesson. For other subjects, replace it with the discipline-specific accuracy dimension, such as scientific accuracy, historical accuracy, grammar accuracy, or source accuracy.

### 2. Objective Focus

Judge whether the lesson directly teaches and assesses the stated objective, knowledge component, or learning goal. The evaluator should penalize lessons that drift into broad precursor teaching or adjacent skills.

This is broadly reusable. Rename it to fit the product language: objective focus, standard alignment, skill focus, competency focus, or lesson-goal alignment.

### 3. Age-Appropriate Examples

Judge whether examples feel appropriate and engaging for the target age. In the current math lesson app, the eval specifically avoids childish defaults such as "one apple plus two apples" or plain pizza-slicing unless there is a brief age-appropriate backstory, purpose, or stake.

This should be adjusted for the audience. For younger students, concrete everyday examples may be ideal. For older students, examples should feel less babyish and more purposeful. For professional training, examples should use authentic workplace contexts.

### 4. Learning Arc

Judge whether the lesson has a sensible sequence, such as hook, introduction, practice, stretch, and synthesis. The current app expects short lessons to move quickly into the target skill rather than spending many steps on prerequisites.

This is reusable, but the expected arc should match the lesson type. A slide deck, project, simulation, inquiry lesson, or long-form reading may need a different structure.

### 5. Game-Ability

Count steps where a student can answer by trying a small number of visible options without thinking. In the current app, this includes two-option multiple choice, three-option multiple choice, true/false, agree/disagree, and similar interactions. The current target is three or fewer such steps in one short lesson.

This dimension is most relevant for interactive lessons. For essays, readings, videos, or teacher guides, replace it with a better engagement-integrity measure, such as response authenticity, cognitive demand, or assessment validity.

### 6. Step Clarity

Judge whether learner-facing instructions are succinct, readable, and unambiguous. The current app values short instructions because each lesson step has limited screen space.

For other lesson types, adjust this to match the medium: slide clarity, task clarity, activity directions, teacher move clarity, or student-facing prompt clarity.

### 7. Hint Quality

Judge whether hints tell the learner what step to take without doing the work for them. In the current app, hints should not calculate the answer or give away the target response.

This is reusable for tutoring, practice, and interactive lessons. It may be irrelevant for lessons that do not include hints.

### 8. Engagement And Representation

Judge whether the lesson uses representations, contexts, visuals, or interactions that make the concept more understandable and interesting.

This should be adjusted by lesson type. A simulation may need manipulation quality. A reading lesson may need text quality and examples. A slide deck may need visual hierarchy and diagram usefulness.

### 9. Implementation Readiness

Judge whether the lesson is ready to build or export. In the current app this is one grouped dimension covering ID problems, unclear target responses, unclear interaction specs, field hygiene, export readiness, and engineering ambiguity.

This dimension is reusable, but the checks should match the artifact format. For example, slide decks need layout/export checks; simulations need asset and state checks; problem sets need answer-key and scoring checks.

## Current App-Specific Rules

These rules are useful for the current short math lesson format but may need adjustment elsewhere.

- **Most important dimensions:** Math Accuracy and Objective Focus come first. If either is `mixed` or `needs_work`, the lesson is usually not ready for review.
- **Ratings:** Use only `strong`, `mostly_strong`, `mixed`, and `needs_work`.
- **Length:** Do not critique length if a short step-based lesson has 8, 9, 10, or 11 steps. Critique length only below 8 or above 11. Other lesson types need their own length rule.
- **Abstract lessons:** If the objective is especially abstract or symbolic, allow more abstract math steps. Do not force every abstract concept into an application context. Otherwise, expect at least some application steps.
- **Choice-only interactions:** Count two- or three-choice interactions. Rate game-ability as `strong` for 0-2, `mostly_strong` for 3, `mixed` for 4, and `needs_work` for 5 or more.
- **Suggestions:** Label suggestions A, B, C, and so on so the writer can say "implement suggestions A and C."
- **Implementation prompts:** Every suggestion should include an `implementationPrompt` that a revision agent can execute later.

## Prompt Template

```text
Evaluate this lesson artifact. Do not revise it. Return only valid JSON.

Source context:
{sourceContext as JSON}

Lesson artifact:
{artifact as JSON}

Quality standard:
{LESSON_WRITING_SKILL_OR_GUIDELINES}

Judge the artifact on these dimensions, in this priority order:
{dimensions}

Rules:
- The first two dimensions are the most important. If either is mixed or needs_work, the artifact should usually not be ready for review.
- Use ratings only from: strong, mostly_strong, mixed, needs_work.
- Give specific evidence with artifact locations.
- Do not critique length unless it violates the length rule for this artifact type.
- Adjust abstract/concrete balance based on the objective and lesson type.
- Label suggestions A, B, C, ... in priority order.
- Each suggestion must include an implementationPrompt that can be sent to the revision agent later.
- Prioritize suggestions that fix accuracy or objective-focus problems before style, engagement, or implementation polish.
- Do not edit the artifact.

Return JSON:
{
  "artifactId": string,
  "sourceContextId": string,
  "title": string,
  "overallRating": "strong" | "mostly_strong" | "mixed" | "needs_work",
  "summary": string,
  "dimensions": [
    {
      "key": string,
      "label": string,
      "rating": "strong" | "mostly_strong" | "mixed" | "needs_work",
      "evidence": string
    }
  ],
  "suggestions": [
    {
      "label": "A",
      "number": number,
      "priority": "high" | "medium" | "low",
      "title": string,
      "locations": [string],
      "issue": string,
      "suggestion": string,
      "implementationPrompt": string
    }
  ],
  "readyForReview": boolean
}
```

## Formatting The Report

A useful writer-facing report format is:

```md
**Eval**

**Overall:** mostly_strong

**Ready for review:** No

Short summary paragraph.

**Dimensions**
- **Math Accuracy:** strong. Evidence...
- **Objective Focus:** mixed. Evidence...

**Suggestions**
A. **[high] Tighten the objective focus (step 4)**
   - Issue: ...
   - Suggestion: ...

B. **[medium] Replace one choice-only interaction (step 7)**
   - Issue: ...
   - Suggestion: ...
```

Show only this formatted report to the writer. Do not show raw JSON.

## Feedback Log

Store eval events in the same feedback log as generation and revision events.

```ts
{
  context_id: string;
  artifact_id: string;
  before_version_id: string | null;
  after_version_id: null;
  event_type: "lesson_eval";
  writer_input: "Eval";
  agent_response: string;       // formatted report
  payload: {
    requestId: string;
    status: "started" | "completed" | "failed";
    report?: LessonEvalReport;
    error?: string;
  };
  created_at: string;
}
```

This makes the eval visible in chat history and gives the revision agent enough context to handle follow-ups like "implement suggestions A and C."

## Adaptation Checklist

Before reusing this eval in another lesson-writing product, decide:

- What source context defines success?
- What artifact locations should evidence point to?
- What is the right length rule?
- Is game-ability relevant, or should it become assessment validity/cognitive demand?
- Are hints present?
- What counts as age-appropriate for the audience?
- What implementation-readiness checks matter for this artifact format?
- Which dimensions should block `readyForReview`?
