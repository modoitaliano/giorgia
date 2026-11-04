import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const updater = fileURLToPath(new URL('../.agents/skills/ai-agentic-update/scripts/update', import.meta.url));

for (const scenario of [
  { name: 'fetched source missing sync fails instead of reporting bootstrap success', sync: 'missing', fetch: true },
  { name: 'fetched non-executable sync fails', sync: 'non-executable', fetch: true },
  { name: 'working-tree source missing sync still fails', sync: 'missing', fetch: false },
  { name: 'valid fetched source delegates write, check and startup', sync: 'executable', fetch: true }
]) {
  test(scenario.name, () => {
    const root = mkdtempSync(join(tmpdir(), 'giorgia-updater-boundary-'));
    const scratch = join(root, 'snapshots');
    mkdirSync(scratch);
    // Isolate fixture Git from user signing, credentials and configuration.
    const env = { PATH: process.env.PATH, TMPDIR: scratch, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
    const central = join(root, 'central source');
    const reference = join(root, 'reference clone');
    const target = join(root, 'target repository');
    const git = (args, cwd = root) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      git(['init', '--quiet', '--initial-branch=main', central]);
      writeFileSync(join(central, 'README.md'), 'Disposable local central-source fixture.\n');
      if (scenario.sync !== 'missing') {
        mkdirSync(join(central, 'scripts'));
        const sync = join(central, 'scripts/sync');
        writeFileSync(sync, '#!/usr/bin/env bash\nset -euo pipefail\nprintf "%s\\n" "$*" >> sync-calls.log\n');
        chmodSync(sync, scenario.sync === 'executable' ? 0o755 : 0o644);
      }
      git(['add', '.'], central);
      git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'test(fixtures): create a local central snapshot', '-m', 'Co-Authored-By: Codex <noreply@openai.com>'], central);
      git(['clone', '--quiet', central, reference]);
      git(['init', '--quiet', '--initial-branch=main', target]);
      const installed = join(target, '.agents/skills/ai-agentic-update/scripts');
      mkdirSync(installed, { recursive: true });
      // The former success branch required an executable installed updater.
      copyFileSync(updater, join(installed, 'update'));
      chmodSync(join(installed, 'update'), 0o755);
      writeFileSync(join(installed, 'ensure-clouseau'), '#!/usr/bin/env bash\nprintf "fixture startup observed\\n" > startup-observed.log\n');
      const args = ['--repository', target, '--reference-repository', reference];
      if (!scenario.fetch) args.push('--no-fetch');
      const result = spawnSync('bash', [updater, ...args], { cwd: target, env, encoding: 'utf8', timeout: 15000 });
      assert.equal(result.error, undefined, result.error?.message);
      if (scenario.sync === 'executable') {
        assert.equal(result.status, 0, result.stderr);
        const calls = readFileSync(join(target, 'sync-calls.log'), 'utf8').trim().split('\n');
        assert.deepEqual(calls, [`--write --commit --repository ${target}`, `--check --repository ${target}`]);
        assert.equal(readFileSync(join(target, 'startup-observed.log'), 'utf8'), 'fixture startup observed\n');
        assert.match(result.stdout, /agentic-updated/);
      } else {
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /central source does not contain an executable scripts\/sync/);
        assert.doesNotMatch(result.stdout, /agentic-bootstrap-pending|agentic-updated/);
        assert.equal(existsSync(join(target, 'sync-calls.log')), false);
        assert.equal(existsSync(join(target, 'startup-observed.log')), false);
      }
      assert.deepEqual(readdirSync(scratch), [], 'Updater must clean its fetched snapshot');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
