import { useState, useRef } from 'react';
import { bn } from '../../i18n/bn';
import { exportBackupZip, restoreBackupZip } from '../../utils/backup';
import { hashPin, verifyPin, type PinHashData } from '../../utils/security';
import {
  Download,
  Upload,
  Lock,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  KeyRound,
  Check,
  X,
} from 'lucide-react';
import { CustomFieldsCatalogSection } from './CustomFieldsCatalogSection';

interface SettingsScreenProps {
  lastBackupAt?: number;
  pinHash?: PinHashData;
  isStoragePersistent: boolean;
  onRefreshData: () => Promise<void>;
  onSavePin: (hashData?: PinHashData) => Promise<void>;
  onClose: () => void;
}

export function SettingsScreen({
  lastBackupAt,
  pinHash,
  isStoragePersistent,
  onRefreshData,
  onSavePin,
  onClose,
}: SettingsScreenProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Restore Modal State
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PIN Setup Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const hasPin = !!pinHash?.hash;

  const handleExport = async () => {
    setIsExporting(true);
    setFeedbackMessage(null);
    try {
      const { zipBlob, filename } = await exportBackupZip();
      const zipFile = new File([zipBlob], filename, { type: 'application/zip' });

      // Deliver via navigator.share if available, else download fallback (SPEC 5.11)
      let shared = false;
      if (navigator.canShare && navigator.canShare({ files: [zipFile] })) {
        try {
          await navigator.share({
            title: filename,
            files: [zipFile],
          });
          shared = true;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }

      if (!shared) {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      await onRefreshData();
      setFeedbackMessage({ text: bn.messages.backupCreated, type: 'success' });
    } catch {
      setFeedbackMessage({ text: 'ব্যাকআপ তৈরিতে সমস্যা হয়েছে', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedZipFile(e.target.files[0]);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedZipFile) return;
    setIsRestoring(true);
    setFeedbackMessage(null);
    try {
      const result = await restoreBackupZip(selectedZipFile, restoreMode);
      await onRefreshData();
      setFeedbackMessage({
        text: bn.messages.restoreSuccess.replace('{count}', String(result.people)),
        type: 'success',
      });
      setSelectedZipFile(null);
    } catch {
      setFeedbackMessage({
        text: bn.messages.restoreError,
        type: 'error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSavePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    // If changing PIN, verify current PIN first
    if (hasPin && pinHash) {
      const isCurrentValid = await verifyPin(currentPinInput, pinHash);
      if (!isCurrentValid) {
        setPinError(bn.settings.pinIncorrect);
        return;
      }
    }

    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setPinError('পিন অবশ্যই ৪ সংখ্যার হতে হবে');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinError(bn.settings.pinMismatch);
      return;
    }

    const hashed = await hashPin(newPinInput);
    await onSavePin(hashed);
    setIsPinModalOpen(false);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setFeedbackMessage({ text: 'পিন সফলভাবে সংরক্ষিত হয়েছে', type: 'success' });
  };

  const handleRemovePin = async () => {
    const ok = window.confirm('আপনি কি নিশ্চিত যে পিন লক সরাতে চান?');
    if (ok) {
      await onSavePin(undefined);
      setFeedbackMessage({ text: 'পিন লক সরানো হয়েছে', type: 'success' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{bn.settings.title}</h2>
          <p className="text-sm text-gray-500">ডাটা সংরক্ষণ ও নিরাপত্তা নিয়ন্ত্রণ</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="touch-target px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition"
        >
          {bn.actions.back}
        </button>
      </div>

      {feedbackMessage ? (
        <div
          className={`p-4 rounded-2xl text-sm font-medium border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          {feedbackMessage.text}
        </div>
      ) : null}

      {/* 1. Backup & Restore Section */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <HardDrive className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-gray-900">
            {bn.settings.backupSection}
          </h3>
        </div>

        {/* Privacy Notice Banner (SPEC 9) */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">{bn.settings.backupPrivacyNotice}</p>
        </div>

        {/* Last backup info */}
        <div className="text-sm text-gray-600">
          <span className="font-semibold">সর্বশেষ ব্যাকআপ:</span>{' '}
          {lastBackupAt ? (
            <span className="text-gray-900 font-medium">
              {new Date(lastBackupAt).toLocaleString('bn-BD')}
            </span>
          ) : (
            <span className="text-red-600 font-medium">
              {bn.settings.neverBackedUp}
            </span>
          )}
        </div>

        {/* Storage Persist Status */}
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            {isStoragePersistent
              ? 'ফোনের স্টোরেজ স্থায়ী মোডে সংরক্ষিত আছে।'
              : bn.home.storageNotPersistent}
          </span>
        </div>

        {/* Export & Import Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="touch-target flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span>{isExporting ? 'প্রস্তুত হচ্ছে...' : bn.actions.exportBackup}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="touch-target flex items-center justify-center gap-2 py-3 px-4 bg-white border-2 border-emerald-600 text-emerald-800 hover:bg-emerald-50 rounded-xl font-bold shadow-sm transition"
          >
            <Upload className="w-5 h-5 text-emerald-600" />
            <span>{bn.actions.importBackup}</span>
          </button>
        </div>
      </section>

      {/* 2. App Lock (PIN) Section (SPEC 5.12) */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Lock className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-gray-900">{bn.settings.pinSection}</h3>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800 text-base">
              {hasPin ? bn.settings.pinEnabled : bn.settings.pinDisabled}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              অ্যাপ খুললে এবং ব্যাকগ্রাউন্ডে ২ মিনিট থাকলে লক হবে
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasPin ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(true);
                    setPinError('');
                  }}
                  className="touch-target px-3.5 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl transition"
                >
                  {bn.actions.changePin}
                </button>
                <button
                  type="button"
                  onClick={handleRemovePin}
                  className="touch-target px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition"
                >
                  {bn.actions.removePin}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(true);
                  setPinError('');
                }}
                className="touch-target flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
              >
                <KeyRound className="w-4 h-4" />
                <span>{bn.actions.setPin}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Custom Fields Catalog Section (SPEC-UPDATE-1 3.4) */}
      <CustomFieldsCatalogSection />

      {/* Restore Confirmation Modal */}
      {selectedZipFile ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              রিস্টোর মোড নির্বাচন করুন
            </h3>
            <p className="text-sm text-gray-600">
              ফাইল: <span className="font-mono font-semibold">{selectedZipFile.name}</span>
            </p>

            <div className="space-y-2">
              <label
                onClick={() => setRestoreMode('merge')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  restoreMode === 'merge'
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="mt-1 text-emerald-600"
                />
                <div>
                  <span className="font-bold text-sm text-gray-900 block">
                    মার্জ করুন (Merge - প্রস্তাবিত)
                  </span>
                  <span className="text-xs text-gray-500 block mt-0.5">
                    {bn.settings.restoreWarning}
                  </span>
                </div>
              </label>

              <label
                onClick={() => setRestoreMode('replace')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  restoreMode === 'replace'
                    ? 'border-red-500 bg-red-50/50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="mt-1 text-red-600"
                />
                <div>
                  <span className="font-bold text-sm text-red-900 block">
                    সব মুছে নতুন করে প্রতিস্থাপন করুন (Replace all)
                  </span>
                  <span className="text-xs text-red-600 block mt-0.5">
                    সতর্কতা: বর্তমান সব রেকর্ড মুছে ব্যাকআপের তথ্য বসবে!
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedZipFile(null)}
                disabled={isRestoring}
                className="touch-target flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold"
              >
                {bn.actions.cancel}
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="touch-target flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
              >
                {isRestoring ? 'রিস্টোর হচ্ছে...' : bn.actions.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Set/Change PIN Modal */}
      {isPinModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {hasPin ? bn.actions.changePin : bn.actions.setPin}
              </h3>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePinSubmit} className="space-y-4">
              {pinError ? (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {pinError}
                </p>
              ) : null}

              {hasPin ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    বর্তমান পিন
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-center font-mono text-xl tracking-widest"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {bn.settings.enterNewPin}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-center font-mono text-xl tracking-widest"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {bn.settings.confirmPin}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-center font-mono text-xl tracking-widest"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="touch-target flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold"
                >
                  {bn.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="touch-target flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold"
                >
                  <Check className="w-4 h-4 inline mr-1" />
                  <span>{bn.actions.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
