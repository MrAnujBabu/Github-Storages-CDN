import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

// Browser-only module: loaded lazily behind <ClientOnly>, so touching the worker here is safe.
// Legacy build on purpose (matches the vite alias): works on older Android WebViews too.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

const PDF_OPTIONS = {
  cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
  standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2, 2.5];
const WINDOW = 3; // pages rendered above/below the visible one

interface Props {
  url: string;
  title: string;
  fallbackHref: string;
  className?: string;
  /** Deep link target (`?page=N`): the viewer opens scrolled to this page. */
  initialPage?: number | undefined;
  /** Fires whenever the page nearest the top changes (and once with the page count). */
  onPageChange?: ((page: number, numPages: number) => void) | undefined;
}

/** Continuous-scroll PDF viewer: fit-to-width, windowed rendering, zoom, page nav. */
export default function PdfViewer({ url, title, fallbackHref, className, initialPage, onPageChange }: Props) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(2);
  const [current, setCurrent] = useState(() => (initialPage && initialPage > 1 ? initialPage : 1));
  const [ratio, setRatio] = useState(1.414); // height / width of page 1, A4 default
  const [error, setError] = useState<string | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const jumpedRef = useRef(false);

  useEffect(() => {
    if (numPages > 0) onPageChange?.(current, numPages);
  }, [current, numPages, onPageChange]);

  const zoom = ZOOM_STEPS[zoomIdx] ?? 1;
  const gutter = isMobile ? 8 : 24;
  // Fit-to-width on phones; on wide screens cap the "100%" page at a readable 900px.
  const pageWidth = Math.max(160, Math.floor(Math.min(containerWidth - gutter * 2, isMobile ? Infinity : 900) * zoom));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Track the page with the most visible area (earliest page wins ties), so
  // short landscape pages — where 3 fit on one screen — still count from the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !numPages) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vTop = el.scrollTop;
        const vBot = vTop + el.clientHeight;
        let best = 1;
        let bestVis = -1;
        for (const [n, node] of pageRefs.current) {
          const t = node.offsetTop;
          const vis = Math.min(t + node.offsetHeight, vBot) - Math.max(t, vTop);
          if (vis > bestVis || (vis === bestVis && n < best)) {
            bestVis = vis;
            best = n;
          }
        }
        setCurrent(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [numPages]);

  const goTo = useCallback((n: number, behavior: ScrollBehavior = "smooth") => {
    const node = pageRefs.current.get(n);
    const el = scrollRef.current;
    if (!node || !el) return;
    el.scrollTo({ top: node.offsetTop - 8, behavior });
  }, []);

  // Deep link: jump once the target page's wrapper exists. react-pdf mounts the
  // page list a render after onLoadSuccess, so poll briefly instead of firing once.
  useEffect(() => {
    if (jumpedRef.current || !numPages || !initialPage || initialPage <= 1) return;
    const target = Math.min(numPages, initialPage);
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      const node = pageRefs.current.get(target);
      const el = scrollRef.current;
      if (node && el && node.offsetTop > 0) {
        el.scrollTo({ top: node.offsetTop - 8 });
        jumpedRef.current = true;
        setCurrent(target);
        return;
      }
      if (++tries < 60) timer = window.setTimeout(attempt, 50);
    };
    attempt();
    return () => window.clearTimeout(timer);
  }, [numPages, initialPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(Math.min(numPages, current + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(Math.max(1, current - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, numPages, goTo]);

  const placeholderHeight = Math.round(pageWidth * ratio);
  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  const setZoom = (idx: number) => {
    haptic("selection");
    setZoomIdx(Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx)));
  };

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col bg-muted/60", className)}>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain" style={{ paddingLeft: gutter, paddingRight: gutter }}>
        {error ? (
          <div className="mx-auto my-16 max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
            <p className="text-base font-medium text-foreground">PDF yahan load nahi ho paayi</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <a
              href={fallbackHref}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              CDN par kholo
            </a>
          </div>
        ) : containerWidth > 0 ? (
          <Document
            file={url}
            options={PDF_OPTIONS}
            externalLinkTarget="_blank"
            onLoadSuccess={(doc) => {
              setNumPages(doc.numPages);
              setError(null);
            }}
            onLoadError={(e) => setError(e.message || "File corrupt ho sakti hai ya network slow hai.")}
            onSourceError={(e) => setError(e.message || "File tak pahunch nahi paaye.")}
            loading={<PageSkeleton width={pageWidth} height={placeholderHeight} count={2} />}
            error={null}
            className="mx-auto flex flex-col items-center gap-3 py-3"
          >
            {pages.map((n) => {
              const near = Math.abs(n - current) <= WINDOW;
              return (
                <div
                  key={n}
                  ref={(node) => {
                    if (node) pageRefs.current.set(n, node);
                    else pageRefs.current.delete(n);
                  }}
                  data-page={n}
                  className="rounded-md bg-card shadow-card"
                  style={{ width: pageWidth, minHeight: near ? undefined : placeholderHeight }}
                >
                  {near ? (
                    <Page
                      pageNumber={n}
                      width={pageWidth}
                      renderTextLayer={!isMobile}
                      renderAnnotationLayer
                      loading={<PageSkeleton width={pageWidth} height={placeholderHeight} count={1} bare />}
                      onLoadSuccess={(page) => {
                        if (n === 1) setRatio(page.originalHeight / page.originalWidth);
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </Document>
        ) : null}
      </div>

      {numPages > 0 && !error ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center safe-bottom">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-background/95 p-1 shadow-float backdrop-blur">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Pichla page" disabled={current <= 1} onClick={() => goTo(current - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[4.5rem] px-1 text-center text-[13px] font-medium tabular-nums text-foreground">
              {current} / {numPages}
            </span>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Agla page" disabled={current >= numPages} onClick={() => goTo(current + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Zoom out" disabled={zoomIdx === 0} onClick={() => setZoom(zoomIdx - 1)}>
              <Minus className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="min-w-[3.25rem] rounded-full px-1 text-[12.5px] font-medium tabular-nums text-foreground hover:bg-muted"
              onClick={() => setZoom(2)}
              aria-label="Fit width"
              title="Fit width"
            >
              {zoomIdx === 2 ? <Maximize2 className="mx-auto h-4 w-4" /> : `${Math.round(zoom * 100)}%`}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Zoom in"
              disabled={zoomIdx === ZOOM_STEPS.length - 1}
              onClick={() => setZoom(zoomIdx + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PageSkeleton({ width, height, count, bare }: { width: number; height: number; count: number; bare?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", !bare && "py-3")}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-md bg-card shadow-card" style={{ width, height: Math.min(height, 1400) }}>
          <div className="space-y-3 p-8">
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-11/12 rounded bg-muted" />
            <div className="h-3 w-4/5 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
