import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Kalam, Newsreader, Noto_Sans_Devanagari } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap", style: ["normal", "italic"] });
const hand = Kalam({ subsets: ["latin", "devanagari"], weight: ["400", "700"], variable: "--font-hand", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });

export const metadata: Metadata = {
  title: "Samvidhan·AI — Ask the Constitution",
  description: "A student RAG project answering questions about the Constitution of India from source documents, with citations.",
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0B0C10" }, { media: "(prefers-color-scheme: light)", color: "#F4F5F9" }],
};

// Runs before paint → zero theme flash.
const noFlash = `(function(){try{var p=localStorage.getItem('theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${serif.variable} ${hand.variable} ${deva.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: noFlash }} /></head>
      <body className="font-sans bg-bg text-ink antialiased dot-grid">{children}</body>
    </html>
  );
}