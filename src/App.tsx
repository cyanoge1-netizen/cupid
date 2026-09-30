import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Person, Partner, InboxItem, SendLog, Status } from './types';
import { bn } from './i18n/bn';
import {
  db,
  createPerson,
  updatePerson,
  softDeletePerson,
  restorePerson,
  createPartner,
  updatePartner,
  softDeletePartner,
  createInboxItem,
  softDiscardInboxItem,
  deleteInboxItem,
  createSendLog,
  updateSendLog,
  getMeta,
  setMeta,
  purgeOldDeleted,
  syncCounterWithExistingPeople,
  seedFieldDefsIfEmpty,
  seedSuggestionsIfEmpty,
} from './db';
import { createThumbnail, getMediaKind } from './utils/media';
import { verifyPin, type PinHashData } from './utils/security';

// Screens & Modals
import { HomeScreen } from './components/home/HomeScreen';
import { PeopleScreen } from './components/people/PeopleScreen';
import { PersonDetailScreen } from './components/people/PersonDetailScreen';
import { PartnersScreen } from './components/partners/PartnersScreen';
import { InboxScreen } from './components/inbox/InboxScreen';
import { ProcessItemScreen } from './components/inbox/ProcessItemScreen';
import { SentScreen } from './components/sent/SentScreen';
import { ShareModal } from './components/sent/ShareModal';
import { BulkShareModal } from './components/sent/BulkShareModal';
import { TrashScreen } from './components/trash/TrashScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { PinLockScreen } from './components/settings/PinLockScreen';

// Icons
import {
  Home,
  Users,
  Briefcase,
  Send,
  Inbox,
  Trash2,
  Settings,
  AlertCircle,
  X,
} from 'lucide-react';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'home' | 'people' | 'partners' | 'sent' | 'inbox' | 'trash' | 'settings'>('home');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [processingItem, setProcessingItem] = useState<InboxItem | null>(null);
  const [sharingPerson, setSharingPerson] = useState<Person | null>(null);
  const [bulkSharingPeople, setBulkSharingPeople] = useState<Person[] | null>(null);

  // Filter State passed between screens
  const [peopleFilterSource, setPeopleFilterSource] = useState<string | null | undefined>(undefined);
  const [peopleFilterStatus, setPeopleFilterStatus] = useState<Status | 'all'>('active');
  const [peopleSearchQuery, setPeopleSearchQuery] = useState<string>('');

  // Shared state from Web Share Target
  const [isJustShared, setIsJustShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // App Data State
  const [people, setPeople] = useState<Person[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [lastBackupAt, setLastBackupAt] = useState<number | undefined>(undefined);
  const [pinHash, setPinHash] = useState<PinHashData | undefined>(undefined);
  const [isStoragePersistent, setIsStoragePersistent] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load all data from Dexie
  const loadDatabase = useCallback(async () => {
    try {
      const [allPeople, allPartners, allInbox, allSendLogs, metaBackup, metaPin] =
        await Promise.all([
          db.people.toArray(),
          db.partners.toArray(),
          db.inbox.toArray(),
          db.sendLogs.toArray(),
          getMeta<number>('lastBackupAt'),
          getMeta<PinHashData>('pinHash'),
        ]);

      setPeople(allPeople);
      setPartners(allPartners);
      setInboxItems(allInbox);
      setSendLogs(allSendLogs);
      setLastBackupAt(metaBackup);
      setPinHash(metaPin);

      return { metaPin };
    } catch (err) {
      console.error('Failed to load database:', err);
      return {};
    }
  }, []);

  // Initial App Mount Lifecycles (SPEC 5.3, 5.11, 5.12, 7)
  useEffect(() => {
    async function initApp() {
      // 1. Purge items with deletedAt/discardedAt older than 30 days
      await purgeOldDeleted(30);

      // 2. Seed default field definitions & suggestions if empty (SPEC-UPDATE-1 3.4)
      await Promise.all([seedFieldDefsIfEmpty(), seedSuggestionsIfEmpty()]);

      // 3. Storage persistence check
      if (navigator.storage && navigator.storage.persist) {
        try {
          const persisted = await navigator.storage.persisted();
          if (!persisted) {
            const granted = await navigator.storage.persist();
            setIsStoragePersistent(granted);
          } else {
            setIsStoragePersistent(true);
          }
        } catch {
          setIsStoragePersistent(false);
        }
      }

      // 3. Load DB and check PIN lock
      const { metaPin } = await loadDatabase();
      if (metaPin?.hash) {
        setIsLocked(true);
      }

      // 4. Check URL params for share target redirect or error
      const params = new URLSearchParams(window.location.search);
      const isShareError = params.get('error') === 'share_failed';
      const isSharedSuccess = params.get('shared') === '1';

      if (isShareError) {
        setActiveTab('inbox');
        setShareError(bn.inbox.shareFailed);
        // Clean URL search query without reloading
        window.history.replaceState({}, '', window.location.pathname);
      } else if (isSharedSuccess || params.get('tab') === 'inbox') {
        setActiveTab('inbox');
        setIsJustShared(isSharedSuccess);
        // Clean URL search query without reloading
        window.history.replaceState({}, '', window.location.pathname);
      }

      setIsLoading(false);
    }

    initApp();
  }, [loadDatabase]);

  // Background Lock (Lock after 2 minutes in background - SPEC 5.12)
  useEffect(() => {
    let backgroundTime: number | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundTime = Date.now();
      } else {
        if (backgroundTime && pinHash?.hash) {
          const elapsed = Date.now() - backgroundTime;
          if (elapsed > 2 * 60 * 1000) {
            setIsLocked(true);
          }
        }
        backgroundTime = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pinHash]);

  // Selected person reference
  const selectedPerson = useMemo(() => {
    if (!selectedPersonId) return null;
    return people.find((p) => p.id === selectedPersonId) || null;
  }, [people, selectedPersonId]);

  // Partners map
  const partnersMap = useMemo(() => {
    return new Map<string, Partner>(partners.map((p) => [p.id, p]));
  }, [partners]);

  // Pending inbox items count
  const pendingInboxCount = useMemo(() => {
    return inboxItems.filter((i) => !i.discardedAt).length;
  }, [inboxItems]);

  // Deleted people list
  const deletedPeople = useMemo(() => {
    return people.filter((p) => !!p.deletedAt);
  }, [people]);

  // ---------------- Handlers ----------------

  const handleUnlock = async (enteredPin: string): Promise<boolean> => {
    if (!pinHash) {
      setIsLocked(false);
      return true;
    }
    const isValid = await verifyPin(enteredPin, pinHash);
    if (isValid) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const handleSavePin = async (hashData?: PinHashData) => {
    await setMeta('pinHash', hashData);
    setPinHash(hashData);
    if (!hashData) {
      setIsLocked(false);
    }
  };

  const handleSelectPartner = (partner: Partner) => {
    setPeopleFilterSource(partner.id);
    setPeopleFilterStatus('all');
    setActiveTab('people');
  };

  const handleHomeSearchSubmit = (query: string) => {
    setPeopleSearchQuery(query);
    setPeopleFilterStatus('all');
    setActiveTab('people');
  };

  const handleUpdatePerson = async (updates: Partial<Person>) => {
    if (!selectedPersonId) return;
    await updatePerson(selectedPersonId, updates);
    await loadDatabase();
  };

  const handleDeletePerson = async (id: string) => {
    await softDeletePerson(id);
    setSelectedPersonId(null);
    await loadDatabase();
  };

  const handleRestorePerson = async (id: string) => {
    await restorePerson(id);
    await loadDatabase();
  };

  const handleSaveNewPerson = async (
    personData: Omit<Person, 'id' | 'code' | 'createdAt' | 'updatedAt'>
  ): Promise<Person> => {
    const created = await createPerson(personData);
    if (personData.fromInboxId) {
      await deleteInboxItem(personData.fromInboxId);
    }
    setProcessingItem(null);
    await loadDatabase();
    return created;
  };

  const handleAttachToExisting = async (existingPersonId: string, item: InboxItem) => {
    const existing = people.find((p) => p.id === existingPersonId);
    if (!existing) return;

    const newPhotos = [...(existing.photos || []), ...item.files.filter((f) => f.kind === 'image')];
    const newDocs = [...(existing.docs || []), ...item.files.filter((f) => f.kind !== 'image')];
    const combinedRawText = [existing.rawText, item.text].filter(Boolean).join('\n---\n');

    await updatePerson(existingPersonId, {
      photos: newPhotos,
      docs: newDocs,
      rawText: combinedRawText,
    });

    await deleteInboxItem(item.id);
    setProcessingItem(null);
    await loadDatabase();
  };

  const handleCreateManualInboxItem = async (
    files: File[],
    text: string,
    sourceId: string | null = null
  ) => {
    const mediaRefs = [];
    for (const f of files) {
      const mime = f.type || 'application/octet-stream';
      const kind = getMediaKind(mime);
      const isImg = kind === 'image';
      const thumb = isImg ? await createThumbnail(f) : undefined;

      mediaRefs.push({
        id: crypto.randomUUID(),
        kind,
        name: f.name,
        mime,
        blob: f,
        thumb,
        createdAt: Date.now(),
      });
    }

    await createInboxItem({
      files: mediaRefs,
      text,
      via: 'manual',
      sourceId,
      status: 'new',
    });

    await loadDatabase();
  };

  const handleDiscardInboxItem = async (id: string) => {
    await softDiscardInboxItem(id);
    await loadDatabase();
  };

  const handleUpdateInboxItemSource = async (id: string, sourceId: string | null) => {
    await db.inbox.update(id, { sourceId });
    await loadDatabase();
  };

  const handleSaveSendLog = async (recipient: string) => {
    if (!sharingPerson) return;
    await createSendLog({
      personId: sharingPerson.id,
      recipient,
      version: 'original',
      response: 'pending',
    });
    setSharingPerson(null);
    await loadDatabase();
  };

  const handleSaveBulkSendLogs = async (recipient: string, personIds: string[]) => {
    const now = Date.now();
    for (const pId of personIds) {
      await createSendLog({
        personId: pId,
        recipient,
        version: 'redacted',
        response: 'pending',
        at: now,
      });
    }
    setBulkSharingPeople(null);
    await loadDatabase();
  };

  const handleUpdateSendResponse = async (logId: string, response: SendLog['response']) => {
    await updateSendLog(logId, { response });
    await loadDatabase();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-700 font-semibold">{bn.appName} লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  // App Lock Screen (SPEC 5.12)
  if (isLocked) {
    return <PinLockScreen onUnlock={handleUnlock} />;
  }

  // Person Detail View
  if (selectedPerson) {
    return (
      <>
        <PersonDetailScreen
          person={selectedPerson}
          partners={partners}
          sendLogs={sendLogs}
          onBack={() => setSelectedPersonId(null)}
          onUpdate={handleUpdatePerson}
          onDelete={handleDeletePerson}
          onShare={(p) => setSharingPerson(p)}
        />
        {sharingPerson ? (
          <ShareModal
            person={sharingPerson}
            partner={sharingPerson.sourceId ? partnersMap.get(sharingPerson.sourceId) : undefined}
            recentSendLogs={sendLogs}
            onClose={() => setSharingPerson(null)}
            onSaveSendLog={handleSaveSendLog}
          />
        ) : null}
      </>
    );
  }

  // Process Inbox Item View (SPEC 5.5)
  if (processingItem) {
    return (
      <ProcessItemScreen
        item={processingItem}
        people={people}
        partners={partners}
        onBack={() => setProcessingItem(null)}
        onSaveNewPerson={handleSaveNewPerson}
        onAttachToExisting={handleAttachToExisting}
        onCreatePartner={async (data) => {
          const p = await createPartner(data);
          await loadDatabase();
          return p;
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 selection:bg-emerald-100">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div
          onClick={() => {
            setActiveTab('home');
            setPeopleFilterSource(undefined);
            setPeopleSearchQuery('');
          }}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            ঘ
          </div>
          <div>
            <h1 className="font-extrabold text-xl leading-tight text-gray-900 tracking-tight">
              {bn.appName}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium leading-none">
              {bn.appTagline}
            </p>
          </div>
        </div>

        {/* Top Quick Actions: Inbox, Trash, Settings */}
        <div className="flex items-center gap-1">
          {/* Inbox Button */}
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`touch-target relative p-2.5 rounded-full transition ${
              activeTab === 'inbox'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={bn.nav.inbox}
          >
            <Inbox className="w-5 h-5" />
            {pendingInboxCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {pendingInboxCount}
              </span>
            ) : null}
          </button>

          {/* Trash Button */}
          <button
            type="button"
            onClick={() => setActiveTab('trash')}
            className={`touch-target relative p-2.5 rounded-full transition ${
              activeTab === 'trash'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={bn.nav.trash}
          >
            <Trash2 className="w-5 h-5" />
            {deletedPeople.length > 0 ? (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            ) : null}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`touch-target p-2.5 rounded-full transition ${
              activeTab === 'settings'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={bn.nav.settings}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4">
        {shareError ? (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-2xl flex items-center justify-between mb-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-sm font-semibold">{shareError}</span>
            </div>
            <button
              type="button"
              onClick={() => setShareError(null)}
              className="touch-target text-gray-400 hover:text-gray-600 p-1 rounded-full"
              aria-label={bn.actions.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {activeTab === 'home' ? (
          <HomeScreen
            people={people}
            partners={partners}
            inboxItems={inboxItems}
            sendLogs={sendLogs}
            lastBackupAt={lastBackupAt}
            isStoragePersistent={isStoragePersistent}
            onOpenInbox={() => setActiveTab('inbox')}
            onOpenBackup={() => setActiveTab('settings')}
            onOpenSent={() => setActiveTab('sent')}
            onSelectPerson={(p) => setSelectedPersonId(p.id)}
            onSharePerson={(p, e) => {
              e.stopPropagation();
              setSharingPerson(p);
            }}
            onSearchSubmit={handleHomeSearchSubmit}
          />
        ) : null}

        {activeTab === 'people' ? (
          <PeopleScreen
            people={people}
            partners={partners}
            initialSourceFilter={peopleFilterSource}
            initialStatusFilter={peopleFilterStatus}
            initialQuery={peopleSearchQuery}
            onSelectPerson={(p) => setSelectedPersonId(p.id)}
            onSharePerson={(p, e) => {
              e.stopPropagation();
              setSharingPerson(p);
            }}
            onBulkShare={(selectedPeople) => setBulkSharingPeople(selectedPeople)}
          />
        ) : null}

        {activeTab === 'partners' ? (
          <PartnersScreen
            partners={partners}
            people={people}
            onSelectPartner={handleSelectPartner}
            onCreatePartner={async (data) => {
              const p = await createPartner(data);
              await loadDatabase();
              return p;
            }}
            onUpdatePartner={async (id, updates) => {
              await updatePartner(id, updates);
              await loadDatabase();
            }}
            onDeletePartner={async (id) => {
              await softDeletePartner(id);
              await loadDatabase();
            }}
          />
        ) : null}

        {activeTab === 'sent' ? (
          <SentScreen
            sendLogs={sendLogs}
            people={people}
            onSelectPerson={(p) => setSelectedPersonId(p.id)}
            onUpdateResponse={handleUpdateSendResponse}
          />
        ) : null}

        {activeTab === 'inbox' ? (
          <InboxScreen
            items={inboxItems}
            partners={partners}
            isJustShared={isJustShared}
            onClearSharedNotice={() => setIsJustShared(false)}
            onProcessItem={(item) => setProcessingItem(item)}
            onCreateManualItem={handleCreateManualInboxItem}
            onDiscardItem={handleDiscardInboxItem}
            onUpdateItemSource={handleUpdateInboxItemSource}
          />
        ) : null}

        {activeTab === 'trash' ? (
          <TrashScreen
            deletedPeople={deletedPeople}
            onRestorePerson={handleRestorePerson}
            onClose={() => setActiveTab('home')}
          />
        ) : null}

        {activeTab === 'settings' ? (
          <SettingsScreen
            lastBackupAt={lastBackupAt}
            pinHash={pinHash}
            isStoragePersistent={isStoragePersistent}
            onRefreshData={async () => {
              await loadDatabase();
              await syncCounterWithExistingPeople();
            }}
            onSavePin={handleSavePin}
            onClose={() => setActiveTab('home')}
          />
        ) : null}
      </main>

      {/* Share Modal Dialog */}
      {sharingPerson ? (
        <ShareModal
          person={sharingPerson}
          partner={sharingPerson.sourceId ? partnersMap.get(sharingPerson.sourceId) : undefined}
          recentSendLogs={sendLogs}
          onClose={() => setSharingPerson(null)}
          onSaveSendLog={handleSaveSendLog}
        />
      ) : null}

      {/* Bulk Share Modal Dialog */}
      {bulkSharingPeople ? (
        <BulkShareModal
          people={bulkSharingPeople}
          partnersMap={partnersMap}
          recentSendLogs={sendLogs}
          onClose={() => setBulkSharingPeople(null)}
          onSaveSendLogs={handleSaveBulkSendLogs}
        />
      ) : null}

      {/* Fixed Bottom Navigation (4 Tabs - SPEC 6) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16 px-2">
          {/* Home Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              setPeopleFilterSource(undefined);
              setPeopleSearchQuery('');
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'home'
                ? 'text-emerald-700 font-bold'
                : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-xs">{bn.nav.home}</span>
          </button>

          {/* People Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('people');
              setPeopleFilterSource(undefined);
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'people'
                ? 'text-emerald-700 font-bold'
                : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span className="text-xs">{bn.nav.people}</span>
          </button>

          {/* Partners Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`touch-target flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'partners'
                ? 'text-emerald-700 font-bold'
                : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <Briefcase className="w-5 h-5 mb-0.5" />
            <span className="text-xs">{bn.nav.partners}</span>
          </button>

          {/* Sent Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('sent')}
            className={`touch-target flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === 'sent'
                ? 'text-emerald-700 font-bold'
                : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <Send className="w-5 h-5 mb-0.5" />
            <span className="text-xs">{bn.nav.sent}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
