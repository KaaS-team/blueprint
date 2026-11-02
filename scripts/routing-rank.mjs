// Ranks skill descriptions against a request with TF-IDF and cosine similarity.
const STOP = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'with', 'this', 'that', 'from', 'they', 'will', 'what', 'when', 'your', 'who', 'how', 'its', 'any', 'into', 'than', 'then', 'them', 'been', 'does', 'also', 'use', 'used', 'using']);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function counts(tokens) {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

// docs: [{ name, text }]. Returns names, best match first, ties broken by name.
export function rank(docs, query) {
  const tfs = docs.map((d) => counts(tokenize(d.text)));
  const n = docs.length;
  const idf = (term) => {
    const df = tfs.filter((tf) => tf.has(term)).length;
    return Math.log((1 + n) / (1 + df)) + 1;
  };
  const vector = (tf) => {
    const v = new Map();
    for (const [t, c] of tf) v.set(t, c * idf(t));
    return v;
  };
  const norm = (v) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
  const q = vector(counts(tokenize(query)));
  const qn = norm(q);
  const scored = docs.map((d, i) => {
    const v = vector(tfs[i]);
    let dot = 0;
    for (const [t, x] of q) dot += x * (v.get(t) ?? 0);
    const denom = qn * norm(v);
    return { name: d.name, score: denom ? dot / denom : 0 };
  });
  scored.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return scored.map((s) => s.name);
}
