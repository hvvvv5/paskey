import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('all seven vault categories remain defined with required title fields', async () => {
  const categories = await read('src/lib/categories.js');
  for (const key of ['passwords', 'email', 'social', 'banking', 'cards', 'addresses', 'notes']) {
    assert.match(categories, new RegExp(`key: ['"]${key}['"]`));
  }
  assert.match(categories, /sensitive: true/);
  assert.match(categories, /required: true/);
});

test('primary application routes cover vault, autofill, generator, security, settings and privacy', async () => {
  const app = await read('src/App.jsx');
  for (const route of ['/', '/autofill', '/generator', '/security', '/settings', '/privacy']) {
    assert.match(app, new RegExp(`path=["']${route.replace('/', '\\/')}["']`));
  }
  assert.match(app, /path="\/new\/:cat"/);
  assert.match(app, /path="\/edit\/:cat\/:id"/);
  assert.match(app, /path="\/item\/:cat\/:id"/);
});

test('vault repository exposes complete CRUD, search, favorite, audit and backup operations', async () => {
  const repo = await read('src/lib/repository/vaultRepository.js');
  for (const name of [
    'listCategory', 'listItems', 'getItem', 'createItem', 'updateItem', 'deleteItem',
    'toggleFavorite', 'searchItems', 'getSecurityStatistics', 'exportRaw', 'importRaw', 'eraseAll',
  ]) {
    assert.match(repo, new RegExp(`\\b${name}\\b`));
  }
  assert.match(repo, /serializeMutation/);
  assert.match(repo, /writeNativeVaultEntity/);
  assert.match(repo, /clearNativeVaultStorage/);
});

test('item UI supports create, edit, delete, favorite, copy and website opening', async () => {
  const form = await read('src/pages/ItemForm.jsx');
  const detail = await read('src/pages/ItemDetail.jsx');
  assert.match(form, /createItem/);
  assert.match(form, /updateItem/);
  assert.match(form, /generatePassword/);
  assert.match(detail, /deleteItem/);
  assert.match(detail, /toggleFavorite/);
  assert.match(detail, /CopyButton/);
  assert.match(detail, /target="_blank"/);
});

test('vault home supports search, category counts, favorites, recent items and add menu', async () => {
  const vault = await read('src/pages/Vault.jsx');
  assert.match(vault, /searchItems\(query\)/);
  assert.match(vault, /const favorites/);
  assert.match(vault, /const recent/);
  assert.match(vault, /counts\[category\.key\]/);
  assert.match(vault, /<AddMenu/);
});

test('add menu exposes every category and supports overlay close plus RTL-safe labels', async () => {
  const menu = await read('src/components/paskey/AddMenu.jsx');
  assert.match(menu, /CATEGORIES\.map/);
  assert.match(menu, /navigate\(\`\/new\/\$\{category\.key\}\`\)/);
  assert.match(menu, /onClick=\{close\}/);
  assert.match(menu, /aria-label=\{t\('Add item categories'\)\}/);
  assert.match(menu, /aria-label=\{t\(category\.label\)\}/);
});

test('bottom navigation exposes all five primary sections', async () => {
  const nav = await read('src/components/paskey/BottomNav.jsx');
  for (const route of ['/', '/autofill', '/generator', '/security', '/settings']) {
    assert.ok(nav.includes(`to: '${route}'`), `missing nav route ${route}`);
  }
});

test('generator uses cryptographically secure RNG and configurable character sets', async () => {
  const password = await read('src/lib/password.js');
  const generator = await read('src/pages/Generator.jsx');
  assert.match(password, /crypto\.getRandomValues/);
  assert.match(password, /uppercase/);
  assert.match(password, /lowercase/);
  assert.match(password, /numbers/);
  assert.match(password, /symbols/);
  assert.match(generator, /min=\{8\}/);
  assert.match(generator, /max=\{64\}/);
});

test('settings cover lock, clipboard, screenshots, reveal-auth, themes, language, backup, restore and PDF', async () => {
  const settings = await read('src/pages/Settings.jsx');
  for (const feature of [
    'autoLockMinutes', 'clipboardClearSeconds', 'screenshotProtection',
    'requireAuthToReveal', 'biometricUnlock', 'Password PDF report',
    'Encrypted backup', 'Restore from backup',
  ]) {
    assert.ok(settings.includes(feature), `missing settings feature ${feature}`);
  }
  for (const theme of ['system', 'dark', 'cream', 'pro']) {
    assert.ok(settings.includes(`'${theme}'`), `missing theme ${theme}`);
  }
  assert.match(settings, /setLanguage/);
});

test('vault lifecycle implements setup, master unlock, biometric unlock, auto-lock and master-password change', async () => {
  const vault = await read('src/components/paskey/VaultContext.jsx');
  assert.match(vault, /const setup = useCallback/);
  assert.match(vault, /const unlock = useCallback/);
  assert.match(vault, /const unlockWithBiometrics = useCallback/);
  assert.match(vault, /const changeMaster = useCallback/);
  assert.match(vault, /autoLockMinutes/);
  assert.match(vault, /appStateChange/);
  assert.match(vault, /setScreenshotProtection/);
});

test('sensitive-field reveal performs native re-authentication when required', async () => {
  const field = await read('src/components/paskey/SensitiveField.jsx');
  assert.match(field, /settings\.requireAuthToReveal/);
  assert.match(field, /Capacitor\.getPlatform\(\) === 'android'/);
  assert.match(field, /authenticateSensitiveAction\(\)/);
  assert.match(field, /setValue\(await dec\(cipher\)\)/);
});

test('secure clipboard uses native secure copy and configured auto-clear', async () => {
  const copy = await read('src/components/paskey/CopyButton.jsx');
  assert.match(copy, /PasKeySecurity\.copySecure/);
  assert.match(copy, /clipboardClearSeconds/);
  assert.match(copy, /navigator\.clipboard\.writeText/);
});

test('security center audits weak, reused, missing and old credentials', async () => {
  const security = await read('src/pages/Security.jsx');
  const repo = await read('src/lib/repository/vaultRepository.js');
  for (const key of ['weak', 'reused', 'missing', 'old']) {
    assert.ok(repo.includes(key), `missing security metric ${key}`);
  }
  assert.match(security, /Security Score/);
  assert.match(security, /getSecurityStatistics/);
});

test('encrypted backup is versioned, encrypted and restorable without plaintext vault export', async () => {
  const backup = await read('src/lib/backup.js');
  assert.match(backup, /format: 'PasKey Encrypted Vault'/);
  assert.match(backup, /version: 2/);
  assert.match(backup, /ciphertext: await enc\(JSON\.stringify\(data\)\)/);
  assert.match(backup, /await dec\(parsed\.ciphertext\)/);
  assert.match(backup, /repo\.importRaw/);
});

test('PDF export is re-authenticated, text-based and provides web, email, phone and Play Store links', async () => {
  const settings = await read('src/pages/Settings.jsx');
  const pdf = await read('src/lib/passwordPdfExport.js');
  assert.match(settings, /verifyMasterPassword\(pdfPassword\)/);
  assert.match(settings, /authenticateSensitiveAction\(\)/);
  assert.doesNotMatch(pdf, /html2canvas/);
  assert.match(pdf, /mailto:/);
  assert.match(pdf, /tel:/);
  assert.match(pdf, /play\.google\.com/);
  assert.match(pdf, /saveHtmlPdfToDownloads/);
});

test('Autofill remains exact-target, authenticated and duplicate-field aware', async () => {
  const service = await read('android/app/src/main/java/com/paskey/vault/autofill/PasKeyAutofillService.java');
  const auth = await read('android/app/src/main/java/com/paskey/vault/autofill/AutofillAuthActivity.java');
  const matcher = await read('android/app/src/main/java/com/paskey/vault/autofill/PasKeyAutofillMatcher.java');
  assert.match(matcher, /equals/);
  assert.match(service, /usernameIds = new ArrayList/);
  assert.match(service, /passwordIds = new ArrayList/);
  assert.match(service, /setOptionalIds/);
  assert.match(auth, /BIOMETRIC_STRONG/);
  assert.match(auth, /FLAG_SECURE/);
});

test('Arabic and theme infrastructure provide RTL plus dark, cream and pro modes', async () => {
  const i18n = await read('src/lib/i18n.jsx');
  const settings = await read('src/lib/settings.js');
  const css = await read('src/index.css');
  assert.match(i18n, /document\.documentElement\.dir=language==='ar'\?'rtl':'ltr'/);
  assert.match(settings, /THEME_OPTIONS = \['system', 'dark', 'cream', 'pro'\]/);
  assert.match(css, /data-pk-theme=['"]cream['"]/);
  assert.match(css, /data-pk-theme=['"]pro['"]/);
});
