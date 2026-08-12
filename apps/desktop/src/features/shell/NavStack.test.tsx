import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import NavStack from "./NavStack";

function Demo() {
  const [key, setKey] = useState("a");
  return (
    <NavStack activeKey={key} aria-label="demo">
      <button
        type="button"
        data-nav-active={key === "a" ? "true" : "false"}
        onClick={() => setKey("a")}
      >
        A
      </button>
      <button
        type="button"
        data-nav-active={key === "b" ? "true" : "false"}
        onClick={() => setKey("b")}
      >
        B
      </button>
    </NavStack>
  );
}

test("renders liquid indicator and updates active key", async () => {
  const user = userEvent.setup();
  render(<Demo />);
  expect(screen.getByLabelText("demo")).toBeInTheDocument();
  expect(document.querySelector(".nav-liquid")).toBeTruthy();
  await user.click(screen.getByText("B"));
  expect(screen.getByText("B")).toHaveAttribute("data-nav-active", "true");
});
