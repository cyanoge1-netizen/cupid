import { useState, useMemo, useEffect, useRef } from 'react';
import type { Person, Partner, Status, Gender } from '../../types';
import { bn } from '../../i18n/bn';
import { PersonCard } from './PersonCard';
import { searchPeople } from '../../utils/search';
import { Search, Mic, MicOff, X, Filter, CheckSquare, Share2 } from 'lucide-react';

interface PeopleScreenProps {
  people: Person[];
  partners: Partner[];
  onSelectPerson: (person: Person) => void;
  onSharePerson: (person: Person, e: React.MouseEvent) => void;
  onBulkShare?: (selectedPeople: Person[]) => void;
  initialSourceFilter?: string | null;
  initialStatusFilter?: Status | 'all';
  initialQuery?: string;
}

export function PeopleScreen({
  people,
  partners,
  onSelectPerson,
  onSharePerson,
  onBulkShare,
  initialSourceFilter,
  initialStatusFilter = 'active',
  initialQuery = '',
}: PeopleScreenProps) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedStatus, setSelectedStatus] = useState<Status | 'all'>(initialStatusFilter);
  const [selectedGender, setSelectedGender] = useState<Gender | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<string | null | 'all'>(
    initialSourceFilter !== undefined ? initialSourceFilter : 'all'
  );
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [isListening, setIsListening] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Debounce query (150ms) as specified in SPEC 5.9
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);
    return () => clearTimeout(handler);
  }, [query]);

  // Voice Search feature detection (webkitSpeechRecognition)
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
          setQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
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

  const partnersMap = useMemo(() => {
    return new Map<string, Partner>(partners.map((p) => [p.id, p]));
  }, [partners]);

  // Extract all unique non-empty districts for filter
  const districts = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      if (p.district && !p.deletedAt) {
        set.add(p.district.trim());
      }
    }
    return Array.from(set).sort();
  }, [people]);

  // Execute in-memory search with active filters
  const searchResults = useMemo(() => {
    return searchPeople(
      debouncedQuery,
      people,
      {
        status: selectedStatus,
        gender: selectedGender,
        sourceId: selectedSource,
        district: selectedDistrict,
      },
      partnersMap
    );
  }, [debouncedQuery, people, selectedStatus, selectedGender, selectedSource, selectedDistrict, partnersMap]);

  const hasNearMatch = searchResults.some((r) => r.isNearMatch);

  const STATUS_CHIPS: Array<{ key: Status | 'all'; label: string }> = [
    { key: 'active', label: bn.status.active },
    { key: 'proposal', label: bn.status.proposal },
    { key: 'fixed', label: bn.status.fixed },
    { key: 'married', label: bn.status.married },
    { key: 'all', label: bn.status.all },
  ];

  const GENDER_CHIPS: Array<{ key: Gender | 'all'; label: string }> = [
    { key: 'all', label: bn.gender.all },
    { key: 'B', label: bn.gender.B },
    { key: 'G', label: bn.gender.G },
  ];

  const handleToggleSelect = (person: Person) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(person.id)) {
        next.delete(person.id);
      } else {
        next.add(person.id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === searchResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(searchResults.map((r) => r.person.id)));
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleTriggerBulkShare = () => {
    const selectedPeople = searchResults
      .map((r) => r.person)
      .filter((p) => selectedIds.has(p.id));
    if (onBulkShare && selectedPeople.length > 0) {
      onBulkShare(selectedPeople);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-gray-400 pointer-events-none">
          <Search className="w-5 h-5" />
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={bn.home.searchPlaceholder}
          className="w-full min-h-[48px] pl-10 pr-24 py-2.5 bg-white border border-gray-300 rounded-2xl shadow-sm text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="touch-target p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
              aria-label={bn.actions.clear}
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}

          {hasSpeech ? (
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`touch-target p-2 rounded-full transition ${
                isListening
                  ? 'text-red-600 bg-red-50 animate-pulse'
                  : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
              title={isListening ? bn.messages.listening : 'ভয়েস সার্চ'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`touch-target p-2 rounded-full transition ${
              showFilters || selectedGender !== 'all' || selectedSource !== 'all' || selectedDistrict !== 'all'
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title={bn.actions.filter}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Primary Status Filter Chips (Always visible) */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {STATUS_CHIPS.map((chip) => {
          const isSelected = selectedStatus === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setSelectedStatus(chip.key)}
              className={`touch-target px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition border ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Expanded Filter Panel (Gender, Source, District) */}
      {showFilters ? (
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
          {/* Gender */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              {bn.fields.gender}
            </label>
            <div className="flex gap-2">
              {GENDER_CHIPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setSelectedGender(g.key)}
                  className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    selectedGender === g.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Filter */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              {bn.fields.source}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedSource('all')}
                className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  selectedSource === 'all'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {bn.people.allSources}
              </button>
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  selectedSource === null
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {bn.source.own}
              </button>
              {partners.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedSource(p.id)}
                  className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    selectedSource === p.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* District Filter */}
          {districts.length > 0 ? (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                {bn.fields.district}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDistrict('all')}
                  className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    selectedDistrict === 'all'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {bn.people.allDistricts}
                </button>
                {districts.map((dist) => (
                  <button
                    key={dist}
                    type="button"
                    onClick={() => setSelectedDistrict(dist)}
                    className={`touch-target px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      selectedDistrict === dist
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {dist}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Near match fallback banner */}
      {hasNearMatch ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-sm font-medium">
          {bn.people.nearMatches}
        </div>
      ) : null}

      {/* Results Header Count & Bulk Select Actions */}
      <div className="flex items-center justify-between text-sm text-gray-500 px-1 py-1">
        <span>
          {bn.people.resultsCount.replace('{count}', String(searchResults.length))}
        </span>

        {searchResults.length > 0 ? (
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="touch-target text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl transition"
                >
                  {selectedIds.size === searchResults.length ? bn.people.deselectAll : bn.people.selectAll}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSelection}
                  className="touch-target text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-xl transition"
                >
                  {bn.people.bulkSelectCancel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsSelectionMode(true)}
                className="touch-target text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bn.people.bulkSelect}</span>
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Cards List or Empty State */}
      {searchResults.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 space-y-2">
          <p className="text-lg font-medium">{bn.people.noResults}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {searchResults.map(({ person }) => (
            <PersonCard
              key={person.id}
              person={person}
              partner={person.sourceId ? partnersMap.get(person.sourceId) : undefined}
              onSelect={onSelectPerson}
              onShare={onSharePerson}
              selectable={isSelectionMode}
              selected={selectedIds.has(person.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}

      {/* Floating Bottom Bar for Bulk Action */}
      {isSelectionMode ? (
        <div className="fixed bottom-20 inset-x-4 max-w-lg mx-auto z-40 bg-gray-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-700 animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">
              {bn.people.selectedCount.replace('{count}', String(selectedIds.size))}
            </span>
          </div>

          <button
            type="button"
            onClick={handleTriggerBulkShare}
            disabled={selectedIds.size === 0}
            className="touch-target px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-xl text-sm transition flex items-center gap-1.5 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>{bn.people.bulkShare}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
