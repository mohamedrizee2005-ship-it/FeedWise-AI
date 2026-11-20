import { textKey } from "../shared/analysis.mjs";

// Supervised nearest-centroid learner, fitted afresh from the current class's
// corrections. Exact correction memory always has priority over this model.
const stop = new Set(
  "the a an and is was are were it this that lecture class lecturer very really of to in for with".split(
    " ",
  ),
);
function vector(text) {
  const words = textKey(text).match(/[\p{L}\p{M}\p{N}_]+/gu) || [];
  const counts = new Map();
  const put = (key, weight) => counts.set(key, (counts.get(key) || 0) + weight);
  for (const word of words.slice(0, 300)) {
    if (stop.has(word)) continue;
    put("w:" + word, 2);
    const chars = Array.from(" " + word + " ");
    for (let i = 0; i + 3 <= chars.length; i++)
      put("c:" + chars.slice(i, i + 3).join(""), 1);
  }
  const norm =
    Math.sqrt([...counts.values()].reduce((s, n) => s + n * n, 0)) || 1;
  return new Map([...counts].map(([k, v]) => [k, v / norm]));
}
const dot = (a, b) => [...a].reduce((s, [k, v]) => s + v * (b.get(k) || 0), 0);
export function trainCorrections(examples) {
  const samples = examples.map((row) => ({
    ...row,
    vector: vector(row.original_text),
  }));
  const labels = [...new Set(examples.map((row) => row.label))];
  const centroids = new Map();
  for (const label of labels) {
    const center = new Map();
    const group = samples.filter((x) => x.label === label);
    for (const row of group)
      for (const [k, v] of row.vector)
        center.set(k, (center.get(k) || 0) + v / group.length);
    const norm =
      Math.sqrt([...center.values()].reduce((s, n) => s + n * n, 0)) || 1;
    centroids.set(label, new Map([...center].map(([k, v]) => [k, v / norm])));
  }
  return { samples, centroids };
}
const hasNegation = (text) =>
  /\b(?:not|never|no|cannot|hardly|\w+n.t)\b|இல்லை|இல்ல|வில்லை|නැහැ|නෑ|නොවේ/iu.test(
    text,
  );
export function learnedDecision(text, model) {
  if (model.samples.length < 6 || model.centroids.size < 2) return null;
  const input = vector(text);
  const ranked = [...model.centroids]
    .map(([label, center]) => ({ label, score: dot(input, center) }))
    .sort((a, b) => b.score - a.score);
  const nearby = model.samples
    .map((row) => ({
      label: row.label,
      score: dot(input, row.vector),
      negated: hasNegation(row.original_text),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  const best = ranked[0];
  // Conservative agreement gate; similarity is never presented as accuracy.
  if (
    best.score < 0.7 ||
    best.score - ranked[1].score < 0.18 ||
    nearby.length < 2 ||
    nearby.some(
      (x) =>
        x.label !== best.label ||
        x.score < 0.65 ||
        x.negated !== hasNegation(text),
    )
  )
    return null;
  return { label: best.label, similarity: nearby[0].score };
}
export async function correctionExamples(db, sessionId) {
  const { results } = await db
    .prepare(
      "SELECT original_text,label,text_key,revision,updated_at FROM correction_memory WHERE session_id=? ORDER BY updated_at DESC,text_key",
    )
    .bind(sessionId)
    .all();
  return results;
}

// Keep only four recent fitted classes per open database. The revision sum changes
// on every review, even when two reviews arrive within the same second.
const fitted = new WeakMap();
export async function classDecision(db, sessionId, comment) {
  const exact = await db
    .prepare(
      "SELECT label,revision FROM correction_memory WHERE session_id=? AND text_key=?",
    )
    .bind(sessionId, textKey(comment))
    .first();
  if (exact) return { ...exact, source: "correction" };
  const stats = await db
    .prepare(
      "SELECT COUNT(*) AS count, SUM(revision) AS version FROM correction_memory WHERE session_id=?",
    )
    .bind(sessionId)
    .first();
  if (stats.count < 6) return null;
  let cache = fitted.get(db);
  if (!cache) {
    cache = new Map();
    fitted.set(db, cache);
  }
  let entry = cache.get(sessionId);
  if (entry?.version !== stats.version) {
    const examples = await correctionExamples(db, sessionId);
    entry = { version: stats.version, model: trainCorrections(examples) };
    cache.delete(sessionId);
    if (cache.size >= 4) cache.delete(cache.keys().next().value);
    cache.set(sessionId, entry);
  }
  const decision = learnedDecision(comment, entry.model);
  return decision ? { ...decision, source: "learner" } : null;
}
