import { useState } from 'react';
import type { SendLog, Person } from '../../types';
import { bn } from '../../i18n/bn';
import { Send, CheckCircle2, XCircle, Clock, HelpCircle, ChevronRight } from 'lucide-react';

interface SentScreenProps {
  sendLogs: SendLog[];
  people: Person[];
  onSelectPerson: (person: Person) => void;
  onUpdateResponse: (logId: string, response: SendLog['response']) => Promise<void>;
}

const RESPONSE_OPTIONS: Array<{
  key: SendLog['response'];
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'pending', label: bn.sent.responses.pending, color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  { key: 'interested', label: bn.sent.responses.interested, color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  { key: 'no', label: bn.sent.responses.no, color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
  { key: 'other', label: bn.sent.responses.other, color: 'bg-blue-100 text-blue-800 border-blue-300', icon: HelpCircle },
];

export function SentScreen({
  sendLogs,
  people,
  onSelectPerson,
  onUpdateResponse,
}: SentScreenProps) {
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const peopleMap = new Map<string, Person>(people.map((p) => [p.id, p]));

  const sortedLogs = [...sendLogs].sort((a, b) => b.at - a.at);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{bn.sent.title}</h2>
          <p className="text-sm text-gray-500">মোট {sortedLogs.length}টি পাঠানো রেকর্ড</p>
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
            <Send className="w-6 h-6" />
          </div>
          <p className="text-base font-medium">{bn.sent.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLogs.map((log) => {
            const person = peopleMap.get(log.personId);
            const currentResp = RESPONSE_OPTIONS.find((r) => r.key === log.response) || RESPONSE_OPTIONS[0];
            const isEditing = editingLogId === log.id;

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:border-gray-300 transition space-y-3"
              >
                {/* Header: Recipient & Date */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      {log.recipient}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {new Date(log.at).toLocaleDateString('bn-BD', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingLogId(isEditing ? null : log.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${currentResp.color}`}
                  >
                    <currentResp.icon className="w-3.5 h-3.5" />
                    <span>{currentResp.label}</span>
                  </button>
                </div>

                {/* Person Reference Card */}
                {person ? (
                  <div
                    onClick={() => onSelectPerson(person)}
                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/80 rounded-xl cursor-pointer transition border border-gray-200/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-800">
                        {person.code}
                      </span>
                      <span className="font-medium text-sm text-gray-800">
                        {person.name || bn.fields.name}
                      </span>
                      {person.district ? (
                        <span className="text-xs text-gray-500">
                          • {person.district}
                        </span>
                      ) : null}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    (রেকর্ডটি পাওয়া যায়নি)
                  </span>
                )}

                {/* Expanded Response Switcher */}
                {isEditing ? (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <span className="text-xs font-semibold text-gray-500 block">
                      {bn.sent.changeResponse}:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {RESPONSE_OPTIONS.map((opt) => {
                        const isSelected = log.response === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={async () => {
                              await onUpdateResponse(log.id, opt.key);
                              setEditingLogId(null);
                            }}
                            className={`touch-target flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <opt.icon className="w-3.5 h-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
