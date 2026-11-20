import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { localAnalysis } from "../server/analysis.mjs";
import { openDatabase } from "../server/database.mjs";
import { handleAPI } from "../server/service.mjs";
import { createLocalAI, validateAI } from "../server/local-ai.mjs";
import {
  classDecision,
  learnedDecision,
  trainCorrections,
} from "../server/learning.mjs";
import { textKey, topicIds } from "../shared/analysis.mjs";
import { summarize } from "../shared/feedback.mjs";
import { evaluate } from "../training/evaluate_corrections.mjs";

const fixtures = [
  [
    "English",
    [
      ["very goood", "positive"],
      ["very gud", "positive"],
      ["not good", "negative"],
      ["not bad", "positive"],
      ["The examples were clear but please slow down.", "mixed"],
      ["Could we have more examples?", "negative"],
      ["Please explain more clearly.", "negative"],
      ["The class started at 9 am.", "neutral"],
      ["The slides were too small to read.", "negative"],
      ["The notes were useful. The room was noisy.", "mixed"],
    ],
  ],
  [
    "Tamil",
    [
      ["இந்த வகுப்பு நல்லது", "positive"],
      ["விளக்கம் தெளிவாக இல்லை", "negative"],
      ["விளக்கம் நன்றாக இருந்தது. ஆனால் இன்னும் பயிற்சிகள் வேண்டும்.", "mixed"],
      ["இன்று வகுப்பு நடந்தது", "neutral"],
      ["இன்னும் உதாரணங்கள் வேண்டும்", "negative"],
      ["புரியவில்லை", "negative"],
    ],
  ],
  [
    "Sinhala",
    [
      ["පන්තිය හොඳයි", "positive"],
      ["පැහැදිලි නැහැ", "negative"],
      ["පාඩම හොඳයි නමුත් වේගය වැඩියි", "mixed"],
      ["කරුණාකර තව උදාහරණ දෙන්න.", "negative"],
      ["පන්තිය නවයට පටන් ගත්තා", "neutral"],
      ["අපැහැදිලි", "negative"],
    ],
  ],
  [
    "Code-mixed and transliterated",
    [
      ["Slides நல்லா இருந்தது, but the lab was too fast.", "mixed"],
      ["Lab එක හොඳයි but rushed.", "mixed"],
      ["hondai but too fast", "mixed"],
      ["nalla", "positive"],
      ["puriyala", "negative"],
      ["123???", "unreviewed"],
    ],
  ],
];
for (const [group, cases] of fixtures)
  test(group + " feedback cases keep original evidence", () => {
    for (const [comment, label] of cases) {
      const analysis = localAnalysis(comment);
      assert.equal(analysis.label, label, comment);
      for (const item of [...analysis.strengths, ...analysis.concerns])
        assert.ok(comment.includes(item.quote));
    }
  });
test("improvements count actual problems by response and preserve opposite pacing requests", () => {
  const texts = [
    "The examples were clear but the lab was too fast.",
    "The slides were too small.",
    "The pace was too slow.",
    "The pace was too slow.",
  ];
  const rows = texts.map((comment, id) => ({
    id,
    comment,
    analysis: localAnalysis(comment),
  }));
  const summary = summarize(rows);
  assert.equal(summary.counts.mixed, 1);
  assert.equal(summary.topicRows.find((r) => r.id === "clarity").concerns, 0);
  assert.equal(summary.actions.find((r) => r.action === "paceSlow").count, 2);
  assert.equal(
    summary.actions.find((r) => r.action === "paceSlow").quotes.length,
    1,
  );
  assert.equal(summary.actions.find((r) => r.action === "paceFast").count, 1);
  assert.ok(
    summary.strengths.some((s) => s.quote === "The examples were clear"),
  );
  assert.equal(
    summarize([{ id: 1, comment: "எதுவோ", analysis: localAnalysis("எதுவோ") }])
      .unresolved,
    1,
  );
  assert.deepEqual(topicIds("sometimes"), ["other"]);
});
function api(db, route, token = "", data, ai) {
  return handleAPI(
    new Request("http://localhost/api/" + route, {
      method: data ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    }),
    db,
    ai ? { ai } : undefined,
  );
}
const create = async (db) =>
  (await api(db, "sessions", "", { title: "Test class" })).json();
const send = (db, s, comment, receipt = crypto.randomUUID()) =>
  api(db, "feedback", "", { publicToken: s.publicToken, comment, receipt });
const dashboard = async (db, s) =>
  (await api(db, "dashboard", s.reviewToken)).json();
const mark = (db, s, id, label) =>
  api(db, "review", s.reviewToken, { feedbackId: id, label });

test("corrections survive restart, apply to repeated wording, accept revisions and stay inside the class", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "feedwise-learning-")),
    filename = path.join(folder, "test.sqlite");
  let db = openDatabase(filename);
  try {
    const a = await create(db),
      b = await create(db),
      comment = "The slides were blurry.";
    await send(db, a, comment);
    const first = (await dashboard(db, a)).feedback[0];
    assert.equal(first.ai_label, "negative");
    assert.equal((await mark(db, a, first.id, "positive")).status, 200);
    db.close();
    db = openDatabase(filename);
    await send(db, a, " THE  SLIDES were BLURRY!! ");
    await send(db, b, comment);
    const response = (await dashboard(db, a)).feedback.find(
      (r) => !r.human_label,
    );
    assert.equal(response.analysis.label, "positive");
    assert.equal(response.analysis.source, "correction");
    assert.equal(response.ai_label, "negative");
    assert.equal(
      (await dashboard(db, b)).feedback[0].analysis.label,
      "negative",
    );
    await mark(db, a, first.id, "neutral");
    await send(db, a, comment);
    const result = await dashboard(db, a);
    assert.equal(result.learning.examples, 1);
    assert.equal(result.history.length, 2);
    assert.ok(result.feedback.every((r) => r.analysis.label === "neutral"));
    const exported = await api(db, "training-data", a.reviewToken);
    assert.equal(
      exported.headers.get("content-type"),
      "application/x-ndjson; charset=utf-8",
    );
    const record = JSON.parse(await exported.text());
    assert.equal(record.label, "neutral");
    assert.equal(record.text, comment);
    assert.equal(
      await (await api(db, "training-data", b.reviewToken)).text(),
      "",
    );
    for (const route of ["training-data", "ai"])
      assert.equal((await api(db, route, a.publicToken)).status, 403);
    assert.equal(
      (await api(db, "analyse", b.reviewToken, { feedbackId: first.id }))
        .status,
      403,
    );
  } finally {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
test("class learner fits similar wording conservatively and invalidates a cached model after a correction", async () => {
  const db = openDatabase(":memory:");
  try {
    const a = await create(db),
      examples = [
        ["crystal mosaic walkthrough", "positive"],
        ["crystal mosaic walkthrough today", "positive"],
        ["crystal mosaic walkthrough again", "positive"],
        ["tangled nested loops", "negative"],
        ["tangled nested loops today", "negative"],
        ["tangled nested loops again", "negative"],
      ];
    for (const [text, label] of examples) {
      await send(db, a, text);
      const row = (await dashboard(db, a)).feedback.find(
        (r) => r.comment === text,
      );
      await mark(db, a, row.id, label);
    }
    const id = (await dashboard(db, a)).session.id;
    assert.equal(
      (await classDecision(db, id, "crystal mosaic walkthrough please")).source,
      "learner",
    );
    await send(db, a, "crystal mosaic walkthrough please");
    assert.equal(
      (await dashboard(db, a)).feedback.find((r) =>
        r.comment.endsWith("please"),
      ).analysis.source,
      "learner",
    );
    assert.equal(
      await classDecision(db, id, "not crystal mosaic walkthrough please"),
      null,
    );
    assert.equal(
      await classDecision(db, id, "completely unrelated acoustics"),
      null,
    );
    const model = trainCorrections(
      examples
        .slice(0, 5)
        .map(([original_text, label]) => ({ original_text, label })),
    );
    assert.equal(
      learnedDecision("crystal mosaic walkthrough please", model),
      null,
    );
    assert.equal(textKey("  GOOD!  "), "good");
    for (const row of (await dashboard(db, a)).feedback.filter(
      (r) => r.human_label === "positive",
    ))
      await mark(db, a, row.id, "negative");
    assert.equal(
      await classDecision(db, id, "crystal mosaic walkthrough please"),
      null,
    );
  } finally {
    db.close();
  }
});
test("simultaneous receipts and full classes leave no orphan analyses", async () => {
  const db = openDatabase(":memory:");
  try {
    const a = await create(db),
      first = crypto.randomUUID(),
      text = "repeatable response";
    const sent = await Promise.all([
      send(db, a, text, first),
      send(db, a, text, first),
    ]);
    assert.ok(sent.every((r) => [200, 201].includes(r.status)));
    const id = (await dashboard(db, a)).session.id;
    const insert = db.sqlite.prepare(
      "INSERT INTO feedback(id,session_id,comment,receipt) VALUES(?,?,?,?)",
    );
    for (let i = 1; i < 1000; i++)
      insert.run("fixture" + i, id, "fixture", "fixture" + i);
    assert.equal((await send(db, a, text)).status, 409);
    for (const table of ["feedback_analyses", "predictions"])
      assert.equal(
        db.sqlite.prepare("SELECT COUNT(*) AS n FROM " + table).get().n,
        1,
      );
    assert.equal((await send(db, a, text, first)).status, 200);
  } finally {
    db.close();
  }
});
const finding = (part, kind, topic, action = "") => ({
  part,
  kind,
  topic,
  action,
});
test("structured local analysis only quotes existing parts and keeps explicit Sinhala requests", () => {
  const part = "කරුණාකර තව උදාහරණ දෙන්න";
  const value = validateAI(
    { label: "positive", findings: [finding(1, "strength", "other")] },
    [part],
    part,
    "gemma3:4b",
  );
  assert.equal(value.label, "negative");
  assert.deepEqual(value.concerns, [{ quote: part, topic: "clarity" }]);
  assert.deepEqual(value.strengths, []);
  assert.throws(() =>
    validateAI(
      { label: "mixed", findings: [finding(3, "concern", "pace")] },
      [part],
      part,
      "gemma3:4b",
    ),
  );
  assert.throws(() =>
    validateAI(
      { label: "positive", findings: [] },
      ["The theatre echoes"],
      "The theatre echoes",
      "gemma3:4b",
    ),
  );
});
test("local AI handles offline, missing model, malformed data and only accepts loopback", async () => {
  const mock = (f) => createLocalAI({ fetchImpl: f });
  assert.throws(() => createLocalAI({ baseURL: "https://example.org" }));
  assert.throws(() => createLocalAI({ model: "example:cloud" }));
  const unavailable = mock(async () => {
    throw Error("offline");
  });
  assert.equal((await unavailable.status()).state, "offline");
  assert.equal(
    (await mock(async () => Response.json({ models: [] })).status()).state,
    "model_missing",
  );
  const seen = [];
  const broken = mock(async (url, init) => {
    seen.push(url.pathname);
    if (url.pathname === "/api/tags")
      return Response.json({ models: [{ name: "gemma3:4b" }] });
    assert.equal(init.redirect, "error");
    return Response.json({ message: { content: "{" } });
  });
  await assert.rejects(broken.analyse("A test comment"));
  await assert.rejects(broken.analyse("Another comment"));
  assert.deepEqual(seen, ["/api/tags", "/api/chat", "/api/tags", "/api/chat"]);
});
test("in-flight deep analysis respects a newer lecturer correction; failed inference preserves results", async () => {
  const db = openDatabase(":memory:");
  try {
    const a = await create(db),
      comment = "Unusual phrasing in this class";
    await send(db, a, comment);
    const row = (await dashboard(db, a)).feedback[0],
      payload = { feedbackId: row.id };
    const bad = await api(db, "analyse", a.reviewToken, payload, {
      analyse: async () => {
        throw Error("offline");
      },
    });
    assert.equal(bad.status, 503);
    assert.equal(
      (await dashboard(db, a)).feedback[0].analysis.source,
      row.analysis.source,
    );
    let started, finish;
    const waiting = new Promise((res) => {
      started = res;
    });
    const fake = {
      analyse: async () => {
        started();
        return new Promise((res) => {
          finish = res;
        });
      },
    };
    const pending = api(db, "analyse", a.reviewToken, payload, fake);
    await waiting;
    await mark(db, a, row.id, "positive");
    finish({ ...localAnalysis(comment), label: "negative", source: "ollama" });
    assert.equal((await (await pending).json()).analysis.label, "positive");
    assert.equal((await dashboard(db, a)).feedback[0].analysis.source, "human");
  } finally {
    db.close();
  }
});
test("completed language-model analysis is reused without another inference", async () => {
  const db = openDatabase(":memory:");
  try {
    const a = await create(db),
      comment = "The theatre echoes.";
    await send(db, a, comment);
    const id = (await dashboard(db, a)).feedback[0].id;
    let calls = 0;
    const ai = {
      analyse: async () => {
        calls++;
        return validateAI(
          {
            label: "negative",
            findings: [
              finding(
                1,
                "concern",
                "environment",
                "Check the classroom audio.",
              ),
            ],
          },
          [comment],
          comment,
          "gemma3:4b",
        );
      },
    };
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await api(db, "analyse", a.reviewToken, { feedbackId: id }, ai))
          .status,
        200,
      );
    assert.equal(calls, 1);
    await mark(db, a, id, "negative");
    assert.equal(
      (await dashboard(db, a)).feedback[0].analysis.suggestions[0].action,
      "Check the classroom audio.",
    );
  } finally {
    db.close();
  }
});
test("held-out evaluation deduplicates texts, reports conflicts and counts abstentions", () => {
  const r = evaluate([
    { text: "good", label: "positive" },
    { text: "Good!", label: "positive" },
    { text: "12345", label: "neutral" },
    { text: "odd", label: "neutral" },
    { text: "odd", label: "negative" },
  ]);
  assert.equal(r.overall.total, 2);
  assert.equal(r.excluded_conflicting_texts, 1);
  assert.equal(r.overall.correct, 1);
  assert.equal(r.overall.needs_review, 1);
});
