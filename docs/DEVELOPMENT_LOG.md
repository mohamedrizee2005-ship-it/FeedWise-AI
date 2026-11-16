# FeedWise development record - 16 November 2026

## Current scope

The user explicitly requested a simple no-login lecturer/student flow, better UI/UX, GitHub update and a usable live URL. They then explicitly deferred the PDF. No new PDF was generated for this release.

## Decisions

- Removed the old Admin/account/assignment workflow. No new authentication screen was added.
- Kept separate public submission and private review keys. Hosted review keys use URL fragments so they are not included in the initial page request; server authorization still checks their digest on every operation.
- Used the supported React/Vinext Worker runtime for a working online app and D1 for persistent cross-device feedback. A browser-local mock or a static GitHub page would not satisfy the sharing requirement.
- Preserved the simplified Python/Streamlit code in python/ for study and local execution. Hosted and local databases are distinct; no previous feedback was copied or erased.
- Exported the original Python TF-IDF vocabulary, IDF, classifier coefficients/intercept and model metadata into lib/model.json. JavaScript reproduces vectorization/L2 normalization/logistic probability. The export can be regenerated with python/export_model.py.
- Retained/disclosed the poor 40-example demo evaluation. No invented accuracy improvement or external student data was introduced.

## UI/UX changes

Designed a calm emerald/off-white interface with readable typography and clear hierarchy. The root explains three steps next to a short creation form. Student pages show lecture context, optional rating, a comment field, privacy guidance, a counter and a clear success/paused state. Lecturer pages include a copyable student link, saved private-link download, three metrics, sentiment distribution, topic concerns, search/filter/pagination, safe CSV export, manual label dialog and history. Keyboard focus, reduced motion and mobile layouts are included.

## Backend and tests

D1 schema contains sessions, feedback, reviews, review_history and predictions. SQL parameterization, server-side session scope, idempotent receipts, bounded inputs, exact-text replay checks, model-specific predictions and append-only label history are preserved. The API rejects cross-origin requests with an Origin header. No raw private key, contact information or password is stored.

Node tests use real SQLite against the generated migration. Eight tests cover the workflow, isolation, key permissions, validation, history, receipts, CSV/topic logic and 45 cross-runtime model parity cases. Python's 20 tests continue to cover the preserved local app. Browser testing checks real form creation, submission, dashboard refresh, label review and pause/resume. Exact final results and delivery status are recorded separately.

## For the future PDF

Explain both the primary hosted application and the Python training/local-study component. Include source line references, every authored function, React state/events, CSS responsive rules, request routing, key generation/digest checking, SQL schema/indexes, transactional insert logic, TF-IDF mathematics, model export/parity, tests, hosting and limitations. Do not describe scaffolding or third-party libraries as code personally implemented by the student. Do not claim real-world accuracy or guaranteed anonymity.

## Revision requested after the first live version

The user rejected the decorative presentation and requested a plain professional form and useful lecturer results. They also requested substantially better training data, typo handling, free hosting and ZIP setup instructions. The PDF remains deferred.

- Replaced the large hero, slogans, serif headings, sidebar and decorative cards with a single lecturer create form, a focused student form and compact lecturer results. Retained copy/share, private-link download, CSV, reviews/history, search, filters, pagination and close/reopen.
- Trained the current three-class model on 4,684 rows from 5,856 unique source-attributed public comments. Held out 1,172 rows before fitting features. Added character n-grams, class balancing, source-specific metrics, raw file hashes and the deletion diagnostic. Details supersede the original binary-model notes above.
- Measured 80.80% combined accuracy and 77.78% student-only accuracy. These are different data/protocols from the original 40-row demo, so no controlled relative improvement is claimed. Kept neutral/multilingual/sarcasm limitations explicit.
- Added documented mixed-clause, short “not bad” and unsupported-script review handling. Kept raw sklearn parity separate from runtime-rule examples.
- Lowered the valid comment minimum from 10 to 2 characters. Removed global identical-text rejection because legitimate different students may both write “very good”. Kept receipt-based retry protection and the per-class response cap.
- Appended schema migration 0001; did not edit applied migration 0000. An ordinary parent-table rebuild failed the existing-record FK test; the final migration copies/rebuilds dependent tables before removing the old parent and passes preservation checks with FK enforcement on. No old comments or reviews are relabelled/deleted by the upgrade.
- Added current API model metadata in place of hardcoded 40-row demo scores. Browser display helpers no longer import the numerical model, keeping model weights server-side.
- Retired the old web exporter entrypoint by delegating it to the current trainer. Preserved the separate legacy Streamlit prototype with a clear README notice; its old model is not the deployed model.
- Added Windows root launchers, tracked local migration application, complete ZIP/VS Code setup, dataset attribution, AI explanation and an independent Cloudflare Workers/D1 configuration path. No paid API integration or account billing change was enabled.
- External free AI APIs have provider quotas. The selected-comment overview remains usable without third-party calls, keys or disclosure of comments to Gemini.
