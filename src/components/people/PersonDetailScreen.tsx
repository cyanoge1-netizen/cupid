import { useState } from 'react';
import type { Person, Partner, Status, SendLog } from '../../types';
import { bn } from '../../i18n/bn';
import { StatusBadge } from '../common/StatusBadge';
import { PartnerBadge } from '../common/PartnerBadge';
import { BlobImage } from '../common/BlobImage';
import { StatusChangeModal } from './StatusChangeModal';
import { PersonEditModal } from './PersonEditModal';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import {
  ArrowLeft,
  Share2,
  Edit3,
  Trash2,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  History,
} from 'lucide-react';

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
  const [showRawText, setShowRawText] = useState(false);

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
                  className="aspect-square rounded-xl overflow-hidden cursor-pointer border border-gray-200 active:scale-95 transition"
                >
                  <BlobImage
                    blob={photo.thumb || photo.blob}
                    alt={`${person.name || person.code} photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    fallbackIcon={<User className="w-6 h-6 text-gray-300" />}
                  />
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

        {/* Detailed Information Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">
            বিস্তারিত তথ্য
          </h2>

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
              <span className="text-sm text-gray-500 block">{bn.fields.village}</span>
              <span className="font-medium text-gray-800">
                {person.village || '—'}
              </span>
            </div>

            <div>
              <span className="text-sm text-gray-500 block">{bn.fields.phoneLast4}</span>
              <span className="font-medium text-gray-800 font-mono">
                {person.phoneLast4 ? `***${person.phoneLast4}` : '—'}
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
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate font-medium">
                      {doc.name || `ডকুমেন্ট ${idx + 1}`}
                    </span>
                  </div>
                  <a
                    href={URL.createObjectURL(doc.blob)}
                    download={doc.name || 'document'}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 p-2 touch-target"
                  >
                    ডাউনলোড
                  </a>
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

      {/* Lightbox / Full Photo Modal */}
      {activePhotoIndex !== null && person.photos?.[activePhotoIndex] ? (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setActivePhotoIndex(null)}
            className="touch-target absolute top-4 right-4 p-2 text-white bg-black/50 hover:bg-black/80 rounded-full"
            aria-label={bn.actions.close}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-full max-h-[85vh] overflow-hidden rounded-xl">
            <BlobImage
              blob={person.photos[activePhotoIndex].blob}
              alt={person.name || person.code}
              className="max-h-[85vh] max-w-full object-contain"
            />
          </div>
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
