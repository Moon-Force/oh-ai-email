import { app, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";

const filePath = () => path.join(app.getPath("userData"), "secure.json");

type StoreFile = Record<string, string>;

function readAll(): StoreFile {
  const p = filePath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as StoreFile;
  } catch {
    return {};
  }
}

function writeAll(data: StoreFile) {
  const p = filePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
}

function encrypt(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString("base64");
  }
  // Fallback (dev VMs without OS encryption): still not plain — weak obfuscation only
  return Buffer.from(value, "utf-8").toString("base64");
}

function decrypt(value: string): string | null {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    }
    return Buffer.from(value, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/** Persist a secret (password / token) encrypted via OS safeStorage when available. */
export function saveSecret(key: string, value: string): boolean {
  const data = readAll();
  data[key] = encrypt(value);
  writeAll(data);
  return true;
}

export function loadSecret(key: string): string | null {
  const data = readAll();
  const v = data[key];
  if (!v) return null;
  return decrypt(v);
}

export function deleteSecret(key: string): boolean {
  const data = readAll();
  if (!(key in data)) return false;
  delete data[key];
  writeAll(data);
  return true;
}
