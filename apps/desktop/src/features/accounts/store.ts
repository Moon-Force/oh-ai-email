import { create } from "zustand";
import type { Account } from "./model";

type State = {
  accounts: Account[];
  setAccounts: (a: Account[]) => void;
  addAccount: (a: Account) => void;
  removeAccount: (id: string) => void;
};

export const useAccountsStore = create<State>((set) => ({
  accounts: [],
  setAccounts: (accounts) => set({ accounts }),
  addAccount: (a) => set((s) => ({ accounts: [...s.accounts, a] })),
  removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) })),
}));
