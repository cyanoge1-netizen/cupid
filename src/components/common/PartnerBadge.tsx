import type { Partner } from '../../types';
import { getPartnerColor } from '../../utils/colors';
import { bn } from '../../i18n/bn';

interface PartnerBadgeProps {
  sourceId: string | null;
  partner?: Partner;
}

export function PartnerBadge({ sourceId, partner }: PartnerBadgeProps) {
  if (!sourceId) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {bn.source.own}
      </span>
    );
  }

  const isDeleted = !!partner?.deletedAt;
  const name = partner ? partner.name : bn.source.partner;

  if (isDeleted) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200 line-through">
        {name}
      </span>
    );
  }

  const color = getPartnerColor(sourceId);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color.bg} ${color.text} border ${color.border}`}
    >
      {name}
    </span>
  );
}
