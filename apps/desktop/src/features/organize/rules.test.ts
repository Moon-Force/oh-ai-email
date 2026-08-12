import { classify } from "./rules";

test("classify by domain and keyword", () => {
  const rules = [
    { domain: "company.com", split: "important" as const },
    { keyword: "invoice", split: "other" as const },
  ];
  expect(classify("a@company.com", "hi", rules)).toBe("important");
  expect(classify("x@y.com", "Invoice due", rules)).toBe("other");
  expect(classify("x@y.com", "hi", rules)).toBe("other");
});
