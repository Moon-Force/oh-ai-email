import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

/** Minutes between background IMAP sync. 0 = manual only. */
export const SYNC_INTERVAL_OPTIONS = [0, 1, 5, 10, 15, 30, 60] as const;
export type SyncIntervalMin = (typeof SYNC_INTERVAL_OPTIONS)[number];

export type AppPrefs = {
  syncIntervalMin: SyncIntervalMin;
};

const DEFAULTS: AppPrefs = {
  syncIntervalMin: 5,
};

function prefsPath(): string {
  return path.join(app.getPath("userData"), "app-prefs.json");
}

function clampInterval(n: unknown): SyncIntervalMin {
  const v = Number(n);
  return (SYNC_INTERVAL_OPTIONS as readonly number[]).includes(v)
    ? (v as SyncIntervalMin)
    : DEFAULTS.syncIntervalMin;
}

export function loadAppPrefs(): AppPrefs {
  const p = prefsPath();
  if (!fs.existsSync(p)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<AppPrefs>;
    return { syncIntervalMin: clampInterval(raw.syncIntervalMin) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppPrefs(partial: Partial<AppPrefs>): AppPrefs {
  const next: AppPrefs = {
    ...loadAppPrefs(),
    ...partial,
  };
  if (partial.syncIntervalMin !== undefined) {
    next.syncIntervalMin = clampInterval(partial.syncIntervalMin);
  }
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}
