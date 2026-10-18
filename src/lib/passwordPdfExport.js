import { Capacitor } from '@capacitor/core';
import { CATEGORIES } from '@/lib/categories';
import { saveHtmlPdfToDownloads } from '@/lib/native/PasKeySecurity';

const clean = (value) => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const esc = (value) => clean(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const passwordCategories = () => CATEGORIES.filter((category) => (
  category.fields.some((field) => field.name === 'password')
));

const identityOf = (item = {}) => (
  clean(item.email) || clean(item.username) || clean(item.phone) || ''
);

const titleOf = (category, item = {}) => (
  clean(item[category.titleField])
  || identityOf(item)
  || clean(item.website)
  || clean(item.applicationIdentifier)
  || category.label
);

const splitValues = (value) => clean(value)
  .split(/[,;\n]/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const websiteHref = (value) => {
  const text = clean(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text)) return `http://${text}`;
  return `https://${text}`;
};

const mailHref = (value) => {
  const text = clean(value);
  return text ? `mailto:${text}` : '';
};

const phoneHref = (value) => {
  const number = clean(value).replace(/[^\d+]/g, '');
  return number ? `tel:${number}` : '';
};

const playStoreHref = (value) => {
  const packageName = clean(value);
  return packageName
    ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`
    : '';
};

function linkTargets(fieldName, value) {
  const values = splitValues(value);
  if (!values.length) return [];

  if (fieldName === 'website' || fieldName === 'url') {
    return values.map((text) => ({ text, href: websiteHref(text), kind: 'web' }));
  }
  if (fieldName === 'email' || fieldName === 'recovery_email') {
    return values.map((text) => ({ text, href: mailHref(text), kind: 'mail' }));
  }
  if (fieldName === 'phone' || fieldName === 'recovery_phone') {
    return values.map((text) => ({ text, href: phoneHref(text), kind: 'phone' }));
  }
  if (fieldName === 'applicationIdentifier') {
    return values.map((text) => ({ text, href: playStoreHref(text), kind: 'app' }));
  }
  return [];
}

async function collectAccounts(repo, dec, t) {
  const accounts = [];
  for (const category of passwordCategories()) {
    const items = await repo.listCategory(category.key);
    for (const item of items) {
      if (!item?.password) continue;

      const values = {};
      for (const field of category.fields) {
        if (field.kind === 'avatar' || field.name === 'avatar') continue;
        const raw = item[field.name];
        if (raw === null || raw === undefined || raw === '') continue;
        try {
          values[field.name] = field.sensitive ? await dec(raw) : raw;
        } catch {
          values[field.name] = t('Unable to decrypt this field.');
        }
      }

      if (!clean(values.password)) continue;
      accounts.push({
        category,
        item,
        values,
        title: titleOf(category, { ...item, ...values }),
      });
    }
  }

  accounts.sort((a, b) => a.title.localeCompare(b.title));
  return accounts;
}

function valueMarkup(field, value) {
  const links = linkTargets(field.name, value);
  if (links.length) {
    return links.map(({ text, href, kind }) => (
      `<a class="smart-link ${kind}" href="${esc(href)}">${esc(text)}</a>`
    )).join('<br>');
  }

  const classes = [
    'value',
    field.name === 'password' ? 'password' : '',
    ['email', 'username', 'phone', 'password', 'website', 'url', 'applicationIdentifier', 'iban'].includes(field.name)
      ? 'technical'
      : '',
  ].filter(Boolean).join(' ');

  return `<span class="${classes}">${esc(value) || '—'}</span>`;
}

function accountRows(account, t) {
  const rows = [];
  rows.push(`
    <tr>
      <th>${esc(t('Category'))}</th>
      <td><span class="category-pill">${esc(t(account.category.label))}</span></td>
    </tr>
  `);

  for (const field of account.category.fields) {
    if (field.kind === 'avatar' || field.name === 'avatar') continue;
    const value = account.values[field.name];
    if (!clean(value)) continue;
    rows.push(`
      <tr>
        <th>${esc(t(field.label))}</th>
        <td>${valueMarkup(field, value)}</td>
      </tr>
    `);
  }

  if (account.item.created_date) {
    rows.push(`
      <tr>
        <th>${esc(t('Created'))}</th>
        <td><span class="technical">${esc(new Date(account.item.created_date).toLocaleString())}</span></td>
      </tr>
    `);
  }
  if (account.item.updated_date) {
    rows.push(`
      <tr>
        <th>${esc(t('Last updated'))}</th>
        <td><span class="technical">${esc(new Date(account.item.updated_date).toLocaleString())}</span></td>
      </tr>
    `);
  }

  return rows.join('');
}

function quickActions(account, t) {
  const actions = [];
  const website = linkTargets('website', account.values.website || '');
  const email = linkTargets('email', account.values.email || '');
  const phone = linkTargets('phone', account.values.phone || '');
  const apps = linkTargets('applicationIdentifier', account.values.applicationIdentifier || '');

  if (website[0]) actions.push(`<a href="${esc(website[0].href)}">${esc(t('Open website'))}</a>`);
  if (email[0]) actions.push(`<a href="${esc(email[0].href)}">${esc(t('Send email'))}</a>`);
  if (phone[0]) actions.push(`<a href="${esc(phone[0].href)}">${esc(t('Call phone'))}</a>`);
  if (apps[0]) actions.push(`<a href="${esc(apps[0].href)}">${esc(t('Open in Google Play'))}</a>`);

  return actions.length
    ? `<div class="quick-actions">${actions.join('')}</div>`
    : '';
}

function buildHtml(accounts, language, t) {
  const rtl = language === 'ar';
  const generated = new Date().toLocaleString(rtl ? 'ar' : undefined);

  const indexRows = accounts.map((account, index) => `
    <tr>
      <td class="index-no">${index + 1}</td>
      <td><a href="#account-${index + 1}">${esc(account.title)}</a></td>
      <td>${esc(t(account.category.label))}</td>
      <td class="technical">${esc(identityOf(account.values))}</td>
    </tr>
  `).join('');

  const accountBlocks = accounts.map((account, index) => `
    <section class="account" id="account-${index + 1}">
      <div class="account-head">
        <div>
          <div class="eyebrow">${esc(t(account.category.label))} · ${index + 1}/${accounts.length}</div>
          <h2>${esc(account.title)}</h2>
        </div>
        <div class="account-number">#${String(index + 1).padStart(2, '0')}</div>
      </div>
      ${quickActions(account, t)}
      <table class="account-table">
        <tbody>${accountRows(account, t)}</tbody>
      </table>
    </section>
  `).join('');

  return `<!doctype html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t('PasKey Password Report'))}</title>
<style>
  @page { size: A4; margin: 12mm 11mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, "Noto Sans Arabic", Tahoma, sans-serif;
    font-size: 9.5pt;
    line-height: 1.45;
    color: #171717;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-rendering: geometricPrecision;
  }
  a { color: #0b57d0; text-decoration: underline; text-underline-offset: 2px; }
  .technical, .password, .smart-link {
    direction: ltr;
    unicode-bidi: plaintext;
    text-align: left;
    font-family: "Roboto Mono", "Courier New", monospace;
  }
  .cover {
    min-height: 255mm;
    display: flex;
    flex-direction: column;
  }
  .brand {
    font-size: 10pt;
    letter-spacing: 4px;
    font-weight: 700;
    color: #8b682f;
  }
  h1 {
    margin: 10mm 0 2mm;
    font-size: 25pt;
    line-height: 1.15;
    font-weight: 700;
  }
  .subtitle { color: #666; font-size: 10pt; max-width: 155mm; }
  .rule { height: 1.3pt; background: #c8a96b; margin: 6mm 0; }
  .metrics { display: flex; gap: 4mm; margin: 4mm 0 6mm; }
  .metric {
    border: 1px solid #ddd4c3;
    border-radius: 8px;
    padding: 4mm 5mm;
    min-width: 38mm;
    background: #fbf8f2;
  }
  .metric strong { display: block; font-size: 18pt; line-height: 1; }
  .metric span { color: #666; font-size: 8pt; }
  .warning {
    border: 1px solid #d9b55b;
    background: #fff9e9;
    color: #6d4b08;
    border-radius: 8px;
    padding: 4mm;
    margin: 2mm 0 6mm;
    font-weight: 700;
  }
  .index-title { font-size: 13pt; font-weight: 700; margin: 4mm 0 2mm; }
  .index-table, .account-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .index-table th, .index-table td {
    border-bottom: 1px solid #ece7df;
    padding: 2.2mm 2mm;
    vertical-align: top;
  }
  .index-table th { color: #666; font-size: 8pt; text-align: start; }
  .index-no { width: 10mm; color: #8b682f; font-weight: 700; }
  .footer-note {
    margin-top: auto;
    padding-top: 6mm;
    color: #8a8a8a;
    font-size: 7.5pt;
  }
  .account {
    break-inside: avoid;
    page-break-inside: avoid;
    margin: 0 0 7mm;
    border: 1px solid #d8d8d8;
    border-radius: 10px;
    overflow: hidden;
  }
  .account-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 5mm;
    padding: 4mm 4.5mm 3.5mm;
    background: #faf8f4;
    border-bottom: 1px solid #e6dfd2;
  }
  .eyebrow { color: #8b682f; font-size: 7.5pt; font-weight: 700; }
  h2 {
    margin: 1mm 0 0;
    font-size: 14pt;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .account-number {
    direction: ltr;
    font-family: "Courier New", monospace;
    color: #99845d;
    font-size: 10pt;
    white-space: nowrap;
  }
  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
    padding: 2.5mm 4.5mm 1mm;
    background: #fff;
  }
  .quick-actions a {
    display: inline-block;
    border: 1px solid #d6c5a4;
    border-radius: 999px;
    padding: 1.1mm 2.5mm;
    background: #fffaf0;
    font-size: 7.8pt;
    text-decoration: none;
  }
  .account-table th,
  .account-table td {
    border-top: 1px solid #eeeeee;
    padding: 2.3mm 3.6mm;
    vertical-align: top;
  }
  .account-table tr:first-child th,
  .account-table tr:first-child td { border-top: 0; }
  .account-table th {
    width: 31%;
    background: #fbfbfb;
    color: #555;
    font-weight: 700;
    text-align: start;
  }
  .account-table td {
    width: 69%;
    background: #fff;
    overflow-wrap: anywhere;
  }
  .password {
    display: inline-block;
    color: #8b1e14;
    font-size: 11.5pt;
    font-weight: 700;
    letter-spacing: .15px;
    word-break: break-all;
    white-space: pre-wrap;
  }
  .value { white-space: pre-wrap; overflow-wrap: anywhere; }
  .smart-link { word-break: break-all; }
  .category-pill {
    display: inline-block;
    padding: .8mm 2.3mm;
    border-radius: 999px;
    background: #efe7d8;
    color: #5f4922;
    font-size: 7.8pt;
    font-weight: 700;
  }
  .privacy {
    margin: 0 0 7mm;
    padding: 3mm 4mm;
    border-left: 3px solid #c8a96b;
    background: #fbf8f2;
    color: #5f5a51;
    break-inside: avoid;
  }
  [dir="rtl"] .privacy { border-left: 0; border-right: 3px solid #c8a96b; }
</style>
</head>
<body>
  <section class="cover">
    <div class="brand">PASKEY</div>
    <h1>${esc(t('PasKey Password Report'))}</h1>
    <div class="subtitle">${esc(t('A high-quality local export of saved login accounts with readable passwords and actionable links.'))}</div>
    <div class="rule"></div>
    <div class="metrics">
      <div class="metric"><strong>${accounts.length}</strong><span>${esc(t('Accounts'))}</span></div>
      <div class="metric"><strong>${esc(generated)}</strong><span>${esc(t('Generated'))}</span></div>
    </div>
    <div class="warning">${esc(t('Sensitive PDF warning: this file contains readable passwords and other account details. Store it securely and do not share it.'))}</div>
    <div class="index-title">${esc(t('Account index'))}</div>
    <table class="index-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${esc(t('Account'))}</th>
          <th>${esc(t('Category'))}</th>
          <th>${esc(t('Identity'))}</th>
        </tr>
      </thead>
      <tbody>${indexRows}</tbody>
    </table>
    <div class="footer-note">${esc(t('Generated locally by PasKey. No vault data was uploaded.'))}</div>
  </section>

  <div class="privacy">${esc(t('Links in this report are active when supported by your PDF viewer. Text is exported as real document text for selection, search, copy and editing in compatible PDF editors.'))}</div>
  ${accountBlocks}
</body>
</html>`;
}

function browserPrintFallback(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (!win) throw new Error('Unable to open print preview.');
}

export async function exportPasswordsPdf({ repo, dec, language = 'en', t = (value) => value }) {
  if (!repo || typeof dec !== 'function') throw new Error('Vault is unavailable.');

  const accounts = await collectAccounts(repo, dec, t);
  if (!accounts.length) return { count: 0, filename: '', location: '' };

  const filename = `paskey-passwords-${new Date().toISOString().slice(0, 10)}.pdf`;
  const html = buildHtml(accounts, language, t);

  if (Capacitor.getPlatform() === 'android') {
    const saved = await saveHtmlPdfToDownloads(filename, html);
    return {
      count: accounts.length,
      filename: saved.filename || filename,
      location: saved.location || `Downloads/PasKey/${filename}`,
      saved: saved.saved === true,
    };
  }

  browserPrintFallback(html);
  return {
    count: accounts.length,
    filename,
    location: t('Browser print preview'),
    saved: true,
  };
}
