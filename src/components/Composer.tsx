"use client";
import { ArrowUp, Square } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface ComposerHandle { focus: () => void; set: (v: string) => void }

export const Composer = forwardRef<ComposerHandle, {
  busy: boolean; onSend: (q: string) => void; onStop: () => void; max: number;
}>(function Composer({ busy, onSend, onStop, max }, ref) {
  const [v, setV] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus(), set: (x) => { setV(x); ta.current?.focus(); } }));

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [v]);

  const submit = () => {
    const q = v.trim();
    if (!q || busy || q.length > max) return;
    onSend(q);
    setV("");
  };

  return (
    <div className="glass rounded-xl3 p-2 pl-4 flex items-end gap-2 composer-glow">
      <label htmlFor="q" className="sr-only">Ask a question about the Constitution of India</label>
      <textarea id="q" ref={ta} rows={1} value={v} maxLength={max + 50}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Ask about an Article, a Part, a right…"
        className="flex-1 resize-none bg-transparent outline-none py-2.5 text-[16px] placeholder:text-muted" />
      <span className={`font-mono text-[11px] pb-3 ${v.length > max ? "text-bad" : "text-muted"}`} aria-live="polite">{v.length}/{max}</span>
      {busy ? (
        <button onClick={onStop} className="send-btn" aria-label="Stop generating"><Square size={15} /></button>
      ) : (
        <button onClick={submit} disabled={!v.trim() || v.length > max} className="send-btn" aria-label="Send"><ArrowUp size={18} /></button>
      )}
    </div>
  );
});