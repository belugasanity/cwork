import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { neovimDistribution } from '../lib/platform.mjs';
import { installLauncher, launcherScript, shellQuote } from '../lib/install.mjs';
import { npmInvocation } from '../lib/npm.mjs';

test('selects the correct official Neovim assets for both Mac architectures', () => {
  assert.deepEqual(neovimDistribution('darwin', 'arm64'), { directory: 'nvim-macos-arm64', archive: 'nvim-macos-arm64.tar.gz', executable: 'nvim' });
  assert.deepEqual(neovimDistribution('darwin', 'x64'), { directory: 'nvim-macos-x86_64', archive: 'nvim-macos-x86_64.tar.gz', executable: 'nvim' });
  assert.equal(neovimDistribution('win32', 'x64').archive, 'nvim-win64.zip');
  assert.equal(neovimDistribution('linux', 'arm64').archive, 'nvim-linux-arm64.tar.gz');
  assert.throws(() => neovimDistribution('darwin', 'ia32'), /Unsupported/);
});
test('quotes executable paths and forwards arguments without interpolation', () => {
  assert.equal(shellQuote("/Users/O'Brien/Node"), "'/Users/O'\\''Brien/Node'");
  const wrapper = launcherScript('/opt/homebrew/bin/node', '/a project/cwork.mjs');
  assert.ok(wrapper.includes("exec '/opt/homebrew/bin/node' '/a project/cwork.mjs' \"$@\""));
});
test('resolves Homebrew and npm-managed launchers without assuming npm is beside Node', () => {
  assert.deepEqual(npmInvocation({ env: {}, platform: 'darwin', node: '/opt/homebrew/Cellar/node/24/bin/node', lookup: () => '/opt/homebrew/bin/npm' }), { command: '/opt/homebrew/bin/npm', args: [] });
  assert.deepEqual(npmInvocation({ env: { npm_execpath: '/shared/npm-cli.js' }, platform: 'darwin', node: '/usr/local/bin/node' }), { command: '/usr/local/bin/node', args: ['/shared/npm-cli.js'] });
  assert.deepEqual(npmInvocation({ env: {}, platform: 'win32', node: 'C:\\node\\node.exe', lookup: () => 'C:\\node\\npm.cmd' }), { command: 'C:\\node\\node.exe', args: ['C:\\node\\node_modules\\npm\\bin\\npm-cli.js'] });
  assert.throws(() => npmInvocation({ env: {}, lookup: () => null }), /npm was not found/);
});
test('installs a user-local command and permits updating only its own wrapper', async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'cwork-install-'));
  try {
    const command = await installLauncher({ prefix: fixture, node: process.execPath, script: '/project/bin/cwork.mjs' });
    assert.equal(command, path.join(fixture, 'bin', 'cwork'));
    await installLauncher({ prefix: fixture, node: process.execPath, script: '/updated/bin/cwork.mjs' });
    assert.match(await fs.readFile(command, 'utf8'), /updated/);
    await fs.writeFile(command, '#!/bin/sh\necho unrelated command\n');
    await assert.rejects(installLauncher({ prefix: fixture, node: process.execPath, script: '/project/bin/cwork.mjs' }), /Refusing to overwrite/);
    assert.match(await fs.readFile(command, 'utf8'), /unrelated command/);
  } finally { await fs.rm(fixture, { recursive: true, force: true }); }
});
test('Unix wrapper launches Node and preserves paths and arguments with spaces and quotes', { skip: process.platform === 'win32' && !process.env.CWORK_TEST_BASH }, async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "cwork O'Brien "));
  try {
    const script = path.join(fixture, 'example.mjs');
    await fs.writeFile(script, 'console.log(JSON.stringify(process.argv.slice(2)));\n');
    const command = await installLauncher({ prefix: fixture, node: process.execPath.replaceAll('\\', '/'), script: script.replaceAll('\\', '/') });
    const args = ['a project', "O'Brien", '$(exit 99)', '--flag'];
    const shell = process.env.CWORK_TEST_BASH;
    // Feed shell source on Windows to avoid MSYS's separate command-line parser.
    const result = shell
      ? spawnSync(shell, [], { encoding: 'utf8', input: `exec ${[command.replaceAll('\\', '/'), ...args].map(shellQuote).join(' ')}\n` })
      : spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), args);
  } finally { await fs.rm(fixture, { recursive: true, force: true }); }
});
