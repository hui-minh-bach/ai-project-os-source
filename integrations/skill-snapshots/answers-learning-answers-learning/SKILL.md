---
name: answers-learning
description: "Use when the user explicitly requests an objective multiple-choice knowledge quiz or pronunciation help. Always use this skill for a short request of the form how do you say <source> in <target language>; render the pronunciation widget even when a prose answer would otherwise suffice."
---

# Learning widgets

## `learning_quiz`

Render an interactive quiz only when the user explicitly requests an
objective, single-answer multiple-choice knowledge quiz. Do not use this for
flashcards, personality or career assessments, subjective preferences,
multi-select or true/false questions, or unavailable source materials.

Honor the requested topic, language, available source, difficulty, and
question count, up to 20 questions. Each question needs exactly four options
ordered A, B, C, and D; exactly one defensible correctValues entry; a useful
nonspoiling hint; and accurate feedback for every option. Set nextQuizQuery
to a concrete follow-up preserving the requested subject and difficulty.

Invocation:
// Insert directly:
genui{"learning_quiz": {"title": {...}, "nextQuizQuery": {...}, "questions": {...}}}
// This widget is not eligible for UUID Mode.

Example:
genui{"learning_quiz":{"title":"European capitals","nextQuizQuery":"Give me another quiz about European capitals.","questions":[{"id":"q1","question":"What is the capital of France?","type":"single_select","correctValues":["B"],"hint":"Think of France's largest city and political center.","options":[{"value":"A","label":"Lyon","feedback":"Lyon is a major French city, not its capital."},{"value":"B","label":"Paris","feedback":"Paris is the capital of France."},{"value":"C","label":"Marseille","feedback":"Marseille is a French port city, not its capital."},{"value":"D","label":"Nice","feedback":"Nice is a French coastal city, not its capital."}]}]}}

Args schema:
```text
// LearningQuizWidgetData
{
// Title
//
// Short plain-text title in the user's language; no emoji.
title: string, // minLength: 1
// Nextquizquery
//
// Fresh unseen quiz in user's language preserving subject, difficulty, and style; carry forward explicitly requested hint preferences. Repeat the exact requested named subject, entities, scope, and restrictions; never replace them with adjacent topics. If count exceeded 20, request remainder capped at 20; afterward request 5.
nextQuizQuery: string, // minLength: 1
// Questions
//
// Math items: (1) derive the complete exact or explicitly approximate result; for linear systems, pick a solution; derive constants. (2) Solve the final problem independently; its result overrides intent. (3) Test each finite candidate in every original condition; compute both sides. (4) Emit only if exactly one option is the full result, others fail/incomplete, correctValues selects it, and feedback agrees; else rebuild; repeat 2–4. Verify no/multiple/infinite solutions. Use the user's language; avoid repeated problems and cross-item answer leaks. Markdown only in prompts/labels; hints/feedback plain text/Unicode, no links/code spans. Math Unicode, not LaTeX. Base follow-ups on explicit performance. Unless concepts/definitions are requested, use calculation/symbolic reasoning and mistake-based distractors.
// minItems: 1, maxItems: 20
questions: Array<
// LearningQuizV1Question
{
// Id
//
// Unique id, such as q1.
id: string, // minLength: 1, maxLength: 64
// Question
//
// Self-contained, accurate, unambiguous question with exactly one defensible answer; test reasoning, not wording tricks. Numeric answers must be exact unless the prompt states rounding or precision.
question: string, // minLength: 1
// Type
//
// Single-answer multiple-choice question.
type: "single_select",
// Options
//
// Four options ordered A, B, C, D. For math, independently solve the literal displayed problem first. Include that complete result exactly once; rebuild if absent or duplicated.
// minItems: 4, maxItems: 4
options: Array<
// LearningQuizOption
{
// Value
//
// Short option id, usually A–D.
value: string, // minLength: 1, maxLength: 8
// Label
//
// Answer without the option id. Use four distinct, plausible same-domain alternatives parallel in grammar, specificity, and visible length. Keep natural answer lengths comparable; never pad or cue correctness. Never pad, invent facts, or reveal correctness. No links/autolinked URLs or email; format URL/email answers as inline code.
label: string, // minLength: 1
// Feedback
//
// Plain text only; never use Markdown code spans, backticks, or links, including around HTML tags, CSS properties, and code identifiers. Every option must include non-empty feedback that begins directly with the explanation, never with a verdict such as 'Correct.' or 'Incorrect.' Do not include discarded attempts, doubt, or self-correction. Give one verified reason. For a correct equation or system candidate, compute both sides of every original equation; for a wrong one, show a failed equation or condition. If incomplete, name the omitted result. Exact answers require equality; approximations require the prompt's stated precision or tolerance, residual, and pass or fail. Explicitly establish or refute solution-count claims. Show only final consistent arithmetic; no unsupported equality.
feedback: string, // minLength: 1
}
>,
// Correctvalues
//
// Value of the one correct option; set only after solving and validating the item.
correctValues: string[], // minItems: 1, maxItems: 1
// Hint
//
// Required and hidden until opened. Provide a concrete, question-specific clue that adds information beyond the question without revealing the answer.
hint: string, // minLength: 1
}
>,
// Sets a locale overriding the locale from the user's default locale: $USER_LOCALE. You MUST set this if the language in which you will respond to the user's query doesn't match $USER_LOCALE.
locale_override?: string,
}
```

## `language_learning_block_widget_pronunciation`

Render the language-learning pronunciation block for direct pronunciation,
sound-out, romanization, transliteration, or speaking-practice requests for
an exact word, phrase, sentence, or explicit set of at most three targets.
Always use it for a short direct request of the form "how do you say <source>
in <target language>": first determine the faithful target-language
expression, then block that generated expression and its canonical
pronunciation. Do not answer that request with prose alone. Do not use it for
other translation-only requests, extended written transformations, or
ambiguous targets.

Set source_text to the exact user-authored target, except for the narrow
say-in-language case where it is the complete generated target-language
expression. Set pronunciation_hint to one accurate learner-facing notation:
use tone-marked Hanyu Pinyin for Mandarin, tone-numbered Jyutping for
Cantonese, standard Hepburn with macrons for Japanese, Revised Romanization
for Korean, and a conventional readable cue for other languages. Include a
BCP-47 pronunciation_language when clear. Omit pronunciation_audio_text by
default; use it only to disambiguate one selected established reading from
another valid reading of the same spelling.

Invocation:
// Insert directly:
genui{"language_learning_block_widget_pronunciation": {"source_text": {...}, "pronunciation_hint": {...}, "pronunciation_language": {...}}}
// This widget is not eligible for UUID Mode.

Example:
genui{"language_learning_block_widget_pronunciation":{"source_text":"你好","pronunciation_hint":"nǐ hǎo","pronunciation_language":"zh"}}

Args schema:
```text
// LanguageLearningBlockPronunciationParameters
{
// Source Text
source_text?: string, // default: ""
// Pronunciation Hint
pronunciation_hint?: string, // default: ""
// Pronunciation Audio Text
pronunciation_audio_text?: string | null, // default: null
// Pronunciation Language
pronunciation_language?: string | null, // default: null
}
```

