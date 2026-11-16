import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { neovimDistribution } from './platform.mjs';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function findExecutable(name, env = process.env, platform = process.platform) {
  if (!name) return null;
  const explicit = path.isAbsolute(name) || name.includes('/') || name.includes('\\');
  const directories = explicit ? [''] : (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':');
  const extensions = platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  const matches = [];
  for (const directory of directories) for (const extension of extensions) {
    const candidate = explicit ? `${name}${extension}` : path.join(directory.replace(/^"|"$/g, ''), `${name}${extension}`);
    try {
      if (fs.statSync(candidate).isFile()) {
        if (platform !== 'win32') fs.accessSync(candidate, fs.constants.X_OK);
        matches.push(path.resolve(candidate));
      }
    } catch {}
  }
  return platform === 'win32' ? matches.find(file => file.toLowerCase().endsWith('.exe')) || matches.find(file => /\.(cmd|bat)$/i.test(file)) || null : matches[0] || null;
}
export function runtime() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(path.join(appRoot, '.tools', 'runtime.json'), 'utf8')); } catch {}
  const distribution = neovimDistribution();
  const portable = path.join(appRoot, '.tools', distribution.directory, 'bin', distribution.executable);
  const localCodex = path.join(appRoot, '.tools', 'codex', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  return {
    nvim: findExecutable(process.env.CWORK_NVIM) || findExecutable(portable) || findExecutable('nvim'),
    codex: findExecutable(process.env.CWORK_CODEX) || (fs.existsSync(localCodex) ? localCodex : null) || findExecutable('codex') || findExecutable(saved.codex),
    git: findExecutable('git'),
  };
}
export function parseArgs(args) {
  const result = { directory: process.cwd(), resume: false, shell: false, editorOnly: false, help: false, check: false, version: false };
  let positional = false;
  let literal = false;
  for (const argument of args) {
    if (argument === '--' && !literal) { literal = true; continue; }
    if (!literal && ['--shell', '--editor-only', '--help', '-h', '--check', '--version', '-v'].includes(argument)) {
      const flag = ({ '--shell': 'shell', '--editor-only': 'editorOnly', '--help': 'help', '-h': 'help', '--check': 'check', '--version': 'version', '-v': 'version' })[argument];
      result[flag] = true;
    } else if (!literal && argument === 'resume' && !positional) result.resume = true;
    else if (!literal && argument.startsWith('-')) throw new Error(`Unknown option: ${argument}. Run cwork --help.`);
    else if (positional) throw new Error('Pass one project directory.');
    else { result.directory = path.resolve(argument); positional = true; }
  }
  return result;
}
export function editorArgs() { return ['-u', path.join(appRoot, 'nvim', 'init.lua'), '-i', 'NONE', '-n']; }
export function checkVersion(nvim) {
  const result = spawnSync(nvim, ['--version'], { encoding: 'utf8', windowsHide: true });
  const match = result.stdout?.match(/NVIM v(\d+)\.(\d+)/);
  if (!match || (Number(match[1]) === 0 && Number(match[2]) < 11)) throw new Error('Neovim 0.11+ is required. Run npm run setup.');
  return result.stdout.split(/\r?\n/)[0];
}
