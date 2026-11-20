// Fast, inspectable phrase analysis. This is not a multilingual neural model.
export const ANALYSIS_VERSION = "feedwise-hybrid-3";
export const TOPICS = [
  "clarity",
  "pace",
  "practical",
  "assessment",
  "resources",
  "communication",
  "environment",
  "other",
];
export function textKey(text) {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[’‘]/gu, "'")
      .replace(/\s+/gu, " ")
      .trim()
      .replace(/[.!?。！？]+$/gu, "")
      .trim() || text.trim()
  );
}
export function languageOf(text) {
  const ta = (text.match(/\p{Script=Tamil}/gu) || []).length;
  const si = (text.match(/\p{Script=Sinhala}/gu) || []).length;
  const en = (text.match(/[a-z]/giu) || []).length;
  if ((ta && si) || ((ta || si) && en > 3)) return "mul";
  if (ta) return "ta";
  if (si) return "si";
  const romanTamil = /\b(?:nalla|nallaa|puriyala|puriyavillai)\b/iu.test(text);
  const romanSinhala = /\b(?:hodai|hondai|pahadili|amarui|therenne)\b/iu.test(
    text,
  );
  const englishWords =
    /\b(?:class|slides?|lecture|examples?|but|good|lab)\b/iu.test(text);
  if (
    (romanTamil && romanSinhala) ||
    ((romanTamil || romanSinhala) && englishWords)
  )
    return "mul";
  if (romanTamil) return "ta";
  if (romanSinhala) return "si";
  return en > 1 && en >= (text.match(/\p{L}/gu) || []).length * 0.65
    ? "en"
    : "unknown";
}
const topicTerms = {
  clarity: [
    "explain",
    "explanation",
    "clear",
    "confus",
    "understand",
    "example",
    "concept",
    "விளக்கம்",
    "விளக்க",
    "தெளிவ",
    "புரிய",
    "உதாரண",
    "පැහැදිලි",
    "තේර",
    "උදාහරණ",
    "පැහැදිල",
    "puriy",
    "pahadili",
  ],
  pace: [
    "pace",
    "fast",
    "slow",
    "rushed",
    "speed",
    "time",
    "quick",
    "வேக",
    "மெதுவ",
    "நேரம்",
    "වෙලාව",
    "වේග",
    "කාලය",
    "හෙමින්",
  ],
  practical: [
    "practical",
    "lab",
    "hands-on",
    "practice",
    "demonstration",
    "செய்முறை",
    "பயிற்சி",
    "ප්‍රායෝගික",
    "පුහුණු",
  ],
  assessment: [
    "assignment",
    "deadline",
    "marking",
    "criteria",
    "workload",
    "exam",
    "மதிப்பெண்",
    "தேர்வு",
    "ஒப்படை",
    "පැවරු",
    "විභාග",
    "ලකුණු",
  ],
  resources: [
    "slide",
    "note",
    "material",
    "resource",
    "outdated",
    "குறிப்பு",
    "பாடக்குறிப்",
    "குறிப்புகள்",
    "සටහන්",
    "විනිවිදක",
    "පොත්",
  ],
  communication: [
    "question",
    "respond",
    "support",
    "communication",
    "answer",
    "கேள்வி",
    "பதில்",
    "උත්තර",
    "ප්‍රශ්න",
    "සන්නිවේදන",
  ],
  environment: [
    "room",
    "sound",
    "microphone",
    "projector",
    "noise",
    "noisy",
    "audio",
    "அறை",
    "சத்தம்",
    "ஒலி",
    "කාමර",
    "ශබ්ද",
    "මයික්",
  ],
};
export function topicIds(text) {
  const key = textKey(text);
  const found = Object.entries(topicTerms)
    .filter(([, words]) =>
      words.some((w) => {
        if (!/^[a-z-]+$/.test(w)) return key.includes(w);
        // Stems match inflections but never the middle of an unrelated word.
        return new RegExp(
          "\\b" +
            w +
            (w === "exam" ? "(?:s|ination)?\\b" : w === "time" ? "s?\\b" : ""),
        ).test(key);
      }),
    )
    .map(([id]) => id);
  return found.length ? found : ["other"];
}
const positive = [
  "good",
  "great",
  "excellent",
  "clear",
  "clearly",
  "helpful",
  "useful",
  "enjoyed",
  "interesting",
  "engaging",
  "understandable",
  "well explained",
  "supportive",
  "gud",
  "நல்லது",
  "நன்றாகவும்",
  "தெளிவாகவும்",
  "பயனுள்ள",
  "நன்றாகப்",
  "நன்றாகப் புரிந்தது",
  "நல்ல",
  "நல்லா",
  "நன்றாக",
  "நன்று",
  "அருமை",
  "அருமையாக",
  "தெளிவாக",
  "பயனுள்ளதாக",
  "புரிந்தது",
  "சிறப்பாக",
  "பிடித்தது",
  "புரிகிறது",
  "හොඳට",
  "පැහැදිලියි",
  "හොඳයි",
  "හොදයි",
  "හොඳ",
  "හොද",
  "පැහැදිලි",
  "ප්‍රයෝජනවත්",
  "කදිමයි",
  "විශිෂ්ට",
  "තේරුණා",
  "තේරෙනවා",
  "nalla",
  "nallaa",
  "hodai",
  "hondai",
  "pahadili",
];
const negative = [
  "bad",
  "poor",
  "confusing",
  "unclear",
  "boring",
  "rushed",
  "difficult",
  "terrible",
  "outdated",
  "unhelpful",
  "insufficient",
  "hard to follow",
  "ran out of time",
  "could not finish",
  "too fast",
  "too slow",
  "too much",
  "too quick",
  "too small",
  "too quiet",
  "too loud",
  "noisy",
  "blurry",
  "inaudible",
  "hard to read",
  "hard to hear",
  "could not hear",
  "couldn't hear",
  "could not see",
  "unreadable",
  "cannot understand",
  "can't understand",
  "not enough",
  "lack of",
  "முடியவில்லை",
  "மோசம்",
  "மோசமாக",
  "புரியவில்லை",
  "புரியல",
  "குழப்பமாக",
  "கடினமாக",
  "பயனில்லை",
  "தெளிவில்லை",
  "சலிப்பாக",
  "போதவில்லை",
  "மிக வேகமாக",
  "මදි",
  "නරකයි",
  "නරක",
  "අපැහැදිලි",
  "තේරෙන්නේ නැහැ",
  "තේරුණේ නැහැ",
  "තේරෙන්නෙ නෑ",
  "අමාරුයි",
  "අපහසුයි",
  "කම්මැලි",
  "ප්‍රමාණවත් නැහැ",
  "වේගය වැඩියි",
  "වේගය වැඩිය",
  "වේගය වැඩී",
  "puriyala",
  "puriyavillai",
  "amarui",
  "therenne na",
];
const negationBefore =
  /\b(?:not|never|isn't|wasn't|aren't|weren't|hardly|no)\s+(?:(?:very|really|at all|that|so|particularly|quite)\s+){0,2}$/u;
const negationAfter = /^\s*(?:இல்லை|இல்ல|නැහැ|නෑ|නොවේ)(?:\s|[.!?,]|$)/u;
function evidence(text, words) {
  const key = textKey(text).replace(/([a-z])\1{2,}/gu, "$1$1");
  const found = [];
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(
      `(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`,
      "gu",
    );
    for (const match of key.matchAll(expression)) {
      const before = key.slice(Math.max(0, match.index - 45), match.index);
      const after = key.slice(match.index + word.length);
      found.push({
        inverted: negationBefore.test(before) || negationAfter.test(after),
      });
    }
  }
  return found;
}
const requestPattern =
  /\b(?:need(?:s)? (?:more|better)|please (?:add|provide|explain|slow|give|improve|share)|should (?:add|provide|explain|slow|give|improve)|more (?:examples|practice|time|exercises|labs)|(?:would|could) (?:you |we )?(?:use|have|share|include|give)|it would help|could (?:add|improve)|wish (?:we|there)|without (?:examples|notes))\b|(?:இன்னும்|மேலும்).{0,65}(?:வேண்டும்|தேவை)|(?:வேண்டும்|வேணும்|தேவை)|(?:கொடுக்க|சேர்க்க|விளக்க).{0,25}(?:வேண்டும்|வும்)|(?:තව|වැඩි).{0,65}(?:ඕන|අවශ්‍ය|දෙන්න)|(?:දෙන්න|කරුණාකර|අවශ්‍යයි|ඕනෑ)|(?:හෙමින්|අඩු).{0,30}(?:කරන්න|කියන්න)/iu;
const noConcern =
  /\b(?:no (?:issues|problems|concerns)|nothing to improve|not bad)\b|பிரச்சனை இல்லை|மாற்றம் தேவையில்லை|ගැටලුවක් නැහැ|වෙනස්කම් අවශ්‍ය නැහැ/iu;
export const isRequest = (quote) =>
  requestPattern.test(quote) &&
  !noConcern.test(quote) &&
  !/\b(?:do not|don't|no need to) (?:need|add|provide|explain)|தேவை(?:யே)? இல்லை|தேவையில்லை|අවශ්‍ය (?:නැහැ|නෑ)/iu.test(
    quote,
  );
export function splitClauses(text) {
  return text
    .split(
      /(?:[.!?;。！？\n]+|\b(?:but|however|although|though|whereas|yet)\b|ஆனால்|ஆனாலும்|ஆனா\s|නමුත්|හැබැයි|ඒත්)/iu,
    )
    .map((quote) =>
      quote
        .trim()
        .replace(/[,،]+$/u, "")
        .trim(),
    )
    .filter(Boolean);
}
const explicitPace =
  /\btoo (?:fast|slow|quick)|\brushed\b|\bslow down\b|மிக வேகமாக|வேகத்தை|වේගය වැඩි|හෙමින්/iu;
export function isFactual(text) {
  return /^(?:the (?:class|lecture) (?:started|ended) at [0-9:. ]+(?:am|pm)?|வகுப்பு (?:இன்று நடந்தது|காலை .{1,16} மணிக்குத் தொடங்கியது)|இன்று வகுப்பு நடந்தது|පන්තිය .{1,15} පටන් ගත්තා)$/iu.test(
    textKey(text),
  );
}
export function analysePhrases(comment) {
  const strengths = [],
    concerns = [];
  let unclearParts = 0;
  for (const quote of splitClauses(comment)) {
    const p = evidence(quote, positive),
      n = evidence(quote, negative);
    const request = isRequest(quote);
    const praise =
      p.some((x) => !x.inverted) &&
      !(request && /^(?:please|could (?:you|we)|කරුණාකර)/iu.test(quote));
    const pos = praise || n.some((x) => x.inverted) || noConcern.test(quote);
    const neg =
      p.some((x) => x.inverted) || n.some((x) => !x.inverted) || request;
    const matched = topicIds(quote);
    // Avoid pretending a multi-topic clause identifies which topic was criticised.
    const topic = explicitPace.test(quote)
      ? "pace"
      : matched.length === 1
        ? matched[0]
        : "other";
    if (pos) strengths.push({ quote, topic });
    if (neg) concerns.push({ quote, topic });
    if (!pos && !neg && !isFactual(quote)) unclearParts++;
  }
  return { strengths, concerns, unclearParts };
}
export function withHumanLabel(
  analysis,
  comment,
  label,
  source = "correction",
) {
  const topics = topicIds(comment);
  const full = {
    quote: comment,
    topic: topics.length === 1 ? topics[0] : "other",
  };
  const strengths = ["positive", "mixed"].includes(label)
    ? analysis.strengths
    : [];
  const concerns = ["negative", "mixed"].includes(label)
    ? analysis.concerns
    : [];
  return {
    ...analysis,
    label,
    source,
    needsReview: false,
    strengths: label === "positive" && !strengths.length ? [full] : strengths,
    concerns: label === "negative" && !concerns.length ? [full] : concerns,
    suggestions: (analysis.suggestions || []).filter((s) =>
      concerns.some((c) => c.quote === s.quote && c.topic === s.topic),
    ),
    reason: "A lecturer correction determines this decision.",
  };
}
