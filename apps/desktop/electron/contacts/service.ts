import {
  createContact,
  deleteContact,
  getContactByEmail,
  getContactById,
  harvestContactsFromMessages,
  listContacts,
  toggleContactStarred,
  touchContactLastContacted,
  updateContact,
  type ContactRecord,
} from "../db";

/**
 * Generate standard vCard (.vcf) 3.0 formatted text for contacts.
 */
export function exportContactsToVcf(contacts: ContactRecord[]): string {
  const lines: string[] = [];

  for (const c of contacts) {
    lines.push("BEGIN:VCARD");
    lines.push("VERSION:3.0");
    lines.push(`FN:${c.name}`);
    lines.push(`N:${c.name};;;;`);
    lines.push(`EMAIL;TYPE=INTERNET,PREF:${c.email}`);

    if (c.secondaryEmails && c.secondaryEmails.length > 0) {
      for (const sec of c.secondaryEmails) {
        lines.push(`EMAIL;TYPE=INTERNET:${sec}`);
      }
    }
    if (c.phone) {
      lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
    }
    if (c.company) {
      lines.push(`ORG:${c.company}`);
    }
    if (c.jobTitle) {
      lines.push(`TITLE:${c.jobTitle}`);
    }
    if (c.notes) {
      lines.push(`NOTE:${c.notes.replace(/\n/g, "\\n")}`);
    }
    if (c.tags && c.tags.length > 0) {
      lines.push(`CATEGORIES:${c.tags.join(",")}`);
    }
    lines.push("END:VCARD");
  }

  return lines.join("\r\n");
}

/**
 * Parse vCard text and import contacts into local database.
 */
export function parseVcfContent(vcfContent: string): Array<Partial<ContactRecord>> {
  const unfolded = vcfContent.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const contacts: Array<Partial<ContactRecord>> = [];

  let inVcard = false;
  let current: Partial<ContactRecord> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VCARD") {
      inVcard = true;
      current = {
        secondaryEmails: [],
        tags: [],
        isStarred: false,
      };
      continue;
    }
    if (trimmed === "END:VCARD") {
      if (inVcard && (current.email || current.name)) {
        if (!current.email && current.secondaryEmails && current.secondaryEmails.length > 0) {
          current.email = current.secondaryEmails[0];
          current.secondaryEmails = current.secondaryEmails.slice(1);
        }
        if (!current.name) {
          current.name = current.email ? current.email.split("@")[0] : "未命名联系人";
        }
        if (current.email) {
          contacts.push(current);
        }
      }
      inVcard = false;
      current = {};
      continue;
    }

    if (!inVcard) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const rawKey = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    switch (key) {
      case "FN":
        current.name = value.replace(/\\,/g, ",").replace(/\\n/g, "\n");
        break;
      case "EMAIL": {
        const cleanEmail = value.trim();
        if (!current.email) {
          current.email = cleanEmail;
        } else {
          current.secondaryEmails = current.secondaryEmails || [];
          if (!current.secondaryEmails.includes(cleanEmail) && cleanEmail !== current.email) {
            current.secondaryEmails.push(cleanEmail);
          }
        }
        break;
      }
      case "TEL":
        current.phone = value.trim();
        break;
      case "ORG":
        current.company = value.trim();
        break;
      case "TITLE":
        current.jobTitle = value.trim();
        break;
      case "NOTE":
        current.notes = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "CATEGORIES": {
        const parsedTags = value
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        current.tags = [...(current.tags || []), ...parsedTags];
        break;
      }
    }
  }

  return contacts;
}

/**
 * Import contacts from vCard text into SQLite DB.
 */
export function importVcfContacts(vcfContent: string): {
  importedCount: number;
  contacts: ContactRecord[];
} {
  const parsed = parseVcfContent(vcfContent);
  const created: ContactRecord[] = [];

  for (const item of parsed) {
    if (!item.email) continue;
    const existing = getContactByEmail(item.email);
    if (existing) {
      const updated = updateContact(existing.id, {
        name: item.name || existing.name,
        phone: item.phone || existing.phone,
        company: item.company || existing.company,
        jobTitle: item.jobTitle || existing.jobTitle,
        notes: item.notes || existing.notes,
        tags: Array.from(new Set([...existing.tags, ...(item.tags || [])])),
      });
      if (updated) created.push(updated);
    } else {
      const newContact = createContact({
        name: item.name || item.email.split("@")[0],
        email: item.email,
        secondaryEmails: item.secondaryEmails || [],
        phone: item.phone,
        company: item.company,
        jobTitle: item.jobTitle,
        notes: item.notes,
        tags: item.tags || [],
        isStarred: false,
      });
      created.push(newContact);
    }
  }

  return {
    importedCount: created.length,
    contacts: created,
  };
}

export {
  createContact,
  deleteContact,
  getContactByEmail,
  getContactById,
  harvestContactsFromMessages,
  listContacts,
  toggleContactStarred,
  touchContactLastContacted,
  updateContact,
};
