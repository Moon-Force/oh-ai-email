import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  activeKey: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** Vertical nav with a sliding Liquid Glass indicator under the active item. */
export default function NavStack({ activeKey, children, className = "", ...rest }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState({ top: 0, height: 0, ready: false });

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>("[data-nav-active='true']");
    if (!active) {
      setPill((p) => ({ ...p, ready: false }));
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    setPill({
      top: box.top - rootBox.top + root.scrollTop,
      height: box.height,
      ready: true,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [activeKey, measure, children]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    window.addEventListener("resize", measure);
    // jsdom may lack ResizeObserver
    const RO = typeof ResizeObserver !== "undefined" ? ResizeObserver : null;
    const ro = RO ? new RO(() => measure()) : null;
    ro?.observe(root);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <nav
      ref={rootRef}
      className={`nav-stack ${className}`}
      data-has-liquid={pill.ready ? "true" : "false"}
      {...rest}
    >
      <div
        className="nav-liquid"
        aria-hidden
        style={{
          top: pill.top,
          height: pill.height,
          opacity: pill.ready ? 1 : 0,
        }}
      />
      {children}
    </nav>
  );
}
