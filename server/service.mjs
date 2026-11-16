import {
  predict,
  MODEL_VERSION,
  MODEL_EVALUATION,
  LABELS,
} from "./inference.mjs";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const length = (value) => (typeof value === "string" ? [...value].length : -1);
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export async function digest(value) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function owner(request, db) {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [a-f0-9]{64}$/.test(authorization)) return null;
  return db
    .prepare(
      "SELECT id,title,prompt,public_token,is_open,created_at FROM sessions WHERE review_hash=?",
    )
    .bind(await digest(authorization.slice(7)))
    .first();
}
async function body(request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Use a JSON request.");
  const text = await request.text();
  if (text.length > 16000) throw new Error("The request is too large.");
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid request.");
  return data;
}
export async function handleAPI(request, db) {
  if (!db)
    return response(
      { error: "Feedback storage is temporarily unavailable." },
      503,
    );
  const url = new URL(request.url),
    path = url.pathname;
  // JSON POST/PATCH plus same-origin checks prevent cross-site browser writes.
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin)
    return response({ error: "Use this app to submit your request." }, 403);
  try {
    if (path === "/api/sessions" && request.method === "POST") {
      const data = await body(request);
      const title =
        typeof data.title === "string"
          ? data.title.trim().replace(/\s+/gu, " ")
          : "";
      const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
      if (length(title) < 1 || length(title) > 100 || length(prompt) > 500)
        return response(
          {
            error:
              "Enter a lecture title of 1–100 characters. Instructions can contain up to 500 characters.",
          },
          400,
        );
      const publicToken = token(),
        reviewToken = token(),
        id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO sessions(id,title,prompt,public_token,review_hash) VALUES (?,?,?,?,?)",
        )
        .bind(id, title, prompt, publicToken, await digest(reviewToken))
        .run();
      return response({ publicToken, reviewToken, title }, 201);
    }
    if (path === "/api/session" && request.method === "GET") {
      const publicToken = url.searchParams.get("s") || "";
      if (!/^[a-f0-9]{64}$/.test(publicToken))
        return response({ error: "This feedback link is invalid." }, 404);
      const session = await db
        .prepare(
          "SELECT title,prompt,is_open FROM sessions WHERE public_token=?",
        )
        .bind(publicToken)
        .first();
      return session
        ? response({ session })
        : response({ error: "This feedback link is invalid." }, 404);
    }
    if (path === "/api/feedback" && request.method === "POST") {
      const data = await body(request),
        comment = typeof data.comment === "string" ? data.comment.trim() : "";
      if (length(comment) < 2 || length(comment) > 2000)
        return response(
          { error: "Write between 2 and 2,000 characters of feedback." },
          400,
        );
      if (
        data.rating !== null &&
        data.rating !== undefined &&
        (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5)
      )
        return response(
          { error: "Choose a rating from 1 to 5, or skip it." },
          400,
        );
      if (
        typeof data.receipt !== "string" ||
        !/^[-a-zA-Z0-9_]{16,100}$/.test(data.receipt)
      )
        return response({ error: "Please refresh the feedback form." }, 400);
      const session = await db
        .prepare("SELECT id,is_open FROM sessions WHERE public_token=?")
        .bind(data.publicToken || "")
        .first();
      if (!session)
        return response({ error: "This feedback link is invalid." }, 404);
      const previous = await db
        .prepare("SELECT session_id FROM feedback WHERE receipt=?")
        .bind(data.receipt)
        .first();
      if (previous)
        return previous.session_id === session.id
          ? response({ received: true })
          : response({ error: "Please refresh the feedback form." }, 400);
      if (!session.is_open)
        return response(
          { error: "Your lecturer has closed feedback for this class." },
          409,
        );
      const id = crypto.randomUUID(),
        ai = predict(comment);
      await db.batch([
        db
          .prepare(
            `INSERT INTO feedback(id,session_id,comment,rating,receipt)
          SELECT ?,id,?,?,? FROM sessions WHERE id=? AND is_open=1
          AND (SELECT COUNT(*) FROM feedback WHERE session_id=?)<1000
          AND NOT EXISTS (SELECT 1 FROM feedback WHERE receipt=?)`,
          )
          .bind(
            id,
            comment,
            data.rating ?? null,
            data.receipt,
            session.id,
            session.id,
            data.receipt,
          ),
        db
          .prepare(
            "INSERT INTO predictions(feedback_id,model_version,label,probability) SELECT id,?,?,? FROM feedback WHERE id=?",
          )
          .bind(MODEL_VERSION, ai.label, ai.probability, id),
      ]);
      const received = await db
        .prepare("SELECT id FROM feedback WHERE receipt=? AND session_id=?")
        .bind(data.receipt, session.id)
        .first();
      return received
        ? response({ received: true }, 201)
        : response(
            {
              error:
                "Feedback is closed or has reached its response limit. Please check with your lecturer.",
            },
            409,
          );
    }
    if (["/api/dashboard", "/api/session", "/api/review"].includes(path)) {
      const session = await owner(request, db);
      if (!session)
        return response(
          {
            error:
              "This private review link is invalid. Use the saved link from when you created this lecture.",
          },
          403,
        );
      if (path === "/api/dashboard" && request.method === "GET") {
        const { results: feedback } = await db
          .prepare(
            `SELECT f.id,f.comment,f.rating,f.created_at,r.label human_label,
          p.label ai_label,p.probability,p.model_version FROM feedback f LEFT JOIN reviews r ON r.feedback_id=f.id
          LEFT JOIN predictions p ON p.feedback_id=f.id WHERE f.session_id=? ORDER BY f.created_at DESC,f.id DESC`,
          )
          .bind(session.id)
          .all();
        const { results: history } = await db
          .prepare(
            "SELECT h.feedback_id,h.label,h.created_at FROM review_history h JOIN feedback f ON f.id=h.feedback_id WHERE f.session_id=? ORDER BY h.created_at DESC,h.id DESC LIMIT 1000",
          )
          .bind(session.id)
          .all();
        return response({
          session,
          feedback,
          history,
          model: MODEL_EVALUATION,
        });
      }
      if (path === "/api/session" && request.method === "PATCH") {
        const data = await body(request);
        if (typeof data.isOpen !== "boolean")
          return response(
            { error: "Choose whether feedback should be open." },
            400,
          );
        await db
          .prepare("UPDATE sessions SET is_open=? WHERE id=?")
          .bind(data.isOpen ? 1 : 0, session.id)
          .run();
        return response({ saved: true });
      }
      if (path === "/api/review" && request.method === "POST") {
        const data = await body(request);
        if (!LABELS.includes(data.label))
          return response({ error: "Choose a valid sentiment label." }, 400);
        const allowed = await db
          .prepare("SELECT id FROM feedback WHERE id=? AND session_id=?")
          .bind(data.feedbackId || "", session.id)
          .first();
        if (!allowed)
          return response(
            { error: "That response is not part of this lecture." },
            403,
          );
        await db.batch([
          db
            .prepare(
              "INSERT INTO reviews(feedback_id,label) VALUES (?,?) ON CONFLICT(feedback_id) DO UPDATE SET label=excluded.label,updated_at=CURRENT_TIMESTAMP",
            )
            .bind(allowed.id, data.label),
          db
            .prepare(
              "INSERT INTO review_history(id,feedback_id,label) VALUES (?,?,?)",
            )
            .bind(crypto.randomUUID(), allowed.id, data.label),
        ]);
        return response({ saved: true });
      }
    }
    return response({ error: "This action is not available." }, 404);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      [
        "Use a JSON request.",
        "The request is too large.",
        "Invalid request.",
      ].includes(error?.message)
    )
      return response({ error: "Please check your form and try again." }, 400);
    // Never expose DB contents, keys or stack traces in API responses.
    return response(
      { error: "Something interrupted that request. Please try again." },
      503,
    );
  }
}
