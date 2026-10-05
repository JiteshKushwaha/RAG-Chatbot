const STOP = new Set(
    ("a an the of to in on for and or is are was were be by with as at from that this it its " +
      "what which who whom how does do did can could shall should may might will would about " +
      "explain tell me please under any all into than then there their them they i you your " +
      "define meaning mean says say said give list").split(" "),
  );
  
  export function tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t))
      .map(stem);
  }
  
  // Tiny suffix stemmer — enough to match "rights"/"right", "amended"/"amend".
  function stem(t: string): string {
    if (/^\d/.test(t) || t.length < 5) return t;
    return t.replace(/(ments|ment|ings|ing|edly|ed|ies|es|s)$/, (m) => (m === "ies" ? "y" : ""));
}  