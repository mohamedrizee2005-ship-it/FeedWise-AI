# Legacy Python learning prototype

For the current classroom app, open the repository root README. This preserved Streamlit prototype uses the original 40-row model, a different UI and a separate local database. It is not the deployed web app. Use `python/train_feedback.py` from the repository root to train the current web model.

## Original prototype guide

A simple classroom feedback app: **create a lecture -> share its student link -> review responses with AI**.

There are no student accounts, lecturer accounts, passwords, Admin portal, course assignments or semester screens. One Streamlit app serves both the student form and the private lecture dashboard.

## How it works

1. The lecturer opens the app and enters a lecture title, with optional instructions.
2. FeedWise creates two independent links:
   - **Student link**: opens the feedback form. It cannot read responses or manage the lecture.
   - **Private review link**: opens that lecture's responses, AI suggestions, summary and charts. Keep/bookmark it; do not share it with students.
3. Students submit a comment and an optional 1-5 rating, without logging in.
4. The lecturer refreshes the private page, reviews the analysis, corrects labels if needed, downloads CSV, and closes/reopens collection.

The private link acts as an access key. Anyone who possesses it can review/manage that lecture. There is no identity verification or account recovery. Losing it means losing dashboard access unless the app operator restores it from a separately retained copy. Keep it out of public messages, screenshots, logs and Git commits. The database stores only its SHA-256 digest.

## Run on Windows / VS Code

Use Python 3.12 (tested).

1. Download/extract the repository, then open its folder in VS Code.
2. Double-click `01_FIRST_SETUP.bat`. It creates `.venv`, installs dependencies, initializes a **new** database and trains the demo model. No account setup is requested.
3. Double-click `RUN_FEEDWISE.bat`.
4. Open http://localhost:8501 and create a lecture.
5. Keep the terminal running. Bookmark the private review link before sharing the separate student link.

Or use the VS Code terminal:

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe setup.py
.venv\Scripts\python.exe -m streamlit run app.py
```

Linux/macOS: use `python3`, then `.venv/bin/python` in place of the Windows interpreter path.

## Open it on student phones

`localhost` points to the device opening the link. A student phone cannot reach your laptop using a localhost URL. **Publishing code on GitHub does not host the running app.**

For a classroom demonstration on the same trusted Wi-Fi:

1. Find the laptop's IPv4 address with `ipconfig` (for example `192.168.1.10`).
2. In PowerShell, replace the example address below with that laptop address:

```powershell
$env:FEEDWISE_PUBLIC_URL="http://192.168.1.10:8501/"
.venv\Scripts\python.exe -m streamlit run app.py --server.address 0.0.0.0 --server.port 8501
```

3. Allow Python through Windows Firewall for the private network if prompted.
4. Open that address on the lecturer laptop, create a lecture and share its generated student link. Keep all devices on the same network and keep the laptop awake.

Some university/guest Wi-Fi networks isolate devices. This method does not provide an Internet-wide or encrypted HTTPS service. For students on different networks, deploy `app.py` to a Python/Streamlit host with HTTPS and durable database storage. Set `FEEDWISE_PUBLIC_URL` to the real hosted app URL if it sits behind a proxy.

Streamlit Community Cloud can run a demo from GitHub, but its local files are not guaranteed to persist. Do not rely on local SQLite there for lasting classroom feedback; use a host with a persistent volume or add an external database adapter first. Deployment is not performed by this repository update.

Official references: [Streamlit deployment](https://docs.streamlit.io/deploy/streamlit-community-cloud), [local storage persistence](https://docs.streamlit.io/develop/concepts/connections/connecting-to-data), [request context](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.context).

## AI analysis and honest limits

- Sentiment uses the original 40 authored English sentences, TF-IDF and Logistic Regression.
- Five-fold demo accuracy is **25%**, macro F1 **0.2481**; a majority-label baseline scores **50%** accuracy. This model needs a better representative dataset. Its outputs are suggestions, not verified judgments.
- The model predicts positive/negative. A lecturer can manually choose positive, negative, neutral or mixed. Saved human labels override the AI in the chart and summary, with an append-only review history.
- Topic detection supports multiple keyword categories per comment. Recommendations and summary are deterministic rules/templates, not an LLM or a trained aspect model.
- Model probability is not measured accuracy. English, Tamil/Sinhala, sarcasm, negation, neutral and mixed cases are not validated for real-world use.
- Predictions are cached by model artifact SHA-256, preserving earlier model versions. The model object is cached by file timestamp/size. Pagination limits rendered comment cards.
- Missing/corrupt model: the app still shows feedback and allows manual labels. Run `python setup.py` to rebuild the trusted local model.

```powershell
.venv\Scripts\python.exe ml.py
.venv\Scripts\python.exe -m pytest -q
```

## Database and upgrade behavior

This version uses **`data/feedwise_links.db`**. It does not overwrite the former account-based `data/feedwise.db` or any other old database. No historical data migration is assumed: lecture sessions are a different data model.

Five tables: `sessions`, `feedback`, `reviews`, `review_history`, `predictions`. Query/write authorization is based on the separate review key and is enforced in SQL, not just hidden UI controls. A session ID by itself grants no access.

The form asks for no name, ID, email or IP address. Free-text may still identify its writer, and the hosting server can have its own logs. This is not a guarantee of anonymity. A browser-session receipt avoids accidental repeated submits; a 60-second exact-text check reduces rapid replay. Neither guarantees one response per actual student or prevents organized spam. The root page allows anyone to create their own isolated lecture.

## Code and development record

| File | Responsibility |
|---|---|
| `app.py` | Create/share page, student form, private dashboard; routes by `s` or `r` query key |
| `database.py` | Five-table schema, SQL access guards, submissions, reviews and prediction cache |
| `analysis.py` | Testable analysis service, human overrides, counts and safe CSV export |
| `ml.py` | Validated CSV loading, training, cached inference, baseline evaluation |
| `insights.py` | Multiple keyword tags, recommendations, template summary |
| `links.py` | Generate links without leaking a review key into a student URL |
| `config.py` | Database/model paths and limits |
| `setup.py` | Prepare DB/model without account creation |
| `tests/` | Backend, AI-failure and actual Streamlit form tests |
| `docs/DEVELOPMENT_LOG.md` | Scope decisions, changes, rationale and limitations |
| `docs/CODE_WALKTHROUGH.md` | Function and data-flow explanation for the later PDF |
| `docs/LINE_INDEX.json` | Exact source lines/function ranges/SHA-256 for later line-by-line explanation |
| `docs/TEST_REPORT.md` | Executed verification and limits |

Optional environment variables: `FEEDWISE_DB_PATH` (durable SQLite path), `FEEDWISE_MODEL_PATH` (trusted model path), `FEEDWISE_PUBLIC_URL` (real reachable base address). Never commit generated databases, model files, actual student feedback or private links. `.gitignore` excludes runtime data. Only load trusted locally trained joblib files.

A comprehensive line-by-line PDF will be prepared when requested, using the final code snapshot. The earlier PDF describes the old three-portal version and should not be used as this version's documentation.
