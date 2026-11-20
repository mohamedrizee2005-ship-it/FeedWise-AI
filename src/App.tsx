import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  MessageSquareText,
} from "lucide-react";
import { LanguageProvider, useLanguage } from "./i18n";
import { api, errorKey, Notice, Shell, type Session } from "./ui";
import Dashboard from "./Dashboard";

function Home() {
  const { t } = useLanguage();
  const [title, setTitle] = useState(""),
    [question, setQuestion] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ reviewToken: string }>("sessions", "", "POST", {
        title,
        prompt: question,
      });
      location.hash = "review=" + data.reviewToken;
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="form-stage">
      <section className="form-sheet">
        <p className="kicker">{t("lecturer")}</p>
        <h1>{t("createTitle")}</h1>
        <form onSubmit={create}>
          <label htmlFor="class-title">{t("classTitle")}</label>
          <input
            id="class-title"
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("classExample")}
          />
          <label htmlFor="class-question">
            {t("question")} <small>{t("optional")}</small>
          </label>
          <textarea
            id="class-question"
            rows={3}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("questionExample")}
          />
          <Notice code={error} />
          <button className="primary wide" disabled={busy || !title.trim()}>
            {t(busy ? "creating" : "create")}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
type Attempt = {
  receipt: string;
  done: boolean;
  draft: string;
  rating: number | null;
};
const newAttempt = (): Attempt => ({
  receipt: crypto.randomUUID(),
  done: false,
  draft: "",
  rating: null,
});
function loadAttempt(token: string): Attempt {
  const empty = newAttempt();
  try {
    const raw = sessionStorage.getItem("feedwise-attempt-" + token);
    if (raw) {
      const value = JSON.parse(raw);
      if (
        typeof value.receipt === "string" &&
        typeof value.draft === "string" &&
        typeof value.done === "boolean"
      )
        return value;
    }
    const old = sessionStorage.getItem("feedwise-receipt-" + token);
    if (old)
      return {
        ...empty,
        receipt: old,
        done: sessionStorage.getItem("feedwise-done-" + token) === "yes",
      };
  } catch {}
  return empty;
}
function Student({ token }: { token: string }) {
  const { t } = useLanguage();
  const [attempt, setAttempt] = useState(() => loadAttempt(token));
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [comment, setComment] = useState(attempt.draft),
    [rating, setRating] = useState(attempt.rating);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api<{ session: Session }>("session?s=" + encodeURIComponent(token))
      .then((data) => {
        if (current) setSession(data.session);
      })
      .catch((e) => {
        if (current) setError(errorKey(e));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [token, reload]);
  function remember(value: Attempt) {
    setAttempt(value);
    try {
      sessionStorage.setItem(
        "feedwise-attempt-" + token,
        JSON.stringify(value),
      );
    } catch {}
  }
  function another() {
    remember(newAttempt());
    setComment("");
    setRating(null);
    setReload((n) => n + 1);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if ([...comment.trim()].length < 2) {
      setError("lengthError");
      return;
    }
    setBusy(true);
    setError("");
    remember({ ...attempt, draft: comment, rating });
    try {
      await api("feedback", "", "POST", {
        publicToken: token,
        comment,
        rating,
        receipt: attempt.receipt,
      });
      remember({ ...attempt, done: true, draft: "", rating: null });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="form-stage">
      <section className="form-sheet">
        {loading ? (
          <p role="status">{t("loading")}</p>
        ) : !session ? (
          <>
            <Notice code={error || "invalid"} />
            <button className="soft" onClick={() => setReload((n) => n + 1)}>
              {t("retry")}
            </button>
          </>
        ) : attempt.done ? (
          <div className="success">
            <span className="success-mark">
              <Check />
            </span>
            <p className="kicker">{session.title}</p>
            <h1>{t("thanks")}</h1>
            <p>{t("received")}</p>
            {session.is_open ? (
              <button className="primary" onClick={another}>
                {t("another")}
                <ArrowRight size={16} />
              </button>
            ) : (
              <p>{t("closed")}</p>
            )}
          </div>
        ) : !session.is_open ? (
          <>
            <p className="kicker">{session.title}</p>
            <h1>{t("closed")}</h1>
          </>
        ) : (
          <>
            <p className="kicker">
              <MessageSquareText size={15} />
              {t("student")}
            </p>
            <h1>{session.title}</h1>
            {session.prompt && <p className="lead">{session.prompt}</p>}
            <form onSubmit={submit}>
              <label htmlFor="comment">{t("feedback")}</label>
              <textarea
                id="comment"
                rows={5}
                required
                value={comment}
                onChange={(e) =>
                  setComment([...e.target.value].slice(0, 2000).join(""))
                }
                placeholder={t("placeholder")}
                aria-describedby="count"
              />
              <div className="field-foot">
                <span>
                  <LockKeyhole size={13} />
                  {t("anonymous")}
                </span>
                <span id="count">{[...comment].length} / 2,000</span>
              </div>
              <fieldset className="rating">
                <legend>
                  {t("rating")} <small>{t("optional")}</small>
                </legend>
                <div className="rating-options">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={n + " / 5"}
                      aria-pressed={rating === n}
                      onClick={() => setRating(rating === n ? null : n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="field-foot">
                  <span>{t("low")}</span>
                  <span>{t("high")}</span>
                </div>
              </fieldset>
              <p className="hint">{t("privacy")}</p>
              <Notice code={error} />
              <button className="primary wide" disabled={busy}>
                {t(busy ? "submitting" : "submit")}
                <ArrowRight size={17} />
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
function readRoute() {
  const q = new URLSearchParams(location.search).getAll("s"),
    h = new URLSearchParams(location.hash.slice(1)).getAll("review");
  if (q.length + h.length > 1) return { kind: "invalid", token: "" };
  const token = h[0] ?? q[0] ?? "";
  if (q.length + h.length && !/^[a-f0-9]{64}$/.test(token))
    return { kind: "invalid", token: "" };
  return { kind: h.length ? "review" : q.length ? "student" : "home", token };
}
function Routes() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return (
    <Shell>
      {route.kind === "review" ? (
        <Dashboard key={route.token} token={route.token} />
      ) : route.kind === "student" ? (
        <Student key={route.token} token={route.token} />
      ) : route.kind === "invalid" ? (
        <main className="form-stage">
          <Notice code="invalid" />
        </main>
      ) : (
        <Home />
      )}
    </Shell>
  );
}
export default function App() {
  return (
    <LanguageProvider>
      <Routes />
    </LanguageProvider>
  );
}
