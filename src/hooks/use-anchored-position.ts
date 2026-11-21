"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

const GAP_PX = 12; // space between anchor and floating element (room for the arrow)
const EDGE_PX = 8; // keep this far from the viewport edges
const ARROW_INSET_PX = 20; // keep the arrow away from the rounded corners

export type AnchoredPosition = {
  top: number; // page coordinates (for position: absolute)
  left: number;
  placement: "top" | "bottom"; // which side of the anchor the element sits on
  arrowLeft: number; // arrow's x within the floating element
};

/**
 * Positions an absolutely positioned floating element (popover) next to an anchor:
 * above it if there's room in the viewport, otherwise below; centered on it but kept
 * inside the viewport horizontally.
 *
 * Coordinates are relative to the page, not the viewport, so the browser scrolls the
 * popover together with its anchor in the same frame: it stays attached with no
 * scroll listeners. It's only re-measured when the window or the popover resizes.
 */
export function useAnchoredPosition(
  floatingRef: RefObject<HTMLElement | null>,
  anchor: HTMLElement | null,
): AnchoredPosition | null {
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  useLayoutEffect(() => {
    const floating = floatingRef.current;
    if (!anchor || !floating) {
      setPosition(null);
      return;
    }

    const update = () => {
      const a = anchor.getBoundingClientRect();
      const f = floating.getBoundingClientRect();
      const fitsAbove = a.top - f.height - GAP_PX >= EDGE_PX;
      const placement = fitsAbove ? "top" : "bottom";
      const anchorCenter = a.left + a.width / 2;
      const viewportLeft = Math.min(Math.max(anchorCenter - f.width / 2, EDGE_PX), window.innerWidth - f.width - EDGE_PX);
      setPosition({
        top: (placement === "top" ? a.top - f.height - GAP_PX : a.bottom + GAP_PX) + window.scrollY,
        left: viewportLeft + window.scrollX,
        placement,
        arrowLeft: Math.min(Math.max(anchorCenter - viewportLeft, ARROW_INSET_PX), f.width - ARROW_INSET_PX),
      });
    };

    update();
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(floating);
    return () => {
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [anchor, floatingRef]);

  return position;
}
