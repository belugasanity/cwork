import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appRoot, runtime, checkVersion } from '../lib/launcher.mjs';
import { neovimDistribution } from '../lib/platform.mjs';
import { npmInvocation } from '../lib/npm.mjs';
import { fileURLToPath } from 'node:url';

export async function setup() {
  const tools = runtime();
  const toolsDir = path.join(appRoot, '.tools');
  await fs.mkdir(toolsDir, { recursive: true });
  let needsNeovim = !tools.nvim;
  if (tools.nvim) {
    try { checkVersion(tools.nvim); }
    catch (error) { if (process.env.CWORK_NVIM) throw error; needsNeovim = true; }
  }
  if (needsNeovim) {
    const distribution = neovimDistribution();
    const filename = distribution.archive;
    console.log(`Downloading official stable Neovim (${filename})…`);
    const releaseResponse = await fetch('https://api.github.com/repos/neovim/neovim/releases/tags/stable', { headers: { 'User-Agent': 'codex-workbench-setup' } });
    if (!releaseResponse.ok) throw new Error(`GitHub release lookup failed (${releaseResponse.status}).`);
    const release = await releaseResponse.json();
    const asset = release.assets.find(asset => asset.name === filename);
    if (!asset?.digest?.startsWith('sha256:')) throw new Error('No checksummed official Neovim download found.');
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) throw new Error(`Download failed (${response.status}).`);
    const data = Buffer.from(await response.arrayBuffer());
    if (`sha256:${createHash('sha256').update(data).digest('hex')}` !== asset.digest) throw new Error('Neovim download checksum mismatch.');
    const archive = path.join(toolsDir, filename);
    await fs.writeFile(archive, data);
    const extracted = spawnSync('tar', ['-xf', archive, '-C', toolsDir], { stdio: 'inherit', windowsHide: true });
    if (extracted.error || extracted.status !== 0) throw new Error('Unable to extract Neovim. Install tar or Neovim manually.');
    if (process.platform !== 'win32') await fs.chmod(path.join(toolsDir, distribution.directory, 'bin', distribution.executable), 0o755);
    await fs.unlink(archive);
  }
  // The desktop application's embedded codex.exe is not a standalone CLI package.
  // Keep a complete CLI local to cwork instead of changing the user's codex command.
  if (!tools.codex || /WindowsApps[\\/]OpenAI\.Codex_[^]+[\\/]resources[\\/]codex/i.test(tools.codex)) {
    console.log('Installing an isolated official Codex CLI package…');
    const npmArgs = ['install', '--prefix', path.join(toolsDir, 'codex'), '--no-audit', '--no-fund', '@openai/codex'];
    const npm = npmInvocation();
    const installedCli = spawnSync(npm.command, [...npm.args, ...npmArgs], { stdio: 'inherit', windowsHide: true });
    if (installedCli.error || installedCli.status !== 0) throw new Error('Codex CLI installation failed. Install the official CLI and rerun setup.');
  }
  const installed = runtime();
  console.log(checkVersion(installed.nvim));
  if (installed.codex) await fs.writeFile(path.join(toolsDir, 'runtime.json'), JSON.stringify({ codex: installed.codex }, null, 2));
  console.log(installed.codex ? `Codex found: ${installed.codex}` : 'Install Codex CLI or set CWORK_CODEX before launching.');
  console.log('Workspace tools are ready.');
  return installed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup().catch(error => { console.error(`cwork setup: ${error.message}`); process.exitCode = 1; });
}
