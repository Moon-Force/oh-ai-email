/** Serializable attachment for IPC → SMTP (base64 content). */
export type MailAttachmentPayload = {
  filename: string;
  contentType: string;
  /** base64 without data: prefix */
  contentBase64: string;
  size: number;
};

export type LocalAttachment = MailAttachmentPayload & {
  id: string;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB total (common provider soft limit)

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function totalAttachmentBytes(files: { size: number }[]): number {
  return files.reduce((s, f) => s + f.size, 0);
}

export async function fileToAttachment(file: File): Promise<LocalAttachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`「${file.name}」超过单文件上限 ${formatBytes(MAX_FILE_BYTES)}`);
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const contentBase64 = btoa(binary);
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    contentBase64,
    size: file.size,
  };
}

export function validateAttachmentBatch(
  existing: { size: number }[],
  incoming: { size: number; name?: string }[],
): string | null {
  for (const f of incoming) {
    if (f.size > MAX_FILE_BYTES) {
      return `「${f.name ?? "文件"}」超过单文件上限 ${formatBytes(MAX_FILE_BYTES)}`;
    }
  }
  const total = totalAttachmentBytes(existing) + incoming.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return `附件合计不能超过 ${formatBytes(MAX_TOTAL_BYTES)}（当前约 ${formatBytes(total)}）`;
  }
  return null;
}

export { MAX_FILE_BYTES, MAX_TOTAL_BYTES };
