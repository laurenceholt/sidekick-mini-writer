---
name: math-mini-lessons
description: Write step-by-step math mini-lessons for app-based learning in the Sidekick/Duolingo style — short, interactive practice sequences specified as tables with Step ID, Instruction, Interaction, and Hint text columns. Use this skill whenever the user asks to draft a math lesson, mini-lesson, lesson sequence, or step-by-step practice content for elementary or middle school math; whenever they reference "Sidekick lessons," "Mindly lessons," Duolingo-style math, or interactive math practice with numbered steps; or whenever they show example lessons in a table format and ask for more. Default to this skill for any request to write or extend interactive math practice content with hierarchical step IDs like 1-2-3-4.
---

# Math Mini-Lessons

These lessons are short, interactive math practice sequences (around ten steps each) that students work through on a phone or tablet, tapping, dragging, or typing answers. They live in a four-column table: Step ID, Instruction, Interaction, Hint text. The student sees only the Instruction and reacts to the Interaction; designers and engineers use the rest to build it.

The goal is that by the end of a ten-step mini-lesson, the student is doing something they couldn't have done at step one, often without the visual aids they started with. Lessons are friendly, never lecturing, and trust the student to figure things out from doing.

## Lesson architecture

A *lesson* contains one to three *mini-lessons*. A mini-lesson is the ten-step table. After all mini-lessons, the lesson ends with a *mastery check* of two or three problems.

Step IDs follow `Section-Lesson-Minilesson-Step`. For example, `1-2-3-4` is Section 1, Lesson 2, Mini-lesson 3, Step 4. Keep this format consistent; the system references items by ID.

Between lessons you may also include *interstitials*: short opt-in story or cultural moments ("Would you like to read the story of zero?"). These break up the math and add color. Keep them brief — a few sentences and one image.

## Sequencing within a mini-lesson

A mini-lesson moves through four overlapping phases. The phase boundaries are loose; what matters is the shape of the curve.

### Warm-up (early steps)

The student does the new thing before being told what it's called. Plot a -3 before the word "negative" appears. Scaffolding is at its highest: number line visible, multiple choice with two options, range kept small. The first one or two steps should feel almost easy.

### Naming and concept (middle steps)

Once the student has felt the idea a few times, name it. The lessons typically use "By the way…" or "Mathematicians call this…" — a casual aside that lands the vocabulary now that there's something to attach it to. Give a phonetic pronunciation on first use of a new term: "median (MEE-dee-un)," "histogram (HIST-o-gram)."

Build patterns through analogy and contrast. Present pairs that vary on exactly one dimension (-3 vs -5, then -2 vs 2, then -5 vs -2) so the student notices the structure for themselves.

### Stretching (later steps)

Remove scaffolds, grow the numbers, vary the context. The classic move is "Try without the number line — draw one if you want." This signals that the student is trusted to carry the idea, while leaving a way back. Numbers can get bigger (5 to 5 becomes -100 to 100). New contexts appear (thermometer, elevation, the same idea applied somewhere else).

### Synthesis (final step)

The hardest item, often unscaffolded, that ties the mini-lesson together. This step should sit just outside what the student could have done at step one — close enough to reach with the work they've just put in, far enough to feel like a win. Sometimes it's a "Which sentence is true?" rule check; sometimes it's a real-world application that calls on the whole lesson.

### Sequencing across mini-lessons

Within a lesson, climb the difficulty by changing one variable at a time: integers to decimals, small range to big range, familiar context to abstract notation, with scaffolds to without. Each mini-lesson introduces one new wrinkle on top of the previous one.

## Inside a step

Every step has an Instruction, an Interaction, and (optionally) a Hint.

### The Instruction column

This is the student-facing prompt. Make it as succinct as possible — usually one short sentence, occasionally two. Conversational, not formal. Imperatives are fine ("Plot -7"). Terse transitions move the student along: "Bigger numbers now." "Try without a number line." "Now try this one."

Do not repeat information that is already visible in the interaction. If the interaction displays an equation, the instruction does not need to restate it. Refer to it naturally: "Is this equation true?" or "Solve this equation." Let the interaction carry the equation, graph, table, choices, or visual details.

Drop the student into the work. Never open a step with a definition or an overview. If a definition is needed, embed it inside the step alongside an action: "Numbers to the left of 0 are negative. Which is more negative, -3 or -5?" The definition rides along with a question, not as a paragraph before the work starts.

When introducing a new context — temperature, elevation, an archery target — give a single sentence of setup, then the question. The setup carries flavor; the question carries the math.

Encouragement should be specific and light. "This one is tough, but you know the math to solve it" lands; "Great job, you can do this!" doesn't.

### The Interaction column

This is for the designer or engineer building the step. Be precise. Cover:

- The interaction type (number line, multiple choice, agree/disagree, text box, drag, drop-down, toggle, click-to-plot, sort-to-bucket).
- The visual setup: range of the number line, what's already plotted, axes, labels, what's selectable.
- The target answer or acceptable range.
- Any illustration to include (see the illustrations section below).
- Special hint or feedback behavior, if it differs from the default.

Sequence interactions from receptive to productive within a mini-lesson. Tap-to-plot and multiple choice come before text entry. Two-option multiple choice is the easiest format; three options is harder; agree/disagree sits between them. Text entry and "write your own" are the most demanding and belong later in the arc. By the time the student is typing, they've seen the same idea several times in lower-stakes formats.

Vary the interaction type across consecutive steps. Ten "Which is greater?" multiple-choice questions in a row will lose any student. Mix plotting, comparing, agreeing/disagreeing, and typing across the ten steps.

### Hint text

Hints appear when a student gets a step wrong. Keep them to one sentence, occasionally two. Two types do most of the work:

- *Procedural hints* tell the student what to do next without revealing the answer or doing the step for them. "Count along the buildings first, then up the floors."
- *Conceptual hints* refresh the underlying idea. "Less than means farther to the left on the number line."

Some hints reference an earlier step or mini-lesson concept ("Remember, -1 + 1 = 0"). That's often more efficient than re-explaining.

Never give the answer in a hint. The hint's job is to point, not solve. A hint may tell the learner which step to take ("Check whether the two sides have the same value"), but it should not actually perform the calculation or substitution for them.

## Illustrations

Small cartoons are part of the texture, not an afterthought. They appear when a new context is introduced and often carry through the steps that share that context.

Make them specific to the math context. A grape for the grape-catching dot plot. A soccer ball for the goals plot. A pillow for the sleep-hours plot. A homework clock reading 55 minutes for the homework dot plot. A pair of paper-cutout dolls joined at the hands for the siblings plot. They reinforce the scenario rather than decorating it.

Keep them small and unobtrusive — "in the corner of the page" or "on the page" is the standard phrasing. They should not compete with the math.

Let humor live here more than in the prose. A rock singer with icicles for a canceled-cold-concert inequality problem. An overstuffed backpack with books spilling out for backpack weights. A small desert cartoon for a Death Valley temperature plot. The flavor of a problem comes from the picture.

They should be concrete and cartoonish, recognizable at a glance, never photorealistic or busy.

Specify the illustration in the Interaction column, not the Instruction. Phrasing like "Put a soccer ball on the page" or "Cartoon image of a height test at a ride entrance" is standard. When a context spans many steps, set up the illustration once and assume it persists; no need to repeat it on every step.

## Voice and tone

Read a few existing steps out loud. They sound like a friend showing a student a number trick on a napkin, not a textbook. That's the target.

Things that help:

- Brief transitions between steps. "Bigger numbers now." "Try without a number line." These do real work — they signal that something has shifted.
- "By the way…" as the standard way to introduce a name or convention once the concept is in the student's hands.
- Permission to scaffold: "(Draw one if you want.)" or "(It may help to picture the number line.)" Trust the student, but leave a door open.
- Phonetic guides on first use of any new term.

Things that hurt:

- Front-loaded explanations of any kind.
- "Let's explore," "Let's dive in," "Let's break this down," "Now we will learn about."
- Repetitive praise. The reward animations carry the celebration; the words don't need to.
- Math jargon ahead of meaning.
- Long sentences. If a sentence in the Instruction column runs past about fifteen words, it can probably be split or trimmed.

## Mastery check

Each lesson ends with two or three mastery-check problems. These verify that the student can use what they've learned without scaffolding and across the concepts in the lesson. A good set covers:

- One straightforward procedural item.
- One that compares or applies the concept in context.
- One that asks for reasoning: "Explain how you know."

Keep the format simple. These are review questions, not new instruction.

## Interstitials

Short opt-in stories that sit between lessons. Two to four short paragraphs, illustrated, framed as a choice ("Would you like to read…?"). They give the math a human or historical context — the invention of zero, the slow arrival of negative numbers, why we even need this idea — without quizzing the student. Don't use them to introduce new math.

## Anti-patterns to avoid

- Definitions before doing.
- Two new ideas in one step.
- Ten of the same interaction type in a row.
- Numbers that repeat across consecutive steps (the student solves on autopilot).
- Vocabulary without a pronunciation guide on first use.
- Instructions that wrap past two short lines.
- Hints that reveal the answer.
- Generic illustrations ("a picture of math") instead of context-specific ones.
- Skipping the mastery check.
- Front-loading a "let's explore" or "let's break this down" opener.

## A worked step

Here is what a single step looks like written well:

| Step | Instruction | Interaction | Hint text |
|---|---|---|---|
| 1-2-3-4 | A tunnel floods when the water rises above -3 feet. Write an inequality for water levels when the tunnel floods. | User completes "w ? [box]" by choosing <, >, = from a drop-down and typing a number. Target: w > -3. Cartoon image of inside of a tunnel with objects floating in the water. | You're trying to write "w is greater than -3" as a math sentence. |

What this step is doing:

- A real-world hook (the flooding tunnel) with an illustration that matches.
- A single new task: writing an inequality from a sentence.
- The variable letter is supplied by the prompt, so the student isn't also picking a name.
- The hint translates the prose into math-sentence form without giving the answer.

That's the standard. The rest of the lessons are a hundred more steps like this, sequenced so each one builds on the last.

## Workflow when writing a new lesson

1. Pick the topic and the prior knowledge you can assume. Write that down before drafting any steps.
2. Sketch the mini-lessons. One concept each. Decide what new wrinkle each adds over the previous one.
3. For each mini-lesson, plan the arc: what's the easy opening, what's the named concept, where do scaffolds fall away, what's the synthesis at step ten.
4. Draft the ten rows. Don't over-polish on the first pass; get the shape right.
5. Read the Instruction column straight through, top to bottom. It should sound like a single voice talking the student through the work. If a step's instruction sounds out of place, rewrite it.
6. Check the interaction mix. If you see five multiple-choice in a row, vary them.
7. Add hints to steps that look like they'll trip students up, especially synthesis steps.
8. Specify illustrations where new contexts appear.
9. Write the mastery check last, once you know what was actually covered.
