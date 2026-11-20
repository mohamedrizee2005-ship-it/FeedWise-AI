import {
  TOPICS,
  analysePhrases,
  textKey,
  topicIds,
  withHumanLabel,
} from "./analysis.mjs";

export const LABELS = ["positive", "negative", "neutral", "mixed"];
export const DISPLAY_LABELS = [...LABELS, "unreviewed"];
export const effectiveLabel = (row) =>
  row.human_label || row.analysis?.label || row.ai_label || "unreviewed";
const names = {
  clarity: "Teaching clarity",
  pace: "Teaching pace",
  practical: "Practical work",
  assessment: "Assignment guidance",
  resources: "Learning resources",
  communication: "Communication",
  environment: "Classroom environment",
  other: "Other feedback",
};
export const topics = (text) => topicIds(text).map((id) => names[id]);

function evidence(row) {
  const analysis = row.analysis || {
    ...analysePhrases(row.comment),
    suggestions: [],
    label: effectiveLabel(row),
  };
  return row.human_label
    ? withHumanLabel(analysis, row.comment, row.human_label, "human")
    : analysis;
}
function actionFor(item) {
  if (item.topic === "pace") {
    if (/too slow|slowly|மிக மெதுவாக|වේගය අඩු/iu.test(item.quote))
      return "paceSlow";
    if (
      /too fast|rushed|slow down|மிக வேகமாக|வேகமாக|மெதுவாக|වේගය වැඩි|හෙමින්/iu.test(
        item.quote,
      )
    )
      return "paceFast";
  }
  return item.topic;
}

export function summarize(rows) {
  const counts = Object.fromEntries(DISPLAY_LABELS.map((label) => [label, 0]));
  const topicRows = new Map(
    TOPICS.map((id) => [id, { id, topic: names[id], count: 0, concerns: 0 }]),
  );
  const strengths = new Map();
  const actions = new Map();
  let unresolved = 0;
  for (const row of rows) {
    const label = effectiveLabel(row);
    const analysis = evidence(row);
    counts[label]++;
    if (
      label === "unreviewed" ||
      (!analysis.concerns.length &&
        (label === "mixed" || (!row.human_label && analysis.needsReview)))
    )
      unresolved++;
    for (const item of analysis.strengths)
      strengths.set(textKey(item.quote), { id: row.id, ...item });
    const concerns = new Set(analysis.concerns.map((item) => item.topic));
    const mentions = new Set([
      ...topicIds(row.comment),
      ...analysis.strengths.map((item) => item.topic),
      ...concerns,
    ]);
    for (const topic of mentions) topicRows.get(topic).count++;
    for (const topic of concerns) topicRows.get(topic).concerns++;
    const counted = new Set();
    for (const item of analysis.concerns) {
      const action = actionFor(item);
      const suggestion = ["paceSlow", "paceFast"].includes(action)
        ? null
        : analysis.suggestions?.find(
            (s) => s.quote === item.quote && s.topic === item.topic,
          );
      const key = suggestion ? action + "/" + suggestion.action : action;
      if (!actions.has(key))
        actions.set(key, {
          key,
          topic: item.topic,
          action,
          suggestion: suggestion?.action,
          count: 0,
          quotes: [],
        });
      const group = actions.get(key);
      if (!counted.has(key)) group.count++;
      counted.add(key);
      if (group.quotes.length < 2 && !group.quotes.includes(item.quote))
        group.quotes.push(item.quote);
    }
  }
  return {
    counts,
    unresolved,
    strengths: [...strengths.values()].slice(0, 4),
    actions: [...actions.values()].sort((a, b) => b.count - a.count),
    topicRows: [...topicRows.values()]
      .filter((t) => t.count)
      .sort((a, b) => b.count - a.count),
  };
}
export function safeCell(value) {
  const text = String(value ?? "");
  return /^\s*[=+\-@]/u.test(text) ? "'" + text : text;
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
    "decision_source",
    "language_hint",
    "concern_quotes",
  ];
  const records = rows.map((r) => [
    r.id,
    r.created_at,
    r.comment,
    r.rating,
    r.ai_label,
    r.probability || "",
    r.human_label,
    effectiveLabel(r),
    topics(r.comment).join(", "),
    r.model_version,
    r.analysis?.source,
    r.analysis?.language,
    evidence(r)
      .concerns.map((x) => x.quote)
      .join(" | "),
  ]);
  const escape = (value) => '"' + safeCell(value).replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [header, ...records].map((row) => row.map(escape).join(",")).join("\r\n")
  );
}
