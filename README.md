# FeedWise AI — Anonymous Student Feedback & Teaching Improvement (Educational Prototype)

FeedWise AI is a **local Streamlit + SQLite** project with three portals:

- **Student** (`http://localhost:8501`): choose an active course and submit text feedback without a student login.
- **Lecturer** (`http://localhost:8502`): sign in, see **only assigned courses** and authorized comments, view a demonstration sentiment model, issues, recommendations, charts, and save human sentiment corrections.
- **Administrator** (`http://localhost:8503`): sign in, create/archive courses, create/enable/disable lecturer accounts, assign/revoke course access.

**Warning:** Anonymous *form* does not guarantee anonymous *feedback*. Free-text can identify a student. No production deployment or real student feedback is recommended without privacy review, security hardening, institutional permission, proper consent and a data retention policy. The sentiment model uses a small, authored example dataset and is **not validated** for real university use.

## Fast setup — Windows 11 + VS Code

1. Extract the ZIP. Open the `FeedWise-AI` folder in VS Code.
2. Install Python 3.11–3.14 and make sure `py` or `python` works on the computer.
3. Double-click **`01_FIRST_SETUP.bat`**. This creates `.venv`, installs requirements, creates the SQLite database, trains the *demo* ML model, and asks you to create the **first administrator**. Admin password typed into terminal is hidden. Never share it.
4. Double-click **`RUN_ADMIN.bat`** to manage courses and lecturer accounts. Create a lecturer and assign a course.
5. Double-click **`RUN_STUDENT.bat`** and **`RUN_LECTURER.bat`** (separate windows). Lecturer credentials come from the Admin Dashboard.
6. Keep the terminal windows open while using the web apps. Each site is bound to **127.0.0.1**, not your whole network.

Alternative terminal commands (inside the project folder):

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe setup.py
.venv\Scripts\python.exe create_admin.py
.venv\Scripts\python.exe -m streamlit run admin_app.py --server.address 127.0.0.1 --server.port 8503
```

Other app filenames: `student_app.py` (8501), `lecturer_app.py` (8502).

## Fresh database, not an automatic migration

This ZIP **does not contain your earlier database or old feedback**. The new project uses `data/feedwise.db` and **numeric `course_id` foreign keys**, unlike the original prototype's `feedback.course` string columns. **Do not overwrite or delete your original `feedwise.db`**; this project starts a new, separate database. If historical data must be migrated, first back up both databases and write/test a dedicated migration. Avoid copying the old DB into `data/` because schemas differ.

`setup.py` preserves existing tables/rows in this new schema but retrains its demo model when run again.

## Development and testing

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Test the full flow: Admin create course → Admin create lecturer → assign → Student submit → Lecturer view / correct → Dashboard counts update → Admin revoke access → Lecturer no longer sees course.

### File guide

| File | Purpose |
|---|---|
| `admin_app.py` | Admin web portal and account/course management |
| `student_app.py` | Student feedback submission |
| `lecturer_app.py` | Authorized lecturer view and human correction |
| `database.py` | Database schema, queries, permission checks |
| `security.py` | Password hashing and verification (PBKDF2) |
| `ml.py` | Demo TF-IDF + Logistic Regression model |
| `insights.py` | Keyword issue tags and template recommendations |
| `training_data.csv` | Small demonstration training dataset |
| `setup.py` | Create schema, default courses and train model |
| `create_admin.py` | Local one-time first admin bootstrap |
| `config.py` | Config constants and file paths |
| `tests/` | Functional tests for data access and security guards |
| `docs/PROJECT_GUIDE.md` | System architecture, limitation and viva notes |

## ML caveats

The model is a supervised **TF-IDF + Logistic Regression** model trained from `training_data.csv`. The returned maximum probability is a model output, **not a calibrated accuracy or real-world reliability score**. The 70% review flag is a heuristic. Human-corrected sentiment always takes priority in dashboard aggregations. Issue tagging and recommendations are **keyword/rule based**, not another AI model. Labels are limited to positive/negative; neutral/mixed feedback is not properly represented.

## Security limitations

- Admin password creation is local CLI only, not public self-registration.
- Lecturer access to feedback and write corrections is checked again in SQL.
- The apps run on localhost by default, not on a public server.
- No MFA, session expiration policy, login throttling, password reset, teacher self-service password changes, anti-spam, abuse controls, personally identifying information filter, or moderation.
- Streamlit session state is a local prototype mechanism, not a substitute for a production-grade auth system.
- Student submissions are not personally authenticated, so repeated submissions are possible.
- Raw comments can identify students. The application currently does **not** claim privacy compliance or guaranteed anonymity.

## GitHub publishing

1. Run tests and confirm the three portals work.
2. **Never publish `data/feedwise.db`, `.venv/`, `models/`, passwords, or real feedback.** `.gitignore` excludes them.
3. Initialize a Git repository (or use VS Code Source Control), then inspect the staged files before committing.
4. Push to a new GitHub repository. Include `README.md` and `docs/PROJECT_GUIDE.md`.
5. Do not deploy the three apps publicly without security and privacy work.

This is an educational project; it should not be described as a proven, fully secure or production-ready university system.
