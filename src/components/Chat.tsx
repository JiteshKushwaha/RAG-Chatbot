"use client";

import { Info, PanelLeft, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseSse } from "@/lib/sse";
import type { ChatTurn, DoneEvent, MetaEvent, Source, Stage } from "@/lib/types";
import { AboutSheet } from "./AboutSheet";
import { ArticleBrowser } from "./ArticleBrowser";
import { Chakra } from "./Chakra";
import { Composer, type ComposerHandle } from "./Composer";
import { DisclaimerModal } from "./DisclaimerModal";
import { EmptyState } from "./EmptyState";
import { Message, type UiMessage } from "./Message";
import { SourceSheet } from "./SourceSheet";
import { ThemeToggle } from "./ThemeToggle";

const MAX = 500;
const uid = () => Math.random().toString(36).slice(2);

export function Chat({ disclaimer }: { disclaimer: string }) {
  const [showDisclaimer, setShowDisclaimer] = useState(true); // in-memory only
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(false);
  const [about, setAbout] = useState(false);
  const [sheet, setSheet] = useState<{ source: Source; query: string } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); composer.current?.focus(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  const patch = (id: string, f: (m: UiMessage) => UiMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? f(m) : m)));

  const send = useCallback(async (q: string) => {
    if (busy) return;
    setSide(false);
    setRecent((r) => [q, ...r.filter((x) => x !== q)].slice(0, 12));
    const history: ChatTurn[] = messages.filter((m) => !m.error && m.meta?.kind !== "canned")
      .map((m) => ({ role: m.role, content: m.done?.finalText ?? m.content })).slice(-6);
    const aid = uid();
    setMessages((ms) => [...ms, { id: uid(), role: "user", content: q }, { id: aid, role: "assistant", content: "", streaming: true, stage: "searching" }]);
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, messages: history }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = j.error ?? "Request failed.";
        if (res.status === 429) setToast(msg);
        patch(aid, (m) => ({ ...m, streaming: false, error: msg }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const { events, rest } = parseSse(buf + dec.decode(value, { stream: true }));
        buf = rest;
        for (const ev of events) {
          const d = JSON.parse(ev.data) as Record<string, unknown>;
          if (ev.event === "stage") patch(aid, (m) => ({ ...m, stage: d.stage as Stage, stageArticles: (d.articles as string[]) ?? m.stageArticles }));
          else if (ev.event === "meta") patch(aid, (m) => ({ ...m, meta: d as unknown as MetaEvent }));
          else if (ev.event === "token") patch(aid, (m) => ({ ...m, content: m.content + (d.t as string) }));
          else if (ev.event === "done") patch(aid, (m) => ({ ...m, done: d as unknown as DoneEvent, streaming: false }));
          else if (ev.event === "error") patch(aid, (m) => ({ ...m, streaming: false, error: d.error as string }));
        }
      }
      patch(aid, (m) => ({ ...m, streaming: false }));
    } catch (e) {
      if ((e as Error).name === "AbortError") patch(aid, (m) => ({ ...m, streaming: false, content: m.content || "_Stopped._" }));
      else { setToast("Network error — check your connection."); patch(aid, (m) => ({ ...m, streaming: false, error: "Network error." })); }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }, [busy, messages]);

  const openCite = (msg: UiMessage, n: number, idx: number) => {
    const s = msg.meta?.sources.find((x) => x.n === n);
    const q = messages[idx - 1]?.content ?? "";
    if (s) setSheet({ source: s, query: q });
  };

  return (
    <>
      <div className="flex min-h-dvh" inert={showDisclaimer || undefined}>
        <ArticleBrowser open={side} onClose={() => setSide(false)} onPick={(q) => { setSide(false); composer.current?.set(q); }} recent={recent} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 bg-bg/70 backdrop-blur-xl">
            <div className="flex items-center gap-2 px-4 h-14 max-w-5xl mx-auto w-full">
              <button className="icon-btn" onClick={() => setSide((s) => !s)} aria-label="Toggle article browser"><PanelLeft size={17} /></button>
              <Chakra size={26} spinning={busy} />
              <span className="font-semibold tracking-tight">Samvidhan<span className="text-accent">·</span>AI</span>
              <div className="flex-1" />
              <button className="icon-btn" onClick={() => { abort.current?.abort(); setMessages([]); }} aria-label="New chat"><Plus size={17} /><span className="hidden sm:inline text-xs">New</span></button>
              <ThemeToggle />
              <button className="icon-btn" onClick={() => setAbout(true)} aria-label="About and disclaimer"><Info size={17} /><span className="hidden sm:inline text-xs">About</span></button>
            </div>
            <div className="tricolor" aria-hidden />
          </header>

          <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-48">
            {messages.length === 0 ? <EmptyState onPick={send} /> : (
              <div className="space-y-7 pt-8">
                {messages.map((m, i) => <Message key={m.id} m={m} onCite={(n) => openCite(m, n, i)} />)}
                <div ref={bottom} />
              </div>
            )}
          </main>

          <div className="fixed bottom-0 inset-x-0 z-20 pointer-events-none lg:pl-0">
            <div className="max-w-3xl mx-auto px-4 pb-3 pointer-events-auto">
              <Composer ref={composer} busy={busy} max={MAX} onSend={send} onStop={() => abort.current?.abort()} />
              <p className="text-center text-[11px] text-muted mt-2">
                Student project · may be inaccurate · not legal advice ·{" "}
                <button className="underline underline-offset-2" onClick={() => setAbout(true)}>Disclaimer</button>
                <span className="hidden sm:inline"> · Enter to send, Shift+Enter for newline, ⌘/Ctrl+K to focus</span>
              </p>
            </div>
          </div>
        </div>

        {toast && <div role="status" className="fixed top-16 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-4 py-2 text-sm pop-in">{toast}</div>}
        <SourceSheet source={sheet?.source ?? null} query={sheet?.query ?? ""} onClose={() => setSheet(null)} />
        <AboutSheet open={about} onClose={() => setAbout(false)} disclaimer={disclaimer} />
      </div>
      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    </>
  );
}