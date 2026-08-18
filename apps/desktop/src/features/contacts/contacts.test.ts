import { describe, expect, it, beforeEach } from "vitest";
import { useContactsStore } from "./contactsStore";
import type { ContactDto } from "./types";

describe("Contacts Store and vCard Utilities", () => {
  beforeEach(() => {
    useContactsStore.setState({
      contacts: [],
      selectedContactId: null,
      searchQuery: "",
      selectedTag: null,
      starredOnly: false,
      contactDialogOpen: false,
      contactDraft: null,
      contactDialogMode: "create",
      harvesterOpen: false,
      harvestedCandidates: [],
      vcfImportDialogOpen: false,
      loading: false,
    });
  });

  it("creates, updates and removes contacts", async () => {
    const store = useContactsStore.getState();

    // Create
    const created = await store.saveContact({
      name: "李华",
      email: "lihua@tech.com",
      phone: "13912345678",
      company: "Moon Force",
      jobTitle: "高级工程师",
      tags: ["同事", "重要联系人"],
      isStarred: true,
    });

    expect(created).toBeDefined();
    expect(created!.id).toBeTruthy();
    expect(created!.name).toBe("李华");
    expect(created!.isStarred).toBe(true);
    expect(useContactsStore.getState().contacts.some((c) => c.id === created!.id)).toBe(true);

    // Update
    useContactsStore.getState().openEditDialog(created!);
    await useContactsStore.getState().saveContact({
      jobTitle: "技术总监",
    });

    const updated = useContactsStore.getState().contacts.find((c) => c.id === created!.id);
    expect(updated?.jobTitle).toBe("技术总监");

    // Toggle star
    await useContactsStore.getState().toggleStar(created!.id);
    const toggled = useContactsStore.getState().contacts.find((c) => c.id === created!.id);
    expect(toggled?.isStarred).toBe(false);

    // Remove
    await useContactsStore.getState().removeContact(created!.id);
    expect(useContactsStore.getState().contacts.some((c) => c.id === created!.id)).toBe(false);
  });

  it("filters contacts by search query, starred, and tags", () => {
    const now = Date.now();
    const sampleContacts: ContactDto[] = [
      {
        id: "c1",
        name: "张三",
        email: "zhangsan@alpha.com",
        secondaryEmails: [],
        company: "Alpha Corp",
        jobTitle: "产品经理",
        tags: ["客户", "VIP"],
        isStarred: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "c2",
        name: "李四",
        email: "lisi@beta.com",
        secondaryEmails: [],
        company: "Beta Tech",
        jobTitle: "后端开发",
        tags: ["开发", "合作伙伴"],
        isStarred: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    useContactsStore.setState({ contacts: sampleContacts });

    // Search query filter
    useContactsStore.setState({ searchQuery: "Alpha" });
    let filtered = useContactsStore.getState().filteredContacts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("张三");

    // Tag filter
    useContactsStore.setState({ searchQuery: "", selectedTag: "开发" });
    filtered = useContactsStore.getState().filteredContacts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("李四");

    // Starred filter
    useContactsStore.setState({ selectedTag: null, starredOnly: true });
    filtered = useContactsStore.getState().filteredContacts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("张三");

    // All tags collection
    const allTags = useContactsStore.getState().allTags();
    expect(allTags).toContain("客户");
    expect(allTags).toContain("VIP");
    expect(allTags).toContain("开发");
  });

  it("imports valid vCard (vcf) text", async () => {
    const sampleVcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:王小明",
      "EMAIL;TYPE=INTERNET:wangxiaoming@example.com",
      "TEL;TYPE=CELL:18800001111",
      "ORG:Global Ventures",
      "TITLE:投资总监",
      "NOTE:在行业峰会结识",
      "END:VCARD",
    ].join("\r\n");

    const count = await useContactsStore.getState().importVcf(sampleVcf);
    expect(count).toBe(1);

    const imported = useContactsStore
      .getState()
      .contacts.find((c) => c.email === "wangxiaoming@example.com");
    expect(imported).toBeDefined();
    expect(imported?.name).toBe("王小明");
    expect(imported?.company).toBe("Global Ventures");
    expect(imported?.phone).toBe("18800001111");
  });
});
