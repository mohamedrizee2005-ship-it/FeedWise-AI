import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import http from "node:http";
import { openDatabase } from "../server/database.mjs";
import { createAppServer } from "../server/http.mjs";
import { handleAPI } from "../server/service.mjs";

async function createClass(db) {
  const res = await handleAPI(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Local persistence test" }),
    }),
    db,
  );
  assert.equal(res.status, 201);
  return res.json();
}

test("local database and private access survive a close/reopen without replaying migrations", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "feedwise-")),
    filename = path.join(folder, "feedback.sqlite");
  let db;
  try {
    db = openDatabase(filename);
    const session = await createClass(db);
    db.close();
    db = openDatabase(filename);
    const res = await handleAPI(
      new Request("http://localhost/api/dashboard", {
        headers: { Authorization: "Bearer " + session.reviewToken },
      }),
      db,
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).session.title, "Local persistence test");
    assert.equal(
      db.sqlite.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n,
      2,
    );
  } finally {
    db?.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("failed batch rolls back every statement", async () => {
  const db = openDatabase(":memory:");
  try {
    await createClass(db);
    await assert.rejects(
      db.batch([
        db.prepare("UPDATE sessions SET title=?").bind("Should roll back"),
        db
          .prepare("INSERT INTO reviews(feedback_id,label) VALUES(?,?)")
          .bind("missing-response", "positive"),
      ]),
    );
    assert.equal(
      db.sqlite.prepare("SELECT title FROM sessions").get().title,
      "Local persistence test",
    );
  } finally {
    db.close();
  }
});

test("an edited applied migration is detected before changing saved rows", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "feedwise-")),
    filename = path.join(folder, "feedback.sqlite");
  let db;
  try {
    db = openDatabase(filename);
    await createClass(db);
    db.sqlite.exec(
      "UPDATE schema_migrations SET sha256='wrong' WHERE name='0000_initial.sql'",
    );
    db.close();
    db = null;
    assert.throws(
      () => openDatabase(filename),
      /Applied database migration was changed/,
    );
  } finally {
    db?.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("HTTP server routes JSON, rejects foreign origins and does not serve source files", async () => {
  const db = openDatabase(":memory:"),
    server = createAppServer(db);
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = "http://127.0.0.1:" + server.address().port;
    const res = await fetch(origin + "/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ title: "HTTP test" }),
    });
    assert.equal(res.status, 201);
    const session = await res.json();
    const sent = await fetch(origin + "/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        publicToken: session.publicToken,
        comment: "very good",
        receipt: crypto.randomUUID(),
      }),
    });
    assert.equal(sent.status, 201);
    const dashboard = await fetch(origin + "/api/dashboard", {
      headers: { Authorization: "Bearer " + session.reviewToken },
    });
    assert.equal(dashboard.status, 200);
    assert.equal((await dashboard.json()).feedback[0].ai_label, "positive");
    const cross = await fetch(origin + "/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://unrelated.test",
      },
      body: "{}",
    });
    assert.equal(cross.status, 403);
    assert.equal((await fetch(origin + "/server/model.json")).status, 404);
    assert.equal((await fetch(origin + "/data/feedwise.sqlite")).status, 404);
    assert.equal((await fetch(origin + "/%2e%2e%2fpackage.json")).status, 403);
    assert.equal(
      (
        await fetch(origin + "/api/sessions", {
          method: "POST",
          body: "x".repeat(16001),
        })
      ).status,
      413,
    );
    const foreignHost = await new Promise((resolve, reject) => {
      const request = http.get(
        origin,
        { headers: { Host: "unrelated.test" } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      request.on("error", reject);
    });
    assert.equal(foreignHost, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
