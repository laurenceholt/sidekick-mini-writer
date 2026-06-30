---
name: learning-goal-slide-segments
description: Write short math lesson segments from a Learning Goal as six-slide sequences. Use this when an agent needs to create a compact slide-based lesson segment for elementary or middle school math, adapting the mini-writer style from ten interactive steps into six focused slides.
---

# Learning Goal Slide Segments

Use this skill to write a short math lesson segment from a **Learning Goal**. The output is a six-slide sequence, not a ten-step mini lesson.

The goal is that by the end of six slides, the student can do the target action named in the Learning Goal with less support than they had at the start. The segment should feel active, visual, and concise. It should not read like a textbook excerpt.

## Inputs

The agent should expect some or all of:

- **Learning Goal:** the specific skill or idea students should learn.
- **Grade or age band:** the intended student level.
- **Standards or curriculum notes:** optional alignment context.
- **Known prerequisites:** what students can already do.
- **Misconceptions:** common errors to anticipate.
- **Tone or product constraints:** style, slide format, interaction support, or media rules.

If only the Learning Goal is provided, infer a reasonable grade band and state the assumption briefly in the rationale.

## Output Format

Return one six-slide lesson segment. Use a structured format that another system can parse.

```json
{
  "title": "Short segment title",
  "learningGoal": "The Learning Goal being taught",
  "gradeBand": "e.g. Grade 6",
  "rationale": [
    "Short reason for the hook.",
    "Short reason for the sequence.",
    "Short reason for interaction or visual choices."
  ],
  "slides": [
    {
      "slideNumber": 1,
      "purpose": "Hook | Try | Name | Practice | Stretch | Synthesis",
      "studentFacingText": "Text students see on the slide.",
      "visualOrInteraction": "What appears on the slide and what students do.",
      "targetResponse": "Expected answer or behavior, if any.",
      "speakerNotes": "Brief note for teacher/app/agent about intent.",
      "hintOrSupport": "Optional nudge that does not give away the answer."
    }
  ]
}
```

Keep `studentFacingText` short. Prefer one sentence, occasionally two. Put build details, visuals, answer keys, and interaction specifications in `visualOrInteraction`, `targetResponse`, and `speakerNotes`, not in the student text.

## Focus On The Learning Goal

Teach the named Learning Goal, not the full chain of prerequisite skills beneath it.

Assume students have relevant precursor knowledge unless the input says otherwise. Do not spend the segment reteaching broad prerequisites such as basic multiplication, simplifying fractions, or reading a number line when those are only supports for the Learning Goal.

It is acceptable to include one very brief prerequisite reminder if the Learning Goal cannot start without it. Keep that reminder to a single slide beat, then move immediately into the new goal.

Use prerequisite reminders to clear the runway, not to create a separate lesson.

## Six-Slide Architecture

Use this default arc unless the Learning Goal clearly needs a different shape.

### Slide 1: Hook

Open with a concrete, age-appropriate situation that gives the math a reason to exist.

The hook should be quick: a receipt to check, a game score, a group chat poll, a ride-height rule, a sports stat, a map, a thermometer, a design choice, or a small mystery. Avoid babyish examples like "one apple plus two apples" or plain pizza slices unless there is a brief backstory, purpose, or stake.

If web search is available, search for how teachers or curricula introduce the idea, then adapt the best fit. Do not copy source language.

### Slide 2: Try Before Naming

Let students do the target idea before naming it.

Use scaffolding: small numbers, visible number line, diagram, choices from a larger set, drag/sort, or a partially completed example. The slide should feel reachable.

### Slide 3: Name And Stamp The Idea

Name the concept only after students have felt the idea.

Use casual language such as "By the way..." or "Mathematicians call this..." when it fits. Give a pronunciation guide for new vocabulary when helpful.

Add one short stamping sentence that makes the idea memorable. Examples:

- "Equations are sentences in math. They can be true or false."
- "A ratio compares two amounts."
- "The median is the middle after the numbers line up."

Keep the stamp brief. It should clarify, not lecture.

### Slide 4: Guided Practice

Give students a second chance to use the Learning Goal with moderate support.

Change one variable from the earlier slide: bigger numbers, less visual support, a new representation, or a slightly different context.

### Slide 5: Stretch Or Application

Remove some scaffolding or move into a brief application.

For abstract or symbolic Learning Goals, it is okay for this slide to remain mostly abstract if that best serves the goal. Do not force every abstract goal into a real-world context. For more concrete or procedural goals, include a brief application where the skill matters.

### Slide 6: Synthesis Check

End with a small check that shows whether students can use the Learning Goal.

This should be the hardest slide, but still reachable from the prior five. It can be an unscaffolded problem, a compare-and-explain item, an error analysis, or a "which statement is true?" check.

## Slide Writing Rules

### Student-Facing Text

Make the slide text succinct and conversational.

Do:

- Use short prompts.
- Let the visual carry equations, graphs, tables, or diagrams.
- Refer to visible math naturally: "Is this equation true?" rather than restating the equation.
- Use transitions like "Bigger numbers now." or "Try without the number line."
- Keep vocabulary at least one grade level below the target grade except for the term being taught.

Avoid:

- "Let's explore..."
- "Let's dive in..."
- "Now we will learn..."
- Long definitions before students do anything.
- Repetitive praise.
- Dense paragraphs.

### Visuals And Interactions

Each slide should specify what the student sees and does.

Good slide visuals are specific to the math:

- receipt for checking equation truth;
- balance scale for equality;
- thermometer for negative numbers;
- number line for signed quantities;
- row of skyscrapers for coordinate plane;
- map or elevator for vertical position;
- sports stat, playlist, budget, or poll for data and comparison.

Use cartoons or simple diagrams rather than generic decoration. The image should help the math context, not just fill space.

If the slide is interactive, define the interaction precisely:

- tap;
- drag;
- sort;
- plot;
- type;
- choose from a menu;
- annotate;
- explain in one sentence.

Avoid too many two- or three-option choice slides. Some students will click through the options without thinking. In a six-slide segment, aim for **two or fewer** gameable choice slides. Prefer interactions that require a real response.

### Hints And Supports

Hints should tell students what step to take without doing the step for them.

Good:

- "Check whether both sides have the same value."
- "Line the numbers up from least to greatest first."
- "Look at which point is farther right."

Not good:

- "The answer is 7."
- "3 + 4 = 7, so choose true."
- "Multiply 0.4 by 15 to get 6, so it is false."

The hint points; it does not solve.

## Age-Appropriate Examples

Examples should fit the target grade.

For upper elementary and middle school, avoid contexts that feel written for much younger students unless there is a reason. A simple context is fine; a childish context is not.

Better than generic food counting:

- checking a receipt;
- comparing game scores;
- planning a snack budget;
- reading a weather alert;
- choosing a ride based on a height rule;
- interpreting a group poll;
- comparing music playlist lengths;
- checking whether a claim in a group chat is true;
- building or designing something small.

Keep the story brief. The math is still the main event.

## Abstract Learning Goals

Some Learning Goals are inherently symbolic or abstract: equation truth, expression structure, notation, properties, variables, or formal comparison.

For these, allow more abstract math on the slides. Use a hook or visual entry point, but do not overload the segment with forced real-world contexts. The segment should still help students see why the idea matters, but the practice can stay close to the symbols when that is the clearest path.

## Interaction Progression

Move from receptive to productive:

1. See or choose.
2. Drag, sort, plot, or complete.
3. Type, explain, or solve with less support.

Do not use six versions of the same interaction. Vary the response mode where the product allows it.

## Voice And Tone

The voice should sound like a smart older student or friendly tutor showing a math idea on a napkin.

Use:

- short common words;
- light, specific encouragement only when useful;
- casual naming after experience;
- precise math where precision matters;
- brief setup followed quickly by action.

Avoid:

- lectures;
- formal textbook prose;
- jokes that distract from the math;
- math jargon before meaning;
- long sentences;
- front-loaded explanations.

## Quality Check Before Returning

Before finalizing, check:

- Does every slide serve the Learning Goal?
- Is there at most one quick prerequisite reminder?
- Does the sequence move from hook to action to naming to practice to synthesis?
- Are student-facing prompts short?
- Are visuals or interactions specific enough to build?
- Are target responses clear?
- Do hints avoid giving away answers?
- Are there two or fewer gameable two- or three-choice slides?
- Does the final slide genuinely check the Learning Goal?

## Anti-Patterns

- Six slides of explanation with no student action.
- Definitions before experience.
- Teaching a broad prerequisite chain instead of the Learning Goal.
- Babyish examples for older students.
- Generic clip art or "math picture" visuals.
- Repeating the same interaction on every slide.
- Choice-only slides that can be guessed by trial and error.
- Hints that reveal the answer.
- A final slide that introduces a new idea instead of checking the Learning Goal.

## Tiny Example

Learning Goal: Determine whether an equation is true by evaluating both sides.

```json
{
  "title": "Is This Equation Telling The Truth?",
  "learningGoal": "Determine whether an equation is true by evaluating both sides.",
  "gradeBand": "Grade 6",
  "rationale": [
    "A receipt check gives students a reason to care whether a math sentence is true.",
    "The sequence moves from visible arithmetic to a concise concept stamp and then to less-supported checks.",
    "The interactions avoid relying only on true/false choices by adding sorting and one-sentence explanation."
  ],
  "slides": [
    {
      "slideNumber": 1,
      "purpose": "Hook",
      "studentFacingText": "The receipt says 3 snacks at $4 each cost $15. Is the receipt right?",
      "visualOrInteraction": "Show a simple receipt: 3 x $4 = $15. Student taps Right or Not right. Target is Not right.",
      "targetResponse": "Not right",
      "speakerNotes": "Start from a concrete truth-check before using the word equation.",
      "hintOrSupport": "Check what 3 groups of 4 should cost."
    },
    {
      "slideNumber": 2,
      "purpose": "Try",
      "studentFacingText": "Now check this equation.",
      "visualOrInteraction": "Display 6 + 5 = 11 with a small left-side/right-side evaluation area. Student drags 'true' or 'false' onto the equation.",
      "targetResponse": "true",
      "speakerNotes": "The equation is visible, so the prompt does not restate it.",
      "hintOrSupport": "Find the value on each side."
    },
    {
      "slideNumber": 3,
      "purpose": "Name",
      "studentFacingText": "Equations are sentences in math. They can be true or false.",
      "visualOrInteraction": "Show two cards: 8 = 8 and 8 = 9. Student sorts each into True or False.",
      "targetResponse": "8 = 8 is True; 8 = 9 is False.",
      "speakerNotes": "Short stamp after students have already checked two claims.",
      "hintOrSupport": "A true equation has the same value on both sides."
    },
    {
      "slideNumber": 4,
      "purpose": "Practice",
      "studentFacingText": "This one has multiplication.",
      "visualOrInteraction": "Display 0.4 x 15 = 20. Student types the value of the left side, then chooses true/false.",
      "targetResponse": "Left side is 6; equation is false.",
      "speakerNotes": "Requires evaluating before judging truth.",
      "hintOrSupport": "Start with the multiplication on the left."
    },
    {
      "slideNumber": 5,
      "purpose": "Stretch",
      "studentFacingText": "Find the false equation.",
      "visualOrInteraction": "Show four equation cards. Student selects the one false card. Include one with fractions if appropriate for the grade.",
      "targetResponse": "The selected false card depends on the generated set.",
      "speakerNotes": "Richer choice set reduces guessing and asks for comparison across examples.",
      "hintOrSupport": "Check both sides of each card until one does not match."
    },
    {
      "slideNumber": 6,
      "purpose": "Synthesis",
      "studentFacingText": "Explain why this equation is false.",
      "visualOrInteraction": "Display 5(3 + 1) = 24. Student writes one sentence.",
      "targetResponse": "Because 5(3 + 1) equals 20, not 24.",
      "speakerNotes": "Final check requires evaluating and explaining, not just clicking false.",
      "hintOrSupport": "Evaluate the left side first, then compare it with 24."
    }
  ]
}
```
