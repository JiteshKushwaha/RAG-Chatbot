"use client";
import { Copy, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Source } from "@/lib/types";

function highlight(text: string, terms: string[]): ReactNode[] {
  const t = terms.filter((x) => x.length > 3).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!t.length) return [text];
  const re = new RegExp(`(${t.join("|")})`, "gi");
  return text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

export function SourceSheet({ source, query, onClose }: { source: Source | null; query: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!source) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]");
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [source, onClose]);

  if (!source) return null;
  const citation = `${source.book}, PDF p. ${source.pdfPage}${source.article ? `, Article ${source.article}` : ""}`;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 fade-in" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Source ${source.n}`}
        style={{ transform: drag ? `translateY(${drag}px)` : undefined }}
        className="sheet glass z-50 outline-none"
        onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
        onTouchMove={(e) => startY.current !== null && setDrag(Math.max(0, e.touches[0].clientY - startY.current))}
        onTouchEnd={() => { if (drag > 120) onClose(); setDrag(0); startY.current = null; }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-hand text-accent text-lg">source [{source.n}] ✎</p>
            <h2 className="font-semibold text-lg leading-snug">{source.book}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close source"><X size={16} /></button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 font-mono text-[11px]">
          <span className="chip">PDF p. {source.pdfPage}</span>
          {source.printedPage && <span className="chip">printed p. {source.printedPage}</span>}
          {source.part && <span className="chip">{source.part}</span>}
          {source.article && <span className="chip">Article {source.article}{source.articleTitle ? ` — ${source.articleTitle}` : ""}</span>}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted mb-1"><span>retrieval score</span><span>{Math.round(source.score * 100)}%</span></div>
          <div className="h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: `${Math.max(4, source.score * 100)}%` }} /></div>
        </div>
        <blockquote className="statute mt-5 max-h-[50vh] overflow-y-auto whitespace-pre-wrap">{highlight(source.snippet, query.split(/\s+/))}</blockquote>
        <button className="btn-ghost mt-4" onClick={() => navigator.clipboard.writeText(citation)}><Copy size={14} /> Copy citation</button>
      </div>
    </>
  );
}