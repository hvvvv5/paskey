import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autofillIdentity,
  buildAutofillTitle,
  isCompleteAutofillLogin,
  normalizeAutofillRecord,
  normalizeAutofillHost,
  matchesAutofillAccount,
} from '../src/lib/autofillModel.js';

test('email login is complete, normalized, and clearly titled', () => {
  const record = normalizeAutofillRecord({
    email: 'name@gmail.com',
    password: 'test-password',
    website: 'https://accounts.google.com/login',
  });
  assert.equal(record.website, 'accounts.google.com');
  assert.equal(record.title, 'Google — name@gmail.com');
  assert.equal(isCompleteAutofillLogin(record), true);
});

test('Instagram username remains scoped to its exact Android package', () => {
  const record = normalizeAutofillRecord({
    username: 'test_user',
    password: 'test-password',
    applicationIdentifier: 'com.instagram.android',
  });
  assert.equal(record.applicationIdentifier, 'com.instagram.android');
  assert.equal(record.title, 'Instagram — test_user');
  assert.notEqual(record.applicationIdentifier, 'com.google.android.gms');
  assert.notEqual(record.applicationIdentifier, 'com.whatsapp');
});

test('WhatsApp phone is the visible account identity', () => {
  const record = normalizeAutofillRecord({
    phone: '+212600000000',
    password: 'test-password',
    applicationIdentifier: 'com.whatsapp',
  });
  assert.deepEqual(autofillIdentity(record), { type: 'phone', value: '+212600000000' });
  assert.equal(buildAutofillTitle(record), 'WhatsApp — +212600000000');
  assert.equal(isCompleteAutofillLogin(record), true);
});

test('password-only records are retained but are not Autofill-ready', () => {
  assert.equal(isCompleteAutofillLogin({ password: 'test-password' }), false);
  assert.equal(isCompleteAutofillLogin({ password: 'test-password', website: 'example.com' }), false);
});

test('targets require exact normalized host values', () => {
  assert.equal(normalizeAutofillHost('https://www.example.com/path?q=1'), 'example.com');
  assert.notEqual(normalizeAutofillHost('accounts.google.com'), normalizeAutofillHost('google.com'));
});

test('a user-selected local image survives normalization', () => {
  const image = 'data:image/png;base64,dGVzdA==';
  const record = normalizeAutofillRecord({
    email: 'image@example.com',
    password: 'test-password',
    website: 'example.com',
    image,
  });
  assert.equal(record.image, image);
});

test('matches existing account by normalized target and identity', () => {
  assert.equal(matchesAutofillAccount(
    { email: 'User@Example.com', website: 'https://www.example.com/login' },
    { email: 'user@example.com', website: 'example.com' }
  ), true);
  assert.equal(matchesAutofillAccount(
    { username: 'alice', applicationIdentifier: 'com.example.app' },
    { username: 'alice', applicationIdentifier: 'com.other.app' }
  ), false);
});
