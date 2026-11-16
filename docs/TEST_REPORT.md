# Validation record — 16 November 2026

## Executed checks

- TypeScript: `npm run check` passed.
- Web/API: `npm test` passed **11 tests**, using actual in-memory SQLite and the tracked SQL migrations.
- Legacy Python prototype: Python 3.12, `python -m pytest -c python/pytest.ini -q` passed **20 tests**. One third-party anyio/pytest deprecation warning was reported.
- Production Worker build: the supported Vinext/Sites build completed. It includes the current numerical model server-side.
- Local D1: both pending migrations applied successfully through Wrangler. The browser used the resulting real local database.
- Dataset training: 4,684 training / 1,172 held-out records; 80.80% combined and 77.78% student-only accuracy. Detailed confusion matrices and hashes are in `model-evaluation.json`.

The 11 web tests include numerical sklearn/JavaScript parity on 52 authored strings; the no-login create → submit → private results → review → close/reopen workflow; separate-key permissions; cross-session isolation; JSON/length/rating validation; idempotent receipts; identical comments from different students; SQL-shaped data; human-review history; CSV formula escaping; typo/negation/mixed examples; unsupported-script handling; and an upgrade of a populated old schema without losing comments, predictions, current reviews or history. The migration check keeps foreign-key enforcement enabled and verifies `PRAGMA foreign_key_check`.

## Browser observations

The browser opened the simplified preview, created a test class and a separate student tab, submitted “verry good” with rating 5, and observed its positive suggestion and 5.0 average on refreshed lecturer results. Saving a lecturer review changed Reviewed from 0/1 to 1/1. Closing collection produced “Feedback closed” in a separate student tab; reopening restored collection. A second comment with opposing clause opinions appeared as Mixed, with matching topic counts. Searching for absent words showed an empty result, filtering to Mixed showed only that comment, and Export CSV produced a browser download. The student layout was inspected visually: a single white form, plain navy/neutral colors and no decorative hero/images.

## Scope of this evidence

These checks are functional and numerical evidence, not an independent security audit, a claim of general AI accuracy, actual-phone testing, or a production-load test. Responsive CSS is included; physical Android/iPhone behavior and free-account CPU usage still need observation in their target environments. The independent Cloudflare configuration also passed a Wrangler `deploy --dry-run` using a dummy local-only database ID, without account access or remote writes. The self-hosting configuration is prepared for a separate account; it is not proof that a deployment was created in that account. Managed deployment/GitHub status is reported only after provider confirmation in the delivery message.

Human labels are not automatically treated as research ground truth. Mixed/idiom/script rules are separate from the held-out learned-model score. Old saved predictions retain their original model version; an app upgrade does not silently relabel historical comments.
