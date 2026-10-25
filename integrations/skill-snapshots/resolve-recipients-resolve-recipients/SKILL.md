---
name: resolve-recipients
description: Resolve and verify the correct people before sending Slack messages, emails, invitations, meeting requests, calendar events, or other person-directed actions. Use whenever a request names, implies, or describes one or more recipients, especially with first names, duplicate names, nicknames, project groups, phrases such as “everyone,” or ambiguous references such as “the one I work with.” Search relevant communication and calendar history, compare candidate identities, and ask for clarification instead of silently guessing.
---

# Resolve Recipients

Treat recipient selection as a required preflight step before drafting or performing a person-directed action. Optimize for avoiding the wrong recipient, not for avoiding a clarification question.

## Resolve before acting

1. Parse the request into:
   - requested action and surface;
   - every named or implied recipient;
   - topic, project, team, company, timeframe, and relationship clues;
   - whether the request means specific people, a project group, or an exhaustive audience.
2. Preserve the user's exact names and relationship terms in searches. Do not broaden a specific name into a generic people search.
3. Build a candidate set for each person from the most relevant connected sources.
4. Gather enough evidence to distinguish candidates. Do not stop at the first name match.
5. Resolve people individually, then verify that the proposed recipients make sense as a group.
6. Decide whether confidence supports proceeding or requires clarification.
7. Only after resolution, continue with the applicable Slack, Gmail, or Calendar workflow and its write-confirmation rules.

## Search the evidence

Use available sources in an order suited to the request. Search multiple sources when one source leaves plausible ambiguity.

- **Slack:** people/profile results, exact-name matches, DMs with the user, shared channels, recent threads, mentions, topic participation, channel membership, and prior messages involving the other named recipients.
- **Email:** exact correspondents, addresses, recent threads, thread participants, signatures, domains, and messages about the named project or topic.
- **Calendar:** prior meetings with similar titles or project terms, organizers, recurring attendee groups, recent events, and linked notes or attachments.
- **Personal context:** established relationships, known coworkers, aliases, prior choices, and corrections. Treat a previous correction such as “not that Preston” as strong negative evidence.
- **Other authoritative project sources:** current project rosters, ownership records, or linked documents when available.

Prefer direct evidence over inference. Match a Slack identity to an email or calendar identity only through a reliable anchor such as an exact work email, profile field, full name plus company/team, or explicit cross-reference. Do not merge people merely because their names resemble each other.

## Rank candidates

Evaluate evidence holistically. The strongest signals are:

1. Exact identity anchors supplied by the user, such as full name, email, handle, team, company, title, or location.
2. Direct history between the user and candidate on the requested surface.
3. Participation in recent conversations, meetings, or threads about the stated topic or project.
4. Interaction with the other people named in the same request.
5. Recency and frequency of relevant interaction.

Use raw frequency only as supporting evidence. A frequently contacted person with the same first name can still be wrong when project or group context points elsewhere.

For several named people, score the combination as well as each individual. Prefer the set that has shared project, channel, thread, or meeting evidence. Never choose “the two closest coworkers” when the two names independently point to a different coherent pair.

## Apply confidence gates

Proceed without a recipient clarification only when one candidate per person is clearly supported and no plausible rival has comparably strong evidence.

Ask before acting when any of these applies:

- two or more plausible candidates remain for a name;
- the leading candidate is based mainly on name similarity or general contact frequency;
- sources conflict about identity;
- a candidate is clear individually but does not fit the other named recipients or project context;
- cross-surface identity mapping is unverified;
- “everyone,” “the team,” or a project label does not identify a current, bounded audience;
- the recipient set would materially expand beyond people the user explicitly named.

Do not use unsupported numeric confidence as a substitute for judgment. If the evidence would be difficult to explain in one short sentence, clarification is usually safer.

## Ask a useful clarification

Keep the question concise and distinguish candidates with the best available disambiguators:

> Which Preston do you mean: Preston W. from the Personal Wiki Slack threads, or Preston M. from the platform team?

When several recipients are uncertain, present the likely set together instead of making the user answer a long sequence of questions:

> I found two plausible groups. Do you mean Roger K. + Preston W. from the Personal Wiki project, or Roger L. + Preston M. from the platform channel?

Do not expose private or irrelevant details. Use work-relevant identifiers only. Do not send, schedule, or create drafts addressed to a guessed identity while waiting for clarification.

## Resolve project and group requests

For requests such as “schedule everyone on the project” or “email the team”:

1. Search recent project-specific calendar events, Slack channels and threads, and email threads.
2. Prefer current, repeated participation over one-off historical inclusion.
3. Distinguish core participants, optional stakeholders, observers, bots, mailing lists, and former participants.
4. Use the narrowest defensible recipient set. Do not equate channel membership with required attendance.
5. If no authoritative roster exists, show the proposed names and the evidence basis, then ask for confirmation before creating the event or sending the message.

For replies or follow-ups, prefer the latest relevant thread's active human participants, adjusted for explicit additions or exclusions in the user's request. Do not automatically copy every historical recipient.

## Preserve the decision

After the user disambiguates a person, use that resolved identity for the current action. When an available memory mechanism supports it, save only a durable and appropriate mapping such as “When Suje says Preston in the Personal Wiki context, they mean Preston W.” Include the context boundary; do not turn a project-specific choice into a universal alias.

## Examples

- **“Send Roger and Preston a ‘yo’ on Slack.”** Search both names, inspect the user's DM history, then check which Roger–Preston pair shares recent threads or channels with the user. Ask if two coherent pairs remain.
- **“Email Austin the deck.”** Prefer the Austin connected to the deck's project and recent related threads, not simply the most frequently emailed Austin.
- **“Schedule a catch-up with everyone working on Personal Wiki.”** Inspect recent project meetings, relevant Slack participation, and the latest email/docs context. Propose a bounded attendee list for confirmation if membership is not explicit.
- **“Message the one I work with.”** Use relationship and work-context evidence. If that phrase still matches multiple people, ask.

