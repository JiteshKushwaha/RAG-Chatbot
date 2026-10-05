import type { ChatTurn, Intent } from "./types";

const WORD_NUMS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

export function wordsToNumbers(q: string): string {
  return q.replace(
    /\barticle\s+(twenty|thirty|forty|fifty)?[-\s]?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)?\b/gi,
    (m, tens: string | undefined, units: string | undefined) => {
      const n = (tens ? WORD_NUMS[tens.toLowerCase()] : 0) + (units ? WORD_NUMS[units.toLowerCase()] : 0);
      return n ? `Article ${n}` : m;
    },
  );
}

export function extractArticles(q: string): string[] {
  const text = wordsToNumbers(q);
  const out = new Set<string>();
  const re = /\b(?:articles?|arts?\.?)\s*((?:\d{1,4}[a-z]{0,3})(?:\s*(?:,|and|&|to|-)\s*\d{1,4}[a-z]{0,3})*)/gi;
  for (const m of text.matchAll(re)) {
    const parts = m[1].split(/\s*(?:,|and|&)\s*/i);
    for (const p of parts) {
      const range = p.match(/^(\d{1,4})\s*(?:to|-)\s*(\d{1,4})$/i);
      if (range) {
        const [a, b] = [Number(range[1]), Number(range[2])];
        if (b > a && b - a <= 12) for (let i = a; i <= b; i++) out.add(String(i));
        else out.add(range[1]);
      } else {
        const one = p.match(/^\d{1,4}[a-z]{0,3}$/i);
        if (one) out.add(one[0].toUpperCase());
      }
    }
  }
  return [...out];
}

// LEARNING NOTE: conceptual questions ("fundamental rights") share few words with the
// actual provisions. Mapping concepts → Articles/keywords bridges that vocabulary gap.
const SYNONYMS: { re: RegExp; articles: string[]; expand: string }[] = [
  { re: /right to life|personal liberty/i, articles: ["21"], expand: "protection of life and personal liberty" },
  { re: /right to education/i, articles: ["21A"], expand: "free and compulsory education children" },
  { re: /\bwrits?\b|habeas corpus|mandamus|certiorari|quo warranto/i, articles: ["32", "226"], expand: "writs habeas corpus mandamus prohibition quo warranto certiorari" },
  { re: /constitutional remed/i, articles: ["32"], expand: "remedies for enforcement of rights" },
  { re: /fundamental rights?/i, articles: ["12", "13"], expand: "Part III fundamental rights" },
  { re: /\bdpsps?\b|directive principles?/i, articles: ["36", "37", "38", "39"], expand: "Part IV directive principles of state policy" },
  { re: /fundamental dut/i, articles: ["51A"], expand: "Part IVA fundamental duties" },
  { re: /\bamend(ment|ing)?\b/i, articles: ["368"], expand: "power of Parliament to amend the Constitution procedure" },
  { re: /\bemergenc/i, articles: ["352", "356", "360"], expand: "proclamation of emergency" },
  { re: /president'?s rule|failure of constitutional machinery/i, articles: ["356"], expand: "failure of constitutional machinery in States" },
  { re: /(appoint\w*|choose|select\w*).*(prime minister|\bpm\b)|(prime minister|\bpm\b).*(appoint|chosen)/i, articles: ["75"], expand: "Prime Minister shall be appointed by the President" },
  { re: /powers? of (the )?president|president'?s powers|president.*powers?/i, articles: ["53", "72", "74"], expand: "executive power of the Union vested in the President" },
  { re: /pardon/i, articles: ["72"], expand: "power of President to grant pardons" },
  { re: /equality|equal protection/i, articles: ["14"], expand: "equality before law" },
  { re: /untouchab/i, articles: ["17"], expand: "abolition of untouchability" },
  { re: /uniform civil code/i, articles: ["44"], expand: "uniform civil code for the citizens" },
  { re: /attorney.?general/i, articles: ["76"], expand: "Attorney-General for India" },
  { re: /supreme court/i, articles: ["124"], expand: "establishment and constitution of Supreme Court" },
  { re: /freedom of speech|right to freedom/i, articles: ["19"], expand: "protection of certain rights regarding freedom of speech" },
];

export function expandQuery(q: string): { expanded: string; hintArticles: string[] } {
  const hints = new Set<string>();
  const extra: string[] = [];
  for (const s of SYNONYMS) {
    if (s.re.test(q)) {
      s.articles.forEach((a) => hints.add(a));
      extra.push(s.expand);
    }
  }
  return { expanded: [q, ...extra].join(" "), hintArticles: [...hints] };
}

const GREETING = /^\s*(hi|hello|hey|namaste|good (morning|evening|afternoon)|thanks?( you)?|who are you|what can you do)[\s!.?]*$/i;
const INJECTION = /ignore (all |any )?(previous|prior|above) (instructions|rules)|system prompt|reveal your (prompt|instructions)|jailbreak|developer mode|you are now/i;
const OFFTOPIC = /\b(jupiter|mars|planet|galaxy|distance from earth|recipe|cook|weather|movie|cricket score|stock price|bitcoin|python|javascript|code|script|program(ming)?|malware|hack(ing)?|exploit|password|phishing|sql injection|keylogger)\b/i;

export function classifyIntent(q: string): Intent {
  if (INJECTION.test(q)) return "injection";
  if (GREETING.test(q)) return "greeting";
  if (OFFTOPIC.test(q)) return "offtopic";
  return "question";
}

export function isPureArticleQuestion(q: string): boolean {
  return /^\s*(what is|what's|what does|explain|show( me)?|define|read|quote)?\s*(the\s+)?(article|art\.?)\s*\d{1,3}[a-z]{0,3}(\s+of the (indian )?constitution( of india)?)?\s*(say|state|mean)?\s*\??\s*$/i.test(q);
}

/** Deterministic follow-up rewrite: "what about clause 2 of it?" → borrow previous articles. */
export function rewriteFollowUp(q: string, history: ChatTurn[]): string {
  if (extractArticles(q).length) return q;
  const isFollowUp = /\b(it|this|that|its|they|them|these|those|same|above)\b/i.test(q) && q.length < 120;
  if (!isFollowUp) return q;
  const prevUser = [...history].reverse().find((t) => t.role === "user" && t.content !== q);
  if (!prevUser) return q;
  const arts = extractArticles(prevUser.content);
  return arts.length ? `${q} (Article ${arts.join(", Article ")})` : `${q} (context: ${prevUser.content.slice(0, 150)})`;
}