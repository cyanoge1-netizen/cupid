import { useState, useMemo, useEffect } from 'react';
import type { Person, Partner, SendLog, FieldDef } from '../../types';
import { bn } from '../../i18n/bn';
import { db } from '../../db';
import { generateBiodataSummary } from '../../utils/summary';
import { BlobImage } from '../common/BlobImage';
import {
  X,
  Share2,
  Copy,
  Check,
  AlertCircle,
  FileText,
  User,
  Send,
  Star,
  Shield,
} from 'lucide-react';

const SHARE_PREFS_KEY = 'ghotkali_share_preferences';

interface SharePreferences {
  includeBasic: boolean;
  includeEducation: boolean;
  selectedCustomFieldIds: string[];
  redacted: boolean;
  redactCode: boolean;
  redactName: boolean;
  redactParents: boolean;
  redactVillage: boolean;
  redactContact: boolean;
}

function loadSharePrefs(): SharePreferences {
  try {
    const raw = localStorage.getItem(SHARE_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        includeBasic: typeof parsed.includeBasic === 'boolean' ? parsed.includeBasic : true,
        includeEducation: typeof parsed.includeEducation === 'boolean' ? parsed.includeEducation : true,
        selectedCustomFieldIds: Array.isArray(parsed.selectedCustomFieldIds) ? parsed.selectedCustomFieldIds : [],
        redacted: typeof parsed.redacted === 'boolean' ? parsed.redacted : true,
        redactCode: typeof parsed.redactCode === 'boolean' ? parsed.redactCode : true,
        redactName: typeof parsed.redactName === 'boolean' ? parsed.redactName : true,
        redactParents: typeof parsed.redactParents === 'boolean' ? parsed.redactParents : true,
        redactVillage: typeof parsed.redactVillage === 'boolean' ? parsed.redactVillage : true,
        redactContact: typeof parsed.redactContact === 'boolean' ? parsed.redactContact : true,
      };
    }
  } catch {}
  return {
    includeBasic: true,
    includeEducation: true,
    selectedCustomFieldIds: [],
    redacted: true,
    redactCode: true,
    redactName: true,
    redactParents: true,
    redactVillage: true,
    redactContact: true,
  };
}

function saveSharePrefs(prefs: SharePreferences) {
  try {
    localStorage.setItem(SHARE_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

interface ShareModalProps {
  person: Person;
  partner?: Partner;
  recentSendLogs: SendLog[];
  onClose: () => void;
  onSaveSendLog: (recipient: string) => Promise<void>;
}

export function ShareModal({
  person,
  partner,
  recentSendLogs,
  onClose,
  onSaveSendLog,
}: ShareModalProps) {
  // Step 1: Selection screen, Step 2: "কাকে পাঠালেন?" prompt
  const [step, setStep] = useState<'select' | 'log'>('select');

  // Preferences for sections (SPEC-UPDATE-1 3.7)
  const [prefs, setPrefs] = useState<SharePreferences>(loadSharePrefs);
  const [fieldDefsMap, setFieldDefsMap] = useState<Map<string, FieldDef>>(new Map());

  useEffect(() => {
    db.fieldDefs.toArray().then((defs) => {
      const map = new Map<string, FieldDef>();
      for (const d of defs) {
        map.set(d.id, d);
      }
      setFieldDefsMap(map);
    });
  }, []);

  const updatePrefs = (updater: (prev: SharePreferences) => SharePreferences) => {
    setPrefs((prev) => {
      const updated = updater(prev);
      saveSharePrefs(updated);
      return updated;
    });
  };

  // Choices: cover photo selected by default (SPEC-UPDATE-1 3.7)
  const effectiveCoverId = person.coverPhotoId || (person.photos && person.photos.length > 0 ? person.photos[0].id : undefined);
  const [includeText, setIncludeText] = useState(true);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>(() => {
    return effectiveCoverId ? [effectiveCoverId] : [];
  });
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const [copied, setCopied] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  const formattedSummary = useMemo(
    () =>
      generateBiodataSummary(person, {
        includeBasic: prefs.includeBasic,
        includeEducation: prefs.includeEducation,
        selectedExtraFieldIds: prefs.selectedCustomFieldIds,
        fieldDefsMap,
        redacted: prefs.redacted,
        redactCode: prefs.redactCode,
        redactName: prefs.redactName,
        redactParents: prefs.redactParents,
        redactVillage: prefs.redactVillage,
        redactContact: prefs.redactContact,
      }),
    [person, prefs, fieldDefsMap]
  );

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

  const togglePhoto = (id: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formattedSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    const filesToShare: File[] = [];

    // Convert selected photos to File objects with proper filenames
    for (const p of person.photos || []) {
      if (selectedPhotoIds.includes(p.id)) {
        const ext = p.mime.split('/')[1] || 'jpg';
        const file = new File([p.blob], `${person.code}_photo_${p.id}.${ext}`, {
          type: p.mime,
        });
        filesToShare.push(file);
      }
    }

    // Convert selected docs to File objects
    for (const d of person.docs || []) {
      if (selectedDocIds.includes(d.id)) {
        const file = new File([d.blob], d.name || `${person.code}_doc`, {
          type: d.mime,
        });
        filesToShare.push(file);
      }
    }

    const shareData: ShareData = {};
    if (includeText) {
      shareData.text = formattedSummary;
    }

    let sharedSuccessfully = false;

    // Feature-detect navigator.canShare and navigator.share
    if (
      filesToShare.length > 0 &&
      navigator.canShare &&
      navigator.canShare({ files: filesToShare })
    ) {
      shareData.files = filesToShare;
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        sharedSuccessfully = true;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // If share with files failed (e.g. platform limitation), try sharing text only
          if (includeText) {
            try {
              await navigator.share({ text: formattedSummary });
              sharedSuccessfully = true;
            } catch {
              // Ignore
            }
          }
        }
      }
    } else {
      // Fallback for browsers without Web Share: open WhatsApp URL with encoded text
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
        formattedSummary
      )}`;
      window.open(waUrl, '_blank');
      sharedSuccessfully = true;
    }

    // Prompt "কাকে পাঠালেন?" if shared or opened
    if (sharedSuccessfully) {
      setStep('log');
    }
  };

  const handleSaveLog = async () => {
    if (!recipient.trim()) {
      onClose();
      return;
    }
    setIsSavingLog(true);
    try {
      await onSaveSendLog(recipient.trim());
      onClose();
    } finally {
      setIsSavingLog(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {step === 'select' ? bn.sent.chooseItemsToShare : bn.sent.recipientPrompt}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Select items to share */}
        {step === 'select' ? (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Partner Record Notice (SPEC 5.10) */}
            {partner ? (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2.5 text-sm font-semibold text-amber-900">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>
                  {bn.source.partnerWarning.replace('{partner}', partner.name)}
                </span>
              </div>
            ) : null}

            {/* Redaction Mode Toggle */}
            <div className="bg-gray-100 p-1 rounded-xl flex gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => updatePrefs((p) => ({ ...p, redacted: true }))}
                className={`touch-target flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  prefs.redacted
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>{bn.sent.redactedOption}</span>
              </button>
              <button
                type="button"
                onClick={() => updatePrefs((p) => ({ ...p, redacted: false }))}
                className={`touch-target flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  !prefs.redacted
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{bn.sent.fullOption}</span>
              </button>
            </div>

            {/* Granular Redaction Options (shown when redacted mode is ON) */}
            {prefs.redacted ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  {bn.sent.redactedNotice}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: 'redactCode', label: bn.sent.redactCode },
                      { key: 'redactName', label: bn.sent.redactName },
                      { key: 'redactParents', label: bn.sent.redactParents },
                      { key: 'redactVillage', label: bn.sent.redactVillage },
                      { key: 'redactContact', label: bn.sent.redactContact },
                    ] as const
                  ).map(({ key, label }) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                        prefs[key]
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-semibold'
                          : 'bg-white border-gray-200 text-gray-500 line-through'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={prefs[key]}
                        onChange={(e) =>
                          updatePrefs((p) => ({ ...p, [key]: e.target.checked }))
                        }
                        className="w-3.5 h-3.5 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Text Summary Checkbox & Copy Button */}
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-gray-800 text-sm">
                  <input
                    type="checkbox"
                    checked={includeText}
                    onChange={(e) => setIncludeText(e.target.checked)}
                    className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span>{bn.sent.includeTextSummary}</span>
                </label>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{bn.actions.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{bn.actions.copy}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Snippet preview */}
              <div className="bg-white p-2.5 rounded-lg border border-gray-200 text-xs text-gray-600 font-mono line-clamp-3">
                {formattedSummary}
              </div>

              {/* Section Checkboxes (SPEC-UPDATE-1 3.7) */}
              <div className="pt-2 border-t border-gray-200/80 space-y-2">
                <span className="text-xs font-bold text-gray-700 block">
                  বিভাগ নির্বাচন:
                </span>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={prefs.includeBasic}
                      onChange={(e) =>
                        updatePrefs((p) => ({ ...p, includeBasic: e.target.checked }))
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span>{bn.sent.sectionBasic}</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={prefs.includeEducation}
                      onChange={(e) =>
                        updatePrefs((p) => ({ ...p, includeEducation: e.target.checked }))
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span>{bn.sent.sectionEducation}</span>
                  </label>
                </div>

                {person.extra && person.extra.length > 0 ? (
                  <div className="pt-1.5 space-y-1.5">
                    <span className="text-[11px] font-semibold text-gray-500 block">
                      {bn.sent.sectionCustomFields} (ব্যক্তিগতভাবে নির্বাচনযোগ্য):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                      {person.extra.map((item) => {
                        const def = fieldDefsMap.get(item.fieldId);
                        const label = def?.label || item.fieldId;
                        const isChecked = prefs.selectedCustomFieldIds.includes(item.fieldId);

                        return (
                          <label
                            key={item.fieldId}
                            className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs cursor-pointer transition ${
                              isChecked
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updatePrefs((p) => ({
                                  ...p,
                                  selectedCustomFieldIds: checked
                                    ? [...p.selectedCustomFieldIds, item.fieldId]
                                    : p.selectedCustomFieldIds.filter((id) => id !== item.fieldId),
                                }));
                              }}
                              className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                            />
                            <span className="truncate">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Photos Selection */}
            {person.photos && person.photos.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  {bn.sent.includePhotos.replace(
                    '{count}',
                    String(person.photos.length)
                  )}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {person.photos.map((photo) => {
                    const isSelected = selectedPhotoIds.includes(photo.id);
                    const isCover = photo.id === effectiveCoverId;

                    return (
                      <div
                        key={photo.id}
                        onClick={() => togglePhoto(photo.id)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 cursor-pointer relative transition ${
                          isSelected
                            ? 'border-emerald-600 ring-2 ring-emerald-500/30'
                            : 'border-gray-200 opacity-60'
                        }`}
                      >
                        <BlobImage
                          blob={photo.thumb || photo.blob}
                          alt="Photo"
                          className="w-full h-full"
                          fallbackIcon={<User className="w-6 h-6 text-gray-300" />}
                        />
                        {isCover ? (
                          <div
                            className="absolute top-1 left-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm"
                            title={bn.photosAndDocs.coverPhoto}
                          >
                            <Star className="w-3 h-3 fill-white" />
                          </div>
                        ) : null}
                        {isSelected ? (
                          <div className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Docs Selection */}
            {person.docs && person.docs.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  {bn.fields.docs} ({person.docs.length})
                </h3>
                <div className="space-y-1.5">
                  {person.docs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-sm font-medium cursor-pointer transition ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDoc(doc.id)}
                          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                        />
                        <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="truncate">{doc.label || doc.name}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Document Privacy Notice (SPEC-UPDATE-1 3.7) */}
                {selectedDocIds.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-xs font-semibold text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{bn.sent.docPrivacyNotice}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Bottom Primary Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleShare}
                className="touch-target w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-sm text-base transition"
              >
                <Share2 className="w-5 h-5" />
                <span>{bn.sent.shareViaWhatsApp}</span>
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: "কাকে পাঠালেন?" prompt */
          <div className="flex-1 flex flex-col space-y-4">
            <p className="text-sm text-gray-600">
              রেকর্ড ট্র্যাক রাখার জন্য প্রাপকের নাম বা পরিচয় লিখুন:
            </p>

            {/* Recent Recipients Chips */}
            {recentRecipients.length > 0 ? (
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1.5">
                  {bn.sent.recentRecipients}
                </span>
                <div className="flex flex-wrap gap-2">
                  {recentRecipients.map((rec, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRecipient(rec)}
                      className={`touch-target px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        recipient === rec
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {rec}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <input
                type="text"
                autoFocus
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={bn.sent.recipientPlaceholder}
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div className="flex gap-3 pt-4 mt-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingLog}
                className="touch-target flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                এড়িয়ে যান
              </button>
              <button
                type="button"
                onClick={handleSaveLog}
                disabled={isSavingLog || !recipient.trim()}
                className="touch-target flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
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
