import { useState } from 'react';
import type { Person, Partner, EducationEntry } from '../../types';
import { bn } from '../../i18n/bn';
import { X } from 'lucide-react';
import { EducationEditor } from './EducationEditor';
import { recordSuggestion } from '../../utils/catalog';

interface PersonEditModalProps {
  person: Person;
  partners: Partner[];
  onClose: () => void;
  onSave: (updates: Partial<Person>) => Promise<void>;
}

export function PersonEditModal({
  person,
  partners,
  onClose,
  onSave,
}: PersonEditModalProps) {
  const [name, setName] = useState(person.name || '');
  const [alias, setAlias] = useState(person.alias || '');
  const [father, setFather] = useState(person.father || '');
  const [mother, setMother] = useState(person.mother || '');
  const [village, setVillage] = useState(person.village || '');
  const [upazila, setUpazila] = useState(person.upazila || '');
  const [district, setDistrict] = useState(person.district || '');
  const [age, setAge] = useState(person.age ? String(person.age) : '');
  const [height, setHeight] = useState(person.height || '');
  const [educations, setEducations] = useState<EducationEntry[]>(() => {
    if (person.educations && person.educations.length > 0) {
      return person.educations;
    }
    if (person.education && person.education.trim()) {
      return [
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          level: person.education.trim(),
        },
      ];
    }
    return [];
  });
  const [profession, setProfession] = useState(person.profession || '');
  const [phoneLast4, setPhoneLast4] = useState(person.phoneLast4 || '');
  const [memo, setMemo] = useState(person.memo || '');
  const [tagsStr, setTagsStr] = useState(person.tags ? person.tags.join(', ') : '');
  const [sourceId, setSourceId] = useState<string | null>(person.sourceId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedAge = age.trim() ? parseInt(age.trim(), 10) : undefined;
      const parsedTags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const validEducations = educations
        .map((e) => ({
          ...e,
          level: e.level.trim(),
          subject: e.subject?.trim() || undefined,
          institution: e.institution?.trim() || undefined,
          result: e.result?.trim() || undefined,
          year: e.year?.trim() || undefined,
          note: e.note?.trim() || undefined,
        }))
        .filter((e) => e.level.length > 0);

      // Record suggestions for education levels (SPEC-UPDATE-1 3.3)
      for (const edu of validEducations) {
        if (edu.level) {
          recordSuggestion('eduLevel', edu.level).catch(() => {});
        }
      }

      await onSave({
        name: name.trim() || undefined,
        alias: alias.trim() || undefined,
        father: father.trim() || undefined,
        mother: mother.trim() || undefined,
        village: village.trim() || undefined,
        upazila: upazila.trim() || undefined,
        district: district.trim() || undefined,
        age: isNaN(Number(parsedAge)) ? undefined : parsedAge,
        height: height.trim() || undefined,
        educations: validEducations,
        profession: profession.trim() || undefined,
        phoneLast4: phoneLast4.trim() ? phoneLast4.trim().slice(-4) : undefined,
        memo: memo.trim() || undefined,
        tags: parsedTags,
        sourceId,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl w-full max-w-lg flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{bn.actions.edit}</h2>
            <span className="font-mono text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
              {person.code}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Source Chips */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {bn.fields.source}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSourceId(null)}
                className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  sourceId === null
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {bn.source.own}
              </button>
              {partners.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSourceId(p.id)}
                  className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    sourceId === p.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Name & Alias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.name}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
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
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          {/* Father & Mother */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.father}
              </label>
              <input
                type="text"
                value={father}
                onChange={(e) => setFather(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
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
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          {/* District, Upazila, Village */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.district}
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
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
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
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
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          {/* Age, Height, PhoneLast4 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {bn.fields.age}
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
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
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
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
                placeholder="1234"
                className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
          </div>

          {/* Profession */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.fields.profession}
            </label>
            <input
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

          {/* Education Entries Editor (SPEC-UPDATE-1 3.3) */}
          <div className="pt-2 border-t border-gray-100">
            <EducationEditor
              educations={educations}
              onChange={setEducations}
            />
          </div>

          {/* Memo / Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.fields.memo}
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.fields.tags}
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

          {/* Footer action buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="touch-target flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              {bn.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="touch-target flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
            >
              {bn.actions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
