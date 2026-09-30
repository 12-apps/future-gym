---
name: task-delivery-protocol
description: Any task I ask for — freeze the scope, check docs/adr, pass the run gate on screen, closed-list reviews, PR, merge, final report that PRINTS the screenshots as (e). ANY REGRESSION THE PR INTRODUCES IS BLOCKING; tickets ONLY for a bug found on the way that is not the task and not introduced by the PR
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(protocolo de merge|merge protocol|tarefa|task|implement\w*|corrig\w*|conserta\w*|arrum\w*|ajust\w*|adicion\w*|refator\w*|resolv\w*|bug|feature|fix)\b
trigger_pretool: Bash:git\s+(commit|push),Bash:commit-and-push,Bash:gh\s+pr,mcp__github__create_pull_request:.*,mcp__github__merge_pull_request:.*
trigger_session: false
inject: full
fire_mode: always
---

# Delivery protocol — any task I ask for

> **⛔ ANY REGRESSION THIS PR INTRODUCES IS BLOCKING — FIXED IN THIS PR, NEVER A
> TICKET, NEVER MERGED (§3 RULE ZERO). 🎫 A TICKET IS FOR ONE CASE ONLY: A BUG
> YOU FOUND WHILE WORKING, NOT PART OF YOUR TASK, NOT INTRODUCED BY YOU.**

Reviewed change, no new bugs, finite budget. In order. Named docs: read, don't
restate.

## 0. Scope
The TASK I wrote is the only truth AND the acceptance condition. A ticket is
context — never a replacement, never licence to grow it. Nothing outside it in
the diff. Before code: split the TASK into checkable items, show me the list.
Unclear: ask, don't guess.

## 1. Before
No ticket? Create one, body = the TASK (`docs/TASK-MODEL.md`; search first,
review the draft adversarially — memory `ticket-adversarial-review`). Tests
cover the changed behaviour AND the error paths. Push freely; do NOT open the
PR. Scope freezes here: an outside idea is a follow-up, not a commit.

**Before you file it, ask me what the ticket cannot answer.** Collect the
unknowns and put them to me in ONE batch — not one at a time, and not after the
fact. I am here while you are writing it; once it is filed I am not, and a
question left in the body waits days for an answer I would have given in a
sentence.

Ask about what only a person decides: what the behaviour SHOULD be, which rule
applies, what to charge, which of two readings of the TASK is the real one.
Do NOT ask what you can find out yourself — which roles see a screen, whether a
field accepts a value, what the code does today. Read it or run it; asking me to
be your grep spends the round and annoys us both.

**Write the answers in as decisions, not as a transcript.** "Delivery pays the
taxa de serviço" belongs in the body, as the rule. "I asked and he said yes"
belongs nowhere — the next reader needs the spec, not the conversation.

This is not politeness, it is what keeps the automated passes moving. The daily
reproduction routine settles what the app can SHOW; it cannot settle what
somebody has to DECIDE, and a ticket carrying a product decision nobody made
sits there blocking everything downstream of it.

No answer, or I am not around? File it anyway, with the question under an
`## Open questions` heading, naming what it blocks. That is honest and it is
visible. A ticket that hides an assumption reads as complete and fails review
weeks later; a ticket that names its gap gets unblocked in one reply.

**Defect ticket? Attach the State API payload that reproduces it** as a
`reproduction-state.json` file, linked from a `## Reproduction state` heading —
the upload recipe is in memory `state-api-over-reseed`. A FILE, not a fenced
block in the body: the daily reproduction pass fetches it and POSTs it
byte-for-byte, and one copy cannot drift from a second one pasted inline. You
had the app in that state; the next reader does not, and a payload gets the bug
reproduced where prose gets it guessed at. Cannot express the state through the
API? Say that in the ticket, naming what it depends on — that is a finding, not
a gap to leave silent.

## 1.1 ADR check — before the first edit
`docs/adr/` holds the decisions that are binding until superseded
(`docs/adr/README.md`). Read the set against your §0 list BEFORE you build —
found afterwards, the conflict costs the whole diff.

If a §0 item contradicts an accepted ADR, **STOP and warn me, in those words**:
name the record, quote its Decision line, and say what the TASK asks instead.
Do not build it and flag it later, and do not silently take the ADR's side and
narrow the TASK either — which way it goes is mine to decide, not yours.

**If I approve, the ADR moves in the SAME PR — never a follow-up.** A decision
is never edited in place (`docs/adr/README.md`): write a NEW
`docs/adr/draft-<slug>.md` (H1 `# Draft — <Title>`, its `Lane` and
`Summary` paragraphs, the sections, cited); set the old record's Status to
`Superseded by [draft-<slug>](./draft-<slug>.md)`. Do NOT number it
and do NOT touch the README table — the post-merge job does both (FUT-3073),
and `adr-numbering` refuses a PR that does either. No approval, no code.

No ADR touches your change: say so in one clause and carry on.

## 2. Run gate — mandatory, no attempt limit
Before any review or merge:
- Boot, and show each §0 item on screen end to end — client sends, server
  receives, screen shows it. Half-wired fails. Boot: `verify` skill. A URL I can
  open: `run-server` skill, `docs/RUN-SERVER.md`.
- Drive every control, the save, and the error path.
- **Screenshot as you go, into the scratchpad** — one per §0 item, plus the
  error path and each state that changes what is shown. They are §10(a)'s
  evidence and §10(e) PRINTS them in the final message; see §10. Taking them at
  the end, from memory, means re-booting a stack you have already torn down.
- No new console or server-log error or warning.
- CI green (`docs/ci/TEST-SELECTION.md`, `docs/ci/QUALITY-GATES.md`). Screens
  also pass the six widths in `docs/RESPONSIVE.md` — `viewport-screenshots.mjs`
  fails a width on horizontal overflow.

Error text on screen IS a failure. Never blame geocoder, network or data
without a log line proving it. A runtime error has no round count, no follow-up, and is
never mergeable. Compile + lint + unit is NOT this gate. Every fix reopens it.

## 3. Severity — classify with this first

## ⛔ RULE ZERO — ANY REGRESSION THIS PR INTRODUCES IS BLOCKING. ALWAYS. ⛔

**A REGRESSION INTRODUCED BY THE PR IS NEVER ACCEPTABLE. NOT ONE. NOT A SMALL
ONE. NOT A RARE ONE. NOT "NON-BLOCKING". NOT "A FOLLOW-UP".**

A regression is ANYTHING the diff made worse than `main`: a bug in code the diff
added or changed, a behaviour that worked on `main` and no longer does, a field
or control the diff dropped from a screen, a figure that is now wrong, a state
that can now stale, a refusal that now fires for the wrong reason, a test the
change now needs and does not have. How rare, how cosmetic, how "nobody will
notice" it looks changes NOTHING:

- **It is BLOCKING.** It outranks every severity level below. No label, no
  reviewer's classification, no round cap and no clock downgrades it.
- **It is fixed IN THIS PR, before merge.** Never a ticket. Never a follow-up.
  Never "left by a cap". Never listed in the final report as known.
- **A PR with a known regression DOES NOT MERGE.** If you cannot fix it, that is
  a §6 STOP: do not merge, show me the state.
- **Filing a ticket for a regression you introduced IS THE VIOLATION**, not a way
  of handling it. It hides a defect behind a backlog item and ships it anyway.

Measured 2026-09-28, twice:
- FUT-2248 merged six bugs in its own new code — a troco case refused with a
  false sentence, the pre-discount figure shown while pricing loads, a stale
  seat failing the whole preview, review rows that could stop adding up, an
  orphaned docblock, a low-contrast retry — all filed as "non-blocking"
  tickets (FUT-2936).
- FUT-2940 merged three of its own regressions as "Triage" tickets: the
  delivery card DROPPED the buyer's phone and badge (FUT-2964), the new
  Agendados line showed every day instead of today (FUT-2965), and the new
  migration shipped with no test (FUT-2966).

Both are exactly the failure this rule forbids.

## 🎫 TICKETS ARE FOR ONE CASE — AND ONLY ONE CASE 🎫

**You file a ticket in EXACTLY ONE situation — all three must hold:**

1. **while working, you FOUND a bug** — you tripped over it, you did not set out
   to build it;
2. **it is NOT part of your task** — outside the TASK's §0 list;
3. **it was NOT introduced by you** — it ALREADY EXISTED on `main` before this
   PR.

Miss any one of the three and it is NOT a ticket. Nothing else, ever, becomes a
ticket from this protocol.

"Already existed" is PROVEN, not assumed: reproduce it on `main` (or A/B it
against the old code) and put that evidence in the ticket. If you cannot show it
on `main`, it is not pre-existing — it is yours, and RULE ZERO applies.

NOT a ticket, ever:
- anything in code this diff added or changed → fix it in this PR;
- anything the diff removed, broke or made worse → fix it in this PR;
- a missing test for this diff's behaviour → write it in this PR;
- a review finding (any round, any reviewer, any label) on this diff's code →
  fix it in this PR, or, when it is a taste/wording opinion that is not a bug,
  answer it on the PR;
- a §0 item not delivered → the task is not done; keep working or §6 STOP.

The severity levels below decide what the REVIEW LOOP must stop for; they never
decide whether a bug you introduced may merge. It may not.
- BLOCKING: §0 item missing; breaks feature, build, CI, data, security; blocks
  a flow.
- BLOCKING-UX: the user cannot finish the task, or finishes it wrong.
- BLOCKING-GUIDELINE: violates a named §5.1 item, even if the screen works.
- NON-BLOCKING: the rest — taste, colour, wording, nits, "I'd do it otherwise",
  perf with no measured number.

No literal match above? NON-BLOCKING. Don't stretch.

The ONE ticket case, filed right: a pre-existing bug you tripped over,
proven on `main`, outside the TASK — plus §8's red daily suite and §9's QA
findings, which are by definition not this PR's diff — is a TICKET labelled
`Triage` (a LABEL, not a state), carrying what you measured on `main` and where,
filed BEFORE the final report. Chat is not a backlog: unfiled, it dies with the
session. **A finding in code YOUR diff wrote, or anything your diff made worse,
is NEVER in this list: RULE ZERO fixes it in this PR.**

### 3.1 SEARCH before you file — every time, not just for epics

**A finding you tripped over is, by definition, one somebody else can trip over
too.** The 2026-09-16 sweep closed **42 open `Triage` tickets** out of 349, and
the pattern was the same every time: a pre-existing defect met during an
unrelated run gate, filed fresh by each agent that met it, because this section
says "file it" and said nothing about looking first.

| filed | one defect | what it actually was |
| --- | --- | --- |
| 11× | the implicit `/favicon.ico` 404 | one missing `<link rel="icon">` |
| 11× | `@12-apps/ui` Tabs leaking eight props | one upstream fix + a catalog bump |
| 3× | `pnpm format` reformatting the tree | Prettier had no config |
| 3× | `"Comanda · Mesa Mesa 1"` | one line, filed three times in one day |
| 2× | a silent failed board write | filed twice the same day, from two gates |

Two of those were filed **the same day** by two agents, and FUT-1950 is
byte-for-byte identical to FUT-1951. None of it was carelessness: each ticket is
well measured. The step that was missing is this one.

**So before you file, search — by the ERROR STRING, not by your summary of it.**
The repeats are textually identical where the titles are not: eleven tickets
quote the same bare `Failed to load resource: 404`, eleven more quote the same
eight prop names. A title search finds none of them; a body search finds all.

```bash
q() { curl -sS -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" \
  -d "$(jq -Rn --arg t "$1" '{query:"query($t:String!){ searchIssues(term:$t, first:15){ nodes { identifier title state { name } } } }", variables:{t:$t}}')" \
  | jq -r '.data.searchIssues.nodes[]? | "\(.identifier) [\(.state.name)] \(.title)"'; }

q "Failed to load resource"      # the literal the console printed
q "stickyOffset"                 # the symbol, the prop, the column
q "comanda-header.tsx"           # the file:line you were about to cite
```

Search **both languages** and the product's own vocabulary, per memory
`ticket-adversarial-review` Gate 1 — which applies to EVERY filing, not only to
an epic. Then:

- **An open ticket already says it** → add a comment with what you measured and
  where, and move on. A second ticket is not extra evidence, it is a second
  thing somebody has to close.
- **A `Merged`/`Done` ticket says it** → check the tree before believing either
  side. If the fix is there, the finding is stale and there is nothing to file.
  If it is absent, that is a NEW ticket (a merged one cannot track new work)
  plus a comment on the old one recording what you verified.
- **Nothing says it** → file it, and quote the literal you searched for in the
  body so the next agent's search finds yours.

**Two mechanisms make a ticket go stale with nothing to close it**, and both cost
more than the duplicates:

- **A catalog bump.** A defect in a published `@12-apps/*` package is fixed in
  `shared-packages` and arrives here as a pin move, which touches no ticket.
  Eleven tickets died that way on `@12-apps/ui` 6.27.0 → 6.27.1. If the fix is
  upstream, say so in the body and name the package — the ticket cannot be
  closed by any commit in this repo.
- **A later PR removing the thing.** FUT-2057 read an absent feature as "FUT-1513
  never shipped" when FUT-1696 had deliberately removed it; acting on that would
  have reverted three fixes. An absent fix needs `git log` on the file before it
  is re-filed.

## 4. Adversarial review — 3 rounds max
Round 1 gives the COMPLETE classified list; it is now closed. Rounds 2–3 fix
only its blocking items and verify them. A new finding only for a regression a
fix caused, with the failing test. **Every regression this diff introduces is
BLOCKING and fixed in this PR, whatever label the reviewer gave it (§3 RULE
ZERO).** Only a pre-existing bug proven on `main` becomes a ticket (§3, the ONE
ticket case). Done at zero blocking AND ZERO REGRESSIONS; the 3-round cap never
licenses merging a known regression — hit the cap with one still open and it is
a §6 STOP. Craft: memory `ticket-adversarial-review`.

## 5. UI/UX review — 2 rounds max, same closed list
5.1 Guidelines (blocking). Each finding cites item + file + line:
1. No hardcoded colour — semantic tokens only.
2. No spacing, radius, font-size, shadow outside tokens.
3. Compose the UI library; never reimplement.
4. Responsive by container queries, never media queries.
5. No remote asset — inline SVG or data URI.
6. States: loading, empty, error, disabled, keyboard focus.

Not listed = NON-BLOCKING. Items 1–3 in repo form: `docs/UI.md`.
`@12-apps/ui`'s `components-guidelines.md` is for AUTHORING in that package, not
consuming in an app.

5.2 Fidelity: compare to a real reference — design, screenshot, or the existing
equivalent; cite expected vs got. None: skip, tell me. Under 4px or one
design-system step is NON-BLOCKING.

## 6. STOP — no PR, show me the state
Gate failed 3× on one cause; a fix broke working code; diff grew >50%; the
design must change; a §0 item contradicts an accepted ADR (§1.1). Any of
those, the moment it happens.

**5 rounds or 90 minutes gone is the one CONDITIONAL trigger.** It stops you
only while something is still outstanding — a §0 item undelivered, a review
still open, or CI not green. With all three of those done, finish and merge,
and report the trigger under §10(d).

Why this one is conditional and the others are not: the five above are signals
that the work is going WRONG, and a wrong change should not land at any speed.
The clock is not. It fired on FUT-1767 at 96 minutes with every §0 item
delivered, both reviews closed at zero blocking and CI green — a change whose
only fault was taking a while. A circuit breaker that trips on finished work
teaches you to step past it, which is exactly what happened there, and a
breaker you have learned to step past does not fire on the thing it is for.

## 7. PR and merge
Open only on gate green + both reviews done — ready for review, not draft (the
gate replaces `CLAUDE.md`'s draft phase). A cap never leaves an introduced bug for a
follow-up (§3 rule zero). Stack with `gh stack`, never ad-hoc `--base` — zero check
runs (`docs/ci/PULL-REQUESTS.md`). The review bot comments after
opening and is NOT bound by the closed list: classify with §3, fix blocking,
answer the rest. Merge on gate green + reviews done + CI green + no conflict +
**ZERO KNOWN REGRESSIONS INTRODUCED BY THE PR** + tickets filed ONLY for
pre-existing bugs proven on `main`; no permission needed. **One known
regression, however small, and the PR does not merge — a green CI does not
override it, and neither does "merge when green".** A cap never skips the gate. After
merge stop watching; PR idle >24h: stop, tell me.

## 8. Full suite
Never post-merge. Daily 08:00 BRT, only if `main` merged in 24h (FUT-1501,
`docs/ci/TEST-SELECTION.md`) — no merge, no run, for weeks. On a PR: diff subset
only. Daily suite red: ticket, tell me.

## 9. Ingrid's QA is POST-MERGE
Never a PR or merge gate. After merge keep server + tunnel ready; run when she
asks. Her finding is a new ticket.

## 10. Final report, in this order
a) each §0 item + its screen evidence — the image itself ships under (e);
b) regressions introduced by the PR: MUST read "none" — any other answer means
the PR should not have merged (§3 RULE ZERO); c) tickets filed, each one a
pre-existing bug with its proof from `main` (the ONE ticket case), and every
non-bug opinion answered on the PR instead; d) rounds used per review + any §6 trigger;
**e) MANDATORY — PRINT the screenshots in this message**: every shot §2 took,
attached, captioned with the §0 item it shows;
f) LAST: manual QA steps — how to boot, URL per screen, what to click in order,
expected result per step, error path.

### (e) means the IMAGES, printed — never a description of them

**Send every screenshot the run gate took, in the final handoff, without being
asked.** §2 makes you drive the screen; the images are what that produced, and a
report that only *describes* them hands me your word where I asked for evidence.
I should never have to say "where are the screenshots?".

**(e) is not discharged by the images existing somewhere else.** In the
scratchpad, on the PR, in a QA folder, named in a list — none of those is the
final message, and the final message is where I read the report. The images are
printed there or the task is not delivered, however green the merge was: a
merged PR with no shots in the handoff is an (e) failure, not a finished
delivery. Merging does not close the report lane; printing them does.

Send them with `SendUserFile` (`display: "render"`), captioned with which §0
item each one shows. Send the **artifact** too when the feature produces one — a
PDF, an export, a generated file: that is the thing the user actually gets, and
it is worth more than a picture of the button that made it.

Cover, at minimum: every §0 item's screen, the error path, and any state that
CHANGES what is shown (a fork, a toggle, an empty vs populated list). Two shots
of the same screen with different numbers on it — "3 etiquetas" then "7
etiquetas" — is what proves a rule works; one shot proves it renders.

### Write them OUTSIDE the repo, or cleanup will eat them

Put the drive script and its output in **different** directories: the script
under the repo (module resolution needs it), the PNGs in the scratchpad. Before
committing you will `rm -rf` the scratch directory, and if the images are in it
they are gone — which happened here, after the report had already claimed them
as evidence, so the claim outlived the proof.

    SHOT_DIR=<scratchpad>/shots        # survives the repo cleanup
    scripts/tmp-drive/drive.mjs        # deleted before the commit

Re-running the gate to regenerate them is not free: the container may have
restarted, the PGlite file DB may be locked or half-written (delete and
re-provision), and a freshly seeded store starts with its flags OFF — so a
control that was enabled last time comes back disabled and needs switching on
again before you can reach it.
