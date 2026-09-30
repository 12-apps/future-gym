# Synapsys memories — future-gym (local)

One memory per file. Frontmatter declares triggers + lifecycle events.
Example schema (single-line values only — no nested YAML):

```
---
name: example
description: one-line summary
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(jira|ticket)\b
trigger_pretool: Bash:git push,Bash:rm -rf
trigger_session: false
inject: summary
---

Body of the memory…
```
