# FeedWise AI

A lecturer creates a feedback form. Students open the form, write in English, Tamil, Sinhala or a mixture, and can send another response. The lecturer’s private results link opens sentiment, student quotes, teaching suggestions and review controls. FeedWise runs on your PC with Node.js, React and SQLite.

## Run on Windows

1. Install the **Windows x64 Installer (.msi) for Node.js 24 LTS** from [nodejs.org](https://nodejs.org/en/download). Keep the installer defaults. Open a new Command Prompt and run `node -v`. It should show `v24.x.x`.
2. On this GitHub page choose **Code → Download ZIP**. In File Explorer right-click the ZIP, choose **Extract All**, then open the extracted folder containing `package.json`.
3. Double-click **FIRST_SETUP.bat** once. It downloads the packages and builds the interface. A moving spinner is normal. Wait for **Setup complete**.
4. Double-click **RUN_FEEDWISE.bat**. Leave that terminal window open and visit **http://localhost:3000** in your browser. To stop, press **Ctrl+C** in that window. Open the same batch file next time.

**Using VS Code, macOS or Linux?** Open the extracted folder in VS Code, select **Terminal → New Terminal**, and run these commands one at a time. On Windows, choose **Command Prompt** from the terminal menu if PowerShell blocks npm scripts.

```sh
npm ci
npm run build
npm start
```

Open the localhost address printed in the terminal. The default address works on the computer running FeedWise. A student using a different device would need a separately hosted, reachable service. GitHub stores the source code. The normal installation and feedback workflow require no account, Python installation or AI API key.

## Use a class

1. Enter a class title and optional question. Select **Create feedback link → Class links**.
2. Choose **Save private link** for yourself. Anyone who holds this link can manage the class. Use **Student link** to open the separate student form.
3. Students can change the interface language, enter a comment and optionally choose a 1–5 rating. **Submit another response** opens an empty form. Retrying the same submission uses the same receipt.
4. In **Overview**, each suggested improvement has a supporting quote. One mixed response counts once in the sentiment totals and can supply both a strength and a concern. Select **Refresh** to load new submissions.
5. In **Responses**, use **+** or **−** to save a positive or negative review. **Review** also offers mixed and neutral and shows earlier decisions. You can search, filter, export CSV and close or reopen the form.

## How FeedWise learns

The first pass uses multilingual phrases, negation and requests. The included English word/character classifier handles other English wording when its score is high enough. Numeric ratings are displayed separately. Uncertain wording can be sent for lecturer review.

A lecturer’s saved label takes effect immediately in **that class**. Repeated wording matches across differences in case, repeated spaces and common trailing punctuation. After six distinct reviewed texts across at least two labels, a small classifier also compares new wording with previous examples. It needs strong matching neighbours and agreement before suggesting a label. Edited corrections take effect on the next prediction. The original prediction and review history remain available.

**Optional deeper analysis.** Install [Ollama for Windows](https://docs.ollama.com/windows) on the FeedWise PC. In a terminal run the following once, with an internet connection for the model download (about 3.4 GB).

```sh
ollama pull gemma3:4b
```

Leave Ollama running. Open **Learning & analysis → Refresh**. Once it shows **Local model ready**, open an unreviewed response under **Responses → Review → Analyse with local AI**. FeedWise sends that comment and up to six examples from that class to the local model. Initial submissions use the fast analysis. Completed deep analyses are saved. If the local model stops, students can still submit. [Model details](https://ollama.com/library/gemma3:4b)

## Data and evaluation

The bundled English classifier used **4,684 training examples** from **5,856 unique texts**. It scored **77.78% on 576 held-out English student comments**. The earlier report also includes general-domain text. Accuracy on real Tamil, Sinhala and mixed-language classes still needs independently labelled feedback.

To measure your own results, reserve a fresh class for evaluation and review every response, including correct predictions. Keep identifying details out of exports. Select **Learning & analysis → Export corrections**. Place the file in a local folder named `training/private`, rename it `heldout.jsonl`, then run:

```sh
node training/evaluate_corrections.mjs training/private/heldout.jsonl
```

The report compares the first-pass analyser with your labels. It counts uncertain predictions, removes duplicate wording, reports conflicting labels and breaks results down by estimated language. Use separate classes for tuning and final evaluation. The automatic class learner runs inside the app. The optional Python script `training/train_model.py` reproduces the original English classifier from its public sources. Dataset attribution is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Keep your existing classes

Stop FeedWise before copying its **data** folder. Keep a backup of that folder, your private results links and the original project version. For a downloaded update, extract the new ZIP to a new folder, copy the backed-up `data` folder next to the new `package.json` before the first launch, then repeat setup. Reopen your saved results link using the same address and port. Database migrations preserve earlier comments, predictions and saved reviews. The default database is `data/feedwise.sqlite`. You can set `FEEDWISE_DB_PATH` to use a different local database.

## Development

```sh
npm run dev
npm test
npm run build
```

Development uses http://localhost:5173 and the local API on port 3001. To change the compiled app’s port, run `npm start -- --port 3002`. The UI is in `src/`, analysis and storage in `server/`, shared analysis rules in `shared/`, SQL migrations in `database/migrations/`, evaluation tools in `training/` and automated checks in `tests/`.
