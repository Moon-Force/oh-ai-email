export type DbRow = Record<string, unknown>;

const LS_KEY = "oh-ai-email:accounts";

export function loadAccounts(): DbRow[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveAccounts(rows: DbRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}
