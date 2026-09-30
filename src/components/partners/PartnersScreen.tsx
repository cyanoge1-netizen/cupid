import { useState } from 'react';
import type { Partner, Person } from '../../types';
import { bn } from '../../i18n/bn';
import { PartnerCard } from './PartnerCard';
import { PartnerFormModal } from './PartnerFormModal';
import { PartnerDeleteModal } from './PartnerDeleteModal';
import { Plus, Users } from 'lucide-react';

interface PartnersScreenProps {
  partners: Partner[];
  people: Person[];
  onSelectPartner: (partner: Partner) => void;
  onCreatePartner: (data: { name: string; phone?: string; area?: string; note?: string }) => Promise<Partner>;
  onUpdatePartner: (id: string, updates: Partial<Partner>) => Promise<void>;
  onDeletePartner: (id: string) => Promise<void>;
}

export function PartnersScreen({
  partners,
  people,
  onSelectPartner,
  onCreatePartner,
  onUpdatePartner,
  onDeletePartner,
}: PartnersScreenProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | undefined>(undefined);
  const [deletingPartner, setDeletingPartner] = useState<Partner | undefined>(undefined);

  const handleEdit = (partner: Partner, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPartner(partner);
    setIsFormOpen(true);
  };

  const handleDelete = (partner: Partner, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingPartner(partner);
  };

  const sortedPartners = [...partners].sort((a, b) => {
    // Non-deleted first
    if (!!a.deletedAt !== !!b.deletedAt) {
      return a.deletedAt ? 1 : -1;
    }
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="space-y-4">
      {/* Top Header with Add Partner Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{bn.partners.title}</h2>
          <p className="text-sm text-gray-500">
            {partners.filter((p) => !p.deletedAt).length} জন সক্রিয় সহযোগী
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingPartner(undefined);
            setIsFormOpen(true);
          }}
          className="touch-target inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition"
        >
          <Plus className="w-5 h-5" />
          <span>{bn.actions.add}</span>
        </button>
      </div>

      {/* Partners List */}
      {sortedPartners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-base font-medium">{bn.partners.empty}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedPartners.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              people={people}
              onSelect={onSelectPartner}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {isFormOpen ? (
        <PartnerFormModal
          partner={editingPartner}
          onClose={() => {
            setIsFormOpen(false);
            setEditingPartner(undefined);
          }}
          onSave={async (data) => {
            if (editingPartner) {
              await onUpdatePartner(editingPartner.id, data);
            } else {
              await onCreatePartner(data);
            }
          }}
        />
      ) : null}

      {deletingPartner ? (
        <PartnerDeleteModal
          partner={deletingPartner}
          onClose={() => setDeletingPartner(undefined)}
          onConfirm={async () => {
            await onDeletePartner(deletingPartner.id);
            setDeletingPartner(undefined);
          }}
        />
      ) : null}
    </div>
  );
}
