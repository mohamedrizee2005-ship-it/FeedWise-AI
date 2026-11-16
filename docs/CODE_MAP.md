# Code and database walkthrough

This is the explanation map for the current web version. A full line-by-line PDF is deliberately deferred. Third-party framework internals and legacy prototypes should be distinguished from the FeedWise application code.

## Browser

`app/page.tsx` contains small React components:

- `api`: sends JSON to the same-origin API, attaches the private Bearer key only for lecturer operations, and converts server errors to user messages.
- `Home`: collects title/question. A successful create request changes the URL fragment to the private results key.
- `Student`: reads public session metadata; stores a per-tab receipt; collects the unchanged comment and optional rating; shows success or closed/error states. It never fetches lecturer responses.
- `Dashboard`: fetches private results, creates copy/download actions, closes/reopens collection, filters/paginates comments and saves human labels. It derives all counts from current rows and human overrides.
- `Page`: selects the home/student/private route from the public query parameter or private fragment. Conflicting/multiple access keys are rejected.
- Supporting components keep branding, errors, badges and layout consistent. Dialog focus is handled by a native modal dialog; form fields and rating controls have accessible labels.

`app/globals.css` uses system fonts, navy/neutral colors, visible focus states and two responsive breakpoints. No decorative photos, external fonts, marketing hero or sign-in UI are included. `app/layout.tsx` supplies a simple title, no-index metadata and a no-referrer policy.

## Request and storage path

`app/api/[...path]/route.ts` passes requests and the D1 binding to `handleAPI` in `lib/service.mjs`. Only this server layer reads/writes the database.

| Request | Access | Behavior |
|---|---|---|
| POST `/api/sessions` | Public | Validate title/question; generate independent 256-bit keys; store only a digest of the private key |
| GET `/api/session?s=...` | Student key | Return title, question and open/closed state only |
| POST `/api/feedback` | Student key | Validate 2–2,000 characters/rating/receipt; atomically store a response and its AI prediction if the class is open and below its cap |
| GET `/api/dashboard` | Private Bearer key | Resolve hashed key; return only that class's responses, reviews and history |
| PATCH `/api/session` | Private Bearer key | Close/reopen the key's own class |
| POST `/api/review` | Private Bearer key | Check response ownership; upsert the current human label and append history in a batch |

SQL values use bound parameters. Receipts make network retries idempotent. A public key cannot retrieve responses. Another class's private key cannot review these responses. Input errors receive readable messages; database internals and private keys are not returned in error stacks. Responses use no-store headers. No account password or student identifier is collected.

## Five tables

| Table | Main columns and relationships | Purpose |
|---|---|---|
| `sessions` | `id` PK, `title`, `prompt`, unique `public_token`, unique `review_hash`, `is_open`, `created_at` | One independent class feedback collection |
| `feedback` | `id` PK, `session_id` FK → sessions, `comment`, nullable `rating`, unique `receipt`, `created_at` | Original response and retry receipt |
| `predictions` | `feedback_id` FK → feedback, `model_version`, `label`, `probability` | Original model suggestion and numerical score |
| `reviews` | `feedback_id` PK/FK → feedback, `label`, `updated_at` | Latest lecturer decision |
| `review_history` | `id` PK, `feedback_id` FK → feedback, `label`, `created_at` | Append-only history of lecturer decisions |

One session has many feedback rows. A feedback row can have prediction records, at most one current review and many history entries. The current web submit path writes one prediction per response. Indexes support session lookup, receipt lookup, private-key lookup and feedback joins. `db/schema.ts` declares the schema; `drizzle/0000...sql` is immutable initial history. `0001...sql` rebuilds changed SQLite CHECK constraints and child tables by copying all original values before swapping tables, preserving feedback/predictions/reviews/history. The migration is tested against an existing populated schema, not only an empty database.

## AI and overview

`python/train_feedback.py` is the reproducible learning pipeline. `lib/model.json` is its numerical output. `lib/inference.mjs` reproduces normalization, word/character TF-IDF, independent L2 block normalization and multiclass softmax on the server. It also applies the separately documented mixed/idiom/script rules. Read `AI_TRAINING.md` for every stage and the benchmark's limits.

`lib/feedback.mjs` is shared display logic without model weights. `effectiveLabel` prefers a human label. `summarize` calculates counts, keyword-topic frequencies and selects up to two actual comments for each overview column. These are selected comments, not a generated factual summary. `toCSV` quotes CSV fields and prefixes formula-like cells to reduce spreadsheet formula injection.

## Build, local execution and hosting

`package.json` describes the locked Node dependencies and commands. `scripts/migrate-local.mjs` applies pending local D1 migrations. `self-host/configure.mjs` transforms the built Wrangler config for a reader's separate Cloudflare account/database. The provided runtime scripts select managed or portable execution; the Sites Vite integration is preserved for managed publication. These framework integrations are not part of the sentiment algorithm.

Local/managed/self-hosted databases are distinct. GitHub is the source repository, not the database. The private results key is a capability: possession grants management access; no human identity is verified. Review labels are suggestions/decisions, not independently verified research ground truth.

## Verification and later documentation

`tests/api.test.mjs` uses Node's actual SQLite engine as a small D1 adapter. It applies real migrations, exercises the API, checks access boundaries and preserves existing records during upgrade. `tests/model-parity.json` records authored diagnostic inputs with Python outputs. Python's 20 legacy tests remain separate.

`docs/SOURCE_INDEX.json` records current authored file lengths and SHA-256 digests for the later PDF. `DEVELOPMENT_LOG.md`, `AI_TRAINING.md` and `TEST_REPORT.md` retain decisions and evidence. Regenerate the index after source edits; do not attach explanations to stale line numbers. No PDF has been generated in this revision.
