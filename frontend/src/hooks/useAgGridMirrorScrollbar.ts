import { useEffect, useRef, type DependencyList } from "react";

const MIRROR_CLASS = "ag-grid-h-scroll-mirror";

/** Scoped styles: custom bottom mirror track; native horizontal scrollbar hidden (RiskScore pattern). */
export const AG_GRID_MIRROR_SCROLL_CSS = `
  .ag-grid-mirror-h-scroll-wrap .ag-root-wrapper-body {
    position: relative;
    padding-bottom: 12px;
    box-sizing: border-box;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-body-viewport.ag-layout-normal {
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-center-cols-viewport {
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-body-viewport,
  .ag-grid-mirror-h-scroll-wrap .ag-center-cols-viewport,
  .ag-grid-mirror-h-scroll-wrap .ag-body-vertical-scroll-viewport {
    -ms-overflow-style: auto !important;
    scrollbar-width: thin !important;
    scrollbar-color: #94a3b8 #e2e8f0 !important;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-body-viewport::-webkit-scrollbar,
  .ag-grid-mirror-h-scroll-wrap .ag-body-vertical-scroll-viewport::-webkit-scrollbar {
    display: block !important;
    width: 10px;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-body-viewport::-webkit-scrollbar-thumb,
  .ag-grid-mirror-h-scroll-wrap .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 5px;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-body-viewport::-webkit-scrollbar-track,
  .ag-grid-mirror-h-scroll-wrap .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-center-cols-viewport {
    scrollbar-width: none !important;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-center-cols-viewport::-webkit-scrollbar {
    display: none !important;
    height: 0 !important;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-body-horizontal-scroll {
    display: none !important;
    min-height: 0 !important;
    height: 0 !important;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-paging-panel {
    position: relative;
    z-index: 20;
    background: #fff;
  }
  .ag-grid-mirror-h-scroll-wrap .ag-popup {
    z-index: 40 !important;
  }
`;

export type UseAgGridMirrorScrollbarOptions = {
  /** Attach mirror track to the outer wrap (e.g. cluster master fixed-height layout). */
  attachToOuterWrap?: boolean;
};

/**
 * Custom bottom horizontal scrollbar mirroring `.ag-center-cols-viewport` (same as RiskScoreDash).
 */
export function useAgGridMirrorScrollbar(
  deps: DependencyList = [],
  options?: UseAgGridMirrorScrollbarOptions,
) {
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const mirrorScrollbarRetryRef = useRef<(() => void) | null>(null);
  const attachToOuterWrap = options?.attachToOuterWrap ?? false;

  useEffect(() => {
    const setupMirrorScrollbar = (wrapEl: HTMLDivElement | null) => {
      if (!wrapEl) return () => {};

      const viewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null;
      if (!viewport) return () => {};

      // Default: inside grid body so the track sits above .ag-paging-panel (not below it).
      const mirrorHost = attachToOuterWrap
        ? wrapEl
        : ((wrapEl.querySelector(".ag-root-wrapper-body") as HTMLElement | null) ?? wrapEl);
      mirrorHost.style.position = "relative";

      const existingMirror = wrapEl.querySelector(`.${MIRROR_CLASS}`);
      if (existingMirror) existingMirror.remove();

      const pagingPanel = wrapEl.querySelector(".ag-paging-panel") as HTMLElement | null;

      const mirror = document.createElement("div");
      mirror.className = MIRROR_CLASS;
      Object.assign(mirror.style, {
        position: "absolute",
        left: "8px",
        right: "8px",
        bottom: "4px",
        height: "7px",
        background: "#e2e8f0",
        borderRadius: "6px",
        zIndex: "25",
        cursor: "pointer",
        userSelect: "none",
        pointerEvents: "auto",
      });

      const thumb = document.createElement("div");
      Object.assign(thumb.style, {
        position: "absolute",
        top: "1px",
        bottom: "1px",
        left: "0px",
        minWidth: "40px",
        background: "#94a3b8",
        borderRadius: "5px",
      });

      mirror.appendChild(thumb);
      mirrorHost.appendChild(mirror);

      const positionMirror = () => {
        if (mirrorHost === wrapEl && pagingPanel) {
          mirror.style.bottom = `${pagingPanel.offsetHeight + 4}px`;
        } else {
          mirror.style.bottom = "4px";
        }
      };

      const sync = () => {
        positionMirror();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const trackWidth = mirror.clientWidth;
        const thumbWidth =
          maxScroll <= 0
            ? trackWidth
            : Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const left = maxScroll <= 0 ? 0 : (viewport.scrollLeft / maxScroll) * movable;
        thumb.style.width = `${thumbWidth}px`;
        thumb.style.left = `${left}px`;
      };

      const onViewportScroll = () => sync();
      viewport.addEventListener("scroll", onViewportScroll, { passive: true });

      const onTrackClick = (e: MouseEvent) => {
        if (e.target === thumb) return;
        const rect = mirror.getBoundingClientRect();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, (x - thumbWidth / 2) / movable));
        viewport.scrollLeft = ratio * maxScroll;
      };

      const onThumbMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = mirror.clientWidth;
        const thumbWidth = Math.max(40, (viewport.clientWidth / viewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const startX = e.clientX;
        const startScroll = viewport.scrollLeft;

        const onMove = (ev: MouseEvent) => {
          const dx = ev.clientX - startX;
          viewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
        };
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };

      mirror.addEventListener("click", onTrackClick);
      thumb.addEventListener("mousedown", onThumbMouseDown);

      const ro = new ResizeObserver(sync);
      ro.observe(viewport);
      ro.observe(mirror);
      if (pagingPanel) ro.observe(pagingPanel);
      window.addEventListener("resize", sync);
      requestAnimationFrame(sync);

      return () => {
        viewport.removeEventListener("scroll", onViewportScroll);
        mirror.removeEventListener("click", onTrackClick);
        thumb.removeEventListener("mousedown", onThumbMouseDown);
        ro.disconnect();
        window.removeEventListener("resize", sync);
        mirror.remove();
      };
    };

    let cleanup = () => {};
    let retries = 0;
    const maxRetries = 10;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const trySetup = () => {
      cleanup();
      cleanup = setupMirrorScrollbar(tableWrapRef.current);
      if (
        retries < maxRetries &&
        tableWrapRef.current &&
        !tableWrapRef.current.querySelector(`.${MIRROR_CLASS}`)
      ) {
        retries += 1;
        retryTimer = setTimeout(trySetup, 120);
      }
    };

    trySetup();
    mirrorScrollbarRetryRef.current = trySetup;

    return () => {
      mirrorScrollbarRetryRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attachToOuterWrap]);

  const retryMirrorScrollbar = () => {
    requestAnimationFrame(() => mirrorScrollbarRetryRef.current?.());
  };

  return { tableWrapRef, retryMirrorScrollbar };
}
