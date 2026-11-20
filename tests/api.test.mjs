import { test } from "node:test";
import assert from "node:assert/strict";
import { textKey } from "../shared/analysis.mjs";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { openDatabase } from "../server/database.mjs";
import { handleAPI } from "../server/service.mjs";
import { predict, predictRaw, topics, toCSV } from "../server/inference.mjs";

const database = () => openDatabase(":memory:");
const call = (db, path, method = "GET", data, key = "") =>
  handleAPI(
    new Request("https://feedwise.test/api/" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: "Bearer " + key } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
    db,
  );
const create = async (db, title = "Database lecture") => {
  const res = await call(db, "sessions", "POST", {
    title,
    prompt: "What helped you learn?",
  });
  assert.equal(res.status, 201);
  return res.json();
};
const submit = async (
  db,
  session,
  comment = "The lecturer explains the concepts clearly",
  receipt = crypto.randomUUID(),
) => {
  const res = await call(db, "feedback", "POST", {
    publicToken: session.publicToken,
    comment,
    rating: 5,
    receipt,
  });
  return { res, receipt };
};

test("web inference exactly matches exported sklearn prediction/probability cases", () => {
  const cases = JSON.parse(
    readFileSync(new URL("./model-parity.json", import.meta.url), "utf8"),
  );
  for (const row of cases) {
    const actual = predictRaw(row.text);
    assert.equal(actual.label, row.label);
    assert.ok(Math.abs(actual.probability - row.probability) < 1e-12, row.text);
  }
});
test("multi-topic matches and CSV formula escaping", () => {
  assert.ok(topics("The lecturer explains too fast in the lab").length >= 3);
  assert.deepEqual(topics("The syllabus"), ["Other feedback"]);
  const csv = toCSV([
    {
      id: "1",
      comment: "=SUM(A1)",
      created_at: "date",
      human_label: null,
      ai_label: "negative",
    },
  ]);
  assert.ok(csv.includes("'=SUM(A1)"));
});
test("full no-login create -> submit -> private dashboard -> review -> close/reopen", async () => {
  const db = database(),
    s = await create(db);
  await submit(db, s);
  let res = await call(db, "dashboard", "GET", null, s.reviewToken);
  let d = await res.json();
  assert.equal(d.feedback.length, 1);
  assert.equal(d.feedback[0].rating, 5);
  assert.ok(d.feedback[0].ai_label);
  const id = d.feedback[0].id;
  res = await call(
    db,
    "review",
    "POST",
    { feedbackId: id, label: "mixed" },
    s.reviewToken,
  );
  assert.equal(res.status, 200);
  d = await (await call(db, "dashboard", "GET", null, s.reviewToken)).json();
  assert.equal(d.feedback[0].human_label, "mixed");
  assert.equal(d.history.length, 1);
  await call(db, "session", "PATCH", { isOpen: false }, s.reviewToken);
  assert.equal(
    (await submit(db, s, "Another specific comment")).res.status,
    409,
  );
  await call(db, "session", "PATCH", { isOpen: true }, s.reviewToken);
  assert.equal(
    (await submit(db, s, "Another specific comment")).res.status,
    201,
  );
});
test("public keys and other review keys cannot read or change someone else’s responses", async () => {
  const db = database(),
    a = await create(db),
    b = await create(db, "Other lecture");
  await submit(db, a);
  const own = await (
    await call(db, "dashboard", "GET", null, a.reviewToken)
  ).json();
  assert.equal(
    (await call(db, "dashboard", "GET", null, a.publicToken)).status,
    403,
  );
  const publicData = await (
    await call(db, "session?s=" + a.publicToken)
  ).json();
  assert.deepEqual(Object.keys(publicData.session).sort(), [
    "is_open",
    "prompt",
    "title",
  ]);
  assert.equal(
    (
      await call(
        db,
        "review",
        "POST",
        { feedbackId: own.feedback[0].id, label: "positive" },
        b.reviewToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call(db, "session", "PATCH", { isOpen: false }, a.publicToken))
      .status,
    403,
  );
  assert.notEqual(
    db.sqlite
      .prepare("SELECT review_hash FROM sessions WHERE public_token=?")
      .get(a.publicToken).review_hash,
    a.reviewToken,
  );
});
test("receipts are idempotent; different students may submit identical comments", async () => {
  const db = database(),
    a = await create(db),
    b = await create(db);
  const { receipt } = await submit(db, a);
  assert.equal((await submit(db, a, undefined, receipt)).res.status, 200);
  assert.equal((await submit(db, b, undefined, receipt)).res.status, 400);
  assert.equal((await submit(db, a)).res.status, 201);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM feedback").get().n, 2);
});
test("validation preserves storage and SQL-shaped strings are data", async () => {
  const db = database(),
    s = await create(db, "SQL'); DROP TABLE sessions; --");
  for (const comment of ["", "a", " ".repeat(20), "x".repeat(2001)])
    assert.equal((await submit(db, s, comment)).res.status, 400);
  for (const rating of [0, 6, true, 1.5])
    assert.equal(
      (
        await call(db, "feedback", "POST", {
          publicToken: s.publicToken,
          comment: "A valid example comment",
          rating,
          receipt: crypto.randomUUID(),
        })
      ).status,
      400,
    );
  assert.equal((await call(db, "session?s=invalid")).status, 404);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM sessions").get().n, 1);
});
test("each manual review appends history while current label changes", async () => {
  const db = database(),
    s = await create(db);
  await submit(db, s);
  const d = await (
    await call(db, "dashboard", "GET", null, s.reviewToken)
  ).json();
  for (const label of ["positive", "neutral", "mixed"])
    assert.equal(
      (
        await call(
          db,
          "review",
          "POST",
          { feedbackId: d.feedback[0].id, label },
          s.reviewToken,
        )
      ).status,
      200,
    );
  const final = await (
    await call(db, "dashboard", "GET", null, s.reviewToken)
  ).json();
  assert.equal(final.feedback[0].human_label, "mixed");
  assert.equal(final.history.length, 3);
  assert.equal(final.feedback[0].ai_label, d.feedback[0].ai_label);
});
test("reject cross-origin writes and invalid JSON; no error details leak", async () => {
  const db = database();
  const cross = new Request("https://feedwise.test/api/sessions", {
    method: "POST",
    headers: {
      Origin: "https://other.test",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal((await handleAPI(cross, db)).status, 403);
  const invalid = new Request("https://feedwise.test/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal((await handleAPI(invalid, db)).status, 400);
  assert.equal(
    (await handleAPI(new Request("https://feedwise.test/api/session"), null))
      .status,
    503,
  );
});

test("common typing mistakes, negation, mixed clauses and unsupported scripts", () => {
  for (const text of [
    "very good",
    "verry good",
    "very goood",
    "very gud",
    "not bad",
  ])
    assert.equal(predict(text).label, "positive", text);
  assert.equal(predict("not good").label, "negative");
  assert.equal(
    predict(
      "The explanations were clear but the practical sessions were rushed.",
    ).label,
    "mixed",
  );
  assert.equal(
    predict("The lecturer explains clearly. The labs need more time.").label,
    "mixed",
  );
  assert.equal(predict("இந்த வகுப்பு நல்லது").label, "unreviewed");
});
test("short feedback, neutral/mixed labels and two identical student comments persist", async () => {
  const db = database(),
    s = await create(db);
  for (const text of [
    "very good",
    "very good",
    "not good",
    "The explanations were clear but the practical sessions were rushed.",
    "இந்த வகுப்பு நல்லது",
  ])
    assert.equal((await submit(db, s, text)).res.status, 201);
  const result = await (
    await call(db, "dashboard", "GET", null, s.reviewToken)
  ).json();
  assert.equal(result.feedback.length, 5);
  assert.equal(result.model.samples, 4684);
  assert.ok(result.feedback.some((r) => r.ai_label === "mixed"));
  assert.equal(result.feedback.find((r) => r.comment === "இந்த வகுப்பு நல்லது").analysis.label, "positive");
});
test("schema upgrade retains existing comments, predictions and all human review history", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.function("feedwise_text_key", { deterministic: true }, textKey);
  sqlite.exec("PRAGMA foreign_keys=ON");
  const migrations = readdirSync(
    new URL("../database/migrations/", import.meta.url),
  )
    .filter((f) => f.endsWith(".sql"))
    .sort();
  sqlite.exec(
    readFileSync(
      new URL("../database/migrations/" + migrations[0], import.meta.url),
      "utf8",
    ),
  );
  sqlite.exec(
    "INSERT INTO sessions(id,title,prompt,public_token,review_hash) VALUES('s','Test','','pub','hash'); INSERT INTO feedback(id,session_id,comment,receipt) VALUES('f','s','Original feedback comment','receipt'); INSERT INTO predictions VALUES('f','old-model','positive',.7); INSERT INTO reviews(feedback_id,label) VALUES('f','mixed'); INSERT INTO review_history(id,feedback_id,label) VALUES('h','f','mixed');",
  );
  for (const filename of migrations.slice(1)) {
    sqlite.exec("BEGIN");
    sqlite.exec(
      readFileSync(
        new URL("../database/migrations/" + filename, import.meta.url),
        "utf8",
      ),
    );
    sqlite.exec("COMMIT");
  }
  for (const table of [
    "sessions",
    "feedback",
    "predictions",
    "reviews",
    "review_history",
  ])
    assert.equal(
      sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,
      1,
      table,
    );
  assert.equal(
    sqlite.prepare("SELECT comment FROM feedback").get().comment,
    "Original feedback comment",
  );
  const imported = sqlite.prepare("SELECT text_key,label FROM correction_memory").get();
  assert.equal(imported.text_key, "original feedback comment");
  assert.equal(imported.label, "mixed");
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.exec(
    "INSERT INTO feedback(id,session_id,comment,receipt) VALUES('f2','s','ok','receipt2'); INSERT INTO predictions VALUES('f2','new-model','neutral',.6)",
  );
});
