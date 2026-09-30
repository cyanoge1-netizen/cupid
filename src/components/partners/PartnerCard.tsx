import type { Partner, Person } from '../../types';
import { bn } from '../../i18n/bn';
import { getPartnerColor } from '../../utils/colors';
import { Phone, MessageCircle, Edit3, Trash2, Users } from 'lucide-react';

interface PartnerCardProps {
  partner: Partner;
  people: Person[];
  onSelect: (partner: Partner) => void;
  onEdit: (partner: Partner, e: React.MouseEvent) => void;
  onDelete: (partner: Partner, e: React.MouseEvent) => void;
}

export function PartnerCard({
  partner,
  people,
  onSelect,
  onEdit,
  onDelete,
}: PartnerCardProps) {
  // Compute per-partner totals at read time (SPEC 5.8)
  const partnerPeople = people.filter(
    (p) => p.sourceId === partner.id && !p.deletedAt
  );
  const totalCount = partnerPeople.length;
  const activeCount = partnerPeople.filter((p) => p.status === 'active').length;
  const marriedCount = partnerPeople.filter((p) => p.status === 'married').length;

  const color = getPartnerColor(partner.id);
  const isDeleted = !!partner.deletedAt;

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (partner.phone) {
      window.location.href = `tel:${partner.phone}`;
    }
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (partner.phone) {
      const cleanDigits = partner.phone.replace(/\D/g, '');
      const waNumber = cleanDigits.startsWith('88') ? cleanDigits : `88${cleanDigits}`;
      window.open(`https://wa.me/${waNumber}`, '_blank');
    }
  };

  return (
    <div
      onClick={() => onSelect(partner)}
      className={`rounded-2xl border p-5 shadow-sm transition cursor-pointer active:scale-[0.99] ${
        isDeleted
          ? 'bg-gray-100 border-gray-200 opacity-60'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Header: Badge & Actions */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-3.5 h-3.5 rounded-full ${color.bg} border ${color.border}`}
          />
          <h3 className={`text-xl font-bold text-gray-900 ${isDeleted ? 'line-through' : ''}`}>
            {partner.name}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => onEdit(partner, e)}
            className="touch-target p-2 text-gray-400 hover:text-blue-600 rounded-full transition"
            title={bn.actions.edit}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {!isDeleted ? (
            <button
              type="button"
              onClick={(e) => onDelete(partner, e)}
              className="touch-target p-2 text-gray-400 hover:text-red-600 rounded-full transition"
              title={bn.actions.delete}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Area & Note */}
      {partner.area ? (
        <p className="text-sm font-medium text-gray-700 mb-1">{partner.area}</p>
      ) : null}
      {partner.note ? (
        <p className="text-xs text-gray-500 mb-3 whitespace-pre-wrap">{partner.note}</p>
      ) : null}

      {/* Live Computed Totals Chips */}
      <div className="flex flex-wrap gap-2 text-xs font-semibold mb-4">
        <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg">
          {bn.partners.statsTotal.replace('{count}', String(totalCount))}
        </span>
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
          {bn.partners.statsActive.replace('{count}', String(activeCount))}
        </span>
        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">
          {bn.partners.statsMarried.replace('{count}', String(marriedCount))}
        </span>
      </div>

      {/* Call & WhatsApp Quick Buttons */}
      {partner.phone ? (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleCall}
            className="touch-target flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-semibold transition"
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>{bn.actions.call}</span>
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="touch-target flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold transition"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>{bn.actions.whatsapp}</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Users className="w-4 h-4" />
          <span>তালিকায় দেখতে ট্যাপ করুন</span>
        </div>
      )}
    </div>
  );
}
