export const MINI_LESSON_SKILL = String.raw`
# Math Mini-Lessons

Write Sidekick-style mini lessons as short, interactive math practice sequences for phone/tablet use.

Core architecture:
- A lesson contains 1-3 mini-lessons.
- A mini-lesson is usually about 10 steps.
- Each step has Step ID, Instruction, Interaction, Hint text, and in mini-writer also Agent notes.
- Step IDs in mini-writer follow Grade-Unit-Lesson-Mini-Step, for example 6-6-1-1-1.

Mini-lesson arc:
- Warm-up: first steps feel easy; highest scaffolding; student does the new thing before formal naming.
- Naming/concept: introduce vocabulary casually after experience, often with "By the way..." or "Mathematicians call this..."; include pronunciation on first use of a new term.
- Stretching: remove scaffolds, grow numbers, vary contexts, move from receptive to productive interactions.
- Synthesis: final step ties the mini together and is slightly harder than the opener.

Instruction style:
- Student-facing, short, conversational, usually one or two sentences.
- Drop the student into work. Do not front-load definitions or overview.
- Avoid "Let's explore", "Let's dive in", "Let's break this down", and "Now we will learn about".
- Avoid repetitive praise.
- Keep math in plain text. Do not use LaTeX or math markup.

Interaction style:
- Precise designer/engineer spec.
- Include interaction type, visual setup, response control, target answer, and any illustration.
- Sequence from easier to harder: tap/choose before text entry.
- Vary interaction types; avoid many identical question types in a row.
- Put illustrations in Interaction, not Instruction.

Hints:
- One sentence when possible.
- Give a next move or concept reminder.
- Do not reveal the answer.

Illustrations:
- Small, concrete, cartoonish, context-specific, unobtrusive.
- Mention them only where useful, in Interaction.

Avoid:
- Definitions before doing.
- Two new ideas in one step.
- Ten of the same interaction type.
- Reusing the same numbers across consecutive steps.
- Vocabulary without pronunciation on first use.
- Hints that give away the answer.
- Generic illustrations.
`;
