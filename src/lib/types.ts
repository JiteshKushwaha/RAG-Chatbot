export interface Chunk {
    id: number;
    book_file: string;
    book_title: string;
    pdf_page: number;
    printed_page: number | null;
    part: string | null;
    chapter: string | null;
    article_numbers: string[];
    article_title: string | null;
    mentions: string[];
    section_type: "article" | "text" | "schedule" | "toc";
    text: string;
    search_text: string;
  }
  
  export interface Manifest {
    count: number;
    articles_indexed: number;
    embedding_model: string | null;
    dim: number;
    build_date: string;
    books: { file: string; pages: number; pages_dropped: number; chunks: number }[];
  }
  
  export type Confidence = "high" | "medium" | "low";
  export type RetrievalMode = "hybrid" | "bm25";
  export type Intent = "question" | "greeting" | "offtopic" | "injection";
  
  export interface ScoredChunk {
    chunk: Chunk;
    score: number;
    pinned: boolean;
  }
  
  export interface RetrievalResult {
    chunks: ScoredChunk[];
    confidence: Confidence;
    mode: RetrievalMode;
    detectedArticles: string[];
    intent: Intent;
    pureArticle: boolean;
    query: string;
  }
  
  export interface Source {
    n: number;
    book: string;
    pdfPage: number;
    printedPage: number | null;
    part: string | null;
    article: string | null;
    articleTitle: string | null;
    snippet: string;
    score: number;
  }
  
  export interface ChatTurn {
    role: "user" | "assistant";
    content: string;
  }
  
  export interface MetaEvent {
    confidence: Confidence;
    mode: RetrievalMode;
    detectedArticles: string[];
    sources: Source[];
    kind: "answer" | "refusal" | "canned";
    model: string | null;
  }
  
  export interface GroundingReport {
    verified: boolean;
    unverifiedQuotes: string[];
    unknownArticles: string[];
    invalidCitations: number[];
  }
  
  export interface DoneEvent {
    grounding: GroundingReport | null;
    finalText: string;
    latencyMs: number;
  }
  export type Stage = "searching" | "reading" | "composing";  