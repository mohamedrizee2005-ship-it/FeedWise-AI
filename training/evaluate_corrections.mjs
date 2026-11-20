// Evaluate the shipped offline analyser on privately reviewed JSONL exports.
// This command intentionally never fits the model on the answers it scores.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { localAnalysis } from "../server/analysis.mjs";
import { textKey } from "../shared/analysis.mjs";
import { LABELS } from "../shared/feedback.mjs";

export function evaluate(examples) {
  const distinct = new Map();
  for (const row of examples) {
    if (
      typeof row.text !== "string" ||
      !row.text.trim() ||
      !LABELS.includes(row.label)
    )
      throw new Error(
        "Each line needs a nonempty text and a positive, negative, neutral or mixed label.",
      );
    const key = textKey(row.text);
    const prior = distinct.get(key);
    if (prior && prior.label !== row.label) prior.conflict = true;
    else if (!prior) distinct.set(key, { text: row.text, label: row.label });
  }
  const scored = [...distinct.values()]
    .filter((row) => !row.conflict)
    .map((row) => {
      const prediction = localAnalysis(row.text);
      return {
        truth: row.label,
        guess: prediction.label,
        language: prediction.language,
      };
    });
  function metrics(rows) {
    const correct = rows.filter((row) => row.guess === row.truth).length;
    const perLabel = {};
    for (const label of LABELS) {
      const actual = rows.filter((row) => row.truth === label).length;
      const predicted = rows.filter((row) => row.guess === label).length;
      const matches = rows.filter(
        (row) => row.truth === label && row.guess === label,
      ).length;
      perLabel[label] = {
        actual,
        predicted,
        correct: matches,
        f1: actual + predicted ? (2 * matches) / (actual + predicted) : null,
      };
    }
    const represented = Object.values(perLabel).filter((v) => v.actual);
    return {
      total: rows.length,
      correct,
      needs_review: rows.filter((row) => row.guess === "unreviewed").length,
      accuracy: rows.length ? correct / rows.length : null,
      macro_f1_on_present_labels: represented.length
        ? represented.reduce((s, v) => s + v.f1, 0) / represented.length
        : null,
      per_label: perLabel,
    };
  }
  const byLanguage = Object.fromEntries(
    [...new Set(scored.map((r) => r.language))].map((lang) => [
      lang,
      metrics(scored.filter((r) => r.language === lang)),
    ]),
  );
  return {
    input_rows: examples.length,
    excluded_conflicting_texts: [...distinct.values()].filter((r) => r.conflict)
      .length,
    overall: metrics(scored),
    by_language_hint: byLanguage,
  };
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    if (process.argv.length < 3)
      throw new Error(
        "Pass one or more held-out FeedWise correction JSONL files.",
      );
    const rows = [];
    for (const file of process.argv.slice(2)) {
      for (const [index, line] of readFileSync(file, "utf8")
        .split(/\r?\n/u)
        .entries()) {
        if (!line.trim()) continue;
        try {
          rows.push(JSON.parse(line));
        } catch {
          throw new Error(
            "Invalid JSON on line " + (index + 1) + " of " + file,
          );
        }
      }
    }
    if (!rows.length)
      throw new Error("The exports contain no reviewed comments.");
    console.log(JSON.stringify(evaluate(rows), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
