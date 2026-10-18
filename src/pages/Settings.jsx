import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, FileText, Fingerprint, Trash2, Upload } from 'lucide-react';
import { useVault } from '@/components/paskey/VaultContext';
import { buildBackup, downloadBackup, restoreBackup } from '@/lib/backup';
import { exportPasswordsPdf } from '@/lib/passwordPdfExport';
import { authenticateSensitiveAction } from '@/lib/native/PasKeySecurity';
import NativeNotice from '@/components/paskey/NativeNotice';
import ChangeMasterPassword from '@/components/paskey/ChangeMasterPassword';
import SettingsSelect from '@/components/paskey/SettingsSelect';
import DeleteAccountDialog from '@/components/paskey/DeleteAccountDialog';
import { useI18n } from '@/lib/i18n';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const LOCK_OPTIONS = [[0, 'Immediately'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [-1, 'Never']];
const CLIPBOARD_OPTIONS = [0, 15, 30, 60].map((seconds) => [seconds, seconds === 0 ? 'Never' : `${seconds} seconds`]);
const THEME_OPTIONS = [['system', 'System'], ['dark', 'Dark'], ['cream', 'Cream'], ['pro', 'Pro']];

function Row({ children }) {
  return <div className="flex items-center gap-3 border-b border-white/5 py-4 text-sm">{children}</div>;
}

export default function Settings() {
  const {
    settings,
    updateSettings,
    config,
    repo,
    enc,
    dec,
    verifyMasterPassword,
    enableBiometricUnlock,
    disableBiometricUnlock,
  } = useVault();
  const [msg, setMsg] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [biometricBusy, setBiometricBusy] = useState(false);
  const fileRef = useRef(null);
  const { language, setLanguage, t } = useI18n();

  const exportBackup = async () => {
    setMsg('');
    try {
      downloadBackup(await buildBackup(repo, config, enc));
      setMsg(t('Encrypted backup created.'));
    } catch {
      setMsg(t('Unable to create encrypted backup.'));
    }
  };

  const openPdfExport = () => {
    setPdfPassword('');
    setPdfError('');
    setPdfOpen(true);
  };

  const createPasswordReport = async () => {
    const result = await exportPasswordsPdf({
      repo,
      dec,
      language,
      t,
    });

    if (!result.count) {
      setPdfError(t('No saved passwords are available to export.'));
      return false;
    }

    setPdfPassword('');
    setPdfOpen(false);
    setMsg(
      language === 'ar'
        ? `تم إنشاء تقرير PDF لـ ${result.count} حسابًا وحفظه في: ${result.location || result.filename}`
        : `Created a PDF report for ${result.count} accounts and saved it to: ${result.location || result.filename}`,
    );
    return true;
  };

  const exportPasswordReport = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfError('');
    setMsg('');
    try {
      const verified = await verifyMasterPassword(pdfPassword);
      if (!verified) {
        setPdfError(t('Incorrect Master Password.'));
        return;
      }
      await createPasswordReport();
    } catch {
      setPdfError(t('Unable to create the password PDF report.'));
    } finally {
      setPdfBusy(false);
    }
  };

  const exportPasswordReportWithBiometrics = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfError('');
    setMsg('');
    try {
      const verified = await authenticateSensitiveAction();
      if (!verified) {
        setPdfError(t('Biometric authentication was not completed.'));
        return;
      }
      await createPasswordReport();
    } catch {
      setPdfError(t('Biometric authentication was not completed.'));
    } finally {
      setPdfBusy(false);
    }
  };

  const onRestore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMsg('');
    try {
      const count = await restoreBackup(file, repo, config, dec);
      setMsg(language === 'ar' ? `تمت استعادة ${count} عنصرًا مشفّرًا.` : `Restored ${count} encrypted items.`);
    } catch (error) {
      setMsg(t(error.message || 'Unable to restore this backup.'));
    } finally {
      event.target.value = '';
    }
  };

  const toggleBiometrics = async (enabled) => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    setMsg('');
    try {
      if (enabled) {
        const result = await enableBiometricUnlock();
        setMsg(t(result.message));
      } else {
        await disableBiometricUnlock();
        setMsg(t('Biometric unlock was disabled. Your Master Password still protects the vault.'));
      }
    } finally {
      setBiometricBusy(false);
    }
  };

  return (
    <div className="px-5 pb-32 pt-6">
      <div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">{t("PasKey preferences")}</p>
          <h1 className="mt-1 font-heading text-2xl text-white">{t("Settings")}</h1>
        </div>
      </div>
      <h2 className="mt-6 text-xs uppercase tracking-widest text-[#AEB4BE]">{t("Security")}</h2>
      <ChangeMasterPassword />

      <Row>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-white"><Fingerprint className="h-4 w-4 text-[#C8A96B]" />{t('Biometric unlock')}</span>
        <input type="checkbox" aria-label={t('Biometric unlock')} checked={settings.biometricUnlock} disabled={biometricBusy} onChange={(event) => toggleBiometrics(event.target.checked)} className="h-5 w-5 accent-[#C8A96B] disabled:opacity-50" />
      </Row>
      <p className="mt-2 w-full text-xs leading-5 text-[#AEB4BE]/70">{t('Use a fingerprint or supported secure face unlock on your device. Your Master Password always remains available.')}</p>

      <Row>
        <span className="flex-1 text-white">{t('Auto lock')}</span>
        <SettingsSelect ariaLabel={t('Auto lock')} value={settings.autoLockMinutes} onValueChange={(value) => updateSettings({ autoLockMinutes: value })} options={LOCK_OPTIONS.map(([value, label]) => [value, t(label)])} triggerClass="w-40 rounded-xl" />
      </Row>
      <Row>
        <span className="flex-1 text-white">{t('Clear clipboard after')}</span>
        <SettingsSelect ariaLabel={t('Clear clipboard after')} value={settings.clipboardClearSeconds} onValueChange={(value) => updateSettings({ clipboardClearSeconds: value })} options={CLIPBOARD_OPTIONS.map(([value, label]) => [value, t(label)])} triggerClass="w-40 rounded-xl" />
      </Row>
      <Row>
        <span className="flex-1 text-white">{t('Screenshot protection')}</span>
        <input type="checkbox" aria-label={t('Screenshot protection')} checked={settings.screenshotProtection} onChange={(event) => updateSettings({ screenshotProtection: event.target.checked })} className="h-5 w-5 accent-[#C8A96B]" />
      </Row>
      <Row>
        <span className="flex-1 text-white">{t('Require authentication to reveal secrets')}</span>
        <input type="checkbox" aria-label={t('Require authentication to reveal secrets')} checked={settings.requireAuthToReveal} onChange={(event) => updateSettings({ requireAuthToReveal: event.target.checked })} className="h-5 w-5 accent-[#C8A96B]" />
      </Row>

      <div className="pk-settings-security-notice mt-4"><NativeNotice>{t('Autofill and the biometric prompt run in the native Android layer. Each Autofill choice is authenticated before PasKey returns any saved value to another app or website.')}</NativeNotice></div>

      <h2 className="mt-8 text-xs uppercase tracking-widest text-[#AEB4BE]">{t("Appearance")}</h2>
      <Row>
        <label htmlFor="language" className="flex-1 text-white">{t("Language")}</label>
        <select id="language" value={language} onChange={(event) => setLanguage(event.target.value)} className="pk-themed-control w-40 rounded-xl border px-3 py-2 text-sm outline-none">
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </Row>
      <Row>
        <label htmlFor="theme" className="flex-1 text-white">{t('Color theme')}</label>
        <select
          id="theme"
          value={settings.theme || 'dark'}
          onChange={(event) => updateSettings({ theme: event.target.value })}
          className="pk-themed-control w-40 rounded-xl border px-3 py-2 text-sm outline-none"
        >
          {THEME_OPTIONS.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
        </select>
      </Row>

      <h2 className="mt-8 text-xs uppercase tracking-widest text-[#AEB4BE]">{t("Vault")}</h2>
      <Row>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-white">
          <FileText className="h-4 w-4 shrink-0 text-[#C8A96B]" />
          <span>{t('Password PDF report')}</span>
        </span>
        <button
          type="button"
          onClick={openPdfExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
          {t('Export PDF')}
        </button>
      </Row>
      <p className="mt-2 text-[11px] leading-relaxed text-[#AEB4BE]/70">
        {t('Creates a readable PDF with saved accounts, passwords, important details and website links. Fingerprint or Master Password verification is required.')}
      </p>

      <Row>
        <span className="flex-1 text-white">{t('Encrypted backup')}</span>
        <button type="button" onClick={exportBackup} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white"><Download className="h-3.5 w-3.5" /> {t('Export')}</button>
      </Row>
      <Row>
        <span className="flex-1 text-white">{t('Restore from backup')}</span>
        <input ref={fileRef} type="file" accept=".json" onChange={onRestore} className="hidden" />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#AEB4BE] hover:border-[#C8A96B]/50 hover:text-white"><Upload className="h-3.5 w-3.5" /> {t('Restore')}</button>
      </Row>
      {msg ? <p className="mt-3 text-xs" style={{ color: '#C8A96B' }}>{msg}</p> : null}
      <p className="mt-2 text-[11px] leading-relaxed text-[#AEB4BE]/70">{t('The backup contains encrypted vault records, never the Master Password or plaintext CSV data.')}</p>

      <h2 className="mt-8 text-xs uppercase tracking-widest text-[#AEB4BE]">{t("Privacy & platform")}</h2>
      <Link to="/privacy" className="flex items-center gap-3 border-b border-white/5 py-4 text-sm text-white"><span className="flex-1">{t('Privacy & local data')}</span><ChevronRight className="h-4 w-4 text-[#AEB4BE]" /></Link>

      <h2 className="mt-10 text-xs uppercase tracking-widest text-red-400/80">{t("Danger zone")}</h2>
      <p className="mt-2 text-xs leading-relaxed text-[#AEB4BE]">{t('Erasing your vault permanently removes its encrypted records, native Autofill cache and biometric unlock wrapper from this device. There is no cloud copy and no recovery.')}</p>
      <button type="button" onClick={() => setDeleteOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 active:scale-[0.98]"><Trash2 className="h-4 w-4" /> {t('Erase local vault')}</button>
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />

      <Dialog open={pdfOpen} onOpenChange={(open) => {
        if (pdfBusy) return;
        setPdfOpen(open);
        if (!open) {
          setPdfPassword('');
          setPdfError('');
        }
      }}>
        <DialogContent className="pk-pdf-dialog">
          <DialogHeader>
            <DialogTitle>{t('Export passwords to PDF')}</DialogTitle>
            <DialogDescription className="pk-pdf-dialog-description leading-relaxed">
              {t('This PDF is not encrypted. It will contain readable passwords and other account details. Keep it in a secure location and never share it unless you intend to reveal those secrets.')}
            </DialogDescription>
          </DialogHeader>

          <div className="pk-pdf-warning mt-2 rounded-xl border p-3 text-xs leading-relaxed">
            {t('The report is generated locally on this device. PasKey does not upload the PDF or its contents.')}
          </div>

          <button
              type="button"
              onClick={exportPasswordReportWithBiometrics}
              disabled={pdfBusy}
              className="pk-pdf-biometric-button mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              <Fingerprint className="h-5 w-5" />
              {pdfBusy ? t('Authenticating…') : t('Use fingerprint')}
            </button>

          <div className="pk-pdf-divider flex items-center gap-3 text-[11px]">
            <span className="h-px flex-1" />
            <span>{t('or use Master Password')}</span>
            <span className="h-px flex-1" />
          </div>

          <label className="mt-1 block text-sm">
            <span className="pk-pdf-muted mb-2 block text-xs">{t('Master Password')}</span>
            <input
              type="password"
              value={pdfPassword}
              onChange={(event) => setPdfPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && pdfPassword && !pdfBusy) exportPasswordReport();
              }}
              autoComplete="current-password"
              autoFocus
              className="pk-themed-control pk-pdf-input w-full rounded-xl border px-3 py-3 outline-none"
              placeholder={t('Enter Master Password to continue')}
            />
          </label>

          {pdfError ? <p role="alert" className="pk-status pk-status-error rounded-xl border p-3 text-xs">{pdfError}</p> : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setPdfOpen(false)}
              disabled={pdfBusy}
              className="pk-pdf-secondary-button rounded-xl border px-4 py-3 text-sm disabled:opacity-50"
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              onClick={exportPasswordReport}
              disabled={pdfBusy || !pdfPassword}
              className="pk-pdf-primary-button rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {pdfBusy ? t('Creating PDF…') : t('Create PDF')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-8 text-center text-[11px] text-[#AEB4BE]/60">{t('PasKey · local-first vault')}</p>
    </div>
  );
}
