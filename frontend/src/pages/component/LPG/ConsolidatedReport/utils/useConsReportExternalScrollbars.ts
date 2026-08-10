import { useEffect, useRef, type DependencyList } from "react";

const H_MIRROR_CLASS = "cons-report-h-scroll-mirror";
const V_MIRROR_CLASS = "cons-report-v-scroll-mirror";

function getPinnedLeftWidth(wrapEl: HTMLElement): number {
  const pinnedHeader = wrapEl.querySelector(".ag-pinned-left-header") as HTMLElement | null;
  const pinnedCols = wrapEl.querySelector(".ag-pinned-left-cols-container") as HTMLElement | null;
  return Math.max(pinnedHeader?.offsetWidth ?? 0, pinnedCols?.offsetWidth ?? 0);
}

function getHeaderBlockHeight(wrapEl: HTMLElement): number {
  const header = wrapEl.querySelector(".ag-header") as HTMLElement | null;
  return header?.offsetHeight ?? 0;
}

export function useConsReportExternalScrollbars(deps: DependencyList = []) {
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const setup = (wrapEl: HTMLDivElement | null) => {
      if (!wrapEl) return () => {};

      const hViewport = wrapEl.querySelector(".ag-center-cols-viewport") as HTMLElement | null;
      const vViewport = wrapEl.querySelector(".ag-body-viewport") as HTMLElement | null;
      if (!hViewport || !vViewport) return () => {};

      wrapEl.style.position = "relative";

      wrapEl.querySelector(`.${H_MIRROR_CLASS}`)?.remove();
      wrapEl.querySelector(`.${V_MIRROR_CLASS}`)?.remove();

      const hMirror = document.createElement("div");
      hMirror.className = H_MIRROR_CLASS;

      const hThumb = document.createElement("div");
      hMirror.appendChild(hThumb);

      const vMirror = document.createElement("div");
      vMirror.className = V_MIRROR_CLASS;

      const vThumb = document.createElement("div");
      vMirror.appendChild(vThumb);

      wrapEl.appendChild(hMirror);
      wrapEl.appendChild(vMirror);

      const syncHorizontal = () => {
        const pinnedLeft = getPinnedLeftWidth(wrapEl);
        hMirror.style.left = `${pinnedLeft}px`;

        const maxScroll = Math.max(0, hViewport.scrollWidth - hViewport.clientWidth);
        const trackWidth = hMirror.clientWidth;
        const thumbWidth =
          maxScroll <= 0
            ? trackWidth
            : Math.max(40, (hViewport.clientWidth / hViewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const left = maxScroll <= 0 ? 0 : (hViewport.scrollLeft / maxScroll) * movable;
        hThumb.style.width = `${thumbWidth}px`;
        hThumb.style.left = `${left}px`;
      };

      const syncVertical = () => {
        const headerHeight = getHeaderBlockHeight(wrapEl);
        vMirror.style.top = `${headerHeight}px`;

        const maxScroll = Math.max(0, vViewport.scrollHeight - vViewport.clientHeight);
        const trackHeight = vMirror.clientHeight;
        const thumbHeight =
          maxScroll <= 0
            ? trackHeight
            : Math.max(40, (vViewport.clientHeight / vViewport.scrollHeight) * trackHeight);
        const movable = Math.max(1, trackHeight - thumbHeight);
        const top = maxScroll <= 0 ? 0 : (vViewport.scrollTop / maxScroll) * movable;
        vThumb.style.height = `${thumbHeight}px`;
        vThumb.style.top = `${top}px`;
      };

      const sync = () => {
        syncHorizontal();
        syncVertical();
      };

      const onHScroll = () => syncHorizontal();
      const onVScroll = () => syncVertical();

      hViewport.addEventListener("scroll", onHScroll, { passive: true });
      vViewport.addEventListener("scroll", onVScroll, { passive: true });

      const onHTrackClick = (e: MouseEvent) => {
        if (e.target === hThumb) return;
        const rect = hMirror.getBoundingClientRect();
        const maxScroll = Math.max(0, hViewport.scrollWidth - hViewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = hMirror.clientWidth;
        const thumbWidth = Math.max(40, (hViewport.clientWidth / hViewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, (x - thumbWidth / 2) / movable));
        hViewport.scrollLeft = ratio * maxScroll;
      };

      const onHThumbMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        const maxScroll = Math.max(0, hViewport.scrollWidth - hViewport.clientWidth);
        if (maxScroll <= 0) return;
        const trackWidth = hMirror.clientWidth;
        const thumbWidth = Math.max(40, (hViewport.clientWidth / hViewport.scrollWidth) * trackWidth);
        const movable = Math.max(1, trackWidth - thumbWidth);
        const startX = e.clientX;
        const startScroll = hViewport.scrollLeft;

        const onMove = (ev: MouseEvent) => {
          const dx = ev.clientX - startX;
          hViewport.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
        };
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };

      const onVTrackClick = (e: MouseEvent) => {
        if (e.target === vThumb) return;
        const rect = vMirror.getBoundingClientRect();
        const maxScroll = Math.max(0, vViewport.scrollHeight - vViewport.clientHeight);
        if (maxScroll <= 0) return;
        const trackHeight = vMirror.clientHeight;
        const thumbHeight = Math.max(40, (vViewport.clientHeight / vViewport.scrollHeight) * trackHeight);
        const movable = Math.max(1, trackHeight - thumbHeight);
        const y = e.clientY - rect.top;
        const ratio = Math.max(0, Math.min(1, (y - thumbHeight / 2) / movable));
        vViewport.scrollTop = ratio * maxScroll;
      };

      const onVThumbMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        const maxScroll = Math.max(0, vViewport.scrollHeight - vViewport.clientHeight);
        if (maxScroll <= 0) return;
        const trackHeight = vMirror.clientHeight;
        const thumbHeight = Math.max(40, (vViewport.clientHeight / vViewport.scrollHeight) * trackHeight);
        const movable = Math.max(1, trackHeight - thumbHeight);
        const startY = e.clientY;
        const startScroll = vViewport.scrollTop;

        const onMove = (ev: MouseEvent) => {
          const dy = ev.clientY - startY;
          vViewport.scrollTop = Math.min(maxScroll, Math.max(0, startScroll + (dy / movable) * maxScroll));
        };
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };

      hMirror.addEventListener("click", onHTrackClick);
      hThumb.addEventListener("mousedown", onHThumbMouseDown);
      vMirror.addEventListener("click", onVTrackClick);
      vThumb.addEventListener("mousedown", onVThumbMouseDown);

      const ro = new ResizeObserver(sync);
      ro.observe(wrapEl);
      ro.observe(hViewport);
      ro.observe(vViewport);
      window.addEventListener("resize", sync);
      requestAnimationFrame(sync);

      return () => {
        hViewport.removeEventListener("scroll", onHScroll);
        vViewport.removeEventListener("scroll", onVScroll);
        hMirror.removeEventListener("click", onHTrackClick);
        hThumb.removeEventListener("mousedown", onHThumbMouseDown);
        vMirror.removeEventListener("click", onVTrackClick);
        vThumb.removeEventListener("mousedown", onVThumbMouseDown);
        ro.disconnect();
        window.removeEventListener("resize", sync);
        hMirror.remove();
        vMirror.remove();
      };
    };

    let cleanup = () => {};
    let retries = 0;
    const maxRetries = 12;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const trySetup = () => {
      cleanup();
      cleanup = setup(tableWrapRef.current);
      if (
        retries < maxRetries &&
        tableWrapRef.current &&
        !tableWrapRef.current.querySelector(`.${H_MIRROR_CLASS}`)
      ) {
        retries += 1;
        retryTimer = setTimeout(trySetup, 120);
      }
    };

    trySetup();
    retryRef.current = trySetup;

    return () => {
      retryRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const retryScrollbars = () => {
    requestAnimationFrame(() => retryRef.current?.());
  };

  return { tableWrapRef, retryScrollbars };
}
