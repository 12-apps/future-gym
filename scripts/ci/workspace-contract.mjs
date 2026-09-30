#!/usr/bin/env node
/** Consumer inventory: bootstrap is explicit; unregistered or lost apps fail closed. */
import { appendFileSync, existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function inspectWorkspaces(root) {
  // This consumer deliberately supports the committed apps/* + packages/*
  // layout. A workspace-glob edit must update the inventory contract too.
  const layout = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")
    .split("\n").map((line) => line.replace(/\s*#.*$/, "").trim()).filter(Boolean);
  const members = layout.slice(1).map((line) => line.replace(/^-[ \t]+/, "").replace(/^(["'])(.*)\1$/, "$2")).sort();
  if (layout[0] !== "packages:" || JSON.stringify(members) !== JSON.stringify(["apps/*", "packages/*"])) {
    throw new Error("Workspace globs changed; update the explicit inventory implementation before CI can select work");
  }
  const contract = JSON.parse(readFileSync(join(root, ".ci/workspaces.json"), "utf8"));
  if (!["bootstrap", "application"].includes(contract.mode)) throw new Error("Unknown workspace mode");
  if (!Array.isArray(contract.workspaces) || contract.workspaces.some((p) => typeof p !== "string" || !/^(apps|packages)\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(p))) {
    throw new Error("Workspace paths must be explicit apps/<name> or packages/<name> entries");
  }
  const expected = [...new Set(contract.workspaces)].sort();
  if (expected.length !== contract.workspaces.length) throw new Error("Duplicate workspace entry");
  const actual = [];
  for (const parent of ["apps", "packages"]) {
    const directory = join(root, parent);
    if (!existsSync(directory)) continue;
    if (lstatSync(directory).isSymbolicLink()) throw new Error(`Symlink workspace parent is not supported: ${parent}`);
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`Symlink workspace is not supported: ${parent}/${name}`);
      if (!stat.isDirectory()) continue;
      if (!existsSync(join(path, "package.json"))) throw new Error(`Workspace has no package.json: ${parent}/${name}`);
      actual.push(`${parent}/${name}`);
    }
  }
  actual.sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Workspace inventory mismatch: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
  if (contract.mode === "bootstrap") {
    if (actual.length) throw new Error("Bootstrap mode cannot hide application or package workspaces");
    return { ready: false, workspaces: actual };
  }
  if (!actual.some((path) => path.startsWith("apps/"))) throw new Error("Application mode requires at least one app workspace");
  for (const path of actual) {
    const pkg = JSON.parse(readFileSync(join(root, path, "package.json"), "utf8"));
    if (typeof pkg.name !== "string" || !pkg.name) throw new Error(`${path} must have a package name`);
    for (const task of ["lint", "check-types", "test", "build"]) {
      if (typeof pkg.scripts?.[task] !== "string" || !pkg.scripts[task].trim()) throw new Error(`${path} must define ${task}`);
    }
  }
  const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const task of ["test:ci", "test:ci:full"]) {
    if (typeof rootPackage.scripts?.[task] !== "string" || !rootPackage.scripts[task].trim()) throw new Error(`Root must define ${task} with real workspace JUnit output`);
  }
  return { ready: true, workspaces: actual };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = inspectWorkspaces(process.cwd());
    const message = result.ready
      ? `Application mode: ${result.workspaces.length} registered workspace(s); application CI enabled.`
      : "Bootstrap mode: no application workspace; application lint, typecheck, test and build were NOT run.";
    console.log(`[workspace-contract] ${message}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `application-ready=${result.ready}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  } catch (error) {
    console.error(`[workspace-contract] ${error.message}`);
    process.exitCode = 1;
  }
}
