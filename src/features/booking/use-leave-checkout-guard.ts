"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type PendingLeave = { kind: "link"; href: string } | { kind: "back" } | null;

const releaseUrl = (holdId: string) => `/api/holds/${holdId}`;

/**
 * ViewModel for leaving checkout while seats are held. Instead of trapping the visitor,
 * any way out asks first and, if they go, cancels the hold so the seats go straight
 * back on sale:
 *
 *  - In-app links (All movies, Movies, the logo…): intercepted, confirmed, then followed.
 *  - Browser Back: a history entry is added while in checkout, so Back lands on this
 *    page first; we ask, and on "Leave" go back for real.
 *  - Closing the tab or reloading: the browser's own "Leave site?" prompt, and the hold
 *    is released as the page unloads.
 */
export function useLeaveCheckoutGuard(holdId: string | null) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingLeave>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const armed = Boolean(holdId);
  const holdRef = useRef(holdId);
  useEffect(() => {
    holdRef.current = holdId;
  });

  // Browser Back: keep one guard entry on top of this page while in checkout.
  const guardPushed = useRef(false);
  useEffect(() => {
    if (!armed) return;
    if (!guardPushed.current) {
      // Copy the router's state so Next.js treats the entry as its own.
      window.history.pushState(window.history.state, "", window.location.href);
      guardPushed.current = true;
    }
    const onPopState = () => {
      guardPushed.current = false; // Back consumed the guard entry
      setPending({ kind: "back" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [armed]);

  // In-app links: intercept before Next.js handles the click.
  useEffect(() => {
    if (!armed) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ kind: "link", href: url.pathname + url.search + url.hash });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [armed]);

  // Closing or reloading the tab: native prompt, then release the hold as the page goes.
  useEffect(() => {
    if (!armed) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onPageHide = () => {
      const id = holdRef.current;
      if (id) void fetch(releaseUrl(id), { method: "DELETE", keepalive: true });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [armed]);

  const stay = useCallback(() => {
    if (pending?.kind === "back" && !guardPushed.current) {
      // Put the guard back so the next Back press asks again.
      window.history.pushState(window.history.state, "", window.location.href);
      guardPushed.current = true;
    }
    setPending(null);
  }, [pending]);

  const leave = useCallback(async () => {
    if (!pending) return;
    setIsLeaving(true);
    const id = holdRef.current;
    if (id) await fetch(releaseUrl(id), { method: "DELETE", keepalive: true }).catch(() => undefined);
    const target = pending;
    setPending(null);
    if (target.kind === "link") router.push(target.href);
    else window.history.back(); // past this page, to wherever they came from
  }, [pending, router]);

  return { isAsking: pending !== null, isLeaving, stay, leave };
}
