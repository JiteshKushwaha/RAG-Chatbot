"use client";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export function AboutSheet({ open, onClose, disclaimer }: { open: boolean; onClose: () => void; disclaimer: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<string>("…");
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    fetch("/api/health").then((r) => r.json()).then((j: { mode?: string }) => setMode(j.mode === "hybrid" ? "hybrid mode" : "keyword mode")).catch(() => setMode("unknown"));
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 fade-in" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="About and disclaimer" className="sheet glass z-50 outline-none">
        <div className="flex justify-between items-center">
          <p className="font-hand text-accent text-xl">about ✎</p>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="prose-answer mt-2 text-sm"><ReactMarkdown skipHtml>{disclaimer}</ReactMarkdown></div>
        <p className="font-mono text-[11px] text-muted mt-4">retrieval: {mode} · no accounts · questions are not stored</p>
      </div>
    </>
  );

}