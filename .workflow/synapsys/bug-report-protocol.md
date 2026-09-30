---
name: bug-report-protocol
description: Bug report? Reproduce it, search Linear, file or update the ticket, classify sev1-3, add regression tests, then deliver via task-delivery-protocol
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(protocolo de bug|bug report|reproduz\w*|regress\w*|severidade|severity|investig\w+ o problema|sev[123])\b
trigger_pretool: Bash:api\.linear\.app.*(issueCreate|commentCreate)
trigger_session: false
inject: full
---

# Bug protocol — "leia e investigue o problema"

When I hand you a bug report, do these steps in order. Each one ends in something you can point to.

1. **Reproduce it, and say HOW you did it.** A live reproduction beats a code trace:
   use the `verify` skill and set state through the State API (never reseed).
   If you only traced the code, say so plainly: "reproduced by code trace; the
   numbers match to the cent". Never write "reproduced" for a code trace.
   Check the report's own claims as well. Reports get the mechanism wrong
   (e.g. "the server accepted an overpayment" when an open leg quietly
   absorbed the difference). Correct those in the ticket.

2. **Search Linear before filing.** Search in pt-BR AND English, in the
   product's own words, and on the literal error or copy text (see memory
   `ticket-adversarial-review`). For each ticket you find, check that its
   premises still hold ("unreachable in practice", "nobody is overcharged").
   A stale premise is exactly what kept the bug at low priority.

3. **Ticket.**
   - Found one → add a comment with the evidence: the store, the figures, the
     `file:line` of the cause, what changed since it was filed, and a new
     severity. Do not open a duplicate.
   - None → create it with labels `Bug` + `sevN` + `repro-checked` (the last
     only if you reproduced it live). Review the draft adversarially first.

4. **Severity** (Linear labels `sev1`/`sev2`/`sev3`, one per ticket):
   - **sev1**: wrong money charged or recorded, data loss or corruption,
     security, or an outage of a core flow. Linear priority Urgent/High.
   - **sev2**: a flow broken or misleading, but a workaround exists; or a
     wrong figure on screen that nobody acts on. Priority Medium.
   - **sev3**: cosmetic, copy, or layout. Priority Low.
   State the severity and the one-line reason it gets that rating.

5. **Regression tests.** Write tests that FAIL on today's code and PASS after
   the fix. Show both runs. Put them where the bug lives: integration
   (PGlite, `docs/INTEGRATION.md`) for server behaviour, and a unit test for
   what the screen shows. Cover the error paths too. In tripwire suites, ADD
   cases; never edit an existing assertion.

6. **Deliver** through `task-delivery-protocol`, which is the merge protocol:
   frozen scope, run gate on screen, reviews, PR, merge, final report.
   Commits and PR are in English with the ticket ref.
