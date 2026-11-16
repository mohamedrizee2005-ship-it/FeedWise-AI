# Run a downloaded copy

## Start the current project

1. Download this repository with GitHub **Code → Download ZIP**. Extract the ZIP; do not run from inside the compressed folder.
2. Install Node.js 24, then reopen VS Code. Check `node --version` and `npm --version` in **Terminal → New Terminal**.
3. Open the extracted folder containing `package.json`. On Windows, double-click `FIRST_SETUP.bat` and wait for “Setup complete”. Internet is needed for dependency installation.
4. Double-click `RUN_FEEDWISE.bat`. Open the exact localhost address shown in the terminal (normally port 5173 for standalone development).
5. Enter a class title. Save the private results link, then copy the separate student link.

Terminal alternative, from the same folder:

```sh
npm ci
npm run prepare:local
npm run dev
```

`npm run prepare:local` builds once and runs the tracked migrations against local D1 SQLite. Run it after pulling schema updates. It keeps a local migration ledger so repeat runs skip applied files. There is no MySQL installation, SQL password, ChatGPT login or AI API key for this app. The shipped numerical model is ready to use. Do not run Python setup to start the primary web app.

To check the compiled application instead of development mode:

```sh
npm run build
npm start
```

Open the URL that command prints. Stop a server with Ctrl+C before starting another. Keep `.wrangler/state` if you want local feedback to remain between runs; do not commit/share that directory. Download lecturer CSV exports for independent backups.

## Confirm it works

1. Create a class and keep the private results page open.
2. Open its student link in another browser/private window, write “very good” and submit.
3. Refresh lecturer responses: the saved comment and positive suggestion should appear.
4. Select **Review**, choose a label and save. The counts should use your review, while history and the original suggestion remain.
5. Close feedback. A new student window should display **Feedback closed**. Reopen to resume submissions.
6. Export CSV and confirm the comment/rating/review are present.

The browser remembers a receipt within its tab session, so reloading after submission shows the success state. Another browser session can submit independently. This is retry protection, not proof of one student per response.

## Common problems

| Symptom | Action |
|---|---|
| `node` or `npm` not recognized | Install Node.js 24 and reopen VS Code/terminal. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd` in place of `npm`, Command Prompt, or the provided `.bat` files. No execution-policy change is necessary. |
| Cannot find `package.json` | Open the extracted repository root, then open its terminal. |
| Feedback storage error / missing tables | Stop the server; run `npm run prepare:local`, inspect migration output and restart. |
| “table already exists” from an old manual setup | Preserve/export the old local database first. Do not delete it as a quick fix; its migration ledger needs reconciliation. Hosted data is separate. |
| Port already in use | Stop the prior server or use `npm run dev -- --port 5174`; open the printed address. |
| Phone cannot open a localhost link | Localhost refers to the phone itself. Use the published HTTPS app or deploy your own copy. |
| Private results link lost | There is no account recovery. Use the private-link file/bookmark you saved. A public student link cannot recover results access. |
| Tamil/Sinhala comment needs review | Storage supports Unicode; the current sentiment model is English. Review the label manually. |

## Updates and preservation

Keep a backup of local runtime data and private links before replacing a project folder. GitHub ZIPs contain source and the numerical model, not hosted feedback. Pulling code does not download the managed Site database. The `python/` directory is a preserved legacy Streamlit prototype with a different local database and old model; its historical launchers do not start this web app.
