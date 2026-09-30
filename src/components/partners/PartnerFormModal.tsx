import { useState } from 'react';
import type { Partner } from '../../types';
import { bn } from '../../i18n/bn';
import { X } from 'lucide-react';

interface PartnerFormModalProps {
  partner?: Partner;
  onClose: () => void;
  onSave: (data: { name: string; phone?: string; area?: string; note?: string }) => Promise<void>;
}

export function PartnerFormModal({ partner, onClose, onSave }: PartnerFormModalProps) {
  const [name, setName] = useState(partner?.name || '');
  const [phone, setPhone] = useState(partner?.phone || '');
  const [area, setArea] = useState(partner?.area || '');
  const [note, setNote] = useState(partner?.note || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('সহযোগীর নাম আবশ্যক');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim() || undefined,
        area: area.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {partner ? bn.partners.editTitle : bn.partners.addTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {error}
            </p>
          ) : null}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.partners.name} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="যেমন: মকবুল ঘটক"
              className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.partners.phone}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="০১৭১১..."
              className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.partners.area}
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="যেমন: সিলেট সদর, গোলাপগঞ্জ"
              className="w-full min-h-[48px] px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {bn.partners.note}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="প্রয়োজনীয় যে কোনো মন্তব্য..."
              className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>

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
