import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appRoot } from '../lib/launcher.mjs';

const destination = path.join(appRoot, 'artifacts', 'cwork-source.tar.gz');
await fs.mkdir(path.dirname(destination), { recursive: true });
const tests = (await fs.readdir(path.join(appRoot, 'tests'))).filter(name => /\.(mjs|lua)$/.test(name)).map(name => `tests/${name}`);
const files = ['bin', 'lib', 'nvim', 'scripts', 'README.md', 'install.sh', 'package.json', 'package-lock.json', '.gitattributes', '.gitignore', '.github', ...tests];
const result = spawnSync('tar', ['-czf', destination, '-C', appRoot, ...files], { stdio: 'inherit', windowsHide: true });
if (result.error || result.status !== 0) throw new Error('Source bundle creation failed. Ensure tar is installed.');
console.log(`Source bundle: ${destination}`);
