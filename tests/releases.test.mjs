import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNeovimRelease } from '../lib/releases.mjs';

const release = { assets: [{ name: 'nvim-macos-arm64.tar.gz' }] };

test('authenticates the release lookup with the Actions token on shared runners', async () => {
  let calls = 0;
  const result = await fetchNeovimRelease({ env: { GITHUB_TOKEN: 'test-actions-token' }, request: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.github.com/repos/neovim/neovim/releases/tags/stable');
    // Simulate the rate-limited public endpoint from the failing Apple Silicon job.
    if (options.headers.Authorization !== 'Bearer test-actions-token') {
      return Response.json({ message: 'API rate limit exceeded' }, { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
    }
    return Response.json(release);
  } });
  assert.deepEqual(result, release);
  assert.equal(calls, 1);
});

test('still permits unauthenticated setup on machines without a GitHub token', async () => {
  const result = await fetchNeovimRelease({ env: {}, request: async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(release);
  } });
  assert.deepEqual(result, release);
});

test('accepts GH_TOKEN and gives it precedence over GITHUB_TOKEN', async () => {
  await fetchNeovimRelease({ env: { GH_TOKEN: 'local-token', GITHUB_TOKEN: 'actions-token' }, request: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer local-token');
    return Response.json(release);
  } });
});

test('reports primary and secondary rate limits with an actionable error', async () => {
  for (const response of [
    Response.json({ message: 'API rate limit exceeded' }, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    Response.json({ message: 'You have exceeded a secondary rate limit' }, { status: 403 }),
    new Response('Too many requests', { status: 429 }),
  ]) {
    await assert.rejects(fetchNeovimRelease({ env: {}, request: async () => response }), /rate-limited.*GH_TOKEN or GITHUB_TOKEN/);
  }
});

test('distinguishes authorization failures and never includes the token in errors', async () => {
  await assert.rejects(fetchNeovimRelease({ env: { GITHUB_TOKEN: 'private-test-value' }, request: async () => Response.json({ message: 'Bad credentials' }, { status: 401 }) }), error => {
    assert.match(error.message, /failed \(401\).*Check GH_TOKEN/);
    assert.ok(!error.message.includes('private-test-value'));
    return true;
  });
  await assert.rejects(fetchNeovimRelease({ env: {}, request: async () => Response.json({ message: 'Forbidden' }, { status: 403 }) }), /failed \(403\)/);
});
