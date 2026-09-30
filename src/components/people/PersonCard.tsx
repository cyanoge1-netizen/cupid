import type { Person, Partner } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PartnerBadge } from '../common/PartnerBadge';
import { BlobImage } from '../common/BlobImage';
import { Share2, User } from 'lucide-react';
import { bn } from '../../i18n/bn';

interface PersonCardProps {
  person: Person;
  partner?: Partner;
  onSelect: (person: Person) => void;
  onShare: (person: Person, e: React.MouseEvent) => void;
}

export function PersonCard({ person, partner, onSelect, onShare }: PersonCardProps) {
  const firstPhoto = person.photos?.[0];
  const photoBlob = firstPhoto?.thumb || firstPhoto?.blob;

  return (
    <div
      onClick={() => onSelect(person)}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition active:scale-[0.99] hover:border-gray-300 cursor-pointer flex flex-col gap-3"
    >
      {/* Top Header: Code, Badges, and WhatsApp Share button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-sm tracking-wider">
            {person.code}
          </span>
          <PartnerBadge sourceId={person.sourceId} partner={partner} />
          <StatusBadge status={person.status} size="sm" />
        </div>

        <button
          type="button"
          onClick={(e) => onShare(person, e)}
          className="touch-target p-2 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 rounded-full transition"
          aria-label={bn.actions.share}
          title={bn.sent.shareViaWhatsApp}
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Main Body: Thumbnail + Info */}
      <div className="flex gap-3 items-start">
        {/* Photo Thumbnail */}
        <div className="w-20 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
          <BlobImage
            blob={photoBlob}
            alt={person.name || person.code}
            className="w-full h-full"
            fallbackIcon={<User className="w-8 h-8 text-gray-300" />}
          />
        </div>

        {/* Details list */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="font-bold text-lg text-gray-900 truncate">
            {person.name || bn.fields.name}
            {person.alias ? (
              <span className="text-gray-500 font-normal text-sm ml-1.5">
                ({person.alias})
              </span>
            ) : null}
          </h3>

          <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {person.age ? <span>{person.age} বছর</span> : null}
            {person.height ? <span>• {person.height}</span> : null}
            {person.district ? <span>• {person.district}</span> : null}
          </div>

          {person.profession ? (
            <p className="text-sm font-medium text-gray-700 mt-1 truncate">
              {person.profession}
            </p>
          ) : null}

          {person.education ? (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {person.education}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
