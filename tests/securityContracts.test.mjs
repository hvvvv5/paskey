import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('native Autofill keeps exact domain and package matching', async () => {
  const source = await read('android/app/src/main/java/com/paskey/vault/autofill/PasKeyAutofillMatcher.java');
  assert.match(source, /target\.equals\(saved\)/);
  assert.match(source, /saved\.equals\(target\)/);
  assert.doesNotMatch(source, /endsWith\s*\(/);
  assert.doesNotMatch(source, /contains\s*\(target\)/);
});

test('password is not placed in locked datasets before authentication', async () => {
  const source = await read('android/app/src/main/java/com/paskey/vault/autofill/PasKeyAutofillService.java');
  assert.match(source, /associate\(dataset, passwordIds, presentation\)/);
  assert.match(source, /dataset\.setValue\(id, null, presentation\)/);
  assert.doesNotMatch(source, /associateFilterableIdentity\(dataset, passwordIds/);
});

test('duplicate identity and password fields remain supported', async () => {
  const source = await read('android/app/src/main/java/com/paskey/vault/autofill/PasKeyAutofillService.java');
  assert.match(source, /usernameIds = new ArrayList/);
  assert.match(source, /emailIds = new ArrayList/);
  assert.match(source, /phoneIds = new ArrayList/);
  assert.match(source, /passwordIds = new ArrayList/);
  assert.match(source, /setOptionalIds/);
});

test('authenticated Autofill fills duplicate fields after unlock', async () => {
  const source = await read('android/app/src/main/java/com/paskey/vault/autofill/AutofillAuthActivity.java');
  assert.match(source, /setValues\(dataset, usernameIds/);
  assert.match(source, /setValues\(dataset, passwordIds/);
  assert.match(source, /FLAG_SECURE/);
  assert.match(source, /BIOMETRIC_STRONG/);
});

test('PDF export requires master-password verification and excludes master password from report', async () => {
  const settings = await read('src/pages/Settings.jsx');
  const exporter = await read('src/lib/passwordPdfExport.js');
  assert.match(settings, /verifyMasterPassword\(pdfPassword\)/);
  assert.match(settings, /This PDF is not encrypted/);
  assert.match(exporter, /category\.fields\.some\(\(field\) => field\.name === 'password'\)/);
  assert.match(exporter, /field\.sensitive \? await dec\(raw\) : raw/);
  assert.doesNotMatch(exporter, /pdf.*master.*password/i);
});

test('Android manifest disables backup and cleartext traffic', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
});

test('no secret-bearing native class logs Autofill values', async () => {
  const service = await read('android/app/src/main/java/com/paskey/vault/autofill/PasKeyAutofillService.java');
  const auth = await read('android/app/src/main/java/com/paskey/vault/autofill/AutofillAuthActivity.java');
  assert.doesNotMatch(service, /Log\.[vdiew]\s*\(/);
  assert.doesNotMatch(auth, /Log\.[vdiew]\s*\(/);
});
