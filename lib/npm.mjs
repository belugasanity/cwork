import path from 'node:path';
import { findExecutable } from './launcher.mjs';

export function npmInvocation({ env = process.env, platform = process.platform, node = process.execPath, lookup = findExecutable } = {}) {
  if (env.npm_execpath) return { command: node, args: [env.npm_execpath] };
  const npm = lookup('npm');
  if (!npm) throw new Error('npm was not found. Install Node.js with npm, then rerun setup.');
  // POSIX npm launchers are executable scripts; Homebrew does not place npm next to node.
  if (platform !== 'win32') return { command: npm, args: [] };
  return { command: node, args: [path.win32.join(path.win32.dirname(npm), 'node_modules', 'npm', 'bin', 'npm-cli.js')] };
}
