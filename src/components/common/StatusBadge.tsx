import type { Status } from '../../types';
import { bn } from '../../i18n/bn';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  let style = '';

  switch (status) {
    case 'active':
      style = 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      break;
    case 'proposal':
      style = 'bg-amber-100 text-amber-800 border border-amber-300';
      break;
    case 'fixed':
      style = 'bg-blue-100 text-blue-800 border border-blue-300';
      break;
    case 'married':
      style = 'bg-gray-200 text-gray-700 border border-gray-300';
      break;
    case 'hold':
      style = 'bg-transparent text-gray-600 border border-dashed border-gray-400';
      break;
    default:
      style = 'bg-gray-100 text-gray-800 border border-gray-200';
  }

  const textSize = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  const label = bn.status[status] || status;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${textSize} ${style}`}
    >
      {label}
    </span>
  );
}
