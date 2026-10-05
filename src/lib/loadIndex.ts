import fs from "node:fs";
import path from "node:path";
import { BM25 } from "./bm25";
import type { Chunk, Manifest } from "./types";

export interface Index {
  chunks: Chunk[];
  byId: Map<number, number>;
  articleIndex: Record<string, number[]>;
  bm25: BM25;
  vectors: Float32Array | null;
  dim: number;
  manifest: Manifest | null;
}

let cached: Index | null = null; // module scope → reused by warm serverless invocations

function f16ToF32(h: number): number {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + f / 1024);
}

export function buildIndex(
  chunks: Chunk[],
  articleIndex: Record<string, number[]>,
  vectors: Float32Array | null = null,
  dim = 0,
  manifest: Manifest | null = null,
): Index {
  const byId = new Map<number, number>();
  chunks.forEach((c, i) => byId.set(c.id, i));
  const bm25 = new BM25().build(chunks.map((c) => `${c.search_text} ${c.mentions.join(" ")}`));
  return { chunks, byId, articleIndex, bm25, vectors, dim, manifest };
}

export function getIndex(): Index {
  if (cached) return cached;
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const chunksPath = path.join(dir, "chunks.jsonl");
  if (!fs.existsSync(chunksPath)) {
    throw new Error("Index not found: run `python ingestion/ingest.py` and commit /data.");
  }
  const chunks: Chunk[] = fs
    .readFileSync(chunksPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Chunk);
  const articleIndex = JSON.parse(
    fs.readFileSync(path.join(dir, "article_index.json"), "utf-8"),
  ) as Record<string, number[]>;
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest)
    : null;

  let vectors: Float32Array | null = null;
  const dim = manifest?.dim ?? 0;
  const embPath = path.join(dir, "embeddings.f16.bin");
  if (dim > 0 && fs.existsSync(embPath)) {
    const buf = fs.readFileSync(embPath);
    const u16 = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    if (u16.length === chunks.length * dim) {
      vectors = new Float32Array(u16.length);
      for (let i = 0; i < u16.length; i++) vectors[i] = f16ToF32(u16[i]);
    } else {
      console.warn("[index] embeddings size mismatch — falling back to BM25 mode");
    }
  }
  cached = buildIndex(chunks, articleIndex, vectors, dim, manifest);
  return cached;

}