# How the AI works and how to train it

## What changed

The deployed model previously learned positive/negative sentiment from 40 authored sentences. The current model learns **positive, negative and neutral** from **4,684 training comments**, with a separate **1,172-comment test split**. A small documented rule handles clearly opposing opinions in different clauses as **mixed**. None of this is training a model as large as Gemini; a focused classifier is practical on a student laptop and in a small hosted Worker.

A dataset's size and a model's accuracy are different measurements. “50% accuracy” does not mean “50% of the data was used”. Here 80% of the deduplicated corpus is for training and 20% is reserved for evaluation. Adding unrelated millions of sentences is not automatically better than adding representative, correctly labelled classroom comments.

## Data sources

1. **NLPC-UOM Student Feedback Analysis Dataset**, published by University of Moratuwa researchers. The source describes 3,000 student-feedback comments with document and finer-grained annotations. FeedWise reads the document-level sentiment annotations in six XMI files from a pinned revision.
2. **UCI Sentiment Labelled Sentences**, 3,000 positive/negative general reviews. This adds common short expressions but is not university feedback. General and student-specific evaluation are reported separately.

Read `THIRD_PARTY_NOTICES.md` for authors, licenses, paper links and source locations. The extractor produces 2,877 unique student comments after normalized-text voting and excludes two tied label votes. After additional cross-source deduplication, UCI adds 2,979 rows: **5,856 total**. Raw corpora are cached locally and ignored by Git. Source SHA-256 hashes are saved in the report; public corpora can still contain names, so do not republish them as your own student data.

## Step by step

1. **Download** the pinned public annotation files and UCI archive. No AI API key is needed. The cache avoids repeated downloads.
2. **Read annotations** using XML/ZIP standard libraries. UIMA offsets use UTF-16 code units; the extractor slices encoded text using those offsets so emoji/non-ASCII text does not shift boundaries.
3. **Normalize** Unicode, lowercase text, normalize whitespace and replace URLs/emails with spaces for model features. The database still retains the original submitted comment.
4. **Deduplicate before splitting.** Identical normalized comments are grouped. Majority document labels are used; tied conflicting votes are excluded. This prevents exact copies from entering both training and test sets. Near-duplicate comments, the same lecturer or the same course can still cross the split; this is not a new-university generalization test.
5. **Reserve 20%** with a reproducible seed of 42, stratified by source and label. The test rows are never passed to `.fit()`. The word/character vocabularies and IDF values are fitted only on training rows.
6. **Create two feature sets.** Word unigrams/bigrams capture phrases such as “not good”. Character n-grams of length 3–5 capture overlapping letter fragments, helping “good”, “goood” and some misspellings share features. Each TF-IDF block is L2-normalized separately, then concatenated. Each block is bounded to 22,000 features.
7. **Fit Logistic Regression**, with class balancing, C=3, max_iter=800 and seed 42. It is a supervised classifier, not a generative language model. The model does not use the optional star rating to decide sentiment.
8. **Evaluate** accuracy, macro F1, per-class precision/recall and a confusion matrix. A majority-label classifier provides a baseline. A separate diagnostic deletes one character from held-out words; this is a simulation, not a claim that every real typo is understood.
9. **Export** the vocabulary, IDF, coefficients, intercepts, classes, report and artifact version as `lib/model.json`. The Worker computes the same word/character features and softmax probabilities. The browser does not download model weights.
10. **Verify parity** on 52 authored strings. This checks numerical agreement between Python and JavaScript; the generated expected labels are model predictions, not an independent accuracy benchmark.
11. **Apply transparent runtime rules.** Clearly positive and negative evidence in different clauses can produce “mixed”. A narrow short-phrase rule interprets “not bad” as positive. These are separate from the learned three-class metrics. Predominantly non-English scripts receive “Needs review”; this is a script heuristic, not a validated language detector. Romanized Tamil/Sinhala can still be mistaken for English.
12. **Keep human review.** Lecturer corrections override the displayed label and append audit history. They never erase the original AI prediction. Corrections are not automatically training labels for a future model.

## Reproduce the shipped model

Use Python 3.12. From the repository root on Windows:

```powershell
py -3.12 -m venv .venv-training
.venv-training\Scripts\python.exe -m pip install -r python/requirements-training.txt
.venv-training\Scripts\python.exe python/train_feedback.py
npm test
npm run check
npm run build
```

On Linux/macOS use `python3 -m venv .venv-training` and `.venv-training/bin/python` instead. The default cache is `python/data/training-cache/`. For an existing external cache:

```sh
python python/train_feedback.py --cache /path/to/training-cache
```

Outputs are `lib/model.json`, `docs/model-evaluation.json` and `tests/model-parity.json`. Training overwrites those numerical/evaluation artifacts, **not feedback databases**. Review changed metrics before committing/deploying. The compatibility script `python/export_model.py` now delegates to this trainer, preventing accidental replacement with the old incompatible 40-row artifact.

The checked-in training versions are Python 3.12, scikit-learn 1.8.0 and NumPy 2.3.5. Platform/BLAS differences can cause small coefficient differences. Source revision, file hashes, parameters and split are retained for reproduction.

## Results and their meaning

| Held-out evaluation | Accuracy | Macro F1 |
|---|---:|---:|
| Combined corpus (1,172 comments) | 80.80% | 0.7458 |
| Student feedback only (576 comments) | 77.78% | 0.7231 |
| Majority-label baseline, combined | 55.03% | — |
| Single-character deletion simulation, combined | 79.18% | See JSON report |

Student-only neutral recall is about 59.8%, so neutral feedback is a weaker area. “very good”, “verry good”, “very goood”, “very gud”, “not good”, the narrow “not bad” rule and two mixed-clause examples have regression checks. These examples do not prove universal grammar/negation understanding. Sarcasm, factual statements, mixed opinions within one clause and longer arguments can still be wrong.

The previous demo's 25% five-fold score was on 40 different examples. The new metrics are useful evidence for this version but are not a controlled comparison with identical data and splits. No Gemini-equivalent capability or real Kelaniya classroom accuracy is claimed.

## Improve it further with your own feedback

Collect representative comments only with permission and an appropriate privacy policy. Export CSV, remove identities, and have at least two annotators independently label positive/negative/neutral/mixed comments using a shared guide. Reconcile disagreements. Include short comments, long multi-opinion comments, typos, negation, neutral suggestions, and actual Tamil/Sinhala/code-switched examples if you want to support those languages.

The current trainer accepts the two named public corpora; it does **not** automatically import exported lecturer CSVs. A reviewed CSV is a starting point for a future dataset adapter, not a trained model. Keep an untouched test set grouped by course/lecturer and time so later work can measure transfer to new classes. Use training/validation for tuning; evaluate the final candidate once on that untouched test set. Never mix the same comment and its synthetic typo variants across splits. A lecturer correction alone is not independent ground truth.

A later multilingual transformer or existing foundation-model API can understand more context. Evaluate it against the same private, representative test set before replacing this classifier. A free CPU Worker is not suitable for training or loading a large transformer; training happens offline, then a compact artifact is deployed.

## Free API keys and ChatGPT

The shipped app is self-contained for sentiment and selected-comment summaries. It does not need to “connect to ChatGPT”, use your ChatGPT browser session, or receive an API key in chat.

Google AI Studio can provide a Gemini API key for supported free-tier models. Create it in your own account at https://aistudio.google.com/api-keys, choose an eligible model using the current pricing page and inspect the account's active quotas. **A free hosted API is not unlimited.** Gemini limits apply per project (requests/tokens per minute and requests per day); generating more keys does not remove those limits. Do not turn on paid billing merely to obtain unlimited access.

Google states free-tier content may be used to improve its products. Do not silently send identifiable student comments to an unpaid external service. If a later version adds optional Gemini summaries, it needs an operator-configured server-side secret, appropriate student notice/consent, redaction, bounded requests, caching, rate-limit handling and the current local fallback. Never put a key in `app/page.tsx`, a `NEXT_PUBLIC_*` variable, source control or a student URL.

No Gemini API client is enabled in this release. The existing overview shows actual comments and keyword counts, so core submission/review continues without external AI quotas. Running a model on your own machine also avoids per-request provider billing, but hardware and hosting still have limits.

Official references (checked 16 November 2026):

- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/terms
- https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction
- https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html
