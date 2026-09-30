import { useState, useMemo, useEffect } from 'react';
import type { Person, Partner, SendLog, FieldDef } from '../../types';
import { bn } from '../../i18n/bn';
import { db } from '../../db';
import { generateBiodataSummary } from '../../utils/summary';
import {
  X,
  Share2,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Shield,
  Send,
  Users,
} from 'lucide-react';

interface BulkShareModalProps {
  people: Person[];
  partnersMap: Map<string, Partner>;
  recentSendLogs: SendLog[];
  onClose: () => void;
  onSaveSendLogs: (recipient: string, personIds: string[]) => Promise<void>;
}

export function BulkShareModal({
  people,
  partnersMap,
  recentSendLogs,
  onClose,
  onSaveSendLogs,
}: BulkShareModalProps) {
  const [step, setStep] = useState<'select' | 'log'>('select');
  const [redacted, setRedacted] = useState(true); // Default redacted every time
  const [includeBasic, setIncludeBasic] = useState(true);
  const [includeEducation, setIncludeEducation] = useState(true);
  const [fieldDefsMap, setFieldDefsMap] = useState<Map<string, FieldDef>>(new Map());

  const [copied, setCopied] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  useEffect(() => {
    db.fieldDefs.toArray().then((defs) => {
      const map = new Map<string, FieldDef>();
      for (const d of defs) {
        map.set(d.id, d);
      }
      setFieldDefsMap(map);
    });
  }, []);

  // Combined text summary of all selected clients separated by dividers
  const combinedSummary = useMemo(() => {
    if (people.length === 0) return '';
    return people
      .map((p, idx) => {
        const text = generateBiodataSummary(p, {
          includeBasic,
          includeEducation,
          fieldDefsMap,
          redacted,
        });
        const divider = idx > 0 ? '\n\n' + '═'.repeat(25) + '\n\n' : '';
        return divider + text;
      })
      .join('');
  }, [people, includeBasic, includeEducation, fieldDefsMap, redacted]);

  // Extract recent recipients list (unique)
  const recentRecipients = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    for (const log of recentSendLogs) {
      const name = log.recipient?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        list.push(name);
        if (list.length >= 6) break;
      }
    }
    return list;
  }, [recentSendLogs]);

  // Check if any person has partner source
  const hasPartnerRecords = useMemo(() => {
    return people.some((p) => !!p.sourceId);
  }, [people]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(combinedSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    let sharedSuccessfully = false;

    if (navigator.share) {
      try {
        await navigator.share({ text: combinedSummary });
        sharedSuccessfully = true;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(combinedSummary)}`;
          window.open(waUrl, '_blank');
          sharedSuccessfully = true;
        }
      }
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(combinedSummary)}`;
      window.open(waUrl, '_blank');
      sharedSuccessfully = true;
    }

    if (sharedSuccessfully) {
      setStep('log');
    }
  };

  const handleConfirmLog = async () => {
    if (!recipient.trim()) {
      onClose();
      return;
    }

    setIsSavingLog(true);
    try {
      await onSaveSendLogs(
        recipient.trim(),
        people.map((p) => p.id)
      );
      onClose();
    } finally {
      setIsSavingLog(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {step === 'select'
                ? `${bn.people.bulkShareTitle} (${people.length} জন)`
                : bn.sent.recipientPrompt}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-full"
            aria-label={bn.actions.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'select' ? (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Selected Candidates Badges */}
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
              {people.map((p) => {
                const partner = p.sourceId ? partnersMap.get(p.sourceId) : undefined;
                return (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white text-gray-800 border border-gray-300 shadow-2xs"
                  >
                    <span>{p.code}</span>
                    {p.name && !redacted ? (
                      <span className="font-sans text-gray-600 font-normal">({p.name})</span>
                    ) : null}
                    {partner ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-sans">
                        {partner.name}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>

            {/* Redaction Mode Toggle */}
            <div className="bg-gray-100 p-1 rounded-xl flex gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setRedacted(true)}
                className={`touch-target flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  redacted
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>{bn.sent.redactedOption}</span>
              </button>
              <button
                type="button"
                onClick={() => setRedacted(false)}
                className={`touch-target flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  !redacted
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{bn.sent.fullOption}</span>
              </button>
            </div>

            {redacted ? (
              <p className="text-xs text-gray-500 px-1 -mt-2">
                🔒 {bn.sent.redactedNotice}
              </p>
            ) : null}

            {/* Partner Notice if applicable */}
            {hasPartnerRecords ? (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-amber-900">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>নির্বাচিত বায়োডাটার মধ্যে সহযোগীদের সরবরাহকৃত রেকর্ড রয়েছে।</span>
              </div>
            ) : null}

            {/* Section Toggles */}
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 space-y-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                অন্তর্ভুক্ত সেকশন
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={includeBasic}
                    onChange={(e) => setIncludeBasic(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span>{bn.sent.sectionBasic}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={includeEducation}
                    onChange={(e) => setIncludeEducation(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span>{bn.sent.sectionEducation}</span>
                </label>
              </div>
            </div>

            {/* Combined Text Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  সারসংক্ষেপ প্রিভিউ
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="touch-target inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>কপি হয়েছে!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-emerald-600" />
                      <span>কপি করুন</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                readOnly
                rows={6}
                value={combinedSummary}
                className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl p-3 leading-relaxed text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Share and Copy buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleCopyText}
                className="touch-target flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{bn.sent.copySummaryText}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="touch-target flex-1 py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>{bn.sent.shareViaWhatsApp}</span>
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: "কাকে পাঠালেন?" Follow-up Prompt */
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              পরবর্তীতে ফলো-আপ করার জন্য কার কাছে এই বায়োডাটাগুলো পাঠালেন তার নাম লিখে রাখুন।
            </p>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {bn.sent.recipientPrompt}
              </label>
              <input
                type="text"
                autoFocus
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={bn.sent.recipientPlaceholder}
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmLog();
                  }
                }}
              />
            </div>

            {/* Recent Recipients Chips */}
            {recentRecipients.length > 0 ? (
              <div>
                <span className="text-xs font-bold text-gray-400 block mb-1.5">
                  {bn.sent.recentRecipients}
                </span>
                <div className="flex flex-wrap gap-2">
                  {recentRecipients.map((rec) => (
                    <button
                      key={rec}
                      type="button"
                      onClick={() => setRecipient(rec)}
                      className="touch-target px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-medium transition"
                    >
                      {rec}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingLog}
                className="touch-target flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                {bn.actions.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmLog}
                disabled={isSavingLog}
                className="touch-target flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>{bn.actions.save}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
