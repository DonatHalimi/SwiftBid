import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerificationToken, hashToken } from '../src/utils/token.js';

test('email verification tokens are URL-safe and only stored as deterministic hashes', () => {
  const token = createVerificationToken();
  const hash = hashToken(token);

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashToken(token), hash);
  assert.notEqual(hash, token);
});
