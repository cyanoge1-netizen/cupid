import { useState, useEffect } from 'react';
import type { Person, Partner, EducationEntry, CustomValue, FieldDef, FieldSection, MediaRef } from '../../types';
import { bn } from '../../i18n/bn';
import { db } from '../../db';
import { X, ChevronDown, ChevronUp, Plus, Trash2, AlignLeft, Type } from 'lucide-react';
import { EducationEditor } from './EducationEditor';
import { AddCustomFieldSheet } from './AddCustomFieldSheet';
import { PhotoManager } from './PhotoManager';
import { DocManager } from './DocManager';
import { recordSuggestion, recordFieldUsage } from '../../utils/catalog';

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
  // Basic info states
  const [name, setName] = useState(person.name || '');
  const [alias, setAlias] = useState(person.alias || '');
  const [father, setFather] = useState(person.father || '');
  const [mother, setMother] = useState(person.mother || '');
  const [village, setVillage] = useState(person.village || '');
  const [postOffice, setPostOffice] = useState(person.postOffice || '');
  const [upazila, setUpazila] = useState(person.upazila || '');
  const [district, setDistrict] = useState(person.district || '');
  const [age, setAge] = useState(person.age ? String(person.age) : '');
  const [height, setHeight] = useState(person.height || '');
  const [profession, setProfession] = useState(person.profession || '');
  const [phone, setPhone] = useState(person.phone || '');
  const [phoneLast4, setPhoneLast4] = useState(person.phoneLast4 || '');
  const [memo, setMemo] = useState(person.memo || '');
  const [tagsStr, setTagsStr] = useState(person.tags ? person.tags.join(', ') : '');
  const [sourceId, setSourceId] = useState<string | null>(person.sourceId);

  // Education state
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

  // Custom fields state (SPEC-UPDATE-1 3.4)
  const [extraValues, setExtraValues] = useState<CustomValue[]>(person.extra || []);
  const [fieldDefsMap, setFieldDefsMap] = useState<Map<string, FieldDef>>(new Map());
  const [customKinds, setCustomKinds] = useState<Record<string, 'text' | 'longtext'>>({});
  const [activeAddSection, setActiveAddSection] = useState<FieldSection | null>(null);

  // Photos & Docs state (SPEC-UPDATE-1 3.1, 3.2)
  const [photos, setPhotos] = useState<MediaRef[]>(person.photos || []);
  const [coverPhotoId, setCoverPhotoId] = useState<string | undefined>(person.coverPhotoId);
  const [docs, setDocs] = useState<MediaRef[]>(person.docs || []);

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    // Basic and Education open by default, others open if they have data
    const initial: Record<string, boolean> = {
      basic: false,
      education: false,
      family: true,
      personal: true,
      professional: true,
      preference: true,
      other: true,
      photos: !(person.photos && person.photos.length > 0),
      docs: !(person.docs && person.docs.length > 0),
    };
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load field definitions
  useEffect(() => {
    db.fieldDefs.toArray().then((defs) => {
      const map = new Map<string, FieldDef>();
      for (const d of defs) {
        map.set(d.id, d);
      }
      setFieldDefsMap(map);

      // Auto-expand custom sections that already have data
      if (person.extra && person.extra.length > 0) {
        setCollapsedSections((prev) => {
          const updated = { ...prev };
          for (const item of person.extra || []) {
            const def = map.get(item.fieldId);
            if (def && item.value?.trim()) {
              updated[def.section] = false;
            }
          }
          return updated;
        });
      }
    });
  }, [person.extra]);

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleCustomValueChange = (fieldId: string, value: string) => {
    setExtraValues((prev) =>
      prev.map((item) => (item.fieldId === fieldId ? { ...item, value } : item))
    );
  };

  const handleToggleKind = (fieldId: string, currentKind: 'text' | 'longtext') => {
    setCustomKinds((prev) => ({
      ...prev,
      [fieldId]: currentKind === 'longtext' ? 'text' : 'longtext',
    }));
  };

  const handleRemoveCustomField = (fieldId: string) => {
    setExtraValues((prev) => prev.filter((item) => item.fieldId !== fieldId));
  };

  const handleFieldSelected = (def: FieldDef) => {
    setFieldDefsMap((prev) => new Map(prev).set(def.id, def));
    setExtraValues((prev) => {
      if (prev.some((v) => v.fieldId === def.id)) return prev;
      return [...prev, { fieldId: def.id, value: '' }];
    });
    // Ensure section is expanded
    setCollapsedSections((prev) => ({
      ...prev,
      [def.section]: false,
    }));
  };

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
        .map((edu) => ({
          ...edu,
          level: edu.level.trim(),
          subject: edu.subject?.trim() || undefined,
          institution: edu.institution?.trim() || undefined,
          result: edu.result?.trim() || undefined,
          year: edu.year?.trim() || undefined,
          note: edu.note?.trim() || undefined,
        }))
        .filter((edu) => edu.level.length > 0);

      // Record suggestions for education levels (SPEC-UPDATE-1 3.3)
      for (const edu of validEducations) {
        if (edu.level) {
          recordSuggestion('eduLevel', edu.level).catch(() => {});
        }
      }

      // Filter and record usage for custom values (SPEC-UPDATE-1 3.4)
      const validExtra = extraValues
        .map((v) => ({ fieldId: v.fieldId, value: v.value.trim() }))
        .filter((v) => v.value.length > 0);

      if (validExtra.length > 0) {
        recordFieldUsage(validExtra.map((v) => v.fieldId)).catch(() => {});
      }

      await onSave({
        name: name.trim() || undefined,
        alias: alias.trim() || undefined,
        father: father.trim() || undefined,
        mother: mother.trim() || undefined,
        village: village.trim() || undefined,
        postOffice: postOffice.trim() || undefined,
        upazila: upazila.trim() || undefined,
        district: district.trim() || undefined,
        age: isNaN(Number(parsedAge)) ? undefined : parsedAge,
        height: height.trim() || undefined,
        educations: validEducations,
        extra: validExtra,
        profession: profession.trim() || undefined,
        phone: phone.trim() || undefined,
        phoneLast4: phone.trim() ? phone.trim().slice(-4) : (phoneLast4.trim() ? phoneLast4.trim().slice(-4) : undefined),
        memo: memo.trim() || undefined,
        tags: parsedTags,
        sourceId,
        photos,
        coverPhotoId,
        docs,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to render custom fields inside a section
  const renderCustomSectionFields = (section: FieldSection) => {
    const sectionValues = extraValues.filter((v) => {
      const def = fieldDefsMap.get(v.fieldId);
      return def?.section === section;
    });

    return (
      <div className="space-y-3 pt-2">
        {sectionValues.map((item) => {
          const def = fieldDefsMap.get(item.fieldId);
          if (!def) return null;
          const currentKind = customKinds[def.id] || def.kind || 'text';
          const isLong = currentKind === 'longtext';

          return (
            <div key={item.fieldId} className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">{def.label}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleKind(def.id, currentKind)}
                    className="touch-target p-1 text-gray-400 hover:text-gray-700 rounded transition"
                    title={isLong ? bn.customFields.toggleShortText : bn.customFields.toggleLongText}
                  >
                    {isLong ? <Type className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(def.id)}
                    className="touch-target p-1 text-red-400 hover:text-red-600 rounded transition"
                    title={bn.actions.delete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isLong ? (
                <textarea
                  rows={2}
                  value={item.value}
                  onChange={(e) => handleCustomValueChange(def.id, e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              ) : (
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => handleCustomValueChange(def.id, e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setActiveAddSection(section)}
          className="touch-target inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 text-sm font-semibold transition w-full justify-center"
        >
          <Plus className="w-4 h-4 text-emerald-600" />
          {bn.customFields.addInfo}
        </button>
      </div>
    );
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

        {/* Scrollable Collapsible Sections (SPEC-UPDATE-1 3.4) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section 1: মূল তথ্য (Basic) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.basic}</span>
              {collapsedSections.basic ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.basic && (
              <div className="p-4 space-y-4 border-t border-gray-200 bg-white">
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
                {/* District, Upazila, PostOffice, Village */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                      {bn.fields.postOffice}
                    </label>
                    <input
                      type="text"
                      value={postOffice}
                      onChange={(e) => setPostOffice(e.target.value)}
                      placeholder="ডাকঘর"
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

                {/* Age, Height, Phone */}
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
                      {bn.fields.phone}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPhone(val);
                        setPhoneLast4(val.trim() ? val.trim().slice(-4) : '');
                      }}
                      placeholder="০১৭xxxxxxxx"
                      className="w-full min-h-[48px] px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base font-mono"
                    />
                  </div>
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

                {/* Quick Add Custom Field inside Section 1 */}
                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setActiveAddSection('other')}
                    className="touch-target inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 text-sm font-semibold transition w-full justify-center"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>{bn.customFields.addInfo}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: শিক্ষা (Education) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('education')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <div className="flex items-center gap-2">
                <span>{bn.customFields.sections.education}</span>
                {educations.length > 0 ? (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    {educations.length}
                  </span>
                ) : null}
              </div>
              {collapsedSections.education ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.education && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <EducationEditor educations={educations} onChange={setEducations} />
              </div>
            )}
          </div>

          {/* Section 3: পারিবারিক তথ্য (Family) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('family')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.family}</span>
              {collapsedSections.family ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.family && (
              <div className="p-4 border-t border-gray-200 bg-white">
                {renderCustomSectionFields('family')}
              </div>
            )}
          </div>

          {/* Section 4: ব্যক্তিগত (Personal) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('personal')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.personal}</span>
              {collapsedSections.personal ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.personal && (
              <div className="p-4 border-t border-gray-200 bg-white">
                {renderCustomSectionFields('personal')}
              </div>
            )}
          </div>

          {/* Section 5: পেশা (Professional) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('professional')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.professional}</span>
              {collapsedSections.professional ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.professional && (
              <div className="p-4 border-t border-gray-200 bg-white space-y-3">
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
                {renderCustomSectionFields('professional')}
              </div>
            )}
          </div>

          {/* Section 6: চাহিদা (Preference) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('preference')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.preference}</span>
              {collapsedSections.preference ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.preference && (
              <div className="p-4 border-t border-gray-200 bg-white">
                {renderCustomSectionFields('preference')}
              </div>
            )}
          </div>

          {/* Section 7: অন্যান্য (Other) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('other')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.other}</span>
              {collapsedSections.other ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.other && (
              <div className="p-4 border-t border-gray-200 bg-white">
                {renderCustomSectionFields('other')}
              </div>
            )}
          </div>

          {/* Section 8: ছবিসমূহ (Photos) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('photos')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.photos} {photos.length > 0 && `(${photos.length})`}</span>
              {collapsedSections.photos ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.photos && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <PhotoManager
                  photos={photos}
                  coverPhotoId={coverPhotoId}
                  onChangePhotos={setPhotos}
                  onChangeCoverId={setCoverPhotoId}
                />
              </div>
            )}
          </div>

          {/* Section 9: কাগজপত্র (Docs) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('docs')}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 transition text-left font-bold text-gray-900 text-base"
            >
              <span>{bn.customFields.sections.docs} {docs.length > 0 && `(${docs.length})`}</span>
              {collapsedSections.docs ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!collapsedSections.docs && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <DocManager
                  docs={docs}
                  allPersonFiles={[...photos, ...docs]}
                  onChangeDocs={setDocs}
                />
              </div>
            )}
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

        {/* Add Custom Field Sheet Modal */}
        {activeAddSection ? (
          <AddCustomFieldSheet
            section={activeAddSection}
            existingFieldIds={extraValues.map((v) => v.fieldId)}
            onSelectField={handleFieldSelected}
            onClose={() => setActiveAddSection(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
