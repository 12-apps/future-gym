#!/usr/bin/env node
/**
 * Everything this repository derives AFTER a merge, in one command.
 *
 * `.github/workflows/post-merge-regen.yml` runs it on the live tip of `main`
 * through 12-apps/ci's post-merge-regen workflow, which lands whatever it
 * changed as one auto-merged PR that starts no workflow. Anything a pull
 * request would otherwise derive for itself, and so conflict on with every
 * other pull request deriving the same file, belongs here.
 *
 * Today: the ADR index (scripts/adr/render-index.mjs).
 *
 * Idempotent: a second run on the same tree changes nothing. Node builtins
 * only; it runs in a job with no install.
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderIndex } from "./adr/render-index.mjs";

const root = process.env.REGEN_ROOT || join(fileURLToPath(new URL(".", import.meta.url)), "..");

console.log(renderIndex(root) ? "[post-merge-regen] ADR index re-rendered" : "[post-merge-regen] ADR index unchanged");
