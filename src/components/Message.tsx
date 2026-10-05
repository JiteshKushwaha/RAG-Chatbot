"use client";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DoneEvent, MetaEvent, Stage } from "@/lib/types";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: MetaEvent;
  done?: DoneEvent;
  stage?: Stage;
  stageArticles?: string[];
  error?: string;
  streaming?: boolean;
}

const STAGE_TEXT: Record<Stage, string> = { searching: "Searching the Constitution…", reading: "Reading", composing: "Composing answer…" };
const CONF: Record<string, string> = { high: "High evidence", medium: "Medium evidence", low: "Low evidence" };

function withCitationLinks(md: string): string {
  return md.replace(/\[(\d{1,2})\](?!\()/g, "[$1](#cite-$1)");
}

export function Message({ m, onCite }: { m: UiMessage; onCite: (n: number) => void }) {
  const [copied, setCopied] = useState(false);
  if (m.role === "user") {
    return <div className="flex justify-end msg-in"><p className="user-pill">{m.content}</p></div>;
  }
  const meta = m.meta;
  const isRefusal = meta?.kind === "refusal";
  const pinned = meta?.sources[0];
  const text = m.done?.finalText ?? m.content;

  const copy = async () => {
    await navigator.clipboard.writeText(text.replace(/\[(\d+)\]/g, "[$1]"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (m.error) return <div className="msg-in rounded-xl2 border border-bad/40 bg-bad/10 p-4 text-sm" role="alert">{m.error}</div>;

  if (!meta && m.streaming) {
    const s = m.stage ?? "searching";
    return (
      <div className="msg-in space-y-2" aria-live="polite">
        <p className="text-sm text-muted">{s === "reading" ? `Reading Article ${m.stageArticles?.join(", ")}…` : STAGE_TEXT[s]}</p>
        <div className="shimmer h-4 w-3/4 rounded" /><div className="shimmer h-4 w-1/2 rounded" />
      </div>
    );
  }

  if (isRefusal) {
    return (
      <div className="msg-in sketch-card !cursor-default">
        <p className="font-medium">Not found in the documents</p>
        <p className="text-muted text-sm mt-1">{text}</p>
        <p className="font-hand text-accent mt-2 text-lg">honest &gt; confident ✎</p>
        {meta && meta.sources.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Nearest passages (not necessarily an answer)</summary>
            <div className="flex flex-wrap gap-2 mt-2">{meta.sources.map((s) => <button key={s.n} onClick={() => onCite(s.n)} className="cite-chip">[{s.n}] {s.book} · p.{s.pdfPage}</button>)}</div>
          </details>
        )}
      </div>
    );
  }

  return (
    <article className="msg-in" aria-live={m.streaming ? "polite" : "off"}>
      <div className={`prose-answer ${m.streaming ? "streaming" : ""}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
          components={{
            a: ({ href, children }) => {
              const c = href?.match(/^#cite-(\d+)$/);
              if (c) return <button className="cite-chip" onClick={() => onCite(Number(c[1]))} aria-label={`Open source ${c[1]}`}>{c[1]}</button>;
              return <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>;
            },
            blockquote: ({ children }: { children?: ReactNode }) => (
              <blockquote className="statute">
                {pinned?.article && <span className="statute-chip">Article {pinned.article}{pinned.part ? ` · ${pinned.part.split(" — ")[0]}` : ""}</span>}
                {children}
              </blockquote>
            ),
          }}>
          {withCitationLinks(text)}
        </ReactMarkdown>
      </div>
      {meta && meta.kind === "answer" && !m.streaming && (
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className={`conf-dot conf-${meta.confidence}`} />{CONF[meta.confidence]}</span>
          {m.done?.grounding && !m.done.grounding.verified && (
            <span className="badge-warn" title="Some quotes or Article numbers in this answer were not found verbatim in the retrieved passages. Check the sources.">
              <AlertTriangle size={12} /> not fully verified
            </span>
          )}
          {m.done && <span>answered in {(m.done.latencyMs / 1000).toFixed(1)} s</span>}
          <span className="flex gap-1">{meta.sources.map((s) => <button key={s.n} onClick={() => onCite(s.n)} className="cite-chip" title={`${s.book}, PDF p. ${s.pdfPage}`}>{s.n}</button>)}</span>
          <button onClick={copy} className="icon-btn !p-1" aria-label="Copy answer">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
        </div>
      )}
    </article>
  );
}