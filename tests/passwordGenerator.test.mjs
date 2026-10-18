import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword, scorePassword } from '../src/lib/password.js';

test('password generator honors requested lengths from UI range', () => {
  for (const length of [8, 20, 32, 64]) {
    assert.equal(generatePassword({ length }).length, length);
  }
});

test('password generator honors individual character-set selections', () => {
  const upper = generatePassword({ length: 64, uppercase: true, lowercase: false, numbers: false, symbols: false });
  const lower = generatePassword({ length: 64, uppercase: false, lowercase: true, numbers: false, symbols: false });
  const numbers = generatePassword({ length: 64, uppercase: false, lowercase: false, numbers: true, symbols: false });
  const symbols = generatePassword({ length: 64, uppercase: false, lowercase: false, numbers: false, symbols: true });
  assert.match(upper, /^[A-Z]+$/);
  assert.match(lower, /^[a-z]+$/);
  assert.match(numbers, /^[0-9]+$/);
  assert.match(symbols, /^[!@#$%^&*?\-_=+]+$/);
});

test('generator safely falls back when all toggles are disabled', () => {
  const value = generatePassword({ length: 20, uppercase: false, lowercase: false, numbers: false, symbols: false });
  assert.equal(value.length, 20);
  assert.match(value, /^[a-z]+$/);
});

test('password score recognizes empty, weak and strong inputs', () => {
  assert.equal(scorePassword('').label, 'Empty');
  assert.ok(scorePassword('abc').score < 30);
  assert.ok(scorePassword('Ax9!qZ7@vN2#pR8$').score >= 75);
});
