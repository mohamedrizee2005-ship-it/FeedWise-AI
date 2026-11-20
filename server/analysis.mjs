import { predict, MODEL_VERSION } from "./inference.mjs";
import {
  ANALYSIS_VERSION,
  analysePhrases,
  isFactual,
  languageOf,
  withHumanLabel,
} from "../shared/analysis.mjs";
import { classDecision } from "./learning.mjs";

export const HYBRID_VERSION = ANALYSIS_VERSION + ":" + MODEL_VERSION;
export function localAnalysis(comment) {
  const language = languageOf(comment);
  const parts = analysePhrases(comment);
  const english = language === "en" ? predict(comment) : null;
  let label =
    parts.strengths.length && parts.concerns.length
      ? "mixed"
      : parts.concerns.length
        ? "negative"
        : parts.strengths.length
          ? "positive"
          : "unreviewed";
  if (label === "unreviewed" && isFactual(comment)) label = "neutral";
  const partialContrast = parts.unclearParts > 0 && /\b(?:but|however|although|though|whereas|yet)\b|ஆனால்|ஆனா\s|නමුත්|හැබැයි|ඒත්/iu.test(comment) && label !== "mixed";
  if (partialContrast) label = "unreviewed";
  let source = "phrases";
  if (label === "unreviewed" && !partialContrast && english && english.probability >= 0.7) {
    label = english.label;
    source = "baseline";
    if (label === "positive")
      parts.strengths = [{ quote: comment, topic: "other" }];
    if (["negative", "mixed"].includes(label))
      parts.concerns = [{ quote: comment, topic: "other" }];
  }
  return {
    ...parts,
    label,
    language,
    source,
    suggestions: [],
    needsReview:
      label === "unreviewed" ||
      (source === "phrases" && parts.unclearParts > 0) ||
      (source === "baseline" && english.probability < 0.8),
    reason:
      source === "phrases"
        ? "Known phrases and separate clauses; lecturer review is recommended."
        : "English baseline model; not a guaranteed interpretation.",
    modelVersion: HYBRID_VERSION,
    baselineScore: source === "baseline" ? english.probability : 0,
  };
}
export async function analyseForClass(
  db,
  sessionId,
  comment,
  original = localAnalysis(comment),
) {
  const applied = await classDecision(db, sessionId, comment);
  if (!applied) return original;
  if (applied.source === "correction")
    return {
      ...withHumanLabel(original, comment, applied.label),
      memoryRevision: applied.revision,
    };
  // Similar wording must not erase explicit opposing opinions or a clear change request.
  if (
    original.source === "phrases" &&
    original.label !== "unreviewed" &&
    original.label !== applied.label
  )
    return original;
  return {
    ...withHumanLabel(original, comment, applied.label, "learner"),
    needsReview: true,
    reason:
      "Similar lecturer-reviewed comments in this class suggest this label.",
  };
}
export function analysisStatement(db, feedbackId, result) {
  return db
    .prepare(
      `INSERT INTO feedback_analyses(feedback_id,label,language,source,details) SELECT id,?,?,?,? FROM feedback WHERE id=?
    ON CONFLICT(feedback_id) DO UPDATE SET label=excluded.label,language=excluded.language,source=excluded.source,details=excluded.details,updated_at=CURRENT_TIMESTAMP`,
    )
    .bind(
      result.label,
      result.language,
      result.source,
      JSON.stringify(result),
      feedbackId,
    );
}
export function readAnalysis(row) {
  try {
    return row.analysis_details
      ? JSON.parse(row.analysis_details)
      : localAnalysis(row.comment);
  } catch {
    return localAnalysis(row.comment);
  }
}
