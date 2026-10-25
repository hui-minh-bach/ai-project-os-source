---
name: project-continuity-orchestrator
description: Carry an authorized software or visual-production project through planning, implementation, real-output review, repair, verification, and a complete handoff. Use when the user asks to continue to completion, avoid repeated approval prompts, preserve an agreed reference, finish a source package, or resume an interrupted project. Maintain a file-backed checkpoint and distinguish actual results from concepts and untested claims. Includes a four-stage Idea Studio 3D workflow. Does not provide background execution, extend platform limits, install tools, or grant additional permissions.
---
# Project Continuity Orchestrator

## Establish the contract
- Read the actual attached source and the latest checkpoint before changing anything. Prefer the current attachment over older Library copies.
- Record the authorized goal, inputs, protected behavior, deliverables, and acceptance gates in `.project-state/contract.md`.
- Reuse answers already in the conversation. Proceed with reversible, explicit assumptions when an ambiguity is non-critical. Ask only for genuinely missing authorization, secrets, destructive actions, or an essential unresolvable requirement.
- Inspect available tools. Never claim a connector, renderer, external worker, deployment, or persistent installation exists without evidence.
- Preserve the original source; work in a new copy or branch. Do not include user data, API keys, tokens, private logs, or unrelated build caches in deliverables.

## Execute through the authorized stages
1. Specify: freeze the design reference, layout, constraints, and measurable checks.
2. Build and inspect: create actual assets and render the implementation. Compare real output with the target, not one generated concept with another.
3. Demonstrate and repair: make the requested video from the same scene/assets/controller used in the application. Inspect contact points, motion phases, and frame samples. Fix obvious defects before packaging.
4. Integrate and verify: integrate into the real source, run relevant tests and actual interaction checks, package a complete source deliverable, and write an accurate handoff.
- Continue automatically between these already-authorized stages in the active turn; do not finish with only a plan or ask permission to do the next ordinary step.
- Keep short progress messages focused on observable results or blockers. Do not announce that work will continue after the response ends.
- For Idea Studio, read `references/idea-studio.md` before building or evaluating a 3D scene.

## Keep recoverable state
- Use `scripts/checkpoint.py` to initialize and update `.project-state/state.json`.
- Keep the next concrete action, remaining defects, and evidence paths current after meaningful changes. Record hashes for evidence files.
- Treat checkpoints as records, not certification. A hash proves file identity, not visual or functional correctness.
- On resumption, verify evidence exists and still matches, then continue from the next unfinished task. Do not recreate an already-approved plan.
- Never rely on the chat's memory as the sole record. Do not put secrets into checkpoints.

## Gate claims on evidence
- Separate static checks, unit tests, browser runtime tests, visual inspection, and actual Windows/device testing.
- Never treat a passing source-string test as proof of a working visual interaction.
- Label generated concepts, offline renders, browser captures, and installed-application recordings accurately.
- Mark unperformed checks `not_tested`; mark unmet acceptance criteria `open`. Do not replace a failed criterion with weaker wording.
- Do not call self-review an independent reviewer. Do not invent worker agents or parallel tasks.
- Compare screenshot dimensions, paths, version identifiers, scene bounds, and actual animation states, not only file names.

## Recover and stop safely
- Investigate an error, change one relevant cause, and retry. After three repetitions of the same failure, change approach or record a concrete blocker instead of looping forever.
- Stay within permission, cost, time, compute, safety, and platform limits. Do not bypass safeguards or enable paid services, scheduled jobs, public publishing, or external writes without authorization.
- Stop on completed authorized scope, an actual execution limit, unsafe action, or a genuinely blocking missing dependency. Deliver all valid artifacts and the exact remaining issue rather than claiming completion.
- A skill cannot make ChatGPT run indefinitely or restart a finished turn. Do not promise background execution or automatic future completion.

## Deliver
- Verify archive integrity and all linked paths. Include one complete source ZIP unless the user specifically asks for a patch.
- Include this skill under `.agents/skills/project-continuity-orchestrator/` in the project and reference it from project instructions without destroying existing instructions.
- Distinguish project-local inclusion and applying this workflow now from installation into the user's ChatGPT account. Claim account installation only after a verified supported installation action.
- Report actual deliverables, the most important observed checks, known limits, and the shortest launch instruction in the user's language.
