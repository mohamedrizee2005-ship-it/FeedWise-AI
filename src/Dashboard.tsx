import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  ListFilter,
  LockKeyhole,
  MessageSquareText,
  Minus,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  DISPLAY_LABELS,
  LABELS,
  effectiveLabel,
  summarize,
  toCSV,
} from "../shared/feedback.mjs";
import { useLanguage } from "./i18n";
import {
  api,
  Badge,
  download,
  errorKey,
  Modal,
  Notice,
  request,
  type Feedback,
  type ModelStatus,
  type Results,
} from "./ui";

function Links({
  token,
  data,
  close,
}: {
  token: string;
  data: Results;
  close: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(""),
    [error, setError] = useState("");
  const student = location.origin + "/?s=" + data.session.public_token,
    privateLink = location.origin + "/#review=" + token;
  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setError("");
    } catch {
      setError("copyManual");
    }
  }
  return (
    <Modal title={t("share")} onClose={close}>
      <label htmlFor="student-link">{t("studentLink")}</label>
      <div className="input-action">
        <input
          id="student-link"
          value={student}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        <button className="soft" onClick={() => copy(student, "student")}>
          <Copy size={15} />
          {t(copied === "student" ? "copied" : "copy")}
        </button>
      </div>
      <a className="text-btn" href={student} target="_blank" rel="noreferrer">
        {t("student")}
        <ArrowRight size={14} />
      </a>
      <div className="divider" />
      <label htmlFor="private-link">
        <LockKeyhole size={15} />
        {t("privateLink")}
      </label>
      <input
        id="private-link"
        readOnly
        value={privateLink}
        onFocus={(e) => e.target.select()}
      />
      <p className="hint">{t("keepLink")}</p>
      <button
        className="soft"
        onClick={() =>
          download(privateLink + "\n", "FeedWise-private-review-link.txt")
        }
      >
        <ArrowDownToLine size={16} />
        {t("saveLink")}
      </button>
      <Notice code={error} />
    </Modal>
  );
}

function Overview({
  rows,
  onResponses,
}: {
  rows: Feedback[];
  onResponses: () => void;
}) {
  const { t, lang } = useLanguage(),
    summary = summarize(rows);
  return (
    <div className="overview">
      <section className="panel sentiment">
        <h2>{t("sentiment")}</h2>
        <div className="distribution" aria-hidden="true">
          {DISPLAY_LABELS.filter((label) => summary.counts[label] > 0).map(
            (label) => (
              <span
                className={label}
                key={label}
                style={{ flex: summary.counts[label] }}
              />
            ),
          )}
        </div>
        <div className="legend">
          {DISPLAY_LABELS.map((label) => (
            <span key={label}>
              <i className={label} />
              {t(label)} <b>{summary.counts[label]}</b>
            </span>
          ))}
        </div>
      </section>
      <div className="findings">
        <section className="panel changes">
          <h2>{t("improvements")}</h2>
          {summary.actions.length ? (
            summary.actions.map((action) => (
              <article className="finding" key={action.key}>
                <div className="finding-label">
                  {t(action.topic)}{" "}
                  <span>
                    {t("responses")} · {action.count}
                  </span>
                </div>
                <p>{(lang === "en" && action.suggestion) || t("action_" + action.action)}</p>
                {action.quotes.map((quote: string) => (
                  <blockquote key={quote}>{quote}</blockquote>
                ))}
              </article>
            ))
          ) : (
            <>
              <p className="muted">
                {t(summary.unresolved ? "needsReading" : "noAction")}
              </p>
              {summary.unresolved > 0 && (
                <button className="text-btn" onClick={onResponses}>
                  {t("reviewResponses")}
                  <ArrowRight size={15} />
                </button>
              )}
            </>
          )}
        </section>
        <section className="panel strengths">
          <h2>{t("strengths")}</h2>
          {summary.strengths.length ? (
            summary.strengths.map((item) => (
              <div className="strength" key={item.quote}>
                <span className="finding-label">{t(item.topic)}</span>
                <blockquote>{item.quote}</blockquote>
              </div>
            ))
          ) : (
            <p className="muted">{t("noStrengths")}</p>
          )}
        </section>
      </div>
      <details className="panel">
        <summary>{t("topics")}</summary>
        <table>
          <thead>
            <tr>
              <th>{t("topics")}</th>
              <th>{t("mentions")}</th>
              <th>{t("concerns")}</th>
            </tr>
          </thead>
          <tbody>
            {summary.topicRows.map((topic) => (
              <tr key={topic.id}>
                <td>{t(topic.id)}</td>
                <td>{topic.count}</td>
                <td>{topic.concerns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

type Decision = (row: Feedback, label: string) => Promise<boolean>;
function Responses({
  data,
  token,
  save,
  busy,
  refresh,
}: {
  data: Results;
  token: string;
  save: Decision;
  busy: boolean;
  refresh: () => Promise<void>;
}) {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState(""),
    [chosen, setChosen] = useState(""),
    [model, setModel] = useState<ModelStatus | null>(null);
  const [analysing, setAnalysing] = useState(false),
    [error, setError] = useState("");
  const review = data.feedback.find((r) => r.id === reviewId);
  const rows = data.feedback.filter(
    (r) =>
      r.comment
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "pending" ? !r.human_label : effectiveLabel(r) === filter)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 10)),
    current = Math.min(page, pages);
  const date = (value: string) =>
    new Date(value.replace(" ", "T") + "Z").toLocaleString(lang, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  useEffect(() => {
    if (!reviewId) return;
    let active = true;
    setModel(null);
    api<ModelStatus>("ai", token)
      .then((value) => {
        if (active) setModel(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [reviewId, token]);
  function edit(row: Feedback) {
    const label = effectiveLabel(row);
    setChosen(LABELS.includes(label) ? label : "");
    setError("");
    setReviewId(row.id);
  }
  async function deep() {
    if (!review || analysing) return;
    setAnalysing(true);
    setError("");
    try {
      const result = await api<{ analysis: { label: string } }>(
        "analyse",
        token,
        "POST",
        { feedbackId: review.id },
      );
      setChosen(
        LABELS.includes(result.analysis.label) ? result.analysis.label : "",
      );
      await refresh();
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setAnalysing(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t("responses")}</h2>
        <button
          className="soft"
          disabled={!data.feedback.length}
          onClick={() =>
            download(
              toCSV(data.feedback),
              "FeedWise-responses.csv",
              "text/csv;charset=utf-8",
            )
          }
        >
          <ArrowDownToLine size={16} />
          {t("csv")}
        </button>
      </div>
      <div className="filter-bar">
        <label className="search">
          <Search size={17} />
          <input
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="filter">
          <ListFilter size={15} />
          <select
            aria-label={t("filter")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            {["all", "pending", ...DISPLAY_LABELS].map((key) => (
              <option key={key} value={key}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!rows.length && (
        <p className="muted">{t(data.feedback.length ? "noMatch" : "empty")}</p>
      )}
      {rows.slice((current - 1) * 10, current * 10).map((row) => (
        <article className="response" key={row.id}>
          <div className="response-meta">
            <Badge label={effectiveLabel(row)} />
            <span>{date(row.created_at)}</span>
            {row.rating !== null && <span>{row.rating} / 5</span>}
          </div>
          <p className="comment">{row.comment}</p>
          <div className="response-foot">
            <small>{t(row.analysis.source)}</small>
            <div className="controls">
              <button
                className="icon quick-pos"
                disabled={busy || analysing}
                title={t("positiveQuick")}
                aria-label={t("positiveQuick")}
                onClick={() => save(row, "positive")}
              >
                <Plus size={16} />
              </button>
              <button
                className="icon quick-neg"
                disabled={busy || analysing}
                title={t("negativeQuick")}
                aria-label={t("negativeQuick")}
                onClick={() => save(row, "negative")}
              >
                <Minus size={16} />
              </button>
              <button className="soft" onClick={() => edit(row)}>
                {t("review")}
              </button>
            </div>
          </div>
        </article>
      ))}
      {pages > 1 && (
        <div className="pagination">
          <button
            className="icon"
            disabled={current === 1}
            aria-label={t("previous")}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          {current} / {pages}
          <button
            className="icon"
            disabled={current === pages}
            aria-label={t("next")}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {review && (
        <Modal title={t("review")} onClose={() => setReviewId("")}>
          <blockquote>{review.comment}</blockquote>
          <p className="hint">
            {t("original")} · {t(review.ai_label || "unreviewed")}
          </p>
          <div className="response-meta">
            <Badge label={effectiveLabel(review)} />
            <small>{t(review.analysis.source)}</small>
          </div>
          <fieldset className="labels">
            <legend>{t("yourLabel")}</legend>
            {LABELS.map((label) => (
              <label key={label}>
                <input
                  type="radio"
                  name="label"
                  checked={chosen === label}
                  onChange={() => setChosen(label)}
                />
                {t(label)}
              </label>
            ))}
          </fieldset>
          <p className="hint">{t("learnHint")}</p>
          <Notice code={error} />
          <button
            className="primary"
            disabled={!chosen || busy || analysing}
            onClick={async () => {
              if (await save(review, chosen)) setReviewId("");
              else setError("failed");
            }}
          >
            <Check size={16} />
            {t("remember")}
          </button>
          {model?.available &&
            !review.human_label &&
            !["correction", "ollama"].includes(review.analysis.source) && (
              <button
                className="soft deep"
                disabled={analysing || busy}
                onClick={deep}
              >
                {t(analysing ? "analysing" : "deep")}
              </button>
            )}
          {data.history.some((h) => h.feedback_id === review.id) && (
            <details>
              <summary>{t("history")}</summary>
              {data.history
                .filter((h) => h.feedback_id === review.id)
                .map((h, i) => (
                  <p className="hint" key={i}>
                    {date(h.created_at)} · {t(h.label)}
                  </p>
                ))}
            </details>
          )}
        </Modal>
      )}
    </section>
  );
}
function Learning({ token, examples }: { token: string; examples: number }) {
  const { t } = useLanguage();
  const [model, setModel] = useState<ModelStatus | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setModel(null);
    setError("");
    api<ModelStatus>("ai", token)
      .then((m) => {
        if (active) setModel(m);
      })
      .catch((e) => {
        if (active) setError(errorKey(e));
      });
    return () => {
      active = false;
    };
  }, [token, refresh]);
  async function exportLabels() {
    try {
      const response = await request("training-data", token);
      download(
        await response.text(),
        "feedwise-corrections.jsonl",
        "application/x-ndjson",
      );
    } catch (e) {
      setError(errorKey(e));
    }
  }
  return (
    <section className="panel learning">
      <h2>{t("learning")}</h2>
      <p className="learn-count">
        <b>{examples}</b> {t("examples")}
      </p>
      <p>{t("learnerHint")}</p>
      <button className="soft" disabled={!examples} onClick={exportLabels}>
        <ArrowDownToLine size={16} />
        {t("trainingExport")}
      </button>
      <div className="divider" />
      <div className="panel-head">
        <h3>
          {!model
            ? t("loading")
            : t(
                model.available
                  ? "aiReady"
                  : model.state === "model_missing"
                    ? "aiMissing"
                    : "aiOffline",
              )}
        </h3>
        <button
          className="icon"
          aria-label={t("refresh")}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {model &&
        (model.available ? (
          <p className="hint">
            {model.model} · {t("responses")} → {t("review")} → {t("deep")}
          </p>
        ) : (
          <>
            <p>{t("setupHint")}</p>
            <code>ollama pull {model.model}</code>
          </>
        ))}
      <Notice code={error} />
    </section>
  );
}
export default function Dashboard({ token }: { token: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<Results | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [tab, setTab] = useState("overview"),
    [links, setLinks] = useState(false),
    [savedId, setSavedId] = useState(0);
  async function refresh() {
    setData(await api<Results>("dashboard", token));
  }
  async function load() {
    setBusy(true);
    setError("");
    try {
      await refresh();
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [token]);
  async function toggle() {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("session", token, "PATCH", { isOpen: !data.session.is_open });
      await refresh();
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(row: Feedback, label: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await api("review", token, "POST", { feedbackId: row.id, label });
      await refresh();
      setSavedId((n) => n + 1);
      return true;
    } catch (e) {
      setError(errorKey(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!savedId) return;
    const timer = setTimeout(() => setSavedId(0), 2300);
    return () => clearTimeout(timer);
  }, [savedId]);
  if (!data)
    return (
      <main className="desk">
        <Notice code={error} />
        {error ? (
          <button className="soft" onClick={load}>
            {t("retry")}
          </button>
        ) : (
          <p role="status">{t("loading")}</p>
        )}
      </main>
    );
  const rows = data.feedback,
    rated = rows.filter((r) => r.rating !== null),
    session = data.session;
  const average = rated.length
    ? (
        rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
      ).toFixed(1)
    : "—";
  return (
    <main className="desk">
      <div className="desk-head">
        <div>
          <p className="kicker">{t("lecturer")}</p>
          <h1>{session.title}</h1>
        </div>
        <div className="controls">
          <button
            className="icon"
            disabled={busy}
            aria-label={t("refresh")}
            onClick={load}
          >
            <RefreshCw size={17} />
          </button>
          <button className="primary" onClick={() => setLinks(true)}>
            <Link2 size={17} />
            {t("share")}
          </button>
        </div>
      </div>
      <div className="session-line">
        <span className={"status " + (session.is_open ? "is-open" : "")}>
          <i />
          {t(session.is_open ? "open" : "closed")}
        </span>
        <button className="text-btn" disabled={busy} onClick={toggle}>
          {t(session.is_open ? "stop" : "reopen")}
        </button>
      </div>
      <Notice code={error} />
      <div className="metrics">
        {[
          [t("responses"), rows.length],
          [t("average"), average],
          [t("reviewed"), rows.filter((r) => r.human_label).length],
        ].map(([label, value], i) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {value}
              {i === 1 && <small> / 5</small>}
            </strong>
          </div>
        ))}
      </div>
      <nav className="tabs">
        {["overview", "responses", "learning"].map((id) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {t(id)}
          </button>
        ))}
      </nav>
      {tab === "responses" ? (
        <Responses
          token={token}
          data={data}
          busy={busy}
          save={save}
          refresh={refresh}
        />
      ) : tab === "learning" ? (
        <Learning token={token} examples={data.learning.examples} />
      ) : rows.length ? (
        <Overview rows={rows} onResponses={() => setTab("responses")} />
      ) : (
        <section className="panel empty">
          <MessageSquareText size={27} />
          <h2>{t("empty")}</h2>
          <p>{t("emptyHint")}</p>
          <button className="soft" onClick={() => setLinks(true)}>
            <Link2 size={16} />
            {t("share")}
          </button>
        </section>
      )}
      <p aria-live="polite" className={savedId ? "toast" : "sr-only"}>
        {savedId ? t("saved") : ""}
      </p>
      {links && (
        <Links token={token} data={data} close={() => setLinks(false)} />
      )}
    </main>
  );
}
