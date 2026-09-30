#!/usr/bin/env node
/** The final consumer gate rejects unexpected skips as well as failure/cancellation. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkResults({ contracts, ready, staticResult, tests, code }) {
  if (contracts !== "success") return "Repository contracts did not pass";
  if (ready === "false") return staticResult === "skipped" && tests === "skipped" ? null : "Bootstrap unexpectedly ran application lanes";
  if (ready !== "true") return "Workspace readiness output is missing or invalid";
  if (staticResult !== "success") return "Application static checks did not pass";
  if (!["true", "false"].includes(code)) return "Application code-selection output is missing or invalid";
  if (code === "true" && tests !== "success") return "Selected application tests/build did not pass";
  if (code === "false" && tests !== "skipped") return "Unselected application tests/build returned an unexpected status";
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problem = checkResults({ contracts: process.env.CONTRACTS, ready: process.env.APPLICATION_READY, staticResult: process.env.STATIC_RESULT, tests: process.env.TESTS_RESULT, code: process.env.CODE });
  if (problem) { console.error(`::error::${problem}`); process.exitCode = 1; }
  else console.log(process.env.APPLICATION_READY === "true" ? "Application CI and repository contracts passed." : "Repository contracts passed. No application has been built or tested.");
}
