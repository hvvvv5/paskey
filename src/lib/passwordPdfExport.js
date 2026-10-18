import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CATEGORIES } from '@/lib/categories';

const PAGE_WIDTH_PX = 794;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const CANVAS_SCALE = 1.6;

const clean = (value) => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

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

const websiteLinks = (value) => clean(value)
  .split(/[,;\n]/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const websiteHref = (value) => {
  const text = clean(value);
  if (!text) return '';
  return /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`;
};

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

function reportRoot(language) {
  const root = document.createElement('div');
  root.dir = language === 'ar' ? 'rtl' : 'ltr';
  root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${PAGE_WIDTH_PX}px`,
    background: '#ffffff',
    color: '#111827',
    fontFamily: 'Arial, Tahoma, sans-serif',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.appendChild(root);
  return root;
}

function pageShell(language) {
  const page = document.createElement('section');
  page.dir = language === 'ar' ? 'rtl' : 'ltr';
  Object.assign(page.style, {
    boxSizing: 'border-box',
    width: `${PAGE_WIDTH_PX}px`,
    minHeight: '1123px',
    padding: '52px 54px 58px',
    background: '#ffffff',
    color: '#111827',
    fontFamily: 'Arial, Tahoma, sans-serif',
  });
  return page;
}

function appendHeader(page, title, subtitle = '') {
  const brand = document.createElement('div');
  brand.textContent = 'PASKEY';
  Object.assign(brand.style, {
    fontSize: '12px',
    letterSpacing: '4px',
    fontWeight: '700',
    color: '#9A733D',
    marginBottom: '14px',
  });

  const heading = document.createElement('h1');
  heading.textContent = title;
  Object.assign(heading.style, {
    margin: '0',
    fontSize: '28px',
    lineHeight: '1.25',
    color: '#111827',
  });

  page.append(brand, heading);

  if (subtitle) {
    const sub = document.createElement('p');
    sub.textContent = subtitle;
    Object.assign(sub.style, {
      margin: '10px 0 0',
      fontSize: '13px',
      lineHeight: '1.65',
      color: '#6B7280',
    });
    page.appendChild(sub);
  }

  const rule = document.createElement('div');
  Object.assign(rule.style, {
    height: '2px',
    margin: '22px 0 26px',
    background: '#C8A96B',
  });
  page.appendChild(rule);
}

function appendFooter(page, text) {
  const footer = document.createElement('div');
  footer.textContent = text;
  Object.assign(footer.style, {
    marginTop: '34px',
    paddingTop: '14px',
    borderTop: '1px solid #E5E7EB',
    fontSize: '10px',
    lineHeight: '1.5',
    color: '#9CA3AF',
  });
  page.appendChild(footer);
}

function appendMetric(page, label, value) {
  const box = document.createElement('div');
  Object.assign(box.style, {
    display: 'inline-block',
    minWidth: '155px',
    margin: '0 10px 10px 0',
    padding: '16px 18px',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    background: '#FAFAF9',
  });

  const number = document.createElement('div');
  number.textContent = String(value);
  Object.assign(number.style, {
    fontSize: '27px',
    fontWeight: '700',
    color: '#111827',
  });

  const caption = document.createElement('div');
  caption.textContent = label;
  Object.assign(caption.style, {
    marginTop: '4px',
    fontSize: '11px',
    color: '#6B7280',
  });

  box.append(number, caption);
  page.appendChild(box);
}

function appendWarning(page, text) {
  const warning = document.createElement('div');
  warning.textContent = text;
  Object.assign(warning.style, {
    marginTop: '24px',
    padding: '16px 18px',
    border: '1px solid #F59E0B',
    borderRadius: '12px',
    background: '#FFFBEB',
    color: '#92400E',
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: '1.65',
  });
  page.appendChild(warning);
}

function tableRow(page, labelText, valueText, { password = false, links = [] } = {}) {
  const tr = document.createElement('tr');

  const label = document.createElement('th');
  label.textContent = labelText;
  Object.assign(label.style, {
    boxSizing: 'border-box',
    width: '29%',
    padding: '11px 12px',
    verticalAlign: 'top',
    textAlign: page.dir === 'rtl' ? 'right' : 'left',
    fontWeight: '700',
    color: '#4B5563',
    background: '#F3F4F6',
    borderBottom: '1px solid #E5E7EB',
  });

  const value = document.createElement('td');
  Object.assign(value.style, {
    boxSizing: 'border-box',
    padding: '11px 12px',
    verticalAlign: 'top',
    textAlign: page.dir === 'rtl' ? 'right' : 'left',
    color: password ? '#7C2D12' : '#111827',
    background: '#FFFFFF',
    borderBottom: '1px solid #E5E7EB',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.55',
    fontWeight: password ? '700' : '400',
    fontFamily: password
      ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      : 'Arial, Tahoma, sans-serif',
  });

  if (links.length) {
    links.forEach((link, index) => {
      if (index > 0) value.appendChild(document.createElement('br'));
      const anchor = document.createElement('a');
      anchor.textContent = link;
      anchor.href = websiteHref(link);
      anchor.dataset.pdfLink = anchor.href;
      Object.assign(anchor.style, {
        color: '#1D4ED8',
        textDecoration: 'underline',
        wordBreak: 'break-all',
      });
      value.appendChild(anchor);
    });
  } else {
    value.textContent = valueText || '—';
  }

  tr.append(label, value);
  return tr;
}

function appendAccountTable(page, account, t) {
  const table = document.createElement('table');
  Object.assign(table.style, {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0',
    tableLayout: 'fixed',
    border: '1px solid #D1D5DB',
    borderRadius: '12px',
    overflow: 'hidden',
    fontSize: '12px',
  });

  table.appendChild(tableRow(page, t('Category'), t(account.category.label)));

  for (const field of account.category.fields) {
    if (field.kind === 'avatar' || field.name === 'avatar') continue;
    const value = account.values[field.name];
    if (!clean(value)) continue;

    table.appendChild(tableRow(
      page,
      t(field.label),
      clean(value),
      {
        password: field.name === 'password',
        links: field.name === 'website' ? websiteLinks(value) : [],
      },
    ));
  }

  if (account.item.created_date) {
    table.appendChild(tableRow(
      page,
      t('Created'),
      new Date(account.item.created_date).toLocaleString(),
    ));
  }
  if (account.item.updated_date) {
    table.appendChild(tableRow(
      page,
      t('Last updated'),
      new Date(account.item.updated_date).toLocaleString(),
    ));
  }

  const rows = [...table.rows];
  if (rows.length) {
    const last = rows[rows.length - 1];
    [...last.cells].forEach((cell) => { cell.style.borderBottom = '0'; });
  }

  page.appendChild(table);
}

async function renderPage(pdf, root, page, state) {
  root.appendChild(page);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const rect = page.getBoundingClientRect();
  const anchors = [...page.querySelectorAll('[data-pdf-link]')].map((anchor) => {
    const linkRect = anchor.getBoundingClientRect();
    return {
      href: anchor.dataset.pdfLink,
      left: linkRect.left - rect.left,
      top: linkRect.top - rect.top,
      width: linkRect.width,
      height: linkRect.height,
    };
  });

  const canvas = await html2canvas(page, {
    scale: CANVAS_SCALE,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: false,
  });

  const mmPerCssPx = A4_WIDTH_MM / rect.width;
  const pageCssHeight = A4_HEIGHT_MM / mmPerCssPx;
  const sourceScale = canvas.width / rect.width;
  const totalSlices = Math.max(1, Math.ceil(rect.height / pageCssHeight));

  for (let sliceIndex = 0; sliceIndex < totalSlices; sliceIndex += 1) {
    if (state.used) pdf.addPage('a4', 'portrait');

    const cssTop = sliceIndex * pageCssHeight;
    const cssHeight = Math.min(pageCssHeight, rect.height - cssTop);
    const srcY = Math.round(cssTop * sourceScale);
    const srcHeight = Math.max(1, Math.min(
      canvas.height - srcY,
      Math.ceil(cssHeight * sourceScale),
    ));

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = srcHeight;
    const ctx = slice.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      srcY,
      canvas.width,
      srcHeight,
      0,
      0,
      slice.width,
      srcHeight,
    );

    const img = slice.toDataURL('image/jpeg', 0.94);
    pdf.addImage(
      img,
      'JPEG',
      0,
      0,
      A4_WIDTH_MM,
      cssHeight * mmPerCssPx,
      undefined,
      'FAST',
    );

    anchors.forEach((link) => {
      const linkBottom = link.top + link.height;
      const sliceBottom = cssTop + cssHeight;
      if (linkBottom <= cssTop || link.top >= sliceBottom) return;

      const clippedTop = Math.max(link.top, cssTop);
      const clippedBottom = Math.min(linkBottom, sliceBottom);
      pdf.link(
        link.left * mmPerCssPx,
        (clippedTop - cssTop) * mmPerCssPx,
        Math.max(1, link.width * mmPerCssPx),
        Math.max(1, (clippedBottom - clippedTop) * mmPerCssPx),
        { url: link.href },
      );
    });

    slice.width = 1;
    slice.height = 1;
    state.used = true;
  }

  canvas.width = 1;
  canvas.height = 1;
  page.remove();
}

function downloadPdf(pdf) {
  const filename = `paskey-passwords-${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}

export async function exportPasswordsPdf({ repo, dec, language = 'en', t = (value) => value }) {
  if (!repo || typeof dec !== 'function') throw new Error('Vault is unavailable.');

  const accounts = await collectAccounts(repo, dec, t);
  if (!accounts.length) return { count: 0, filename: '' };

  const root = reportRoot(language);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const state = { used: false };

  try {
    const cover = pageShell(language);
    appendHeader(
      cover,
      t('PasKey Password Report'),
      t('A local plaintext export of the saved accounts in this unlocked vault.'),
    );
    appendMetric(cover, t('Accounts'), accounts.length);
    appendMetric(
      cover,
      t('Generated'),
      new Date().toLocaleDateString(language === 'ar' ? 'ar' : undefined),
    );
    appendWarning(
      cover,
      t('Sensitive PDF warning: this file contains readable passwords and other account details. Store it securely and do not share it.'),
    );

    const list = document.createElement('div');
    Object.assign(list.style, {
      marginTop: '28px',
      fontSize: '12px',
      lineHeight: '1.8',
      color: '#374151',
    });
    accounts.forEach((account, index) => {
      const row = document.createElement('div');
      row.textContent = `${index + 1}. ${account.title} — ${t(account.category.label)}`;
      row.style.borderBottom = '1px solid #F3F4F6';
      row.style.padding = '6px 0';
      list.appendChild(row);
    });
    cover.appendChild(list);
    appendFooter(cover, t('Generated locally by PasKey. No vault data was uploaded.'));
    await renderPage(pdf, root, cover, state);

    for (let index = 0; index < accounts.length; index += 1) {
      const account = accounts[index];
      const page = pageShell(language);
      appendHeader(
        page,
        account.title,
        `${t(account.category.label)} · ${index + 1}/${accounts.length}`,
      );
      appendAccountTable(page, account, t);
      appendFooter(
        page,
        t('Sensitive plaintext export — protect this PDF like your Master Password.'),
      );
      await renderPage(pdf, root, page, state);
    }

    return {
      count: accounts.length,
      filename: downloadPdf(pdf),
    };
  } finally {
    root.remove();
  }
}
