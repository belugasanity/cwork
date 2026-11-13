import path from 'node:path';
import os from 'node:os';
import { appRoot } from '../lib/launcher.mjs';
import { installLauncher, shellQuote } from '../lib/install.mjs';
import { setup } from './setup.mjs';

try {
  if (process.platform === 'win32') throw new Error('On Windows use npm run setup, then npm link.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22+ is required.');
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--prefix')) throw new Error('Usage: sh install.sh [--prefix /your/install/prefix]');
  const prefix = path.resolve(args[1] || process.env.CWORK_PREFIX || path.join(os.homedir(), '.local'));
  await setup();
  const command = await installLauncher({ prefix, node: process.execPath, script: path.join(appRoot, 'bin', 'cwork.mjs') });
  console.log(`Installed: ${command}`);
  const bin = path.dirname(command);
  if (!(process.env.PATH || '').split(path.delimiter).includes(bin)) {
    console.log(`\nAdd this line to ~/.zshrc (or your shell's startup file), then run it in this terminal:\nexport PATH=${shellQuote(bin)}:"$PATH"`);
  }
  console.log('\nIn any project directory, run: cwork');
} catch (error) { console.error(`cwork install: ${error.message}`); process.exitCode = 1; }
