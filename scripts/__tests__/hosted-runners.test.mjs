import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = join(ROOT, ".github/workflows");
const workflows = Object.fromEntries(readdirSync(directory)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => [name, readFileSync(join(directory, name), "utf8")]));

// This is a deliberately narrow consumer contract, not a general YAML parser.
// New workflow layouts/callees need an explicit review of their runner policy.
function assertHostedRunners(sources) {
  assert.ok(Object.keys(sources).length > 0, "No workflows inspected");
  let localJobs = 0;
  let calls = 0;
  for (const [file, source] of Object.entries(sources)) {
    const executable = source.split("\n").filter((line) => !line.trimStart().startsWith("#")).join("\n");
    assert.doesNotMatch(executable, /aws-actions\/|\/aws-deploy@|amazonaws\.com|s3:\/\/|\baws\s+(?:sts|s3|s3api|ec2|ssm|ecr)\b|TURBO_(?:API|TOKEN|TEAM)|secrets:\s*inherit/i, `${file}: external cloud wiring is forbidden`);
    const jobs = source.split(/^jobs:\s*$/m);
    assert.equal(jobs.length, 2, `${file}: require one explicit jobs mapping`);
    const blocks = [...jobs[1].matchAll(/^  ([\w-]+):\s*\n([\s\S]*?)(?=^  [\w-]+:\s*$|$(?![\s\S]))/gm)];
    assert.ok(blocks.length > 0, `${file}: no job blocks inspected`);
    for (const [, name, body] of blocks) {
      const label = `${file}/${name}`;
      const runners = [...body.matchAll(/^    runs-on: (.+)$/gm)];
      const uses = [...body.matchAll(/^    uses: (.+)$/gm)];
      assert.equal(runners.length + uses.length, 1, `${label}: require one explicit job runner or reusable workflow`);
      if (runners.length) {
        assert.equal(runners[0][1], "ubuntu-latest", `${label}: local jobs must be GitHub-hosted`);
        localJobs++;
      } else {
        assert.match(uses[0][1], /^12-apps\/ci\/\.github\/workflows\/(monorepo-static|monorepo-tests|post-merge-regen)\.yml@[a-f0-9]{40}(?: # v\d+\.\d+\.\d+)?$/, `${label}: review new reusable workflow runner contract`);
        const withBlocks = [...body.matchAll(/^    with:\s*\n((?:^      .*\n|^\s*$\n)*)/gm)];
        assert.equal(withBlocks.length, 1, `${label}: require explicit reusable inputs`);
        const overrides = [...withBlocks[0][1].matchAll(/^      runner: (.+)$/gm)];
        assert.equal(overrides.length, 1, `${label}: runner override is required`);
        assert.equal(overrides[0][1], "ubuntu-latest", `${label}: runner override must bypass inherited CI_RUNNER`);
        calls++;
      }
    }
  }
  return { localJobs, calls };
}

test("every local and reusable job explicitly stays on GitHub-hosted runners", () => {
  assert.deepEqual(assertHostedRunners(workflows), { localJobs: 2, calls: 3 });
});

test("removing any reusable runner override fails before application jobs start", () => {
  for (const file of Object.keys(workflows)) {
    const source = workflows[file];
    for (const match of source.matchAll(/^      runner: ubuntu-latest\n/gm)) {
      const changed = source.slice(0, match.index) + source.slice(match.index + match[0].length);
      assert.throws(() => assertHostedRunners({ ...workflows, [file]: changed }), /runner override is required/);
    }
  }
});

test("a self-hosted or inherited reusable runner is rejected", () => {
  for (const runner of ["self-hosted", "aws-fleet", "${{ vars.CI_RUNNER || 'ubuntu-latest' }}"]) {
    const changed = workflows["ci.yml"].replace("runner: ubuntu-latest", `runner: ${runner}`);
    assert.throws(() => assertHostedRunners({ ...workflows, "ci.yml": changed }), /bypass inherited CI_RUNNER/);
  }
});

test("a local self-hosted or variable-based runner is rejected", () => {
  for (const runner of ["self-hosted", "[self-hosted, linux]", "${{ vars.CI_RUNNER || 'ubuntu-latest' }}"]) {
    const changed = workflows["ci.yml"].replace("runs-on: ubuntu-latest", `runs-on: ${runner}`);
    assert.throws(() => assertHostedRunners({ ...workflows, "ci.yml": changed }), /must be GitHub-hosted/);
  }
});

test("new reusable workflows cannot silently introduce unreviewed infrastructure", () => {
  const changed = workflows["ci.yml"].replace("monorepo-static.yml", "unreviewed-deploy.yml");
  assert.throws(() => assertHostedRunners({ ...workflows, "ci.yml": changed }), /review new reusable workflow/);
});

test("empty or unrecognized workflow job layouts do not pass the policy", () => {
  assert.throws(() => assertHostedRunners({}), /No workflows inspected/);
  assert.throws(() => assertHostedRunners({ "empty.yml": "name: Empty\n" }), /jobs mapping/);
  assert.throws(() => assertHostedRunners({ "empty.yml": "jobs:\n" }), /no job blocks/);
});

test("AWS credentials, storage and external remote-cache wiring are rejected", () => {
  for (const addition of [
    "      - uses: aws-actions/configure-aws-credentials@v4",
    "      - uses: 12-apps/ci/.github/actions/aws-deploy@v2",
    "      - run: aws s3 sync dist s3://app-builds",
    "      TURBO_API: https://cache.example.invalid",
    "    secrets: inherit",
  ]) {
    const changed = `${workflows["ci.yml"]}\n${addition}\n`;
    assert.throws(() => assertHostedRunners({ ...workflows, "ci.yml": changed }), /external cloud wiring is forbidden/);
  }
});
