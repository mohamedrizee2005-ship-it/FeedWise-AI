"""Session-scoped persistence. No users, passwords, roles or course assignments."""
import hashlib
import secrets
import sqlite3
from contextlib import contextmanager
from config import DB_PATH, MIN_COMMENT_LENGTH, COMMENT_LIMIT, LABELS


def token_hash(token):
    """Only a digest of the private review key is stored in SQLite."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


@contextmanager
def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH,timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=10000')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize_db():
    """Use a new database filename, leaving the previous account-based database untouched."""
    with connection() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
                prompt TEXT NOT NULL CHECK(length(prompt)<=500),
                student_token TEXT NOT NULL UNIQUE, review_hash TEXT NOT NULL UNIQUE,
                is_open INTEGER NOT NULL DEFAULT 1 CHECK(is_open IN (0,1)),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id),
                comment TEXT NOT NULL CHECK(length(comment) BETWEEN 10 AND 2000),
                rating INTEGER CHECK(rating BETWEEN 1 AND 5),
                submission_key TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS reviews (
                feedback_id INTEGER PRIMARY KEY REFERENCES feedback(id),
                label TEXT NOT NULL CHECK(label IN ('positive','negative','neutral','mixed')),
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS review_history (
                id INTEGER PRIMARY KEY, feedback_id INTEGER NOT NULL REFERENCES feedback(id),
                label TEXT NOT NULL CHECK(label IN ('positive','negative','neutral','mixed')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS predictions (
                feedback_id INTEGER NOT NULL REFERENCES feedback(id), model_version TEXT NOT NULL,
                label TEXT NOT NULL CHECK(label IN ('positive','negative')),
                probability REAL NOT NULL CHECK(probability BETWEEN 0 AND 1),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(feedback_id,model_version));
            CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedback(session_id);
            CREATE INDEX IF NOT EXISTS idx_history_feedback ON review_history(feedback_id,id);
        ''')


def create_session(title, prompt=''):
    title, prompt = ' '.join(title.split()), prompt.strip()
    if not 1 <= len(title) <= 100 or len(prompt) > 500:
        raise ValueError('Use a lecture title of 1-100 characters and instructions up to 500 characters.')
    student_token, review_token = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    with connection() as db:
        db.execute('INSERT INTO sessions(title,prompt,student_token,review_hash) VALUES (?,?,?,?)',
                   (title,prompt,student_token,token_hash(review_token)))
    return student_token, review_token


def student_session(token):
    """Student access returns only form metadata, never responses or the review digest."""
    with connection() as db:
        return db.execute('SELECT id,title,prompt,is_open FROM sessions WHERE student_token=?',(token,)).fetchone()


def owner_session(token):
    with connection() as db:
        return db.execute('SELECT id,title,prompt,student_token,is_open,created_at FROM sessions '
                          'WHERE review_hash=?',(token_hash(token),)).fetchone()


def submit_feedback(student_token, comment, rating=None, submission_key=None):
    comment = comment.strip()
    if not MIN_COMMENT_LENGTH <= len(comment) <= COMMENT_LIMIT:
        raise ValueError(f'Write {MIN_COMMENT_LENGTH}-{COMMENT_LIMIT} characters of feedback.')
    if rating is not None and (type(rating) is not int or not 1 <= rating <= 5):
        raise ValueError('Rating must be an integer from 1 to 5.')
    submission_key = submission_key or secrets.token_urlsafe(24)
    if not isinstance(submission_key,str) or not 10 <= len(submission_key) <= 100:
        raise ValueError('Invalid submission reference. Please refresh the form.')
    with connection() as db:
        # Serialize close/submit races and double-click checks within one transaction.
        db.execute('BEGIN IMMEDIATE')
        session = db.execute('SELECT id FROM sessions WHERE student_token=? AND is_open=1',
                             (student_token,)).fetchone()
        if not session:
            raise ValueError('This feedback link is invalid or closed.')
        previous = db.execute('SELECT session_id FROM feedback WHERE submission_key=?',(submission_key,)).fetchone()
        if previous:
            if previous['session_id'] != session['id']:
                raise ValueError('Invalid submission reference.')
            return False
        if db.execute("SELECT 1 FROM feedback WHERE session_id=? AND comment=? "
                      "AND created_at>=datetime('now','-60 seconds')",(session['id'],comment)).fetchone():
            raise ValueError('Identical feedback was just received. Please wait before sending it again.')
        db.execute('INSERT INTO feedback(session_id,comment,rating,submission_key) VALUES (?,?,?,?)',
                   (session['id'],comment,rating,submission_key))
        return True


def owner_feedback(review_token):
    """Every dashboard read is scoped by the private key, independent of UI routing."""
    with connection() as db:
        return db.execute('''SELECT f.id,f.comment,f.rating,f.created_at,r.label human_label,r.updated_at
            FROM feedback f JOIN sessions s ON s.id=f.session_id
            LEFT JOIN reviews r ON r.feedback_id=f.id
            WHERE s.review_hash=? ORDER BY f.id DESC''',(token_hash(review_token),)).fetchall()


def set_open(review_token, is_open):
    with connection() as db:
        return db.execute('UPDATE sessions SET is_open=? WHERE review_hash=?',
                          (int(bool(is_open)),token_hash(review_token))).rowcount == 1


def save_review(review_token, feedback_id, label):
    if label not in LABELS:
        raise ValueError('Invalid sentiment label.')
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        allowed = db.execute('SELECT 1 FROM feedback f JOIN sessions s ON s.id=f.session_id '
            'WHERE f.id=? AND s.review_hash=?',(feedback_id,token_hash(review_token))).fetchone()
        if not allowed:
            return False
        db.execute('INSERT INTO reviews(feedback_id,label) VALUES (?,?) ON CONFLICT(feedback_id) '
                   'DO UPDATE SET label=excluded.label,updated_at=CURRENT_TIMESTAMP',(feedback_id,label))
        db.execute('INSERT INTO review_history(feedback_id,label) VALUES (?,?)',(feedback_id,label))
        return True


def review_history(review_token, feedback_id):
    with connection() as db:
        return db.execute('SELECT h.label,h.created_at FROM review_history h JOIN feedback f '
            'ON f.id=h.feedback_id JOIN sessions s ON s.id=f.session_id '
            'WHERE f.id=? AND s.review_hash=? ORDER BY h.id DESC',
            (feedback_id,token_hash(review_token))).fetchall()


def prediction_cache(review_token, model_version):
    with connection() as db:
        rows = db.execute('SELECT p.feedback_id,p.label,p.probability FROM predictions p '
            'JOIN feedback f ON f.id=p.feedback_id JOIN sessions s ON s.id=f.session_id '
            'WHERE s.review_hash=? AND p.model_version=?',(token_hash(review_token),model_version))
        return {r['feedback_id']:(r['label'],r['probability']) for r in rows}


def save_prediction(review_token, feedback_id, model_version, label, probability):
    with connection() as db:
        return db.execute('''INSERT OR IGNORE INTO predictions(feedback_id,model_version,label,probability)
            SELECT f.id,?,?,? FROM feedback f JOIN sessions s ON s.id=f.session_id
            WHERE f.id=? AND s.review_hash=?''',
            (model_version,label,probability,feedback_id,token_hash(review_token))).rowcount == 1
