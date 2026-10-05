import { buildIndex } from "../src/lib/loadIndex";
import type { Chunk } from "../src/lib/types";

const mk = (id: number, art: string | null, title: string | null, text: string, part = "Part III — Fundamental Rights"): Chunk => ({
  id, book_file: "book1.pdf", book_title: "The Constitution of India", pdf_page: 10 + id, printed_page: null,
  part, chapter: null, article_numbers: art ? [art] : [], article_title: title, mentions: [],
  section_type: art ? "article" : "text", text, search_text: `${part} — Article ${art}: ${title}\n${text}`,
});

export const chunks: Chunk[] = [
  mk(0, "14", "Equality before law", "14. Equality before law.—The State shall not deny to any person equality before the law or the equal protection of the laws within the territory of India."),
  mk(1, "21", "Protection of life and personal liberty", "21. Protection of life and personal liberty.—No person shall be deprived of his life or personal liberty except according to procedure established by law."),
  mk(2, "21A", "Right to education", "21A. Right to education.—The State shall provide free and compulsory education to all children of the age of six to fourteen years in such manner as the State may, by law, determine."),
  mk(3, "32", "Remedies for enforcement of rights conferred by this Part", "32. Remedies for enforcement of rights conferred by this Part.—(1) The right to move the Supreme Court by appropriate proceedings for the enforcement of the rights conferred by this Part is guaranteed. (2) The Supreme Court shall have power to issue directions or orders or writs, including writs in the nature of habeas corpus, mandamus, prohibition, quo warranto and certiorari."),
  mk(4, "368", "Power of Parliament to amend the Constitution", "368. Power of Parliament to amend the Constitution and procedure therefor.—An amendment of this Constitution may be initiated only by the introduction of a Bill for the purpose in either House of Parliament.", "Part XX — Amendment Of The Constitution"),
];
export const articleIndex = { "14": [0], "21": [1], "21A": [2], "32": [3], "368": [4] };
export const index = () => buildIndex(chunks, articleIndex);