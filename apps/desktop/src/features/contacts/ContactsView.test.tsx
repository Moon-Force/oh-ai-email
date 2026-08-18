import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ContactsView from "./ContactsView";
import { useContactsStore } from "./contactsStore";
import AppThemeProvider from "../../theme/AppThemeProvider";

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

describe("ContactsView Component", () => {
  beforeEach(() => {
    useContactsStore.setState({
      contacts: [
        {
          id: "contact-1",
          name: "王小明",
          email: "xiaoming@company.com",
          secondaryEmails: [],
          phone: "13800002222",
          company: "Acme Corp",
          jobTitle: "产品总监",
          tags: ["重点客户"],
          isStarred: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      selectedContactId: "contact-1",
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
      loadContacts: async () => {},
    });
  });

  it("renders contacts toolbar and selected contact details", () => {
    render(wrap(<ContactsView />));

    expect(screen.getByText("联系人通讯录")).toBeInTheDocument();
    expect(screen.getByText("新建联系人")).toBeInTheDocument();
    expect(screen.getByText("发现新联系人")).toBeInTheDocument();
    expect(screen.getByText("全部联系人")).toBeInTheDocument();
    expect(screen.getAllByText("重点客户").length).toBeGreaterThan(0);
    expect(screen.getByText("xiaoming@company.com")).toBeInTheDocument();
    expect(screen.getByText("发送邮件")).toBeInTheDocument();
  });

  it("opens create contact dialog when clicking 新建联系人", () => {
    render(wrap(<ContactsView />));

    const addBtn = screen.getByText("新建联系人");
    fireEvent.click(addBtn);

    expect(useContactsStore.getState().contactDialogOpen).toBe(true);
    expect(screen.getAllByText("新建联系人").length).toBeGreaterThan(1);
  });

  it("opens harvester dialog when clicking 发现新联系人", async () => {
    render(wrap(<ContactsView />));

    const harvestBtn = screen.getByText("发现新联系人");
    await act(async () => {
      fireEvent.click(harvestBtn);
    });

    expect(useContactsStore.getState().harvesterOpen).toBe(true);
    expect(screen.getByText("邮件智能联系人发现")).toBeInTheDocument();
  });
});
