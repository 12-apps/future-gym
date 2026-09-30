---
name: multi-agent-task-protocol
description: Multi-agent task? Ask the merge-protocol question, declare a max agent pool, pick haiku/sonnet/opus per task tier
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(protocolo multi.?agente|multi.?agent(e|es|s)?|sub.?agent(e|es|s)?|orquestrador(es)?|agent orchestrat\w*|pool de agentes|agent pool|ultracode)\b
trigger_pretool: Agent:.*,Workflow:.*,mcp__Claude_Code_Remote__create_session:.*
trigger_session: false
inject: full
---

# Multi-agent task protocol

Applies whenever a task is split across more than one agent (Agent tool,
Workflow script, spawned remote sessions). A single agent doing the work
itself needs none of this.

## 0. Ask the user ONE question before spawning

In the same message that declares the pool (§1), ask — via `AskUserQuestion`,
in pt-BR (plain chat when that tool is unavailable), the user answers it:

> **Segue o protocolo de merge do synapsys?** (`task-delivery-protocol` §6–7:
> PR aberto ready-for-review e merge sem pedir permissão quando gate + reviews
> + CI estão verdes e sem conflito)
> - **Sim** — conduzo até o merge, como o protocolo manda.
> - **Não** — paro com o PR aberto (ou antes, se você disser) e te mostro o estado.

- Ask it every multi-agent task; the answer does not carry over to the next one.
- No answer = **Não**: never merge a multi-agent task on an assumed yes.
- For a multi-agent task this answer REPLACES §7's no-permission merge.
- Record the answer in the plan block (§3) so every agent's work is judged
  against it.

## 1. Declare the pool BEFORE the first spawn

State, in chat, before launching anything:

```
Agent pool: max N concurrent / M total
```

- **N** = agents alive at once; **M** = agents over the whole task
  (retries and review rounds count).
- Default when the user gave no number: **N = 3, M = 8**. A user-given number
  always wins.
- Going over M is not silent: stop, say why the budget ran out, ask before
  spawning more.
- Never spawn to "keep busy". An agent must own a distinct, checkable output.

## 2. The orchestrator picks the model per task tier

Pass `model` explicitly on every spawn — never let it default by accident.
Judge the TASK, not the agent type:

| tier | model | typical work |
|---|---|---|
| mechanical | `haiku` | locate files/symbols, grep sweeps, list/collect, reformat, run a command and report its output, summarise a log |
| standard | `sonnet` | implement a well-specified change, write tests for defined behaviour, follow an existing pattern, a routine code review |
| hard | `opus` | architecture/design, ambiguous debugging with no clear root cause, adversarial review of a ticket or spec, security, cross-package or schema/migration changes, anything the user's decision rests on |

Rules:
- When unsure between two tiers, pick the higher one for work whose output is
  trusted without re-checking, the lower one for work the orchestrator will
  verify anyway.
- A haiku/sonnet result that comes back wrong or shallow is re-run ONE tier up,
  not repeated at the same tier (and counts against M).
- The orchestrator itself stays on the session model; it verifies every
  agent's claim against source before acting on it.

## 3. Report the plan in one block

Before spawning, show: pool (N/M), the merge answer (§0), then one line per agent —
`<label> · <model> · <what it returns>`. At the end, report agents actually
used vs. M.
