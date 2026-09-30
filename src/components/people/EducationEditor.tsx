import { useState, useEffect, useRef } from 'react';
import type { EducationEntry } from '../../types';
import { bn } from '../../i18n/bn';
import { getSuggestions } from '../../utils/catalog';
import { Plus, ArrowUp, ArrowDown, Trash2, Undo2 } from 'lucide-react';

interface EducationEditorProps {
  educations: EducationEntry[];
  onChange: (educations: EducationEntry[]) => void;
}

export function EducationEditor({ educations, onChange }: EducationEditorProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [undoItem, setUndoItem] = useState<{ entry: EducationEntry; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load level suggestions (saved ranked by useCount + defaults)
  useEffect(() => {
    getSuggestions('eduLevel').then((saved) => {
      const texts = saved.map((s) => s.text);
      setSuggestions(texts);
    });
  }, []);

  const handleAdd = () => {
    const newEntry: EducationEntry = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      level: '',
    };
    onChange([...educations, newEntry]);
  };

  const handleUpdate = (id: string, updates: Partial<EducationEntry>) => {
    onChange(
      educations.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...educations];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === educations.length - 1) return;
    const updated = [...educations];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    const toDelete = educations[index];
    const updated = educations.filter((_, i) => i !== index);
    onChange(updated);

    // 10 second undo support (SPEC-UPDATE-1 3.3)
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoItem({ entry: toDelete, index });

    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null);
    }, 10000);
  };

  const handleUndo = () => {
    if (!undoItem) return;
    const restored = [...educations];
    restored.splice(undoItem.index, 0, undoItem.entry);
    onChange(restored);

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoItem(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-700">
          {bn.education.title}
        </label>
        <button
          type="button"
          onClick={handleAdd}
          className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-sm transition"
        >
          <Plus className="w-4 h-4" />
          {bn.education.addEntry}
        </button>
      </div>

      {/* 10-Second Undo Banner */}
      {undoItem ? (
        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm shadow-sm animate-fade-in">
          <span>{bn.education.deletedNotice}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="touch-target inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-xs"
          >
            <Undo2 className="w-4 h-4" />
            {bn.education.undo}
          </button>
        </div>
      ) : null}

      {/* List of Education Cards */}
      {educations.length === 0 ? (
        <div className="text-center py-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-500 text-sm">
          {bn.education.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {educations.map((entry, index) => (
            <div
              key={entry.id}
              className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3 relative"
            >
              {/* Card Actions Header */}
              <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  #{index + 1}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="touch-target p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:hover:text-gray-500 rounded"
                    title={bn.education.moveUp}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === educations.length - 1}
                    className="touch-target p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:hover:text-gray-500 rounded"
                    title={bn.education.moveDown}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="touch-target p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                    title={bn.education.remove}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Level Input & Suggestion Chips */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {bn.education.level} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={entry.level}
                  onChange={(e) => handleUpdate(entry.id, { level: e.target.value })}
                  placeholder={bn.education.levelPlaceholder}
                  className="w-full min-h-[44px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />

                {/* Suggestion Chips */}
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {suggestions.slice(0, 8).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleUpdate(entry.id, { level: chip })}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${
                          entry.level === chip
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject & Institution */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {bn.education.subject}
                  </label>
                  <input
                    type="text"
                    value={entry.subject || ''}
                    onChange={(e) => handleUpdate(entry.id, { subject: e.target.value })}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {bn.education.institution}
                  </label>
                  <input
                    type="text"
                    value={entry.institution || ''}
                    onChange={(e) => handleUpdate(entry.id, { institution: e.target.value })}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Result, Year & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {bn.education.result}
                  </label>
                  <input
                    type="text"
                    value={entry.result || ''}
                    onChange={(e) => handleUpdate(entry.id, { result: e.target.value })}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {bn.education.year}
                  </label>
                  <input
                    type="text"
                    value={entry.year || ''}
                    onChange={(e) => handleUpdate(entry.id, { year: e.target.value })}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {bn.education.status}
                  </label>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleUpdate(entry.id, { status: 'completed' })}
                      className={`flex-1 min-h-[38px] text-xs font-medium rounded-lg border transition ${
                        entry.status === 'completed'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {bn.education.statusCompleted}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate(entry.id, { status: 'ongoing' })}
                      className={`flex-1 min-h-[38px] text-xs font-medium rounded-lg border transition ${
                        entry.status === 'ongoing'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {bn.education.statusOngoing}
                    </button>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {bn.education.note}
                </label>
                <input
                  type="text"
                  value={entry.note || ''}
                  onChange={(e) => handleUpdate(entry.id, { note: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
