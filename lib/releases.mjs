const releaseUrl = 'https://api.github.com/repos/neovim/neovim/releases/tags/stable';

export async function fetchNeovimRelease({ env = process.env, request = fetch } = {}) {
  const headers = { 'User-Agent': 'codex-workbench-setup', Accept: 'application/vnd.github+json' };
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await request(releaseUrl, { headers });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const limited = response.status === 429 || (response.status === 403 &&
      (response.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(details?.message || '')));
    if (limited) {
      throw new Error('GitHub release lookup was rate-limited. Set GH_TOKEN or GITHUB_TOKEN to authenticate, or wait for the rate limit to reset.');
    }
    throw new Error(`GitHub release lookup failed (${response.status}).${response.status === 401 ? ' Check GH_TOKEN or GITHUB_TOKEN if configured.' : ''}`);
  }
  return response.json();
}
