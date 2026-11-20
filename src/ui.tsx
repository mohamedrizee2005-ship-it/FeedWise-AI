import { useEffect, useRef, type ReactNode } from "react";
import { Globe2, MessageSquareText, X } from "lucide-react";
import { useLanguage, type Language } from "./i18n";

export type Finding = { quote: string; topic: string };
export type Analysis = {
  label: string;
  source: string;
  language: string;
  needsReview: boolean;
  strengths: Finding[];
  concerns: Finding[];
  suggestions: (Finding & { action: string })[];
};
export type Feedback = {
  id: string;
  comment: string;
  rating: number | null;
  created_at: string;
  ai_label: string;
  human_label: string | null;
  analysis: Analysis;
  probability: number | null;
  model_version: string;
};
export type Session = {
  title: string;
  prompt: string;
  is_open: number;
  public_token: string;
};
export type Results = {
  session: Session;
  feedback: Feedback[];
  learning: { examples: number };
  history: { feedback_id: string; label: string; created_at: string }[];
};
export type ModelStatus = { available: boolean; state: string; model: string };

export async function request(
  path: string,
  token = "",
  method = "GET",
  data?: unknown,
) {
  const response = await fetch("/api/" + path, {
    method,
    cache: "no-store",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 404)
      throw new Error("invalid");
    if (path === "analyse") throw new Error(response.status === 422 ? "aiEvidence" : "aiFailed");
    throw new Error(
      path === "feedback" && response.status === 409 ? "limit" : "failed",
    );
  }
  return response;
}
export async function api<T>(
  path: string,
  token = "",
  method = "GET",
  data?: unknown,
): Promise<T> {
  return (await request(path, token, method, data)).json() as Promise<T>;
}
export function errorKey(error: unknown) {
  return error instanceof Error &&
    ["invalid", "aiFailed", "aiEvidence", "limit", "lengthError"].includes(error.message)
    ? error.message
    : "failed";
}
export function download(text: string, file: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Shell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <>
      <header className="mast">
        <div className="mast-inner">
          <a className="brand" href="/" aria-label={t("goHome")}>
            <span className="brand-mark">
              <MessageSquareText size={21} />
            </span>
            FeedWise <span className="brand-ai">AI</span>
          </a>
          <label className="languages">
            <Globe2 size={16} />
            <select
              aria-label={t("language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
              <option value="si">සිංහල</option>
            </select>
          </label>
        </div>
      </header>
      {children}
    </>
  );
}
export function Notice({ code }: { code: string }) {
  const { t } = useLanguage();
  return code ? (
    <p className="notice" role="alert">
      {t(code)}
    </p>
  ) : null;
}
export function Badge({ label }: { label: string }) {
  const { t } = useLanguage();
  return (
    <span className={"badge " + label}>
      <i />
      {t(label)}
    </span>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="modal"
      ref={dialog}
      aria-labelledby="modal-title"
      onCancel={onClose}
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button className="icon" aria-label={t("close")} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
