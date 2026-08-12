import { app, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";

const filePath = path.join(app.getPath("userData"), "secure.json");

export function saveSecret(key: string, value: string) {
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
  const enc = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(value).toString("base64")
    : value;
  data[key] = enc;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
}

export function loadSecret(key: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const v = data[key];
  if (!v) return null;
  try {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(v, "base64"))
      : v;
  } catch {
    return null;
  }
}
