"""Phase A: PDFs → cleaned, article-aware chunks → /data artifacts.

Usage:
  python ingest.py --inspect     # print first page text of each PDF to classify books
  python ingest.py               # build ../data
  python ingest.py --no-embed    # skip dense vectors (BM25-only mode)
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import fitz  # PyMuPDF
from tqdm import tqdm

from article_parser import segment_book, split_segment, mentions
from clean import clean_page, find_repeating_lines, useful_chars, is_mostly_devanagari, HEADER_RE

HERE = Path(__file__).parent
MODEL = "BAAI/bge-base-en-v1.5"
MIN_USEFUL = 120


def load_config() -> list[dict]:
    return json.loads((HERE / "books.config.json").read_text(encoding="utf-8"))["books"]


def inspect(pdf_dir: Path) -> None:
    for b in load_config():
        path = pdf_dir / b["file"]
        print("=" * 90)
        print(f"{b['file']}  | include={b['include']} kind={b['kind']} title={b['title']}")
        if not path.exists():
            print("  (missing)")
            continue
        doc = fitz.open(path)
        print(f"  pages: {doc.page_count}")
        for i in range(min(3, doc.page_count)):
            t = doc[i].get_text().strip()
            if t:
                print(f"--- page {i + 1} ---\n{t[:800]}")
                break


def context_line(c: dict) -> str:
    bits = [c["book_title"]]
    if c["part"]:
        bits.append(c["part"])
    if c["chapter"]:
        bits.append(c["chapter"])
    if c["article_numbers"] and c["section_type"] == "article":
        a = f"Article {c['article_numbers'][0]}"
        if c["article_title"]:
            a += f": {c['article_title']}"
        bits.append(a)
    return " — ".join(bits)


def process_book(book: dict, pdf_dir: Path, start_id: int) -> tuple[list[dict], dict]:
    doc = fitz.open(pdf_dir / book["file"])
    raw_pages = [doc[i].get_text() for i in range(doc.page_count)]
    repeating = find_repeating_lines([p.split("\n") for p in raw_pages])
    pages = []
    dropped = 0
    for i, raw in enumerate(tqdm(raw_pages, desc=f"clean {book['file']}", leave=False)):
        text, part, printed = clean_page(raw, repeating)
        if useful_chars(text) < 40 or is_mostly_devanagari(text):
            dropped += 1  # covers, blank pages, Hindi-only pages (we index English)
            continue
        pages.append({"pdf_page": i + 1, "printed_page": printed, "text": text, "header_part": part})

    segs = segment_book(pages, book["kind"])
    chunks: list[dict] = []
    seen: set[str] = set()
    cid = start_id
    for s in segs:
        for piece in split_segment(s.text):
            norm = re.sub(r"\s+", " ", piece).strip()
            if s.section_type != "toc" and useful_chars(norm) < MIN_USEFUL:
                continue
            key = norm.lower()[:300]
            if key in seen:
                continue
            seen.add(key)
            arts = [s.article] if s.article else []
            c = {
                "id": cid,
                "book_file": book["file"],
                "book_title": book["title"],
                "pdf_page": s.pdf_page,
                "printed_page": s.printed_page,
                "part": s.part,
                "chapter": s.chapter,
                "article_numbers": arts,
                "article_title": s.article_title,
                "mentions": mentions(norm),
                "section_type": s.section_type,
                "text": norm,
            }
            c["search_text"] = f"{context_line(c)}\n{norm}"
            chunks.append(c)
            cid += 1
    stats = {"file": book["file"], "pages": doc.page_count, "pages_dropped": dropped, "chunks": len(chunks)}
    return chunks, stats


def quality_report(chunks: list[dict]) -> None:
    n = len(chunks)
    avg = sum(len(c["text"]) for c in chunks) / max(n, 1)
    tagged = sum(1 for c in chunks if c["article_numbers"])
    junk = [c for c in chunks if HEADER_RE.match(c["text"]) or useful_chars(c["text"]) < MIN_USEFUL and c["section_type"] != "toc"]
    print("\n" + "=" * 90 + "\nQUALITY REPORT")
    print(f"total chunks: {n} | avg length: {avg:.0f} chars | article-tagged: {100 * tagged / max(n, 1):.1f}%")
    for c in random.sample(chunks, min(10, n)):
        print(f"\n[{c['id']}] {c['book_file']} p.{c['pdf_page']} {c['part']} art={c['article_numbers']}\n  {c['text'][:200]}")
    if junk:
        print(f"\nWARNING: {len(junk)} junk-looking chunks, e.g.:")
        for c in junk[:10]:
            print(f"  [{c['id']}] {c['text'][:100]}")
    if n and len(junk) / n > 0.05:
        sys.exit("FAIL: >5% of chunks look like headers/junk. Tune clean.py before committing.")


def embed(chunks: list[dict], out: Path) -> int:
    import numpy as np
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(MODEL, device="cpu")
    # LEARNING NOTE: BGE documents are embedded WITHOUT the query instruction prefix.
    vecs = model.encode([c["search_text"] for c in chunks], batch_size=32,
                        normalize_embeddings=True, show_progress_bar=True)
    arr = np.asarray(vecs, dtype=np.float16)
    arr.tofile(out / "embeddings.f16.bin")
    return int(arr.shape[1])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true")
    ap.add_argument("--no-embed", action="store_true")
    ap.add_argument("--pdf-dir", default=str(HERE.parent / "raw_pdfs"))
    ap.add_argument("--out", default=str(HERE.parent / "data"))
    args = ap.parse_args()
    pdf_dir, out = Path(args.pdf_dir), Path(args.out)
    if args.inspect:
        inspect(pdf_dir)
        return
    out.mkdir(parents=True, exist_ok=True)

    all_chunks: list[dict] = []
    per_book: list[dict] = []
    for book in tqdm([b for b in load_config() if b["include"]], desc="books"):
        if not (pdf_dir / book["file"]).exists():
            print(f"skip missing {book['file']}")
            continue
        chunks, stats = process_book(book, pdf_dir, len(all_chunks))
        all_chunks.extend(chunks)
        per_book.append(stats)
        print(stats)

    quality_report(all_chunks)

    article_index: dict[str, list[int]] = {}
    for c in all_chunks:
        for a in c["article_numbers"]:
            article_index.setdefault(a, []).append(c["id"])

    with open(out / "chunks.jsonl", "w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    (out / "article_index.json").write_text(json.dumps(article_index), encoding="utf-8")

    dim = 0
    emb = out / "embeddings.f16.bin"
    if args.no_embed:
        if emb.exists():
            emb.unlink()
    else:
        dim = embed(all_chunks, out)

    manifest = {
        "count": len(all_chunks),
        "articles_indexed": len(article_index),
        "embedding_model": MODEL if dim else None,
        "dim": dim,
        "build_date": datetime.now(timezone.utc).isoformat(),
        "books": per_book,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {len(all_chunks)} chunks, {len(article_index)} articles → {out}")
    for k in ["21", "21A", "32", "14", "368"]:
        print(f"  Article {k}: {'OK' if k in article_index else 'MISSING — check article_parser regex'}")

if __name__ == "__main__":
    main()