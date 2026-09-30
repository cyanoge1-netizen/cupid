import type { Person } from '../../types';
import { bn } from '../../i18n/bn';
import { Trash2, RotateCcw, AlertCircle } from 'lucide-react';

interface TrashScreenProps {
  deletedPeople: Person[];
  onRestorePerson: (id: string) => Promise<void>;
  onClose: () => void;
}

export function TrashScreen({
  deletedPeople,
  onRestorePerson,
  onClose,
}: TrashScreenProps) {
  const sortedDeleted = [...deletedPeople].sort(
    (a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)
  );

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{bn.trash.title}</h2>
          <p className="text-sm text-gray-500">
            {sortedDeleted.length}টি মুছে ফেলা বায়োডাটা
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="touch-target px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition"
        >
          {bn.actions.back}
        </button>
      </div>

      {/* 30-day purge notice banner (SPEC 5.3) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-sm text-amber-900">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">{bn.trash.autoPurgeNotice}</p>
      </div>

      {/* Deleted Items List */}
      {sortedDeleted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <p className="text-base font-medium">{bn.trash.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDeleted.map((person) => (
            <div
              key={person.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {person.code}
                  </span>
                  <h3 className="font-bold text-base text-gray-900">
                    {person.name || bn.fields.name}
                  </h3>
                </div>

                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                  {person.district ? <span>{person.district}</span> : null}
                  {person.deletedAt ? (
                    <span>
                      মুছে ফেলা হয়েছে:{' '}
                      {new Date(person.deletedAt).toLocaleDateString('bn-BD', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRestorePerson(person.id)}
                className="touch-target inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-sm font-semibold transition"
              >
                <RotateCcw className="w-4 h-4 text-emerald-600" />
                <span>{bn.actions.restore}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
