import model from "./model.json" with { type: "json" };
export { LABELS, topics, toCSV } from "../shared/feedback.mjs";
export const MODEL_VERSION = model.version;
export const MODEL_EVALUATION = {
  version: MODEL_VERSION,
  samples: model.evaluation.training_samples,
  heldout: model.evaluation.heldout_samples,
  accuracy: model.evaluation.heldout_combined.accuracy,
  studentAccuracy: model.evaluation.heldout_student_feedback.accuracy,
  macroF1: model.evaluation.heldout_student_feedback.macro_f1,
};
export function normalize(text) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
function vectors(grams, features, offset) {
  const counts = new Map();
  for (const gram of grams) {
    const index = features.vocabulary[gram];
    if (typeof index === "number")
      counts.set(index, (counts.get(index) || 0) + 1);
  }
  const weighted = [...counts].map(([i, n]) => [i, n * features.idf[i]]);
  const norm = Math.sqrt(weighted.reduce((sum, [, v]) => sum + v * v, 0)) || 1;
  return weighted.map(([i, v]) => [i + offset, v / norm]);
}
// Identical feature ordering and softmax to the exported scikit-learn pipeline.
export function predictRaw(text) {
  const clean = normalize(text);
  const words = clean.match(/[\p{L}\p{N}_]{2,}/gu) || [];
  const grams = [
    ...words,
    ...words.slice(1).map((word, i) => `${words[i]} ${word}`),
  ];
  const characters = [];
  for (const word of clean.split(/\s+/u).filter(Boolean)) {
    const chars = Array.from(" " + word + " ");
    for (let n = 3; n <= 5; n++) {
      characters.push(chars.slice(0, n).join(""));
      let offset = 0;
      while (offset + n < chars.length) {
        offset++;
        characters.push(chars.slice(offset, offset + n).join(""));
      }
      if (offset === 0) break;
    }
  }
  const sparse = [
    ...vectors(grams, model.features.word, 0),
    ...vectors(characters, model.features.char, model.features.word.idf.length),
  ];
  const scores = model.intercepts.map(
    (bias, c) =>
      bias + sparse.reduce((sum, [i, v]) => sum + model.weights[c][i] * v, 0),
  );
  const top = Math.max(...scores),
    exps = scores.map((s) => Math.exp(s - top)),
    total = exps.reduce((a, b) => a + b, 0);
  const probabilities = Object.fromEntries(
    model.classes.map((label, i) => [label, exps[i] / total]),
  );
  const index = scores.indexOf(top);
  return {
    label: model.classes[index],
    probability: exps[index] / total,
    probabilities,
    modelVersion: MODEL_VERSION,
  };
}
export function predict(text) {
  const clean = normalize(text);
  const letters = clean.match(/\p{L}/gu) || [];
  const english = clean.match(/[a-z]/g) || [];
  if (english.length < 2 || english.length / Math.max(letters.length, 1) < 0.65)
    return { label: "unreviewed", probability: 0, modelVersion: MODEL_VERSION };
  // Narrow idiom rule: a short "not bad" response is generally positive.
  if (
    /^(?:(?:it(?:'s| is)|this(?: is)?|the (?:class|lecture|course)(?: was| is)?)\s+)?(?:was\s+)?not (?:too |that |so )?bad[.! ]*$/u.test(
      clean,
    )
  )
    return { label: "positive", probability: 0.6, modelVersion: MODEL_VERSION };
  const whole = predictRaw(clean);
  // A separate, documented heuristic handles opposing opinions in different clauses.
  // It does not claim a measured four-class accuracy or change the original text.
  const clauses = clean
    .split(/[.!?;\n]+|\b(?:but|however|although|yet)\b/iu)
    .map((t) => t.trim())
    .filter((t) => (t.match(/[a-z]+/g) || []).length >= 3)
    .slice(0, 20);
  if (clauses.length > 1) {
    const opinions = clauses
      .map((clause) => {
        const raw = predictRaw(clause);
        const negative =
          /\b(?:rushed|confusing|unclear|boring|awful|terrible|poor|unhelpful|outdated)\b|\btoo (?:fast|slow)\b|\bneed(?:s)? (?:more|better)\b/u.test(
            clause,
          );
        const positive =
          /\b(?:clear|clearly|helpful|excellent|great|enjoyed|useful)\b/u.test(
            clause,
          ) && !/\b(?:not|never|hardly)\b/u.test(clause);
        if (negative !== positive)
          return {
            label: negative ? "negative" : "positive",
            probability: 0.6,
          };
        return raw;
      })
      .filter((r) => r.probability >= 0.58);
    if (
      opinions.some((r) => r.label === "positive") &&
      opinions.some((r) => r.label === "negative")
    )
      return {
        label: "mixed",
        probability: Math.min(...opinions.map((r) => r.probability)),
        modelVersion: MODEL_VERSION,
      };
  }
  return whole;
}
