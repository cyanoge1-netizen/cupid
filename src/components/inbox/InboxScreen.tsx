import { useState, useRef } from 'react';
import type { InboxItem, Partner } from '../../types';
import { bn } from '../../i18n/bn';
import { BlobImage } from '../common/BlobImage';
import { PasteTextModal } from './PasteTextModal';
import {
  Image as ImageIcon,
  FileText,
  Trash2,
  Sparkles,
  Inbox as InboxIcon,
  CheckCircle2,
  User,
} from 'lucide-react';

interface InboxScreenProps {
  items: InboxItem[];
  partners: Partner[];
  isJustShared?: boolean;
  onClearSharedNotice?: () => void;
  onProcessItem: (item: InboxItem) => void;
  onCreateManualItem: (files: File[], text: string, sourceId?: string | null) => Promise<void>;
  onDiscardItem: (id: string) => Promise<void>;
  onUpdateItemSource: (id: string, sourceId: string | null) => Promise<void>;
}

export function InboxScreen({
  items,
  partners,
  isJustShared,
  onClearSharedNotice,
  onProcessItem,
  onCreateManualItem,
  onDiscardItem,
  onUpdateItemSource,
}: InboxScreenProps) {
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [discardingItemId, setDiscardingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active (non-discarded) inbox items
  const activeItems = items
    .filter((item) => !item.discardedAt)
    .sort((a, b) => b.receivedAt - a.receivedAt);

  const newestSharedItem = isJustShared && activeItems.length > 0 ? activeItems[0] : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    await onCreateManualItem(fileList, '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePasteSubmit = async (pastedText: string) => {
    await onCreateManualItem([], pastedText);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner if redirected from OS Share Sheet */}
      {isJustShared && newestSharedItem ? (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{bn.inbox.sharedSuccess}</span>
            </div>
            {onClearSharedNotice ? (
              <button
                type="button"
                onClick={onClearSharedNotice}
                className="text-xs text-emerald-700 hover:text-emerald-900"
              >
                {bn.actions.close}
              </button>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold text-emerald-800 mb-2">
              {bn.inbox.whoSharedPrompt}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdateItemSource(newestSharedItem.id, null)}
                className={`touch-target px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  newestSharedItem.sourceId === null
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {bn.source.own}
              </button>
              {partners.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onUpdateItemSource(newestSharedItem.id, p.id)}
                  className={`touch-target px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    newestSharedItem.sourceId === p.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Two Primary Manual Intake Buttons (SPEC 5.4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,audio/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="touch-target flex items-center justify-center gap-2.5 py-3.5 px-4 bg-white border-2 border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-50/30 text-emerald-800 rounded-2xl font-bold shadow-sm transition"
        >
          <ImageIcon className="w-5 h-5 text-emerald-600" />
          <span>{bn.actions.pickGallery}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsPasteModalOpen(true)}
          className="touch-target flex items-center justify-center gap-2.5 py-3.5 px-4 bg-white border-2 border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-50/30 text-emerald-800 rounded-2xl font-bold shadow-sm transition"
        >
          <FileText className="w-5 h-5 text-emerald-600" />
          <span>{bn.actions.pasteText}</span>
        </button>
      </div>

      {/* Inbox List Header */}
      <div className="flex items-center justify-between text-sm text-gray-500 px-1 pt-2">
        <h2 className="font-bold text-gray-800 text-base">{bn.inbox.title}</h2>
        <span>
          {bn.inbox.itemCount.replace('{count}', String(activeItems.length))}
        </span>
      </div>

      {/* Inbox Items List */}
      {activeItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
            <InboxIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">
            {bn.inbox.emptyTitle}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {bn.inbox.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeItems.map((item) => {
            const firstPhotos = item.files
              .filter((f) => f.kind === 'image')
              .slice(0, 3);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:border-gray-300 transition space-y-3"
              >
                {/* Meta header */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {bn.inbox.receivedAt.replace(
                      '{time}',
                      new Date(item.receivedAt).toLocaleTimeString('bn-BD', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'short',
                      })
                    )}
                  </span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">
                    {item.via === 'share' ? 'হোয়াটসঅ্যাপ শেয়ার' : 'ম্যানুয়াল'}
                  </span>
                </div>

                {/* Previews: Thumbnails + Text snippet */}
                <div className="flex gap-3">
                  {firstPhotos.length > 0 ? (
                    <div className="flex -space-x-2 overflow-hidden flex-shrink-0">
                      {firstPhotos.map((photo, idx) => (
                        <div
                          key={photo.id || idx}
                          className="w-16 h-20 rounded-xl overflow-hidden border-2 border-white bg-gray-100 shadow-sm flex-shrink-0"
                        >
                          <BlobImage
                            blob={photo.thumb || photo.blob}
                            alt="Inbox preview"
                            className="w-full h-full"
                            fallbackIcon={<User className="w-5 h-5 text-gray-400" />}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex-1 min-w-0">
                    {item.text ? (
                      <p className="text-sm text-gray-700 font-mono line-clamp-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        {item.text}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic py-2">
                        {item.files.length}টি ফাইল সংযুক্ত
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => onProcessItem(item)}
                    className="touch-target flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-sm transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{bn.actions.processItem}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscardingItemId(item.id)}
                    className="touch-target p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    title={bn.actions.discard}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {discardingItemId ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {bn.actions.discard}
            </h3>
            <p className="text-sm text-gray-600">
              {bn.inbox.discardConfirm}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscardingItemId(null)}
                className="touch-target flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium"
              >
                {bn.actions.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDiscardItem(discardingItemId);
                  setDiscardingItemId(null);
                }}
                className="touch-target flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium"
              >
                {bn.actions.discard}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Paste Text Modal */}
      {isPasteModalOpen ? (
        <PasteTextModal
          onClose={() => setIsPasteModalOpen(false)}
          onSubmit={handlePasteSubmit}
        />
      ) : null}
    </div>
  );
}
