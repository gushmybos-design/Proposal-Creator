"use client";

import { useCallback, useEffect, useRef } from "react";

type Ev = { blockId: string; type: "VIEW" | "CLICK" | "ACCEPT_STARTED"; seconds?: number; meta?: Record<string, unknown> };

/**
 * Engagement tracker for the public proposal page.
 * - Observes every [data-block-id] element; accumulates dwell seconds while ≥50% visible.
 * - Pauses when the tab is hidden (so "idle time" isn't counted as reading).
 * - Flushes batched events every 10s and on page hide via sendBeacon.
 */
export function useTracker(token: string, enabled: boolean) {
  const sessionId = useRef<string | undefined>(undefined);
  const queue = useRef<Ev[]>([]);
  const visible = useRef<Map<string, number>>(new Map()); // blockId -> visible since (ms)
  const activeSince = useRef<number | null>(null);
  const visitorId = useRef<string>("");
  const creating = useRef(false); // a session-creating request is in flight

  const flush = useCallback(
    (final = false) => {
      if (!enabled) return;
      const now = Date.now();
      // close out currently-visible blocks into VIEW events
      for (const [blockId, since] of visible.current) {
        const secs = Math.round((now - since) / 1000);
        if (secs > 0) queue.current.push({ blockId, type: "VIEW", seconds: secs });
        visible.current.set(blockId, now);
      }
      const seconds = activeSince.current ? Math.round((now - activeSince.current) / 1000) : 0;
      if (activeSince.current) activeSince.current = now;
      if (queue.current.length === 0 && seconds === 0 && sessionId.current) return;
      // Avoid creating duplicate sessions while the first beacon hasn't returned yet.
      if (!sessionId.current && creating.current && !final) return;
      if (!sessionId.current) creating.current = true;

      const body = JSON.stringify({ token, visitorId: visitorId.current, sessionId: sessionId.current, events: queue.current.splice(0), seconds });
      if (final && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
        .then((r) => r.json())
        .then((j) => {
          if (j?.sessionId) sessionId.current = j.sessionId;
        })
        .catch(() => {})
        .finally(() => {
          creating.current = false;
        });
    },
    [token, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    try {
      const k = "propel_vid";
      visitorId.current = localStorage.getItem(k) ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, visitorId.current);
    } catch {
      visitorId.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    activeSince.current = Date.now();
    flush(); // opens the session immediately -> first-view notification

    const io = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.blockId!;
          if (e.isIntersecting) visible.current.set(id, now);
          else {
            const since = visible.current.get(id);
            if (since) {
              const secs = Math.round((now - since) / 1000);
              if (secs > 0) queue.current.push({ blockId: id, type: "VIEW", seconds: secs });
              visible.current.delete(id);
            }
          }
        }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => io.observe(el));

    const onVis = () => {
      if (document.hidden) {
        flush(true);
        activeSince.current = null;
        visible.current.clear();
      } else {
        activeSince.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    const iv = setInterval(() => flush(), 10_000);
    return () => {
      io.disconnect();
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, [enabled, flush]);

  const track = useCallback(
    (ev: Ev) => {
      if (!enabled) return;
      queue.current.push(ev);
      if (ev.type === "ACCEPT_STARTED") flush();
    },
    [enabled, flush],
  );

  return { track, getSessionId: () => sessionId.current };
}
