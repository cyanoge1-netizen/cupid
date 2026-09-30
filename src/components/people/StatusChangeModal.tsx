import { useState } from 'react';
import type { Status, Partner } from '../../types';
import { bn } from '../../i18n/bn';
import { StatusBadge } from '../common/StatusBadge';
import { Check } from 'lucide-react';

interface StatusChangeModalProps {
  currentStatus: Status;
  partners: Partner[];
  onClose: () => void;
  onSave: (newStatus: Status, marriedDetails?: { marriedViaPartnerId: string | null; marriedAt: number }) => Promise<void>;
}

const ALL_STATUSES: Status[] = ['active', 'proposal', 'fixed', 'married', 'hold'];

export function StatusChangeModal({
  currentStatus,
  partners,
  onClose,
  onSave,
}: StatusChangeModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<Status>(currentStatus);
  const [marriedViaPartnerId, setMarriedViaPartnerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTransitioningToMarried = selectedStatus === 'married';

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      if (isTransitioningToMarried) {
        await onSave('married', {
          marriedViaPartnerId,
          marriedAt: Date.now(),
        });
      } else {
        await onSave(selectedStatus);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{bn.fields.status}</h2>

        {/* Status selection list */}
        <div className="flex flex-col gap-2 mb-6">
          {ALL_STATUSES.map((status) => {
            const isSelected = selectedStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={`touch-target w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={status} />
                </div>
                {isSelected ? <Check className="w-5 h-5 text-emerald-600" /> : null}
              </button>
            );
          })}
        </div>

        {/* If changing to Married, prompt for "who arranged it?" */}
        {isTransitioningToMarried ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-amber-900 text-sm mb-3">
              {bn.source.whoArranged}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMarriedViaPartnerId(null)}
                className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  marriedViaPartnerId === null
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {bn.source.own}
              </button>

              {partners.map((partner) => {
                const isSelected = marriedViaPartnerId === partner.id;
                return (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => setMarriedViaPartnerId(partner.id)}
                    className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {partner.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="touch-target flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            {bn.actions.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="touch-target flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
          >
            {bn.actions.save}
          </button>
        </div>
      </div>
    </div>
  );
}
