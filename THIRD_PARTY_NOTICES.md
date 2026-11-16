# Training data and third-party notices

## NLPC-UOM student feedback

Herath, Chamindu, Maduwantha and Ranathunga, **Dataset and Baseline for Automatic Student Feedback Analysis**, LREC 2022.

- Paper: https://aclanthology.org/2022.lrec-1.219/
- Published corpus: https://huggingface.co/datasets/NLPC-UOM/Student_feedback_analysis_dataset
- Pinned revision: `3aa628742261837ea5e9d5e658a7ddd9a6f4f317`
- Dataset README declares MIT licensing. The source authors retain their attribution; FeedWise does not claim authorship of their comments or annotations.
- FeedWise parses the six XMI annotation parts, aggregates document-level sentiment votes by normalized exact text, excludes tied votes and uses 2,877 unique student comments. UIMA offsets are UTF-16 code units.

## UCI Sentiment Labelled Sentences

Dimitrios Kotzias, Misha Denil, Nando de Freitas and Padhraic Smyth, **From Group to Individual Labels Using Deep Features**, KDD 2015.

- Dataset: https://archive.ics.uci.edu/dataset/331/sentiment+labelled+sentences
- DOI: https://doi.org/10.24432/C57604
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
- The source provides 3,000 positive/negative sentences from Amazon, Yelp and IMDb. FeedWise normalizes/deduplicates text and uses 2,979 additional unique examples as supplementary general sentiment, not university-specific feedback.

Raw downloaded corpora remain in an ignored training cache. Source hashes, row counts, exclusions, split and evaluation are retained in `training/evaluation.json`. The numerical model is a learned derivative; original data/annotations are credited to the authors above. Diagnostic parity strings are authored examples, not redistributed student reviews.

## Dependencies

React, Vite, Lucide, TypeScript and scikit-learn retain their upstream licenses.
The package lockfile identifies the JavaScript dependencies. Dataset authors
retain the rights to their comments and annotations; FeedWise does not claim
authorship of those datasets.
