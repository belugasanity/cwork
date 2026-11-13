import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { appRoot, runtime, editorArgs } from '../lib/launcher.mjs';

const fixture = await fs.mkdtemp(path.join(appRoot, 'tests', '.project-'));
const git = (...args) => execFileSync('git', ['-C', fixture, ...args], { encoding: 'utf8', windowsHide: true });
try {
  git('init', '-b', 'main'); git('config', 'user.name', 'cwork tests'); git('config', 'user.email', 'tests@example.invalid'); git('config', 'core.autocrlf', 'false');
  await fs.mkdir(path.join(fixture, 'src'));
  await fs.writeFile(path.join(fixture, 'src', 'hello.ts'), 'export const count = 1;\n');
  await fs.writeFile(path.join(fixture, 'deleted.py'), 'print("deleted")\n');
  git('add', '.'); git('commit', '-m', 'initial');
  await fs.writeFile(path.join(fixture, 'src', 'hello.ts'), 'export const count = 2;\n');
  await fs.unlink(path.join(fixture, 'deleted.py'));
  await fs.writeFile(path.join(fixture, 'new.json'), '{"new":true}\n');
  const child = spawn(runtime().nvim, ['--headless', ...editorArgs(), '-c', `lua dofile(${JSON.stringify(path.join(appRoot, 'tests', 'editor.lua').replaceAll('\\', '/'))})`], {
    cwd: fixture, stdio: 'inherit', env: { ...process.env, NVIM_APPNAME: 'cwork-test', CWORK_ROOT: fixture, CWORK_MODE: 'shell' },
  });
  const timeout = setTimeout(() => child.kill(), 25000);
  const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  clearTimeout(timeout);
  if (code !== 0) process.exitCode = 1;
} finally { await fs.rm(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }); }
