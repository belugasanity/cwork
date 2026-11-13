export function neovimDistribution(platform = process.platform, arch = process.arch) {
  if (!['win32', 'darwin', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch)) {
    throw new Error(`Unsupported platform: ${platform}/${arch}. Install Neovim 0.11+ manually.`);
  }
  const suffix = platform === 'win32' ? (arch === 'arm64' ? 'win-arm64' : 'win64')
    : `${platform === 'darwin' ? 'macos' : 'linux'}-${arch === 'arm64' ? 'arm64' : 'x86_64'}`;
  const directory = `nvim-${suffix}`;
  return { directory, archive: `${directory}.${platform === 'win32' ? 'zip' : 'tar.gz'}`, executable: platform === 'win32' ? 'nvim.exe' : 'nvim' };
}
