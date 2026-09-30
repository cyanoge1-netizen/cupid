import { useState } from 'react';
import { bn } from '../../i18n/bn';
import { X, ClipboardPaste } from 'lucide-react';

interface PasteTextModalProps {
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
}

export function PasteTextModal({ onClose, onSubmit }: PasteTextModalProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          setText(clipText);
        }
      }
    } catch {
      // Clipboard access denied or unsupported; user can paste manually
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {bn.inbox.pasteModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>ক্লিপবোর্ড থেকে নিন</span>
            </button>
          </div>

          <textarea
            required
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={bn.inbox.pastePlaceholder}
            className="w-full flex-1 p-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base font-mono resize-none"
          />

          <div className="flex gap-3 pt-2">
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
              disabled={isSubmitting || !text.trim()}
              className="touch-target flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {bn.actions.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
