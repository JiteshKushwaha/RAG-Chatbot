"""Structure-aware segmentation: Parts, Chapters, Articles, Schedules → chunks.

LEARNING NOTE: Fixed-size chunks (600 chars) cut Articles in half and mixed neighbours,
so 'Article 21' text was never cleanly retrievable. One Article per chunk + an exact
article index lets us *look up* Article 21 rather than *hope* similarity finds it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

PART_RE = re.compile(r"^\s*PART\s+([IVXLC]+[A-Z]?)\s*$|^\s*PART\s+([IVXLC]+[A-Z]?)\b[\s.—–-]*(.*)$")
CHAPTER_RE = re.compile(r"^\s*CHAPTER\s+([IVXLC]+)\b[\s.—–-]*(.*)$", re.I)
ARTICLE_RE = re.compile(
    r"^\s*(?:\d{0,3}\[)?(\d{1,3}[A-Z]{0,3})\.\s*\[?([A-Z][^—–\n]{2,160}?)\.?\s*(?:[—–]|\.-)\s*(.*)$"
)
SCHEDULE_RE = re.compile(
    r"^\s*(?:\d?\[)?(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH)\s+SCHEDULE",
    re.I,
)
TOC_LINE_RE = re.compile(r"^\d{1,3}[A-Z]{0,3}\.\s+[A-Z][^—–]{2,90}$")
MENTION_RE = re.compile(r"\bArt(?:icle)?s?\.?\s+(\d{1,3}[A-Z]{0,3})\b")
SENT_SPLIT_RE = re.compile(r"(?<=[.;:])\s+(?=[A-Z(\"])")
CLAUSE_SPLIT_RE = re.compile(r"\n(?=\s*\(\d+[A-Z]?\)\s)|\n(?=\s*\([a-z]\)\s)")

MAX_CHUNK = 900
TARGET = 800
OVERLAP = 150


@dataclass
class Segment:
    pdf_page: int
    printed_page: int | None
    part: str | None
    chapter: str | None
    article: str | None
    article_title: str | None
    section_type: str
    lines: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "\n".join(self.lines).strip()


def is_toc_page(text: str) -> bool:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return False
    toc_hits = sum(1 for l in lines if TOC_LINE_RE.match(l))
    marker = bool(re.search(r"ARRANGEMENT OF ARTICLES|CONTENTS", text[:400], re.I))
    return (marker and toc_hits >= 3) or toc_hits / len(lines) > 0.5


def segment_book(pages: list[dict], kind: str) -> list[Segment]:
    """pages: [{pdf_page, printed_page, text, header_part}]"""
    segs: list[Segment] = []
    part: str | None = None
    chapter: str | None = None
    current: Segment | None = None
    pending_part_title = False

    def start(seg: Segment) -> None:
        nonlocal current
        if current and current.text:
            segs.append(current)
        current = seg

    for p in pages:
        text, pg, printed = p["text"], p["pdf_page"], p["printed_page"]
        if p.get("header_part"):
            part = p["header_part"]
        if is_toc_page(text):
            start(Segment(pg, printed, part, chapter, None, None, "toc", text.split("\n")))
            start(Segment(pg, printed, part, chapter, None, None, "text"))
            continue
        if current is None:
            current = Segment(pg, printed, part, chapter, None, None, "text")
        for line in text.split("\n"):
            s = line.strip()
            if not s:
                continue
            if kind == "constitution":
                m = PART_RE.match(s)
                if m and len(s) < 80:
                    num = m.group(1) or m.group(2)
                    title = (m.group(3) or "").strip()
                    part = f"Part {num}" + (f" — {title.title()}" if title else "")
                    pending_part_title = not title
                    start(Segment(pg, printed, part, None, None, None, "text"))
                    chapter = None
                    continue
                if pending_part_title and s.isupper() and len(s) < 60:
                    part = f"{part} — {s.title()}"
                    pending_part_title = False
                    if current:
                        current.part = part
                    continue
                pending_part_title = False
                c = CHAPTER_RE.match(s)
                if c and len(s) < 90:
                    chapter = f"Chapter {c.group(1).upper()}" + (f" — {c.group(2).strip().title()}" if c.group(2).strip() else "")
                    continue
                sc = SCHEDULE_RE.match(s)
                if sc:
                    start(Segment(pg, printed, f"{sc.group(1).title()} Schedule", None, None, None, "schedule", [s]))
                    continue
                a = ARTICLE_RE.match(s)
                if a:
                    start(Segment(pg, printed, part, chapter, a.group(1).upper(), a.group(2).strip(), "article", [s]))
                    continue
            assert current is not None
            current.lines.append(s)
    if current and current.text:
        segs.append(current)
    return segs


def _pack(pieces: list[str]) -> list[str]:
    chunks: list[str] = []
    buf = ""
    for piece in pieces:
        piece = piece.strip()
        if not piece:
            continue
        if len(buf) + len(piece) + 1 <= TARGET or not buf:
            buf = f"{buf} {piece}".strip() if buf else piece
        else:
            chunks.append(buf)
            tail = buf[-OVERLAP:]
            cut = tail.find(". ")
            tail = tail[cut + 2:] if cut != -1 else ""
            buf = f"{tail} {piece}".strip()
    if buf:
        chunks.append(buf)
    out: list[str] = []
    for c in chunks:  # hard fallback for giant sentences
        while len(c) > MAX_CHUNK * 2:
            out.append(c[:TARGET])
            c = c[TARGET - OVERLAP:]
        out.append(c)
    return out


def split_segment(text: str) -> list[str]:
    if len(text) <= MAX_CHUNK:
        return [text]
    clauses = CLAUSE_SPLIT_RE.split(text)
    pieces: list[str] = []
    for cl in clauses:
        if len(cl) <= TARGET:
            pieces.append(cl.replace("\n", " "))
        else:
            pieces.extend(SENT_SPLIT_RE.split(cl.replace("\n", " ")))
    return _pack(pieces)


def mentions(text: str) -> list[str]:
    return sorted({m.upper() for m in MENTION_RE.findall(text)})