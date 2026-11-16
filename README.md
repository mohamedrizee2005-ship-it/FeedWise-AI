# FeedWise AI

Classroom feedback collection and sentiment analysis. Lecturers create a class, share its student link and privately review the results. Runs on your own PC with React, Node.js and SQLite. No accounts or AI API keys are required.

## Run locally

Install **Node.js 24**, download this repository with **Code → Download ZIP**, and extract it.

**Windows:** run `FIRST_SETUP.bat` once, then run `RUN_FEEDWISE.bat`.

Or use a terminal in the extracted folder:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3000**. Keep the terminal open while using the app. Stop with Ctrl+C; run `npm start` to start again. Dependency installation needs Internet; the installed app and included model run locally.

## Use

1. Enter a class title and optional question.
2. Save the **private results link**; it is the lecturer's access key.
3. Share the separate **student link**. Students submit comments and optional ratings.
4. Review sentiment, selected comments and topics. Correct labels, search/filter, export CSV, or close/reopen feedback.

Localhost links work on the PC running the app. Public or classroom network hosting is not configured. Keep the same browser address/port when reopening saved links. Anyone with a private results link can manage that class; there is no account recovery.

## Project files

| Folder | Purpose |
|---|---|
| `src/` | Student form and lecturer interface |
| `server/` | Local HTTP API, SQLite storage and trained sentiment model |
| `shared/` | Sentiment counts, keyword topics and CSV export |
| `database/migrations/` | Versioned SQL schema updates applied automatically on startup |
| `training/` | Optional model training source, dependencies and evaluation |
| `tests/` | API, persistence, migration, HTTP and numerical model checks |

Feedback is stored in **`data/feedwise.sqlite`**, outside Git. Closing the app keeps it. Back up the `data` folder while the app is stopped; do not delete it when updating source. Existing data from other app versions or online deployments is not automatically imported. `FEEDWISE_DB_PATH` can select another local SQLite file.

## Development

```sh
npm run dev
npm test
npm run build
```

Development uses http://localhost:5173 with the API on loopback port 3001. The normal compiled app uses port 3000 (`npm start -- --port 3002` selects another port). No Python installation is needed to run it.

The included English word/character TF-IDF classifier learns positive, negative and neutral; a separate clause rule handles mixed opinions. Student-feedback held-out accuracy is 77.78%. Predictions need lecturer review; other languages, sarcasm and unfamiliar writing are not guaranteed. The overview displays selected comments and keyword counts. Data-source attribution is retained in `THIRD_PARTY_NOTICES.md`.
