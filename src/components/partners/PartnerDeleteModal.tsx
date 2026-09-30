import type { Partner } from '../../types';
import { bn } from '../../i18n/bn';
import { AlertTriangle } from 'lucide-react';

interface PartnerDeleteModalProps {
  partner: Partner;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function PartnerDeleteModal({ partner, onClose, onConfirm }: PartnerDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{partner.name}</h2>
        </div>

        <p className="text-gray-700 text-base mb-6 leading-relaxed">
          {bn.partners.deleteConfirm}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="touch-target flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            {bn.actions.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="touch-target flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition"
          >
            {bn.actions.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
