import { create } from "zustand";
import type { Account } from "./model";
import type { AccountDto } from "../../lib/ipc";
import { accountRemove as ipcRemove } from "../../lib/ipc";

type State = {
  accounts: Account[];
  activeAccountId: string | null;
  setAccounts: (a: Account[], activeId?: string | null) => void;
  setActiveAccountId: (id: string | null) => void;
  addAccount: (a: Account) => void;
  removeAccount: (id: string) => Promise<void>;
};

function fromDto(a: AccountDto): Account {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    providerId: a.providerId,
    imapHost: a.imapHost,
    imapPort: a.imapPort,
    imapTls: a.imapTls,
    smtpHost: a.smtpHost,
    smtpPort: a.smtpPort,
    smtpTls: a.smtpTls,
    createdAt: a.createdAt,
  };
}

export function accountFromDto(a: AccountDto): Account {
  return fromDto(a);
}

export const useAccountsStore = create<State>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  setAccounts: (accounts, activeId) =>
    set({
      accounts,
      activeAccountId:
        activeId !== undefined
          ? activeId
          : accounts.find((a) => a.id === get().activeAccountId)?.id ?? accounts[0]?.id ?? null,
    }),
  setActiveAccountId: (id) => set({ activeAccountId: id }),
  addAccount: (a) =>
    set((s) => ({
      accounts: [...s.accounts.filter((x) => x.id !== a.id), a],
      activeAccountId: a.id,
    })),
  removeAccount: async (id) => {
    await ipcRemove(id);
    set((s) => {
      const accounts = s.accounts.filter((x) => x.id !== id);
      return {
        accounts,
        activeAccountId: s.activeAccountId === id ? accounts[0]?.id ?? null : s.activeAccountId,
      };
    });
  },
}));
