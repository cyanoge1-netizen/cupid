import { useState, useEffect, useMemo } from 'react';
import type { InboxItem, Person, Partner, Gender, MediaRef } from '../../types';
import { bn } from '../../i18n/bn';
import { parseBiodataText } from '../../utils/parser';
import { checkDuplicates } from '../../utils/duplicates';
import { previewNextCode } from '../../db';
import { BlobImage } from '../common/BlobImage';
import { PartnerFormModal } from '../partners/PartnerFormModal';
import {
  ArrowLeft,
  AlertTriangle,
  User,
  FileText,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ProcessItemScreenProps {
  item: InboxItem;
  people: Person[];
  partners: Partner[];
  onBack: () => void;
  onSaveNewPerson: (personData: Omit<Person, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => Promise<Person>;
  onAttachToExisting: (existingPersonId: string, item: InboxItem) => Promise<void>;
  onCreatePartner: (data: { name: string; phone?: string; area?: string; note?: string }) => Promise<Partner>;
}

export function ProcessItemScreen({
  item,
  people,
  partners,
  onBack,
  onSaveNewPerson,
  onAttachToExisting,
  onCreatePartner,
}: ProcessItemScreenProps) {
  // Step 1: Pre-populate from deterministic parser
  const parsed = useMemo(() => parseBiodataText(item.text), [item.text]);

  // Form states
  const [gender, setGender] = useState<Gender | null>(null);
  const [codePreview, setCodePreview] = useState<string>('');
  const [name, setName] = useState(parsed.name || '');
  const [alias, setAlias] = useState('');
  const [father, setFather] = useState(parsed.father || '');
  const [mother, setMother] = useState(parsed.mother || '');
  const [district, setDistrict] = useState(parsed.district || '');
  const [upazila, setUpazila] = useState(parsed.upazila || '');
  const [village, setVillage] = useState(parsed.village || '');
  const [age, setAge] = useState(parsed.age ? String(parsed.age) : '');
  const [height, setHeight] = useState(parsed.height || '');
  const [education, setEducation] = useState(parsed.education || '');
  const [profession, setProfession] = useState(parsed.profession || '');
  const [phoneLast4, setPhoneLast4] = useState(parsed.phoneLast4 || '');
  const [memo, setMemo] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(item.sourceId || null);

  const [showFullText, setShowFullText] = useState(false);
  const [isQuickPartnerModalOpen, setIsQuickPartnerModalOpen] = useState(false);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Live code preview updates when gender is selected
  useEffect(() => {
    if (!gender) {
      setCodePreview('');
      return;
    }
    previewNextCode(gender).then((code) => {
      setCodePreview(code);
    });
  }, [gender]);

  const partnersMap = useMemo(() => {
    return new Map<string, Partner>(partners.map((p) => [p.id, p]));
  }, [partners]);

  // Duplicate detection
  const duplicateMatches = useMemo(() => {
    if (ignoreDuplicates) return [];
    return checkDuplicates(
      {
        name: name.trim() || undefined,
        father: father.trim() || undefined,
        district: district.trim() || undefined,
        village: village.trim() || undefined,
        phoneLast4: phoneLast4.trim() || undefined,
      },
      people,
      partnersMap
    );
  }, [name, father, district, village, phoneLast4, people, partnersMap, ignoreDuplicates]);

  const imageFiles = useMemo(
    () => item.files.filter((f) => f.kind === 'image'),
    [item.files]
  );
  const docFiles = useMemo(
    () => item.files.filter((f) => f.kind !== 'image'),
    [item.files]
  );

  const handleSave = async () => {
    setErrorMessage('');

    // Gender is required
    if (!gender) {
      setErrorMessage(bn.messages.requiredGender);
      return;
    }

    // Must have at least one photo or text (Principle 6)
    if (imageFiles.length === 0 && !item.text.trim()) {
      setErrorMessage(bn.messages.requiredPhotoOrText);
      return;
    }

    setIsSaving(true);
    try {
      const parsedAge = age.trim() ? parseInt(age.trim(), 10) : undefined;
      const parsedTags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const photos: MediaRef[] = [...imageFiles];
      const docs: MediaRef[] = [...docFiles];

      await onSaveNewPerson({
        gender,
        name: name.trim() || undefined,
        alias: alias.trim() || undefined,
        father: father.trim() || undefined,
        mother: mother.trim() || undefined,
        district: district.trim() || undefined,
        upazila: upazila.trim() || undefined,
        village: village.trim() || undefined,
        age: isNaN(Number(parsedAge)) ? undefined : parsedAge,
        height: height.trim() || undefined,
        education: education.trim() || undefined,
        profession: profession.trim() || undefined,
        phoneLast4: phoneLast4.trim() ? phoneLast4.trim().slice(-4) : undefined,
        memo: memo.trim() || undefined,
        tags: parsedTags,
        status: 'active',
        sourceId,
        photos,
        docs,
        rawText: item.text || undefined,
        fromInboxId: item.id,
      });

      onBack();
    } catch (err: any) {
      setErrorMessage(err?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttach = async (targetPersonId: string) => {
    setIsSaving(true);
    try {
      await onAttachToExisting(targetPersonId, item);
      onBack();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="touch-target p-2 text-gray-700 hover:bg-gray-100 rounded-full"
            aria-label={bn.actions.back}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{bn.inbox.processTitle}</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-5">
        {errorMessage ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
            {errorMessage}
          </div>
        ) : null}

        {/* 1. Preview thumbnails and text */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            ১. ইনবক্স প্রিভিউ ({item.files.length}টি ফাইল)
          </h2>

          {imageFiles.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imageFiles.map((photo, i) => (
                <div
                  key={photo.id || i}
                  className="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100"
                >
                  <BlobImage
                    blob={photo.thumb || photo.blob}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full"
                    fallbackIcon={<User className="w-6 h-6 text-gray-300" />}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {docFiles.length > 0 ? (
            <div className="space-y-1.5">
              {docFiles.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs font-medium text-gray-700"
                >
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="truncate">{doc.name}</span>
                </div>
              ))}
            </div>
          ) : null}

          {item.text ? (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-sm">
              <div
                className={`font-mono text-gray-700 whitespace-pre-wrap leading-relaxed ${
                  !showFullText ? 'line-clamp-4' : ''
                }`}
              >
                {item.text}
              </div>
              {item.text.length > 120 ? (
                <button
                  type="button"
                  onClick={() => setShowFullText(!showFullText)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 mt-2 flex items-center gap-1"
                >
                  {showFullText ? (
                    <>
                      <span>সংক্ষিপ্ত দেখুন</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>পুরো টেক্সট দেখুন</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* 2. Gender chips (required) & Code preview */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              ২. {bn.fields.gender} *
            </h2>
            {codePreview ? (
              <span className="font-mono text-sm font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg">
                {bn.inbox.codePreview.replace('{code}', codePreview)}
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-medium">
                {bn.inbox.selectGenderFirst}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGender('B')}
              className={`touch-target flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-bold text-base transition ${
                gender === 'B'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {gender === 'B' ? <Check className="w-5 h-5 text-emerald-600" /> : null}
              <span>{bn.gender.B}</span>
            </button>

            <button
              type="button"
              onClick={() => setGender('G')}
              className={`touch-target flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-bold text-base transition ${
                gender === 'G'
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {gender === 'G' ? <Check className="w-5 h-5 text-blue-600" /> : null}
              <span>{bn.gender.G}</span>
            </button>
          </div>
        </section>

        {/* 3. Auto-filled fields from text parser */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            ৩. তথ্যসমূহ (স্বয়ংক্রিয় পূরণকৃত ও সম্পাদনাযোগ্য)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.name}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: তানভীর আহমেদ"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.alias}
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="মনে রাখার জন্য ডাকনাম"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.father}
              </label>
              <input
                type="text"
                value={father}
                onChange={(e) => setFather(e.target.value)}
                placeholder="পিতার নাম"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.mother}
              </label>
              <input
                type="text"
                value={mother}
                onChange={(e) => setMother(e.target.value)}
                placeholder="মাতার নাম"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.district}
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="সিলেট"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.upazila}
              </label>
              <input
                type="text"
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                placeholder="উপজেলা / থানা"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.village}
              </label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="গ্রাম বা এলাকা"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.age}
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="২৮"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.height}
              </label>
              <input
                type="text"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="৫ ফুট ৮ ইঞ্চি"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.phoneLast4}
              </label>
              <input
                type="text"
                maxLength={4}
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value)}
                placeholder="শেষ ৪ ডিজিট"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.profession}
              </label>
              <input
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="যেমন: শিক্ষক, ব্যাংকার"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.education}
              </label>
              <input
                type="text"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="যেমন: মাস্টার্স, বিএসসি"
                className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.fields.memo}
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="ব্যক্তিগত নোট বা মন্তব্য..."
              className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.fields.tags}
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="প্রবাসী, ধার্মিক, ডাক্তার"
              className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>
        </section>

        {/* 4. Source chips: recent partners first, "নিজের" always present, and "নতুন সহযোগী" */}
        <section className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            ৪. {bn.fields.source}
          </h2>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSourceId(null)}
              className={`touch-target px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                sourceId === null
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {bn.source.own}
            </button>

            {partners.map((partner) => (
              <button
                key={partner.id}
                type="button"
                onClick={() => setSourceId(partner.id)}
                className={`touch-target px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                  sourceId === partner.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {partner.name}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsQuickPartnerModalOpen(true)}
              className="touch-target inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-dashed border-gray-300 text-emerald-700 hover:bg-emerald-50 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{bn.source.newPartner}</span>
            </button>
          </div>
        </section>

        {/* 5. Duplicate Check Warning Card (SPEC 5.7) */}
        {duplicateMatches.length > 0 ? (
          <section className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-200 text-amber-900 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900">
                  {bn.inbox.duplicateWarning.replace(
                    '{score}',
                    String(duplicateMatches[0].score)
                  )}
                </h3>
                <p className="text-sm text-amber-800 mt-1">
                  {bn.inbox.duplicateFields.replace(
                    '{fields}',
                    duplicateMatches[0].matchedFields.join(', ')
                  )}
                </p>
                <div className="mt-2 text-sm text-amber-900 font-semibold bg-white/70 p-2.5 rounded-lg border border-amber-200">
                  বিদ্যমান রেকর্ড: {duplicateMatches[0].person.name || 'নামবিহীন'} (
                  {duplicateMatches[0].person.code})
                  {duplicateMatches[0].partnerName ? (
                    <span className="block text-xs font-normal text-amber-700 mt-0.5">
                      {bn.inbox.duplicateExistingPartner.replace(
                        '{partner}',
                        duplicateMatches[0].partnerName || ''
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-amber-200">
              <button
                type="button"
                onClick={() => handleAttach(duplicateMatches[0].person.id)}
                disabled={isSaving}
                className="touch-target flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition"
              >
                {bn.actions.attachToExisting}
              </button>
              <button
                type="button"
                onClick={() => setIgnoreDuplicates(true)}
                className="touch-target flex-1 px-4 py-2.5 bg-white border border-amber-400 text-amber-900 hover:bg-amber-100/50 rounded-xl font-semibold text-sm transition"
              >
                {bn.actions.createNew}
              </button>
            </div>
          </section>
        ) : null}

        {/* 6. Actions: Save, or "পরে করব" */}
        <section className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="touch-target flex-1 px-4 py-3 rounded-2xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition text-base"
          >
            {bn.actions.later}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="touch-target flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold transition text-base shadow-sm"
          >
            {bn.actions.save}
          </button>
        </section>
      </main>

      {/* Quick Add Partner Modal */}
      {isQuickPartnerModalOpen ? (
        <PartnerFormModal
          onClose={() => setIsQuickPartnerModalOpen(false)}
          onSave={async (data) => {
            const newP = await onCreatePartner(data);
            setSourceId(newP.id);
          }}
        />
      ) : null}
    </div>
  );
}
