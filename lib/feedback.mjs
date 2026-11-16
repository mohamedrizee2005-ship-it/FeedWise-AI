// Shared presentation helpers. No model weights or private data enter the browser bundle.
export const LABELS = ["positive", "negative", "neutral", "mixed"];
export const DISPLAY_LABELS = [...LABELS, "unreviewed"];
export const effectiveLabel = (row) =>
  row.human_label || row.ai_label || "unreviewed";
export const rules = {
  "Teaching clarity": [
    "unclear",
    "confusing",
    "complicated",
    "hard to follow",
    "explain",
    "explanation",
    "understand",
    "example",
  ],
  "Teaching pace": ["fast", "slow", "pace", "rushed", "speed"],
  "Practical work": ["practical", "lab", "hands-on", "demonstration"],
  "Assignment guidance": [
    "assignment",
    "deadline",
    "marking",
    "criteria",
    "workload",
  ],
  "Learning resources": ["slide", "note", "material", "resource", "outdated"],
  Communication: ["question", "feedback", "respond", "support", "guidance"],
};
export function topics(text) {
  const lower = text.toLowerCase();
  const found = Object.entries(rules)
    .filter(([, terms]) =>
      terms.some((term) =>
        new RegExp(`\\b${term}(?:s|ed|ing)?\\b`, "u").test(lower),
      ),
    )
    .map(([topic]) => topic);
  return found.length ? found : ["Other feedback"];
}
export function summarize(rows) {
  const counts = Object.fromEntries(
    DISPLAY_LABELS.map((label) => [
      label,
      rows.filter((r) => effectiveLabel(r) === label).length,
    ]),
  );
  const topicRows = Object.keys(rules)
    .map((topic) => {
      const matching = rows.filter((r) => topics(r.comment).includes(topic));
      return {
        topic,
        count: matching.length,
        concerns: matching.filter((r) =>
          ["negative", "mixed"].includes(effectiveLabel(r)),
        ).length,
      };
    })
    .filter((t) => t.count)
    .sort((a, b) => b.count - a.count);
  const pick = (labels) =>
    rows.filter((r) => labels.includes(effectiveLabel(r))).slice(0, 2);
  return {
    counts,
    topicRows,
    strengths: pick(["positive"]),
    improvements: pick(["negative", "mixed"]),
  };
}
export function safeCell(value) {
  const text = String(value ?? "");
  return /^[\s]*[=+\-@]/u.test(text) ? `'${text}` : text;
}
export function toCSV(rows) {
  const header = [
    "feedback_id",
    "created_at_utc",
    "comment",
    "rating",
    "ai_suggestion",
    "model_score",
    "human_label",
    "effective_label",
    "topics",
    "model_version",
  ];
  const quote = (value) => `"${safeCell(value).replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((r) => [
        r.id,
        r.created_at,
        r.comment,
        r.rating,
        r.ai_label,
        r.probability,
        r.human_label,
        effectiveLabel(r),
        topics(r.comment).join(", "),
        r.model_version,
      ]),
    ]
      .map((row) => row.map(quote).join(","))
      .join("\r\n")
  );
}
