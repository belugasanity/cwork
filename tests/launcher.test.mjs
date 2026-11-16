import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { parseArgs, editorArgs, findExecutable } from '../lib/launcher.mjs';

test('defaults to the current project directory', () => {
  assert.equal(parseArgs([]).directory, process.cwd());
  assert.equal(parseArgs(['resume']).resume, true);
  assert.equal(parseArgs(['resume', 'some folder']).directory, path.resolve('some folder'));
  assert.equal(parseArgs(['--shell']).shell, true);
  assert.equal(parseArgs(['--editor-only']).editorOnly, true);
});
test('preserves spaces and shell metacharacters as directory names', () => {
  assert.equal(parseArgs(['some folder & data']).directory, path.resolve('some folder & data'));
  assert.equal(parseArgs(['--', '-project']).directory, path.resolve('-project'));
});
test('rejects mistyped options and multiple project directories', () => {
  assert.throws(() => parseArgs(['--oops']), /Unknown option/);
  assert.throws(() => parseArgs(['one', 'two']), /one project/);
});
test('uses an isolated editor config and never launches a GUI', () => {
  const args = editorArgs();
  assert.equal(args[0], '-u');
  assert.ok(args[1].endsWith(path.join('nvim', 'init.lua')));
  assert.ok(!args.includes('--embed'));
});
test('finds executable files without relying on installed tools', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'cwork-exec-'));
  try {
    const executable = path.join(fixture, process.platform === 'win32' ? 'example.exe' : 'example');
    fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    assert.equal(findExecutable('example', { PATH: fixture }), executable);
    if (process.platform !== 'win32') {
      fs.chmodSync(executable, 0o644);
      assert.equal(findExecutable('example', { PATH: fixture }), null);
    }
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
  assert.equal(findExecutable('definitely-no-such-executable-cwork'), null);
});
