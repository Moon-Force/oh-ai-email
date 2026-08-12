export function ping(): Promise<string> {
  return window.api.ping();
}
export const secretSave = (k: string, v: string) => window.api.secretSave(k, v);
export const secretLoad = (k: string) => window.api.secretLoad(k);
