---
name: gate-scope-list-before-first-edit
description: The session's first edit is blocked until the TASK has been split into checkable items and shown to the user
events: PreToolUse
trigger_pretool: Edit:,Write:,MultiEdit:,NotebookEdit:,apply_patch:
trigger_session: false
inject: full
enforce: block
enforce_classifier: first-edit-of-session
enforce_satisfied_by: (TodoWrite|TaskCreate|ExitPlanMode|AskUserQuestion)
fire_mode: always
---

### Show the checkable-item list BEFORE the first edit

`task-delivery-protocol` §0: the TASK the user wrote is the only truth and the
acceptance condition. Splitting it into checkable items is not paperwork — it is
what makes "done" verifiable and what stops the scope drifting into a different
job than the one asked for. Done after the first edit, it describes what you
already built instead of deciding what to build.

**So do this now, before editing:**

1. Read the TASK again and enumerate every distinct thing it asks for.
2. Anything genuinely ambiguous: ask, do not guess.
3. Show the user the list — that list is what the final report's section (a) is
   checked against, one line of evidence per item.

**How this gate clears.** It clears itself once a tool matching
`TodoWrite|TaskCreate|ExitPlanMode|AskUserQuestion` has run this session — put
the items in the task list, or exit plan mode with them, or ask the user your
question. It is a FIRST-edit gate: it stops exactly one call, and every edit
after that passes whether this one was allowed or blocked. So treat it as the
prompt it is, not as a wall that will keep asking.

**When the edit is not task work** — a scratchpad file, a throwaway probe — the
per-call escape is to re-issue the same call with this marker in its input:

```
# synapsys:override=gate-scope-list-before-first-edit reason="<10+ chars>"
```

A reason under 10 characters keeps the block. Overrides are per-call and
logged; using one to skip the list on real task work is the failure this gate
exists to prevent.
