import type { Person, Partner } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PartnerBadge } from '../common/PartnerBadge';
import { BlobImage } from '../common/BlobImage';
import { Share2, User, Phone, MessageCircle, Check } from 'lucide-react';
import { bn } from '../../i18n/bn';
import { educationSummary } from '../../utils/summary';

interface PersonCardProps {
  person: Person;
  partner?: Partner;
  onSelect: (person: Person) => void;
  onShare: (person: Person, e: React.MouseEvent) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (person: Person) => void;
}

export function PersonCard({
  person,
  partner,
  onSelect,
  onShare,
  selectable = false,
  selected = false,
  onToggleSelect,
}: PersonCardProps) {
  const coverPhoto =
    person.photos?.find((p) => p.id === person.coverPhotoId) || person.photos?.[0];
  const photoBlob = coverPhoto?.thumb || coverPhoto?.blob;
  const edu = educationSummary(person);
  const contactPhone = partner?.phone || person.phone;

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contactPhone) {
      window.location.href = `tel:${contactPhone}`;
    }
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contactPhone) {
      const cleanDigits = contactPhone.replace(/\D/g, '');
      const waNumber = cleanDigits.startsWith('88') ? cleanDigits : `88${cleanDigits}`;
      window.open(`https://wa.me/${waNumber}`, '_blank');
    }
  };

  const handleCardClick = () => {
    if (selectable && onToggleSelect) {
      onToggleSelect(person);
    } else {
      onSelect(person);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`rounded-xl shadow-sm border p-4 transition active:scale-[0.99] cursor-pointer flex flex-col gap-3 ${
        selected
          ? 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Top Header: Code, Badges, and WhatsApp Share button / Checkbox */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {selectable ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect(person);
              }}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition border ${
                selected
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-gray-300'
              }`}
            >
              {selected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
            </div>
          ) : null}
          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-sm tracking-wider">
            {person.code}
          </span>
          <PartnerBadge sourceId={person.sourceId} partner={partner} />
          <StatusBadge status={person.status} size="sm" />
        </div>

        {!selectable ? (
          <button
            type="button"
            onClick={(e) => onShare(person, e)}
            className="touch-target p-2 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 rounded-full transition"
            aria-label={bn.actions.share}
            title={bn.sent.shareViaWhatsApp}
          >
            <Share2 className="w-5 h-5" />
          </button>
        ) : null}
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

          {edu ? (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {edu}
            </p>
          ) : null}

          {person.tags && person.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {person.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-200 font-medium"
                >
                  #{tag}
                </span>
              ))}
              {person.tags.length > 3 ? (
                <span className="text-[10px] text-gray-400 px-1 py-0.5">
                  +{person.tags.length - 3}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Call & WhatsApp Quick Buttons (just like PartnerCard) */}
      {contactPhone ? (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleCall}
            className="touch-target flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs sm:text-sm font-semibold transition"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>{bn.actions.call}</span>
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="touch-target flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs sm:text-sm font-semibold transition"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>{bn.actions.whatsapp}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
