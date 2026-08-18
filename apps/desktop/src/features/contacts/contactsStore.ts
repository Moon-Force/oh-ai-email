import { create } from "zustand";
import type { ContactDto } from "./types";
import {
  contactsCreate,
  contactsDelete,
  contactsExportVcfDialog,
  contactsHarvest,
  contactsImportVcf,
  contactsList,
  contactsToggleStar,
  contactsUpdate,
} from "../../lib/ipc";

export interface ContactsStoreState {
  contacts: ContactDto[];
  selectedContactId: string | null;
  searchQuery: string;
  selectedTag: string | null;
  starredOnly: boolean;

  contactDialogOpen: boolean;
  contactDialogMode: "create" | "edit";
  contactDraft: Partial<ContactDto> | null;

  harvesterOpen: boolean;
  harvestedCandidates: Array<{ name: string; email: string; count: number; lastDateMs: number }>;

  vcfImportDialogOpen: boolean;
  loading: boolean;

  loadContacts: () => Promise<void>;
  selectContact: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTag: (tag: string | null) => void;
  toggleStarredFilter: () => void;

  openCreateDialog: (prefill?: Partial<ContactDto>) => void;
  openEditDialog: (contact: ContactDto) => void;
  closeDialog: () => void;

  openHarvester: () => Promise<void>;
  closeHarvester: () => void;
  importHarvestedContact: (candidate: { name: string; email: string }) => Promise<void>;

  setVcfImportDialogOpen: (open: boolean) => void;

  saveContact: (data: Partial<ContactDto>) => Promise<ContactDto | null>;
  removeContact: (id: string) => Promise<boolean>;
  toggleStar: (id: string) => Promise<void>;
  importVcf: (vcfText: string) => Promise<number>;
  exportVcf: (contactIds?: string[]) => Promise<void>;

  filteredContacts: () => ContactDto[];
  allTags: () => string[];
  getSelectedContact: () => ContactDto | null;
}

export const useContactsStore = create<ContactsStoreState>((set, get) => ({
  contacts: [],
  selectedContactId: null,
  searchQuery: "",
  selectedTag: null,
  starredOnly: false,

  contactDialogOpen: false,
  contactDialogMode: "create",
  contactDraft: null,

  harvesterOpen: false,
  harvestedCandidates: [],
  vcfImportDialogOpen: false,
  loading: false,

  loadContacts: async () => {
    set({ loading: true });
    try {
      const list = await contactsList();
      set({
        contacts: list,
        loading: false,
        selectedContactId: get().selectedContactId || (list.length > 0 ? list[0].id : null),
      });
    } catch (err) {
      console.error("[ContactsStore] Failed to load contacts:", err);
      set({ loading: false });
    }
  },

  selectContact: (id) => {
    set({ selectedContactId: id });
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
  },

  setSelectedTag: (selectedTag) => {
    set({ selectedTag });
  },

  toggleStarredFilter: () => {
    set((s) => ({ starredOnly: !s.starredOnly }));
  },

  openCreateDialog: (prefill) => {
    set({
      contactDialogOpen: true,
      contactDialogMode: "create",
      contactDraft: {
        name: "",
        email: "",
        secondaryEmails: [],
        phone: "",
        company: "",
        jobTitle: "",
        notes: "",
        tags: [],
        isStarred: false,
        ...prefill,
      },
    });
  },

  openEditDialog: (contact) => {
    set({
      contactDialogOpen: true,
      contactDialogMode: "edit",
      contactDraft: { ...contact },
    });
  },

  closeDialog: () => {
    set({
      contactDialogOpen: false,
      contactDraft: null,
    });
  },

  openHarvester: async () => {
    set({ harvesterOpen: true });
    try {
      const candidates = await contactsHarvest(50);
      set({ harvestedCandidates: candidates });
    } catch (err) {
      console.error("[ContactsStore] Failed to harvest contacts:", err);
    }
  },

  closeHarvester: () => {
    set({ harvesterOpen: false, harvestedCandidates: [] });
  },

  importHarvestedContact: async (candidate) => {
    try {
      await contactsCreate({
        name: candidate.name,
        email: candidate.email,
        secondaryEmails: [],
        tags: ["邮件沉淀"],
        isStarred: false,
      });
      set((s) => ({
        harvestedCandidates: s.harvestedCandidates.filter((c) => c.email !== candidate.email),
      }));
      await get().loadContacts();
    } catch (err) {
      console.error("[ContactsStore] Failed to import candidate:", err);
    }
  },

  setVcfImportDialogOpen: (open) => {
    set({ vcfImportDialogOpen: open });
  },

  saveContact: async (data) => {
    try {
      const isEdit = get().contactDialogMode === "edit";
      const draft = get().contactDraft;
      const base = isEdit && draft ? { ...draft, ...data } : data;
      let res: ContactDto | null = null;

      const email = base.email?.trim().toLowerCase() || "";
      if (!email) return null;

      const payload = {
        name: base.name?.trim() || email.split("@")[0] || "未命名",
        email,
        secondaryEmails: base.secondaryEmails || [],
        phone: base.phone?.trim() || undefined,
        company: base.company?.trim() || undefined,
        jobTitle: base.jobTitle?.trim() || undefined,
        avatarColor: base.avatarColor,
        notes: base.notes?.trim() || undefined,
        tags: base.tags || [],
        isStarred: Boolean(base.isStarred),
      };

      if (isEdit && draft?.id) {
        res = await contactsUpdate(draft.id, payload);
      } else {
        res = await contactsCreate(payload);
      }

      await get().loadContacts();
      if (res) {
        set({ selectedContactId: res.id });
      }
      get().closeDialog();
      return res;
    } catch (err) {
      console.error("[ContactsStore] Failed to save contact:", err);
      return null;
    }
  },

  removeContact: async (id) => {
    try {
      const ok = await contactsDelete(id);
      if (ok) {
        set((s) => {
          const nextContacts = s.contacts.filter((c) => c.id !== id);
          return {
            contacts: nextContacts,
            selectedContactId:
              s.selectedContactId === id
                ? nextContacts.length > 0
                  ? nextContacts[0].id
                  : null
                : s.selectedContactId,
          };
        });
        get().closeDialog();
      }
      return ok;
    } catch (err) {
      console.error("[ContactsStore] Failed to delete contact:", err);
      return false;
    }
  },

  toggleStar: async (id) => {
    try {
      const newStarred = await contactsToggleStar(id);
      set((s) => ({
        contacts: s.contacts.map((c) => (c.id === id ? { ...c, isStarred: newStarred } : c)),
      }));
    } catch (err) {
      console.error("[ContactsStore] Failed to toggle star:", err);
    }
  },

  importVcf: async (vcfText) => {
    try {
      const res = await contactsImportVcf(vcfText);
      await get().loadContacts();
      return res.importedCount;
    } catch (err) {
      console.error("[ContactsStore] Failed to import VCF:", err);
      return 0;
    }
  },

  exportVcf: async (contactIds) => {
    try {
      await contactsExportVcfDialog(contactIds);
    } catch (err) {
      console.error("[ContactsStore] Failed to export VCF:", err);
    }
  },

  filteredContacts: () => {
    const { contacts, searchQuery, selectedTag, starredOnly } = get();
    let list = [...contacts];

    if (starredOnly) {
      list = list.filter((c) => c.isStarred);
    }
    if (selectedTag) {
      list = list.filter((c) => c.tags.includes(selectedTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
      );
    }

    return list.sort(
      (a, b) => (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0) || a.name.localeCompare(b.name)
    );
  },

  allTags: () => {
    const { contacts } = get();
    const tagSet = new Set<string>();
    for (const c of contacts) {
      for (const t of c.tags) {
        if (t) tagSet.add(t);
      }
    }
    return Array.from(tagSet);
  },

  getSelectedContact: () => {
    const { contacts, selectedContactId } = get();
    if (!selectedContactId) return null;
    return contacts.find((c) => c.id === selectedContactId) || null;
  },
}));
