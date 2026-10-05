"use client";
import { useEffect, useRef, useState } from "react";
import { Chakra } from "./Chakra";

// Deliberately NOT persisted anywhere: it appears on every page load/refresh.
export function DisclaimerModal({ onClose }: { onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    btn.current?.focus();
    setReady(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        btn.current?.focus();
      }
      if (e.key === "Escape" && ready) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, ready]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4 fade-in">
      <div role="dialog" aria-modal="true" aria-labelledby="disc-title" aria-describedby="disc-body"
        className="glass max-w-md w-full rounded-xl3 p-7 pop-in">
        <div className="flex items-center gap-3 mb-4">
          <Chakra size={30} />
          <h2 id="disc-title" className="text-lg font-semibold tracking-tight">Student learning project — please read</h2>
        </div>
        <div id="disc-body" className="space-y-3 text-[15px] leading-relaxed text-muted">
          <p>This chatbot is <strong className="text-ink">not meant for commercial, professional, or legal use.</strong> It is a student&apos;s learning project to explore RAG and to reduce AI hallucinations.</p>
          <p><strong className="text-ink">No response should be considered 100% true.</strong> Hallucinations can happen; always verify against the official Constitution of India and consult a qualified lawyer for real legal matters.</p>
          <p>Answers are generated only from a limited set of uploaded documents and may be incomplete or wrong.</p>
        </div>
        <p className="font-hand text-accent mt-4 text-lg">honest &gt; confident ✎</p>
        <button ref={btn} onClick={onClose} className="btn-primary w-full mt-4">I understand</button>
      </div>
    </div>
  );
}