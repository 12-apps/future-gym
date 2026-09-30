---
name: port-means-plug-and-play-package
description: Port to shared-packages = createApi*/createWeb* factories AND an app-agnostic package — the app's catalogs stay in the host and never count against the 300 LOC rule of thumb
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(port (it|this|that|the)|porting|ported|extract (it|this|that|the)|shared[- ]packages|plug.?and.?play|portar|extrair|app(lication)?[- ]agnostic|agn[óo]stic[oa]?|(into|to|as) an? \w* ?(package|lib|library))\b
trigger_pretool: Write:"file_path":"[^"]*packages/,Edit:"file_path":"[^"]*packages/,Write:"file_path":"[^"]*harness/,Edit:"file_path":"[^"]*harness/
trigger_session: false
inject: full
---

### "Port it" / "extract it to shared-packages" means ONE thing

A package with **both halves**, each exposing a **single factory that takes a
config object** — literal plug-and-play, droppable into any host:

```ts
const { routes } = createApiFoo({ /* config */ });   // backend
const { page }   = createWebFoo({ /* config */ });   // frontend
```

Name them after the lib (`createApiReportBuilder` / `createWebReportBuilder`).
One export per half. No second thing to wire.

### What goes INSIDE the package

Screens, flows, cards, presentations, and **the routes between them** (route
order is a rule of the surface, not of the host). Endpoints, request parsing,
status codes, the response envelope, visibility rules, zod/wire schemas.
Prisma models, migrations and seeds. If two hosts would both need it, it is
the package's.

### What stays in the HOST

Config, and nothing else — but read the next section before deciding what
counts as config, because it is more than this list:

- **who is calling** — auth, tenant resolution, RBAC (pass the resolved actor
  and its permission ids in; the package narrows against them, it does not
  compute them)
- **where the data lives** — the DB client through a structural seam, and an
  adapter factory when reads are window/tenant-scoped
- **billing** — entitlements and quota, answered before delegating
- **the app's own CATALOGS and VOCABULARIES** — the permission list, the role
  matrix, the feature keys, the plan tiers, the pt-BR label maps. These are
  what the host CONFIGURES the package with. See below.

### The failure mode to check for

"Thin wrapper" is not the target — **declaration** is. If a host file still
does parsing, threads params, maps a response, or repeats the same four
mechanical steps per endpoint, the port is NOT done. It should read:

```ts
export const DELETE = fooEndpoint({
  route: "DELETE /foo/:id",
  guard: (slug) => requireTenantAdminBySlug(slug),
  params: fooParams,
});
```

Host files may only survive when a repo gate forces them to exist (e.g. a
coverage gate mapping each advertised tool back to a route file). Then keep
the file, but keep NOTHING in it beyond the per-endpoint decisions — and say
in a comment which gate forces it, so nobody re-inflates it later.

### The bar is a number: ~300 LOC

**More than ~300 non-test LOC of a domain in this repo means the port is
wrong.** Not a style preference — the acceptance test. Count the host's
non-test source for that domain; if it needs a paragraph of justification,
it failed.

The rule is **provider- and vendor-agnostic**. A second provider (Stripe,
Mercado Pago, Asaas…) or a second vendor of anything else lands in the
package behind the same mount and adds **zero** host logic — a config entry
only. If adding one means writing host code, the seam is in the wrong place.

Payments is the worked example of getting this wrong: 12,474 LOC across
`apps/web/lib/payments`, `apps/web/lib/billing` and the admin/client
screens, against a 300 budget — ~42x. FUT-760 tracks the burn-down. The
shape was already there and simply not applied: `mountPayments<Auth>({…})`
(FUT-559) does exactly this for one subtree.

Watch for logic placed by **tooling convenience** rather than design —
`pagbank-reasons.ts` parses a provider's `error_messages` in the host, and
says so in its own docstring, because the package-side file was
grandfathered in `.quality-exceptions`. A gate working around itself is not
an architecture decision.

### …and 300 is a RULE OF THUMB with one hard exception

The number measures **domain logic**, not everything in the folder. It is the
answer to "is the mechanism still here?" — not to "how few lines can this
directory have?".

**CONFIGURATION IS NOT DOMAIN LOC. It never counts, and it never moves.**

A host's config can be a thousand lines and the port is still correct. If you
find yourself moving a catalog into a package *to make a budget go down*, stop:
you are trading the thing the rule protects for the number that measures it.
`apps/web/lib/entitlements/features.ts` is 365 lines of pure catalog living in
the host, and that is the port done RIGHT.

Three questions settle it, in order:

1. **Would a second product ship this file unchanged?** No → it is the host's.
2. **Does the package need it to be a package, or to be configured?** Configured
   → it is the host's, and it is passed in.
3. **Does the package's own name/README have to mention this product?** Yes →
   it is the host's, and something has already gone wrong.

### This is NOT an argument for thinner packages

Read the two rules together or you will over-correct. **Screens and endpoints
BELONG in the package** — that is the whole point of one, and the section at the
top of this file stands unchanged. A package shipping a roles screen, a team
roster, a checkout flow and their routes is a package doing its job.

The dividing line is not *how much* is in the package, it is *what kind*:

| belongs in the PACKAGE | belongs in the HOST |
| --- | --- |
| screens, flows, components | the app's catalogs and vocabularies |
| endpoints, routes, wire schemas | the values that configure them |
| the mechanism | the identity — names, brand, copy |

A screen is reusable when its **configuration object is well defined**: give it
labels, permission ids and catalogs as config and any product can mount it. The
same screen with the labels baked in is reusable by exactly one product. So the
fix for a packaged screen holding pt-BR copy is **never** "move the screen back"
— it is "take the copy as config".

### Application-agnostic is the harder bar, and it beats the number

A shared package **must not know which product it serves**. Not in its exports,
not in its defaults, not in its docstrings, not in a language its strings are
written in. This bar OUTRANKS the LOC bar: a host over budget is a burn-down
ticket, a package that knows the app is a design error that spreads.

The one-command check, run against `node_modules/@12-apps/<pkg>/src`:

```bash
grep -rniE "future[_ -]?pay|paladira" node_modules/@12-apps/<pkg>/src   # must be EMPTY
```

Anything it prints is host material. Additional smells, all disqualifying:

- an export named after the product (`FUTURE_PAY_PERMISSIONS`,
  `DEFAULT_ROLE_TEMPLATES`, `FUTURE_PAY_RBAC_GUARDS`)
- **product copy in the package** — a pt-BR label map is by definition
  app-specific; the package must take labels, never carry them
- **the app's data as a default** — `config.permissions ?? FUTURE_PAY_PERMISSIONS`
  is worse than requiring it. A required arg makes a new host fail loudly; a
  default makes it silently adopt another product's vocabulary
- the host's own function names hardcoded in a packaged gate

**Never a default. Always a required argument.** That is the whole difference
between a package that is agnostic and one that merely looks it.

### `@12-apps/rbac` was the worked example of getting THIS wrong — now FIXED

Same mistake as payments, inverted: payments left the domain in the host, rbac
pushed the *app's data* into the package to shrink the host. ~600 lines of
Future Pay lived inside a package presented as generic —
`FUTURE_PAY_PERMISSIONS` (61 permission ids), `DEFAULT_ROLE_TEMPLATES` (8
roles), `FUTURE_PAY_GOVERNANCE`, `FUTURE_PAY_SOD_PAIRS`, the pt-BR label maps in
`react/labels.ts`, and `FUTURE_PAY_RBAC_GUARDS` — a list of *this repo's* guard
function names, inside a packaged coverage gate.

The package's own files said so: `permissions.ts` opened with "THE FUTURE PAY
PERMISSION CATALOG — application DATA, not generic core", and `templates.ts`
with "a different host would define its own and never import this file." The
comments were right and the file placement was wrong; nobody reconciled them.

**`@12-apps/rbac@3.0.0` reconciled them, and it is the reference for how.** The
package now declares only the three permissions guarding its OWN screens and
endpoints (`RBAC_PERMISSIONS`) and ships no application catalog at all. The
host assembles the rest:

```ts
export const CATALOG = composePermissions(
  FUTURE_PAY_PERMISSIONS,   // this app's domain, in packages/rbac-catalog
  RBAC_PERMISSIONS,         // the package's own surface
).withRoles({ roles, ownerRoles, leafOnlyRoles, platformOnlyRoles, roleLabels });
```

Everything true about an id travels WITH it (`kind`, `ownerMarker`,
`separateFrom`, `label`) instead of sitting in four parallel lists a host could
copy three of. Future Pay's half lives in `packages/rbac-catalog`
(`@repo/rbac-catalog`) — 615 lines of pure catalog in the host, which is the
port done RIGHT and does not count against any LOC budget.

The engine was always fine — `core/`, `server/`, `hono/` are clean, and
`createApiRbac` already took the catalog as REQUIRED config. That factory shape
was preserved: the fix moved the arguments' VALUES back to the host, not the
factory. What it also removed were the DEFAULTS behind them (`adminRoles`,
`customerRole`, `ownerRoles`, the catalog itself) — every one of which failed
OPEN for a second host, silently.

### Each package owns ITS OWN permission vocabulary

A package that ships routes ships the permissions those routes check, and
exports them for the host to compose:

```ts
// @12-apps/report-builder
export const REPORT_BUILDER_PERMISSIONS = definePermissions({
  'reports:sales:read': 'class',
  'reports:kitchen:read': 'class',
});

// apps/web/lib/rbac/permissions.ts — the HOST composes and owns the union
export const PERMISSIONS = definePermissions({
  ...REPORT_BUILDER_PERMISSIONS.map,
  ...STOCK_DOMAIN_PERMISSIONS.map,
  'orders:read:all': 'class',        // this app's own
});
```

The failure this ends: `report-builder` currently hardcodes the bare string
`"reports:kitchen:read"` in `presets-kitchen.ts` while `@12-apps/rbac`
separately declares `reports:kitchen:read` in its catalog. One vocabulary, two
packages, no shared declaration and no type link — rename either side and
nothing fails to compile.

### The port is not finished when it merges

Everything above is the AUTHORING half. Landing it in `shared-packages` does
not put it in front of a user: `future-pay` pins **exact** versions, nothing
bumps them automatically, and a merged package PR is inert here until someone
edits `package.json`. That gap stranded ten FUT-573 tickets that all read as
Merged — see `shared-packages-pin-must-be-bumped.md` before calling a
package-side change done.
