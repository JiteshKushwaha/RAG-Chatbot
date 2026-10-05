"use client";
import { X } from "lucide-react";

const PARTS: [string, string][] = [
  ["I", "The Union and its Territory"], ["II", "Citizenship"], ["III", "Fundamental Rights"],
  ["IV", "Directive Principles of State Policy"], ["IVA", "Fundamental Duties"], ["V", "The Union"],
  ["VI", "The States"], ["VIII", "The Union Territories"], ["IX", "The Panchayats"],
  ["IXA", "The Municipalities"], ["IXB", "The Co-operative Societies"], ["X", "Scheduled and Tribal Areas"],
  ["XI", "Relations between the Union and the States"], ["XII", "Finance, Property, Contracts and Suits"],
  ["XIII", "Trade, Commerce and Intercourse"], ["XIV", "Services under the Union and the States"],
  ["XIVA", "Tribunals"], ["XV", "Elections"], ["XVI", "Special provisions relating to certain classes"],
  ["XVII", "Official Language"], ["XVIII", "Emergency Provisions"], ["XIX", "Miscellaneous"],
  ["XX", "Amendment of the Constitution"], ["XXI", "Temporary, Transitional and Special Provisions"],
  ["XXII", "Short title, commencement and repeals"],
];
const SCHEDULES = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];

export function ArticleBrowser({ open, onClose, onPick, recent }: {
  open: boolean; onClose: () => void; onPick: (q: string) => void; recent: string[];
}) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} aria-hidden />}
      <aside aria-label="Article browser"
        className={`fixed lg:sticky top-0 left-0 z-40 h-dvh w-72 shrink-0 border-r border-line bg-surface/90 backdrop-blur-xl overflow-y-auto transition-transform duration-300 ease-spring ${open ? "translate-x-0" : "-translate-x-full lg:hidden"}`}>
        <div className="flex items-center justify-between p-4">
          <span className="font-hand text-accent text-lg">browse ✎</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close sidebar"><X size={16} /></button>
        </div>
        {recent.length > 0 && (
          <nav className="px-3 pb-3" aria-label="Recent questions">
            <h3 className="side-h">Recent</h3>
            {recent.slice(0, 8).map((q) => <button key={q} className="side-item" onClick={() => onPick(q)}>{q}</button>)}
          </nav>
        )}
        <nav className="px-3 pb-3" aria-label="Parts">
          <h3 className="side-h">Parts</h3>
          {PARTS.map(([n, t]) => (
            <button key={n} className="side-item" onClick={() => onPick(`What does Part ${n} (${t}) of the Constitution cover?`)}>
              <span className="font-mono text-accent text-xs w-10 inline-block">{n}</span>{t}
            </button>
          ))}
        </nav>
        <nav className="px-3 pb-8" aria-label="Schedules">
          <h3 className="side-h">Schedules</h3>
          {SCHEDULES.map((s) => <button key={s} className="side-item" onClick={() => onPick(`What is in the ${s} Schedule?`)}>{s} Schedule</button>)}
        </nav>
      </aside>
    </>
  );

}