import { useState, useMemo, useRef } from 'react';
import type { Person, Partner, SendLog, InboxItem } from '../../types';
import { bn } from '../../i18n/bn';
import { PersonCard } from '../people/PersonCard';
import {
  Search,
  Mic,
  MicOff,
  PlusCircle,
  Inbox,
  AlertTriangle,
  Clock,
  HardDrive,
} from 'lucide-react';

interface HomeScreenProps {
  people: Person[];
  partners: Partner[];
  inboxItems: InboxItem[];
  sendLogs: SendLog[];
  lastBackupAt?: number;
  isStoragePersistent: boolean;
  onOpenInbox: () => void;
  onOpenBackup: () => void;
  onOpenSent: () => void;
  onSelectPerson: (person: Person) => void;
  onSharePerson: (person: Person, e: React.MouseEvent) => void;
  onSearchSubmit: (query: string) => void;
}

export function HomeScreen({
  people,
  partners,
  inboxItems,
  sendLogs,
  lastBackupAt,
  isStoragePersistent,
  onOpenInbox,
  onOpenBackup,
  onOpenSent,
  onSelectPerson,
  onSharePerson,
  onSearchSubmit,
}: HomeScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  const partnersMap = useMemo(() => {
    return new Map<string, Partner>(partners.map((p) => [p.id, p]));
  }, [partners]);

  // Active people calculations
  const nonDeletedPeople = useMemo(() => {
    return people.filter((p) => !p.deletedAt);
  }, [people]);

  const activeBridesCount = useMemo(() => {
    return nonDeletedPeople.filter((p) => p.gender === 'B' && p.status === 'active').length;
  }, [nonDeletedPeople]);

  const activeGroomsCount = useMemo(() => {
    return nonDeletedPeople.filter((p) => p.gender === 'G' && p.status === 'active').length;
  }, [nonDeletedPeople]);

  const proposalCount = useMemo(() => {
    return nonDeletedPeople.filter((p) => p.status === 'proposal').length;
  }, [nonDeletedPeople]);

  const fixedCount = useMemo(() => {
    return nonDeletedPeople.filter((p) => p.status === 'fixed').length;
  }, [nonDeletedPeople]);

  // Unanswered follow-ups: pending > 3 days
  const pendingFollowUps = useMemo(() => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return sendLogs.filter((log) => log.response === 'pending' && log.at < threeDaysAgo);
  }, [sendLogs]);

  // Backup overdue: > 7 days or never
  const isBackupOverdue = useMemo(() => {
    if (!lastBackupAt) return true;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return lastBackupAt < sevenDaysAgo;
  }, [lastBackupAt]);

  // Pending inbox items count
  const pendingInboxCount = useMemo(() => {
    return inboxItems.filter((item) => !item.discardedAt).length;
  }, [inboxItems]);

  // Recent 5 people
  const recentPeople = useMemo(() => {
    return [...nonDeletedPeople]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);
  }, [nonDeletedPeople]);

  // Voice search feature detection
  const recognitionRef = useRef<any>(null);
  const hasSpeech = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  const toggleVoiceSearch = () => {
    if (!hasSpeech) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'bn-BD';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          onSearchSubmit(transcript);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchSubmit(searchQuery.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input Bar (Large) */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center">
        <div className="absolute left-4 text-emerald-600 pointer-events-none">
          <Search className="w-6 h-6" />
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={bn.home.searchPlaceholder}
          className="w-full min-h-[52px] pl-12 pr-14 py-3 bg-white border-2 border-emerald-500/30 rounded-2xl shadow-sm text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
        />

        {hasSpeech ? (
          <button
            type="button"
            onClick={toggleVoiceSearch}
            className={`touch-target absolute right-2 p-2 rounded-full transition ${
              isListening
                ? 'text-red-600 bg-red-50 animate-pulse'
                : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title="ভয়েস সার্চ"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        ) : null}
      </form>

      {/* Primary Action Button: "নতুন যোগ করুন" (opens Inbox) */}
      <button
        type="button"
        onClick={onOpenInbox}
        className="touch-target w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 px-6 rounded-2xl shadow-sm text-lg transition"
      >
        <PlusCircle className="w-6 h-6" />
        <span>{bn.actions.addNew}</span>
      </button>

      {/* 4 Counter Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Bride Active */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold text-emerald-600">
            {activeBridesCount}
          </span>
          <span className="text-sm font-semibold text-gray-700 mt-1">
            {bn.home.activeBrides}
          </span>
        </div>

        {/* Groom Active */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold text-blue-600">
            {activeGroomsCount}
          </span>
          <span className="text-sm font-semibold text-gray-700 mt-1">
            {bn.home.activeGrooms}
          </span>
        </div>

        {/* Proposal */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold text-amber-600">
            {proposalCount}
          </span>
          <span className="text-sm font-semibold text-gray-700 mt-1">
            {bn.home.proposal}
          </span>
        </div>

        {/* Fixed */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold text-indigo-600">
            {fixedCount}
          </span>
          <span className="text-sm font-semibold text-gray-700 mt-1">
            {bn.home.fixed}
          </span>
        </div>
      </div>

      {/* Follow-up card if response = pending > 3 days */}
      {pendingFollowUps.length > 0 ? (
        <div
          onClick={onOpenSent}
          className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-amber-100/60 transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-200/70 text-amber-800 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-base">
                {bn.home.unansweredFollowUps.replace(
                  '{count}',
                  String(pendingFollowUps.length)
                )}
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                ৩ দিন আগে পাঠানো রেকর্ডের খোঁজ নিন
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-amber-800">
            {bn.actions.viewAll} →
          </span>
        </div>
      ) : null}

      {/* Inbox Card ("৩টি সাজানো বাকি") */}
      {pendingInboxCount > 0 ? (
        <div
          onClick={onOpenInbox}
          className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-emerald-100/60 transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-200/70 text-emerald-800 rounded-xl">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900 text-base">
                {bn.home.inboxPendingCount.replace(
                  '{count}',
                  String(pendingInboxCount)
                )}
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                ইনবক্সে থাকা ফাইল ও টেক্সট সাজিয়ে নিন
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-emerald-800">
            {bn.actions.processItem} →
          </span>
        </div>
      ) : null}

      {/* Backup overdue banner (> 7 days) */}
      {isBackupOverdue ? (
        <div
          onClick={onOpenBackup}
          className="bg-red-50 border border-red-300 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-red-100/60 transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-200/70 text-red-800 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-sm sm:text-base">
                {bn.home.backupOverdueBanner}
              </h3>
            </div>
          </div>
          <span className="text-sm font-semibold text-red-800 whitespace-nowrap ml-2">
            {bn.home.backupNow} →
          </span>
        </div>
      ) : null}

      {/* Persistent Storage Notice (if denied) */}
      {!isStoragePersistent ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-yellow-800">
          <HardDrive className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p>{bn.home.storageNotPersistent}</p>
        </div>
      ) : null}

      {/* Recent People Section */}
      <div className="space-y-3 pt-2">
        <h2 className="text-lg font-bold text-gray-900">
          {bn.home.recentPeople}
        </h2>

        {recentPeople.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-500">
            <p className="text-base">{bn.home.emptyRecent}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentPeople.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                partner={person.sourceId ? partnersMap.get(person.sourceId) : undefined}
                onSelect={onSelectPerson}
                onShare={onSharePerson}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
