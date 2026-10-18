import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autofillIdentity,
  autofillTarget,
  isCompleteAutofillLogin,
  matchesAutofillAccount,
  normalizeAutofillHost,
  normalizeAutofillRecord,
} from '../src/lib/autofillModel.js';

test('normalizer handles common URL shapes without broadening the target', () => {
  const cases = [
    ['https://www.example.com/login?next=%2Fvault#form', 'example.com'],
    ['http://example.com:8080/path', 'example.com'],
    ['//WWW.Example.COM/path', 'example.com'],
    ['user@example.com/path', 'example.com'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeAutofillHost(input), expected);
  }
});

test('subdomains remain isolated from parent domains', () => {
  assert.notEqual(normalizeAutofillHost('login.example.com'), normalizeAutofillHost('example.com'));
  assert.equal(matchesAutofillAccount(
    { email: 'user@example.com', website: 'login.example.com' },
    { email: 'user@example.com', website: 'example.com' },
  ), false);
});

test('identity selection has deterministic priority', () => {
  assert.deepEqual(
    autofillIdentity({ email: 'a@b.com', phone: '+212600000000', username: 'alice' }),
    { type: 'email', value: 'a@b.com' },
  );
  assert.deepEqual(
    autofillIdentity({ phone: '+212600000000', username: 'alice' }),
    { type: 'phone', value: '+212600000000' },
  );
});

test('login must include identity, password and exact target', () => {
  assert.equal(isCompleteAutofillLogin({ email: 'a@b.com', password: 'x' }), false);
  assert.equal(isCompleteAutofillLogin({ website: 'example.com', password: 'x' }), false);
  assert.equal(isCompleteAutofillLogin({ email: 'a@b.com', website: 'example.com' }), false);
  assert.equal(isCompleteAutofillLogin({ email: 'a@b.com', password: 'x', website: 'example.com' }), true);
});

test('normalization tolerates very long but valid-looking account values', () => {
  const username = 'u'.repeat(4096);
  const password = 'p'.repeat(16384);
  const record = normalizeAutofillRecord({
    username,
    password,
    website: 'https://example.com/signin',
  });
  assert.equal(record.username.length, 4096);
  assert.equal(record.password.length, 16384);
  assert.equal(record.website, 'example.com');
  assert.equal(isCompleteAutofillLogin(record), true);
});

test('bulk normalization remains deterministic for thousands of accounts', () => {
  const count = 5000;
  const records = Array.from({ length: count }, (_, index) => normalizeAutofillRecord({
    email: `user${index}@example.com`,
    password: `Strong-${index}-Password!`,
    website: 'https://www.example.com/login',
  }));
  assert.equal(records.length, count);
  assert.equal(records.every((record) => record.website === 'example.com'), true);
  assert.equal(new Set(records.map((record) => autofillIdentity(record).value)).size, count);
});

test('website target always wins over Android package when both are present', () => {
  const target = autofillTarget({
    website: 'https://example.com/login',
    applicationIdentifier: 'com.example.app',
  });
  assert.deepEqual(target, { type: 'website', value: 'example.com' });
});
