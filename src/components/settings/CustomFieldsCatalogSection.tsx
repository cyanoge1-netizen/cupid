import { useState, useEffect } from 'react';
import type { FieldDef, FieldSection } from '../../types';
import { bn } from '../../i18n/bn';
import {
  getAllFieldDefsGrouped,
  renameFieldDef,
  setFieldDefHidden,
  deleteFieldDef,
} from '../../utils/catalog';
import {
  ListFilter,
  Edit2,
  Eye,
  EyeOff,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';

export function CustomFieldsCatalogSection() {
  const [groupedDefs, setGroupedDefs] = useState<Record<FieldSection, FieldDef[]>>({
    family: [],
    personal: [],
    professional: [],
    preference: [],
    other: [],
  });
  const [loading, setLoading] = useState(true);
  const [editingDef, setEditingDef] = useState<FieldDef | null>(null);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadDefs = async () => {
    setLoading(true);
    try {
      const data = await getAllFieldDefsGrouped();
      setGroupedDefs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefs();
  }, []);

  const handleStartRename = (def: FieldDef) => {
    setEditingDef(def);
    setNewLabelInput(def.label);
    setErrorMsg('');
  };

  const handleSaveRename = async () => {
    if (!editingDef || !newLabelInput.trim()) return;
    setErrorMsg('');
    try {
      await renameFieldDef(editingDef.id, newLabelInput.trim());
      setEditingDef(null);
      await loadDefs();
    } catch (err: any) {
      setErrorMsg(err.message || 'নাম পরিবর্তন করা যায়নি');
    }
  };

  const handleToggleHide = async (def: FieldDef) => {
    await setFieldDefHidden(def.id, !def.hidden);
    await loadDefs();
  };

  const handleDelete = async (def: FieldDef) => {
    if (def.useCount > 0) {
      alert(bn.customFields.cannotDeleteUsed);
      return;
    }
    if (confirm(bn.customFields.deletePrompt)) {
      try {
        await deleteFieldDef(def.id);
        await loadDefs();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const sections: FieldSection[] = ['family', 'personal', 'professional', 'preference', 'other'];

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <ListFilter className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-gray-900">
            {bn.customFields.catalogTitle}
          </h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {bn.customFields.catalogDesc}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-3">লোড হচ্ছে...</p>
      ) : (
        <div className="space-y-5">
          {sections.map((sec) => {
            const list = groupedDefs[sec] || [];
            const secName = bn.customFields.sections[sec] || sec;

            return (
              <div key={sec} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    {secName} ({list.length})
                  </h4>
                </div>

                {list.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-1">
                    {bn.customFields.noFieldsInSection}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden bg-gray-50/50">
                    {list.map((def) => (
                      <div
                        key={def.id}
                        className={`p-3 flex items-center justify-between gap-2 transition ${
                          def.hidden ? 'opacity-60 bg-gray-100/50' : 'bg-white'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-base">
                              {def.label}
                            </span>
                            {def.hidden ? (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                {bn.customFields.hiddenBadge}
                              </span>
                            ) : null}
                            {def.seeded ? (
                              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                {bn.customFields.seededBadge}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {bn.customFields.useCount.replace('{count}', String(def.useCount))}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartRename(def)}
                            className="touch-target p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                            title={bn.customFields.rename}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHide(def)}
                            className={`touch-target p-2 rounded-lg transition ${
                              def.hidden
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                            }`}
                            title={def.hidden ? bn.customFields.unhide : bn.customFields.hide}
                          >
                            {def.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(def)}
                            disabled={def.useCount > 0}
                            className={`touch-target p-2 rounded-lg transition ${
                              def.useCount > 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-red-500 hover:bg-red-50'
                            }`}
                            title={
                              def.useCount > 0
                                ? bn.customFields.cannotDeleteUsed
                                : bn.actions.delete
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rename Modal */}
      {editingDef ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="font-bold text-gray-900 text-lg">
                {bn.customFields.renameTitle}
              </h4>
              <button
                type="button"
                onClick={() => setEditingDef(null)}
                className="touch-target p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {bn.customFields.renamePrompt}
              </label>
              <input
                type="text"
                autoFocus
                value={newLabelInput}
                onChange={(e) => setNewLabelInput(e.target.value)}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {errorMsg ? (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorMsg}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditingDef(null)}
                className="touch-target px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                {bn.actions.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                className="touch-target px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-xs"
              >
                {bn.actions.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
