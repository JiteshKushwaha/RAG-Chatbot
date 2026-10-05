import { config, getHfToken } from "./config";
import type { Index } from "./loadIndex";

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

function toVector(data: unknown, dim: number): number[] | null {
  if (!Array.isArray(data)) return null;
  if (typeof data[0] === "number") return data as number[];
  if (Array.isArray(data[0])) {
    const rows = data as unknown[];
    if (rows.length === 1) return toVector(rows[0], dim);
    const tok = rows as number[][]; // token-level output → mean pool
    if (typeof tok[0][0] !== "number") return null;
    const out = new Array<number>(dim).fill(0);
    for (const r of tok) r.forEach((x, i) => (out[i] += x / tok.length));
    return out;
  }
  return null;
}

export async function embedQuery(q: string, dim: number): Promise<number[] | null> {
  const token = getHfToken();
  if (!token) return null;
  try {
    const res = await fetch(config.hfUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: config.bgeQueryPrefix + q }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const v = toVector(await res.json(), dim);
    return v && v.length === dim ? normalize(v) : null;
  } catch {
    return null;
  }
}

export function denseSearch(index: Index, qv: number[], k: number): { index: number; score: number }[] {
  const { vectors, dim } = index;
  if (!vectors) return [];
  const out: { index: number; score: number }[] = [];
  const n = vectors.length / dim;
  for (let i = 0; i < n; i++) {
    let s = 0;
    const o = i * dim;
    for (let j = 0; j < dim; j++) s += vectors[o + j] * qv[j];
    out.push({ index: i, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}