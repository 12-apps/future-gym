/**
 * The ADR records as data: what the index is generated from.
 *
 * Ported from 12-apps/future-pay `scripts/adr/records.mjs`, without the
 * numbering. A record here is `docs/adr/<slug>.md` and never carries a number.
 * Two open PRs therefore never claim the same number, and no PR writes the
 * README table, so they never meet on its last row either.
 *
 * Every record carries three paragraphs at the top:
 *
 *   **Status:** Accepted — 2026-09-30
 *
 *   **Lane:** UI of every app
 *
 *   **Summary:** the one-line decision, as the index shows it
 *
 * Node builtins only, no install needed.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ADR_DIR = "docs/adr";
export const README = `${ADR_DIR}/README.md`;
export const INDEX_START = "<!-- adr-index:start -->";
export const INDEX_END = "<!-- adr-index:end -->";

const RECORD = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/u;
const DATE = /\b(\d{4}-\d{2}-\d{2})\b/u;

/** A `**Label:** text` paragraph, joined onto one line; `null` when absent. */
function field(source, label) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`**${label}:**`));
  if (start === -1) return null;
  const para = [];
  for (let i = start; i < lines.length && lines[i].trim() !== ""; i += 1) para.push(lines[i].trim());
  return para.join(" ").slice(`**${label}:**`.length).trim();
}

/** Parse one file of the directory; `null` for anything that is not a record. */
export function parseRecord(name, source) {
  if (name === "README.md") return null;
  const match = RECORD.exec(name);
  if (!match) return null;
  const status = field(source, "Status");
  return {
    name,
    slug: match[1],
    title: /^# (.+)$/mu.exec(source)?.[1]?.trim() ?? "",
    status,
    date: status ? (DATE.exec(status)?.[1] ?? null) : null,
    lane: field(source, "Lane"),
    summary: field(source, "Summary"),
  };
}

/** What a record must carry so the index can always be rendered. */
export function recordProblems(record) {
  const problems = [];
  if (!record.title) problems.push(`${record.name}: no "# <Title>" heading`);
  if (/^#?\s*\d{4}\b/u.test(record.title)) problems.push(`${record.name}: the title carries a number; records are not numbered`);
  if (!record.date) problems.push(`${record.name}: no "**Status:** <state> — YYYY-MM-DD" paragraph`);
  if (!record.lane) problems.push(`${record.name}: no "**Lane:**" paragraph`);
  if (!record.summary) problems.push(`${record.name}: no "**Summary:**" paragraph`);
  return problems;
}

/** Files in `docs/adr/` that look like records but are not named as one (a number prefix, capitals…). */
export function misnamedFiles(root) {
  const dir = join(root, ADR_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".md") && name !== "README.md" && (!RECORD.exec(name) || /^\d/u.test(name)));
}

/** Every record in `root`'s `docs/adr/`, oldest decision first, ties by slug. */
export function readRecords(root) {
  const dir = join(root, ADR_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => parseRecord(name, readFileSync(join(dir, name), "utf8")))
    .filter(Boolean)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.slug.localeCompare(b.slug));
}

/** A table cell cannot hold a raw pipe. */
const cell = (text) => text.replace(/(?<!\\)\|/gu, "\\|");

/** The index table. Throws when a record cannot be listed, so a broken record never renders silently. */
export function renderTable(records) {
  const rows = records.map((record) => {
    const problems = recordProblems(record);
    if (problems.length) throw new Error(`cannot render the ADR index: ${problems.join("; ")}`);
    return `| [${cell(record.title)}](./${record.name}) | ${record.date} | ${cell(record.lane)} | ${cell(record.summary)} |`;
  });
  return ["| Decision | Date | Lane | Summary |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

/** The README with the text between the markers replaced by `table`. Throws when the markers are missing. */
export function spliceIndex(readme, table) {
  const start = readme.indexOf(INDEX_START);
  const end = readme.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${README} has no ${INDEX_START} … ${INDEX_END} block to render into`);
  }
  return `${readme.slice(0, start + INDEX_START.length)}\n${table}\n${readme.slice(end)}`;
}
