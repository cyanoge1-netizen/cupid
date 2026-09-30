import { useState, useRef } from 'react';
import type { MediaRef } from '../../types';
import { bn } from '../../i18n/bn';
import { createThumbnail } from '../../utils/media';
import { BlobImage } from '../common/BlobImage';
import {
  Plus,
  Star,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Undo2,
  User,
} from 'lucide-react';

interface PhotoManagerProps {
  photos: MediaRef[];
  coverPhotoId?: string;
  onChangePhotos: (photos: MediaRef[]) => void;
  onChangeCoverId: (coverId: string) => void;
}

export function PhotoManager({
  photos,
  coverPhotoId,
  onChangePhotos,
  onChangeCoverId,
}: PhotoManagerProps) {
  const [undoItem, setUndoItem] = useState<{ photo: MediaRef; index: number; wasCover: boolean } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active cover is either explicit coverPhotoId or the first photo by default
  const effectiveCoverId = coverPhotoId || (photos.length > 0 ? photos[0].id : undefined);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessing(true);
    try {
      const newFiles = Array.from(e.target.files);
      const newPhotos: MediaRef[] = [];

      for (const file of newFiles) {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        const thumb = await createThumbnail(file);
        newPhotos.push({
          id,
          kind: 'image',
          name: file.name,
          mime: file.type || 'image/jpeg',
          blob: file,
          thumb,
          createdAt: Date.now(),
        });
      }

      const updated = [...photos, ...newPhotos];
      onChangePhotos(updated);

      // If no cover was set, set first as cover
      if (!coverPhotoId && updated.length > 0) {
        onChangeCoverId(updated[0].id);
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetCover = (id: string) => {
    onChangeCoverId(id);
  };

  const handleMove = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const copy = [...photos];
    const temp = copy[targetIndex];
    copy[targetIndex] = copy[index];
    copy[index] = temp;
    onChangePhotos(copy);
  };

  const handleDelete = (index: number) => {
    const toDelete = photos[index];
    const wasCover = toDelete.id === effectiveCoverId;
    const updated = photos.filter((_, i) => i !== index);
    onChangePhotos(updated);

    if (wasCover && updated.length > 0) {
      onChangeCoverId(updated[0].id);
    }

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoItem({ photo: toDelete, index, wasCover });

    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null);
    }, 10000);
  };

  const handleUndo = () => {
    if (!undoItem) return;
    const restored = [...photos];
    restored.splice(undoItem.index, 0, undoItem.photo);
    onChangePhotos(restored);

    if (undoItem.wasCover) {
      onChangeCoverId(undoItem.photo.id);
    }

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoItem(null);
  };

  return (
    <div className="space-y-3">
      {/* Header and Add button */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-700">
          {bn.fields.photos} ({photos.length})
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-sm transition"
        >
          <Plus className="w-4 h-4" />
          {isProcessing ? 'যুক্ত হচ্ছে...' : bn.photosAndDocs.addPhotos}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 10-Second Undo Banner */}
      {undoItem ? (
        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm shadow-sm animate-fade-in">
          <span>{bn.photosAndDocs.photoDeletedNotice}</span>
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

      {/* Grid of Photos */}
      {photos.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-500 text-sm">
          {bn.photosAndDocs.emptyPhotos}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, index) => {
            const isCover = photo.id === effectiveCoverId;

            return (
              <div
                key={photo.id || index}
                className={`relative rounded-xl overflow-hidden border transition bg-gray-100 flex flex-col ${
                  isCover ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-200'
                }`}
              >
                {/* Photo Thumbnail */}
                <div className="aspect-square relative">
                  <BlobImage
                    blob={photo.thumb || photo.blob}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                    fallbackIcon={<User className="w-10 h-10 text-gray-300" />}
                  />

                  {/* Cover Badge */}
                  {isCover ? (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-md flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {bn.photosAndDocs.coverPhoto}
                    </div>
                  ) : null}

                  {/* Set Cover Star Button */}
                  <button
                    type="button"
                    onClick={() => handleSetCover(photo.id)}
                    className="touch-target absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition"
                    title={bn.photosAndDocs.setAsCover}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isCover ? 'fill-amber-400 text-amber-400' : 'text-white'
                      }`}
                    />
                  </button>
                </div>

                {/* Bottom Control Bar: Move left/right and Delete */}
                <div className="p-1.5 bg-white border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'left')}
                      disabled={index === 0}
                      className="touch-target p-1 text-gray-600 hover:text-gray-900 disabled:opacity-20 rounded"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 'right')}
                      disabled={index === photos.length - 1}
                      className="touch-target p-1 text-gray-600 hover:text-gray-900 disabled:opacity-20 rounded"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="touch-target p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    title={bn.actions.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
