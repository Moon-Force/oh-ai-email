import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TypewriterText } from "./TypewriterText";

describe("TypewriterText", () => {
  it("renders text and calls onDone callback", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();

    render(
      <TypewriterText
        text="Hello AI Email World"
        speedMs={10}
        onDone={onDone}
        data-testid="typewriter"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("typewriter")).toHaveTextContent("Hello AI Email World");
    expect(onDone).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
