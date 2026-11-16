# FeedWise AI — Project Guide and Viva Preparation

## 1. Problem and objective

Collect course feedback through a student-facing form and help lecturers review sentiment, common themes and improvement suggestions. Staff manage courses and authorized lecturers through a separate local dashboard. A student login is **not** required, but this is **not a guarantee of anonymity**.

## 2. Architecture

```text
Student portal → Python validation → SQLite feedback table
Admin portal → admin authentication → courses / lecturers / assignments
Lecturer portal → lecturer authentication → SQL course authorization
                                         ↓
                                  feedback text
                                         ↓
                          TF-IDF + Logistic Regression
                                         ↓
                           human correction override
                                         ↓
                charts + issue keywords + recommendation templates
```

## 3. Database entities

- `admins(id, username, password_hash)` — local administrator identity
- `courses(id, course_name, active)` — authoritative course catalog
- `lecturers(id, username, password_hash, active)` — authorized lecturer accounts
- `lecturer_courses(lecturer_id, course_id)` — many-to-many course permissions
- `feedback(id, course_id, comment, created_at)` — student-submitted feedback; no student ID column
- `feedback_reviews(id, feedback_id, lecturer_id, corrected_sentiment, reviewed_at)` — latest human correction per comment

## 4. Key algorithms

### Password storage

`security.password_hash` uses a random 16-byte salt, PBKDF2-HMAC-SHA256 and 600,000 iterations; verification uses constant-time `hmac.compare_digest`. The original password is not stored.

### Sentiment model

`training_data.csv` → `TfidfVectorizer(ngram_range=(1,2))` → `LogisticRegression` → `models/sentiment_model.joblib`. **Training sentences are tiny and hand-written**; a rigorous real-world evaluation dataset is still needed. Model probabilities are not proof of accuracy.

### Human correction priority

`effective_sentiment = saved_human_label if present else ai_prediction`. All positive/negative counts, charts and issue analysis use the *effective* label. Only an authorized lecturer can save corrections for their assigned course.

### Rule-based issue analysis

`insights.detect_issue` looks for keywords in *negative* comments and returns the first matching category. It can miss or misclassify nuanced statements. `RECOMMENDATIONS` maps the category to a fixed suggestion. `summarize` uses a deterministic text template.

## 5. Streamlit UI workflow

`st.form` collects input, `st.session_state` retains a login within its current Streamlit session, `st.stop` prevents rendering protected content before login, and `st.rerun` refreshes after changes. Streamlit is used for rapid educational prototyping, not production identity management.

## 6. Privacy and security honesty

Avoid real student input. Course-specific lecturer permissions protect access to stored comments, but raw comments may include names or identifying details. There is no student consent workflow, anonymization review, formal privacy assessment, abuse monitoring, retention/deletion policy or production deployment hardening. The lecturer model is not validated for teaching evaluation or high-stakes decisions.

## 7. Verification checklist

1. Fresh `01_FIRST_SETUP.bat` finishes successfully.
2. Admin login succeeds; incorrect password fails.
3. Admin adds course; repeated course name fails.
4. Admin creates lecturer; repeated username fails.
5. Admin assigns course; lecturer sees it.
6. Student submits test feedback for that course.
7. Lecturer sees submitted test feedback, count and chart.
8. Lecturer corrects sentiment; summary and chart update.
9. Admin revokes assignment; lecturer can no longer see that course.
10. Admin disables lecturer; new login is refused.
11. Run `pytest` tests; verify all pass.
12. Before pushing to GitHub, check there is no `.db`, `.venv`, password or real feedback in the staged files.

## 8. Viva questions and short answers

**What is TF-IDF?** Numerical word weighting based on term frequency and inverse document frequency.

**Why Logistic Regression?** A simple, explainable supervised baseline for two-class text classification.

**What is supervised learning?** Learning from example texts paired with labels.

**What is authentication?** Checking who logs in via salted password-hash verification.

**What is authorization?** Checking which course data an authenticated lecturer may access.

**Why parameterized SQL?** Separates SQL statements from input data to reduce SQL injection risk.

**What is a foreign key?** Constraint connecting a row to an existing referenced row in another table.

**Does the app guarantee anonymity?** No; no student ID is asked for, but text may identify the writer.

**Can you claim 90%+ accuracy?** No. The demo dataset is too small and insufficient for credible real-world accuracy claims.

**How is correction prioritized?** Effective sentiment is saved human label if present; otherwise model label.

## 9. Work remaining before real deployment

Formal privacy requirements, security review, authenticated multi-user infrastructure, consent and retention policies, evaluation on representative labeled feedback, multilingual feedback testing, monitoring, backup/recovery, configurable permissions and secure application deployment.

A full line-by-line annotated PDF can be prepared from the final GitHub code *after* the repository has been reviewed and finalized so the explanations match the exact final version.
