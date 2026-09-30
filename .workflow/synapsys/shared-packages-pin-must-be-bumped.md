---
name: shared-packages-pin-must-be-bumped
description: Merging in shared-packages does NOT ship it — the app pins exact @12-apps versions and nothing bumps them for you
events: UserPromptSubmit,PreToolUse
trigger_prompt: (@12-apps/|\b(shared[- ]packages|bump|renovate|dependabot|pin(ned|ning)?|dependenc(y|ies)|npm version|publish(ed|ing)?|out of date|desatualizad[oa]|versão do pacote)\b)
trigger_pretool: Edit:"file_path":"[^"]*package\.json,Write:"file_path":"[^"]*package\.json,Edit:"file_path":"[^"]*pnpm-lock\.yaml,Write:"file_path":"[^"]*pnpm-lock\.yaml
trigger_session: false
inject: full
---

### Merged in `shared-packages` ≠ shipped in `future-pay`

The two repos are separate. `12-apps/shared-packages` publishes to npm; `future-pay`
consumes those packages at **exact pinned versions**:

```jsonc
// apps/web/package.json — note: no caret
"@12-apps/payments-backend": "1.6.0",
```

So a merged PR in shared-packages changes **nothing** here until someone edits
`package.json` and refreshes `pnpm-lock.yaml`. `pnpm update` will not do it — the pin is
exact. There is **no Renovate and no Dependabot** in this repo (FUT-759 tracks that).

### This has already cost a whole epic

FUT-573's audit found **ten leaves marked Merged whose behaviour never reached a user.**
Nine PRs landed in shared-packages on 2026-08-08 and published as `payments-backend`
1.15.2 → 1.18.0. `future-pay` was pinned at **1.6.0**, frozen the day before by
`chore(deps): pin every @12-apps package to its current latest (#778)`.

Live in production the whole time, with the fix sitting unreachable on npm:

- every refund reported `REFUNDED` without reading the response (FUT-680)
- Connect stores' webhooks rejected *before* the durable inbox — no row, no replay, no
  trace (FUT-678)
- a refused OAuth grant left in the provider chain, so a PagBank-only store failed every
  checkout (FUT-683)
- a paid PIX never updating its `payment_charges` row (FUT-681)

The tests were green in both repos. Nothing was broken — it just was not connected.

### Check it before you claim a package fix is done

```bash
npm view @12-apps/payments-backend version          # what is published
grep -rn '"@12-apps/' apps/*/package.json           # what we actually run
```

If those differ and your fix is above the pin, **the ticket is not done** — say so, and
open or reference the bump.

### Writing a fix that lands in the package

Two halves, and they ship on different clocks. If the host half needs a package export
that is not in the pinned version yet, do NOT paper over it with a seam that no-ops in
production. FUT-477 did exactly that:

```ts
// apps/web/lib/payments/pagbank-legacy.ts
const PACKAGED_LEGACY_RESOLVER: LegacyNotificationResolver | null = null;
```

Detection and fan-out were live and unit-tested against an injected resolver, so the suite
passed — while in production every legacy webhook was recognised, logged and dropped. The
ticket moved to Merged with a third of its acceptance met.

If you must land the halves separately, the seam needs a ticket that flips it, not just a
comment. Better: bump first, then write the host half against the real export.

### And when you do bump

A multi-version jump across `@12-apps/payments-*` is a **migration, not a number edit** —
1.6.0 → 1.18.0 moved `core/types.ts`, `core/ports.ts`, `core/provider.ts`,
`http/router.ts`, `index.ts`, `config/service.ts` and both prisma stores. Budget for host
type churn in all three apps, and use a **static** import when wiring a new subpath: the
package publishes TypeScript source (`exports` maps to `src/*.ts`), so a non-literal
dynamic `import()` passes vitest and then crashes the bundled server on raw `.ts`.
