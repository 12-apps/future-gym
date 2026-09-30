---
name: doppler-is-where-the-secrets-are
description: A secret or git identity is missing from env? Load it from Doppler with DOPPLER_SERVICE_TOKEN — never ask, never claim no access
events: SessionStart,UserPromptSubmit,PreToolUse
trigger_prompt: \b(doppler|linear_api_key|node_auth_token|npm_token|git_author_(name|email)|git identity|identidade|credenciais?|credentials?|env vars?|vari[aá]ve(l|is) de ambiente|token do npm|linear)\b
trigger_pretool: Bash:api\.linear\.app,Bash:pnpm\s+install,Bash:commit-and-push,Bash:\bdoppler\b,Bash:git\s+config\s+(--global\s+)?user\.
trigger_session: false
inject: full
---

# The secrets are in DOPPLER. Load them. Do not ask, do not say "not available".

`LINEAR_API_KEY`, `NODE_AUTH_TOKEN` (npm, for the restricted `@12-apps/*`
packages like `@12-apps/state-api`), `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` /
`GIT_COMMITTER_*` and the rest of the agents' config live in Doppler
(`future-pay-agents/dev`). The container only carries `DOPPLER_SERVICE_TOKEN`.

**Why they are missing here:** future-gym has no session-start hook that
exports them (future-pay's `.claude/hooks/session-start.sh` does, and only for
sessions that start inside that repo). So in this repo they start empty, and
the loader below is the only way in. On 2026-09-24 skipping it cost future-pay
a Linear 401, an npm 404 on a restricted `@12-apps/*` package, and a commit
guard refusing the container's tool identity.

**So, the moment any of them reads empty, run this once** (it is the hook's own
logic; values never printed):

```bash
ENVF=<scratchpad>/doppler.env; : > $ENVF; chmod 600 $ENVF
json="$(DOPPLER_TOKEN="$DOPPLER_SERVICE_TOKEN" doppler secrets download --no-file --format json)"
jq -r 'keys[]' <<<"$json" | while IFS= read -r n; do
  [[ "$n" =~ ^[A-Za-z_][A-Za-z0-9_]*$ && "$n" != DOPPLER_* ]] || continue
  [ -n "${!n:-}" ] && continue
  printf 'export %s=%q\n' "$n" "$(jq -r --arg k "$n" '.[$k]' <<<"$json")" >> $ENVF
done
```

Shell state does not persist between Bash calls: prefix EVERY command that
needs a secret with `. <scratchpad>/doppler.env;` — commits through the guard
script (the Doppler `GIT_AUTHOR_*` is the identity to commit as), Linear calls,
`pnpm install` (with `NPM_CONFIG_USERCONFIG="$PWD/.npmrc"`).

Rules:
- Never tell the user a credential is missing before running the above.
- Never invent a git identity from `git log` or ask for one — Doppler has it.
- Print lengths, never values.
- If the permission classifier blocks a step, say which step and stop; do not
  route around it.
