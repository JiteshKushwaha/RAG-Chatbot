// Hand-sketched 24-spoke mark: slightly jittered spokes give an Excalidraw "roughness".
export function Chakra({ size = 28, spinning = false }: { size?: number; spinning?: boolean }) {
    const spokes = Array.from({ length: 24 }, (_, i) => {
      const a = (i * Math.PI * 2) / 24;
      const j = ((i * 37) % 7) / 10 - 0.3;
      return { x1: 50 + Math.cos(a) * 9, y1: 50 + Math.sin(a) * 9, x2: 50 + Math.cos(a + 0.01 * j) * (38 + j), y2: 50 + Math.sin(a + 0.01 * j) * (38 + j) };
    });
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className={spinning ? "chakra-spin" : ""}>
        <path d="M50 8.5 C74 7 92 26 91.5 50 C92 75 73 92.5 49 91.5 C25 92 7.5 74 8.5 50 C8 27 26 9 50 8.5Z" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
        <path d="M51 9.5 C75 9 90.5 27 90 51" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity=".5" />
        <circle cx="50" cy="50" r="7" fill="none" stroke="var(--accent)" strokeWidth="3.5" />
        {spokes.map((s, i) => (
          <line key={i} {...s} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity={0.85} />
        ))}
      </svg>
    );
  }
  
  export function Squiggle({ className = "" }: { className?: string }) {
    return (
      <svg className={className} viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
        <path d="M2 8 C 30 2, 50 11, 80 6 S 140 3, 198 7" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
}  