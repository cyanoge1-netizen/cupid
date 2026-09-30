import { useState, useRef, useEffect } from 'react';
import type { MediaRef } from '../../types';
import { bn } from '../../i18n/bn';
import { formatFileSize, checkMediaLimits, getMediaKind } from '../../utils/media';
import { getSuggestions, recordSuggestion } from '../../utils/catalog';
import {
  FileText,
  Plus,
  Trash2,
  Undo2,
  ExternalLink,
  AlertTriangle,
  X,
} from 'lucide-react';

interface DocManagerProps {
  docs: MediaRef[];
  allPersonFiles?: MediaRef[]; // Used for total size check (photos + docs)
  onChangeDocs: (docs: MediaRef[]) => void;
}

export function DocManager({ docs, allPersonFiles = [], onChangeDocs }: DocManagerProps) {
  const [undoItem, setUndoItem] = useState<{ doc: MediaRef; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Label prompt modal state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [docSuggestions, setDocSuggestions] = useState<string[]>([]);

  useEffect(() => {
    getSuggestions('docLabel').then((saved) => {
      setDocSuggestions(saved.map((s) => s.text));
    });
  }, []);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setPendingFile(file);
    setLabelInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmDoc = async () => {
    if (!pendingFile) return;

    const trimmedLabel = labelInput.trim() || 'বায়োডাটা PDF';
    // Save new label as suggestion (SPEC-UPDATE-1 3.2)
    recordSuggestion('docLabel', trimmedLabel).catch(() => {});

    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const kind = getMediaKind(pendingFile.type || '');

    const newDoc: MediaRef = {
      id,
      kind,
      name: pendingFile.name,
      label: trimmedLabel,
      mime: pendingFile.type || 'application/octet-stream',
      blob: pendingFile,
      createdAt: Date.now(),
    };

    onChangeDocs([...docs, newDoc]);
    setPendingFile(null);
    setLabelInput('');
  };

  const handleDelete = (index: number) => {
    const toDelete = docs[index];
    const updated = docs.filter((_, i) => i !== index);
    onChangeDocs(updated);

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoItem({ doc: toDelete, index });

    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null);
    }, 10000);
  };

  const handleUndo = () => {
    if (!undoItem) return;
    const restored = [...docs];
    restored.splice(undoItem.index, 0, undoItem.doc);
    onChangeDocs(restored);

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoItem(null);
  };

  const handleOpenDoc = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Limits check (SPEC-UPDATE-1 3.2: 15MB file, 50MB person total)
  const combinedFiles = [...allPersonFiles, ...docs];
  const { hasLargeFile, isOverTotalLimit, largeFiles, totalBytes } = checkMediaLimits(combinedFiles);

  return (
    <div className="space-y-3">
      {/* Header and Add button */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-700">
          {bn.fields.docs} ({docs.length})
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-sm transition"
        >
          <Plus className="w-4 h-4" />
          {bn.photosAndDocs.addDocs}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFilePicked}
        className="hidden"
      />

      {/* Warnings (SPEC-UPDATE-1 3.2) */}
      {hasLargeFile && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            {largeFiles.map((lf) => (
              <p key={lf.name}>
                {bn.photosAndDocs.warnLargeFile
                  .replace('{name}', lf.name)
                  .replace('{size}', lf.sizeStr)}
              </p>
            ))}
          </div>
        </div>
      )}

      {isOverTotalLimit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p>
            {bn.photosAndDocs.warnTotalLimit.replace(
              '{size}',
              formatFileSize(totalBytes)
            )}
          </p>
        </div>
      )}

      {/* 10-Second Undo Banner */}
      {undoItem ? (
        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm shadow-sm animate-fade-in">
          <span>{bn.photosAndDocs.docDeletedNotice}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="touch-target inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-xs"
          >
            <Undo2 className="w-4 h-4" />
            {bn.photosAndDocs.undo}
          </button>
        </div>
      ) : null}

      {/* List of Docs */}
      {docs.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-500 text-sm">
          {bn.photosAndDocs.emptyDocs}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc, index) => (
            <div
              key={doc.id || index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
            >
              <div className="flex items-center gap-2.5 truncate mr-2">
                <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 truncate">
                      {doc.label || doc.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({formatFileSize(doc.blob.size)})
                    </span>
                  </div>
                  {doc.label && doc.label !== doc.name ? (
                    <span className="text-xs text-gray-500 truncate block">
                      {doc.name}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenDoc(doc.blob)}
                  className="touch-target p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition text-xs font-semibold flex items-center gap-1"
                  title={bn.photosAndDocs.openDoc}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">{bn.photosAndDocs.openDoc}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="touch-target p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                  title={bn.actions.delete}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Label Prompt Modal */}
      {pendingFile ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="font-bold text-gray-900 text-base truncate">
                {pendingFile.name}
              </h4>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="touch-target p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {bn.photosAndDocs.docLabelPrompt}
              </label>

              {/* Suggestion Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {docSuggestions.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setLabelInput(chip)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      labelInput === chip
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <input
                type="text"
                autoFocus
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder={bn.photosAndDocs.docLabelPlaceholder}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="touch-target px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                {bn.actions.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDoc}
                className="touch-target px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-xs"
              >
                {bn.photosAndDocs.saveLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
