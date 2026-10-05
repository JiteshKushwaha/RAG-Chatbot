"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Pref = "light" | "dark" | "system";
const ORDER: Pref[] = ["system", "light", "dark"];

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("system");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Pref | null) ?? "system";
    setPref(saved);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => (localStorage.getItem("theme") ?? "system") === "system" && apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cycle = useCallback(() => {
    setPref((p) => {
      const next = ORDER[(ORDER.indexOf(p) + 1) % ORDER.length];
      localStorage.setItem("theme", next);
      document.documentElement.classList.add("theme-fade");
      apply(next);
      setTimeout(() => document.documentElement.classList.remove("theme-fade"), 350);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        cycle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;
  return (
    <button onClick={cycle} className="icon-btn" aria-label={`Theme: ${pref}. Click to change`} title={`Theme: ${pref} (⌘/Ctrl+Shift+L)`}>
      <Icon size={17} />
      <span className="hidden sm:inline text-xs capitalize">{pref}</span>
    </button>
  );
}