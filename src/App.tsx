import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  LABELS,
  DISPLAY_LABELS,
  effectiveLabel,
  summarize,
  toCSV,
} from "../shared/feedback.mjs";

type Feedback = {
  id: string;
  comment: string;
  rating: number | null;
  created_at: string;
  human_label: string | null;
  ai_label: string | null;
  probability: number | null;
  model_version: string;
};
type DashboardData = {
  session: {
    title: string;
    prompt: string;
    public_token: string;
    is_open: number;
  };
  feedback: Feedback[];
  history: { feedback_id: string; label: string; created_at: string }[];
};
const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
const date = (value: string) =>
  new Date(value.replace(" ", "T") + "Z").toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function download(content: string, filename: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function api(path: string, options: RequestInit = {}, key = "") {
  const response = await fetch("/api/" + path, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: "Bearer " + key } : {}),
      ...options.headers,
    },
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";
function Brand() {
  return (
    <a className="brand" href="/">
      FeedWise<span>AI</span>
    </a>
  );
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
function Badge({ label }: { label: string }) {
  return (
    <span className={"badge " + label}>
      {label === "unreviewed" ? "Needs review" : titleCase(label)}
    </span>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <header className="site-header">
        <Brand />
      </header>
      {children}
    </div>
  );
}
function Home() {
  const [title, setTitle] = useState(""),
    [prompt, setPrompt] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("sessions", {
        method: "POST",
        body: JSON.stringify({ title, prompt }),
      });
      window.location.hash = "review=" + data.reviewToken;
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <main className="form-main">
        <section className="form-card">
          <p className="section-label">LECTURER</p>
          <h1>Collect class feedback</h1>
          <form onSubmit={create}>
            <label htmlFor="title">Class title</label>
            <input
              id="title"
              autoComplete="off"
              placeholder="e.g. Database Systems · Lecture 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
            />
            <label htmlFor="question">
              Question <span className="muted">(optional)</span>
            </label>
            <textarea
              id="question"
              placeholder="What worked well? What could improve?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <ErrorBox error={error} />
            <button className="button primary full" disabled={busy}>
              {busy ? "Creating…" : "Create feedback link"}
            </button>
          </form>
        </section>
      </main>
    </Shell>
  );
}
function Student({ token }: { token: string }) {
  const [session, setSession] = useState<{
      title: string;
      prompt: string;
      is_open: number;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [comment, setComment] = useState(""),
    [rating, setRating] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const receipt = useRef("");
  useEffect(() => {
    let active = true;
    receipt.current = crypto.randomUUID();
    try {
      const key = "feedwise-receipt-" + token;
      receipt.current = sessionStorage.getItem(key) || receipt.current;
      sessionStorage.setItem(key, receipt.current);
      setDone(sessionStorage.getItem("feedwise-done-" + token) === "yes");
    } catch {}
    api("session?s=" + encodeURIComponent(token))
      .then((data) => {
        if (active) setSession(data.session);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("feedback", {
        method: "POST",
        body: JSON.stringify({
          publicToken: token,
          comment,
          rating,
          receipt: receipt.current,
        }),
      });
      setDone(true);
      try {
        sessionStorage.setItem("feedwise-done-" + token, "yes");
      } catch {}
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <main className="form-main">
        <section className="form-card">
          {loading ? (
            <p role="status">Loading…</p>
          ) : !session ? (
            <>
              <h1>Feedback unavailable</h1>
              <ErrorBox error={error} />
            </>
          ) : done ? (
            <div className="state">
              <Check size={30} />
              <h1>Thank you.</h1>
              <p>Your feedback has been submitted.</p>
              <p className="muted">{session.title}</p>
            </div>
          ) : !session.is_open ? (
            <>
              <h1>Feedback closed</h1>
              <p>{session.title}</p>
            </>
          ) : (
            <>
              <p className="section-label">CLASS FEEDBACK</p>
              <h1>{session.title}</h1>
              {session.prompt && <p className="question">{session.prompt}</p>}
              <form onSubmit={submit}>
                <label htmlFor="comment">Your feedback</label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write your feedback…"
                  required
                  minLength={2}
                  maxLength={2000}
                  rows={6}
                  aria-describedby="comment-count"
                />
                <div className="count" id="comment-count">
                  {[...comment].length.toLocaleString()} / 2,000
                </div>
                <fieldset className="rating">
                  <legend>
                    Overall rating <span className="muted">(optional)</span>
                  </legend>
                  <div className="rating-options">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} out of 5`}
                        aria-pressed={rating === n}
                        className={rating === n ? "selected" : ""}
                        onClick={() => setRating(rating === n ? null : n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="rating-caption">
                    <span>Needs improvement</span>
                    <span>Excellent</span>
                  </div>
                </fieldset>
                <p className="privacy">
                  No name or student ID is collected. Avoid personal details in
                  your comment.
                </p>
                <ErrorBox error={error} />
                <button className="button primary full" disabled={busy}>
                  {busy ? "Submitting…" : "Submit feedback"}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </Shell>
  );
}
function Dashboard({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [review, setReview] = useState<Feedback | null>(null),
    [chosen, setChosen] = useState("neutral"),
    [saving, setSaving] = useState(false),
    [reviewError, setReviewError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setData(await api("dashboard", {}, token));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    refresh();
  }, [token]);
  useEffect(() => {
    if (review) dialog.current?.showModal();
    else dialog.current?.close();
  }, [review]);
  useEffect(() => {
    setPage(1);
  }, [search, filter]);
  async function copy(text: string, kind: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Copy is unavailable. Select the link to copy it.");
    }
  }
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await api(
        "session",
        {
          method: "PATCH",
          body: JSON.stringify({ isOpen: !data?.session.is_open }),
        },
        token,
      );
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function openReview(row: Feedback) {
    setReview(row);
    setChosen(
      row.human_label ||
        (LABELS.includes(row.ai_label || "") ? row.ai_label! : "neutral"),
    );
    setReviewError("");
  }
  async function save() {
    if (!review) return;
    setSaving(true);
    setReviewError("");
    try {
      await api(
        "review",
        {
          method: "POST",
          body: JSON.stringify({ feedbackId: review.id, label: chosen }),
        },
        token,
      );
      setReview(null);
      await refresh();
    } catch (e) {
      setReviewError(message(e));
    } finally {
      setSaving(false);
    }
  }
  const rows = data?.feedback || [],
    summary = summarize(rows),
    rated = rows.filter((r) => r.rating !== null),
    reviewed = rows.filter((r) => r.human_label).length;
  const filtered = rows.filter(
    (r) =>
      (filter === "all" ||
        (filter === "pending"
          ? !r.human_label
          : effectiveLabel(r) === filter)) &&
      r.comment.toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    currentPage = Math.min(page, pages);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const studentURL = data ? origin + "/?s=" + data.session.public_token : "",
    reviewURL = origin + "/#review=" + token;
  return (
    <Shell>
      <main className="dashboard-main">
        {!data ? (
          <section className="panel">
            <h1>{busy ? "Loading results…" : "Results unavailable"}</h1>
            <ErrorBox error={error} />
            <button className="button" disabled={busy} onClick={refresh}>
              Retry
            </button>
          </section>
        ) : (
          <>
            <div className="dashboard-heading">
              <div>
                <p className="section-label">LECTURER RESULTS</p>
                <h1>{data.session.title}</h1>
              </div>
              <div className="actions">
                <span
                  className={"status " + (data.session.is_open ? "open" : "")}
                >
                  {data.session.is_open
                    ? "Accepting feedback"
                    : "Feedback closed"}
                </span>
                <button className="button" disabled={busy} onClick={toggle}>
                  {data.session.is_open ? "Close feedback" : "Reopen feedback"}
                </button>
              </div>
            </div>
            <ErrorBox error={error} />
            <section className="sharing panel">
              <div className="student-link">
                <label htmlFor="student-link">Student link</label>
                <div className="input-action">
                  <input
                    id="student-link"
                    value={studentURL}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="button"
                    onClick={() => copy(studentURL, "student")}
                  >
                    <Copy size={16} />
                    {copied === "student" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="private-link">
                <button
                  className="text-button"
                  onClick={() => {
                    download(
                      reviewURL + "\n",
                      "FeedWise-private-review-link.txt",
                    );
                    setCopied("saved");
                  }}
                >
                  <Download size={15} />
                  Save private results link
                </button>
                <span className="muted">
                  Keep this link private. It is your access to results.
                </span>
              </div>
            </section>
            <div className="metrics">
              <div>
                <span>Responses</span>
                <strong>{rows.length}</strong>
              </div>
              <div>
                <span>Average rating</span>
                <strong>
                  {rated.length
                    ? (
                        rated.reduce((s, r) => s + r.rating!, 0) / rated.length
                      ).toFixed(1)
                    : "—"}
                  <small> / 5</small>
                </strong>
              </div>
              <div>
                <span>Reviewed</span>
                <strong>
                  {reviewed}
                  <small> / {rows.length}</small>
                </strong>
              </div>
            </div>
            {rows.length > 0 && (
              <section className="panel overview">
                <div className="section-heading">
                  <h2>At a glance</h2>
                  <span className="muted">
                    AI suggestions + your corrections
                  </span>
                </div>
                <div
                  className="sentiment-bar"
                  aria-label="Sentiment distribution"
                >
                  {DISPLAY_LABELS.filter(
                    (label) => summary.counts[label] > 0,
                  ).map((label) => (
                    <span
                      key={label}
                      className={label}
                      style={{
                        width:
                          (summary.counts[label] / rows.length) * 100 + "%",
                      }}
                      title={`${titleCase(label)}: ${summary.counts[label]}`}
                    />
                  ))}
                </div>
                <div className="legend">
                  {DISPLAY_LABELS.map((label) => (
                    <span key={label}>
                      <i className={label} />
                      {label === "unreviewed"
                        ? "Needs review"
                        : titleCase(label)}
                      <strong>{summary.counts[label]}</strong>
                    </span>
                  ))}
                </div>
                <div className="summary-grid">
                  <div>
                    <h3>What worked</h3>
                    {summary.strengths.length ? (
                      summary.strengths.map((r: Feedback) => (
                        <blockquote key={r.id}>{r.comment}</blockquote>
                      ))
                    ) : (
                      <p className="muted">
                        No positive feedback identified yet.
                      </p>
                    )}
                  </div>
                  <div>
                    <h3>What to improve</h3>
                    {summary.improvements.length ? (
                      summary.improvements.map((r: Feedback) => (
                        <blockquote key={r.id}>{r.comment}</blockquote>
                      ))
                    ) : (
                      <p className="muted">No concerns identified yet.</p>
                    )}
                  </div>
                </div>
                {summary.topicRows.length > 0 && (
                  <div className="topics">
                    <h3>Topics mentioned</h3>
                    {summary.topicRows.map(
                      (t: {
                        topic: string;
                        count: number;
                        concerns: number;
                      }) => (
                        <div className="topic-row" key={t.topic}>
                          <span>{t.topic}</span>
                          <span>
                            {t.count} {t.count === 1 ? "response" : "responses"}
                            {t.concerns > 0 && (
                              <small> · {t.concerns} with concerns</small>
                            )}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
                <p className="summary-caption">
                  Selected comments are shown verbatim. Topics use keyword
                  matching.
                </p>
              </section>
            )}
            <section className="panel responses">
              <div className="section-heading">
                <h2>
                  Responses <span className="muted">{rows.length}</span>
                </h2>
                <div className="actions">
                  <button
                    className="button icon-button"
                    disabled={busy}
                    onClick={refresh}
                    aria-label="Refresh responses"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    className="button"
                    disabled={!rows.length}
                    onClick={() =>
                      download(
                        toCSV(rows),
                        "FeedWise-responses.csv",
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="filters">
                <input
                  aria-label="Search responses"
                  type="search"
                  placeholder="Search feedback"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filter responses"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All responses</option>
                  <option value="pending">Not reviewed by you</option>
                  {DISPLAY_LABELS.map((label) => (
                    <option key={label} value={label}>
                      {label === "unreviewed"
                        ? "Needs review"
                        : titleCase(label)}
                    </option>
                  ))}
                </select>
              </div>
              {!filtered.length ? (
                <div className="empty">
                  {!rows.length
                    ? "No responses yet. Share the student link to begin."
                    : "No matching responses."}
                </div>
              ) : (
                <div className="response-list">
                  {filtered
                    .slice((currentPage - 1) * 10, currentPage * 10)
                    .map((row) => (
                      <article className="response" key={row.id}>
                        <div className="response-meta">
                          <Badge label={effectiveLabel(row)} />
                          <span className="muted">{date(row.created_at)}</span>
                          {row.rating !== null && (
                            <span className="rating-value">
                              {row.rating} / 5
                            </span>
                          )}
                        </div>
                        <p className="comment">{row.comment}</p>
                        <div className="response-bottom">
                          <span className="muted">
                            {row.human_label
                              ? "Reviewed by you"
                              : row.ai_label === "unreviewed"
                                ? "English model could not assess this comment"
                                : "AI suggestion"}
                            {row.ai_label !== "unreviewed" &&
                            !row.human_label &&
                            row.probability !== null &&
                            row.probability < 0.6
                              ? " · check this label"
                              : ""}
                          </span>
                          <button
                            className="text-button"
                            onClick={() => openReview(row)}
                          >
                            {row.human_label ? "Edit review" : "Review"}
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              )}
              {pages > 1 && (
                <div className="pagination">
                  <button
                    className="button"
                    aria-label="Previous page"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>
                    {currentPage} / {pages}
                  </span>
                  <button
                    className="button"
                    aria-label="Next page"
                    disabled={currentPage === pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <p className="model-note">
                English sentiment model. Check AI labels before drawing
                conclusions.
              </p>
            </section>
            <dialog
              ref={dialog}
              onCancel={() => setReview(null)}
              onClose={() => setReview(null)}
              aria-labelledby="review-heading"
            >
              <div className="section-heading">
                <h2 id="review-heading">Review feedback</h2>
                <button
                  className="button icon-button"
                  onClick={() => setReview(null)}
                  aria-label="Close review"
                >
                  <X size={18} />
                </button>
              </div>
              {review && (
                <>
                  <p className="comment review-comment">{review.comment}</p>
                  <p className="muted">
                    Original AI suggestion:{" "}
                    {titleCase(review.ai_label || "unreviewed")}
                  </p>
                  <fieldset className="review-labels">
                    <legend>Your label</legend>
                    {LABELS.map((label) => (
                      <label key={label}>
                        <input
                          type="radio"
                          name="review-label"
                          value={label}
                          checked={chosen === label}
                          onChange={() => setChosen(label)}
                        />
                        {titleCase(label)}
                      </label>
                    ))}
                  </fieldset>
                  {data.history.filter((h) => h.feedback_id === review.id)
                    .length > 0 && (
                    <details>
                      <summary>Review history</summary>
                      {data.history
                        .filter((h) => h.feedback_id === review.id)
                        .map((h, i) => (
                          <p className="history" key={i}>
                            {titleCase(h.label)} · {date(h.created_at)}
                          </p>
                        ))}
                    </details>
                  )}
                  <ErrorBox error={reviewError} />
                  <button
                    className="button primary full"
                    disabled={saving}
                    onClick={save}
                  >
                    {saving ? "Saving…" : "Save review"}
                  </button>
                </>
              )}
            </dialog>
          </>
        )}
        <div role="status" className="sr-only" aria-live="polite">
          {copied === "student"
            ? "Student link copied"
            : copied === "saved"
              ? "Private results link saved"
              : ""}
        </div>
      </main>
    </Shell>
  );
}
export default function Page() {
  const [route, setRoute] = useState({ kind: "loading", token: "" });
  useEffect(() => {
    function update() {
      const q = new URLSearchParams(location.search),
        h = new URLSearchParams(location.hash.slice(1));
      if (
        (q.has("s") && h.has("review")) ||
        q.getAll("s").length > 1 ||
        h.getAll("review").length > 1
      ) {
        setRoute({ kind: "invalid", token: "" });
        return;
      }
      const review = h.get("review"),
        student = q.get("s");
      setRoute(
        review !== null
          ? { kind: "review", token: review }
          : student !== null
            ? { kind: "student", token: student }
            : { kind: "home", token: "" },
      );
    }
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  if (route.kind === "loading")
    return (
      <Shell>
        <main className="form-main" role="status">
          Loading…
        </main>
      </Shell>
    );
  if (route.kind === "invalid")
    return (
      <Shell>
        <main className="form-main">
          <ErrorBox error="Invalid link. Use the original student or private results link." />
        </main>
      </Shell>
    );
  if (route.kind === "student")
    return <Student key={route.token} token={route.token} />;
  if (route.kind === "review")
    return <Dashboard key={route.token} token={route.token} />;
  return <Home />;
}
