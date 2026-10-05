"""Page-level cleaning: running headers/footers, page numbers, unicode, hyphenation.

LEARNING NOTE: In the notebook, the top retrieved chunks for "Article 21" were pure running
headers like 'THE CONSTITUTION OF INDIA(Part V.—The Union)4396'. Headers appear on every page,
so they match almost any query. Removing them is the single biggest retrieval fix.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter

HEADER_RE = re.compile(r"^\s*THE\s+CONSTITUTION\s+OF\s+INDIA\s*(\(.*?\))?\s*[\d\[\]A-Z]*\s*$", re.I)
HEADER_PART_RE = re.compile(r"\(Part\s+([IVXLC]+[A-Z]?)\s*\.?\s*[—–-]?\s*([^)]*)\)", re.I)
LONE_NUM_RE = re.compile(r"^\s*[-–—]?\s*(\d{1,4})\s*[-–—]?\s*$")
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u00ad", "").replace("\u200b", "").replace("\ufeff", "")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)          # hyphenation across line breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _key(line: str) -> str:
    return re.sub(r"\d+", "", line).strip().lower()


def find_repeating_lines(pages: list[list[str]], ratio: float = 0.3) -> set[str]:
    """Lines (digits ignored) that appear in the top/bottom 3 lines of >ratio of pages."""
    counts: Counter[str] = Counter()
    for lines in pages:
        edge = {_key(l) for l in lines[:3] + lines[-3:] if l.strip()}
        counts.update(k for k in edge if len(k) > 3)
    threshold = max(3, int(len(pages) * ratio))
    return {k for k, c in counts.items() if c >= threshold}


def clean_page(raw: str, repeating: set[str]) -> tuple[str, str | None, int | None]:
    """Returns (clean_text, part_from_header, printed_page)."""
    part: str | None = None
    printed: int | None = None
    out: list[str] = []
    lines = raw.split("\n")
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            out.append("")
            continue
        if HEADER_RE.match(s) and len(s) < 140:
            m = HEADER_PART_RE.search(s)
            if m:
                part = f"Part {m.group(1).upper()}" + (f" — {m.group(2).strip(' .—-')}" if m.group(2).strip() else "")
            continue
        if _key(s) in repeating and len(s) < 140:
            continue
        num = LONE_NUM_RE.match(s)
        if num and (i < 3 or i >= len(lines) - 3):
            printed = printed or int(num.group(1))
            continue
        out.append(s)
    return normalize("\n".join(out)), part, printed


def useful_chars(text: str) -> int:
    return len(re.sub(r"[^A-Za-z]", "", text))


def is_mostly_devanagari(text: str) -> bool:
    letters = re.findall(r"[A-Za-z\u0900-\u097F]", text)
    return bool(letters) and len(DEVANAGARI_RE.findall(text)) / len(letters) > 0.5