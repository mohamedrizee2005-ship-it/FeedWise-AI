# FeedWise AI

A classroom feedback app: a lecturer creates a link, students submit without an account, and the lecturer privately reviews the results.

**[Open FeedWise](https://feedwise-classroom.mohamedrizny5002.chatgpt.site)**

## Use it

1. Enter a class title and an optional question. Select **Create feedback link**.
2. Select **Save private results link**. Keep that file/bookmark private; it is your access to this class's results.
3. Copy the separate **Student link** and share it with your class.
4. Students submit a comment and an optional 1–5 rating.
5. Open the private link to see sentiment, selected comments, topics and responses. Review/correct labels, search/filter, export CSV, or close/reopen feedback.

No Admin portal, passwords, student registration or ChatGPT connection is required. Anyone with a student link can submit; anyone with a private results link can manage that class. A private-link model does not verify that a person is a lecturer or guarantee one submission per student. No recovery account exists.

## Download and run in VS Code

Use **Code → Download ZIP**, extract it, and open the extracted folder containing `package.json`. Use Node.js **24** (tested). Python is optional: the trained web model is included.

On Windows, run `FIRST_SETUP.bat` once, then `RUN_FEEDWISE.bat`. Or use the terminal from the repository root:

```sh
npm ci
npm run prepare:local
npm run dev
```

Open the localhost URL printed in the terminal. Keep the terminal running. The first setup builds the app and applies pending migrations to a local D1 database; it does not log in, deploy or change the hosted database. Subsequent schema updates: run `npm run prepare:local` again; already tracked local migrations are skipped.

Detailed instructions and common errors: [Getting started](docs/GETTING_STARTED.md). Hosting your own copy: [Free hosting guide](docs/HOSTING.md).

## What is included

- Focused submission form, plain system typography, navy accents, responsive layouts and no decorative imagery or marketing sections.
- Private lecturer results: counts, average rating, sentiment distribution, representative comments, keyword topics, search, filtering, pagination, CSV and review history.
- Durable hosted D1 storage; local development has its own separate database.
- Independent random public/private keys, private-key digest storage, parameterized SQL and session checks on the server.
- Short comments such as “very good” are valid. Different students can submit the same words; browser receipts prevent accidental retry duplicates.
- A three-class English word + character TF-IDF / Logistic Regression model. Typographical variants can share character features.
- A separate mixed-opinion clause heuristic and a narrow “not bad” idiom rule. Unsupported scripts are retained for human review.
- No paid AI API, API key or network AI call at prediction time.

The “What worked / What to improve” view selects actual comments, alongside sentiment and keyword counts. It is an extractive overview, not a Gemini-generated paragraph. Comments are not silently sent to a third-party AI provider.

## Measured AI results

The new corpus contains **5,856 normalized unique comments**: 2,877 student-feedback comments from NLPC-UOM and 2,979 additional general sentiment examples from UCI. It replaces the deployed 40-row binary model. There are **4,684 training** and **1,172 held-out** rows; duplicates are resolved before splitting.

| Evaluation of the learned three-class model | Result |
|---|---:|
| Combined held-out accuracy | 80.80% |
| Student-feedback held-out accuracy (576 comments) | 77.78% |
| Student-feedback macro F1 | 0.7231 |
| Combined majority-label baseline | 55.03% |
| Simulated single-character deletion accuracy | 79.18% |

These are offline corpus results, not guaranteed classroom accuracy. The old 25% five-fold demo score used a different dataset and protocol, so it is not a controlled before/after benchmark. Neutral recall remains weaker; Tamil, Sinhala, romanized language, sarcasm, new domains and real-world misspellings need further evaluation. Mixed/idiom rules are outside the three-class benchmark. A probability is a model score, not “percent correct”.

[Training, source data, limitations and retraining](docs/AI_TRAINING.md) · [Machine-readable metrics](docs/model-evaluation.json) · [Dataset attribution](THIRD_PARTY_NOTICES.md)

## Code map

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Create form, student form, lecturer results and review dialog |
| `app/globals.css` | Responsive styling, focus and readable layout |
| `app/api/[...path]/route.ts` | Worker API entrypoints |
| `lib/service.mjs` | Input validation, session authorization and database operations |
| `lib/inference.mjs` | Server-only TF-IDF inference and documented rules |
| `lib/feedback.mjs` | Shared sentiment counts, topic matching, selected comments and safe CSV |
| `lib/model.json` | Numerical trained model; no Python runtime needed on the server |
| `python/train_feedback.py` | Download, clean, split, train, evaluate and export the current web model |
| `db/schema.ts`, `drizzle/` | Five-table SQLite schema and immutable migration history |
| `scripts/migrate-local.mjs` | Apply pending local D1 migrations without account sign-in |
| `self-host/` | Configure an independent Cloudflare Workers + D1 deployment |
| `tests/` | Real SQLite API tests, migration preservation and sklearn/JS parity |
| `python/app.py` | Preserved **legacy** Streamlit learning prototype; separate model/database |
| `docs/` | Setup, architecture, development record, testing, hosting and model explanation |

## Validate

```sh
npm run check
npm test
npm run build
```

The web suite checks the real create/submit/review/close workflow, private-link isolation, SQL-shaped input, receipts, validation, CSV escaping, common typing variants, numerical parity and preservation of records during schema upgrades. GitHub Actions also runs the 20 preserved Python prototype tests.

## Data and operating limits

- No name, student ID, email or IP address is stored as a feedback field. Free-text and hosting logs can still identify people; anonymity is not guaranteed.
- Feedback is 2–2,000 characters, optional rating 1–5, maximum 1,000 responses per class. There is no account identity check, automated moderation or deletion/retention scheduler.
- Public root visitors can create their own isolated class. Larger public deployments need abuse controls and load testing.
- Original AI suggestions and model version are retained; human corrections override displayed labels and append history. Corrections do not automatically retrain the model. Older submissions keep their original model prediction.
- GitHub hosts the source, not the running server/database. Local, managed Site and independently hosted databases are separate.
- The included React/Vinext runtime contains framework scaffolding; the application-specific entrypoints are listed above. Vinext is beta, so dependency updates should be tested before deployment.

No PDF was generated for this revision. The code map, source index, model report and development log are retained for the requested later line-by-line documentation.
