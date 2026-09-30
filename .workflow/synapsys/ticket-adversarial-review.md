---
name: ticket-adversarial-review
description: A ticket is not done until an adversarial reviewer returns VERDICT: OK — and search for an existing epic before opening one.
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(creat|writ|draft|open|rais|file|abrir|criar|escrev)\w*\s+(a|an|the|um|uma|another|new)?\s*(new\s+)?(ticket|issue|epic|épico|sub-?epic)\b|\bticket (for|to support|para)\b|\b(epic|épico) for\b
trigger_pretool: Bash:api\.linear\.app,Bash:issueCreate,Bash:gh\s+issue\s+create,mcp__github__issue_write:.
trigger_session: false
inject: full
enforce: suggest
---

### A ticket is not finished when you finish writing it

Two gates stand between an idea and a created issue. Both are cheap. Skipping
the first produces a duplicate epic; skipping the second produces a spec an
implementer cannot build from, which is discovered months later by the person
holding it.

### Gate 1 — search before you create

**Never open a ticket of any size without checking that one already exists.**
This gate used to say "epic", and the narrower reading is what let the backlog
take 42 duplicates before the 2026-09-16 sweep — every one of them a small
run-gate finding, which is exactly the shape that read as exempt. A `Triage` nit
filed eleven times costs more to clear than one duplicated epic. Sizes do not
differ here; see `task-delivery-protocol` §3.1 for the search that goes with a
finding you tripped over.

Search Linear for the concept in BOTH languages and in the vocabulary the
product actually uses, not just the English noun you have in your head — and, for
a defect, for the literal error string as well, since two reports of one defect
agree on the console output long before they agree on a title:

```bash
for term in taxa fee gorjeta serviço parcel installment couvert; do
  curl -sS -X POST https://api.linear.app/graphql \
    -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" \
    -d "$(jq -Rn --arg q "query { searchIssues(term: \"$term\", first: 12) { nodes { identifier title state { name } } } }" '{query:$q}')" \
    | jq -r '.data.searchIssues.nodes[]? | "\(.identifier) [\(.state.name)] \(.title)"'
done
```

Then decide deliberately where it hangs: a **sub-epic** under an existing epic,
or a **new epic**. Say which and why in the ticket's opening lines — "filing
this under payments is what makes the next ticket wanting this row invent its
own column again" is an argument; "new epic" alone is not.

**A `Merged` ticket is not evidence the code shipped.** Twice in one session a
ticket marked Merged had half its scope missing from the tree. Before building
on a ticket's claims, grep for the columns, tables or files it says it
delivered. When they are absent, that is a NEW issue (a merged ticket cannot
track new work), plus a comment on the old one recording what you verified.

### Gate 2 — adversarial review until it passes

Write the ticket to a scratchpad file first. Then spawn a subagent whose job is
to find what is WRONG with it, not to praise it. Give it:

- the ticket path, the repo path, and where packages are installed;
- **the findings already fixed in earlier rounds**, with "do not re-report
  these" — otherwise round N repeats round N-1;
- a rule that every claim needs a `file:line` citation, and that it must verify
  a sample of the TICKET's own citations (a ticket citing a line that says
  something else is a real defect);
- an explicit anti-sycophancy clause: *"Do NOT invent blocking findings to
  appear rigorous. A clean verdict is a legitimate outcome."* Without it a
  reviewer manufactures findings to look useful;
- a fixed output shape: one line `VERDICT: OK` or `VERDICT: NOT OK`, then
  `## BLOCKING`, then `## NON-BLOCKING`.

**Verify each finding against source yourself before acting on it.** Reviewers
are wrong often enough to matter, and two rounds have contradicted each other
outright. A finding you cannot reproduce in the tree is not a finding.

**The loop ends when the reviewer returns `VERDICT: OK` with zero blocking
findings** — not when the findings get small, and not when you get tired. Apply
the non-blocking ones too if they are cheap; they are usually right.

**Expect the loop to catch YOUR corrections, not just your draft.** Rounds 5, 6
and 7 of one ticket each found a defect introduced by the previous round's fix:
a false premise, a broken sequence, a flag that could not express the rule it
was given. That is the loop working, and it is the reason a single review round
is not enough.

### Only then create it

Match the house conventions — read a sibling issue first rather than guessing:
sub-epics carry the `Epic` label and a parent; children carry `Story` plus a
`task:*` label. Package-scoped tickets open by naming their repo. Everything a
developer reads is English, per `CLAUDE.md`.

Give each child a body it can be implemented from standalone, then link the
epic's breakdown table to the real identifiers once they exist.
