import { useState, useEffect, useMemo } from 'react';
import type { FieldDef, FieldSection } from '../../types';
import { bn } from '../../i18n/bn';
import { getSuggestionsForSection, findOrCreateFieldDef } from '../../utils/catalog';
import { norm } from '../../utils/normalizer';
import { Search, Plus, X } from 'lucide-react';

interface AddCustomFieldSheetProps {
  section: FieldSection;
  existingFieldIds: string[];
  onSelectField: (fieldDef: FieldDef) => void;
  onClose: () => void;
}

export function AddCustomFieldSheet({
  section,
  existingFieldIds,
  onSelectField,
  onClose,
}: AddCustomFieldSheetProps) {
  const [query, setQuery] = useState('');
  const [catalogDefs, setCatalogDefs] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getSuggestionsForSection(section, existingFieldIds).then((defs) => {
      if (active) {
        setCatalogDefs(defs);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [section, existingFieldIds]);

  const normQuery = norm(query);

  // Filter existing suggestions by typed query
  const filteredChips = useMemo(() => {
    if (!normQuery) return catalogDefs;
    return catalogDefs.filter(
      (d) => d.normLabel.includes(normQuery) || d.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [catalogDefs, normQuery, query]);

  // Check if typed text already matches any label in catalog
  const exactMatch = useMemo(() => {
    if (!normQuery) return null;
    return catalogDefs.find((d) => d.normLabel === normQuery);
  }, [catalogDefs, normQuery]);

  const handleCreateNew = async () => {
    if (!query.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const def = await findOrCreateFieldDef(query.trim(), section, 'text');
      onSelectField(def);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectChip = (def: FieldDef) => {
    onSelectField(def);
    onClose();
  };

  const sectionName = bn.customFields.sections[section] || section;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {sectionName} — {bn.customFields.addInfo}
            </h3>
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

        {/* Search input */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={bn.customFields.searchOrAdd}
              className="w-full pl-10 pr-4 min-h-[48px] text-base bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Suggestion Chips and Add New button */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* If typed text is new and doesn't match an existing chip */}
          {query.trim().length > 0 && !exactMatch ? (
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={isSubmitting}
              className="touch-target w-full flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-bold hover:bg-emerald-100 transition shadow-xs"
            >
              <span className="flex items-center gap-2 truncate">
                <Plus className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">
                  {bn.customFields.addNew.replace('{label}', query.trim())}
                </span>
              </span>
            </button>
          ) : null}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              প্রস্তাবিত লেবেল
            </label>

            {loading ? (
              <p className="text-sm text-gray-400 py-2">লোড হচ্ছে...</p>
            ) : filteredChips.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                {query ? 'কোনো সংরক্ষিত লেবেল মেলেনি।' : 'কোনো প্রস্তাবিত লেবেল নেই।'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredChips.map((def) => (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => handleSelectChip(def)}
                    className="touch-target px-3.5 py-2 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-transparent text-gray-800 transition active:scale-95"
                  >
                    {def.label}
                    {def.useCount > 0 ? (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">
                        ({def.useCount})
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
