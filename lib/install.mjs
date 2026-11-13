import fs from 'node:fs/promises';
import path from 'node:path';

export function shellQuote(value) { return `'${value.replaceAll("'", "'\\''")}'`; }
export function launcherScript(node, script) {
  return `#!/bin/sh\n# cwork user-local launcher\nexec ${shellQuote(node)} ${shellQuote(script)} "$@"\n`;
}

export async function installLauncher({ prefix, node, script }) {
  const bin = path.join(path.resolve(prefix), 'bin');
  const destination = path.join(bin, 'cwork');
  await fs.mkdir(bin, { recursive: true });
  try {
    const stat = await fs.lstat(destination);
    if (!stat.isFile() || !(await fs.readFile(destination, 'utf8')).startsWith('#!/bin/sh\n# cwork user-local launcher\n')) {
      throw new Error(`Refusing to overwrite an existing command: ${destination}`);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(destination, launcherScript(node, script), { mode: 0o755 });
  await fs.chmod(destination, 0o755);
  return destination;
}
