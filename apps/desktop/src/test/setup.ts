import "@testing-library/jest-dom";

// jsdom lacks ResizeObserver (used by NavStack liquid indicator)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
