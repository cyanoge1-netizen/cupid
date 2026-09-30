import { useState, useEffect } from 'react';
import type { Person, Partner, Status, SendLog, FieldDef } from '../../types';
import { bn } from '../../i18n/bn';
import { db } from '../../db';
import { StatusBadge } from '../common/StatusBadge';
import { PartnerBadge } from '../common/PartnerBadge';
import { BlobImage } from '../common/BlobImage';
import { StatusChangeModal } from './StatusChangeModal';
import { PersonEditModal } from './PersonEditModal';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { formatFileSize } from '../../utils/media';
import {
  ArrowLeft,
  ArrowRight,
  Share2,
  Edit3,
  Trash2,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  History,
  Star,
  ExternalLink,
  Phone,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { getPartnerColor } from '../../utils/colors';

interface PersonDetailScreenProps {
  person: Person;
  partners: Partner[];
  sendLogs: SendLog[];
  onBack: () => void;
  onUpdate: (updates: Partial<Person>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onShare: (person: Person) => void;
}

export function PersonDetailScreen({
  person,
  partners,
  sendLogs,
  onBack,
  onUpdate,
  onDelete,
  onShare,
}: PersonDetailScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [fieldDefsMap, setFieldDefsMap] = useState<Map<string, FieldDef>>(new Map());

  // Effective cover photo ID (coverPhotoId or first photo)
  const effectiveCoverId = person.coverPhotoId || (person.photos?.[0]?.id);

  // Keyboard navigation for photo lightbox
  useEffect(() => {
    if (activePhotoIndex === null || !person.photos) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && activePhotoIndex > 0) {
        setActivePhotoIndex(activePhotoIndex - 1);
      } else if (e.key === 'ArrowRight' && activePhotoIndex < person.photos!.length - 1) {
        setActivePhotoIndex(activePhotoIndex + 1);
      } else if (e.key === 'Escape') {
        setActivePhotoIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhotoIndex, person.photos]);

  useEffect(() => {
    db.fieldDefs.toArray().then((defs) => {
      const map = new Map<string, FieldDef>();
      for (const d of defs) {
        map.set(d.id, d);
      }
      setFieldDefsMap(map);
    });
  }, [person.extra]);

  const partner = person.sourceId
    ? partners.find((p) => p.id === person.sourceId)
    : undefined;

  const marriedViaPartner = person.marriedViaPartnerId
    ? partners.find((p) => p.id === person.marriedViaPartnerId)
    : undefined;

  const personSendLogs = sendLogs
    .filter((log) => log.personId === person.id)
    .sort((a, b) => b.at - a.at);

  const handleStatusSave = async (
    newStatus: Status,
    marriedDetails?: { marriedViaPartnerId: string | null; marriedAt: number }
  ) => {
    if (newStatus === 'married' && marriedDetails) {
      await onUpdate({
        status: newStatus,
        marriedAt: marriedDetails.marriedAt,
        marriedViaPartnerId: marriedDetails.marriedViaPartnerId,
      });
    } else {
      await onUpdate({ status: newStatus });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="touch-target p-2 text-gray-700 hover:bg-gray-100 rounded-full"
            aria-label={bn.actions.back}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-mono font-bold text-lg text-gray-900 bg-gray-100 px-2.5 py-1 rounded">
            {person.code}
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onShare(person)}
            className="touch-target p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition"
            title={bn.actions.share}
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="touch-target p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"
            title={bn.actions.edit}
          >
            <Edit3 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setIsDeleting(true)}
            className="touch-target p-2 text-red-600 hover:bg-red-50 rounded-full transition"
            title={bn.actions.delete}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Photo Gallery */}
        {person.photos && person.photos.length > 0 ? (
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">
              {bn.fields.photos} ({person.photos.length})
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {person.photos.map((photo, index) => (
                <div
                  key={photo.id || index}
                  onClick={() => setActivePhotoIndex(index)}
                  className="aspect-square rounded-xl overflow-hidden cursor-pointer border border-gray-200 active:scale-95 transition relative"
                >
                  <BlobImage
                    blob={photo.thumb || photo.blob}
                    alt={`${person.name || person.code} photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    fallbackIcon={<User className="w-6 h-6 text-gray-300" />}
                  />
                  {photo.id === effectiveCoverId ? (
                    <span
                      className="absolute top-1.5 left-1.5 bg-amber-500 text-white p-1 rounded-full shadow-sm"
                      title={bn.photosAndDocs.coverPhoto}
                    >
                      <Star className="w-3 h-3 fill-white" />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Header Summary Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <PartnerBadge sourceId={person.sourceId} partner={partner} />
            <button
              type="button"
              onClick={() => setIsChangingStatus(true)}
              className="touch-target hover:opacity-80 transition"
            >
              <StatusBadge status={person.status} />
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {person.name || bn.fields.name}
            </h1>
            {person.alias ? (
              <p className="text-gray-500 text-base mt-0.5">
                {bn.fields.alias}: {person.alias}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            <span className="bg-gray-100 px-3 py-1 rounded-lg">
              {bn.gender[person.gender]}
            </span>
            {person.age ? (
              <span className="bg-gray-100 px-3 py-1 rounded-lg">
                {person.age} বছর
              </span>
            ) : null}
            {person.height ? (
              <span className="bg-gray-100 px-3 py-1 rounded-lg">
                {person.height}
              </span>
            ) : null}
          </div>

          {person.status === 'married' && person.marriedAt ? (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
              <p>
                <span className="font-semibold">{bn.fields.marriedAt}:</span>{' '}
                {new Date(person.marriedAt).toLocaleDateString('bn-BD')}
              </p>
              <p className="mt-1">
                <span className="font-semibold">{bn.fields.marriedVia}:</span>{' '}
                {marriedViaPartner ? marriedViaPartner.name : bn.source.own}
              </p>
            </div>
          ) : null}
        </div>

        {/* Partner / Source Card with Call & WhatsApp Buttons */}
        {partner ? (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-4 h-4 rounded-full ${getPartnerColor(partner.id).bg} border ${getPartnerColor(partner.id).border}`}
                />
                <div>
                  <span className="text-xs text-gray-500 block">
                    {bn.source.suppliedBy} / {bn.source.partner}
                  </span>
                  <h3 className="font-bold text-lg text-gray-900">{partner.name}</h3>
                </div>
              </div>
              {partner.area ? (
                <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-medium">
                  {partner.area}
                </span>
              ) : null}
            </div>

            {partner.note ? (
              <p className="text-xs text-gray-500 whitespace-pre-wrap">{partner.note}</p>
            ) : null}

            {partner.phone ? (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `tel:${partner.phone}`;
                  }}
                  className="touch-target flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-semibold transition"
                >
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>{bn.actions.call} ({partner.phone})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanDigits = partner.phone!.replace(/\D/g, '');
                    const waNumber = cleanDigits.startsWith('88') ? cleanDigits : `88${cleanDigits}`;
                    window.open(`https://wa.me/${waNumber}`, '_blank');
                  }}
                  className="touch-target flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold transition"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>{bn.actions.whatsapp}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Candidate Direct Phone with Call & WhatsApp (if available) */}
        {person.phone ? (
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-2">
            <div>
              <span className="text-xs text-gray-500 block">{bn.fields.phone}</span>
              <span className="font-bold text-base text-gray-900 font-mono">{person.phone}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `tel:${person.phone}`;
                }}
                className="touch-target flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-semibold transition"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>{bn.actions.call}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleanDigits = person.phone!.replace(/\D/g, '');
                  const waNumber = cleanDigits.startsWith('88') ? cleanDigits : `88${cleanDigits}`;
                  window.open(`https://wa.me/${waNumber}`, '_blank');
                }}
                className="touch-target flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>{bn.actions.whatsapp}</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Detailed Information Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-lg font-bold text-gray-900">
              বিস্তারিত তথ্য
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="touch-target flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>সম্পাদনা</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="touch-target flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>তথ্য যোগ করুন</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base">
            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.father}</span>
              <span className="font-medium text-gray-800">
                {person.father || '—'}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.mother}</span>
              <span className="font-medium text-gray-800">
                {person.mother || '—'}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.district}</span>
              <span className="font-medium text-gray-800">
                {person.district || '—'}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.upazila}</span>
              <span className="font-medium text-gray-800">
                {person.upazila || '—'}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.postOffice}</span>
              <span className="font-medium text-gray-800">
                {person.postOffice || '—'}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.village}</span>
              <span className="font-medium text-gray-800">
                {person.village || '—'}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">
                {person.phone ? bn.fields.phone : bn.fields.phoneLast4}
              </span>
              <span className="font-medium text-gray-800 font-mono">
                {person.phone ? person.phone : (person.phoneLast4 ? `***${person.phoneLast4}` : '—')}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.profession}</span>
              <span className="font-medium text-gray-800">
                {person.profession || '—'}
              </span>
            </div>

            {person.educations && person.educations.length > 0 ? (
              <div className="sm:col-span-2">
                <span className="text-sm text-gray-500 block mb-2">{bn.fields.education}</span>
                <div className="space-y-2">
                  {person.educations.map((edu, idx) => (
                    <div
                      key={edu.id || idx}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">
                          {edu.level}
                          {edu.status === 'ongoing' ? (
                            <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                              {bn.education.statusOngoing}
                            </span>
                          ) : null}
                        </span>
                        {edu.year ? <span className="text-xs text-gray-500">{edu.year}</span> : null}
                      </div>
                      {edu.subject || edu.institution ? (
                        <p className="text-gray-600 mt-1">
                          {[edu.subject, edu.institution].filter(Boolean).join(' • ')}
                        </p>
                      ) : null}
                      {edu.result ? (
                        <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                          {bn.education.result}: {edu.result}
                        </p>
                      ) : null}
                      {edu.note ? (
                        <p className="text-xs text-gray-500 mt-1 italic">{edu.note}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <span className="text-sm text-gray-500 block">{bn.fields.education}</span>
                <span className="font-medium text-gray-800">
                  {person.education || '—'}
                </span>
              </div>
            )}
          </div>

          {person.memo ? (
            <div className="pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500 block mb-1">
                {bn.fields.memo}
              </span>
              <p className="text-gray-800 bg-gray-50 p-3 rounded-xl whitespace-pre-wrap">
                {person.memo}
              </p>
            </div>
          ) : null}

          {person.tags && person.tags.length > 0 ? (
            <div className="pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500 block mb-1.5">
                {bn.fields.tags}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {person.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full border border-emerald-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Custom Fields Sections (SPEC-UPDATE-1 3.4) */}
        {(['family', 'personal', 'professional', 'preference', 'other'] as const).map((sec) => {
          const secValues = (person.extra || []).filter((item) => {
            const def = fieldDefsMap.get(item.fieldId);
            return def?.section === sec && item.value?.trim();
          });

          if (secValues.length === 0) return null;

          const secName = bn.customFields.sections[sec] || sec;

          return (
            <div
              key={sec}
              className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {secName}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="touch-target flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>সম্পাদনা</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
                {secValues.map((item) => {
                  const def = fieldDefsMap.get(item.fieldId);
                  if (!def) return null;
                  const isLong = item.value.length > 50 || item.value.includes('\n');

                  return (
                    <div
                      key={item.fieldId}
                      className={isLong ? 'sm:col-span-2' : ''}
                    >
                      <span className="text-xs font-semibold text-gray-500 block mb-0.5">
                        {def.label}
                      </span>
                      <span className="font-medium text-gray-800 whitespace-pre-wrap">
                        {item.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Documents Card */}
        {person.docs && person.docs.length > 0 ? (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">
              {bn.fields.docs} ({person.docs.length})
            </h2>
            <div className="space-y-2">
              {person.docs.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {doc.label || doc.name || `ডকুমেন্ট ${idx + 1}`}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(doc.blob.size)})
                        </span>
                      </div>
                      {doc.label && doc.label !== doc.name ? (
                        <span className="text-xs text-gray-500 truncate block">
                          {doc.name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const url = URL.createObjectURL(doc.blob);
                        window.open(url, '_blank');
                      }}
                      className="touch-target p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition text-xs font-semibold flex items-center gap-1"
                      title={bn.photosAndDocs.openDoc}
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">{bn.photosAndDocs.openDoc}</span>
                    </button>
                    <a
                      href={URL.createObjectURL(doc.blob)}
                      download={doc.name || 'document'}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-700 p-2 touch-target"
                    >
                      ডাউনলোড
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Raw Text Accordion */}
        {person.rawText ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRawText(!showRawText)}
              className="touch-target w-full flex items-center justify-between p-4 text-left font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <span>{bn.fields.rawText}</span>
              {showRawText ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showRawText ? (
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-sm font-mono text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {person.rawText}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Send History */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <History className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {bn.nav.sent} ইতিহাস ({personSendLogs.length})
            </h2>
          </div>

          {personSendLogs.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              এখনও কাউকে পাঠানো হয়নি।
            </p>
          ) : (
            <div className="space-y-2">
              {personSendLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"
                >
                  <div>
                    <span className="font-semibold text-gray-900 block">
                      {log.recipient}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.at).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-800">
                    {bn.sent.responses[log.response] || log.response}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Lightbox / Full Photo Modal with Swipe & Controls */}
      {activePhotoIndex !== null && person.photos?.[activePhotoIndex] ? (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 select-none"
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX === null || !person.photos) return;
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            if (deltaX > 40 && activePhotoIndex > 0) {
              setActivePhotoIndex(activePhotoIndex - 1);
            } else if (deltaX < -40 && activePhotoIndex < person.photos.length - 1) {
              setActivePhotoIndex(activePhotoIndex + 1);
            }
            setTouchStartX(null);
          }}
        >
          {/* Top Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-2">
              <span className="bg-black/60 px-3 py-1 rounded-full text-xs font-mono">
                {activePhotoIndex + 1} / {person.photos.length}
              </span>
              {person.photos[activePhotoIndex].id === effectiveCoverId ? (
                <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-white" />
                  {bn.photosAndDocs.coverPhoto}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setActivePhotoIndex(null)}
              className="touch-target p-2 text-white bg-black/60 hover:bg-black/80 rounded-full transition"
              aria-label={bn.actions.close}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Left Arrow Button */}
          {activePhotoIndex > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePhotoIndex(activePhotoIndex - 1);
              }}
              className="touch-target absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition z-10"
              aria-label={bn.photosAndDocs.prevPhoto}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : null}

          {/* Main Image */}
          <div className="max-w-full max-h-[80vh] overflow-hidden rounded-xl">
            <BlobImage
              blob={person.photos[activePhotoIndex].blob}
              alt={person.name || person.code}
              className="max-h-[80vh] max-w-full object-contain"
            />
          </div>

          {/* Right Arrow Button */}
          {activePhotoIndex < person.photos.length - 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePhotoIndex(activePhotoIndex + 1);
              }}
              className="touch-target absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition z-10"
              aria-label={bn.photosAndDocs.nextPhoto}
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Modals */}
      {isChangingStatus ? (
        <StatusChangeModal
          currentStatus={person.status}
          partners={partners}
          onClose={() => setIsChangingStatus(false)}
          onSave={handleStatusSave}
        />
      ) : null}

      {isEditing ? (
        <PersonEditModal
          person={person}
          partners={partners}
          onClose={() => setIsEditing(false)}
          onSave={onUpdate}
        />
      ) : null}

      {isDeleting ? (
        <DeleteConfirmDialog
          personName={person.name}
          personCode={person.code}
          onClose={() => setIsDeleting(false)}
          onConfirm={async () => {
            await onDelete(person.id);
            setIsDeleting(false);
            onBack();
          }}
        />
      ) : null}
    </div>
  );
}
